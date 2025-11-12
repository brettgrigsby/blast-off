import { Block, BlockColor } from '../objects/Block';
import { GridManager } from './GridManager';

export interface MatchResult {
  blocks: Block[];
  size: number;
}

export class MatchDetector {
  private gridManager: GridManager;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
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
    for (let row = 0; row < GridManager.ROWS; row++) {
      const rowBlocks = this.gridManager.getRow(row);

      let currentColor: BlockColor | null = null;
      let consecutiveBlocks: Block[] = [];

      for (let col = 0; col < GridManager.COLUMNS; col++) {
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
    for (let col = 0; col < GridManager.COLUMNS; col++) {
      const columnBlocks = this.gridManager.getColumn(col);

      let currentColor: BlockColor | null = null;
      let consecutiveBlocks: Block[] = [];

      for (let row = 0; row < GridManager.ROWS; row++) {
        const block = columnBlocks[row];

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

      // Check final sequence in this column
      if (consecutiveBlocks.length >= 3) {
        consecutiveBlocks.forEach(b => matchedBlocks.add(b));
      }
    }
  }

  /**
   * Check for matches and launch matched blocks + all blocks above them
   * Returns number of blocks launched (for score tracking)
   */
  public checkAndProcessMatches(): number {
    const matchResult = this.detectMatches();

    if (matchResult.blocks.length > 0) {
      // Track all blocks to launch (matched + blocks above)
      const blocksToLaunch = new Set<Block>();
      // Track which columns are affected by matches
      const affectedColumns = new Set<number>();

      // Add matched blocks and find all blocks above them
      matchResult.blocks.forEach(matchedBlock => {
        // Convert matched block to grey
        matchedBlock.setColor(BlockColor.GREY);
        blocksToLaunch.add(matchedBlock);
        affectedColumns.add(matchedBlock.column);

        // Find all blocks above this matched block in the same column
        const column = matchedBlock.column;
        for (let row = matchedBlock.row - 1; row >= 0; row--) {
          const blockAbove = this.gridManager.getBlock(column, row);
          if (blockAbove) {
            blocksToLaunch.add(blockAbove);
          }
        }
      });

      // Also check for any moving blocks in affected columns
      const allBlocks = this.gridManager.getAllBlocks();
      allBlocks.forEach(block => {
        // Include any block in affected columns that's not already added
        if (affectedColumns.has(block.column) && !block.isInGrid) {
          blocksToLaunch.add(block);
        }
      });

      // Launch all blocks (matched + above + moving in same columns)
      blocksToLaunch.forEach(block => {
        // Remove block from grid if it's in the grid
        if (block.isInGrid) {
          this.gridManager.setBlock(block.column, block.row, null);
          block.isInGrid = false;
        }

        // Launch the block with velocity based on match size
        // Physics system will handle gravity and re-landing
        block.launch(matchResult.size);
      });

      return matchResult.blocks.length; // Return only matched blocks for score
    }

    return 0;
  }
}
