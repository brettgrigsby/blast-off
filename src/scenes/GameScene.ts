import type { FarcadeSDK, GameInfo } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { GridManager } from '../systems/GridManager'
import { Block } from '../objects/Block'
import { BlockSpawner } from '../systems/BlockSpawner'
import { InputManager } from '../systems/InputManager'
import { MatchDetector } from '../systems/MatchDetector'

declare global {
  interface Window {
    FarcadeSDK: FarcadeSDK
  }
}

export class GameScene extends Phaser.Scene {
  private isMultiplayer: boolean = false
  private gridManager!: GridManager
  private gridLinesGraphics!: Phaser.GameObjects.Graphics
  private blockSpawner!: BlockSpawner
  private inputManager!: InputManager
  private matchDetector!: MatchDetector

  // Score tracking (Iteration 5)
  private blocksRemoved: number = 0
  private scoreText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'GameScene' })
  }

  preload(): void {
    // Load assets here
  }

  create(): void {
    this.initializeSDK()
  }

  update(_time: number, delta: number): void {
    if (!this.gridManager) return

    // Unified physics update: process all moving blocks the same way
    const movingBlocks = this.gridManager.getMovingBlocks()
    const blocksToRemove: Block[] = []
    let blocksPlaced = false

    for (const block of movingBlocks) {
      // Check if block is above screen and should be removed
      // Do this BEFORE updating to avoid drawing ghost graphics
      if (block.isAboveScreen()) {
        blocksToRemove.push(block)
        continue // Skip update for blocks that will be removed
      }

      // Update block position (applies gravity and velocity)
      block.update(delta)

      // Check for collision (only for blocks moving downward)
      const collision = this.gridManager.checkCollision(block)
      if (collision.collided) {
        // Place the block in the grid at rest position
        this.gridManager.placeBlock(block, collision.restColumn, collision.restRow)
        blocksPlaced = true
      }
    }

    // Remove blocks that went above screen
    for (const block of blocksToRemove) {
      this.gridManager.removeBlock(block)
      this.blocksRemoved++
    }

    // Update score display if blocks were removed
    if (blocksToRemove.length > 0) {
      this.updateScoreDisplay()
    }

    // Check for matches after blocks are placed
    // Matches can trigger at any time per spec
    if (blocksPlaced && this.matchDetector) {
      this.matchDetector.checkAndProcessMatches()
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
    // Initialize grid system
    this.gridManager = new GridManager(this)

    // Create graphics for grid lines (debug visualization)
    this.gridLinesGraphics = this.add.graphics()
    this.gridManager.drawGridLines(this.gridLinesGraphics)

    // Initialize match detector (Iteration 4)
    this.matchDetector = new MatchDetector(this.gridManager)

    // Populate grid with random colored blocks for testing (Iteration 1)
    // Comment this out for Iteration 2 to see spawning
    // this.populateTestGrid()

    // Initialize and start block spawner (Iteration 2)
    this.blockSpawner = new BlockSpawner(this, this.gridManager)
    this.blockSpawner.start()

    // Initialize input manager (Iteration 3)
    // Pass callback to check for matches after swaps (Iteration 4)
    this.inputManager = new InputManager(this, this.gridManager, () => {
      this.matchDetector.checkAndProcessMatches()
    })

    // Add game title
    this.add
      .text(
        GameSettings.canvas.width / 2,
        30,
        'Blast Off',
        {
          fontSize: '48px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0.5)
      .setDepth(1000) // Keep text above blocks

    // Add score counter (Iteration 5)
    this.scoreText = this.add
      .text(
        GameSettings.canvas.width / 2,
        1020,
        'Blocks Removed: 0',
        {
          fontSize: '32px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0.5)
      .setDepth(1000) // Keep text above blocks
  }

  /**
   * Update the score display (Iteration 5)
   */
  private updateScoreDisplay(): void {
    if (this.scoreText) {
      this.scoreText.setText(`Blocks Removed: ${this.blocksRemoved}`)
    }
  }

  /**
   * Populate grid with random colored blocks for testing (Iteration 1)
   */
  private populateTestGrid(): void {
    // Fill bottom half of grid with random blocks (rows 6-11)
    for (let row = 6; row < GridManager.ROWS; row++) {
      for (let col = 0; col < GridManager.COLUMNS; col++) {
        const color = Block.getRandomColor()
        this.gridManager.addBlock(col, row, color)
      }
    }
  }
}
