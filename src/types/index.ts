/**
 * index.ts — Type barrel: re-exports all game types
 */
export type { TileType, Vec2 } from './tile'
export type { CardinalDirection, GazePatternType, GazePattern, GazeTile } from './gaze'
export type { ItemType, ItemPlacement } from './item'
export type {
  Material,
  MechanicalRole,
  UnlockCondition,
  InspectionLine,
  MemoryStage,
  RestorationEffect,
  StatueEntity,
  EnemyType,
  EnemyDefinition,
  HiddenEnemyDefinition,
} from './entity'
export type { LevelDefinition } from './level'
export type { StatueState, EnemyState, ItemState, CompanionState } from './state'
