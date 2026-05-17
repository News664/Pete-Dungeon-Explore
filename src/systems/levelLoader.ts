/**
 * levelLoader.ts — Initialises runtime GameState from a LevelDefinition
 *
 * Exports:
 *   initGameState(levelDef, levelIndex): GameState
 *   GameState: complete mutable runtime state for the current level
 *   GamePhase: union of all valid game phases
 *
 * Definitions:
 *   GameState.companion: CompanionState | null — null until a statue is restored as ally
 *   GameState.playerFacing: CardinalDirection — direction of last player move; drives
 *     the facing indicator and determines the default interact target.
 *
 * Invariants:
 *   - GameState is the single source of truth for the running game.
 *   - statueStates positions start from def.x/def.y.
 *   - enemyStates facing starts from def.gazePattern.facing.
 *   - messages is an append-only log (GameScene prepends new messages).
 *   - companion starts null on every level load.
 *   - playerFacing starts 'S' on every level load.
 */
import type { LevelDefinition } from '../types/level'
import type { HiddenEnemyDefinition } from '../types/entity'
import type { ItemType } from '../types/item'
import type { Vec2 } from '../types/tile'
import type { GazeTile, CardinalDirection } from '../types/gaze'
import type { StatueState, EnemyState, ItemState, CompanionState } from '../types/state'

export type GamePhase = 'playing' | 'inspecting' | 'menu' | 'game-over' | 'escaped'

export interface GameState {
  levelIndex: number
  levelDef: LevelDefinition
  playerPos: Vec2
  playerFacing: CardinalDirection
  petrification: number
  turns: number
  softLimitReached: boolean
  inventory: ItemType[]
  statueStates: StatueState[]
  enemyStates: EnemyState[]
  itemStates: ItemState[]
  hiddenEnemies: HiddenEnemyDefinition[]
  activeGazeTiles: GazeTile[]
  messages: string[]
  phase: GamePhase
  inspectingStatue?: StatueState
  companion: CompanionState | null
}

export function initGameState(levelDef: LevelDefinition, levelIndex: number): GameState {
  return {
    levelIndex,
    levelDef,
    playerPos: { ...levelDef.playerStart },
    playerFacing: 'S',
    petrification: 0,
    turns: 0,
    softLimitReached: false,
    inventory: [],
    statueStates: levelDef.statues.map(def => ({
      def,
      pos: { x: def.x, y: def.y },
      isRestored: false,
      unlockedStageIndex: 0,
      turnsAdjacent: 0,
    })),
    enemyStates: levelDef.enemies.map(def => ({
      def,
      pos: { x: def.x, y: def.y },
      facing: def.gazePattern.facing,
    })),
    itemStates: levelDef.items.map(ip => ({
      pos: { ...ip.pos },
      itemType: ip.itemType,
      consumed: false,
    })),
    hiddenEnemies: [...levelDef.hiddenEnemies],
    activeGazeTiles: [],
    messages: [],
    phase: 'playing',
    companion: null,
  }
}
