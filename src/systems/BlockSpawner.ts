import Phaser from 'phaser';
import { Block, BlockColor } from '../objects/Block';
import { ColumnManager } from './ColumnManager';
import type { LevelScene } from '../scenes/LevelScene';
import { DumpShapeGenerator, type DumpShape } from './DumpShapeGenerator';

export class BlockSpawner {
  private scene: LevelScene;
  private columnManager: ColumnManager;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  // Block dump configuration (static - not level-configurable)
  private static readonly WARNING_DURATION = 3000; // milliseconds (3 seconds warning)
  private static readonly RESUME_DELAY = 3000; // milliseconds (3 seconds delay before resuming regular spawning after dump)
  private dumpTimer: Phaser.Time.TimerEvent | null = null;
  private warningTimer: Phaser.Time.TimerEvent | null = null;
  private pendingDumpShape: DumpShape | null = null;

  // Level-specific configuration (instance properties)
  private spawnRate: number;
  private dumpInterval: number;

  constructor(scene: LevelScene, columnManager: ColumnManager, config?: { spawnRate?: number; dumpInterval?: number }) {
    this.scene = scene;
    this.columnManager = columnManager;

    // Set configuration with defaults
    this.spawnRate = config?.spawnRate ?? 1000;
    this.dumpInterval = config?.dumpInterval ?? 20000;
  }

  /**
   * Start spawning blocks
   */
  public start(): void {
    if (this.spawnTimer) {
      return; // Already spawning
    }

    this.spawnTimer = this.scene.time.addEvent({
      delay: this.spawnRate,
      callback: this.spawnBlock,
      callbackScope: this,
      loop: true,
    });

    // Start dump timer (generates random shapes every 10 seconds)
    if (!this.dumpTimer) {
      this.dumpTimer = this.scene.time.addEvent({
        delay: this.dumpInterval,
        callback: () => {
          const randomShape = DumpShapeGenerator.generateRandomShape();
          this.scheduleDump(randomShape);
        },
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

    // Spawn at the same height as dump blocks to ensure consistency
    const spawnY = -600;

    // Create block above grid with initial downward velocity
    // addBlock handles everything - creation, velocity, and tracking
    this.columnManager.addBlock(column, spawnY, color, 1000);
  }

  /**
   * Schedule a block dump with a 3-second warning
   * @param shape The dump shape to spawn
   */
  public scheduleDump(shape: DumpShape): void {
    if (this.warningTimer) {
      return; // Already have a dump pending
    }

    // Store dump shape
    this.pendingDumpShape = shape;

    // Pause regular block spawning during dump
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }

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
        if (this.pendingDumpShape) {
          this.executeDump(this.pendingDumpShape);
          this.pendingDumpShape = null;
        }
        this.warningTimer = null;

        // Resume regular block spawning after a delay (give dump blocks time to fall)
        this.scene.time.delayedCall(BlockSpawner.RESUME_DELAY, () => {
          if (this.spawnTimer) {
            this.spawnTimer.paused = false;
          }
        });
      },
      callbackScope: this,
      loop: false,
    });
  }

  /**
   * Execute the block dump - spawns grey blocks based on the provided shape
   * @param shape The dump shape defining column heights
   */
  private executeDump(shape: DumpShape): void {
    // Spawn blocks well above the screen to avoid collisions with existing blocks
    // The removal logic now checks velocity, so falling blocks won't be removed
    const baseY = -600;

    // For each column in the shape, create blocks according to the height
    for (let col = 0; col < shape.length; col++) {
      const height = shape[col];

      // Skip columns with no blocks
      if (height === 0) {
        continue;
      }

      // Create the column of blocks from top to bottom
      for (let row = 0; row < height; row++) {
        const yPos = baseY + (row * ColumnManager.ROW_HEIGHT);

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
