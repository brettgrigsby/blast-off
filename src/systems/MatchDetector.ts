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
          consecutiveBlocks = [];
          continue;
        }

        // Check if this block continues the sequence
        if (block.color === currentColor) {
          consecutiveBlocks.push(block);
        } else {
          // New color - check if previous sequence was a match
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          // Start new sequence
          currentColor = block.color;
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
          consecutiveBlocks = [];
          continue;
        }

        // Check if this block continues the sequence
        if (block.color === currentColor && consecutiveBlocks.length > 0) {
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
            consecutiveBlocks = [block];
          }
        } else {
          // New color - check if previous sequence was a match
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          // Start new sequence
          currentColor = block.color;
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
   * Check for matches and launch matched blocks + all blocks above them as groups
   * Returns number of blocks launched (for score tracking)
   */
  public checkAndProcessMatches(): number {
    const matchResult = this.detectMatches();

    if (matchResult.blocks.length > 0) {
      // Track blocks to launch, organized by column
      const columnBlocks = new Map<number, Set<Block>>();

      // Add matched blocks and find all blocks above them
      matchResult.blocks.forEach(matchedBlock => {
        // Convert matched block to grey
        matchedBlock.setColor(BlockColor.GREY);

        const columnIndex = matchedBlock.column;
        if (!columnBlocks.has(columnIndex)) {
          columnBlocks.set(columnIndex, new Set());
        }
        columnBlocks.get(columnIndex)!.add(matchedBlock);

        // Find all blocks above this matched block in the same column
        const column = this.columnManager.getColumn(columnIndex);
        if (column) {
          const blocksAbove = column.getBlocksAbove(matchedBlock.y);
          blocksAbove.forEach(blockAbove => {
            columnBlocks.get(columnIndex)!.add(blockAbove);
          });
        }
      });

      // Create groups for each column and launch them
      // Note: Falling blocks will join groups later when they collide (handled in GameScene)
      columnBlocks.forEach((blocksInColumn, column) => {
        // Check if any of these blocks are already in a group
        const existingGroup = this.findExistingGroup(Array.from(blocksInColumn));

        if (existingGroup) {
          // Add force to existing group (force stacking)
          const launchVelocity = this.getLaunchVelocity(matchResult.size);
          existingGroup.addVelocity(0, launchVelocity);
        } else {
          // Create new group
          const groupBlocks: Block[] = [];

          blocksInColumn.forEach(block => {
            // Remove block from column if it's in the grid
            if (block.isInGrid) {
              this.columnManager.removeBlockFromColumn(block);
              block.isInGrid = false;
            }

            // Launch the block with velocity based on match size
            block.launch(matchResult.size);
            groupBlocks.push(block);
          });

          // Create and add the group
          const group = new BlockGroup(groupBlocks);
          this.columnManager.addGroup(group);
        }
      });

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
   * Get launch velocity for a given match size
   */
  private getLaunchVelocity(matchSize: number): number {
    if (matchSize === 3) {
      return -1600;
    } else if (matchSize === 4) {
      return -2400;
    } else {
      return -3200;
    }
  }
}
