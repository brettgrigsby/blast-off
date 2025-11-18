import { Block } from './Block';

/**
 * BlockGroup represents a collection of blocks that move together as a cohesive unit.
 * Groups are formed when blocks are launched and include all blocks above them.
 */
export class BlockGroup {
  private blocks: Set<Block>;
  private velocityY: number = 0;
  private boostCount: number = 0; // Number of times this group has been boosted by in-motion matches

  // Grace period tracking for collision detection
  private wasMovingUpward: boolean = false; // Track if group was recently moving upward
  private framesMovingDownward: number = 0; // Frames since velocity became positive (downward)

  // Descent configuration
  private static readonly DESCENT_VELOCITY = 100; // pixels/second downward
  private static readonly MAX_DESCENT_VELOCITY = 70; // Maximum downward velocity for groups (much slower than new blocks at 1000 px/s)
  private static readonly MAX_UPWARD_VELOCITY = -700; // Maximum upward movement velocity (px/s) - caps how fast groups move up, not how much velocity they can accumulate

  // Gravity configuration - scales with group size
  private static readonly BASE_GRAVITY = 150; // Base gravity affecting all groups (px/s²)
  private static readonly MASS_GRAVITY_FACTOR = 75; // Additional gravity per block in group (px/s²)

  // Merge velocity bonus - applied when groups collide and merge
  private static readonly MERGE_VELOCITY_BONUS = -650; // Upward velocity bonus per block in merged group (px/s)

  constructor(blocks: Block[] = []) {
    this.blocks = new Set(blocks);

    // Set initial velocity based on first block (they should all have same velocity when formed)
    if (blocks.length > 0) {
      this.velocityY = blocks[0].velocityY;
    }
  }

  /**
   * Add a block to this group with proper positioning
   * @param block The block to add
   * @param skipRepositioning If true, keep block's current position (used for merging groups in motion)
   */
  public addBlock(block: Block, skipRepositioning: boolean = false): void {
    if (!skipRepositioning) {
      // Find the proper stack position for this block
      const targetY = this.findClosestStackPosition(block);

      if (targetY !== null) {
        // Snap block to proper position to maintain spacing
        block.setPosition(block.x, targetY);
      }
    }

    this.blocks.add(block);
    // Sync the block's velocity with the group
    block.setVelocity(this.velocityY);
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
   * Realign blocks to fix Y-position drift from floating-point calculations
   * Snaps all blocks to a unified grid based on the topmost block
   */
  private realignBlocks(): void {
    const ROW_HEIGHT = 80; // GridManager.ROW_HEIGHT

    const allBlocks = Array.from(this.blocks);
    if (allBlocks.length === 0) return;

    // Find the topmost block as the grid reference point
    const topBlock = allBlocks.reduce((min, block) => block.y < min.y ? block : min);
    const referenceY = topBlock.y;

    // Snap all blocks to the unified grid
    for (const block of allBlocks) {
      // Calculate which grid row this block belongs to
      const distanceFromReference = block.y - referenceY;
      const rowIndex = Math.round(distanceFromReference / ROW_HEIGHT);
      const snappedY = referenceY + (rowIndex * ROW_HEIGHT);

      block.setPosition(block.x, snappedY);
    }
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
  public getVelocity(): number {
    return this.velocityY;
  }

  /**
   * Set the group's velocity (updates all blocks in the group)
   */
  public setVelocity(velocityY: number): void {
    this.velocityY = velocityY;

    // Update all blocks in the group
    this.blocks.forEach(block => {
      block.setVelocity(velocityY);
    });
  }

  /**
   * Get the number of times this group has been boosted by in-motion matches
   */
  public getBoostCount(): number {
    return this.boostCount;
  }

  /**
   * Increment the boost count (called when the group is boosted by an in-motion match)
   */
  public incrementBoostCount(): void {
    this.boostCount++;
  }

  /**
   * Set the boost count (used when loading saved games)
   */
  public setBoostCount(count: number): void {
    this.boostCount = count;
  }

  /**
   * Add velocity to the group (force stacking)
   * This is used when new matches are created within the group
   */
  public addVelocity(deltaVelocityY: number): void {
    this.setVelocity(this.velocityY + deltaVelocityY);
  }

  /**
   * Update the group (applies gravity, checks for descent)
   * @param delta Time elapsed since last frame in milliseconds
   */
  public update(delta: number): void {
    const deltaSeconds = delta / 1000;

    // Apply gravity to the group - scales with group size (mass)
    const effectiveGravity = BlockGroup.BASE_GRAVITY + (this.blocks.size * BlockGroup.MASS_GRAVITY_FACTOR);
    this.velocityY += effectiveGravity * deltaSeconds;

    // Track velocity state transitions for grace period
    if (this.velocityY < 0) {
      // Moving upward
      this.wasMovingUpward = true;
      this.framesMovingDownward = 0;
    } else if (this.velocityY > 0 && this.wasMovingUpward) {
      // Just started moving downward after upward movement
      this.framesMovingDownward++;
    }

    // Cap downward velocity for descending groups (don't interfere with upward launches)
    // This prevents groups from falling as fast as new blocks
    if (this.velocityY > BlockGroup.MAX_DESCENT_VELOCITY) {
      this.velocityY = BlockGroup.MAX_DESCENT_VELOCITY;
    }

    // Update velocity for all blocks
    this.setVelocity(this.velocityY);

    // Calculate the velocity to apply for movement
    // Cap upward movement velocity while allowing stored velocity to remain uncapped
    // This lets gravity act on the full velocity while limiting how fast groups actually move up
    let appliedVelocity = this.velocityY;
    if (appliedVelocity < BlockGroup.MAX_UPWARD_VELOCITY) {
      appliedVelocity = BlockGroup.MAX_UPWARD_VELOCITY;
    }

    // Update each block's position as part of the rigid group
    // Don't call block.update() as that would apply individual gravity
    this.blocks.forEach(block => {
      const newY = block.y + appliedVelocity * deltaSeconds;
      block.setPosition(block.x, newY);
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
   * Check if group is in grace period (recently transitioned from upward to downward)
   * During grace period, collision detection should be skipped to prevent premature disbanding
   */
  public isInGracePeriod(): boolean {
    return this.wasMovingUpward && this.framesMovingDownward < 10;
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
    this.setVelocity(BlockGroup.DESCENT_VELOCITY);
  }

  /**
   * Merge another group into this one
   * Combines velocities and blocks
   */
  public mergeWith(otherGroup: BlockGroup): void {
    // Add all blocks from the other group
    // Skip repositioning to maintain blocks' relative positions in motion
    otherGroup.getBlocks().forEach(block => {
      this.addBlock(block, true);
    });

    // Combine velocities (average based on block count)
    const thisSize = this.blocks.size - otherGroup.size();
    const otherSize = otherGroup.size();
    const totalSize = this.blocks.size;

    if (totalSize > 0) {
      const otherVelocity = otherGroup.getVelocity();
      this.velocityY = (this.velocityY * thisSize + otherVelocity * otherSize) / totalSize;

      // Apply upward velocity bonus
      const mergeBonus = BlockGroup.MERGE_VELOCITY_BONUS;
      this.velocityY += mergeBonus;

      // Update all blocks with the new combined velocity
      this.setVelocity(this.velocityY);
    }

    // Take the maximum boost count from the merging groups and add 1
    // This rewards merging groups and encourages strategic play
    this.boostCount = Math.max(this.boostCount, otherGroup.getBoostCount()) + 1;

    // Fix any Y-position drift from floating-point calculations
    this.realignBlocks();
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
