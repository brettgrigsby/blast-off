import { LevelConfig, DEFAULT_LEVEL_CONFIG } from './LevelConfig'

/**
 * Level identifiers for the game
 */
export type LevelId = 'quick-play' | 'speed-rush' | 'heavy-blocks' | 'the-belt'

/**
 * Map of level IDs to their configuration
 * Each level can customize any aspect of the game mechanics
 */
export const LEVEL_CONFIGS: Record<LevelId, LevelConfig> = {
  'quick-play': DEFAULT_LEVEL_CONFIG,
  'speed-rush': {
    ...DEFAULT_LEVEL_CONFIG,
    spawnRate: 300,
    blockCountGoal: 800,
  },
  'heavy-blocks': {
    ...DEFAULT_LEVEL_CONFIG,
    baseGravity: 300,
    massGravityFactor: 150,
    blockCountGoal: 500,
  },
  'the-belt': {
    ...DEFAULT_LEVEL_CONFIG,
    spawnRate: 500,
    dumpInterval: 10000,
    blockCountGoal: 1000,
  },
}

/**
 * Get the configuration for a specific level
 * @param levelId The ID of the level to get config for
 * @returns The level configuration
 * @throws Error if level ID is not found
 */
export function getLevelConfig(levelId: LevelId): LevelConfig {
  const config = LEVEL_CONFIGS[levelId]
  if (!config) {
    throw new Error(`Level configuration not found for level: ${levelId}`)
  }
  return config
}
