/**
 * level2.ts — Level 2: The Gallery
 *
 * Introduces: pushable statues to block gaze rays.
 * Map: 14 wide × 12 tall.
 * Enemy: Lesser Gorgon at (6,3) facing S — gaze covers col 6, rows 4–11.
 * Exit at (6,10). Player at (1,10).
 *
 * Puzzle: Exit is at (6,10), directly in the gorgon's southward gaze.
 * Player cannot reach exit without first blocking the gaze ray.
 * Statue Petra starts at (9,6) — off to the right of the gaze column.
 * Player must push Petra west twice: (9,6) → (8,6) → (7,6) → then one more to (6,6).
 * Actually Petra at (6,6) blocks gaze at rows 7+ making (6,10) safe.
 * To push Petra west, player stands east of her and pushes west.
 * Player path: start (1,10) → east to (10,6) → push Petra west to (9,6)→(8,6)→(7,6)→(6,6)
 * — each push: player stands east, presses W (west).
 * After Petra at (6,6): gaze ray from gorgon at (6,3) facing S hits (6,4),(6,5),(6,6)=Petra (stops).
 * Exit at (6,10) is now ungrazed. Player walks west and south to (6,10). Escaped!
 *
 * Wall at (6,2) row 2 ensures player can't just walk up to col 6 from the north safely
 * (gaze covers that column below the gorgon). Extra walls channel movement.
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

export const level2: LevelDefinition = {
  id: 'level-2',
  name: 'The Gallery',
  width: 14,
  height: 12,
  softTurnLimit: 25,
  tiles: parseMap([
    '##############',
    '#............#',
    '#............#',
    '#.....G......#',
    '#............#',
    '#............#',
    '#.........P..#',
    '#............#',
    '#............#',
    '#............#',
    '#.....E......#',
    '##############',
  ]),
  playerStart: { x: 1, y: 10 },
  statues: [
    {
      id: 'petra',
      x: 10,
      y: 6,
      name: 'Petra',
      material: 'marble',
      appearance: 'Stocky build, middle-aged, with short-cropped hair and calloused hands. Wears a treasure hunter\'s vest with many pockets, most of them empty.',
      job: 'Freelance treasure hunter and dungeon delver',
      pose: 'kneeling, arms extended as if offering something',
      backstory: 'A treasure hunter who ventured too deep. Her offering never reached its destination.',
      memoryStages: [
        {
          unlockCondition: { type: 'always' },
          lines: [
            { label: 'Memory', text: 'Her weight surprises you — heavy marble, but balanced. You sense she would not mind being moved if it meant helping someone escape.' },
          ],
        },
      ],
      mechanicalRole: 'pushable-obstacle',
      isPushable: true,
      isOpaque: true,
      isTrap: false,
    },
  ],
  enemies: [
    {
      id: 'gorgon-2',
      x: 6,
      y: 3,
      type: 'lesser-gorgon',
      gazePattern: {
        type: 'cardinal-ray',
        facing: 'S',
        range: 8,
        petrificationBonus: 3,
        ignoresWalls: false,
      },
    },
  ],
  hiddenEnemies: [],
  items: [],
}
