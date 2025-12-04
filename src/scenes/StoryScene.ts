import GameSettings from '../config/GameSettings'
import { getLevelConfig, LevelId } from '../config/LevelMap'

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
      'ACCELIX',
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
    this.add.container(
      GameSettings.canvas.width / 2,
      buttonHeight / 2 + 100,
      [speedRushImage, speedRushBorder, speedRushText]
    )
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.startLevel('speed-rush'))

    // Create HEAVY BLOCKS button
    const heavyBlocksImage = this.add.image(0, 0, 'heavyBlocksBg')
      .setDisplaySize(buttonWidth, buttonHeight)
    const heavyBlocksBorder = this.add.graphics()
      .lineStyle(3, 0xffffff, 1)
      .strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15)
    const heavyBlocksText = this.add.text(
      buttonWidth / 2 - 20,
      -buttonHeight / 2 + 20,
      'CHUNGOR',
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
    ).setOrigin(1, 0)
    this.add.container(
      GameSettings.canvas.width / 2,
      buttonHeight / 2 + 100 + buttonHeight + buttonGap,
      [heavyBlocksImage, heavyBlocksBorder, heavyBlocksText]
    )
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.startLevel('heavy-blocks'))

    // Create back chevron (rendered last to be on top)
    this.add.text(20, 5, '‹', {
      fontSize: '80px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
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
