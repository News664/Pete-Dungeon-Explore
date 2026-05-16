/**
 * petrification.ts — Petrification cost and threshold description logic
 *
 * Exports:
 *   actionCost(softLimitReached): number  — 1 or 2
 *   gazeCost(gazeTiles, playerPos): number — sum of bonuses at player tile
 *   thresholdLabel(petrification): string  — flavor label for current %
 *   softeningOilEffect(): number          — petrification reduction amount
 *
 * Invariants:
 *   - petrification is clamped to [0, 100] by caller (GameScene).
 *   - softeningOilEffect returns 20 (fixed).
 */
import type { GazeTile } from '../types/gaze'
import type { Vec2 } from '../types/tile'

export function actionCost(softLimitReached: boolean): number {
  return softLimitReached ? 2 : 1
}

export function gazeCost(gazeTiles: GazeTile[], playerPos: Vec2): number {
  return gazeTiles
    .filter(t => t.x === playerPos.x && t.y === playerPos.y)
    .reduce((sum, t) => sum + t.petrificationBonus, 0)
}

export function thresholdLabel(p: number): string {
  if (p < 40) return 'Normal'
  if (p < 70) return 'Your limbs feel heavy'
  if (p < 90) return 'Your body is hardening — move quickly'
  return 'Final warning — you are almost stone'
}

export function softeningOilEffect(): number {
  return 20
}
