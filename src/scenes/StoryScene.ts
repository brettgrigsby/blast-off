import GameSettings from '../config/GameSettings'
import { getLevelConfig, LevelId } from '../config/LevelMap'
import { GlobalGameState } from '../systems/GlobalGameState'

export class StoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StoryScene' })
  }

  preload(): void {
    this.load.image(
      'speedRushBg',
      'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/venus-zNwcaV2v2XT2eVu0mTrypEriEWWVab.webp?hbdx'
    )
    this.load.image(
      'heavyBlocksBg',
      'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/jupiter-fUQVcpNrp8mYY5q0LSeA90hHqJDMll.webp?KhFK'
    )
    this.load.image(
      'theBeltBg',
      'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/the-belt-OSbKtxSOBTeRn8WPZvn5puJue962Gg.webp?wd1w'
    )
  }

  create(): void {
    const buttonWidth = 680
    const buttonHeight = 300
    const buttonGap = 40

    // Create ACCELIX button
    const speedRushImage = this.add.image(0, 0, 'speedRushBg')
      .setDisplaySize(buttonWidth, buttonHeight)
    const speedRushBorder = this.add.graphics()
      .lineStyle(3, 0xffffff, 1)
      .strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15)
    const speedRushText = this.add.text(
      -buttonWidth / 2 + 20,
      -buttonHeight / 2 + 20,
      "Grumby's\nComet",
      {
        fontSize: '48px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          fill: true,
        },
      }
    ).setOrigin(0, 0)
    const speedRushHighScore = GlobalGameState.getInstance().getHighScore('speed-rush')
    const speedRushContainerChildren: Phaser.GameObjects.GameObject[] = [speedRushImage, speedRushBorder, speedRushText]
    if (speedRushHighScore > 0) {
      const speedRushHighScoreText = this.add.text(
        -buttonWidth / 2 + 20,
        buttonHeight / 2 - 20,
        `Best: ${speedRushHighScore}`,
        {
          fontSize: '32px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: '#000000',
            blur: 4,
            fill: true,
          },
        }
      ).setOrigin(0, 1)
      speedRushContainerChildren.push(speedRushHighScoreText)
    }
    this.add.container(
      GameSettings.canvas.width / 2,
      buttonHeight / 2 + 100,
      speedRushContainerChildren
    )
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.startLevel('speed-rush'))

    // Create HEAVY BLOCKS button
    const isHeavyBlocksUnlocked = speedRushHighScore > 0
    const heavyBlocksImage = this.add.image(0, 0, 'heavyBlocksBg')
      .setDisplaySize(buttonWidth, buttonHeight)
    if (!isHeavyBlocksUnlocked) {
      heavyBlocksImage.setTint(0x666666)
    }
    const heavyBlocksBorder = this.add.graphics()
      .lineStyle(3, isHeavyBlocksUnlocked ? 0xffffff : 0x666666, 1)
      .strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15)
    const heavyBlocksText = this.add.text(
      buttonWidth / 2 - 20,
      -buttonHeight / 2 + 20,
      'CHUNGOR',
      {
        fontSize: '48px',
        color: isHeavyBlocksUnlocked ? '#ffffff' : '#666666',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          fill: true,
        },
      }
    ).setOrigin(1, 0)
    const heavyBlocksHighScore = GlobalGameState.getInstance().getHighScore('heavy-blocks')
    const heavyBlocksContainerChildren: Phaser.GameObjects.GameObject[] = [heavyBlocksImage, heavyBlocksBorder, heavyBlocksText]
    if (heavyBlocksHighScore > 0) {
      const heavyBlocksHighScoreText = this.add.text(
        buttonWidth / 2 - 20,
        buttonHeight / 2 - 20,
        `Best: ${heavyBlocksHighScore}`,
        {
          fontSize: '32px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: '#000000',
            blur: 4,
            fill: true,
          },
        }
      ).setOrigin(1, 1)
      heavyBlocksContainerChildren.push(heavyBlocksHighScoreText)
    }
    const heavyBlocksContainer = this.add.container(
      GameSettings.canvas.width / 2,
      buttonHeight / 2 + 100 + buttonHeight + buttonGap,
      heavyBlocksContainerChildren
    )
    if (isHeavyBlocksUnlocked) {
      heavyBlocksContainer
        .setInteractive({
          hitArea: new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        })
        .on('pointerdown', () => this.startLevel('heavy-blocks'))
    }

    // Create THE BELT button
    const isTheBeltUnlocked = heavyBlocksHighScore > 0
    const theBeltImage = this.add.image(0, 0, 'theBeltBg')
      .setDisplaySize(buttonWidth, buttonHeight)
    if (!isTheBeltUnlocked) {
      theBeltImage.setTint(0x666666)
    }
    const theBeltBorder = this.add.graphics()
      .lineStyle(3, isTheBeltUnlocked ? 0xffffff : 0x666666, 1)
      .strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15)
    const theBeltText = this.add.text(
      -buttonWidth / 2 + 20,
      -buttonHeight / 2 + 20,
      'THE BELT',
      {
        fontSize: '48px',
        color: isTheBeltUnlocked ? '#ffffff' : '#666666',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          fill: true,
        },
      }
    ).setOrigin(0, 0)
    const theBeltHighScore = GlobalGameState.getInstance().getHighScore('the-belt')
    const theBeltContainerChildren: Phaser.GameObjects.GameObject[] = [theBeltImage, theBeltBorder, theBeltText]
    if (theBeltHighScore > 0) {
      const theBeltHighScoreText = this.add.text(
        -buttonWidth / 2 + 20,
        buttonHeight / 2 - 20,
        `Best: ${theBeltHighScore}`,
        {
          fontSize: '32px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: '#000000',
            blur: 4,
            fill: true,
          },
        }
      ).setOrigin(0, 1)
      theBeltContainerChildren.push(theBeltHighScoreText)
    }
    const theBeltContainer = this.add.container(
      GameSettings.canvas.width / 2,
      buttonHeight / 2 + 100 + (buttonHeight + buttonGap) * 2,
      theBeltContainerChildren
    )
    if (isTheBeltUnlocked) {
      theBeltContainer
        .setInteractive({
          hitArea: new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        })
        .on('pointerdown', () => this.startLevel('the-belt'))
    }

    // Create back chevron (rendered last to be on top)
    const backChevron = this.add.text(20, 5, '‹', {
      fontSize: '80px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    })
      .setOrigin(0, 0)
    // Make hit area 200% wider than the visual text
    const chevronBounds = backChevron.getBounds()
    backChevron
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, chevronBounds.width * 3, chevronBounds.height),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      })
      .on('pointerdown', () => this.scene.start('TitleScene'))
  }

  private startLevel(levelId: LevelId): void {
    const levelConfig = getLevelConfig(levelId)
    this.scene.start('LevelScene', {
      levelConfig,
      levelId
    })
  }
}
