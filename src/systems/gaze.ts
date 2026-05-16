/**
 * gaze.ts — Gaze calculation engine
 *
 * Exports:
 *   computeGaze(enemyStates, statueStates, tiles, width, height): GazeTile[]
 *   rotateClockwise(dir): CardinalDirection
 *   dirToVec(dir): Vec2
 *
 * Invariants:
 *   - Recomputed fresh each turn after all moves and rotations.
 *   - Rays stop at first wall or opaque statue tile (unless ignoresWalls=true).
 *   - boss-global: every non-wall tile is a gaze tile.
 *   - cone-short: 3 rays (straight + 45° flanks) of range 3 in facing quadrant.
 *   - rotating-cardinal: same as cardinal-ray but uses EnemyState's current facing.
 */
import type { TileType, Vec2 } from '../types/tile'
import type { CardinalDirection, GazeTile } from '../types/gaze'
import type { EnemyState, StatueState } from '../types/state'

export function rotateClockwise(dir: CardinalDirection): CardinalDirection {
  const seq: CardinalDirection[] = ['N', 'E', 'S', 'W']
  return seq[(seq.indexOf(dir) + 1) % 4]
}

export function dirToVec(dir: CardinalDirection): Vec2 {
  switch (dir) {
    case 'N': return { x: 0, y: -1 }
    case 'E': return { x: 1, y: 0 }
    case 'S': return { x: 0, y: 1 }
    case 'W': return { x: -1, y: 0 }
  }
}

// Returns the three (dx, dy) ray directions for a cone-short pattern given facing
function coneDirs(facing: CardinalDirection): Array<[number, number]> {
  switch (facing) {
    case 'N': return [[0, -1], [-1, -1], [1, -1]]
    case 'E': return [[1, 0], [1, -1], [1, 1]]
    case 'S': return [[0, 1], [-1, 1], [1, 1]]
    case 'W': return [[-1, 0], [-1, -1], [-1, 1]]
  }
}

function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height
}

function isOpaqueAt(
  x: number,
  y: number,
  tiles: TileType[][],
  statueStates: StatueState[],
): boolean {
  if (tiles[y]?.[x] === 'wall') return true
  return statueStates.some(
    s => !s.isRestored && s.pos.x === x && s.pos.y === y && s.def.isOpaque
  )
}

function castRay(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  range: number,
  ignoreWalls: boolean,
  tiles: TileType[][],
  statueStates: StatueState[],
  width: number,
  height: number,
): Vec2[] {
  const result: Vec2[] = []
  for (let step = 1; step <= range; step++) {
    const nx = ox + dx * step
    const ny = oy + dy * step
    if (!inBounds(nx, ny, width, height)) break
    if (!ignoreWalls && isOpaqueAt(nx, ny, tiles, statueStates)) {
      // The opaque tile itself is still in the gaze (enemy can see the thing it hits)
      result.push({ x: nx, y: ny })
      break
    }
    result.push({ x: nx, y: ny })
  }
  return result
}

export function computeGaze(
  enemyStates: EnemyState[],
  statueStates: StatueState[],
  tiles: TileType[][],
  width: number,
  height: number,
): GazeTile[] {
  const result: GazeTile[] = []

  for (const enemy of enemyStates) {
    const pattern = enemy.def.gazePattern
    const sourceId = enemy.def.id
    const bonus = pattern.petrificationBonus
    const ignoreWalls = pattern.ignoresWalls

    let hitTiles: Vec2[] = []

    switch (pattern.type) {
      case 'cardinal-ray': {
        const vec = dirToVec(pattern.facing)
        hitTiles = castRay(
          enemy.pos.x, enemy.pos.y,
          vec.x, vec.y,
          8, ignoreWalls,
          tiles, statueStates, width, height
        )
        break
      }

      case 'cardinal-ray-long': {
        const vec = dirToVec(pattern.facing)
        hitTiles = castRay(
          enemy.pos.x, enemy.pos.y,
          vec.x, vec.y,
          15, ignoreWalls,
          tiles, statueStates, width, height
        )
        break
      }

      case 'rotating-cardinal': {
        // Uses the enemy's current facing (which may have been rotated by sentinel logic)
        const vec = dirToVec(enemy.facing)
        hitTiles = castRay(
          enemy.pos.x, enemy.pos.y,
          vec.x, vec.y,
          8, ignoreWalls,
          tiles, statueStates, width, height
        )
        break
      }

      case 'cone-short': {
        const dirs = coneDirs(enemy.facing)
        for (const [dx, dy] of dirs) {
          const ray = castRay(
            enemy.pos.x, enemy.pos.y,
            dx, dy,
            3, ignoreWalls,
            tiles, statueStates, width, height
          )
          hitTiles.push(...ray)
        }
        break
      }

      case 'boss-global': {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (tiles[y]?.[x] !== 'wall') {
              hitTiles.push({ x, y })
            }
          }
        }
        break
      }
    }

    for (const tile of hitTiles) {
      result.push({ x: tile.x, y: tile.y, sourceId, petrificationBonus: bonus })
    }
  }

  return result
}
