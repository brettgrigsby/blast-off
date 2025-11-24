import { LevelConfig, DEFAULT_LEVEL_CONFIG } from './LevelConfig'

/**
 * Level identifiers for the game
 * Add new story mode level IDs here as they are created
 */
export type LevelId = 'quick-play'
// Future story levels will be added here, e.g.:
// | 'story-1' | 'story-2' | 'story-3' | ...

/**
 * Map of level IDs to their configuration
 * Each level can customize any aspect of the game mechanics
 */
export const LEVEL_CONFIGS: Record<LevelId, LevelConfig> = {
  'quick-play': {
    ...DEFAULT_LEVEL_CONFIG,
    spawnRateRamp: {
      initialValue: 1000,
      changePerInterval: -200, // Decrease interval by 200ms for faster spawning
      intervalDuration: 60000, // Every minute
      minValue: 200, // Don't go below 200ms
    },
    dumpAmountRamp: {
      initialValue: 20,
      changePerInterval: 5, // Add 5 more blocks each interval
      intervalDuration: 60000, // Every minute
      maxValue: 100, // Cap at 100 blocks per dump
    },
  },
  // Future story levels will be added here, e.g.:
  // 'story-1': {
  //   ...DEFAULT_LEVEL_CONFIG,
  //   spawnRate: 1200, // Slower spawn rate for first level
  // },
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
