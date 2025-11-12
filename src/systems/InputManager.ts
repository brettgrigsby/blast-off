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

    if (clickedBlock) {
      // Allow dragging blocks in grid OR blocks in a group (Iteration 6)
      const blockGroup = this.gridManager.getBlockGroup(clickedBlock);
      if (clickedBlock.isInGrid || blockGroup) {
        this.isDragging = true;
        this.selectedBlock = clickedBlock;

        // Draw selection highlight
        this.drawSelectionHighlight(clickedBlock);
      }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.selectedBlock) {
      return;
    }

    // Check if the selected block is still valid for dragging
    // Allow dragging if in grid OR in a group (Iteration 6)
    const blockGroup = this.gridManager.getBlockGroup(this.selectedBlock);
    if (!this.selectedBlock.isInGrid && !blockGroup) {
      this.handlePointerUp();
      return;
    }

    // Check if pointer is in the same column (using world x coordinates)
    const COLUMN_TOLERANCE = GridManager.COLUMN_WIDTH * 0.6;
    const xDistance = Math.abs(pointer.x - this.selectedBlock.x);
    if (xDistance > COLUMN_TOLERANCE) {
      return; // Can only drag within the same column
    }

    // Determine drag direction based on world coordinates
    const yDifference = pointer.y - this.selectedBlock.y;
    if (Math.abs(yDifference) < GridManager.ROW_HEIGHT * 0.2) {
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

      // Update selection highlight
      this.drawSelectionHighlight(this.selectedBlock);
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

    // First check if there's a block in the grid at this position
    const gridBlock = this.gridManager.getBlock(gridPos.column, gridPos.row);
    if (gridBlock) {
      return gridBlock;
    }

    // Also check all blocks (including those in groups) by actual position
    const allBlocks = this.gridManager.getAllBlocks();
    const BLOCK_SIZE = 80; // GridManager.ROW_HEIGHT

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
    const allBlocks = this.gridManager.getAllBlocks();
    const blockGroup = this.gridManager.getBlockGroup(block);
    const ADJACENCY_THRESHOLD = GridManager.ROW_HEIGHT * 1.2; // Allow some tolerance
    const COLUMN_TOLERANCE = GridManager.COLUMN_WIDTH * 0.3; // Blocks must be in roughly the same column

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
        const otherBlockGroup = this.gridManager.getBlockGroup(otherBlock);
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
    const ADJACENCY_THRESHOLD = GridManager.ROW_HEIGHT * 1.3;

    if (yDistance > ADJACENCY_THRESHOLD) {
      return false; // Not adjacent
    }

    // Check if blocks are in roughly the same column (using world coordinates)
    const xDistance = Math.abs(targetBlock.x - block.x);
    const COLUMN_TOLERANCE = GridManager.COLUMN_WIDTH * 0.4;

    if (xDistance > COLUMN_TOLERANCE) {
      return false; // Not in same column
    }

    // Allow swapping with blocks in grid OR blocks in the same group (Iteration 6)
    const selectedBlockGroup = this.gridManager.getBlockGroup(block);
    const targetBlockGroup = this.gridManager.getBlockGroup(targetBlock);

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

    // Check if blocks are in a group
    const blockGroup = this.gridManager.getBlockGroup(block);

    // Store current positions for swapping
    const blockTargetX = targetBlock.x;
    const blockTargetY = targetBlock.y;
    const targetBlockX = block.x;
    const targetBlockY = block.y;

    if (blockGroup) {
      // Swapping within a group - just swap positions, don't touch grid
      block.setGridPosition(targetColumn, targetRow);
      block.setPosition(blockTargetX, blockTargetY);

      targetBlock.setGridPosition(currentColumn, currentRow);
      targetBlock.setPosition(targetBlockX, targetBlockY);
    } else {
      // Normal swap in grid - use grid positions
      const blockTargetPos = this.gridManager.gridToPixel(currentColumn, targetRow);
      const targetBlockPos = this.gridManager.gridToPixel(currentColumn, currentRow);

      this.gridManager.setBlock(currentColumn, currentRow, targetBlock);
      this.gridManager.setBlock(currentColumn, targetRow, block);

      // Update the selected block's position and grid coordinates
      block.setGridPosition(currentColumn, targetRow);
      block.setPosition(blockTargetPos.x, blockTargetPos.y);

      // Update target block to the current position
      targetBlock.setGridPosition(currentColumn, currentRow);
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
   * Cancel the current drag operation (e.g., when a match is made)
   */
  public cancelDrag(): void {
    this.handlePointerUp();
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
