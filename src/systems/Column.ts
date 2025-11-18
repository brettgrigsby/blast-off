import { Block } from '../objects/Block';

export class Column {
  private columnIndex: number;
  private blocks: Block[]; // Sorted by Y position (top to bottom)
  private gridOffsetY: number;
  private gridHeight: number;
  private blockHeight: number;

  constructor(
    columnIndex: number,
    gridOffsetY: number,
    gridHeight: number,
    blockHeight: number
  ) {
    this.columnIndex = columnIndex;
    this.blocks = [];
    this.gridOffsetY = gridOffsetY;
    this.gridHeight = gridHeight;
    this.blockHeight = blockHeight;
  }

  /**
   * Get all blocks in this column, sorted by Y position (top to bottom)
   */
  public getAllBlocks(): Block[] {
    return this.blocks.slice();
  }

  /**
   * Get only blocks that are at rest (not moving)
   */
  public getBlocksAtRest(): Block[] {
    return this.blocks.filter(block => block.velocityY === 0);
  }

  /**
   * Get only blocks that are moving
   */
  public getMovingBlocks(): Block[] {
    return this.blocks.filter(block => block.velocityY !== 0);
  }

  /**
   * Find block at or near a specific Y position
   */
  public getBlockAt(y: number, tolerance: number = 5): Block | null {
    for (const block of this.blocks) {
      if (Math.abs(block.y - y) <= tolerance) {
        return block;
      }
    }
    return null;
  }

  /**
   * Find the first block below a given Y position (only considers blocks at rest)
   */
  public getBlockBelow(y: number): Block | null {
    const blocksAtRest = this.getBlocksAtRest();

    // Find blocks below the given Y position
    const blocksBelow = blocksAtRest.filter(block => block.y > y);

    // Return the one closest to y (highest up / smallest Y)
    if (blocksBelow.length === 0) {
      return null;
    }

    return blocksBelow.reduce((closest, block) =>
      block.y < closest.y ? block : closest
    );
  }

  /**
   * Find the first block above a given Y position
   */
  public getBlockAbove(y: number): Block | null {
    // Find blocks above the given Y position
    const blocksAbove = this.blocks.filter(block => block.y < y);

    // Return the one closest to y (lowest down / largest Y)
    if (blocksAbove.length === 0) {
      return null;
    }

    return blocksAbove.reduce((closest, block) =>
      block.y > closest.y ? block : closest
    );
  }

  /**
   * Get all blocks above a given Y position, sorted by Y (top to bottom)
   */
  public getBlocksAbove(y: number): Block[] {
    return this.blocks
      .filter(block => block.y < y)
      .sort((a, b) => a.y - b.y);
  }

  /**
   * Add a block to this column (maintains sorted order by Y position)
   */
  public addBlock(block: Block): void {
    // Verify the block belongs to this column
    if (block.column !== this.columnIndex) {
      console.warn(`Block column ${block.column} doesn't match column index ${this.columnIndex}`);
    }

    // Check for duplicate position (blocks overlapping)
    const tolerance = this.blockHeight * 0.1; // 10% of block height
    const existingBlock = this.getBlockAt(block.y, tolerance);
    if (existingBlock && existingBlock !== block) {
      // Adjust block position to be above the existing block
      block.setPosition(block.x, existingBlock.y - this.blockHeight);
    }

    this.blocks.push(block);
    this.sortBlocks();
  }

  /**
   * Remove a block from this column
   */
  public removeBlock(block: Block): boolean {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if this column contains a specific block
   */
  public hasBlock(block: Block): boolean {
    return this.blocks.includes(block);
  }

  /**
   * Get the number of blocks in this column
   */
  public getBlockCount(): number {
    return this.blocks.length;
  }

  /**
   * Check collision for a falling block in this column
   * Returns collision info with rest Y position
   */
  public checkCollision(block: Block): { collided: boolean; restY: number } {
    // Only check collision for blocks moving downward (positive Y velocity)
    if (block.velocityY <= 0) {
      return { collided: false, restY: -1 };
    }

    // Check bottom boundary
    const bottomY = this.gridOffsetY + this.gridHeight;
    const blockBottom = block.y + this.blockHeight / 2;

    if (blockBottom >= bottomY) {
      // Collided with bottom - rest at the last valid position
      const restY = bottomY - this.blockHeight / 2;
      return { collided: true, restY };
    }

    // Check collision with blocks at rest in this column
    const blockBelow = this.getBlockBelow(block.y);

    if (blockBelow) {
      const blockBelowTop = blockBelow.y - this.blockHeight / 2;
      const currentBlockBottom = block.y + this.blockHeight / 2;

      if (currentBlockBottom >= blockBelowTop) {
        // Collided with block below - rest just above it
        const restY = blockBelowTop - this.blockHeight / 2;
        return { collided: true, restY };
      }
    }

    return { collided: false, restY: -1 };
  }

  /**
   * Detect vertical matches (3+ consecutive blocks of same color)
   * Returns arrays of matched block groups
   */
  public detectVerticalMatches(): Block[][] {
    const matches: Block[][] = [];
    const blocksAtRest = this.getBlocksAtRest();

    if (blocksAtRest.length < 3) {
      return matches;
    }

    let currentMatch: Block[] = [blocksAtRest[0]];

    for (let i = 1; i < blocksAtRest.length; i++) {
      const currentBlock = blocksAtRest[i];
      const previousBlock = blocksAtRest[i - 1];

      // Check if blocks are consecutive (within reasonable spacing)
      const spacing = currentBlock.y - previousBlock.y;
      const isConsecutive = Math.abs(spacing - this.blockHeight) < this.blockHeight * 0.1;

      if (isConsecutive && currentBlock.color === previousBlock.color) {
        // Continue the match
        currentMatch.push(currentBlock);
      } else {
        // Match broken - save if 3+
        if (currentMatch.length >= 3) {
          matches.push([...currentMatch]);
        }
        // Start new potential match
        currentMatch = [currentBlock];
      }
    }

    // Check final match
    if (currentMatch.length >= 3) {
      matches.push(currentMatch);
    }

    return matches;
  }

  /**
   * Sort blocks by Y position (top to bottom)
   */
  private sortBlocks(): void {
    this.blocks.sort((a, b) => a.y - b.y);
  }

  /**
   * Clear all blocks from this column
   */
  public clear(): void {
    this.blocks = [];
  }
}
