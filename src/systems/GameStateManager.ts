import type { Block, BlockColor } from '../objects/Block'
import type { BlockGroup } from '../objects/BlockGroup'
import type { ColumnManager } from './ColumnManager'
import { PLAYABLE_COLORS, BlockColor as BlockColorEnum } from '../objects/Block'

// Save state interface - compact format for minimal size
interface SavedBlock {
  c: number        // column (0-8)
  y: number        // y position in pixels
  co: number       // color index (0-5 for playable colors, 6 for grey)
  v?: number       // velocityY (omit if 0)
  rt?: number      // greyRecoveryTimer remaining ms (omit if null)
  om?: boolean     // isOriginalMatchBlock (omit if false)
}

interface SavedGroup {
  bi: number[]     // block indices (into blocks array)
  v: number        // velocityY
  bc?: number      // boostCount (omit if 0)
}

interface SaveState {
  v: number        // version
  s: number        // score (blocksRemoved)
  b: SavedBlock[]  // blocks
  g?: SavedGroup[] // groups (omit if empty)
  lct?: { [column: number]: number } // loseConditionTimers: column -> remaining ms (omit if empty)
}

// Top-level game state structure
export interface GameState {
  currentLevel: {
    levelId: string
    boardState: SaveState
  } | null
  highScores?: { [levelId: string]: number }
}

export class GameStateManager {
  /**
   * Serialize the current game state to the new nested format
   * @param columnManager The column manager containing all blocks and groups
   * @param blocksRemoved The current score (blocks removed)
   * @param loseConditionTimers Map of column timers for lose condition
   * @param levelId The ID of the current level being played
   * @returns GameState with currentLevel.boardState structure
   */
  static serialize(
    columnManager: ColumnManager,
    blocksRemoved: number,
    loseConditionTimers: Map<number, Phaser.Time.TimerEvent>,
    levelId: string
  ): GameState {
    const allBlocks = columnManager.getAllBlocks()
    const groups = columnManager.getGroups()

    // Create a map of block -> index for group serialization
    const blockIndexMap = new Map<Block, number>()

    // Serialize blocks
    const savedBlocks: SavedBlock[] = allBlocks.map((block, index) => {
      blockIndexMap.set(block, index)

      // Map color to index (0-5 for playable colors, 6 for grey)
      let colorIndex: number
      if (block.color === BlockColorEnum.GREY) {
        colorIndex = 6
      } else {
        colorIndex = PLAYABLE_COLORS.indexOf(block.color)
        if (colorIndex === -1) {
          // Fallback to 0 if color not found (should never happen)
          colorIndex = 0
        }
      }

      const savedBlock: SavedBlock = {
        c: block.column,
        y: Math.round(block.y), // Round to avoid floating point precision issues
        co: colorIndex
      }

      // Only include velocityY if non-zero
      if (block.velocityY !== 0) {
        savedBlock.v = Math.round(block.velocityY)
      }

      // Only include recovery timer if active
      if (block.greyRecoveryTimer) {
        const remaining = block.greyRecoveryTimer.getRemaining()
        savedBlock.rt = Math.round(remaining)
      }

      // Only include isOriginalMatchBlock if true
      if (block.isOriginalMatchBlock) {
        savedBlock.om = true
      }

      return savedBlock
    })

    // Serialize groups
    const savedGroups: SavedGroup[] = []
    for (const group of groups) {
      const blockIndices: number[] = []
      for (const block of group.getBlocks()) {
        const index = blockIndexMap.get(block)
        if (index !== undefined) {
          blockIndices.push(index)
        }
      }

      if (blockIndices.length > 0) {
        const savedGroup: SavedGroup = {
          bi: blockIndices,
          v: Math.round(group.getVelocity())
        }
        // Only include boostCount if it's non-zero
        const boostCount = group.getBoostCount()
        if (boostCount > 0) {
          savedGroup.bc = boostCount
        }
        savedGroups.push(savedGroup)
      }
    }

    const saveState: SaveState = {
      v: 1, // version
      s: blocksRemoved,
      b: savedBlocks
    }

    // Only include groups if there are any
    if (savedGroups.length > 0) {
      saveState.g = savedGroups
    }

    // Serialize lose condition timers
    if (loseConditionTimers.size > 0) {
      const loseConditionTimersObj: { [column: number]: number } = {}
      for (const [col, timer] of loseConditionTimers.entries()) {
        const remaining = timer.getRemaining()
        if (remaining > 0) {
          loseConditionTimersObj[col] = Math.round(remaining)
        }
      }
      if (Object.keys(loseConditionTimersObj).length > 0) {
        saveState.lct = loseConditionTimersObj
      }
    }

    // Wrap in the new structure
    return {
      currentLevel: {
        levelId,
        boardState: saveState
      }
    }
  }

  /**
   * Extract the SaveState and levelId from the nested GameState structure
   * Handles both old format (direct SaveState) and new format (GameState with currentLevel.boardState)
   * @param data The saved game data (either SaveState or GameState)
   * @returns Object with saveState and levelId, or null if invalid
   */
  static deserialize(data: any): { saveState: SaveState; levelId: string } | null {
    if (!data) {
      return null
    }

    // Check if this is the new format with currentLevel.boardState
    if (data.currentLevel && data.currentLevel.boardState) {
      return {
        saveState: data.currentLevel.boardState as SaveState,
        levelId: data.currentLevel.levelId || 'quick-play' // Default to quick-play if missing
      }
    }

    // Check if this is the old format (direct SaveState with version field)
    if (data.v !== undefined && data.s !== undefined && data.b !== undefined) {
      return {
        saveState: data as SaveState,
        levelId: 'quick-play' // Old saves default to quick-play
      }
    }

    console.error('Invalid game state format:', data)
    return null
  }
}
