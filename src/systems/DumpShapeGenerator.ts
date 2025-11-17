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
   * Calculate the total number of blocks in a dump shape
   * @param shape The dump shape
   * @returns Total number of blocks
   */
  public static getTotalBlocks(shape: DumpShape): number {
    return shape.reduce((sum, height) => sum + height, 0);
  }
}
