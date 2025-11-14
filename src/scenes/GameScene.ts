import type { FarcadeSDK, GameInfo } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { ColumnManager } from '../systems/ColumnManager'
import { Block } from '../objects/Block'
import { BlockSpawner } from '../systems/BlockSpawner'
import { InputManager } from '../systems/InputManager'
import { MatchDetector } from '../systems/MatchDetector'
import { ColorAssigner } from '../systems/ColorAssigner'

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
        await window.FarcadeSDK.singlePlayer.actions.ready()
      } catch (error) {
        console.error('Failed to initialize single player SDK:', error)
      }
      this.createGameElements()
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
