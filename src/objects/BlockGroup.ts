import { Block } from './Block';

/**
 * BlockGroup represents a collection of blocks that move together as a cohesive unit.
 * Groups are formed when blocks are launched and include all blocks above them.
 */
export class BlockGroup {
  private blocks: Set<Block>;
  private velocityX: number = 0;
  private velocityY: number = 0;

  // Descent configuration
  private static readonly DESCENT_VELOCITY = 100; // pixels/second downward
  private static readonly MAX_DESCENT_VELOCITY = 200; // Maximum downward velocity for groups (much slower than new blocks at 1000 px/s)

  constructor(blocks: Block[] = []) {
    this.blocks = new Set(blocks);

    // Set initial velocity based on first block (they should all have same velocity when formed)
    if (blocks.length > 0) {
      this.velocityX = blocks[0].velocityX;
      this.velocityY = blocks[0].velocityY;
    }
  }

  /**
   * Add a block to this group with proper positioning
   */
  public addBlock(block: Block): void {
    // Find the proper stack position for this block
    const targetY = this.findClosestStackPosition(block);

    if (targetY !== null) {
      // Snap block to proper position to maintain spacing
      block.setPosition(block.x, targetY);
    }

    this.blocks.add(block);
    // Sync the block's velocity with the group
    block.setVelocity(this.velocityX, this.velocityY);
  }

  /**
   * Find the closest valid stack position for a block joining this group
   * Returns the Y position where the block should be placed to maintain proper spacing
   */
  public findClosestStackPosition(block: Block): number | null {
    const ROW_HEIGHT = 80; // GridManager.ROW_HEIGHT

    // Get all blocks in the same column
    const sameColumnBlocks = Array.from(this.blocks).filter(
      b => b.column === block.column
    );

    if (sameColumnBlocks.length === 0) {
      // No blocks in this column, block can stay at current position
      return block.y;
    }

    // Sort blocks by Y position (top to bottom)
    sameColumnBlocks.sort((a, b) => a.y - b.y);

    // Find the closest valid position (above or below existing blocks)
    let closestY = block.y;
    let minDistance = Infinity;

    // Check position above topmost block
    const topBlock = sameColumnBlocks[0];
    const aboveTop = topBlock.y - ROW_HEIGHT;
    const distanceAboveTop = Math.abs(block.y - aboveTop);
    if (distanceAboveTop < minDistance) {
      minDistance = distanceAboveTop;
      closestY = aboveTop;
    }

    // Check position below bottommost block
    const bottomBlock = sameColumnBlocks[sameColumnBlocks.length - 1];
    const belowBottom = bottomBlock.y + ROW_HEIGHT;
    const distanceBelowBottom = Math.abs(block.y - belowBottom);
    if (distanceBelowBottom < minDistance) {
      minDistance = distanceBelowBottom;
      closestY = belowBottom;
    }

    // Check gaps between existing blocks
    for (let i = 0; i < sameColumnBlocks.length - 1; i++) {
      const currentBlock = sameColumnBlocks[i];
      const nextBlock = sameColumnBlocks[i + 1];
      const gap = nextBlock.y - currentBlock.y;

      // If there's a gap larger than ROW_HEIGHT, we can fit a block in between
      if (gap > ROW_HEIGHT * 1.5) {
        const inBetween = currentBlock.y + ROW_HEIGHT;
        const distanceInBetween = Math.abs(block.y - inBetween);
        if (distanceInBetween < minDistance) {
          minDistance = distanceInBetween;
          closestY = inBetween;
        }
      }
    }

    return closestY;
  }

  /**
   * Check if adding a block at a target Y position would cause overlap
   */
  public wouldOverlap(block: Block, targetY: number): boolean {
    const ROW_HEIGHT = 80; // GridManager.ROW_HEIGHT
    const MIN_SPACING = ROW_HEIGHT * 0.8; // Allow 20% tolerance

    // Check against all blocks in the same column
    for (const existingBlock of this.blocks) {
      if (existingBlock.column === block.column) {
        const distance = Math.abs(targetY - existingBlock.y);
        if (distance < MIN_SPACING) {
          return true; // Would overlap
        }
      }
    }

    return false; // No overlap
  }

  /**
   * Remove a block from this group
   */
  public removeBlock(block: Block): void {
    this.blocks.delete(block);
  }

  /**
   * Get all blocks in this group
   */
  public getBlocks(): Block[] {
    return Array.from(this.blocks);
  }

  /**
   * Get the number of blocks in this group
   */
  public size(): number {
    return this.blocks.size;
  }

  /**
   * Check if this group is empty
   */
  public isEmpty(): boolean {
    return this.blocks.size === 0;
  }

  /**
   * Check if this group contains a specific block
   */
  public hasBlock(block: Block): boolean {
    return this.blocks.has(block);
  }

  /**
   * Get the group's current velocity
   */
  public getVelocity(): { x: number; y: number } {
    return { x: this.velocityX, y: this.velocityY };
  }

  /**
   * Set the group's velocity (updates all blocks in the group)
   */
  public setVelocity(velocityX: number, velocityY: number): void {
    this.velocityX = velocityX;
    this.velocityY = velocityY;

    // Update all blocks in the group
    this.blocks.forEach(block => {
      block.setVelocity(velocityX, velocityY);
    });
  }

  /**
   * Add velocity to the group (force stacking)
   * This is used when new matches are created within the group
   */
  public addVelocity(deltaVelocityX: number, deltaVelocityY: number): void {
    this.setVelocity(
      this.velocityX + deltaVelocityX,
      this.velocityY + deltaVelocityY
    );
  }

  /**
   * Update the group (applies gravity, checks for descent)
   * @param delta Time elapsed since last frame in milliseconds
   */
  public update(delta: number): void {
    const deltaSeconds = delta / 1000;

    // Apply gravity to the group
    this.velocityY += Block.GRAVITY * deltaSeconds;

    // Cap downward velocity for descending groups (don't interfere with upward launches)
    // This prevents groups from falling as fast as new blocks
    if (this.velocityY > BlockGroup.MAX_DESCENT_VELOCITY) {
      this.velocityY = BlockGroup.MAX_DESCENT_VELOCITY;
    }

    // Update velocity for all blocks
    this.setVelocity(this.velocityX, this.velocityY);

    // Update each block's position
    this.blocks.forEach(block => {
      block.update(delta);
    });
  }

  /**
   * Check if the entire group is above the screen top boundary
   */
  public isFullyAboveScreen(): boolean {
    // All blocks must be above screen for the group to be fully above
    for (const block of this.blocks) {
      if (!block.isAboveScreen()) {
        return false;
      }
    }
    return this.blocks.size > 0; // Must have at least one block
  }

  /**
   * Check if any block in the group is above the screen
   */
  public hasBlocksAboveScreen(): boolean {
    for (const block of this.blocks) {
      if (block.isAboveScreen()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Initiate descent for this group (if it doesn't fully clear screen)
   */
  public startDescent(): void {
    this.setVelocity(0, BlockGroup.DESCENT_VELOCITY);
  }

  /**
   * Merge another group into this one
   * Combines velocities and blocks
   */
  public mergeWith(otherGroup: BlockGroup): void {
    // Add all blocks from the other group
    otherGroup.getBlocks().forEach(block => {
      this.addBlock(block);
    });

    // Combine velocities (average based on block count)
    const thisSize = this.blocks.size - otherGroup.size();
    const otherSize = otherGroup.size();
    const totalSize = this.blocks.size;

    if (totalSize > 0) {
      const otherVelocity = otherGroup.getVelocity();
      this.velocityX = (this.velocityX * thisSize + otherVelocity.x * otherSize) / totalSize;
      this.velocityY = (this.velocityY * thisSize + otherVelocity.y * otherSize) / totalSize;

      // Update all blocks with the new combined velocity
      this.setVelocity(this.velocityX, this.velocityY);
    }
  }

  /**
   * Check if this group should disband (e.g., if it touches the ground or another resting block)
   */
  public shouldDisband(): boolean {
    // Group should disband if moving downward and any block would collide
    // This will be checked by the GameScene collision detection
    return false; // Placeholder - actual logic handled externally
  }
}
