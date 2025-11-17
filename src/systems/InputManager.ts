import Phaser from 'phaser';
import { Block } from '../objects/Block';
import { ColumnManager } from './ColumnManager';

export class InputManager {
  private scene: Phaser.Scene;
  private columnManager: ColumnManager;

  // Drag state
  private isDragging: boolean = false;
  private selectedBlock: Block | null = null;

  // Input enabled state
  private enabled: boolean = true;

  // Callback for when a swap occurs
  private onSwapCallback?: () => void;

  constructor(scene: Phaser.Scene, columnManager: ColumnManager, onSwapCallback?: () => void) {
    this.scene = scene;
    this.columnManager = columnManager;
    this.onSwapCallback = onSwapCallback;

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
    if (!this.enabled) return;

    // Find which block was clicked
    const clickedBlock = this.getBlockAtPosition(pointer.x, pointer.y);

    if (clickedBlock) {
      // Allow dragging blocks in grid OR blocks in a group (Iteration 6)
      const blockGroup = this.columnManager.getBlockGroup(clickedBlock);
      if (clickedBlock.isInGrid || blockGroup) {
        this.isDragging = true;
        this.selectedBlock = clickedBlock;

        // Mark block as selected (it will render with highlight)
        clickedBlock.setSelected(true);
      }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.selectedBlock) {
      return;
    }

    // Check if the selected block is still valid for dragging
    // Allow dragging if in grid OR in a group (Iteration 6)
    const blockGroup = this.columnManager.getBlockGroup(this.selectedBlock);
    if (!this.selectedBlock.isInGrid && !blockGroup) {
      this.handlePointerUp();
      return;
    }

    // Check if pointer is in the same column (using world x coordinates)
    const COLUMN_TOLERANCE = ColumnManager.COLUMN_WIDTH * 0.6;
    const xDistance = Math.abs(pointer.x - this.selectedBlock.x);
    if (xDistance > COLUMN_TOLERANCE) {
      return; // Can only drag within the same column
    }

    // Determine drag direction based on world coordinates
    const yDifference = pointer.y - this.selectedBlock.y;
    if (Math.abs(yDifference) < ColumnManager.ROW_HEIGHT * 0.2) {
      return; // Not dragging far enough yet
    }

    const direction: 1 | -1 = yDifference > 0 ? 1 : -1; // 1 = down, -1 = up

    // Find physically adjacent block in the drag direction
    const adjacentBlock = this.findAdjacentBlock(this.selectedBlock, direction);
    if (!adjacentBlock) {
      return; // No adjacent block found
    }

    // Calculate the halfway point between the blocks
    const halfwayY = (this.selectedBlock.y + adjacentBlock.y) / 2;

    // Check if we've crossed the halfway threshold
    const crossedThreshold = direction > 0
      ? pointer.y >= halfwayY  // Dragging down
      : pointer.y <= halfwayY; // Dragging up

    if (crossedThreshold && this.canSwap(this.selectedBlock, adjacentBlock)) {
      this.swapBlocks(this.selectedBlock, adjacentBlock);

      // Trigger callback (for match detection)
      if (this.onSwapCallback) {
        this.onSwapCallback();
      }

      // Check if the block is still in the grid after the callback
      // (it might have been launched by a match)
      if (!this.selectedBlock.isInGrid) {
        this.handlePointerUp();
        return;
      }
    }
  }

  private handlePointerUp(): void {
    if (!this.isDragging) {
      return;
    }

    // Clear selection from the block
    if (this.selectedBlock) {
      this.selectedBlock.setSelected(false);
    }

    // Stop dragging
    this.isDragging = false;
    this.selectedBlock = null;
  }

  private getBlockAtPosition(x: number, y: number): Block | null {
    // Convert pixel position to grid position
    const gridPos = this.columnManager.pixelToGrid(x, y);

    // First check if there's a block in the grid at this position
    const gridBlock = this.columnManager.getBlock(gridPos.column, gridPos.row);
    if (gridBlock) {
      return gridBlock;
    }

    // Also check all blocks (including those in groups) by actual position
    const allBlocks = this.columnManager.getAllBlocks();
    const BLOCK_SIZE = 80; // ColumnManager.ROW_HEIGHT

    for (const block of allBlocks) {
      // Check if click is within this block's bounds
      const halfSize = BLOCK_SIZE / 2;
      if (
        x >= block.x - halfSize &&
        x <= block.x + halfSize &&
        y >= block.y - halfSize &&
        y <= block.y + halfSize
      ) {
        return block;
      }
    }

    return null;
  }

  /**
   * Find a block that is physically adjacent to the given block in the specified direction.
   * Uses actual world coordinates instead of grid positions.
   * @param block The source block
   * @param direction 1 for down, -1 for up
   * @returns The adjacent block in that direction, or null if none found
   */
  private findAdjacentBlock(block: Block, direction: 1 | -1): Block | null {
    const allBlocks = this.columnManager.getAllBlocks();
    const blockGroup = this.columnManager.getBlockGroup(block);
    const ADJACENCY_THRESHOLD = ColumnManager.ROW_HEIGHT * 1.2; // Allow some tolerance
    const COLUMN_TOLERANCE = ColumnManager.COLUMN_WIDTH * 0.3; // Blocks must be in roughly the same column

    let closestBlock: Block | null = null;
    let closestDistance = Infinity;

    for (const otherBlock of allBlocks) {
      // Skip the source block itself
      if (otherBlock === block) {
        continue;
      }

      // Check if blocks are in the same column (using world x coordinates)
      const xDistance = Math.abs(otherBlock.x - block.x);
      if (xDistance > COLUMN_TOLERANCE) {
        continue;
      }

      // Calculate vertical distance
      const yDistance = otherBlock.y - block.y;

      // Check if block is in the correct direction
      if (direction === 1 && yDistance <= 0) {
        continue; // Looking down, but other block is above
      }
      if (direction === -1 && yDistance >= 0) {
        continue; // Looking up, but other block is below
      }

      // Check if within adjacency threshold
      const distance = Math.abs(yDistance);
      if (distance > ADJACENCY_THRESHOLD) {
        continue;
      }

      // If blocks are in a group, they must be in the same group
      if (blockGroup) {
        const otherBlockGroup = this.columnManager.getBlockGroup(otherBlock);
        if (otherBlockGroup !== blockGroup) {
          continue;
        }
      }

      // Track the closest block in the direction
      if (distance < closestDistance) {
        closestDistance = distance;
        closestBlock = otherBlock;
      }
    }

    return closestBlock;
  }

  private canSwap(block: Block, targetBlock: Block): boolean {
    // Check if blocks are physically adjacent (using world coordinates)
    const yDistance = Math.abs(targetBlock.y - block.y);
    const ADJACENCY_THRESHOLD = ColumnManager.ROW_HEIGHT * 1.3;

    if (yDistance > ADJACENCY_THRESHOLD) {
      return false; // Not adjacent
    }

    // Check if blocks are in roughly the same column (using world coordinates)
    const xDistance = Math.abs(targetBlock.x - block.x);
    const COLUMN_TOLERANCE = ColumnManager.COLUMN_WIDTH * 0.4;

    if (xDistance > COLUMN_TOLERANCE) {
      return false; // Not in same column
    }

    // Allow swapping with blocks in grid OR blocks in the same group (Iteration 6)
    const selectedBlockGroup = this.columnManager.getBlockGroup(block);
    const targetBlockGroup = this.columnManager.getBlockGroup(targetBlock);

    // If both blocks are in the same group, allow swap
    if (selectedBlockGroup && selectedBlockGroup === targetBlockGroup) {
      return true;
    }

    // Otherwise, only allow swapping with blocks at rest in the grid
    if (!targetBlock.isInGrid) {
      return false;
    }

    return true;
  }

  private swapBlocks(block: Block, targetBlock: Block): void {
    const currentRow = block.row;
    const currentColumn = block.column;
    const targetRow = targetBlock.row;
    const targetColumn = targetBlock.column;

    // Store current positions for swapping
    const blockTargetX = targetBlock.x;
    const blockTargetY = targetBlock.y;
    const targetBlockX = block.x;
    const targetBlockY = block.y;

    // Remove blocks from columns before changing positions
    this.columnManager.removeBlockFromColumn(block);
    this.columnManager.removeBlockFromColumn(targetBlock);

    // Swap positions
    block.setGridPosition(targetColumn, targetRow);
    block.setPosition(blockTargetX, blockTargetY);

    targetBlock.setGridPosition(currentColumn, currentRow);
    targetBlock.setPosition(targetBlockX, targetBlockY);

    // Re-add blocks to columns so they get sorted by new Y position
    this.columnManager.addBlockToColumn(block);
    this.columnManager.addBlockToColumn(targetBlock);

    // Zero out velocities after swap to ensure clean match detection
    block.setVelocity(0);
    targetBlock.setVelocity(0);
  }

  /**
   * Cancel the current drag operation (e.g., when a match is made)
   */
  public cancelDrag(): void {
    this.handlePointerUp();
  }

  /**
   * Enable or disable input (useful for game over, pause, etc.)
   */
  public setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.handlePointerUp(); // Release any current drag
    }
    this.enabled = enabled;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    // No resources to clean up
  }
}
