/**
 * tile.ts — Tile type and grid coordinate definitions
 *
 * Definitions:
 *   TileType: 'floor' | 'wall' | 'exit'
 *   Vec2: { x, y } grid coordinates (not pixel)
 *
 * Invariants:
 *   - (0,0) is top-left; x right, y down.
 *   - Walls block movement, gaze rays, and statue pushes.
 */
export type TileType = 'floor' | 'wall' | 'exit'

export interface Vec2 {
  x: number
  y: number
}
