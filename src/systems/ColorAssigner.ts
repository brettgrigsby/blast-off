import { Block, BlockColor, PLAYABLE_COLORS } from '../objects/Block';
import { ColumnManager } from './ColumnManager';

/**
 * ColorAssigner - Intelligently assigns colors to grey blocks to avoid immediate matches
 *
 * This system analyzes the game board and assigns colors to recovering grey blocks
 * in a way that minimizes immediate match creation.
 */
export class ColorAssigner {
  private columnManager: ColumnManager;

  constructor(columnManager: ColumnManager) {
    this.columnManager = columnManager;
  }

  /**
   * Check if placing a specific color at a position would create a match (3+ consecutive)
   * @param column Column index (0-8)
   * @param row Row index (0-11)
   * @param color Color to test
   * @returns true if placing this color would create a match
   */
  public wouldCreateMatch(column: number, row: number, color: BlockColor): boolean {
    // Check horizontal match
    if (this.wouldCreateHorizontalMatch(column, row, color)) {
      return true;
    }

    // Check vertical match
    if (this.wouldCreateVerticalMatch(column, row, color)) {
      return true;
    }

    return false;
  }

  /**
   * Check if placing a color would create a horizontal match
   */
  private wouldCreateHorizontalMatch(column: number, row: number, color: BlockColor): boolean {
    const rowBlocks = this.columnManager.getRow(row);

    let leftCount = 0;
    let rightCount = 0;

    // Count consecutive same-colored blocks to the left
    for (let i = column - 1; i >= 0; i--) {
      const block = rowBlocks[i];
      if (block && block.color === color && !block.isGrey()) {
        leftCount++;
      } else {
        break;
      }
    }

    // Count consecutive same-colored blocks to the right
    for (let i = column + 1; i < ColumnManager.COLUMNS; i++) {
      const block = rowBlocks[i];
      if (block && block.color === color && !block.isGrey()) {
        rightCount++;
      } else {
        break;
      }
    }

    // Total consecutive blocks including the test position
    const totalConsecutive = leftCount + 1 + rightCount;
    return totalConsecutive >= 3;
  }

  /**
   * Check if placing a color would create a vertical match
   */
  private wouldCreateVerticalMatch(column: number, row: number, color: BlockColor): boolean {
    const columnObj = this.columnManager.getColumn(column);
    if (!columnObj) return false;

    const blocksAtRest = columnObj.getBlocksAtRest();

    // Sort blocks by row (Y position)
    const sortedBlocks = [...blocksAtRest].sort((a, b) => b.row - a.row);

    let aboveCount = 0;
    let belowCount = 0;

    // Count consecutive same-colored blocks above
    for (const block of sortedBlocks) {
      if (block.row < row) {
        if (block.color === color && !block.isGrey()) {
          // Check if blocks are adjacent (consecutive rows)
          const expectedRow = row - aboveCount - 1;
          if (block.row === expectedRow) {
            aboveCount++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }

    // Count consecutive same-colored blocks below
    for (const block of sortedBlocks) {
      if (block.row > row) {
        if (block.color === color && !block.isGrey()) {
          // Check if blocks are adjacent (consecutive rows)
          const expectedRow = row + belowCount + 1;
          if (block.row === expectedRow) {
            belowCount++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }

    // Total consecutive blocks including the test position
    const totalConsecutive = aboveCount + 1 + belowCount;
    return totalConsecutive >= 3;
  }

  /**
   * Get list of colors that won't create a match at this position
   * @param column Column index
   * @param row Row index
   * @returns Array of safe colors (may be empty if all colors create matches)
   */
  public getSafeColors(column: number, row: number): BlockColor[] {
    const safeColors: BlockColor[] = [];

    for (const color of PLAYABLE_COLORS) {
      if (!this.wouldCreateMatch(column, row, color)) {
        safeColors.push(color);
      }
    }

    return safeColors;
  }

  /**
   * Batch assign colors to multiple grey blocks intelligently
   * Assigns colors that avoid immediate matches, considering previously assigned colors
   * @param greyBlocks Array of grey blocks to assign colors to
   */
  public assignColorsToBlocks(greyBlocks: Block[]): void {
    // Process blocks one at a time so earlier assignments affect later ones
    for (const block of greyBlocks) {
      // Get colors that won't create a match at this position
      const safeColors = this.getSafeColors(block.column, block.row);

      let newColor: BlockColor;

      if (safeColors.length > 0) {
        // Pick random color from safe options
        const randomIndex = Math.floor(Math.random() * safeColors.length);
        newColor = safeColors[randomIndex];
      } else {
        // Edge case: all colors would create a match
        // Pick random color anyway (user preference: accept cascade)
        newColor = Block.getRandomColor();
      }

      // Assign the color (this affects subsequent getSafeColors calls)
      block.setColor(newColor);
    }
  }
}
