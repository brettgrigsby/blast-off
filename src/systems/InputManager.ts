import Phaser from 'phaser';
import { Block } from '../objects/Block';
import { GridManager } from './GridManager';

export class InputManager {
  private scene: Phaser.Scene;
  private gridManager: GridManager;

  // Drag state
  private isDragging: boolean = false;
  private selectedBlock: Block | null = null;

  // Visual feedback
  private selectionGraphics: Phaser.GameObjects.Graphics;

  // Callback for when a swap occurs
  private onSwapCallback?: () => void;

  constructor(scene: Phaser.Scene, gridManager: GridManager, onSwapCallback?: () => void) {
    this.scene = scene;
    this.gridManager = gridManager;
    this.onSwapCallback = onSwapCallback;

    // Create graphics for selection highlight
    this.selectionGraphics = scene.add.graphics();
    this.selectionGraphics.setDepth(999); // Above blocks but below UI

    // Set up input listeners
    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    // Pointer down - start dragging
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    // Pointer move - dragging
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerMove(pointer);
    });

    // Pointer up - stop dragging
    this.scene.input.on('pointerup', () => {
      this.handlePointerUp();
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Find which block was clicked
    const clickedBlock = this.getBlockAtPosition(pointer.x, pointer.y);

    if (clickedBlock && clickedBlock.isInGrid) {
      // Only allow dragging blocks that are in the grid (not falling)
      this.isDragging = true;
      this.selectedBlock = clickedBlock;

      // Draw selection highlight
      this.drawSelectionHighlight(clickedBlock);
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.selectedBlock) {
      return;
    }

    // Get the grid position where the pointer currently is
    const pointerGridPos = this.gridManager.pixelToGrid(pointer.x, pointer.y);
    const pointerRow = pointerGridPos.row;
    const selectedRow = this.selectedBlock.row;
    const selectedColumn = this.selectedBlock.column;

    // Check if pointer is in the same column as the selected block
    if (pointerGridPos.column !== selectedColumn) {
      return; // Can only drag within the same column
    }

    // Check if pointer is in an adjacent row
    const rowDifference = pointerRow - selectedRow;
    if (Math.abs(rowDifference) !== 1) {
      return; // Not in an adjacent row
    }

    // Check if the target row is within grid bounds
    const adjacentRow = pointerRow;
    if (!this.gridManager.isInBounds(selectedColumn, adjacentRow)) {
      return; // Can't swap outside grid bounds
    }

    // Calculate the position of the boundary between the selected block and adjacent block
    const boundaryY = this.gridManager.gridToPixel(selectedColumn, adjacentRow).y -
                      (rowDifference > 0 ? GridManager.ROW_HEIGHT / 2 : -GridManager.ROW_HEIGHT / 2);

    // Check if we've crossed the halfway threshold
    const crossedThreshold = rowDifference > 0
      ? pointer.y >= boundaryY  // Dragging down
      : pointer.y <= boundaryY; // Dragging up

    if (crossedThreshold && this.canSwap(this.selectedBlock, adjacentRow)) {
      this.swapBlocks(this.selectedBlock, adjacentRow);

      // Update selection highlight
      this.drawSelectionHighlight(this.selectedBlock);

      // Trigger callback (for match detection)
      if (this.onSwapCallback) {
        this.onSwapCallback();
      }
    }
  }

  private handlePointerUp(): void {
    if (!this.isDragging) {
      return;
    }

    // Stop dragging
    this.isDragging = false;
    this.selectedBlock = null;

    // Clear selection highlight
    this.selectionGraphics.clear();
  }

  private getBlockAtPosition(x: number, y: number): Block | null {
    // Convert pixel position to grid position
    const gridPos = this.gridManager.pixelToGrid(x, y);

    // Get block at that grid position
    return this.gridManager.getBlock(gridPos.column, gridPos.row);
  }

  private canSwap(block: Block, targetRow: number): boolean {
    // Check if target row is within bounds
    if (!this.gridManager.isInBounds(block.column, targetRow)) {
      return false;
    }

    // Check if target row is adjacent to current row (can only swap with neighbors)
    const rowDifference = Math.abs(targetRow - block.row);
    if (rowDifference !== 1) {
      return false;
    }

    // Check if there's actually a block at the target position
    // We can only swap with another block, not move into empty space
    const targetBlock = this.gridManager.getBlock(block.column, targetRow);
    if (!targetBlock) {
      return false;
    }

    // Only allow swapping with blocks that are also at rest in the grid (not moving/falling)
    if (!targetBlock.isInGrid) {
      return false;
    }

    return true;
  }

  private swapBlocks(block: Block, targetRow: number): void {
    const currentRow = block.row;
    const column = block.column;

    // Get the block at the target position (might be null)
    const targetBlock = this.gridManager.getBlock(column, targetRow);

    // Get pixel positions for both grid locations
    const blockTargetPos = this.gridManager.gridToPixel(column, targetRow);
    const targetBlockPos = this.gridManager.gridToPixel(column, currentRow);

    // Update grid positions
    this.gridManager.setBlock(column, currentRow, targetBlock);
    this.gridManager.setBlock(column, targetRow, block);

    // Update the selected block's position and grid coordinates
    block.setGridPosition(column, targetRow);
    block.setPosition(blockTargetPos.x, blockTargetPos.y);

    // If there was a block at the target, swap it to the current position
    if (targetBlock) {
      targetBlock.setGridPosition(column, currentRow);
      targetBlock.setPosition(targetBlockPos.x, targetBlockPos.y);
    }
  }

  private drawSelectionHighlight(block: Block): void {
    this.selectionGraphics.clear();

    // Draw a glowing border around the selected block
    this.selectionGraphics.lineStyle(4, 0xffffff, 1);
    this.selectionGraphics.strokeRect(
      block.x - GridManager.ROW_HEIGHT / 2,
      block.y - GridManager.ROW_HEIGHT / 2,
      GridManager.COLUMN_WIDTH,
      GridManager.ROW_HEIGHT
    );

    // Add a subtle glow effect
    this.selectionGraphics.lineStyle(2, 0xffffff, 0.5);
    this.selectionGraphics.strokeRect(
      block.x - GridManager.ROW_HEIGHT / 2 - 2,
      block.y - GridManager.ROW_HEIGHT / 2 - 2,
      GridManager.COLUMN_WIDTH + 4,
      GridManager.ROW_HEIGHT + 4
    );
  }

  /**
   * Enable or disable input (useful for game over, etc.)
   */
  public setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.handlePointerUp(); // Release any current drag
    }
    this.scene.input.enabled = enabled;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.selectionGraphics.destroy();
  }
}
