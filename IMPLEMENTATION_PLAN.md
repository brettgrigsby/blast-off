# Blast Off - Implementation Plan

This document outlines the iterative approach to building the Blast Off match-3 game. Each iteration builds on the previous one and provides something immediately testable.

## Tech Stack

- **Phaser 3.90.0** - Game engine
- **TypeScript 5.9.2** - Type-safe development
- **Vite 7.0** - Build tooling
- **Canvas Size:** 720x1080 (portrait)

## Iteration Overview

### ✅ Iteration 1: Grid System & Static Blocks
**Goal:** Render a 9x12 grid with colorful blocks you can see

**Tasks:**
- [ ] Create `Block` class in `src/objects/Block.ts`
  - Color properties: Red, Yellow, Blue, Green, Purple, Grey
  - Position tracking (column, row, x, y)
  - Visual representation (Phaser Graphics)
- [ ] Create `GridManager` in `src/systems/GridManager.ts`
  - 9 columns × 12 rows coordinate system
  - Column width calculation (720px / 9 = 80px)
  - Row height calculation (1080px / 12 = 90px)
  - Position conversion helpers (grid coords ↔ pixel coords)
  - Boundary detection
- [ ] Update `GameScene.ts` to initialize grid system
- [ ] Populate grid with random colored blocks for visual testing
- [ ] Add visual grid lines (optional, for debugging)

**Testable Outcome:** See a grid of colorful blocks on screen

---

### ✅ Iteration 2: Block Spawning System
**Goal:** Blocks fall from the top automatically

**Tasks:**
- [ ] Create `BlockSpawner` in `src/systems/BlockSpawner.ts`
  - Random color generation
  - Random column selection
  - Spawn timer: 1 block every 500ms
  - Create new block at top of random column
- [ ] Add movement system to blocks
  - Downward velocity: 100 pixels/second
  - Update block positions in GameScene update loop
- [ ] Implement collision detection
  - Blocks stop when hitting bottom boundary
  - Blocks stop when hitting other blocks
  - Stack blocks vertically in columns
- [ ] Integrate spawner with GridManager

**Testable Outcome:** Watch blocks rain down from the top and stack up in columns

---

### ✅ Iteration 3: Drag & Swap Mechanics
**Goal:** Player can drag blocks within their column

**Tasks:**
- [ ] Create `InputManager` in `src/systems/InputManager.ts`
  - Pointer down detection (mouse/touch)
  - Block selection (which block was clicked)
  - Pointer move tracking
  - Pointer up detection
- [ ] Implement column-constrained dragging
  - Block can only move within its column
  - Calculate drag direction (up/down)
  - Implement "half-way threshold" logic
  - Swap positions when threshold is crossed
- [ ] Add visual feedback
  - Highlight selected block
  - Smooth swap animations (optional)
- [ ] Prevent dragging during certain states (e.g., while launching)

**Testable Outcome:** Click and drag blocks up/down within their columns, see them swap positions with neighbors

---

### ✅ Iteration 4: Match Detection
**Goal:** Detect and visualize matches (turn matched blocks grey)

**Tasks:**
- [ ] Create `MatchDetector` in `src/systems/MatchDetector.ts`
  - Horizontal match checking (scan rows for 3+ consecutive same color)
  - Vertical match checking (scan columns for 3+ consecutive same color)
  - Combined match detection (L-shapes, T-shapes, crosses)
  - Return all blocks involved in matches
- [ ] Add Grey color state to Block class
- [ ] Implement match triggering
  - Check for matches after every swap
  - Check for matches continuously (even during motion)
  - Convert matched blocks to grey
  - Prevent grey blocks from matching
- [ ] Add match size calculation (for physics system)

**Testable Outcome:** Drag blocks to create matches of 3+ same color, see them turn grey immediately

---

### ✅ Iteration 5: Basic Launch Physics
**Goal:** Matched blocks launch upward and get removed

**Tasks:**
- [ ] Add launch velocity system to Block class
  - Track current velocity (positive = upward, negative = downward)
  - Apply launch velocity based on match size:
    - 3-match: 400 pixels/second upward
    - 4-match: 600 pixels/second upward
    - 5+ match: 800 pixels/second upward
- [ ] Implement upward movement
  - Update block positions based on velocity
  - Blocks move at constant velocity (no gravity yet)
- [ ] Add boundary removal
  - Detect when block Y position goes above screen top (y < 0)
  - Remove blocks that cross top boundary
  - Track removed block count
- [ ] Add counter/score display
  - UI text showing blocks removed
  - Update on each removal

**Testable Outcome:** Create matches and watch blocks blast upward, see removal counter increment

---

### ✅ Iteration 6: Groups & Advanced Physics
**Goal:** Groups move together, forces stack, complex interactions

**Tasks:**
- [ ] Create `BlockGroup` class in `src/objects/BlockGroup.ts`
  - Array of blocks in the group
  - Shared velocity for entire group
  - Add/remove blocks from group
  - Check if group is fully above screen
- [ ] Implement group formation after matches
  - Matched blocks + all blocks above them form a group
  - Group moves as cohesive unit
- [ ] Add descent mechanics
  - If group doesn't fully clear screen, descend at 100 px/s
  - Group disbands when any part touches bottom/another block
  - Columns fall independently after disbanding
- [ ] Implement force stacking
  - Creating new match in existing group applies force to entire group
  - Multiple launch forces add together
- [ ] Add group merging
  - Detect when two groups collide during launch
  - Merge groups and combine velocities
- [ ] Handle falling blocks joining groups
  - Newly spawned blocks that fall into moving group become part of it
- [ ] Allow dragging blocks within groups
  - Player can still swap blocks in a moving group
  - Can trigger new matches within groups

**Testable Outcome:** Create matches and see entire columns launch together, create chain reactions with multiple matches, see groups merge

---

### ✅ Iteration 7: Game State & Win/Lose Conditions
**Goal:** Complete game loop with objectives and end states

**Tasks:**
- [ ] Add UI elements
  - Score display: "Blocks Removed: X / 100"
  - Visual progress bar (optional)
  - Game status text
- [ ] Implement win condition
  - Check if blocks removed >= 100
  - Display "You Win!" message
  - Pause game
  - Show replay/restart button
- [ ] Implement lose condition
  - Check if any column has > 12 blocks (height exceeds grid)
  - Display "Game Over" message
  - Pause game
  - Show replay/restart button
- [ ] Add game state management
  - States: PLAYING, WON, LOST
  - Disable input when not PLAYING
- [ ] Integrate with FarcadeSDK
  - Submit score on win
  - Handle play_again event
- [ ] Polish (optional)
  - Particle effects on matches
  - Sound effects
  - Screen shake on large launches
  - Color palette refinement

**Testable Outcome:** Play complete games from start to win (remove 100 blocks) or lose (column overflow)

---

## Key Implementation Notes

### Grid Coordinate System
- **Columns:** 0-8 (9 total)
- **Rows:** 0-11 (12 total, but blocks can extend above for launching)
- **Column Width:** 80 pixels
- **Row Height:** 90 pixels
- **Block Size:** Should fit within cell (suggest 70x80px for visual padding)

### Physics Constants
```typescript
const LAUNCH_VELOCITY = {
  MATCH_3: 400,  // pixels/second upward
  MATCH_4: 600,
  MATCH_5_PLUS: 800,
};
const DESCENT_VELOCITY = 1000;  // pixels/second downward
const SPAWN_RATE = 1000;  // milliseconds between spawns (1 per second)
```

### Colors
- Red: `0xff0000`
- Yellow: `0xffff00`
- Blue: `0x0000ff`
- Green: `0x00ff00`
- Purple: `0x800080`
- Grey: `0x808080`

### Critical Mechanics
1. **Non-rigid positioning:** Blocks stay in discrete columns but have continuous Y positions during launch/fall
2. **Continuous matching:** Matches can trigger at any time, even during motion
3. **Grey blocks:** Persist until pushed off screen, can't match, can be dragged
4. **Group cohesion:** Groups stay together until any part touches a resting surface

---

## Testing Checklist

After each iteration, verify:
- [ ] No console errors
- [ ] Smooth 60 FPS performance
- [ ] Touch input works on mobile (test via QR code)
- [ ] Visual clarity (blocks clearly distinguishable)
- [ ] Game logic matches specification

## Current Status

**Active Iteration:** Ready for Iteration 3
**Completed Iterations:**
- ✅ Iteration 1 - Grid System & Static Blocks
- ✅ Iteration 2 - Block Spawning System
**Next Steps:** Begin Iteration 3 - Drag & Swap Mechanics
