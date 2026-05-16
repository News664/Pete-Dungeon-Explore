/**
 * level.ts — LevelDefinition: complete static spec for a hand-authored level
 *
 * Definitions:
 *   LevelDefinition: all data needed to initialise and run one level
 *
 * Invariants:
 *   - tiles[y][x] is the tile at grid position (x, y).
 *   - playerStart must be on a 'floor' tile.
 *   - Exactly one 'exit' tile per level.
 *   - softTurnLimit: turns before action petrification cost doubles (1 → 2).
 */
import type { TileType, Vec2 } from './tile'
import type { StatueEntity, EnemyDefinition, HiddenEnemyDefinition } from './entity'
import type { ItemPlacement } from './item'

export interface LevelDefinition {
  id: string
  name: string
  width: number
  height: number
  softTurnLimit: number
  tiles: TileType[][]
  playerStart: Vec2
  statues: StatueEntity[]
  enemies: EnemyDefinition[]
  hiddenEnemies: HiddenEnemyDefinition[]
  items: ItemPlacement[]
}
