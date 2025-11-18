/**
 * Configuration interface for level-specific gameplay parameters
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
  dumpInterval: 20000,
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
