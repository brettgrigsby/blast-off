import type { FarcadeSDK } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { GlobalGameState } from '../systems/GlobalGameState'

declare global {
  interface Window {
    FarcadeSDK: FarcadeSDK
  }
}

export class TitleScene extends Phaser.Scene {
  private loadingText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'TitleScene' })
  }

  preload(): void {
    // Create loading text
    this.loadingText = this.add
      .text(
        GameSettings.canvas.width / 2,
        GameSettings.canvas.height / 2,
        'Loading... 0%',
        {
          fontSize: '36px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0.5)

    // Update loading text as assets load
    this.load.on('progress', (progress: number) => {
      const percentage = Math.floor(progress * 100)
      this.loadingText.setText(`Loading... ${percentage}%`)
    })

    // Load flame sprite sheet
    // The sprite sheet is 60px wide x 20px tall, with 6 frames of 10x20 each
    this.load.spritesheet(
      'flame',
      'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/burning_loop_4-QL08GwOBzclITwWLDdZNG1G3QY8ZAb.webp?DW7A',
      {
        frameWidth: 10,
        frameHeight: 20,
      }
    )

    // Load title image
    this.load.image(
      'titleText',
      'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/blockboostertitletext-pirM0pmhyj9JEPH99vKYw2AVv5hHxZ.webp?mhq6'
    )

    // Load falling block image for LFG button
    this.load.image(
      'fallingBlock',
      'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/tiny-falling-block-peUZaAcFjnJrP8Wd8hIyJBAPKZR7im.webp?J6O4'
    )
  }

  async create(): Promise<void> {
    // Initialize GlobalGameState from SDK
    await this.initializeGlobalGameState()

    // Remove loading text
    this.loadingText.destroy()

    // Check if there's a saved game
    const globalGameState = GlobalGameState.getInstance()
    if (globalGameState.hasSavedGame()) {
      this.scene.start('LevelScene')
      return
    }

    // Otherwise, show the title screen
    this.showTitleScreen()
  }

  /**
   * Initialize the GlobalGameState singleton from SDK's initialGameState
   * This should only be called once when the app starts
   */
  private async initializeGlobalGameState(): Promise<void> {
    // Check if already initialized - if so, skip SDK fetch and use existing state
    if (GlobalGameState.hasBeenInitialized()) {
      console.log('GlobalGameState already initialized, skipping SDK fetch')
      return
    }

    const globalGameState = GlobalGameState.getInstance()

    if (!window.FarcadeSDK) {
      globalGameState.initialize(null)
      return
    }

    try {
      const gameInfo = await window.FarcadeSDK.singlePlayer.actions.ready()
      const gameState = gameInfo?.initialGameState?.gameState || null
      globalGameState.initialize(gameState)
    } catch (error) {
      console.error('Failed to initialize game state from SDK:', error)
      globalGameState.initialize(null)
    }
  }

  private showTitleScreen(): void {
    // Launch LevelScene in background mode
    this.scene.launch('LevelScene', { backgroundMode: true })

    // Bring TitleScene to top to ensure buttons receive input
    this.scene.bringToTop()

    // Create title image
    const titleImage = this.add
      .image(
        GameSettings.canvas.width / 2,
        250,
        'titleText'
      )
      .setOrigin(0.5)
      .setScale(0.7)

    // Create PLAY button
    const playButtonBg = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(-200, -50, 400, 100, 15)
      .lineStyle(3, 0xffffff, 1)
      .strokeRoundedRect(-200, -50, 400, 100, 15)
    const playButtonText = this.add.text(0, 0, 'PLAY', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    const playButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2,
      [playButtonBg, playButtonText]
    )
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-200, -50, 400, 100),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.startGame())

    // Create STORY MODE button
    const storyButtonBg = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(-200, -50, 400, 100, 15)
      .lineStyle(3, 0xffffff, 1)
      .strokeRoundedRect(-200, -50, 400, 100, 15)
    const storyButtonText = this.add.text(0, 0, 'STORY MODE', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    const storyButton = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 + 150,
      [storyButtonBg, storyButtonText]
    )
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-200, -50, 400, 100),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.startStoryMode())
  }

  private startGame(): void {
    // Stop the background LevelScene instance
    this.scene.stop('LevelScene')

    // Start a fresh LevelScene for actual gameplay
    // Must pass empty object to override previous backgroundMode data
    this.scene.start('LevelScene', {})
  }

  private startStoryMode(): void {
    // TODO: Implement story mode
    console.log('Story mode not yet implemented')
  }
}
