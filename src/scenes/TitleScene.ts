import type { FarcadeSDK } from '@farcade/game-sdk'
import GameSettings from '../config/GameSettings'
import { GlobalGameState } from '../systems/GlobalGameState'
import { getLevelConfig } from '../config/LevelMap'
import { SoundManager } from '../systems/SoundManager'

declare global {
  interface Window {
    FarcadeSDK: FarcadeSDK
  }
}

export class TitleScene extends Phaser.Scene {
  private loadingText!: Phaser.GameObjects.Text
  private storyModeEnabled: boolean = false
  private storyButton!: Phaser.GameObjects.Container
  private storyUnlockText!: Phaser.GameObjects.Text

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

    // Load match sounds using SoundManager
    const soundManager = new SoundManager(this)
    soundManager.loadAudio()
  }

  async create(): Promise<void> {
    // Initialize GlobalGameState from SDK
    await this.initializeGlobalGameState()

    // Remove loading text
    this.loadingText.destroy()

    // Check if there's a saved game
    const globalGameState = GlobalGameState.getInstance()
    if (globalGameState.hasSavedGame()) {
      const gameState = globalGameState.getGameState()
      const levelId = gameState?.currentLevel?.levelId || 'quick-play'
      const levelConfig = getLevelConfig(levelId as any)

      this.scene.start('LevelScene', {
        levelConfig,
        levelId
      })
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

    // Check if story mode is unlocked
    this.storyModeEnabled = window.FarcadeSDK?.hasItem?.('story-mode') ?? true

    // Create STORY MODE button (styled based on enabled state)
    const storyButtonColor = this.storyModeEnabled ? 0xffffff : 0x666666
    const storyButtonTextColor = this.storyModeEnabled ? '#ffffff' : '#666666'
    const storyButtonBg = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(-200, -50, 400, 100, 15)
      .lineStyle(3, storyButtonColor, 1)
      .strokeRoundedRect(-200, -50, 400, 100, 15)
    const storyButtonText = this.add.text(0, 0, 'STORY MODE', {
      fontSize: '48px',
      color: storyButtonTextColor,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.storyButton = this.add.container(
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

    // "Unlock 100 Credits" text below Story Mode button (with background)
    const unlockTextBg = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(-120, -18, 240, 36, 8)
    this.storyUnlockText = this.add.text(0, 0, 'Unlock 100 Credits', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
    }).setOrigin(0.5)
    const unlockTextContainer = this.add.container(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height / 2 + 220,
      [unlockTextBg, this.storyUnlockText]
    ).setVisible(!this.storyModeEnabled)

    // Store reference for visibility toggling
    this.storyUnlockText = unlockTextContainer as any

    // Listen for purchase completion
    if (window.FarcadeSDK) {
      window.FarcadeSDK.on('purchase_complete', () => {
        const hasItem = window.FarcadeSDK.hasItem
        this.storyModeEnabled = hasItem?.('story-mode') ?? false

        if (this.storyModeEnabled) {
          // Update button to enabled state
          const buttonBg = this.storyButton.getAt(0) as Phaser.GameObjects.Graphics
          buttonBg.clear()
          buttonBg.fillStyle(0x000000, 0.85)
          buttonBg.fillRoundedRect(-200, -50, 400, 100, 15)
          buttonBg.lineStyle(3, 0xffffff, 1)
          buttonBg.strokeRoundedRect(-200, -50, 400, 100, 15)
          const buttonText = this.storyButton.getAt(1) as Phaser.GameObjects.Text
          buttonText.setColor('#ffffff')
          this.storyUnlockText.setVisible(false)
        }
      })
    }
  }

  private startGame(): void {
    // Stop the background LevelScene instance
    this.scene.stop('LevelScene')

    // Get the quick-play level configuration
    const levelConfig = getLevelConfig('quick-play')

    // Start a fresh LevelScene for actual gameplay
    this.scene.start('LevelScene', {
      levelConfig,
      levelId: 'quick-play'
    })
  }

  private async startStoryMode(): Promise<void> {
    if (!this.storyModeEnabled) {
      if (window.FarcadeSDK) {
        await window.FarcadeSDK.purchase({ item: 'story-mode' })
        if (window.FarcadeSDK.hasItem?.('story-mode')) {
          this.storyModeEnabled = true
          // Update button to enabled state
          const buttonBg = this.storyButton.getAt(0) as Phaser.GameObjects.Graphics
          buttonBg.clear()
          buttonBg.fillStyle(0x000000, 0.85)
          buttonBg.fillRoundedRect(-200, -50, 400, 100, 15)
          buttonBg.lineStyle(3, 0xffffff, 1)
          buttonBg.strokeRoundedRect(-200, -50, 400, 100, 15)
          const buttonText = this.storyButton.getAt(1) as Phaser.GameObjects.Text
          buttonText.setColor('#ffffff')
          this.storyUnlockText.setVisible(false)
        }
      }
      return
    }

    this.scene.stop('LevelScene')
    this.scene.start('StoryScene')
  }
}
