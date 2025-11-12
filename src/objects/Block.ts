import Phaser from 'phaser';

export enum BlockColor {
  RED = 0xd17878,
  YELLOW = 0xe6d49a,
  BLUE = 0x7da3d9,
  GREEN = 0x8fd98f,
  PURPLE = 0xb08fd9,
  GREY = 0x808080,
}

export const PLAYABLE_COLORS = [
  BlockColor.RED,
  BlockColor.YELLOW,
  BlockColor.BLUE,
  BlockColor.GREEN,
  BlockColor.PURPLE,
];

export class Block {
  public column: number;
  public row: number;
  public x: number;
  public y: number;
  public color: BlockColor;
  public graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  // Movement properties
  public velocityX: number = 0;
  public velocityY: number = 0;
  public isInGrid: boolean = false; // True when block is in the grid array, false otherwise

  // Visual state
  public selected: boolean = false; // True when block is selected by player

  // Physics constants
  public static readonly GRAVITY = 2000; // pixels/second² - downward acceleration

  // Visual constants
  private static readonly BLOCK_WIDTH = 80;
  private static readonly BLOCK_HEIGHT = 80;
  private static readonly BORDER_WIDTH = 3;
  private static readonly BORDER_COLOR = 0x000000;

  constructor(
    scene: Phaser.Scene,
    column: number,
    row: number,
    x: number,
    y: number,
    color: BlockColor
  ) {
    this.scene = scene;
    this.column = column;
    this.row = row;
    this.x = x;
    this.y = y;
    this.color = color;

    // Create graphics object for visual representation
    this.graphics = scene.add.graphics();
    this.draw();
  }

  /**
   * Draw the block with border and optional selection highlight
   */
  private draw(): void {
    this.graphics.clear();

    // Draw selection highlight if selected
    if (this.selected) {
      // Draw outer glow
      this.graphics.lineStyle(2, 0xffffff, 0.5);
      this.graphics.strokeRect(
        this.x - Block.BLOCK_WIDTH / 2 - 2,
        this.y - Block.BLOCK_HEIGHT / 2 - 2,
        Block.BLOCK_WIDTH + 4,
        Block.BLOCK_HEIGHT + 4
      );

      // Draw main selection border
      this.graphics.lineStyle(4, 0xffffff, 1);
      this.graphics.strokeRect(
        this.x - Block.BLOCK_WIDTH / 2,
        this.y - Block.BLOCK_HEIGHT / 2,
        Block.BLOCK_WIDTH,
        Block.BLOCK_HEIGHT
      );
    }

    // Draw border
    this.graphics.fillStyle(Block.BORDER_COLOR, 1);
    this.graphics.fillRect(
      this.x - Block.BLOCK_WIDTH / 2,
      this.y - Block.BLOCK_HEIGHT / 2,
      Block.BLOCK_WIDTH,
      Block.BLOCK_HEIGHT
    );

    // Draw main colored block
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillRect(
      this.x - Block.BLOCK_WIDTH / 2 + Block.BORDER_WIDTH,
      this.y - Block.BLOCK_HEIGHT / 2 + Block.BORDER_WIDTH,
      Block.BLOCK_WIDTH - Block.BORDER_WIDTH * 2,
      Block.BLOCK_HEIGHT - Block.BORDER_WIDTH * 2
    );
  }

  /**
   * Update the block's position and redraw
   */
  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.draw();
  }

  /**
   * Update the block's grid position
   */
  public setGridPosition(column: number, row: number): void {
    this.column = column;
    this.row = row;
  }

  /**
   * Change the block's color (e.g., when matched, turn grey)
   */
  public setColor(color: BlockColor): void {
    this.color = color;
    this.draw();
  }

  /**
   * Set the block's selected state and redraw
   */
  public setSelected(selected: boolean): void {
    this.selected = selected;

    // Set depth to render selected block above all others
    if (selected) {
      this.graphics.setDepth(100); // Above normal blocks (default depth is 0)
    } else {
      this.graphics.setDepth(0); // Reset to normal depth
    }

    this.draw();
  }

  /**
   * Check if this block is grey (matched/consumed)
   */
  public isGrey(): boolean {
    return this.color === BlockColor.GREY;
  }

  /**
   * Set the block's velocity
   */
  public setVelocity(velocityX: number, velocityY: number): void {
    this.velocityX = velocityX;
    this.velocityY = velocityY;
  }

  /**
   * Update the block's position based on velocity and apply gravity (called each frame)
   * @param delta Time elapsed since last frame in milliseconds
   */
  public update(delta: number): void {
    // Convert delta from milliseconds to seconds
    const deltaSeconds = delta / 1000;

    // Apply gravity to all moving blocks (accelerate downward)
    if (this.velocityX !== 0 || this.velocityY !== 0) {
      this.velocityY += Block.GRAVITY * deltaSeconds;
    } else {
      return; // Block is at rest, no need to update
    }

    // Update position based on velocity
    this.x += this.velocityX * deltaSeconds;
    this.y += this.velocityY * deltaSeconds;

    // Redraw at new position
    this.draw();
  }

  /**
   * Launch this block upward with velocity based on match size
   * @param matchSize Number of blocks in the match (3, 4, 5+)
   */
  public launch(matchSize: number): void {
    // Calculate launch velocity based on match size (4x stronger than original)
    let launchVelocity: number;
    if (matchSize === 3) {
      launchVelocity = -1600; // Negative = upward
    } else if (matchSize === 4) {
      launchVelocity = -2400;
    } else {
      launchVelocity = -3200; // 5 or more
    }

    this.setVelocity(0, launchVelocity);
    this.isInGrid = false; // No longer in grid when launching
  }

  /**
   * Check if this block is above the screen top boundary
   */
  public isAboveScreen(): boolean {
    // Block is above screen if it's well past the top (with buffer to keep visible longer)
    return this.y < -50;
  }

  /**
   * Get a random playable color (not grey)
   */
  public static getRandomColor(): BlockColor {
    const randomIndex = Math.floor(Math.random() * PLAYABLE_COLORS.length);
    return PLAYABLE_COLORS[randomIndex];
  }

  /**
   * Destroy the block and clean up graphics
   */
  public destroy(): void {
    // Clear graphics before destroying to prevent ghost images
    this.graphics.clear();
    this.graphics.destroy();
  }
}
