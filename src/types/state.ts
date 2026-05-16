/**
 * state.ts — Runtime state types for statue and enemy instances
 *
 * Definitions:
 *   StatueState: runtime state of one statue (position may change if pushed)
 *   EnemyState: runtime state of one enemy (facing rotates for sentinel)
 *   ItemState: runtime state of a floor item (consumed when picked up)
 *
 * Invariants:
 *   - StatueState.pos may differ from def.x/def.y after pushes.
 *   - EnemyState.facing is the source of truth for rotating enemies.
 */
import type { Vec2 } from './tile'
import type { StatueEntity, EnemyDefinition } from './entity'
import type { CardinalDirection } from './gaze'
import type { ItemType } from './item'

export interface StatueState {
  def: StatueEntity
  pos: Vec2
  isRestored: boolean
  unlockedStageIndex: number  // highest memory stage currently visible
  turnsAdjacent: number       // turns player has spent adjacent (for proximity unlock)
}

export interface EnemyState {
  def: EnemyDefinition
  pos: Vec2
  facing: CardinalDirection
}

export interface ItemState {
  pos: Vec2
  itemType: ItemType
  consumed: boolean
}
