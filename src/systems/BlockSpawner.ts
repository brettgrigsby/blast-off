import Phaser from 'phaser';
import { Block } from '../objects/Block';
import { GridManager } from './GridManager';

export class BlockSpawner {
  private scene: Phaser.Scene;
  private gridManager: GridManager;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  // Spawn configuration
  private static readonly SPAWN_RATE = 1000; // milliseconds (1 block per second)
  private static readonly SPAWN_ROW = -1; // Start above the visible grid

  constructor(scene: Phaser.Scene, gridManager: GridManager) {
    this.scene = scene;
    this.gridManager = gridManager;
  }

  /**
   * Start spawning blocks
   */
  public start(): void {
    if (this.spawnTimer) {
      return; // Already spawning
    }

    this.spawnTimer = this.scene.time.addEvent({
      delay: BlockSpawner.SPAWN_RATE,
      callback: this.spawnBlock,
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * Stop spawning blocks
   */
  public stop(): void {
    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }
  }

  /**
   * Spawn a new block at the top of a random column
   */
  private spawnBlock(): void {
    // Random column selection
    const column = Math.floor(Math.random() * GridManager.COLUMNS);

    // Random color
    const color = Block.getRandomColor();

    // Get pixel position at top of column (above visible grid)
    const { x } = this.gridManager.gridToPixel(column, BlockSpawner.SPAWN_ROW);
    const y = GridManager.GRID_OFFSET_Y + BlockSpawner.SPAWN_ROW * GridManager.ROW_HEIGHT + GridManager.ROW_HEIGHT / 2;

    // Create the block (not in grid yet, it's falling)
    const block = new Block(this.scene, column, BlockSpawner.SPAWN_ROW, x, y, color);

    // Set initial downward velocity (1000 pixels/second)
    block.setVelocity(0, 1000);
    block.isInGrid = false;

    // Add to falling blocks in grid manager
    this.gridManager.addFallingBlock(block);
  }

  /**
   * Destroy the spawner
   */
  public destroy(): void {
    this.stop();
  }
}
