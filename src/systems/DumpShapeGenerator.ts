import { ColumnManager } from './ColumnManager';

/**
 * Represents a block dump shape.
 * Array where index is the column number (0-8) and value is the height (number of blocks).
 * A value of 0 means no blocks in that column.
 */
export type DumpShape = number[];

/**
 * Generates random block dump shapes
 */
export class DumpShapeGenerator {
  /**
   * Generate a random dump shape with varying column heights
   * @returns Array of heights for each column (0 = no blocks)
   */
  public static generateRandomShape(): DumpShape {
    // Initialize all columns with 0 blocks
    const shape: DumpShape = new Array(ColumnManager.COLUMNS).fill(0);

    // Decide how many columns will get blocks (between 4 and 9)
    const numColumnsWithBlocks = Math.floor(Math.random() * 6) + 4; // 4-9 columns

    // Randomly select which columns get blocks
    const allColumnIndices = Array.from({ length: ColumnManager.COLUMNS }, (_, i) => i);
    const selectedColumns: number[] = [];

    // Shuffle and pick first N columns
    for (let i = 0; i < numColumnsWithBlocks; i++) {
      const randomIndex = Math.floor(Math.random() * allColumnIndices.length);
      selectedColumns.push(allColumnIndices[randomIndex]);
      allColumnIndices.splice(randomIndex, 1);
    }

    // Assign random heights to selected columns
    for (const col of selectedColumns) {
      // Random height between 1 and 4 blocks
      shape[col] = Math.floor(Math.random() * 4) + 1; // 1-4 blocks
    }

    return shape;
  }

  /**
   * Generate a fixed rectangular shape (for testing)
   * @param rows Number of rows
   * @param cols Number of columns
   * @returns Array of heights for each column
   */
  public static generateRectangle(rows: number, cols: number): DumpShape {
    const shape: DumpShape = new Array(ColumnManager.COLUMNS).fill(0);
    const actualCols = Math.min(cols, ColumnManager.COLUMNS);

    // Set first N columns to the specified height
    for (let i = 0; i < actualCols; i++) {
      shape[i] = rows;
    }

    return shape;
  }

  /**
   * Generate a dump shape with a target number of blocks
   * Distributes blocks randomly across columns while aiming for the target count
   * @param targetCount Target number of total blocks
   * @returns Array of heights for each column
   */
  public static generateShapeWithTargetCount(targetCount: number): DumpShape {
    // Initialize all columns with 0 blocks
    const shape: DumpShape = new Array(ColumnManager.COLUMNS).fill(0);

    // Ensure at least 1 block
    const actualTarget = Math.max(1, Math.floor(targetCount));

    // Decide how many columns will get blocks (between 4 and 9)
    const numColumnsWithBlocks = Math.min(
      Math.floor(Math.random() * 6) + 4, // 4-9 columns
      actualTarget // Can't have more columns than blocks
    );

    // Randomly select which columns get blocks
    const allColumnIndices = Array.from({ length: ColumnManager.COLUMNS }, (_, i) => i);
    const selectedColumns: number[] = [];

    // Shuffle and pick first N columns
    for (let i = 0; i < numColumnsWithBlocks; i++) {
      const randomIndex = Math.floor(Math.random() * allColumnIndices.length);
      selectedColumns.push(allColumnIndices[randomIndex]);
      allColumnIndices.splice(randomIndex, 1);
    }

    // Distribute target blocks across selected columns
    let remainingBlocks = actualTarget;

    // Assign blocks to each column (at least 1 per selected column)
    selectedColumns.forEach((col, index) => {
      if (index === selectedColumns.length - 1) {
        // Last column gets all remaining blocks
        shape[col] = remainingBlocks;
      } else {
        // Random distribution, but ensure we leave enough for other columns
        const minForThisColumn = 1;
        const maxForThisColumn = Math.min(
          6, // Cap at 6 blocks per column for visual balance
          remainingBlocks - (selectedColumns.length - index - 1) // Leave at least 1 for each remaining column
        );
        const blocksForThisColumn = Math.floor(Math.random() * (maxForThisColumn - minForThisColumn + 1)) + minForThisColumn;
        shape[col] = blocksForThisColumn;
        remainingBlocks -= blocksForThisColumn;
      }
    });

    return shape;
  }

  /**
   * Calculate the total number of blocks in a dump shape
   * @param shape The dump shape
   * @returns Total number of blocks
   */
  public static getTotalBlocks(shape: DumpShape): number {
    return shape.reduce((sum, height) => sum + height, 0);
  }
}
