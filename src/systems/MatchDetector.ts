import { Block, BlockColor } from '../objects/Block';
import { BlockGroup } from '../objects/BlockGroup';
import { ColumnManager } from './ColumnManager';

export interface MatchResult {
  blocks: Block[];
  size: number;
}

export class MatchDetector {
  private columnManager: ColumnManager;

  constructor(columnManager: ColumnManager) {
    this.columnManager = columnManager;
  }

  /**
   * Detect all matches on the board
   * Returns all blocks that are part of any match (horizontal or vertical)
   */
  public detectMatches(): MatchResult {
    const matchedBlocks = new Set<Block>();

    // Check horizontal matches
    this.detectHorizontalMatches(matchedBlocks);

    // Check vertical matches
    this.detectVerticalMatches(matchedBlocks);

    return {
      blocks: Array.from(matchedBlocks),
      size: matchedBlocks.size,
    };
  }

  /**
   * Detect horizontal matches (scan each row)
   */
  private detectHorizontalMatches(matchedBlocks: Set<Block>): void {
    for (let row = 0; row < ColumnManager.ROWS; row++) {
      const rowBlocks = this.columnManager.getRow(row);

      let currentColor: BlockColor | null = null;
      let currentGroup: BlockGroup | null | undefined = undefined;
      let consecutiveBlocks: Block[] = [];

      for (let col = 0; col < ColumnManager.COLUMNS; col++) {
        const block = rowBlocks[col];

        // Skip empty spaces or grey blocks
        if (!block || block.isGrey()) {
          // Check if we have a match in progress
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          // Reset
          currentColor = null;
          currentGroup = undefined;
          consecutiveBlocks = [];
          continue;
        }

        // Get the block's group (null if not in a group)
        const blockGroup = this.columnManager.getBlockGroup(block);

        // Check if this block continues the sequence
        // Blocks must have same color AND same group membership
        if (block.color === currentColor && blockGroup === currentGroup) {
          consecutiveBlocks.push(block);
        } else {
          // New color or different group - check if previous sequence was a match
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          // Start new sequence
          currentColor = block.color;
          currentGroup = blockGroup;
          consecutiveBlocks = [block];
        }
      }

      // Check final sequence in this row
      if (consecutiveBlocks.length >= 3) {
        consecutiveBlocks.forEach(b => matchedBlocks.add(b));
      }
    }
  }

  /**
   * Detect vertical matches (scan each column)
   */
  private detectVerticalMatches(matchedBlocks: Set<Block>): void {
    for (let col = 0; col < ColumnManager.COLUMNS; col++) {
      const column = this.columnManager.getColumn(col);
      if (!column) continue;

      const columnBlocks = column.getBlocksAtRest();

      if (columnBlocks.length < 3) {
        continue; // Not enough blocks for a match
      }

      let currentColor: BlockColor | null = null;
      let currentGroup: BlockGroup | null | undefined = undefined;
      let consecutiveBlocks: Block[] = [];

      for (let i = 0; i < columnBlocks.length; i++) {
        const block = columnBlocks[i];

        // Skip grey blocks
        if (block.isGrey()) {
          // Check if we have a match in progress
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          // Reset
          currentColor = null;
          currentGroup = undefined;
          consecutiveBlocks = [];
          continue;
        }

        // Get the block's group (null if not in a group)
        const blockGroup = this.columnManager.getBlockGroup(block);

        // Check if this block continues the sequence
        // Blocks must have same color AND same group membership
        if (block.color === currentColor && blockGroup === currentGroup && consecutiveBlocks.length > 0) {
          // Verify blocks are physically adjacent (consecutive by position)
          const previousBlock = consecutiveBlocks[consecutiveBlocks.length - 1];
          const spacing = block.y - previousBlock.y;
          const expectedSpacing = ColumnManager.ROW_HEIGHT;

          // Blocks should be exactly ROW_HEIGHT apart (within 1px for floating point precision)
          const isConsecutive = Math.abs(spacing - expectedSpacing) <= 1;

          if (isConsecutive) {
            consecutiveBlocks.push(block);
          } else {
            // Gap in sequence - check if previous sequence was a match
            if (consecutiveBlocks.length >= 3) {
              consecutiveBlocks.forEach(b => matchedBlocks.add(b));
            }
            // Start new sequence
            currentColor = block.color;
            currentGroup = blockGroup;
            consecutiveBlocks = [block];
          }
        } else {
          // New color or different group - check if previous sequence was a match
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          // Start new sequence
          currentColor = block.color;
          currentGroup = blockGroup;
          consecutiveBlocks = [block];
        }
      }

      // Check final sequence in this column
      if (consecutiveBlocks.length >= 3) {
        consecutiveBlocks.forEach(b => matchedBlocks.add(b));
      }
    }
  }

  /**
   * Get all blocks connected to the matched blocks using flood-fill
   * Only returns blocks that are physically touching (adjacent in same column) ABOVE the match
   */
  private getConnectedBlocks(matchedBlocks: Block[]): Block[] {
    const connectedSet = new Set<Block>();
    const toProcess: Block[] = [...matchedBlocks];

    // Add all matched blocks to the connected set
    matchedBlocks.forEach(block => connectedSet.add(block));

    // Process each block and find its connected neighbors above
    while (toProcess.length > 0) {
      const currentBlock = toProcess.pop()!;
      const columnIndex = currentBlock.column;
      const column = this.columnManager.getColumn(columnIndex);

      if (!column) continue;

      // Check for blocks directly above this one (only look upward)
      const blockAbove = column.getBlockAbove(currentBlock.y);
      if (blockAbove && !connectedSet.has(blockAbove)) {
        // Verify it's actually touching (within ROW_HEIGHT tolerance)
        const distance = currentBlock.y - blockAbove.y;
        const expectedDistance = ColumnManager.ROW_HEIGHT;

        if (Math.abs(distance - expectedDistance) <= 1) {
          connectedSet.add(blockAbove);
          toProcess.push(blockAbove);
        }
      }
    }

    return Array.from(connectedSet);
  }

  /**
   * Check for matches and launch matched blocks + all connected blocks as groups
   * Uses flood-fill to only include blocks physically touching the match
   * Returns number of blocks launched (for score tracking)
   */
  public checkAndProcessMatches(): number {
    const matchResult = this.detectMatches();

    if (matchResult.blocks.length > 0) {
      // Convert matched blocks to grey and show flames
      matchResult.blocks.forEach(matchedBlock => {
        matchedBlock.setColor(BlockColor.GREY);
        matchedBlock.showFlame();
      });

      // Get only the blocks that are physically connected to the matched blocks
      const allLaunchedBlocks = this.getConnectedBlocks(matchResult.blocks);

      // Check if the MATCHED blocks (not blocks above) are already in a group
      // Only boost velocity if the match occurred within an existing group
      const existingGroup = this.findExistingGroup(matchResult.blocks);

      if (existingGroup) {
        // Add force to existing group (force stacking)
        const launchVelocity = this.getLaunchVelocity(matchResult.size);
        existingGroup.addVelocity(launchVelocity);
      } else {
        // Create ONE group for ALL blocks (across all columns)
        const groupBlocks: Block[] = [];

        allLaunchedBlocks.forEach(block => {
          // Remove block from column if it's in the grid
          if (block.isInGrid) {
            this.columnManager.removeBlockFromColumn(block);
            block.isInGrid = false;
          }

          // Launch the block with velocity based on match size
          block.launch(matchResult.size);
          groupBlocks.push(block);
        });

        // Create and add the single unified group
        const group = new BlockGroup(groupBlocks);
        this.columnManager.addGroup(group);
      }

      return matchResult.blocks.length; // Return only matched blocks for score
    }

    return 0;
  }

  /**
   * Find if any of these blocks already belong to a group
   */
  private findExistingGroup(blocks: Block[]): BlockGroup | null {
    for (const block of blocks) {
      const group = this.columnManager.getBlockGroup(block);
      if (group) {
        return group;
      }
    }
    return null;
  }

  /**
   * Check for matches within a specific BlockGroup
   * Used to detect matches while blocks are in motion
   * Returns number of blocks matched (for score tracking)
   */
  public checkMatchesInGroup(group: BlockGroup): number {
    const blocks = group.getBlocks();
    if (blocks.length < 3) {
      return 0; // Not enough blocks for a match
    }

    const matchedBlocks = new Set<Block>();

    // Check horizontal matches using physical positions
    this.detectHorizontalMatchesInBlocks(blocks, matchedBlocks);

    // Check vertical matches using physical positions
    this.detectVerticalMatchesInBlocks(blocks, matchedBlocks);

    if (matchedBlocks.size > 0) {
      // Convert matched blocks to grey
      matchedBlocks.forEach(block => {
        block.setColor(BlockColor.GREY);
      });

      // Add upward velocity to the group based on match size
      // Apply bonus velocity based on the current boost count
      const launchVelocity = this.getLaunchVelocity(matchedBlocks.size, true, group.getBoostCount());
      group.addVelocity(launchVelocity);

      // Increment the boost count for this group
      group.incrementBoostCount();

      return matchedBlocks.size;
    }

    return 0;
  }

  /**
   * Detect horizontal matches in a set of blocks using physical positions
   */
  private detectHorizontalMatchesInBlocks(blocks: Block[], matchedBlocks: Set<Block>): void {
    // Filter out grey blocks
    const activeBlocks = blocks.filter(block => !block.isGrey());
    if (activeBlocks.length < 3) return;

    // Cluster blocks by similar Y positions (relative positioning)
    const ROW_TOLERANCE = 20; // Blocks within 20px vertically are considered in the same row
    const rowClusters: Block[][] = [];

    // Sort blocks by Y position to make clustering easier
    const sortedByY = [...activeBlocks].sort((a, b) => a.y - b.y);

    // Create clusters of blocks with similar Y positions
    let currentCluster: Block[] = [sortedByY[0]];
    for (let i = 1; i < sortedByY.length; i++) {
      const block = sortedByY[i];
      const clusterY = currentCluster[0].y;

      // If block is within tolerance of the cluster's Y position, add it
      if (Math.abs(block.y - clusterY) <= ROW_TOLERANCE) {
        currentCluster.push(block);
      } else {
        // Start a new cluster
        rowClusters.push(currentCluster);
        currentCluster = [block];
      }
    }
    // Don't forget the last cluster
    rowClusters.push(currentCluster);

    // Check each cluster for horizontal matches
    rowClusters.forEach(clusterBlocks => {
      if (clusterBlocks.length < 3) return;

      // Sort by column (X position)
      clusterBlocks.sort((a, b) => a.column - b.column);

      let currentColor: BlockColor | null = null;
      let consecutiveBlocks: Block[] = [];

      clusterBlocks.forEach(block => {
        // Check if this block is adjacent to the previous one (same or next column)
        const isAdjacent = consecutiveBlocks.length === 0 ||
          (block.column === consecutiveBlocks[consecutiveBlocks.length - 1].column + 1);

        if (block.color === currentColor && isAdjacent) {
          consecutiveBlocks.push(block);
        } else {
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          currentColor = block.color;
          consecutiveBlocks = [block];
        }
      });

      // Check final sequence
      if (consecutiveBlocks.length >= 3) {
        consecutiveBlocks.forEach(b => matchedBlocks.add(b));
      }
    });
  }

  /**
   * Detect vertical matches in a set of blocks using physical positions
   */
  private detectVerticalMatchesInBlocks(blocks: Block[], matchedBlocks: Set<Block>): void {
    // Group blocks by column
    const columnMap = new Map<number, Block[]>();

    blocks.forEach(block => {
      if (block.isGrey()) return;

      if (!columnMap.has(block.column)) {
        columnMap.set(block.column, []);
      }
      columnMap.get(block.column)!.push(block);
    });

    // Check each column for matches
    columnMap.forEach(columnBlocks => {
      if (columnBlocks.length < 3) return;

      // Sort by Y position (top to bottom)
      columnBlocks.sort((a, b) => a.y - b.y);

      let currentColor: BlockColor | null = null;
      let consecutiveBlocks: Block[] = [];

      columnBlocks.forEach(block => {
        if (block.isGrey()) {
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          currentColor = null;
          consecutiveBlocks = [];
          return;
        }

        // Check if this block continues the sequence
        if (block.color === currentColor && consecutiveBlocks.length > 0) {
          // Verify blocks are physically adjacent
          const previousBlock = consecutiveBlocks[consecutiveBlocks.length - 1];
          const spacing = block.y - previousBlock.y;
          const expectedSpacing = ColumnManager.ROW_HEIGHT;

          // Blocks should be approximately ROW_HEIGHT apart
          const isConsecutive = Math.abs(spacing - expectedSpacing) <= expectedSpacing * 0.25; // 25% tolerance

          if (isConsecutive) {
            consecutiveBlocks.push(block);
          } else {
            if (consecutiveBlocks.length >= 3) {
              consecutiveBlocks.forEach(b => matchedBlocks.add(b));
            }
            currentColor = block.color;
            consecutiveBlocks = [block];
          }
        } else {
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          currentColor = block.color;
          consecutiveBlocks = [block];
        }
      });

      // Check final sequence
      if (consecutiveBlocks.length >= 3) {
        consecutiveBlocks.forEach(b => matchedBlocks.add(b));
      }
    });
  }

  /**
   * Get launch velocity for a given match size
   * @param matchSize - Number of blocks in the match
   * @param isGroupInMotion - If true, applies bonus velocity based on boost count
   * @param boostCount - Number of times the group has been boosted (0 for first boost)
   */
  private getLaunchVelocity(matchSize: number, isGroupInMotion: boolean = false, boostCount: number = 0): number {
    const baseVelocity = matchSize * -300;
    if (!isGroupInMotion) {
      return baseVelocity;
    }
    // Formula: baseVelocity * (1 + 2^boostCount)
    // boostCount 0: 2x (1 + 1), boostCount 1: 3x (1 + 2), boostCount 2: 5x (1 + 4), boostCount 3: 9x (1 + 8)
    const multiplier = 1 + Math.pow(2, boostCount);
    return baseVelocity * multiplier;
  }
}
