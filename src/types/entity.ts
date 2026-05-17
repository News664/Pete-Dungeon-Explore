/**
 * entity.ts — Static definitions for statues, enemies, and hidden enemies
 *
 * Definitions:
 *   Material: statue material (marble only initially; extensible)
 *   MechanicalRole: what a statue does while solid
 *   UnlockCondition: discriminated union of all memory-stage unlock triggers
 *   InspectionLine: { label, text } — one labelled observation in a memory stage
 *   MemoryStage: one stage of a statue's lore, gated by an UnlockCondition
 *   RestorationEffect: what happens when statue is restored (discriminated union)
 *   StatueEntity: complete static definition of a statue (from level data)
 *     New fields: appearance (physical description), job (role/occupation)
 *   EnemyType: all supported enemy kinds
 *   EnemyDefinition: static enemy spec including gaze pattern
 *   HiddenEnemyDefinition: { triggerTile, enemy } — enemy that spawns on tile step
 *
 * Invariants:
 *   - memoryStages[0].unlockCondition must always be { type: 'always' }.
 *   - isTrap=true statues must have trapGazeRange defined.
 *   - portraitKey is a Phaser texture key; undefined means render placeholder rect.
 *   - MemoryStage.lines is an array of InspectionLine (label + text pairs).
 */
import type { Vec2 } from './tile'
import type { GazePattern } from './gaze'

export type Material = 'marble'

export type MechanicalRole =
  | 'blocks-gaze-only'
  | 'pushable-obstacle'
  | 'restorable-ally'
  | 'pressure-plate'
  | 'decorative'

export type UnlockCondition =
  | { type: 'always' }
  | { type: 'restored' }
  | { type: 'turns-adjacent'; turns: number }
  | { type: 'trigger-tile'; tile: Vec2 }
  | { type: 'item-used'; itemId: string }

export interface InspectionLine {
  label: string   // short focus label, e.g. "Her eyes", "The dagger"
  text: string    // the observation text
}

export interface MemoryStage {
  lines: InspectionLine[]
  unlockCondition: UnlockCondition
}

export type RestorationEffect =
  | { type: 'open-path'; tiles: Vec2[] }
  | { type: 'grant-item'; itemId: string }
  | { type: 'remove-enemy'; enemyId: string }
  | { type: 'spawn-enemy'; enemy: EnemyDefinition }
  | { type: 'none' }

export interface StatueEntity {
  id: string
  x: number
  y: number
  name: string
  material: Material
  appearance: string
  job: string
  pose: string
  backstory: string
  portraitKey?: string
  memoryStages: MemoryStage[]
  mechanicalRole: MechanicalRole
  restorationCondition?: string
  restorationEffect?: RestorationEffect
  isPushable: boolean
  isOpaque: boolean
  isTrap: boolean
  trapGazeRange?: number
}

export type EnemyType = 'lesser-gorgon' | 'watcher' | 'gaze-trap' | 'sentinel' | 'boss'

export interface EnemyDefinition {
  id: string
  x: number
  y: number
  type: EnemyType
  gazePattern: GazePattern
}

export interface HiddenEnemyDefinition {
  triggerTile: Vec2
  enemy: EnemyDefinition
}
