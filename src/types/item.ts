/**
 * item.ts — Item type definitions and level placement
 *
 * Definitions:
 *   ItemType: all collectable item types (extensible)
 *   ItemPlacement: { pos, itemType } for level data
 *
 * Invariants:
 *   - Items are consumed on use (removed from inventory and game state).
 *   - 'softening-oil' reduces petrification by 20 on use.
 */
import type { Vec2 } from './tile'

export type ItemType = 'softening-oil'

export interface ItemPlacement {
  pos: Vec2
  itemType: ItemType
}
