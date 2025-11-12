import Phaser from 'phaser';
import { Block } from '../objects/Block';
import { ColumnManager } from './ColumnManager';

export class BlockSpawner {
  private scene: Phaser.Scene;
  private columnManager: ColumnManager;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  // Spawn configuration
  private static readonly SPAWN_RATE = 1000; // milliseconds (1 block per second)

  constructor(scene: Phaser.Scene, columnManager: ColumnManager) {
    this.scene = scene;
    this.columnManager = columnManager;
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
    const column = Math.floor(Math.random() * ColumnManager.COLUMNS);

    // Random color
    const color = Block.getRandomColor();

    // Calculate Y position above the grid (one block height above grid offset)
    const spawnY = ColumnManager.GRID_OFFSET_Y - ColumnManager.ROW_HEIGHT;

    // Create block above grid with initial downward velocity
    // addBlock handles everything - creation, velocity, and tracking
    this.columnManager.addBlock(column, spawnY, color, { x: 0, y: 1000 });
  }

  /**
   * Destroy the spawner
   */
  public destroy(): void {
    this.stop();
  }
}
