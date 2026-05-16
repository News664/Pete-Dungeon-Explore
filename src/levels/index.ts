/**
 * index.ts — Level registry: ordered list of all playable levels
 *
 * Invariants:
 *   - LEVELS is played in index order (linear progression).
 *   - Level select screen can replace the index lookup later without changing level files.
 */
import { level1 } from './level1'
import { level2 } from './level2'
import { level3 } from './level3'
import type { LevelDefinition } from '../types'

export const LEVELS: LevelDefinition[] = [level1, level2, level3]
