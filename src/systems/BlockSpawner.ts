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

    // Create block above grid with initial downward velocity
    // addBlock handles everything - creation, velocity, and tracking
    this.gridManager.addBlock(column, BlockSpawner.SPAWN_ROW, color, { x: 0, y: 1000 });
  }

  /**
   * Destroy the spawner
   */
  public destroy(): void {
    this.stop();
  }
}
