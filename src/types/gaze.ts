/**
 * gaze.ts — Gaze pattern and computed gaze tile types
 *
 * Definitions:
 *   CardinalDirection: N | E | S | W
 *   GazePatternType: all supported pattern shapes
 *   GazePattern: full spec for one enemy's gaze (type, facing, range, bonus, wall-pierce)
 *   GazeTile: a single tile covered by an enemy's gaze this turn
 *
 * Invariants:
 *   - Gaze is recomputed fresh each turn after all moves and rotations.
 *   - ignoresWalls=true bypasses wall/statue occlusion (boss only).
 *   - petrificationBonus is added once if player ends turn on any tile from this source.
 */
export type CardinalDirection = 'N' | 'E' | 'S' | 'W'

export type GazePatternType =
  | 'cardinal-ray'
  | 'cardinal-ray-long'
  | 'cone-short'
  | 'rotating-cardinal'
  | 'boss-global'

export interface GazePattern {
  type: GazePatternType
  facing: CardinalDirection
  range: number
  petrificationBonus: number
  ignoresWalls: boolean
}

export interface GazeTile {
  x: number
  y: number
  sourceId: string
  petrificationBonus: number
}
