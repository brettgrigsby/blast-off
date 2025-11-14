import Phaser from 'phaser';
import { Block, BlockColor } from '../objects/Block';
import { BlockGroup } from '../objects/BlockGroup';
import { Column } from './Column';

export class ColumnManager {
  private scene: Phaser.Scene;

  // Grid dimensions
  public static readonly COLUMNS = 9;
  public static readonly ROWS = 12; // Keep for legacy/sizing calculations
  public static readonly COLUMN_WIDTH = 80; // 720px / 9 columns
  public static readonly ROW_HEIGHT = 80; // Square cells to match blocks

  // Grid positioning - position the 9×12 board (720×960) on the 720×1080 canvas
  public static readonly GRID_OFFSET_X = 0;
  public static readonly GRID_OFFSET_Y = 30; // 30px top margin, 90px bottom margin

  // Column storage: Column-based architecture
  private columns: Column[];

  // All blocks in the game (for easy iteration)
  private blocks: Block[];

  // Active block groups
  private groups: BlockGroup[];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.blocks = [];
    this.groups = [];

    // Initialize columns
    this.columns = [];
    const gridHeight = ColumnManager.ROWS * ColumnManager.ROW_HEIGHT;
    for (let col = 0; col < ColumnManager.COLUMNS; col++) {
      this.columns[col] = new Column(
        col,
        ColumnManager.GRID_OFFSET_Y,
        gridHeight,
        ColumnManager.ROW_HEIGHT
      );
    }
  }

  /**
   * Get column instance by index
   */
  public getColumn(columnIndex: number): Column | null {
    if (columnIndex < 0 || columnIndex >= ColumnManager.COLUMNS) {
      return null;
    }
    return this.columns[columnIndex];
  }

  /**
   * Get all blocks in a specific column (for backward compatibility)
   */
  public getColumnBlocks(columnIndex: number): Block[] {
    const column = this.getColumn(columnIndex);
    return column ? column.getAllBlocks() : [];
  }

  /**
   * Convert grid coordinates to pixel coordinates (center of cell)
   * Kept for legacy/sizing calculations
   */
  public gridToPixel(column: number, row: number): { x: number; y: number } {
    return {
      x: ColumnManager.GRID_OFFSET_X + column * ColumnManager.COLUMN_WIDTH + ColumnManager.COLUMN_WIDTH / 2,
      y: ColumnManager.GRID_OFFSET_Y + row * ColumnManager.ROW_HEIGHT + ColumnManager.ROW_HEIGHT / 2,
    };
  }

  /**
   * Convert pixel coordinates to grid coordinates
   * Kept for backward compatibility
   */
  public pixelToGrid(x: number, y: number): { column: number; row: number } {
    return {
      column: Math.floor((x - ColumnManager.GRID_OFFSET_X) / ColumnManager.COLUMN_WIDTH),
      row: Math.floor((y - ColumnManager.GRID_OFFSET_Y) / ColumnManager.ROW_HEIGHT),
    };
  }

  /**
   * Get X coordinate for column center
   */
  public getColumnCenterX(columnIndex: number): number {
    return ColumnManager.GRID_OFFSET_X + columnIndex * ColumnManager.COLUMN_WIDTH + ColumnManager.COLUMN_WIDTH / 2;
  }

  /**
   * Check if column index is within bounds
   */
  public isValidColumn(columnIndex: number): boolean {
    return columnIndex >= 0 && columnIndex < ColumnManager.COLUMNS;
  }

  /**
   * Check if grid coordinates are within bounds (legacy)
   */
  public isInBounds(column: number, row: number): boolean {
    return (
      column >= 0 &&
      column < ColumnManager.COLUMNS &&
      row >= 0 &&
      row < ColumnManager.ROWS
    );
  }

  /**
   * Get block at specific grid position (legacy - converts to Y position lookup)
   */
  public getBlock(column: number, row: number): Block | null {
    if (!this.isValidColumn(column)) {
      return null;
    }

    const y = this.gridToPixel(column, row).y;
    const col = this.columns[column];
    return col.getBlockAt(y, ColumnManager.ROW_HEIGHT / 2);
  }

  /**
   * Get block at specific column and Y position
   */
  public getBlockAtPosition(columnIndex: number, y: number, tolerance: number = 5): Block | null {
    const column = this.getColumn(columnIndex);
    return column ? column.getBlockAt(y, tolerance) : null;
  }

  /**
   * Set block at specific grid position (legacy - for backward compatibility)
   * This is deprecated and should be replaced with addBlockToColumn
   */
  public setBlock(column: number, row: number, block: Block | null): void {
    console.warn('setBlock is deprecated - use addBlockToColumn or removeBlockFromColumn instead');

    if (!this.isValidColumn(column)) {
      return;
    }

    const col = this.columns[column];

    if (block === null) {
      // Remove any block at this position
      const y = this.gridToPixel(column, row).y;
      const existingBlock = col.getBlockAt(y, ColumnManager.ROW_HEIGHT / 2);
      if (existingBlock) {
        col.removeBlock(existingBlock);
      }
    } else {
      // Add block to column
      col.addBlock(block);
    }
  }

  /**
   * Add a block to its column
   */
  public addBlockToColumn(block: Block): void {
    if (!this.isValidColumn(block.column)) {
      console.warn(`Invalid column ${block.column} for block`);
      return;
    }

    this.columns[block.column].addBlock(block);
    block.isInGrid = true;
  }

  /**
   * Remove a block from its column
   */
  public removeBlockFromColumn(block: Block): boolean {
    if (!this.isValidColumn(block.column)) {
      return false;
    }

    return this.columns[block.column].removeBlock(block);
  }

  /**
   * Add a new block to the game at a specific position
   * If Y is above grid, block starts falling
   */
  public addBlock(column: number, y: number, color: BlockColor, velocity: number = 0): Block {
    const x = this.getColumnCenterX(column);

    // Calculate row for legacy compatibility (will be removed later)
    const row = Math.floor((y - ColumnManager.GRID_OFFSET_Y) / ColumnManager.ROW_HEIGHT);

    const block = new Block(this.scene, column, row, x, y, color);

    // Set initial velocity (e.g., for falling blocks)
    block.setVelocity(velocity);

    // Add to column if in bounds and at rest, otherwise block is in motion
    const isInBounds = y >= ColumnManager.GRID_OFFSET_Y &&
                      y < ColumnManager.GRID_OFFSET_Y + ColumnManager.ROWS * ColumnManager.ROW_HEIGHT;

    if (isInBounds && velocity === 0) {
      this.columns[column].addBlock(block);
      block.isInGrid = true;
    } else {
      block.isInGrid = false;
    }

    this.blocks.push(block);

    return block;
  }

  /**
   * Remove a block from the game
   */
  public removeBlock(block: Block): void {
    // Remove from column
    if (this.isValidColumn(block.column)) {
      this.columns[block.column].removeBlock(block);
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
   * Get all blocks in a specific row (legacy - for horizontal matching)
   */
  public getRow(row: number): (Block | null)[] {
    if (row < 0 || row >= ColumnManager.ROWS) {
      return [];
    }

    const y = this.gridToPixel(0, row).y;
    const tolerance = ColumnManager.ROW_HEIGHT * 0.4; // 40% tolerance for "same row"

    const rowBlocks: (Block | null)[] = [];
    for (let col = 0; col < ColumnManager.COLUMNS; col++) {
      const block = this.columns[col].getBlockAt(y, tolerance);
      rowBlocks.push(block);
    }
    return rowBlocks;
  }

  /**
   * Get all blocks at a specific Y position across all columns (for horizontal matching)
   */
  public getBlocksAtY(y: number, tolerance: number = ColumnManager.ROW_HEIGHT * 0.4): Block[] {
    const blocks: Block[] = [];
    for (const column of this.columns) {
      const block = column.getBlockAt(y, tolerance);
      if (block) {
        blocks.push(block);
      }
    }
    return blocks;
  }

  /**
   * Get all blocks in the game
   */
  public getAllBlocks(): Block[] {
    return this.blocks.slice();
  }

  /**
   * Clear all blocks from the game
   */
  public clear(): void {
    // Destroy all blocks
    this.blocks.forEach(block => block.destroy());
    this.blocks = [];
    this.groups = [];

    // Clear all columns
    for (const column of this.columns) {
      column.clear();
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
   * Check if two groups are colliding (any blocks overlapping)
   * Returns true if groups have blocks in same column within ROW_HEIGHT distance
   */
  public checkGroupCollision(group1: BlockGroup, group2: BlockGroup): boolean {
    const blocks1 = group1.getBlocks();
    const blocks2 = group2.getBlocks();

    // Check each block in group1 against each block in group2
    for (const block1 of blocks1) {
      for (const block2 of blocks2) {
        // Check if blocks are in same column
        if (block1.column === block2.column) {
          // Check if blocks are close enough in Y position
          const yDistance = Math.abs(block1.y - block2.y);
          if (yDistance < ColumnManager.ROW_HEIGHT) {
            return true; // Collision detected
          }
        }
      }
    }

    return false; // No collision
  }

  /**
   * Check if a moving block collides with the bottom or another block
   */
  public checkCollision(block: Block): { collided: boolean; restY: number; restColumn: number } {
    if (!this.isValidColumn(block.column)) {
      return { collided: false, restY: -1, restColumn: -1 };
    }

    const column = this.columns[block.column];
    const collision = column.checkCollision(block);

    return {
      collided: collision.collided,
      restY: collision.restY,
      restColumn: block.column,
    };
  }

  /**
   * Place a moving block at a specific Y position in its column
   */
  public placeBlock(block: Block, columnIndex: number, y: number): void {
    // Update column if changed
    if (block.column !== columnIndex) {
      // Remove from old column
      if (this.isValidColumn(block.column)) {
        this.columns[block.column].removeBlock(block);
      }
      block.column = columnIndex;
    }

    // Update position
    const x = this.getColumnCenterX(columnIndex);
    block.setPosition(x, y);
    block.setVelocity(0);

    // Update row for legacy compatibility
    block.row = Math.floor((y - ColumnManager.GRID_OFFSET_Y) / ColumnManager.ROW_HEIGHT);

    // Add to column and mark as in grid
    this.columns[columnIndex].addBlock(block);
    block.isInGrid = true;
  }

  /**
   * Debug: Draw grid lines
   */
  public drawGridLines(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    graphics.lineStyle(1, 0x333333, 0.5);

    const gridWidth = ColumnManager.COLUMNS * ColumnManager.COLUMN_WIDTH;
    const gridHeight = ColumnManager.ROWS * ColumnManager.ROW_HEIGHT;

    // Vertical lines (column separators)
    for (let col = 0; col <= ColumnManager.COLUMNS; col++) {
      const x = ColumnManager.GRID_OFFSET_X + col * ColumnManager.COLUMN_WIDTH;
      graphics.lineBetween(
        x,
        ColumnManager.GRID_OFFSET_Y,
        x,
        ColumnManager.GRID_OFFSET_Y + gridHeight
      );
    }

    // Horizontal lines (visual reference)
    for (let row = 0; row <= ColumnManager.ROWS; row++) {
      const y = ColumnManager.GRID_OFFSET_Y + row * ColumnManager.ROW_HEIGHT;
      graphics.lineBetween(
        ColumnManager.GRID_OFFSET_X,
        y,
        ColumnManager.GRID_OFFSET_X + gridWidth,
        y
      );
    }

    graphics.strokePath();

    // Draw prominent top border line (20% opacity overlays the 50% base line for 70% total)
    graphics.lineStyle(3, 0xffffff, 0.2);
    graphics.lineBetween(
      ColumnManager.GRID_OFFSET_X,
      ColumnManager.GRID_OFFSET_Y,
      ColumnManager.GRID_OFFSET_X + gridWidth,
      ColumnManager.GRID_OFFSET_Y
    );
    graphics.strokePath();
  }
}
