import GameSettings from '../config/GameSettings'
import { getLevelConfig, LevelId } from '../config/LevelMap'
import { GlobalGameState } from '../systems/GlobalGameState'

export class StoryScene extends Phaser.Scene {
  // Scroll state
  private scrollContainer: Phaser.GameObjects.Container | null = null
  private scrollY: number = 0
  private dragStartY: number = 0
  private dragStartScrollY: number = 0
  private isDragging: boolean = false
  private isPointerDown: boolean = false
  private pointerStartY: number = 0
  private readonly DRAG_THRESHOLD = 10 // pixels before treated as drag

  // Button hit areas for tap detection
  private levelButtons: Array<{
    container: Phaser.GameObjects.Container
    levelId: LevelId
    isUnlocked: boolean
  }> = []

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

    // Reset scroll state
    this.levelButtons = []
    this.scrollY = 0
    this.isDragging = false

    // Create scroll container to hold all level buttons
    // Buttons are positioned relative to this container (y=0 is first button center)
    this.scrollContainer = this.add.container(0, 0)

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
    const speedRushContainer = this.add.container(
      GameSettings.canvas.width / 2,
      buttonHeight / 2 + 100,
      speedRushContainerChildren
    )
    this.scrollContainer.add(speedRushContainer)
    this.levelButtons.push({
      container: speedRushContainer,
      levelId: 'speed-rush',
      isUnlocked: true
    })

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
    this.scrollContainer.add(heavyBlocksContainer)
    this.levelButtons.push({
      container: heavyBlocksContainer,
      levelId: 'heavy-blocks',
      isUnlocked: isHeavyBlocksUnlocked
    })

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
    this.scrollContainer.add(theBeltContainer)
    this.levelButtons.push({
      container: theBeltContainer,
      levelId: 'the-belt',
      isUnlocked: isTheBeltUnlocked
    })

    // Set up scroll input handlers
    this.input.on('pointerdown', this.handlePointerDown, this)
    this.input.on('pointermove', this.handlePointerMove, this)
    this.input.on('pointerup', this.handlePointerUp, this)

    // Create back button with circle background (rendered last to be on top, outside scroll container)
    const backButtonRadius = 25
    const backButtonX = 45
    const backButtonY = 45
    const backCircle = this.add.graphics()
      .fillStyle(0x000000, 1)
      .fillCircle(backButtonX, backButtonY, backButtonRadius)
      .lineStyle(2, 0xffffff, 1)
      .strokeCircle(backButtonX, backButtonY, backButtonRadius)
    const backChevron = this.add.text(backButtonX - 2, backButtonY - 4, '‹', {
      fontSize: '60px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    })
      .setOrigin(0.5, 0.5)
    // Create container for back button to handle input
    const backButtonContainer = this.add.container(0, 0, [backCircle, backChevron])
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(backButtonX, backButtonY, backButtonRadius),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
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

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.isPointerDown = true
    this.pointerStartY = pointer.y
    this.dragStartY = pointer.y
    this.dragStartScrollY = this.scrollY
    this.isDragging = false
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isPointerDown) return

    const dragDistance = Math.abs(pointer.y - this.pointerStartY)

    // Check if we've exceeded the drag threshold
    if (dragDistance > this.DRAG_THRESHOLD) {
      this.isDragging = true
    }

    if (this.isDragging && this.scrollContainer) {
      // Calculate new scroll position
      const deltaY = pointer.y - this.dragStartY
      this.scrollY = this.dragStartScrollY + deltaY

      // Calculate scroll bounds
      const buttonHeight = 300
      const buttonGap = 40
      const contentHeight = buttonHeight * 3 + buttonGap * 2 + 200 // 3 buttons + gaps + top padding
      const viewportHeight = GameSettings.canvas.height
      const maxScroll = 0
      const minScroll = Math.min(0, viewportHeight - contentHeight)

      // Clamp scroll position
      this.scrollY = Math.max(minScroll, Math.min(maxScroll, this.scrollY))

      // Apply scroll to container
      this.scrollContainer.y = this.scrollY
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    // If not dragging (just a tap), check if a button was tapped
    if (!this.isDragging) {
      const buttonWidth = 680
      const buttonHeight = 300

      for (const button of this.levelButtons) {
        if (!button.isUnlocked) continue

        // Get button's world position (container position + scroll offset)
        const buttonWorldY = button.container.y + this.scrollY
        const buttonWorldX = button.container.x

        // Check if tap is within button bounds
        const halfWidth = buttonWidth / 2
        const halfHeight = buttonHeight / 2

        if (
          pointer.x >= buttonWorldX - halfWidth &&
          pointer.x <= buttonWorldX + halfWidth &&
          pointer.y >= buttonWorldY - halfHeight &&
          pointer.y <= buttonWorldY + halfHeight
        ) {
          this.startLevel(button.levelId)
          return
        }
      }
    }

    // Reset drag state
    this.isPointerDown = false
    this.isDragging = false
  }
}
