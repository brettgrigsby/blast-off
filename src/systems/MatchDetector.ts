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

      // Add matched blocks and find all blocks above them
      matchResult.blocks.forEach(matchedBlock => {
        // Convert matched block to grey
        matchedBlock.setColor(BlockColor.GREY);
        blocksToLaunch.add(matchedBlock);

        // Find all blocks above this matched block in the same column
        const column = matchedBlock.column;
        for (let row = matchedBlock.row - 1; row >= 0; row--) {
          const blockAbove = this.gridManager.getBlock(column, row);
          if (blockAbove) {
            blocksToLaunch.add(blockAbove);
          }
        }
      });

      // Launch all blocks (matched + above)
      blocksToLaunch.forEach(block => {
        // Remove block from grid so it becomes a "launching" block
        this.gridManager.setBlock(block.column, block.row, null);

        // Launch the block with velocity based on match size
        block.launch(matchResult.size);
      });

      return matchResult.blocks.length; // Return only matched blocks for score
    }

    return 0;
  }
}
