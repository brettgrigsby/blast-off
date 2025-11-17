import type { FarcadeSDK, GameInfo } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { ColumnManager } from '../systems/ColumnManager'
import { Block, BlockColor, PLAYABLE_COLORS } from '../objects/Block'
import { BlockGroup } from '../objects/BlockGroup'
import { BlockSpawner } from '../systems/BlockSpawner'
import { InputManager } from '../systems/InputManager'
import { MatchDetector } from '../systems/MatchDetector'
import { ColorAssigner } from '../systems/ColorAssigner'

// Save state interface - compact format for minimal size
interface SavedBlock {
  c: number        // column (0-8)
  y: number        // y position in pixels
  co: number       // color index (0-5 for playable colors, 6 for grey)
  v?: number       // velocityY (omit if 0)
  rt?: number      // greyRecoveryTimer remaining ms (omit if null)
  om?: boolean     // isOriginalMatchBlock (omit if false)
}

interface SavedGroup {
  bi: number[]     // block indices (into blocks array)
  v: number        // velocityY
  bc?: number      // boostCount (omit if 0)
}

interface SaveState {
  v: number        // version
  s: number        // score (blocksRemoved)
  b: SavedBlock[]  // blocks
  g?: SavedGroup[] // groups (omit if empty)
}

declare global {
  interface Window {
    FarcadeSDK: FarcadeSDK
  }
}

export class GameScene extends Phaser.Scene {
  private isMultiplayer: boolean = false
  private columnManager!: ColumnManager
  private gridLinesGraphics!: Phaser.GameObjects.Graphics
  private blockSpawner!: BlockSpawner
  private inputManager!: InputManager
  private matchDetector!: MatchDetector
  private colorAssigner!: ColorAssigner

  // Score tracking (Iteration 5)
  private blocksRemoved: number = 0
  private scoreText!: Phaser.GameObjects.Text

  // Grey block recovery tracking
  private blocksReadyToRecover: Block[] = []

  // Pause state
  private isPaused: boolean = false
  private pauseButton!: Phaser.GameObjects.Container
  private pauseOverlay!: Phaser.GameObjects.Rectangle
  private saveButton!: Phaser.GameObjects.Container
  private resumeButton!: Phaser.GameObjects.Container

  // Block dump warning indicators
  private warningLeft!: Phaser.GameObjects.Container
  private warningRight!: Phaser.GameObjects.Container

  constructor() {
    super({ key: 'GameScene' })
  }

  preload(): void {
    // Load flame sprite sheet
    // The sprite sheet is 60px wide x 20px tall, with 6 frames of 10x20 each
    this.load.spritesheet('flame', 'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/burning_loop_4-QL08GwOBzclITwWLDdZNG1G3QY8ZAb.webp?DW7A', {
      frameWidth: 10,
      frameHeight: 20
    });
  }

  create(): void {
    this.initializeSDK()
  }

  update(_time: number, delta: number): void {
    if (!this.columnManager) return
    if (this.isPaused) return

    const blocksToRemove: Block[] = []
    const groupsToRemove: any[] = []
    let blocksPlaced = false
    let blocksRemovedThisFrame = false

    // Update groups (Iteration 6)
    const groups = this.columnManager.getGroups()
    for (const group of groups) {
      // Check if group is fully above screen -> remove entire group
      if (group.isFullyAboveScreen()) {
        groupsToRemove.push(group)
        continue
      }

      // Update the group (applies gravity to all blocks)
      group.update(delta)

      // Check for collisions with other groups (midair collisions)
      for (const otherGroup of groups) {
        // Skip self-collision and already-marked-for-removal groups
        if (otherGroup === group || groupsToRemove.includes(otherGroup)) {
          continue
        }

        // Check if groups are colliding
        if (this.columnManager.checkGroupCollision(group, otherGroup)) {
          // Merge otherGroup into this group (combines momentum)
          group.mergeWith(otherGroup)

          // Mark otherGroup for removal (it's been merged)
          groupsToRemove.push(otherGroup)
        }
      }

      // Check for matches within the moving group
      if (this.matchDetector) {
        this.matchDetector.checkMatchesInGroup(group)
      }

      // Remove individual blocks from group if they go above screen
      for (const block of group.getBlocks()) {
        if (block.isAboveScreen()) {
          group.removeBlock(block)
          this.columnManager.removeBlock(block)
          this.blocksRemoved++
          blocksRemovedThisFrame = true
        }
      }

      // If group is now empty, remove it
      if (group.isEmpty()) {
        groupsToRemove.push(group)
        continue
      }

      // Check if group should disband (any block colliding)
      let shouldDisband = false
      for (const block of group.getBlocks()) {
        const collision = this.columnManager.checkCollision(block)
        if (collision.collided) {
          shouldDisband = true
          break
        }
      }

      if (shouldDisband) {
        // Disband group - place all blocks individually
        for (const block of group.getBlocks()) {
          // Hide flames when group disbands
          if (block.isOriginalMatchBlock) {
            block.hideFlame()
          }

          const collision = this.columnManager.checkCollision(block)
          if (collision.collided) {
            this.columnManager.placeBlock(block, collision.restColumn, collision.restY)
            blocksPlaced = true
          } else {
            // Block hasn't collided yet, let it fall independently
            block.setVelocity(block.velocityY)
          }
        }
        groupsToRemove.push(group)
      }
    }

    // Update individual moving blocks (not in groups)
    const movingBlocks = this.columnManager.getMovingBlocks()
    for (const block of movingBlocks) {
      // Skip blocks that are in a group
      if (this.columnManager.getBlockGroup(block)) {
        continue
      }

      // Check if block is above screen and should be removed
      if (block.isAboveScreen()) {
        blocksToRemove.push(block)
        continue
      }

      // Check if this falling block should join a group in the same column
      // (Iteration 6: falling blocks join groups)
      let joinedGroup = false
      for (const group of groups) {
        // Check if any block in the group is in the same column
        for (const groupBlock of group.getBlocks()) {
          if (groupBlock.column === block.column) {
            // Check if the falling block is close enough to join
            const distance = Math.abs(block.y - groupBlock.y)
            if (distance < ColumnManager.ROW_HEIGHT * 2) {
              // Find where this block would be positioned in the group
              const targetY = group.findClosestStackPosition(block)

              // Only join if it won't cause overlap
              if (targetY !== null && !group.wouldOverlap(block, targetY)) {
                group.addBlock(block)
                joinedGroup = true
                break
              }
            }
          }
        }
        if (joinedGroup) break
      }

      if (joinedGroup) {
        continue // Block is now part of a group, skip individual update
      }

      // Update block position (applies gravity and velocity)
      block.update(delta)

      // Check for collision (only for blocks moving downward)
      const collision = this.columnManager.checkCollision(block)
      if (collision.collided) {
        // Place the block at rest position (using Y position)
        this.columnManager.placeBlock(block, collision.restColumn, collision.restY)
        blocksPlaced = true
      }
    }

    // Remove groups that went fully above screen
    for (const group of groupsToRemove) {
      // Check if this group is fully above screen (for removal)
      const isFullyAbove = group.isFullyAboveScreen()

      // Remove all blocks in the group
      for (const block of group.getBlocks()) {
        if (isFullyAbove) {
          // Group went fully above screen - remove all blocks
          this.columnManager.removeBlock(block)
          this.blocksRemoved++
        } else if (block.isAboveScreen()) {
          // Group disbanded but some blocks are above - remove only those
          this.columnManager.removeBlock(block)
          this.blocksRemoved++
        }
      }
      this.columnManager.removeGroup(group)
    }

    // Remove individual blocks that went above screen
    for (const block of blocksToRemove) {
      this.columnManager.removeBlock(block)
      this.blocksRemoved++
    }

    // Update score display if blocks were removed
    if (blocksToRemove.length > 0 || groupsToRemove.length > 0 || blocksRemovedThisFrame) {
      this.updateScoreDisplay()
    }

    // Check for matches after blocks are placed
    if (blocksPlaced && this.matchDetector) {
      const matchCount = this.matchDetector.checkAndProcessMatches()

      // If a match was made, cancel any current drag
      if (matchCount > 0 && this.inputManager) {
        this.inputManager.cancelDrag()
      }
    }

    // Grey block recovery system: Convert grey blocks back to colored after 2 seconds at rest
    const allBlocks = this.columnManager.getAllBlocks()

    for (const block of allBlocks) {
      if (block.isGrey()) {
        const isAtRest = block.isAtRest()

        // Check if block just stopped moving (transition from moving to at rest)
        if (isAtRest && block.wasMovingLastFrame) {
          // Block just came to rest - start recovery timer
          if (!block.greyRecoveryTimer) {
            block.greyRecoveryTimer = this.time.addEvent({
              delay: Block.GREY_RECOVERY_DELAY,
              callback: () => {
                // Mark block as ready for recovery (actual color assigned in batch below)
                this.blocksReadyToRecover.push(block)
                block.greyRecoveryTimer = null
              },
              callbackScope: this,
              loop: false
            })
          }
        }

        // If block starts moving again, cancel the timer
        if (!isAtRest && block.greyRecoveryTimer) {
          block.greyRecoveryTimer.remove()
          block.greyRecoveryTimer = null
        }

        // Update motion state for next frame
        block.wasMovingLastFrame = !isAtRest
      }
    }

    // Batch assign colors to all blocks that recovered this frame
    if (this.blocksReadyToRecover.length > 0 && this.colorAssigner) {
      this.colorAssigner.assignColorsToBlocks(this.blocksReadyToRecover)
      this.blocksReadyToRecover = [] // Clear for next frame
    }
  }

  private async initializeSDK(): Promise<void> {
    if (!window.FarcadeSDK) {
      this.createGameElements()
      return
    }

    // Determine multiplayer mode based on build configuration
    // @ts-ignore - This is defined by Vite's define config
    this.isMultiplayer =
      typeof GAME_MULTIPLAYER_MODE !== 'undefined' ? GAME_MULTIPLAYER_MODE : false

    // Set up SDK event listeners
    window.FarcadeSDK.on('play_again', () => {
      this.scene.restart()
    })

    window.FarcadeSDK.on('toggle_mute', (data: { isMuted: boolean }) => {
      // Handle mute toggle if needed
    })

    if (this.isMultiplayer) {
      window.FarcadeSDK.on('game_state_updated', (gameState: any) => {
        // Handle multiplayer state updates
      })

      try {
        const gameInfo = await window.FarcadeSDK.multiplayer.actions.ready()
        this.createGameElements()
      } catch (error) {
        console.error('Failed to initialize multiplayer SDK:', error)
        this.createGameElements()
      }
    } else {
      try {
        const gameInfo = await window.FarcadeSDK.singlePlayer.actions.ready()
        this.createGameElements()

        // Load saved game state if available
        if (gameInfo?.initialGameState?.gameState) {
          this.loadGameState(gameInfo.initialGameState.gameState as SaveState)
        }
      } catch (error) {
        console.error('Failed to initialize single player SDK:', error)
        this.createGameElements()
      }
    }
  }

  private createGameElements(): void {
    // Create flame animation if sprite sheet loaded
    if (this.textures.exists('flame')) {
      const texture = this.textures.get('flame');

      if (texture.frameTotal > 1) {
        this.anims.create({
          key: 'flame-animation',
          frames: this.anims.generateFrameNumbers('flame', { start: 0, end: texture.frameTotal - 1 }),
          frameRate: 18,
          repeat: -1
        });
      }
    }

    // Initialize column system
    this.columnManager = new ColumnManager(this)

    // Create graphics for grid lines (debug visualization)
    this.gridLinesGraphics = this.add.graphics()
    this.columnManager.drawGridLines(this.gridLinesGraphics)

    // Initialize match detector (Iteration 4)
    this.matchDetector = new MatchDetector(this.columnManager)

    // Initialize color assigner for smart grey block recovery
    this.colorAssigner = new ColorAssigner(this.columnManager)

    // Populate grid with random colored blocks for testing (Iteration 1)
    // Comment this out for Iteration 2 to see spawning
    // this.populateTestGrid()

    // ===== TEMPORARY: DEV HELPER - START WITH 3 BLOCKS PER COLUMN =====
    this.populateStartingBlocks()
    // ===== END TEMPORARY =====

    // Initialize and start block spawner (Iteration 2)
    this.blockSpawner = new BlockSpawner(this, this.columnManager)
    this.blockSpawner.start()

    // Initialize input manager (Iteration 3)
    // Pass callback to check for matches after swaps (Iteration 4)
    this.inputManager = new InputManager(this, this.columnManager, () => {
      this.matchDetector.checkAndProcessMatches()

      // Also check matches in moving groups immediately after swap
      // This prevents delay when creating matches within existing groups
      const groups = this.columnManager.getGroups()
      for (const group of groups) {
        this.matchDetector.checkMatchesInGroup(group)
      }
    })

    // Add score counter at bottom left (Iteration 5)
    this.scoreText = this.add
      .text(
        20,
        GameSettings.canvas.height - 20,
        '0',
        {
          fontSize: '48px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0, 1)
      .setDepth(1000) // Keep text above blocks

    // Add pause button at bottom right (two rectangles)
    // Rectangles: centered at their positions, spans x:0-16 and x:24-40, y:-20 to 20
    const pauseRect1 = this.add.rectangle(8, 0, 16, 40, 0xffffff)
    const pauseRect2 = this.add.rectangle(32, 0, 16, 40, 0xffffff)
    this.pauseButton = this.add.container(
      GameSettings.canvas.width - 60,
      GameSettings.canvas.height - 50,
      [pauseRect1, pauseRect2]
    )
      .setDepth(1000)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, -20, 40, 40),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.pauseGame())

    // Create block dump warning indicators (hidden initially)
    this.createWarningIndicators()

    // Create pause menu overlay (hidden initially)
    this.pauseOverlay = this.add
      .rectangle(0, 0, GameSettings.canvas.width, GameSettings.canvas.height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setDepth(2000)
      .setVisible(false)
      .setInteractive() // Make interactive to block clicks to game below

    // Save Game button with border
    const saveButtonBg = this.add.graphics()
      .lineStyle(1, 0xffffff, 1)
      .strokeRoundedRect(-150, -40, 300, 80, 10)
    const saveButtonText = this.add.text(0, 0, 'Save Game', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.saveButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 - 50,
      [saveButtonBg, saveButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-150, -40, 300, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.saveGame())

    // Resume button with border
    const resumeButtonBg = this.add.graphics()
      .lineStyle(1, 0xffffff, 1)
      .strokeRoundedRect(-150, -40, 300, 80, 10)
    const resumeButtonText = this.add.text(0, 0, 'Resume', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.resumeButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 + 50,
      [resumeButtonBg, resumeButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-150, -40, 300, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.resumeGame())
  }

  /**
   * Update the score display (Iteration 5)
   */
  private updateScoreDisplay(): void {
    if (this.scoreText) {
      this.scoreText.setText(`${this.blocksRemoved}`)
    }
  }

  /**
   * Create warning indicators for block dump
   */
  private createWarningIndicators(): void {
    // Create left warning indicator
    const leftCircle = this.add.graphics()
    leftCircle.fillStyle(0xff0000, 1)
    leftCircle.fillCircle(0, 0, 25)

    const leftText = this.add.text(0, 0, '!', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.warningLeft = this.add.container(40, 40, [leftCircle, leftText])
      .setDepth(1000)
      .setVisible(false)

    // Create right warning indicator
    const rightCircle = this.add.graphics()
    rightCircle.fillStyle(0xff0000, 1)
    rightCircle.fillCircle(0, 0, 25)

    const rightText = this.add.text(0, 0, '!', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.warningRight = this.add.container(GameSettings.canvas.width - 40, 40, [rightCircle, rightText])
      .setDepth(1000)
      .setVisible(false)
  }

  /**
   * Show dump warning indicators with flashing animation
   */
  public showDumpWarning(): void {
    if (!this.warningLeft || !this.warningRight) return

    this.warningLeft.setVisible(true)
    this.warningRight.setVisible(true)

    // Create flashing animation (fade between 0.3 and 1.0 alpha)
    this.tweens.add({
      targets: [this.warningLeft, this.warningRight],
      alpha: { from: 1, to: 0.3 },
      duration: 300,
      yoyo: true,
      repeat: -1, // Infinite repeat
    })
  }

  /**
   * Hide dump warning indicators and stop animation
   */
  public hideDumpWarning(): void {
    if (!this.warningLeft || !this.warningRight) return

    // Stop all tweens on the warning containers
    this.tweens.killTweensOf([this.warningLeft, this.warningRight])

    // Reset alpha and hide
    this.warningLeft.setAlpha(1).setVisible(false)
    this.warningRight.setAlpha(1).setVisible(false)
  }

  /**
   * Pause the game
   */
  private pauseGame(): void {
    this.isPaused = true

    // Stop game systems
    this.blockSpawner.stop()
    this.inputManager.setEnabled(false)
    this.physics.pause()

    // Show pause menu
    this.pauseOverlay.setVisible(true)
    this.saveButton.setVisible(true)
    this.resumeButton.setVisible(true)
    this.pauseButton.setVisible(false)
  }

  /**
   * Resume the game
   */
  private resumeGame(): void {
    console.log('Resume button clicked')
    this.isPaused = false

    // Restart game systems
    this.blockSpawner.start()
    this.inputManager.setEnabled(true)
    this.physics.resume()

    // Hide pause menu
    this.pauseOverlay.setVisible(false)
    this.saveButton.setVisible(false)
    this.resumeButton.setVisible(false)
    this.pauseButton.setVisible(true)
  }

  /**
   * Serialize the current game state to a compact format
   */
  private serializeGameState(): SaveState {
    const allBlocks = this.columnManager.getAllBlocks()
    const groups = this.columnManager.getGroups()

    // Create a map of block -> index for group serialization
    const blockIndexMap = new Map<Block, number>()

    // Serialize blocks
    const savedBlocks: SavedBlock[] = allBlocks.map((block, index) => {
      blockIndexMap.set(block, index)

      // Map color to index (0-5 for playable colors, 6 for grey)
      let colorIndex: number
      if (block.color === BlockColor.GREY) {
        colorIndex = 6
      } else {
        colorIndex = PLAYABLE_COLORS.indexOf(block.color)
        if (colorIndex === -1) {
          // Fallback to 0 if color not found (should never happen)
          colorIndex = 0
        }
      }

      const savedBlock: SavedBlock = {
        c: block.column,
        y: Math.round(block.y), // Round to avoid floating point precision issues
        co: colorIndex
      }

      // Only include velocityY if non-zero
      if (block.velocityY !== 0) {
        savedBlock.v = Math.round(block.velocityY)
      }

      // Only include recovery timer if active
      if (block.greyRecoveryTimer) {
        const remaining = block.greyRecoveryTimer.getRemaining()
        savedBlock.rt = Math.round(remaining)
      }

      // Only include isOriginalMatchBlock if true
      if (block.isOriginalMatchBlock) {
        savedBlock.om = true
      }

      return savedBlock
    })

    // Serialize groups
    const savedGroups: SavedGroup[] = []
    for (const group of groups) {
      const blockIndices: number[] = []
      for (const block of group.getBlocks()) {
        const index = blockIndexMap.get(block)
        if (index !== undefined) {
          blockIndices.push(index)
        }
      }

      if (blockIndices.length > 0) {
        const savedGroup: SavedGroup = {
          bi: blockIndices,
          v: Math.round(group.getVelocity())
        }
        // Only include boostCount if it's non-zero
        const boostCount = group.getBoostCount()
        if (boostCount > 0) {
          savedGroup.bc = boostCount
        }
        savedGroups.push(savedGroup)
      }
    }

    const saveState: SaveState = {
      v: 1, // version
      s: this.blocksRemoved,
      b: savedBlocks
    }

    // Only include groups if there are any
    if (savedGroups.length > 0) {
      saveState.g = savedGroups
    }

    return saveState
  }

  /**
   * Save game using Farcade SDK
   */
  private async saveGame(): Promise<void> {
    if (!window.FarcadeSDK) {
      console.error('FarcadeSDK not available')
      return
    }

    try {
      const gameState = this.serializeGameState()
      await window.FarcadeSDK.singlePlayer.actions.saveGameState({ gameState })
      console.log('Game saved successfully', gameState)

      // Update button to show success feedback
      const buttonText = this.saveButton.getAt(1) as Phaser.GameObjects.Text

      // Update text and color
      buttonText.setText('SAVED!')
      buttonText.setColor('#00ff00')

      // Reset button after 1 second
      this.time.delayedCall(1000, () => {
        buttonText.setText('Save Game')
        buttonText.setColor('#ffffff')
      })
    } catch (error) {
      console.error('Failed to save game:', error)
    }
  }

  /**
   * Load game state from saved data
   */
  private loadGameState(saveState: SaveState): void {
    console.log('Loading game state', saveState)

    // Stop game systems temporarily
    if (this.blockSpawner) {
      this.blockSpawner.stop()
    }
    if (this.inputManager) {
      this.inputManager.setEnabled(false)
    }

    // Clear existing game state
    if (this.columnManager) {
      this.columnManager.clear()
    }

    // Restore score
    this.blocksRemoved = saveState.s
    this.updateScoreDisplay()

    // Recreate blocks
    const blocks: Block[] = []
    for (const savedBlock of saveState.b) {
      // Map color index back to BlockColor
      let color: BlockColor
      if (savedBlock.co === 6) {
        color = BlockColor.GREY
      } else {
        color = PLAYABLE_COLORS[savedBlock.co] || BlockColor.RED
      }

      // Create block with position and velocity
      const velocity = savedBlock.v || 0
      const block = this.columnManager.addBlock(savedBlock.c, savedBlock.y, color, velocity)

      // Restore grey recovery timer if present
      if (savedBlock.rt && savedBlock.rt > 0) {
        block.greyRecoveryTimer = this.time.addEvent({
          delay: savedBlock.rt,
          callback: () => {
            this.blocksReadyToRecover.push(block)
            block.greyRecoveryTimer = null
          },
          callbackScope: this,
          loop: false
        })
      }

      // Restore original match block status and show flame
      if (savedBlock.om) {
        block.isOriginalMatchBlock = true
        block.showFlame()
      }

      blocks.push(block)
    }

    // Recreate groups
    if (saveState.g) {
      for (const savedGroup of saveState.g) {
        const groupBlocks: Block[] = []
        for (const blockIndex of savedGroup.bi) {
          if (blockIndex >= 0 && blockIndex < blocks.length) {
            groupBlocks.push(blocks[blockIndex])
          }
        }

        if (groupBlocks.length > 0) {
          const group = new BlockGroup(groupBlocks)
          // Set the group's velocity (BlockGroup constructor sets it from first block,
          // but we need to override it with the saved velocity)
          group.setVelocity(savedGroup.v)
          // Restore boost count if it was saved
          if (savedGroup.bc !== undefined) {
            group.setBoostCount(savedGroup.bc)
          }
          this.columnManager.addGroup(group)
        }
      }
    }

    // Resume game systems
    if (this.blockSpawner) {
      this.blockSpawner.start()
    }
    if (this.inputManager) {
      this.inputManager.setEnabled(true)
    }

    console.log('Game state loaded successfully')
  }

  /**
   * Populate grid with random colored blocks for testing (Iteration 1)
   */
  private populateTestGrid(): void {
    // Fill bottom half of grid with random blocks (rows 6-11)
    for (let row = 6; row < ColumnManager.ROWS; row++) {
      for (let col = 0; col < ColumnManager.COLUMNS; col++) {
        const color = Block.getRandomColor()
        const { y } = this.columnManager.gridToPixel(col, row)
        this.columnManager.addBlock(col, y, color)
      }
    }
  }

  /**
   * ===== TEMPORARY: DEV HELPER =====
   * Start the game with 3 random blocks in each column at the bottom.
   * This makes testing easier by not having to wait for blocks to spawn.
   * TODO: Remove this before production release
   * ===== END TEMPORARY =====
   */
  private populateStartingBlocks(): void {
    // Add 3 blocks to each column at the bottom (rows 9, 10, 11)
    for (let col = 0; col < ColumnManager.COLUMNS; col++) {
      for (let row = ColumnManager.ROWS - 3; row < ColumnManager.ROWS; row++) {
        const color = Block.getRandomColor()
        const { y } = this.columnManager.gridToPixel(col, row)
        this.columnManager.addBlock(col, y, color)
      }
    }
  }
}
