/**
 * level1.ts — Level 1: The Antechamber
 *
 * Introduces: player movement, single cardinal gaze ray, exit.
 * Map: 14 wide × 10 tall.
 * Enemy: Lesser Gorgon at (9,4) facing W — gaze covers row 4, cols 1-8.
 * Player at (1,8). Exit at (12,8).
 *
 * Puzzle: The direct east path along row 8 is blocked mid-level by a wall gap
 * that forces passage through row 4. The gorgon faces west covering cols 1-8 of row 4.
 * Player must go east past col 9 (behind the gorgon) to cross row 4 safely,
 * then south to the exit. Statue Mira at (2,2) teaches the gaze mechanic via memory.
 *
 * Map layout (14×10):
 *   Row 0: ##############
 *   Row 1: #............#
 *   Row 2: #.S..........#  Mira at (2,2)
 *   Row 3: #############.  wall row with no gap on left — actually open top half
 *   Row 4: #........G...#  Gorgon at (9,4) facing W
 *   Row 5: ########.....#  wall row with gap cols 8-12
 *   Row 6: #.......#....#  wall in col 8 blocks direct south path
 *   Row 7: #.......#....#
 *   Row 8: #@......#...E#  player at (1,8), exit at (12,8), wall at col 8
 *   Row 9: ##############
 *
 * Solution: Player starts at (1,8). Cannot go directly east along row 8 past col 7
 * (wall at col 8 row 8). Must go north to row 4. Gorgon gaze covers row 4 cols 1-8.
 * Player must navigate to col 9+ on row 4 (safe), cross through the gap at col 8 row 5,
 * then south to exit at (12,8). To reach col 9 on row 4, go north through rows 7-4
 * on cols 1-7 — but that row 4 is gaze. So player goes up on the right side:
 * go north to row 1, cross east to col 10+, come south to row 4, col 10 (safe behind gorgon),
 * then south through the gap cols 9-12 row 5 to exit.
 */

import type { LevelDefinition } from '../types/level'
import type { TileType } from '../types/tile'

function parseMap(rows: string[]): TileType[][] {
  return rows.map(row =>
    row.split('').map(ch => {
      if (ch === '#') return 'wall'
      if (ch === 'E') return 'exit'
      return 'floor'
    })
  )
}

export const level1: LevelDefinition = {
  id: 'level-1',
  name: 'The Antechamber',
  width: 14,
  height: 10,
  softTurnLimit: 30,
  tiles: parseMap([
    '##############',
    '#............#',
    '#.S..........#',
    '#............#',
    '#........G...#',
    '########.....#',
    '#.......#....#',
    '#.......#....#',
    '#@......#...E#',
    '##############',
  ]),
  playerStart: { x: 1, y: 8 },
  statues: [
    {
      id: 'mira',
      x: 2,
      y: 2,
      name: 'Mira',
      material: 'marble',
      pose: 'frozen mid-stride, one arm raised as if to warn someone',
      backstory: 'A former dungeon guard who tried to warn the others. She was too slow.',
      memoryStages: [
        {
          text: 'Her stone eyes are fixed on the centre of the room — on the gorgon\'s position. She knew. She was trying to warn you.',
          unlockCondition: { type: 'always' },
        },
      ],
      mechanicalRole: 'decorative',
      isPushable: false,
      isOpaque: true,
      isTrap: false,
    },
  ],
  enemies: [
    {
      id: 'gorgon-1',
      x: 9,
      y: 4,
      type: 'lesser-gorgon',
      gazePattern: {
        type: 'cardinal-ray',
        facing: 'W',
        range: 8,
        petrificationBonus: 3,
        ignoresWalls: false,
      },
    },
  ],
  hiddenEnemies: [],
  items: [],
}
