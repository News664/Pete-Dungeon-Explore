/**
 * level3.ts — Level 3: The Sanctuary
 *
 * Introduces: Softening Oil item, statue restoration, soft turn limit pressure.
 * Map: 16 wide × 13 tall. softTurnLimit=20 (tight — forces efficient play).
 * Enemies:
 *   - Lesser Gorgon "gorgon-3-1" at (4,3) facing E: gaze covers row 3, cols 5–13.
 *   - Sentinel "sentinel-3-1" at (11,6) facing N: rotating-cardinal, rotates CW each turn.
 * Item: Softening Oil at (7,10).
 * Statue: Lyra at (8,4) — restorable ally. Using Softening Oil on her removes the gorgon.
 * Exit at (14,11). Player at (1,11).
 *
 * Puzzle: Two enemies block efficient paths. Gorgon covers row 3 east of col 4.
 * Sentinel rotates each turn, covering different directions unpredictably.
 * The Softening Oil is in the south (7,10). Lyra is at (8,4) in the middle.
 * Player must: pick up oil → use oil on Lyra (U key while adjacent) → gorgon removed →
 * navigate north past row 3 safely → avoid or time around sentinel → reach exit.
 * The soft turn limit of 20 prevents dawdling — player must plan efficiently.
 *
 * With gorgon active, row 3 cols 5+ are dangerous. Player can only cross row 3 at cols 1-4.
 * The exit is at col 14 — to get there they need to cross row 3 or go around.
 * After removing the gorgon, the path north through cols 5+ on row 3 opens.
 * Sentinel at (11,6) rotates, so player must time crossing the sentinel's gaze column/row.
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

export const level3: LevelDefinition = {
  id: 'level-3',
  name: 'The Sanctuary',
  width: 16,
  height: 13,
  softTurnLimit: 20,
  tiles: parseMap([
    '################',
    '#..............#',
    '#..............#',
    '#...G..........#',
    '#.......L......#',
    '#..............#',
    '#..........S...#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#......O.......#',
    '#@............E#',
    '################',
  ]),
  playerStart: { x: 1, y: 11 },
  statues: [
    {
      id: 'lyra',
      x: 8,
      y: 4,
      name: 'Lyra',
      material: 'marble',
      appearance: 'Tall and lean, with long dark hair loose over her shoulders. Wears keeper\'s robes — formal but practical, with a ring of keys at her belt, one key missing.',
      job: 'Keeper of the Sanctuary\'s gorgon — a hereditary post she did not choose',
      pose: 'reaching toward a torch bracket on the wall, expression of regret',
      backstory: 'The gorgon\'s keeper. She failed in her duty and was the first to pay the price.',
      portraitKey: 'lyra',
      memoryStages: [
        {
          unlockCondition: { type: 'always' },
          lines: [
            { label: 'Her expression', text: 'She\'s frozen reaching toward a torch bracket on the wall. Her expression is not fear — it\'s regret.' },
            { label: 'The key ring', text: 'One key is missing from the ring at her belt. Whatever it unlocked is still locked.' },
          ],
        },
        {
          unlockCondition: { type: 'restored' },
          lines: [
            { label: 'She exhales', text: 'Marble returning to flesh. She breathes slowly, steadying herself.' },
            { label: 'What she says', text: '"The gorgon was mine to care for," she says. "I failed it. I\'m sorry you had to see this."' },
          ],
        },
      ],
      mechanicalRole: 'restorable-ally',
      restorationCondition: 'Pour Softening Oil on her.',
      restorationEffect: { type: 'remove-enemy', enemyId: 'gorgon-3-1' },
      isPushable: false,
      isOpaque: true,
      isTrap: false,
    },
  ],
  enemies: [
    {
      id: 'gorgon-3-1',
      x: 4,
      y: 3,
      type: 'lesser-gorgon',
      gazePattern: {
        type: 'cardinal-ray',
        facing: 'E',
        range: 8,
        petrificationBonus: 30,
        ignoresWalls: false,
      },
    },
    {
      id: 'sentinel-3-1',
      x: 11,
      y: 6,
      type: 'sentinel',
      gazePattern: {
        type: 'rotating-cardinal',
        facing: 'N',
        range: 8,
        petrificationBonus: 30,
        ignoresWalls: false,
      },
    },
  ],
  hiddenEnemies: [],
  items: [
    {
      pos: { x: 7, y: 10 },
      itemType: 'softening-oil',
    },
  ],
}
