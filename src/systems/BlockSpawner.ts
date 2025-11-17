import Phaser from 'phaser';
import { Block, BlockColor } from '../objects/Block';
import { ColumnManager } from './ColumnManager';
import type { GameScene } from '../scenes/GameScene';

export class BlockSpawner {
  private scene: GameScene;
  private columnManager: ColumnManager;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  // Spawn configuration
  private static readonly SPAWN_RATE = 1000; // milliseconds (1 block per second)

  // Block dump configuration
  private static readonly DUMP_INTERVAL = 10000; // milliseconds (dump every 10 seconds)
  private static readonly WARNING_DURATION = 3000; // milliseconds (3 seconds warning)
  private dumpTimer: Phaser.Time.TimerEvent | null = null;
  private warningTimer: Phaser.Time.TimerEvent | null = null;
  private pendingDumpRows: number = 0;
  private pendingDumpCols: number = 0;

  constructor(scene: GameScene, columnManager: ColumnManager) {
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

    // Start dump timer (for testing: 9x2 dump every 10 seconds)
    if (!this.dumpTimer) {
      this.dumpTimer = this.scene.time.addEvent({
        delay: BlockSpawner.DUMP_INTERVAL,
        callback: () => this.scheduleDump(2, 9), // 2 rows x 9 columns
        callbackScope: this,
        loop: true,
      });
    }
  }

  /**
   * Stop spawning blocks
   */
  public stop(): void {
    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }

    // Stop dump timer
    if (this.dumpTimer) {
      this.dumpTimer.remove();
      this.dumpTimer = null;
    }

    // Stop warning timer if active
    if (this.warningTimer) {
      this.warningTimer.remove();
      this.warningTimer = null;
      this.scene.hideDumpWarning();
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
    this.columnManager.addBlock(column, spawnY, color, 1000);
  }

  /**
   * Schedule a block dump with a 3-second warning
   * @param rows Number of rows to dump
   * @param cols Number of columns to dump
   */
  public scheduleDump(rows: number, cols: number): void {
    if (this.warningTimer) {
      return; // Already have a dump pending
    }

    // Store dump dimensions
    this.pendingDumpRows = rows;
    this.pendingDumpCols = cols;

    // Show warning
    this.triggerWarning();
  }

  /**
   * Trigger the warning indicators and schedule the dump
   */
  private triggerWarning(): void {
    // Show warning indicators on screen
    this.scene.showDumpWarning();

    // Schedule the dump to execute after warning duration
    this.warningTimer = this.scene.time.addEvent({
      delay: BlockSpawner.WARNING_DURATION,
      callback: () => {
        this.scene.hideDumpWarning();
        this.executeDump(this.pendingDumpRows, this.pendingDumpCols);
        this.warningTimer = null;
      },
      callbackScope: this,
      loop: false,
    });
  }

  /**
   * Execute the block dump - spawns a grid of grey blocks
   * @param rows Number of rows to dump
   * @param cols Number of columns to dump
   */
  private executeDump(rows: number, cols: number): void {
    // Clamp cols to grid width
    const actualCols = Math.min(cols, ColumnManager.COLUMNS);

    // Spawn blocks well above the screen to avoid collisions with existing blocks
    // The removal logic now checks velocity, so falling blocks won't be removed
    // Stack rows from top to bottom with full row height spacing
    const startY = -600;

    // Create grey blocks in a grid pattern
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < actualCols; col++) {
        const yPos = startY + (row * ColumnManager.ROW_HEIGHT);

        // Add grey block with downward velocity
        this.columnManager.addBlock(col, yPos, BlockColor.GREY, 800);
      }
    }
  }

  /**
   * Destroy the spawner
   */
  public destroy(): void {
    this.stop();
  }
}
