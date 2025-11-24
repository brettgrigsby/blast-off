/**
 * Configuration for step-based difficulty ramping over time
 *
 * @example
 * // Spawn rate that decreases by 100ms every minute (faster spawning)
 * // Starting at 1000ms, going down to minimum 200ms
 * const spawnRateRamp: RampConfig = {
 *   initialValue: 1000,
 *   changePerInterval: -100,
 *   intervalDuration: 60000, // 1 minute
 *   minValue: 200,
 * }
 *
 * @example
 * // Dump amount that increases by 5 blocks every minute
 * // Starting at 20 blocks, capped at 100 blocks
 * const dumpAmountRamp: RampConfig = {
 *   initialValue: 20,
 *   changePerInterval: 5,
 *   intervalDuration: 60000,
 *   maxValue: 100,
 * }
 */
export interface RampConfig {
  /** Starting value for this parameter */
  initialValue: number

  /** Amount to add (positive) or subtract (negative) each interval */
  changePerInterval: number

  /** Time in milliseconds between ramping steps (e.g., 60000 = 1 minute) */
  intervalDuration: number

  /** Optional minimum value (ramping stops when reached) */
  minValue?: number

  /** Optional maximum value (ramping stops when reached) */
  maxValue?: number
}

/**
 * Configuration interface for level-specific gameplay parameters
 *
 * Supports optional difficulty ramping for dynamic gameplay progression.
 * When a ramp config is provided, the value will change at fixed intervals.
 *
 * @example
 * // Level with increasing difficulty
 * const hardLevel: LevelConfig = {
 *   ...DEFAULT_LEVEL_CONFIG,
 *   spawnRateRamp: {
 *     initialValue: 1000,
 *     changePerInterval: -100,
 *     intervalDuration: 60000,
 *     minValue: 300,
 *   },
 *   baseGravityRamp: {
 *     initialValue: 150,
 *     changePerInterval: 25,
 *     intervalDuration: 60000,
 *     maxValue: 500,
 *   },
 * }
 */
export interface LevelConfig {
  /** Maximum downward velocity for block groups (px/s) */
  maxDescentVelocity: number

  /** Base gravity affecting all groups (px/s²) */
  baseGravity: number

  /** Additional gravity per block in group (px/s²) */
  massGravityFactor: number

  /** Time in milliseconds before grey blocks recover to colored blocks */
  greyRecoveryDelay: number

  /** Time in milliseconds between block spawns */
  spawnRate: number

  /** Time in milliseconds between block dumps */
  dumpInterval: number

  /** Optional ramping config for spawn rate (typically decreases for faster spawning) */
  spawnRateRamp?: RampConfig

  /** Optional ramping config for dump interval (typically decreases for more frequent dumps) */
  dumpIntervalRamp?: RampConfig

  /** Optional ramping config for number of blocks dumped per dump event */
  dumpAmountRamp?: RampConfig

  /** Optional ramping config for base gravity (typically increases for faster falling) */
  baseGravityRamp?: RampConfig

  /** Optional ramping config for mass gravity factor (typically increases for faster falling) */
  massGravityFactorRamp?: RampConfig
}

/**
 * Default level configuration values
 */
export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  maxDescentVelocity: 70,
  baseGravity: 150,
  massGravityFactor: 75,
  greyRecoveryDelay: 2000,
  spawnRate: 1000,
  dumpInterval: 30000,
}

/**
 * Merges partial level config with defaults
 */
export function mergeLevelConfig(partial?: Partial<LevelConfig>): LevelConfig {
  return {
    ...DEFAULT_LEVEL_CONFIG,
    ...partial,
  }
}

/**
 * Calculates the current value for a parameter based on ramping configuration
 *
 * This function computes step-based ramping where values change at fixed intervals.
 * The value remains constant between intervals and changes discretely when an
 * interval boundary is crossed.
 *
 * @param rampConfig - The ramping configuration
 * @param elapsedMs - Time elapsed since ramping started (in milliseconds)
 * @returns The current ramped value, clamped to min/max if specified
 *
 * @example
 * // Spawn rate decreasing by 100ms every minute
 * const spawnRamp: RampConfig = {
 *   initialValue: 1000,
 *   changePerInterval: -100,
 *   intervalDuration: 60000,
 *   minValue: 300,
 * }
 *
 * calculateRampedValue(spawnRamp, 0)      // 1000 (at start)
 * calculateRampedValue(spawnRamp, 30000)  // 1000 (30 seconds, no interval passed)
 * calculateRampedValue(spawnRamp, 60000)  // 900  (1 minute passed)
 * calculateRampedValue(spawnRamp, 120000) // 800  (2 minutes passed)
 * calculateRampedValue(spawnRamp, 600000) // 300  (clamped to minValue)
 */
export function calculateRampedValue(
  rampConfig: RampConfig,
  elapsedMs: number
): number {
  // Calculate how many complete intervals have passed
  const intervalsPassed = Math.floor(elapsedMs / rampConfig.intervalDuration)

  // Calculate the ramped value
  let value =
    rampConfig.initialValue + intervalsPassed * rampConfig.changePerInterval

  // Clamp to min/max if specified
  if (rampConfig.minValue !== undefined && value < rampConfig.minValue) {
    value = rampConfig.minValue
  }
  if (rampConfig.maxValue !== undefined && value > rampConfig.maxValue) {
    value = rampConfig.maxValue
  }

  return value
}
