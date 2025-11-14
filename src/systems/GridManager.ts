import Phaser from 'phaser';
import { Block, BlockColor } from '../objects/Block';
import { BlockGroup } from '../objects/BlockGroup';

export class GridManager {
  private scene: Phaser.Scene;

  // Grid dimensions
  public static readonly COLUMNS = 9;
  public static readonly ROWS = 12;
  public static readonly COLUMN_WIDTH = 80; // 720px / 9 columns
  public static readonly ROW_HEIGHT = 80; // Square cells to match blocks

  // Grid positioning - position the 9×12 board (720×960) on the 720×1080 canvas
  public static readonly GRID_OFFSET_X = 0;
  public static readonly GRID_OFFSET_Y = 30; // 30px top margin, 90px bottom margin

  // Grid storage: [column][row] -> Block
  private grid: (Block | null)[][];

  // All blocks in the game (for easy iteration)
  private blocks: Block[];

  // Active block groups (Iteration 6)
  private groups: BlockGroup[];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.blocks = [];
    this.groups = [];

    // Initialize empty grid
    this.grid = [];
    for (let col = 0; col < GridManager.COLUMNS; col++) {
      this.grid[col] = [];
      for (let row = 0; row < GridManager.ROWS; row++) {
        this.grid[col][row] = null;
      }
    }
  }

  /**
   * Convert grid coordinates to pixel coordinates (center of cell)
   */
  public gridToPixel(column: number, row: number): { x: number; y: number } {
    return {
      x: GridManager.GRID_OFFSET_X + column * GridManager.COLUMN_WIDTH + GridManager.COLUMN_WIDTH / 2,
      y: GridManager.GRID_OFFSET_Y + row * GridManager.ROW_HEIGHT + GridManager.ROW_HEIGHT / 2,
    };
  }

  /**
   * Convert pixel coordinates to grid coordinates
   */
  public pixelToGrid(x: number, y: number): { column: number; row: number } {
    return {
      column: Math.floor((x - GridManager.GRID_OFFSET_X) / GridManager.COLUMN_WIDTH),
      row: Math.floor((y - GridManager.GRID_OFFSET_Y) / GridManager.ROW_HEIGHT),
    };
  }

  /**
   * Check if grid coordinates are within bounds
   */
  public isInBounds(column: number, row: number): boolean {
    return (
      column >= 0 &&
      column < GridManager.COLUMNS &&
      row >= 0 &&
      row < GridManager.ROWS
    );
  }

  /**
   * Get block at specific grid position
   */
  public getBlock(column: number, row: number): Block | null {
    if (!this.isInBounds(column, row)) {
      return null;
    }
    return this.grid[column][row];
  }

  /**
   * Set block at specific grid position
   */
  public setBlock(column: number, row: number, block: Block | null): void {
    if (!this.isInBounds(column, row)) {
      return;
    }
    this.grid[column][row] = block;
  }

  /**
   * Add a new block to the grid at a specific position
   * If row is negative (above grid), block starts falling
   */
  public addBlock(column: number, row: number, color: BlockColor, velocity: number = 0): Block {
    const { x, y } = this.gridToPixel(column, row);
    const block = new Block(this.scene, column, row, x, y, color);

    // Set initial velocity (e.g., for falling blocks)
    block.setVelocity(velocity);

    // Only add to grid if in bounds, otherwise block is in motion
    if (this.isInBounds(column, row)) {
      this.grid[column][row] = block;
      block.isInGrid = true;
    } else {
      block.isInGrid = false;
    }

    this.blocks.push(block);

    return block;
  }

  /**
   * Remove a block from the grid
   */
  public removeBlock(block: Block): void {
    // Remove from grid
    if (this.isInBounds(block.column, block.row)) {
      this.grid[block.column][block.row] = null;
    }

    // Remove from blocks array
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
    }

    // Destroy the block
    block.destroy();
  }

  /**
   * Get all blocks in a specific column
   */
  public getColumn(column: number): (Block | null)[] {
    if (column < 0 || column >= GridManager.COLUMNS) {
      return [];
    }
    return this.grid[column].slice();
  }

  /**
   * Get all blocks in a specific row
   */
  public getRow(row: number): (Block | null)[] {
    if (row < 0 || row >= GridManager.ROWS) {
      return [];
    }

    const rowBlocks: (Block | null)[] = [];
    for (let col = 0; col < GridManager.COLUMNS; col++) {
      rowBlocks.push(this.grid[col][row]);
    }
    return rowBlocks;
  }

  /**
   * Get all blocks in the game
   */
  public getAllBlocks(): Block[] {
    return this.blocks.slice();
  }

  /**
   * Clear all blocks from the grid
   */
  public clear(): void {
    // Destroy all blocks
    this.blocks.forEach(block => block.destroy());
    this.blocks = [];
    this.groups = [];

    // Clear grid
    for (let col = 0; col < GridManager.COLUMNS; col++) {
      for (let row = 0; row < GridManager.ROWS; row++) {
        this.grid[col][row] = null;
      }
    }
  }

  /**
   * Get all blocks that are currently moving (have velocity)
   */
  public getMovingBlocks(): Block[] {
    return this.blocks.filter(block => block.velocityY !== 0);
  }

  /**
   * Get all active block groups
   */
  public getGroups(): BlockGroup[] {
    return this.groups.slice();
  }

  /**
   * Add a new block group
   */
  public addGroup(group: BlockGroup): void {
    this.groups.push(group);
  }

  /**
   * Remove a block group
   */
  public removeGroup(group: BlockGroup): void {
    const index = this.groups.indexOf(group);
    if (index > -1) {
      this.groups.splice(index, 1);
    }
  }

  /**
   * Find which group a block belongs to (if any)
   */
  public getBlockGroup(block: Block): BlockGroup | null {
    for (const group of this.groups) {
      if (group.hasBlock(block)) {
        return group;
      }
    }
    return null;
  }

  /**
   * Check if a moving block collides with the bottom or another block
   * Works for both downward and upward-then-falling blocks
   */
  public checkCollision(block: Block): { collided: boolean; restRow: number; restColumn: number } {
    // Only check collision for blocks moving downward (positive Y velocity)
    if (block.velocityY <= 0) {
      return { collided: false, restRow: -1, restColumn: -1 };
    }

    // Get current grid position based on pixel coordinates
    const currentGridPos = this.pixelToGrid(block.x, block.y);
    const column = currentGridPos.column;

    // Check bottom boundary
    const bottomY = GridManager.GRID_OFFSET_Y + GridManager.ROWS * GridManager.ROW_HEIGHT;
    if (block.y + GridManager.ROW_HEIGHT / 2 >= bottomY) {
      return { collided: true, restRow: GridManager.ROWS - 1, restColumn: column };
    }

    // Check collision with blocks in the grid (blocks at rest)
    // Look for the first block below in the same column
    for (let row = currentGridPos.row + 1; row < GridManager.ROWS; row++) {
      const blockBelow = this.grid[column][row];
      if (blockBelow && blockBelow.velocityY === 0) {
        // Check if we're touching it
        const blockBelowTop = blockBelow.y - GridManager.ROW_HEIGHT / 2;
        const currentBlockBottom = block.y + GridManager.ROW_HEIGHT / 2;

        if (currentBlockBottom >= blockBelowTop) {
          return { collided: true, restRow: row - 1, restColumn: column };
        }
      }
    }

    return { collided: false, restRow: -1, restColumn: -1 };
  }

  /**
   * Place a moving block into the grid at a specific position
   */
  public placeBlock(block: Block, column: number, row: number): void {
    // Update grid position
    block.setGridPosition(column, row);

    // Snap to grid position
    const { x, y } = this.gridToPixel(column, row);
    block.setPosition(x, y);
    block.setVelocity(0, 0);
    block.isInGrid = true;

    // Add to grid
    this.grid[column][row] = block;
  }

  /**
   * Debug: Draw grid lines
   */
  public drawGridLines(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    graphics.lineStyle(1, 0x333333, 0.5);

    const gridWidth = GridManager.COLUMNS * GridManager.COLUMN_WIDTH;
    const gridHeight = GridManager.ROWS * GridManager.ROW_HEIGHT;

    // Vertical lines
    for (let col = 0; col <= GridManager.COLUMNS; col++) {
      const x = GridManager.GRID_OFFSET_X + col * GridManager.COLUMN_WIDTH;
      graphics.lineBetween(
        x,
        GridManager.GRID_OFFSET_Y,
        x,
        GridManager.GRID_OFFSET_Y + gridHeight
      );
    }

    // Horizontal lines
    for (let row = 0; row <= GridManager.ROWS; row++) {
      const y = GridManager.GRID_OFFSET_Y + row * GridManager.ROW_HEIGHT;
      graphics.lineBetween(
        GridManager.GRID_OFFSET_X,
        y,
        GridManager.GRID_OFFSET_X + gridWidth,
        y
      );
    }

    graphics.strokePath();
  }
}
