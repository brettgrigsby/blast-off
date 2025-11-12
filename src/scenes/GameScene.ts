import type { FarcadeSDK, GameInfo } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { GridManager } from '../systems/GridManager'
import { Block } from '../objects/Block'
import { BlockSpawner } from '../systems/BlockSpawner'

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

    // Update falling blocks
    const fallingBlocks = this.gridManager.getFallingBlocks()
    for (const block of fallingBlocks) {
      // Update block position based on velocity
      block.update(delta)

      // Check for collision
      const collision = this.gridManager.checkCollision(block)
      if (collision.collided) {
        // Place the block in the grid
        this.gridManager.placeFallingBlock(block)
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

    // Populate grid with random colored blocks for testing (Iteration 1)
    // Comment this out for Iteration 2 to see spawning
    // this.populateTestGrid()

    // Initialize and start block spawner (Iteration 2)
    this.blockSpawner = new BlockSpawner(this, this.gridManager)
    this.blockSpawner.start()

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
