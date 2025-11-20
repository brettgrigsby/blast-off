import type { FarcadeSDK, GameInfo } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { mergeLevelConfig, type LevelConfig } from '../config/LevelConfig'
import { ColumnManager } from '../systems/ColumnManager'
import { Block, BlockColor, PLAYABLE_COLORS } from '../objects/Block'
import { BlockGroup } from '../objects/BlockGroup'
import { BlockSpawner } from '../systems/BlockSpawner'
import { InputManager } from '../systems/InputManager'
import { MatchDetector } from '../systems/MatchDetector'
import { ColorAssigner } from '../systems/ColorAssigner'
import { GameStateManager, type GameState } from '../systems/GameStateManager'
import { GlobalGameState } from '../systems/GlobalGameState'

declare global {
  interface Window {
    FarcadeSDK: FarcadeSDK
  }
}

export class LevelScene extends Phaser.Scene {
  private isMultiplayer: boolean = false
  private isBackgroundMode: boolean = false
  private levelConfig!: LevelConfig
  private columnManager!: ColumnManager
  private gridLinesGraphics!: Phaser.GameObjects.Graphics
  private blockSpawner!: BlockSpawner
  private inputManager!: InputManager
  private matchDetector!: MatchDetector
  private colorAssigner!: ColorAssigner

  // Score tracking (Iteration 5)
  private blocksRemoved: number = 0
  private finalScore: number = 0
  private scoreText!: Phaser.GameObjects.Text

  // Grey block recovery tracking
  private blocksReadyToRecover: Block[] = []
  private greyBlockSafetyTimer: Phaser.Time.TimerEvent | null = null

  // Pause state
  private isPaused: boolean = false
  private pauseButton!: Phaser.GameObjects.Container
  private pauseOverlay!: Phaser.GameObjects.Rectangle
  private saveButton!: Phaser.GameObjects.Container
  private abandonButton!: Phaser.GameObjects.Container
  private resumeButton!: Phaser.GameObjects.Container

  // LFG button state
  private lfgButton!: Phaser.GameObjects.Container
  private lfgButtonBg!: Phaser.GameObjects.Graphics
  private isLFGActive: boolean = false
  private lfgStartTime: number = 0
  private lfgOverlayTween: Phaser.Tweens.Tween | null = null
  private lfgButtonColorTween: Phaser.Tweens.Tween | null = null
  private lfgButtonColorValue: number = 0

  // Block dump warning overlay
  private warningOverlay!: Phaser.GameObjects.Rectangle

  // LFG mode blue overlay
  private blueOverlay!: Phaser.GameObjects.Rectangle

  // Lose condition tracking
  private loseConditionTimers: Map<number, Phaser.Time.TimerEvent> = new Map()
  private columnsAtRisk: Set<number> = new Set()
  private columnWarnings: Map<number, Phaser.GameObjects.Rectangle> = new Map()
  private gameOverOverlay!: Phaser.GameObjects.Rectangle
  private gameOverTitle!: Phaser.GameObjects.Text
  private tryAgainButton!: Phaser.GameObjects.Container
  private saveScoreButton!: Phaser.GameObjects.Container
  private hasSavedGame: boolean = false
  private savedGameState: GameState | null = null

  constructor() {
    super({ key: 'LevelScene' })
  }

  create(data?: { backgroundMode?: boolean; levelConfig?: Partial<LevelConfig> }): void {
    // Reset state variables (scene instance may be reused by Phaser)
    this.isBackgroundMode = data?.backgroundMode === true
    this.isPaused = false
    this.isLFGActive = false
    this.blocksRemoved = 0
    this.blocksReadyToRecover = []
    this.columnsAtRisk = new Set()
    this.loseConditionTimers = new Map()
    this.columnWarnings = new Map()
    this.hasSavedGame = false
    this.savedGameState = null

    // Merge provided config with defaults
    this.levelConfig = mergeLevelConfig(data?.levelConfig)

    this.initializeSDK()
  }

  update(_time: number, delta: number): void {
    if (!this.columnManager) return
    if (this.isPaused) return

    const blocksToRemove: Block[] = []
    const groupsToRemove: any[] = []
    let blocksPlaced = false
    let blocksRemovedThisFrame = false

    // Continuous match checking - check grid for matches every frame
    if (this.matchDetector) {
      const matchCount = this.matchDetector.checkAndProcessMatches()

      // If a match was made, cancel any current drag
      if (matchCount > 0 && this.inputManager) {
        this.inputManager.cancelDrag()
      }
    }

    // Update groups (Iteration 6)
    const groups = this.columnManager.getGroups()
    for (const group of groups) {
      // Check if group is fully above screen -> remove entire group
      // Only remove if moving upward or stationary - falling groups (velocityY > 0) are kept
      if (group.isFullyAboveScreen() && group.getVelocity() <= 0) {
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
      // Only remove if moving upward or stationary - falling blocks (velocityY > 0) are kept
      for (const block of group.getBlocks()) {
        if (block.isAboveScreen() && block.velocityY <= 0) {
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

      // Apply grace period: don't disband if group recently transitioned from upward to downward
      // This prevents premature disbanding when groups are at the apex of their trajectory
      if (shouldDisband && group.isInGracePeriod()) {
        shouldDisband = false
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
      // Only remove if moving upward or stationary - falling blocks (velocityY > 0) are kept
      if (block.isAboveScreen() && block.velocityY <= 0) {
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

    // Check for lose condition (columns too tall)
    const previousColumnsAtRisk = new Set(this.columnsAtRisk)
    this.checkLoseCondition()

    // Start timers for newly at-risk columns
    for (const col of this.columnsAtRisk) {
      if (!previousColumnsAtRisk.has(col) && !this.loseConditionTimers.has(col)) {
        // Start 5-second timer for this column
        const timer = this.time.addEvent({
          delay: 5000,
          callback: () => {
            this.triggerGameOver()
          },
          callbackScope: this,
          loop: false,
        })
        this.loseConditionTimers.set(col, timer)
      }
    }

    // Remove timers for columns no longer at risk
    for (const col of previousColumnsAtRisk) {
      if (!this.columnsAtRisk.has(col)) {
        const timer = this.loseConditionTimers.get(col)
        if (timer) {
          timer.remove()
          this.loseConditionTimers.delete(col)
        }
      }
    }

    // Safety net: Recover orphaned blocks (blocks stuck with velocity=0, not in grid, not in group)
    // Runs at END of update loop to catch blocks orphaned during this frame
    for (const block of this.columnManager.getAllBlocks()) {
      // Detect orphaned blocks
      if (block.velocityY === 0 && !block.isInGrid && !this.columnManager.getBlockGroup(block)) {
        // Force block to start falling with high velocity to avoid re-snapping to 0
        block.setVelocity(300)
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
              delay: block.greyRecoveryDelay,
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

    // LFG mode spawn rate ramping
    if (this.isLFGActive && this.blockSpawner) {
      // If a dump is active, stop LFG mode
      if (this.blockSpawner.isDumpActive()) {
        this.handleLFGUp()
      } else {
        // Calculate elapsed time since LFG started
        const elapsedTime = this.time.now - this.lfgStartTime
        const rampDuration = 1500 // milliseconds

        // Get base and target spawn rates
        const baseRate = this.blockSpawner.getBaseSpawnRate()
        const targetRate = 200 // 200ms = max speed (5 blocks per second)

        // Calculate interpolation factor (clamped to 0-1)
        const t = Math.min(elapsedTime / rampDuration, 1)

        // Linear interpolation from base rate to target rate
        const newRate = baseRate + (targetRate - baseRate) * t

        // Update LFG spawning with the new rate
        this.blockSpawner.updateLFGSpawning(newRate)
      }
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
        await window.FarcadeSDK.singlePlayer.actions.ready()
        this.createGameElements()

        // Load saved game state from GlobalGameState
        const globalGameState = GlobalGameState.getInstance()
        const gameState = globalGameState.getGameState()

        if (gameState?.currentLevel) {
          // Store the raw state for game over "Load from Save" feature
          this.savedGameState = gameState
          this.hasSavedGame = true
          // Load it (deserialize handles both formats)
          this.loadGameState(gameState)
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
    this.columnManager = new ColumnManager(this, {
      greyRecoveryDelay: this.levelConfig.greyRecoveryDelay,
      maxDescentVelocity: this.levelConfig.maxDescentVelocity,
      baseGravity: this.levelConfig.baseGravity,
      massGravityFactor: this.levelConfig.massGravityFactor,
    })

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
    this.blockSpawner = new BlockSpawner(this, this.columnManager, {
      spawnRate: this.levelConfig.spawnRate,
      dumpInterval: this.levelConfig.dumpInterval,
    })
    this.blockSpawner.start()

    // Initialize input manager (Iteration 3)
    // Note: Match checking is now handled continuously in the update loop
    this.inputManager = new InputManager(this, this.columnManager, () => {
      // Empty callback - continuous match checking handles this now
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

    // Add LFG button at bottom middle (full height of bottom section: 90px)
    const gridBottom = ColumnManager.GRID_OFFSET_Y + (ColumnManager.ROWS * ColumnManager.ROW_HEIGHT)
    const bottomSectionHeight = GameSettings.canvas.height - gridBottom
    const buttonCenterY = gridBottom + (bottomSectionHeight / 2)
    const buttonHalfHeight = bottomSectionHeight / 2

    this.lfgButtonBg = this.add.graphics()
      .fillStyle(0x03ad86, 0.8)
      .fillRect(-150, -buttonHalfHeight, 300, bottomSectionHeight)
    const lfgButtonIcon = this.add.image(0, 0, 'fallingBlock')
      .setOrigin(0.5)
    this.lfgButton = this.add.container(
      GameSettings.canvas.width / 2,
      buttonCenterY,
      [this.lfgButtonBg, lfgButtonIcon]
    )
      .setDepth(1000)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-150, -buttonHalfHeight, 300, bottomSectionHeight),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.handleLFGDown())
      .on('pointerup', () => this.handleLFGUp())
      .on('pointerout', () => this.handleLFGUp()) // Also release if pointer leaves button

    // Create block dump warning indicators (hidden initially)
    this.createWarningIndicators()

    // Start grey block safety check timer
    this.startGreyBlockSafetyCheck()

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
      .strokeRoundedRect(-160, -40, 320, 80, 10)
    const saveButtonText = this.add.text(0, 0, 'Save Game', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.saveButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 - 100,
      [saveButtonBg, saveButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-160, -40, 320, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.saveGame())

    // Abandon Game button with border
    const abandonButtonBg = this.add.graphics()
      .lineStyle(1, 0xffffff, 1)
      .strokeRoundedRect(-160, -40, 320, 80, 10)
    const abandonButtonText = this.add.text(0, 0, 'Abandon Game', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.abandonButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2,
      [abandonButtonBg, abandonButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-160, -40, 320, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.abandonGame())

    // Resume button with border
    const resumeButtonBg = this.add.graphics()
      .lineStyle(1, 0xffffff, 1)
      .strokeRoundedRect(-160, -40, 320, 80, 10)
    const resumeButtonText = this.add.text(0, 0, 'Resume', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.resumeButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 + 100,
      [resumeButtonBg, resumeButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-160, -40, 320, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.resumeGame())

    // Create game over overlay (hidden initially)
    this.createGameOverOverlay()

    // Configure for background mode if needed
    if (this.isBackgroundMode) {
      // Hide UI elements
      this.scoreText.setVisible(false)
      this.pauseButton.setVisible(false)
      this.lfgButton.setVisible(false)

      // Disable input
      this.inputManager.setEnabled(false)

      // Add blur effect to background game
      const camera = this.cameras.main
      if (camera.postFX) {
        camera.postFX.addBlur(0, 0, 0, 2, 0xffffff, 3)
      }
    } else {
      // Make sure input is enabled for normal gameplay
      this.inputManager.setEnabled(true)
    }
  }

  /**
   * Create game over overlay and buttons
   */
  private createGameOverOverlay(): void {
    // Background overlay
    this.gameOverOverlay = this.add
      .rectangle(0, 0, GameSettings.canvas.width, GameSettings.canvas.height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setDepth(2000)
      .setVisible(false)
      .setInteractive() // Block clicks to game below

    // Title text
    this.gameOverTitle = this.add.text(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 3,
      'Level Failed',
      {
        fontSize: '60px',
        color: '#ff0000',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }
    )
      .setOrigin(0.5)
      .setDepth(2001)
      .setVisible(false)

    // Try Again button
    const tryAgainButtonBg = this.add.graphics()
      .lineStyle(1, 0xffffff, 1)
      .strokeRoundedRect(-150, -40, 300, 80, 10)
    const tryAgainButtonText = this.add.text(0, 0, 'Try Again', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.tryAgainButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 - 50,
      [tryAgainButtonBg, tryAgainButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-150, -40, 300, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.tryAgain())

    // Save Score button
    const saveScoreButtonBg = this.add.graphics()
      .lineStyle(1, 0xffffff, 1)
      .strokeRoundedRect(-150, -40, 300, 80, 10)
    const saveScoreButtonText = this.add.text(0, 0, 'Save Score', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.saveScoreButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 + 50,
      [saveScoreButtonBg, saveScoreButtonText]
    )
      .setDepth(2001)
      .setVisible(false)
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-150, -40, 300, 80),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.saveScore())
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
   * Create warning overlay for block dump
   */
  private createWarningIndicators(): void {
    // Create red flashing overlay that covers the area between screen top and board top
    this.warningOverlay = this.add
      .rectangle(0, 0, GameSettings.canvas.width, ColumnManager.GRID_OFFSET_Y, 0xff0000, 0.5)
      .setOrigin(0, 0)
      .setDepth(1000)
      .setVisible(false)

    // Create blue glow overlay for LFG mode
    this.blueOverlay = this.add
      .rectangle(0, 0, GameSettings.canvas.width, ColumnManager.GRID_OFFSET_Y, 0x0000ff, 0)
      .setOrigin(0, 0)
      .setDepth(1001)
      .setVisible(false)
  }

  /**
   * Show dump warning overlay with flashing animation
   */
  public showDumpWarning(): void {
    if (!this.warningOverlay) return

    this.warningOverlay.setVisible(true)

    // Create flashing animation (fade between 0 and 0.5 alpha for red overlay)
    this.tweens.add({
      targets: this.warningOverlay,
      alpha: { from: 0.5, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: -1, // Infinite repeat
    })
  }

  /**
   * Hide dump warning overlay and stop animation
   */
  public hideDumpWarning(): void {
    if (!this.warningOverlay) return

    // Stop all tweens on the warning overlay
    this.tweens.killTweensOf(this.warningOverlay)

    // Reset alpha and hide
    this.warningOverlay.setAlpha(0.5).setVisible(false)
  }

  /**
   * Start periodic safety check for grey blocks
   * Ensures all grey blocks at rest have recovery timers
   */
  private startGreyBlockSafetyCheck(): void {
    // Run safety check every 2 seconds
    this.greyBlockSafetyTimer = this.time.addEvent({
      delay: 2000,
      callback: this.checkGreyBlockTimers,
      callbackScope: this,
      loop: true,
    })
  }

  /**
   * Safety check: Ensure all grey blocks at rest have recovery timers
   */
  private checkGreyBlockTimers(): void {
    if (!this.columnManager) return

    const allBlocks = this.columnManager.getAllBlocks()

    for (const block of allBlocks) {
      // Only check grey blocks that are at rest and don't have a timer
      if (block.isGrey() && block.isAtRest() && !block.greyRecoveryTimer) {
        // Start recovery timer
        block.greyRecoveryTimer = this.time.addEvent({
          delay: block.greyRecoveryDelay,
          callback: () => {
            this.blocksReadyToRecover.push(block)
            block.greyRecoveryTimer = null
          },
          callbackScope: this,
          loop: false
        })
      }
    }
  }

  /**
   * Create a yellow flashing warning overlay for a column at risk
   */
  private createColumnWarning(columnIndex: number): void {
    // Don't create if already exists
    if (this.columnWarnings.has(columnIndex)) return

    // Calculate column X position
    const columnX = ColumnManager.GRID_OFFSET_X + (columnIndex * ColumnManager.COLUMN_WIDTH)

    // Create orange-yellow rectangle covering the full column
    const warningRect = this.add
      .rectangle(
        columnX,
        0,
        ColumnManager.COLUMN_WIDTH,
        GameSettings.canvas.height,
        0xffaa00, // Orange-yellow (more red than pure yellow)
        0.5 // More opaque for visibility
      )
      .setOrigin(0, 0)
      .setDepth(500) // Above blocks, below UI

    // Add flashing animation
    this.tweens.add({
      targets: warningRect,
      alpha: { from: 0.5, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: -1, // Infinite repeat
    })

    // Store the warning
    this.columnWarnings.set(columnIndex, warningRect)
  }

  /**
   * Hide and remove a column warning
   */
  private hideColumnWarning(columnIndex: number): void {
    const warning = this.columnWarnings.get(columnIndex)
    if (!warning) return

    // Stop animation
    this.tweens.killTweensOf(warning)

    // Destroy and remove
    warning.destroy()
    this.columnWarnings.delete(columnIndex)
  }

  /**
   * Check if any columns are over height (lose condition)
   * Updates the columnsAtRisk set with columns that are too tall
   * @returns true if any column is at risk
   */
  private checkLoseCondition(): boolean {
    if (!this.columnManager) return false

    // Clear previous at-risk columns
    const previousAtRisk = new Set(this.columnsAtRisk)
    this.columnsAtRisk.clear()

    // Check each column
    for (let col = 0; col < ColumnManager.COLUMNS; col++) {
      const column = this.columnManager.getColumn(col)
      if (!column) continue

      const blocksAtRest = column.getBlocksAtRest()
      if (blocksAtRest.length === 0) continue

      // Get the topmost block (first in sorted array)
      const topmostBlock = blocksAtRest[0]

      // Check if block is at or above the grid top line
      if (topmostBlock.y <= ColumnManager.GRID_OFFSET_Y) {
        this.columnsAtRisk.add(col)
      }
    }

    // Update column warnings based on changes
    // Add warnings for newly at-risk columns
    for (const col of this.columnsAtRisk) {
      if (!previousAtRisk.has(col)) {
        this.createColumnWarning(col)
      }
    }

    // Remove warnings for columns no longer at risk
    for (const col of previousAtRisk) {
      if (!this.columnsAtRisk.has(col)) {
        this.hideColumnWarning(col)
      }
    }

    return this.columnsAtRisk.size > 0
  }

  /**
   * Trigger game over - show game over overlay
   */
  private triggerGameOver(): void {
    // In background mode, restart the scene instead of showing game over
    if (this.isBackgroundMode) {
      this.scene.restart({ backgroundMode: true })
      return
    }

    // Store the final score before clearing state
    this.finalScore = this.blocksRemoved

    // Clear the global game state immediately
    const globalGameState = GlobalGameState.getInstance()
    globalGameState.clearGameState()

    // Pause the game
    this.isPaused = true

    // Stop LFG mode if active
    if (this.isLFGActive) {
      this.handleLFGUp()
    }

    // Stop game systems
    this.blockSpawner.stop()
    this.inputManager.setEnabled(false)
    this.physics.pause()

    // Stop grey block safety check
    if (this.greyBlockSafetyTimer) {
      this.greyBlockSafetyTimer.paused = true
    }

    // Stop all lose condition timers
    for (const timer of this.loseConditionTimers.values()) {
      timer.remove()
    }
    this.loseConditionTimers.clear()

    // Show game over overlay
    this.gameOverOverlay.setVisible(true)
    this.gameOverTitle.setVisible(true)
    this.tryAgainButton.setVisible(true)
    this.saveScoreButton.setVisible(true)

    // Hide pause button and LFG button
    this.pauseButton.setVisible(false)
    this.lfgButton.setVisible(false)
  }

  /**
   * Try again - return to title screen after game over
   */
  private tryAgain(): void {
    // Stop the current scene and go back to title
    this.scene.stop('LevelScene')
    this.scene.start('TitleScene')
  }

  /**
   * Save score and report game over to SDK
   */
  private async saveScore(): Promise<void> {
    if (!window.FarcadeSDK) {
      console.error('FarcadeSDK not available')
      return
    }

    try {
      // Call SDK gameOver with the final score (preserved before state was cleared)
      // Remix will show its own UI over the game
      await window.FarcadeSDK.singlePlayer.actions.gameOver({
        score: this.finalScore
      })

      console.log('Score saved successfully:', this.finalScore)
    } catch (error) {
      console.error('Failed to save score:', error)
    }
  }

  /**
   * Pause the game
   */
  private pauseGame(): void {
    this.isPaused = true

    // Stop LFG mode if active
    if (this.isLFGActive) {
      this.handleLFGUp()
    }

    // Stop game systems
    this.blockSpawner.stop()
    this.inputManager.setEnabled(false)
    this.physics.pause()

    // Stop grey block safety check
    if (this.greyBlockSafetyTimer) {
      this.greyBlockSafetyTimer.paused = true
    }

    // Pause all lose condition timers
    for (const timer of this.loseConditionTimers.values()) {
      timer.paused = true
    }

    // Show pause menu
    this.pauseOverlay.setVisible(true)
    this.saveButton.setVisible(true)
    this.abandonButton.setVisible(true)
    this.resumeButton.setVisible(true)
    this.pauseButton.setVisible(false)
    this.lfgButton.setVisible(false)
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

    // Resume grey block safety check
    if (this.greyBlockSafetyTimer) {
      this.greyBlockSafetyTimer.paused = false
    }

    // Resume all lose condition timers
    for (const timer of this.loseConditionTimers.values()) {
      timer.paused = false
    }

    // Hide pause menu
    this.pauseOverlay.setVisible(false)
    this.saveButton.setVisible(false)
    this.abandonButton.setVisible(false)
    this.resumeButton.setVisible(false)
    this.pauseButton.setVisible(true)
    this.lfgButton.setVisible(true)
  }

  /**
   * Abandon the current game and return to title screen
   */
  private abandonGame(): void {
    // Clear the global game state (this will save to SDK as a side effect)
    const globalGameState = GlobalGameState.getInstance()
    globalGameState.clearGameState()

    console.log('Game abandoned')

    // Transition to title screen
    this.scene.stop('LevelScene')
    this.scene.start('TitleScene')
  }

  /**
   * Handle LFG button press - start accelerated spawning
   */
  private handleLFGDown(): void {
    // Don't activate if game is paused or already active
    if (this.isPaused || this.isLFGActive) return

    // Don't activate if a dump is active
    if (this.blockSpawner.isDumpActive()) return

    console.log('LFG mode activated')
    this.isLFGActive = true
    this.lfgStartTime = this.time.now

    // Show blue overlay and ramp opacity from 0 to 0.6 over 3000ms (lags behind spawn rate)
    this.blueOverlay.setVisible(true).setAlpha(0)
    this.blueOverlay.setSize(GameSettings.canvas.width, ColumnManager.GRID_OFFSET_Y)
    this.blueOverlay.setFillStyle(0x6699ff, 1) // Medium-light blue
    this.lfgOverlayTween = this.tweens.add({
      targets: this.blueOverlay,
      alpha: 0.6,
      duration: 3000,
      ease: 'Quad.easeIn'
    })

    // Tween button color from dark blue to light blue over 3000ms
    this.lfgButtonColorValue = 0
    this.lfgButtonColorTween = this.tweens.add({
      targets: this,
      lfgButtonColorValue: 1,
      duration: 3000,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        // Interpolate color from 0x03ad86 (teal) to 0x33ddaa (light teal)
        const t = this.lfgButtonColorValue
        const r1 = 0x03, g1 = 0xad, b1 = 0x86
        const r2 = 0x33, g2 = 0xdd, b2 = 0xaa
        const r = Math.round(r1 + (r2 - r1) * t)
        const g = Math.round(g1 + (g2 - g1) * t)
        const b = Math.round(b1 + (b2 - b1) * t)
        const color = (r << 16) | (g << 8) | b

        // Calculate button dimensions
        const gridBottom = ColumnManager.GRID_OFFSET_Y + (ColumnManager.ROWS * ColumnManager.ROW_HEIGHT)
        const bottomSectionHeight = GameSettings.canvas.height - gridBottom
        const buttonHalfHeight = bottomSectionHeight / 2

        // Redraw button with new color
        this.lfgButtonBg.clear()
        this.lfgButtonBg.fillStyle(color, 0.8)
        this.lfgButtonBg.fillRect(-150, -buttonHalfHeight, 300, bottomSectionHeight)
      }
    })

    // Enable LFG mode in BlockSpawner
    this.blockSpawner.enableLFGMode()

    // Set haptic feedback callback
    this.blockSpawner.setHapticCallback(() => {
      if (window.FarcadeSDK) {
        if (this.isMultiplayer) {
          window.FarcadeSDK.multiplayer.actions.hapticFeedback()
        } else {
          window.FarcadeSDK.singlePlayer.actions.hapticFeedback()
        }
      }
    })
  }

  /**
   * Handle LFG button release - stop accelerated spawning
   */
  private handleLFGUp(): void {
    if (!this.isLFGActive) return

    console.log('LFG mode deactivated')
    this.isLFGActive = false

    // Stop overlay tween if active
    if (this.lfgOverlayTween) {
      this.lfgOverlayTween.stop()
      this.lfgOverlayTween = null
    }

    // Stop button color tween if active
    if (this.lfgButtonColorTween) {
      this.lfgButtonColorTween.stop()
      this.lfgButtonColorTween = null
    }

    // Fade out blue overlay quickly
    this.tweens.add({
      targets: this.blueOverlay,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
      onComplete: () => {
        this.blueOverlay.setVisible(false)
      }
    })

    // Calculate button dimensions
    const gridBottom = ColumnManager.GRID_OFFSET_Y + (ColumnManager.ROWS * ColumnManager.ROW_HEIGHT)
    const bottomSectionHeight = GameSettings.canvas.height - gridBottom
    const buttonHalfHeight = bottomSectionHeight / 2

    // Reset button to original color
    this.lfgButtonBg.clear()
    this.lfgButtonBg.fillStyle(0x03ad86, 0.8)
    this.lfgButtonBg.fillRect(-150, -buttonHalfHeight, 300, bottomSectionHeight)

    // Disable LFG mode in BlockSpawner (also resets spawn rate)
    this.blockSpawner.disableLFGMode()
  }

  /**
   * Save game using GlobalGameState
   */
  private async saveGame(): Promise<void> {
    try {
      const gameState = GameStateManager.serialize(
        this.columnManager,
        this.blocksRemoved,
        this.loseConditionTimers
      )

      // Update global state (this will save to SDK as a side effect)
      const globalGameState = GlobalGameState.getInstance()
      globalGameState.updateGameState(gameState)

      // Track that we have a saved game locally for game over screen
      this.hasSavedGame = true
      this.savedGameState = gameState

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
   * Accepts both old format (SaveState) and new format (GameState with currentLevel.boardState)
   */
  private loadGameState(data: any): void {
    // Extract SaveState from the data (handles both old and new formats)
    const saveState = GameStateManager.deserialize(data)
    if (!saveState) {
      console.error('Failed to deserialize game state')
      return
    }

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
      } else if (color === BlockColor.GREY && velocity === 0) {
        // Grey block at rest with no timer - start recovery timer immediately
        // This handles dump blocks and other grey blocks that were saved before their timer started
        block.greyRecoveryTimer = this.time.addEvent({
          delay: block.greyRecoveryDelay,
          callback: () => {
            this.blocksReadyToRecover.push(block)
            block.greyRecoveryTimer = null
          },
          callbackScope: this,
          loop: false
        })
      } else if (color === BlockColor.GREY && velocity !== 0) {
        // Grey block still moving - mark as moving so timer starts when it lands
        block.wasMovingLastFrame = true
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
          const group = new BlockGroup(groupBlocks, {
            maxDescentVelocity: this.columnManager.maxDescentVelocity,
            baseGravity: this.columnManager.baseGravity,
            massGravityFactor: this.columnManager.massGravityFactor,
          })
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

    // Restore lose condition timers
    if (saveState.lct) {
      for (const [colStr, remainingTime] of Object.entries(saveState.lct)) {
        const col = parseInt(colStr)
        if (remainingTime > 0) {
          // Recreate the timer with remaining time
          const timer = this.time.addEvent({
            delay: remainingTime,
            callback: () => {
              this.triggerGameOver()
            },
            callbackScope: this,
            loop: false,
          })
          this.loseConditionTimers.set(col, timer)

          // Add the column to at-risk set
          this.columnsAtRisk.add(col)

          // Recreate the column warning
          this.createColumnWarning(col)
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
    // Use ColorAssigner to prevent initial matches
    for (let col = 0; col < ColumnManager.COLUMNS; col++) {
      for (let row = ColumnManager.ROWS - 3; row < ColumnManager.ROWS; row++) {
        // Get colors that won't create a match at this position
        const safeColors = this.colorAssigner.getSafeColors(col, row)

        // Pick a random safe color, or fallback to any random color if none are safe
        const color = safeColors.length > 0
          ? safeColors[Math.floor(Math.random() * safeColors.length)]
          : Block.getRandomColor()

        const { y } = this.columnManager.gridToPixel(col, row)
        this.columnManager.addBlock(col, y, color)
      }
    }

    // Verify no matches exist (safety check)
    const initialMatches = this.matchDetector.detectMatches()
    if (initialMatches.length > 0) {
      console.warn(`Warning: ${initialMatches.length} blocks in initial matches detected!`)
    }
  }
}
