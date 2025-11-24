import Phaser from 'phaser';
import { Block, BlockColor } from '../objects/Block';
import { ColumnManager } from './ColumnManager';
import type { LevelScene } from '../scenes/LevelScene';
import { DumpShapeGenerator, type DumpShape } from './DumpShapeGenerator';
import type { LevelConfig } from '../config/LevelConfig';
import { calculateRampedValue } from '../config/LevelConfig';

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
  private levelConfig: LevelConfig;
  private gameStartTime: number | null = null;

  // LFG mode configuration
  private isLFGMode: boolean = false;
  private baseSpawnRate: number;
  private currentSpawnRate: number;
  private hapticCallback: (() => void) | null = null;
  private lastLFGSpawnTime: number = 0;

  constructor(scene: LevelScene, columnManager: ColumnManager, levelConfig: LevelConfig) {
    this.scene = scene;
    this.columnManager = columnManager;
    this.levelConfig = levelConfig;

    // Set initial configuration
    this.spawnRate = levelConfig.spawnRate;
    this.dumpInterval = levelConfig.dumpInterval;
    this.baseSpawnRate = this.spawnRate;
    this.currentSpawnRate = this.spawnRate;
  }

  /**
   * Get the current spawn rate accounting for difficulty ramping
   */
  private getRampedSpawnRate(): number {
    if (!this.levelConfig.spawnRateRamp || this.gameStartTime === null) {
      return this.levelConfig.spawnRate;
    }

    const elapsedMs = this.scene.time.now - this.gameStartTime;
    return calculateRampedValue(this.levelConfig.spawnRateRamp, elapsedMs);
  }

  /**
   * Get the current dump interval accounting for difficulty ramping
   */
  private getRampedDumpInterval(): number {
    if (!this.levelConfig.dumpIntervalRamp || this.gameStartTime === null) {
      return this.levelConfig.dumpInterval;
    }

    const elapsedMs = this.scene.time.now - this.gameStartTime;
    return calculateRampedValue(this.levelConfig.dumpIntervalRamp, elapsedMs);
  }

  /**
   * Get the current dump amount accounting for difficulty ramping
   */
  private getRampedDumpAmount(): number | null {
    if (!this.levelConfig.dumpAmountRamp || this.gameStartTime === null) {
      return null; // No ramping, use random generation
    }

    const elapsedMs = this.scene.time.now - this.gameStartTime;
    return calculateRampedValue(this.levelConfig.dumpAmountRamp, elapsedMs);
  }

  /**
   * Start spawning blocks
   */
  public start(): void {
    if (this.spawnTimer) {
      return; // Already spawning
    }

    // Record game start time for ramping calculations
    if (this.gameStartTime === null) {
      this.gameStartTime = this.scene.time.now;
    }

    // Get initial spawn rate (may be ramped if resuming)
    const initialSpawnRate = this.getRampedSpawnRate();
    this.spawnRate = initialSpawnRate;
    this.baseSpawnRate = initialSpawnRate;
    this.currentSpawnRate = initialSpawnRate;

    this.spawnTimer = this.scene.time.addEvent({
      delay: this.spawnRate,
      callback: this.onSpawnTick,
      callbackScope: this,
      loop: true,
    });

    // Start dump timer
    if (!this.dumpTimer) {
      const initialDumpInterval = this.getRampedDumpInterval();
      this.dumpInterval = initialDumpInterval;

      this.dumpTimer = this.scene.time.addEvent({
        delay: this.dumpInterval,
        callback: this.onDumpTick,
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
   * Spawn timer tick - checks for rate changes and spawns block
   */
  private onSpawnTick(): void {
    // Check if spawn rate has changed due to ramping
    const newSpawnRate = this.getRampedSpawnRate();
    if (newSpawnRate !== this.spawnRate) {
      // Spawn rate has changed, need to recreate timer with new rate
      this.spawnRate = newSpawnRate;
      this.baseSpawnRate = newSpawnRate;

      // Remove old timer
      if (this.spawnTimer) {
        const wasPaused = this.spawnTimer.paused;
        this.spawnTimer.remove();

        // Create new timer with updated rate
        this.spawnTimer = this.scene.time.addEvent({
          delay: this.spawnRate,
          callback: this.onSpawnTick,
          callbackScope: this,
          loop: true,
          paused: wasPaused,
        });
      }
    }

    // Spawn the block
    this.spawnBlock();
  }

  /**
   * Dump timer tick - checks for interval changes and triggers dump
   */
  private onDumpTick(): void {
    // Check if dump interval has changed due to ramping
    const newDumpInterval = this.getRampedDumpInterval();
    if (newDumpInterval !== this.dumpInterval) {
      // Dump interval has changed, need to recreate timer with new interval
      this.dumpInterval = newDumpInterval;

      // Remove old timer
      if (this.dumpTimer) {
        this.dumpTimer.remove();

        // Create new timer with updated interval
        this.dumpTimer = this.scene.time.addEvent({
          delay: this.dumpInterval,
          callback: this.onDumpTick,
          callbackScope: this,
          loop: true,
        });
      }
    }

    // Generate dump shape (with ramped amount if configured)
    const dumpAmount = this.getRampedDumpAmount();
    const dumpShape = dumpAmount !== null
      ? DumpShapeGenerator.generateShapeWithTargetCount(dumpAmount)
      : DumpShapeGenerator.generateRandomShape();

    this.scheduleDump(dumpShape);
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

    // Call haptic feedback if in LFG mode
    if (this.isLFGMode && this.hapticCallback) {
      this.hapticCallback();
    }
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

  /**
   * Set the haptic feedback callback for LFG mode
   */
  public setHapticCallback(callback: () => void): void {
    this.hapticCallback = callback;
  }

  /**
   * Enable LFG mode
   */
  public enableLFGMode(): void {
    this.isLFGMode = true;
    this.lastLFGSpawnTime = this.scene.time.now;

    // Pause regular spawning during LFG mode
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }
  }

  /**
   * Disable LFG mode and reset to base spawn rate
   */
  public disableLFGMode(): void {
    this.isLFGMode = false;
    this.currentSpawnRate = this.baseSpawnRate;

    // Resume regular spawning only if not in dump mode
    if (this.spawnTimer && !this.isDumpActive()) {
      this.spawnTimer.paused = false;
    }
  }

  /**
   * Update LFG spawning - call this from scene update loop
   * @param spawnRate Current spawn rate in milliseconds
   */
  public updateLFGSpawning(spawnRate: number): void {
    if (!this.isLFGMode) return;

    this.currentSpawnRate = spawnRate;
    const currentTime = this.scene.time.now;
    const timeSinceLastSpawn = currentTime - this.lastLFGSpawnTime;

    // Check if enough time has passed to spawn another block
    if (timeSinceLastSpawn >= this.currentSpawnRate) {
      this.spawnBlock();
      this.lastLFGSpawnTime = currentTime;
    }
  }

  /**
   * Get the current spawn rate
   */
  public getCurrentSpawnRate(): number {
    return this.currentSpawnRate;
  }

  /**
   * Get the base spawn rate
   */
  public getBaseSpawnRate(): number {
    return this.baseSpawnRate;
  }

  /**
   * Check if spawn timer is paused (e.g., during dump)
   */
  public isSpawnPaused(): boolean {
    return this.spawnTimer?.paused ?? false;
  }

  /**
   * Check if a dump is currently active (warning or executing)
   */
  public isDumpActive(): boolean {
    return this.warningTimer !== null || this.pendingDumpShape !== null;
  }
}
