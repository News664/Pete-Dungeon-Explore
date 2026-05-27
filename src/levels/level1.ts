/**
 * level1.ts — Level 1: The Antechamber
 *
 * Map: 16 wide × 12 tall. softTurnLimit: 35.
 * Player at (1,10). Exit at (13,10).
 *
 * Enemies:
 *   A — gorgon-1-a at (2,3) facing E, range 2.
 *       Gaze covers (3,3) and (4,3) before hitting wall at col 5.
 *       Teaches: wall blocks gaze.
 *   B — gorgon-1-b at (11,3) facing S, range 8.
 *       Gaze covers col 11, rows 4–10. Blocks direct path to exit.
 *   C — gorgon-1-c at (8,4) facing S, range 2.
 *       Gaze covers (8,5) and (8,6)=Kessara. Kessara blocks it.
 *       Teaches: statue blocks gaze.
 *
 * Statues:
 *   Kessara at (8,6) — non-pushable, isOpaque, blocks enemy C's gaze passively.
 *   Elena at (10,6)  — pushable, restorable ally. Using Oil on her removes enemy C.
 *                      Pushing Elena east to (11,6) blocks enemy B's gaze from row 7 down,
 *                      making the exit at (13,10) reachable.
 *
 * Puzzle flow:
 *   1. Enemy A teaches wall-blocks-gaze: short ray, visible stop at col-5 wall.
 *   2. Enemy C faces south. Kessara (non-pushable) sits at (8,6) — passively blocking
 *      C's gaze at (8,6). Teaches: statue-blocks-gaze.
 *   3. Enemy B's full-height gaze along col 11 blocks exit at (13,10).
 *      Player pushes Elena from (10,6) east to (11,6): stand at (9,6), push east.
 *      Elena now blocks B's gaze from row 7 down. Exit becomes reachable.
 *   4. Player picks up Softening Oil at (4,9).
 *      Restoration safe approach: from west (10,6) or east (12,6).
 *      Dangerous from south (11,7) — player enters B's gaze when Elena no longer blocks.
 *      Using Oil on Elena: removes enemy C. Elena follows player (companion).
 *   5. Reach exit at (13,10).
 *
 * Map string (exactly 16 chars per row, 12 rows):
 *   '################'   row 0
 *   '#..............#'   row 1
 *   '#..............#'   row 2
 *   '#.A..##.....B..#'   row 3   A at (2,3); wall cols 5-6; B at (11,3)
 *   '#....##.C......#'   row 4   C at (8,4)
 *   '#....##........#'   row 5
 *   '#....##.K..E...#'   row 6   Kessara at (8,6); Elena at (11,6) after push
 *   '#..............#'   row 7
 *   '#..............#'   row 8
 *   '#...O..........#'   row 9   Oil item at (4,9)
 *   '#@...........E.#'   row 10  player at (1,10); exit at (13,10)
 *   '################'   row 11
 *
 * Note: Entity positions (A, B, C, K) shown in map comment only — actual entities below.
 *       'E' at (13,10) becomes 'exit' tile. All other non-'#' chars become 'floor'.
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
  width: 16,
  height: 12,
  softTurnLimit: 35,
  tiles: parseMap([
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#....##........#',
    '#....##........#',
    '#....##........#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#@...........E.#',
    '################',
  ]),
  playerStart: { x: 1, y: 10 },
  statues: [
    {
      id: 'kessara',
      x: 8,
      y: 6,
      name: 'Kessara',
      material: 'marble',
      appearance: 'Slight build, early 20s, with pale ash-blonde hair kept in a tight functional braid. Wears a practical scholar\'s travelling robe — worn at the elbows — with a compass, folded parchment, and chalk clipped to her belt. Her hands are ink-stained.',
      job: 'Junior expedition cartographer; mapping the dungeon for the first time',
      pose: 'Standing completely upright, arms at her sides, eyes open and level. The only statue in the room that does not look afraid.',
      backstory: 'She came in to map the dungeon and never came back. She is the reason Elena is here.',
      portraitKey: 'kessara',
      memoryStages: [
        {
          unlockCondition: { type: 'always' },
          lines: [
            { label: 'Her expression', text: 'Calm. Not resigned — decided. She saw it coming and chose her ground.' },
            { label: 'The compass', text: 'Still clipped to her belt, pointing north. She was working until the very end.' },
            { label: 'The parchment', text: 'Folded tight. Her last map, unfinished. Nobody will know what she found.' },
            { label: 'Her hands', text: 'Ink-stained. She was twenty-one years old and already very good at this.' },
          ],
        },
      ],
      mechanicalRole: 'blocks-gaze-only',
      restorationCondition: undefined,
      restorationEffect: undefined,
      isPushable: false,
      isOpaque: true,
      isTrap: false,
    },
    {
      id: 'elena',
      x: 10,
      y: 6,
      name: 'Elena',
      material: 'marble',
      appearance: 'Athletic build, early 20s, with dark curly hair pulled back under a leather headband. Wears light scout\'s leather armour with a crescent moon emblem on the left shoulder — the emblem is worn smooth, inherited rather than earned. Boots thick with road dust.',
      job: 'Scout for the same surface expedition team as Kessara',
      pose: 'Frozen mid-crouch, right arm outstretched toward Kessara\'s position across the room, mouth open mid-word. Left hand gripping a half-drawn dagger that she did not use.',
      backstory: 'She came in after Kessara when Kessara stopped coming back. She almost made it to her.',
      portraitKey: 'elena',
      memoryStages: [
        {
          unlockCondition: { type: 'always' },
          lines: [
            { label: 'Her eyes', text: 'Fixed on Kessara across the room — not on the gorgon. She was not trying to escape.' },
            { label: 'The dagger', text: 'Half-drawn. She reached for it, then stopped. Too far, or a choice.' },
            { label: 'The emblem', text: 'A crescent moon, worn smooth. She did not earn it — she carries it for someone.' },
            { label: 'Her boots', text: 'Long-road dust. She travelled a great distance to end up three steps short.' },
          ],
        },
        {
          unlockCondition: { type: 'restored' },
          lines: [
            { label: 'She exhales', text: 'Stone dust from her lungs. She blinks slowly, then finds Kessara with her eyes.' },
            { label: 'What she says', text: '\'I was calling to her.\' She doesn\'t look at you. \'She told me not to follow.\'' },
            { label: 'What she does', text: 'She turns away from Kessara. When she finally looks at you: \'Let\'s go.\'' },
          ],
        },
      ],
      mechanicalRole: 'restorable-ally',
      restorationCondition: 'Pour Softening Oil on her.',
      restorationEffect: { type: 'remove-enemy', enemyId: 'gorgon-1-c' },
      isPushable: true,
      isOpaque: true,
      isTrap: false,
    },
  ],
  enemies: [
    {
      id: 'gorgon-1-a',
      x: 2,
      y: 3,
      type: 'lesser-gorgon',
      gazePattern: {
        type: 'cardinal-ray',
        facing: 'E',
        range: 2,
        petrificationBonus: 30,
        ignoresWalls: false,
      },
    },
    {
      id: 'gorgon-1-b',
      x: 11,
      y: 3,
      type: 'lesser-gorgon',
      gazePattern: {
        type: 'cardinal-ray',
        facing: 'S',
        range: 8,
        petrificationBonus: 30,
        ignoresWalls: false,
      },
    },
    {
      id: 'gorgon-1-c',
      x: 8,
      y: 4,
      type: 'lesser-gorgon',
      gazePattern: {
        type: 'cardinal-ray',
        facing: 'S',
        range: 2,
        petrificationBonus: 30,
        ignoresWalls: false,
      },
    },
  ],
  hiddenEnemies: [],
  items: [
    {
      pos: { x: 4, y: 9 },
      itemType: 'softening-oil',
    },
  ],
}
