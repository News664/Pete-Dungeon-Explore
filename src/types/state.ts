/**
 * state.ts — Runtime state types for statue, enemy, item, and companion instances
 *
 * Definitions:
 *   StatueState: runtime state of one statue (position may change if pushed)
 *   EnemyState: runtime state of one enemy (facing rotates for sentinel)
 *   ItemState: runtime state of a floor item (consumed when picked up)
 *   CompanionState: runtime state of a restored companion following the player
 *
 * Invariants:
 *   - StatueState.pos may differ from def.x/def.y after pushes.
 *   - EnemyState.facing is the source of truth for rotating enemies.
 *   - CompanionState.pos is the tile the companion currently occupies (player's previous tile).
 *   - CompanionState.sourceStatueId links back to the StatueState that was restored.
 *   - If companion ends turn in any gaze tile, she re-petrifies:
 *     player receives 40 petrification; companion returns as statue at pos.
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

/**
 * CompanionState: runtime state of a restored companion following the player.
 *
 * Invariants:
 *   - pos is the tile the companion currently occupies (player's previous tile).
 *   - sourceStatueId links back to the StatueState that was restored.
 *   - If companion ends turn in any gaze tile, she re-petrifies:
 *     player receives 40 petrification; companion returns as statue at pos.
 */
export interface CompanionState {
  sourceStatueId: string
  pos: Vec2
}
