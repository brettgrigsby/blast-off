# Block Booster

A match-3 game about defending your game board from falling in blocks by matching blocks to launch them back up.

## Game Play

Block Booster is played on a board of 9 columns × 12 rows. Blocks will fall down from the top of the screen. Each falling block will be 1 of 5 colors: Red, Yellow, Blue, Green, Purple. The user can drag 1 block at a time within its column to attempt to match 3 or more blocks of the same color vertically or horizontally. When a match is made, the blocks included in the match will turn grey and launch themselves and any blocks above them towards the top of the screen. Any blocks pushed above the top of the screen are removed from the board. The user must remove 100 blocks from the board to complete the level.

Blocks will not always be at rigid grid positions since they can launch and fall back down, but they will always remain within their discrete column.

## Dragging Blocks

The user will click or touch a block and then drag it within its column. The block does not move continuously, but instead will swap positions with another block when the drag enters half way into the next blocks space. The moving block should not be intrinsicly tied to the drag position, the drag is only communicating the swap behavior. Blocks must swap in series. You cannot swap with a block that is not above or below the selected block. Even though the block does not move continuously, the player may drag in a continuous fashion and swaps will continue to happen as appropriate.

## Matching

The moment 3 or more blocks of the same color align vertically, horizontally, or both, they create a match. All of the blocks included in the match will turn grey to indicate they have been "consumed". Grey blocks will not trigger matches. In addition to turning grey, the blocks and any above them will "launch" towards the top of the screen.

Matches can trigger at any time, including while blocks are launching or descending. Blocks that are part of a group in motion can be matched.

Grey blocks persist on the board until they are pushed over the top of the screen. They can be dragged by the player and will be part of any launching group, but cannot form matches themselves.

## Launching

After a match is made, the blocks from the match and any blocks above them will launch towards the top of the screen. The launch force is proportional to the number of blocks used to create the match. The launched blocks will form a group. This group will remain as 1 unit. If the launch force is not enough to push all of the group above the top of the screen, the remaining blocks in the group will descend back down towards the bottom of the board. Once any part of the group is resting on another block or the bottom of the board, the group will disband and columns will fall independently until they are resting on another block or the bottom of the board.

The user is still able to drag blocks within a group as it is ascending or descending. If another match is made, the force from that new match will be applied to the group to push it back towards the top of the screen.

### Launch Physics
- Blocks move at a consistent velocity (no gravity-based acceleration)
- Launch force based on match size:
  - 3-match: 400 pixels/second upward velocity
  - 4-match: 600 pixels/second upward velocity
  - 5+ match: 800 pixels/second upward velocity
- Descent velocity: 100 pixels/second downward
- Multiple launches stack their forces - creating a match in an existing group applies the new launch force to the entire group
- When two groups collide during launch, they merge into a single group and their launch forces combine
- Falling blocks from the top can join groups that are in motion

## Raining Blocks

New blocks will fall 1 at a time from the top of the screen. They will be random in color and random in which column they fall into. The spawn rate is 1 block every 500ms (2 blocks per second).

Blocks continue to spawn at this rate regardless of player actions. Newly spawned blocks that fall into a column with a group in motion will become part of that group.

## Failure

If any column reaches the top of the board (greater than 12 blocks tall), then the player loses.