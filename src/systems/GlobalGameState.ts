import type { FarcadeSDK } from '@farcade/game-sdk'
import type { GameState } from './GameStateManager'

declare global {
  interface Window {
    FarcadeSDK: FarcadeSDK
  }
}

/**
 * GlobalGameState - Single source of truth for game state
 *
 * This singleton manages the global game state and handles persistence
 * to the Farcade SDK. All game state reads and writes should go through
 * this manager to ensure consistency.
 */
export class GlobalGameState {
  private static instance: GlobalGameState
  private static isInitialized: boolean = false
  private gameState: GameState | null = null

  private constructor() {}

  static getInstance(): GlobalGameState {
    if (!GlobalGameState.instance) {
      GlobalGameState.instance = new GlobalGameState()
    }
    return GlobalGameState.instance
  }

  /**
   * Initialize the global game state from SDK's initialGameState
   * Call this once when the app starts (in TitleScene)
   */
  initialize(gameState: GameState | null): void {
    this.gameState = gameState
    GlobalGameState.isInitialized = true
    console.log('GlobalGameState initialized:', this.gameState)
  }

  /**
   * Check if GlobalGameState has been initialized from SDK
   */
  static hasBeenInitialized(): boolean {
    return GlobalGameState.isInitialized
  }

  /**
   * Get the current game state
   */
  getGameState(): GameState | null {
    return this.gameState
  }

  /**
   * Check if there's a saved game (currentLevel is not null)
   */
  hasSavedGame(): boolean {
    return !!(this.gameState && this.gameState.currentLevel)
  }

  /**
   * Update the game state and persist to SDK as a side effect
   * This is the primary way to modify game state
   */
  updateGameState(gameState: GameState): void {
    this.gameState = gameState
    console.log('GlobalGameState updated:', this.gameState)

    // Side effect: Save to SDK for persistence
    if (window.FarcadeSDK) {
      try {
        window.FarcadeSDK.singlePlayer.actions.saveGameState({ gameState })
        console.log('Game state saved to SDK')
      } catch (error) {
        console.error('Failed to save game state to SDK:', error)
      }
    }
  }

  /**
   * Clear the game state (set currentLevel to null) and persist to SDK
   * Preserves high scores when clearing
   * Used when abandoning a game or completing a level
   */
  clearGameState(): void {
    const preservedHighScores = this.gameState?.highScores
    const clearedState: GameState = {
      currentLevel: null,
      highScores: preservedHighScores
    }
    this.updateGameState(clearedState)
    console.log('Game state cleared (high scores preserved)')
  }

  /**
   * Update high score for a level if the new score is higher
   * @param levelId The level ID
   * @param score The new score to compare
   * @returns true if the high score was updated
   */
  updateHighScore(levelId: string, score: number): boolean {
    const currentHighScore = this.gameState?.highScores?.[levelId] ?? 0

    if (score > currentHighScore) {
      const newHighScores = { ...this.gameState?.highScores, [levelId]: score }

      const updatedState: GameState = {
        currentLevel: this.gameState?.currentLevel ?? null,
        highScores: newHighScores
      }

      this.updateGameState(updatedState)
      return true
    }
    return false
  }

  /**
   * Get high score for a level
   * @param levelId The level ID
   * @returns The high score, or 0 if none exists
   */
  getHighScore(levelId: string): number {
    return this.gameState?.highScores?.[levelId] ?? 0
  }
}
