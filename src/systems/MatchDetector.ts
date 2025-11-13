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

      // Collect ALL blocks from ALL columns into a single group
      // All blocks launched from one match should move as one rigid unit
      const allLaunchedBlocks: Block[] = [];
      columnBlocks.forEach((blocksInColumn) => {
        blocksInColumn.forEach(block => {
          allLaunchedBlocks.push(block);
        });
      });

      // Check if any of these blocks are already in a group
      const existingGroup = this.findExistingGroup(allLaunchedBlocks);

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
      // Apply 100% bonus velocity since the group is in motion
      const launchVelocity = this.getLaunchVelocity(matchedBlocks.size, true);
      group.addVelocity(launchVelocity);

      return matchedBlocks.size;
    }

    return 0;
  }

  /**
   * Detect horizontal matches in a set of blocks using physical positions
   */
  private detectHorizontalMatchesInBlocks(blocks: Block[], matchedBlocks: Set<Block>): void {
    // Group blocks by row (based on physical Y position)
    const rowMap = new Map<number, Block[]>();
    const ROW_HEIGHT = ColumnManager.ROW_HEIGHT;
    const ROW_TOLERANCE = ROW_HEIGHT / 4; // 25% tolerance for row alignment

    blocks.forEach(block => {
      if (block.isGrey()) return;

      // Round Y position to nearest row
      const rowIndex = Math.round(block.y / ROW_HEIGHT);
      const rowY = rowIndex * ROW_HEIGHT;

      // Check if block is close enough to this row
      if (Math.abs(block.y - rowY) <= ROW_TOLERANCE) {
        if (!rowMap.has(rowIndex)) {
          rowMap.set(rowIndex, []);
        }
        rowMap.get(rowIndex)!.push(block);
      }
    });

    // Check each row for matches
    rowMap.forEach(rowBlocks => {
      // Sort by X position (column)
      rowBlocks.sort((a, b) => a.column - b.column);

      let currentColor: BlockColor | null = null;
      let consecutiveBlocks: Block[] = [];

      rowBlocks.forEach((block, index) => {
        if (block.isGrey()) {
          if (consecutiveBlocks.length >= 3) {
            consecutiveBlocks.forEach(b => matchedBlocks.add(b));
          }
          currentColor = null;
          consecutiveBlocks = [];
          return;
        }

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
   * @param isGroupInMotion - If true, applies 100% bonus velocity
   */
  private getLaunchVelocity(matchSize: number, isGroupInMotion: boolean = false): number {
    const baseVelocity = matchSize * -300;
    return isGroupInMotion ? baseVelocity * 2.0 : baseVelocity;
  }
}
