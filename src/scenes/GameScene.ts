/**
 * GameScene.ts — Main game scene: state management, rendering, and input
 *
 * Responsibilities:
 *   - Owns GameState (single source of truth)
 *   - Renders tile grid, player, statues, enemies, gaze overlay via Phaser Graphics
 *   - All UI (stats, messages, statue inspect panel) delegated to HtmlBridge
 *   - Handles keyboard input: arrows/WASD (move), I (inspect), P (push), U (use item)
 *   - Handles pointer-down click-to-move on canvas
 *   - Handles mobile control button wiring (btn-n/s/e/w, btn-inspect, btn-push, btn-use)
 *   - Advances turns: action → companion move → gaze collision → petrification → re-render
 *   - Detects win (exit tile) and lose (petrification ≥ 100) conditions
 *   - Recomputes gaze each turn via computeGaze()
 *   - Advances to next level on win; shows game-over overlay on lose
 *   - Companion logic: follows player; re-petrifies if caught in gaze (+40 petrification)
 *
 * Constants (pixels):
 *   TILE_SIZE = 48
 *   GRID_OFFSET_X = 8, GRID_OFFSET_Y = 8  (grid top-left in scene)
 *   CANVAS_W = 640, CANVAS_H = 576
 *
 * Rendering layers (depth):
 *   0: tiles and gaze overlay, 2: items, 3: statues, 4: enemies, 5: player/companion
 */
import Phaser from 'phaser'
import { LEVELS } from '../levels'
import { initGameState, type GameState } from '../systems/levelLoader'
import { computeGaze, rotateClockwise } from '../systems/gaze'
import { actionCost, gazeCost, softeningOilEffect } from '../systems/petrification'
import { HtmlBridge } from '../ui/HtmlBridge'
import type { StatueState } from '../types/state'
import type { EnemyDefinition } from '../types/entity'

const TILE_SIZE = 48
const GRID_OFFSET_X = 8
const GRID_OFFSET_Y = 8

export class GameScene extends Phaser.Scene {
  private state!: GameState
  private currentLevelIndex: number = 0
  private pushPending: boolean = false

  // Persistent graphics object for tiles, gaze, and entity sprites
  private graphics!: Phaser.GameObjects.Graphics

  // Entity layer — destroyed and recreated each render
  private entityObjects: Phaser.GameObjects.GameObject[] = []

  // HTML bridge for all DOM-side UI
  private bridge!: HtmlBridge

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.currentLevelIndex = 0
    this.state = initGameState(LEVELS[0], 0)
    this.recomputeGaze()

    // Persistent drawing surface
    this.graphics = this.add.graphics()
    this.graphics.setDepth(0)

    // HTML bridge — initialise after DOM is ready (Phaser create runs after DOMContentLoaded)
    this.bridge = new HtmlBridge()

    // Keyboard input
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      this.handleKeyDown(event)
    })

    // Click-to-move on canvas
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer)
    })

    // Mobile button wiring
    const wireBtn = (id: string, fn: () => void) => {
      document.getElementById(id)?.addEventListener('click', fn)
    }
    wireBtn('btn-n', () => this.handleMove(0, -1))
    wireBtn('btn-s', () => this.handleMove(0, 1))
    wireBtn('btn-w', () => this.handleMove(-1, 0))
    wireBtn('btn-e', () => this.handleMove(1, 0))
    wireBtn('btn-inspect', () => this.handleInspect())
    wireBtn('btn-push', () => {
      this.pushPending = true
      this.bridge.pushMessage('Push where?', 'normal')
    })
    wireBtn('btn-use', () => this.handleUse())

    // Initial message
    this.bridge.pushMessage('You enter the labyrinth. Move carefully.')

    this.render()
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private handleKeyDown(event: KeyboardEvent): void {
    const { phase } = this.state

    // When inspecting: any key closes the panel
    if (phase === 'inspecting') {
      this.state.phase = 'playing'
      this.state.inspectingStatue = undefined
      this.bridge.hideStatuePanel()
      this.render()
      return
    }

    // When push-pending: arrow keys execute push, anything else cancels
    if (this.pushPending) {
      let dx = 0
      let dy = 0
      switch (event.key) {
        case 'ArrowUp':    case 'w': case 'W': dy = -1; break
        case 'ArrowDown':  case 's': case 'S': dy = 1;  break
        case 'ArrowLeft':  case 'a': case 'A': dx = -1; break
        case 'ArrowRight': case 'd': case 'D': dx = 1;  break
        default:
          this.pushPending = false
          this.bridge.pushMessage('Push cancelled.')
          this.render()
          return
      }
      this.pushPending = false
      this.handlePush(dx, dy)
      return
    }

    // Game-over or escaped: Enter continues
    if (phase === 'game-over' || phase === 'escaped') {
      if (event.key === 'Enter') {
        this.handleContinue()
      }
      return
    }

    // Normal play
    if (phase !== 'playing') return

    switch (event.key) {
      case 'ArrowUp':    case 'w': case 'W': this.handleMove(0, -1);  break
      case 'ArrowDown':  case 's': case 'S': this.handleMove(0, 1);   break
      case 'ArrowLeft':  case 'a': case 'A': this.handleMove(-1, 0);  break
      case 'ArrowRight': case 'd': case 'D': this.handleMove(1, 0);   break
      case 'i': case 'I': this.handleInspect(); break
      case 'p': case 'P':
        this.pushPending = true
        this.bridge.pushMessage('Push where? (arrow key / WASD)')
        this.render()
        break
      case 'u': case 'U': this.handleUse(); break
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const { phase } = this.state

    // Close inspect panel on any click
    if (phase === 'inspecting') {
      this.state.phase = 'playing'
      this.state.inspectingStatue = undefined
      this.bridge.hideStatuePanel()
      this.render()
      return
    }

    if (phase !== 'playing') return

    // Convert pixel to tile
    const tx = Math.floor((pointer.x - GRID_OFFSET_X) / TILE_SIZE)
    const ty = Math.floor((pointer.y - GRID_OFFSET_Y) / TILE_SIZE)

    const { playerPos } = this.state
    const dist = Math.abs(tx - playerPos.x) + Math.abs(ty - playerPos.y)

    if (dist === 1) {
      // Check if there's a statue at the clicked tile — if so, inspect
      const statueAtTile = this.state.statueStates.find(
        s => !s.isRestored && s.pos.x === tx && s.pos.y === ty
      )
      if (statueAtTile) {
        this.handleInspect()
      } else {
        const dx = tx - playerPos.x
        const dy = ty - playerPos.y
        this.handleMove(dx, dy)
      }
    }
  }

  private handleContinue(): void {
    if (this.state.phase === 'escaped') {
      const nextIndex = this.currentLevelIndex + 1
      if (nextIndex < LEVELS.length) {
        this.currentLevelIndex = nextIndex
        this.state = initGameState(LEVELS[nextIndex], nextIndex)
        this.recomputeGaze()
        this.bridge.pushMessage(`You enter ${LEVELS[nextIndex].name}.`)
        this.render()
      } else {
        // All levels complete — show end screen (handled in render via phase check)
        this.state.phase = 'escaped'
        this.render()
      }
    } else if (this.state.phase === 'game-over') {
      // Restart current level
      this.state = initGameState(LEVELS[this.currentLevelIndex], this.currentLevelIndex)
      this.recomputeGaze()
      this.bridge.pushMessage('You enter the labyrinth. Move carefully.')
      this.render()
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  private handleMove(dx: number, dy: number): void {
    const { playerPos, levelDef, statueStates } = this.state
    const newX = playerPos.x + dx
    const newY = playerPos.y + dy

    // Bounds check
    if (newX < 0 || newY < 0 || newX >= levelDef.width || newY >= levelDef.height) {
      this.bridge.pushMessage('You cannot go that way.')
      this.render()
      return
    }

    // Tile check
    const tile = levelDef.tiles[newY]?.[newX]
    if (tile === 'wall') {
      this.bridge.pushMessage('A wall blocks your path.')
      this.render()
      return
    }

    // Statue check — opaque statues block movement
    const statueAtDest = statueStates.find(
      s => !s.isRestored && s.pos.x === newX && s.pos.y === newY
    )
    if (statueAtDest) {
      this.bridge.pushMessage(`${statueAtDest.def.name} blocks the way. Push with P.`)
      this.render()
      return
    }

    // Move player
    this.state.playerPos = { x: newX, y: newY }
    this.advanceTurn('You move.')
  }

  private handleInspect(): void {
    const { playerPos, statueStates } = this.state
    // Find statue adjacent (Manhattan dist 1)
    const adjacent = statueStates.find(
      s => !s.isRestored &&
        Math.abs(s.pos.x - playerPos.x) + Math.abs(s.pos.y - playerPos.y) === 1
    )

    if (!adjacent) {
      this.bridge.pushMessage('Nothing to inspect nearby.')
      this.render()
      return
    }

    if (adjacent.def.isTrap) {
      // Trigger trap
      const trapDamage = (adjacent.def.trapGazeRange ?? 1) * 5
      this.state.petrification = Math.min(100, this.state.petrification + trapDamage)
      this.bridge.pushMessage(`It was a trap! You reel back. (+${trapDamage}% petrification)`, 'danger')
      this.advanceTurn(`You approach ${adjacent.def.name}...`)
      return
    }

    // Normal statue inspect — costs a turn, then opens panel
    this.advanceTurn(`You inspect ${adjacent.def.name}.`)
    // After advanceTurn the statue reference is still valid
    const statueState = this.state.statueStates.find(s => s.def.id === adjacent.def.id)
    if (statueState) {
      this.state.phase = 'inspecting'
      this.state.inspectingStatue = statueState
      this.bridge.showStatuePanel(statueState)
      this.render()
    }
  }

  private handlePush(dx: number, dy: number): void {
    const { playerPos, statueStates, levelDef } = this.state
    const targetX = playerPos.x + dx
    const targetY = playerPos.y + dy

    const statue = statueStates.find(
      s => !s.isRestored && s.pos.x === targetX && s.pos.y === targetY
    )

    if (!statue) {
      this.bridge.pushMessage('Nothing to push there.')
      this.render()
      return
    }

    if (!statue.def.isPushable) {
      this.bridge.pushMessage(`${statue.def.name} won't budge.`)
      this.render()
      return
    }

    const destX = targetX + dx
    const destY = targetY + dy

    // Bounds check
    if (destX < 0 || destY < 0 || destX >= levelDef.width || destY >= levelDef.height) {
      this.bridge.pushMessage('No room to push her that way.')
      this.render()
      return
    }

    // Wall check
    if (levelDef.tiles[destY]?.[destX] === 'wall') {
      this.bridge.pushMessage('A wall blocks the push.')
      this.render()
      return
    }

    // Another statue check
    const otherStatue = statueStates.find(
      s => !s.isRestored && s.pos.x === destX && s.pos.y === destY
    )
    if (otherStatue) {
      this.bridge.pushMessage('Another statue is in the way.')
      this.render()
      return
    }

    // Execute push
    statue.pos = { x: destX, y: destY }
    this.advanceTurn(`You push ${statue.def.name}.`)
  }

  private handleUse(): void {
    const { inventory, playerPos, statueStates, phase } = this.state

    if (phase !== 'playing') return

    if (inventory.length === 0) {
      this.bridge.pushMessage('Your inventory is empty.')
      this.render()
      return
    }

    const itemIndex = inventory.indexOf('softening-oil')
    if (itemIndex === -1) {
      this.bridge.pushMessage('Nothing usable in inventory.')
      this.render()
      return
    }

    // Check for adjacent non-restored statue with restoration condition
    const adjacentStatue = statueStates.find(
      s => !s.isRestored &&
        s.def.restorationCondition !== undefined &&
        Math.abs(s.pos.x - playerPos.x) + Math.abs(s.pos.y - playerPos.y) === 1
    )

    if (adjacentStatue) {
      // Use oil on statue — restore her
      inventory.splice(itemIndex, 1)
      adjacentStatue.isRestored = true

      // Unlock restored memory stage
      const restoredStageIndex = adjacentStatue.def.memoryStages.findIndex(
        ms => ms.unlockCondition.type === 'restored'
      )
      if (restoredStageIndex !== -1) {
        adjacentStatue.unlockedStageIndex = restoredStageIndex
      }

      // Apply restoration effect
      const effect = adjacentStatue.def.restorationEffect
      if (effect) {
        this.applyRestorationEffect(effect, adjacentStatue)
      }

      // Set companion
      this.state.companion = { sourceStatueId: adjacentStatue.def.id, pos: { ...playerPos } }

      this.bridge.pushMessage(`${adjacentStatue.def.name} is restored. She follows you.`, 'good')

      // Show stage 1 memory panel
      this.advanceTurn(`You pour Softening Oil on ${adjacentStatue.def.name}. She stirs.`)

      // Open inspect panel to show restored stage
      const statueState = this.state.statueStates.find(s => s.def.id === adjacentStatue.def.id)
      if (statueState) {
        this.state.phase = 'inspecting'
        this.state.inspectingStatue = statueState
        this.bridge.showStatuePanel(statueState)
        this.render()
      }
    } else {
      // Use on self — reduce petrification
      inventory.splice(itemIndex, 1)
      const reduction = softeningOilEffect()
      this.state.petrification = Math.max(0, this.state.petrification - reduction)
      this.bridge.pushMessage(`You apply Softening Oil. The stiffness recedes. (-${reduction}% petrification)`, 'good')
      this.advanceTurn('You apply Softening Oil.')
    }
  }

  private applyRestorationEffect(
    effect: NonNullable<StatueState['def']['restorationEffect']>,
    _statue: StatueState
  ): void {
    switch (effect.type) {
      case 'remove-enemy': {
        const idx = this.state.enemyStates.findIndex(e => e.def.id === effect.enemyId)
        if (idx !== -1) {
          this.state.enemyStates.splice(idx, 1)
          this.bridge.pushMessage('The gorgon stirs, then retreats into the dark.', 'good')
        }
        break
      }
      case 'open-path': {
        for (const tile of effect.tiles) {
          this.state.levelDef.tiles[tile.y][tile.x] = 'floor'
        }
        this.bridge.pushMessage('A path opens.')
        break
      }
      case 'grant-item': {
        this.state.inventory.push('softening-oil')
        this.bridge.pushMessage(`You receive ${effect.itemId}.`)
        break
      }
      case 'spawn-enemy': {
        const enemyDef: EnemyDefinition = effect.enemy
        this.state.enemyStates.push({
          def: enemyDef,
          pos: { x: enemyDef.x, y: enemyDef.y },
          facing: enemyDef.gazePattern.facing,
        })
        this.bridge.pushMessage('Something awakens...', 'danger')
        break
      }
      case 'none':
        break
    }
  }

  // ─── Turn Advancement ──────────────────────────────────────────────────────

  private advanceTurn(actionMessage: string): void {
    const s = this.state

    this.bridge.pushMessage(actionMessage)
    s.messages.unshift(actionMessage)

    // Save prev player pos for companion
    const prevPlayerPos = { ...s.playerPos }

    // Increment turns
    s.turns++

    // Check soft limit
    if (!s.softLimitReached && s.turns >= s.levelDef.softTurnLimit) {
      s.softLimitReached = true
      this.bridge.pushMessage('The labyrinth grows heavier. Each step costs more.', 'danger')
    }

    // Apply action petrification cost
    const cost = actionCost(s.softLimitReached)
    s.petrification = Math.min(100, s.petrification + cost)

    // Rotate sentinel enemies BEFORE recomputing gaze
    for (const enemy of s.enemyStates) {
      if (enemy.def.type === 'sentinel') {
        enemy.facing = rotateClockwise(enemy.facing)
      }
    }

    // Recompute gaze
    this.recomputeGaze()

    // Move companion to player's previous pos
    if (s.companion !== null) {
      s.companion.pos = { ...prevPlayerPos }
    }

    // Apply gaze petrification to player
    const gazeDmg = gazeCost(s.activeGazeTiles, s.playerPos)
    if (gazeDmg > 0) {
      s.petrification = Math.min(100, s.petrification + gazeDmg)
      this.bridge.pushMessage(`You are caught in a gaze! (+${gazeDmg}% petrification)`, 'danger')
      s.messages.unshift(`You are caught in a gaze! (+${gazeDmg}% petrification)`)
    }

    // Check companion gaze collision
    if (s.companion !== null) {
      const companionGazeDmg = gazeCost(s.activeGazeTiles, s.companion.pos)
      if (companionGazeDmg > 0) {
        // Companion re-petrifies
        s.petrification = Math.min(100, s.petrification + 40)
        const msg = 'She steps into the gaze — stone again. (+40)'
        this.bridge.pushMessage(msg, 'danger')
        s.messages.unshift(msg)

        // Return companion as statue at her current pos
        const statueState = s.statueStates.find(ss => ss.def.id === s.companion!.sourceStatueId)
        if (statueState) {
          statueState.pos = { ...s.companion.pos }
          statueState.isRestored = false
          // Revert to stage 0
          statueState.unlockedStageIndex = 0
        }

        s.companion = null
      }
    }

    // Pick up items on player tile
    for (const item of s.itemStates) {
      if (!item.consumed && item.pos.x === s.playerPos.x && item.pos.y === s.playerPos.y) {
        item.consumed = true
        s.inventory.push(item.itemType)
        const label = item.itemType === 'softening-oil' ? 'Softening Oil' : item.itemType
        const msg = `You pick up ${label}.`
        this.bridge.pushMessage(msg, 'good')
        s.messages.unshift(msg)
      }
    }

    // Check hidden enemy triggers
    const triggered = s.hiddenEnemies.filter(
      he => he.triggerTile.x === s.playerPos.x && he.triggerTile.y === s.playerPos.y
    )
    for (const he of triggered) {
      const idx = s.hiddenEnemies.indexOf(he)
      s.hiddenEnemies.splice(idx, 1)
      const enemyDef = he.enemy
      s.enemyStates.push({
        def: enemyDef,
        pos: { x: enemyDef.x, y: enemyDef.y },
        facing: enemyDef.gazePattern.facing,
      })
      const msg = `Something stirs in the dark — a ${enemyDef.type} appears!`
      this.bridge.pushMessage(msg, 'danger')
      s.messages.unshift(msg)
    }

    // Proximity unlocks for adjacent statues
    for (const statue of s.statueStates) {
      if (statue.isRestored) continue
      const dist = Math.abs(statue.pos.x - s.playerPos.x) + Math.abs(statue.pos.y - s.playerPos.y)
      if (dist <= 1) {
        statue.turnsAdjacent++
        const def = statue.def
        for (let i = statue.unlockedStageIndex + 1; i < def.memoryStages.length; i++) {
          const cond = def.memoryStages[i].unlockCondition
          if (cond.type === 'turns-adjacent' && statue.turnsAdjacent >= cond.turns) {
            statue.unlockedStageIndex = i
            const msg = `A new memory stirs within ${def.name}...`
            this.bridge.pushMessage(msg)
            s.messages.unshift(msg)
            break
          }
        }
      }
    }

    // Check win condition
    const currentTile = s.levelDef.tiles[s.playerPos.y]?.[s.playerPos.x]
    if (currentTile === 'exit') {
      s.phase = 'escaped'
      this.bridge.pushMessage('You reach the exit!', 'good')
      s.messages.unshift('You reach the exit!')
      this.render()
      return
    }

    // Check lose condition
    if (s.petrification >= 100) {
      s.phase = 'game-over'
      this.bridge.pushMessage('You have fully petrified.', 'danger')
      s.messages.unshift('You have fully petrified.')
      this.render()
      return
    }

    this.render()
  }

  private recomputeGaze(): void {
    const { enemyStates, statueStates, levelDef } = this.state
    this.state.activeGazeTiles = computeGaze(
      enemyStates,
      statueStates,
      levelDef.tiles,
      levelDef.width,
      levelDef.height
    )
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private tileToPixel(x: number, y: number): { px: number; py: number } {
    return {
      px: GRID_OFFSET_X + x * TILE_SIZE,
      py: GRID_OFFSET_Y + y * TILE_SIZE,
    }
  }

  render(): void {
    this.drawTilesAndGaze()
    this.drawEntities()
    this.drawOverlays()
    this.bridge.updateStats(this.state)
  }

  private drawTilesAndGaze(): void {
    const g = this.graphics
    g.clear()

    const { levelDef, activeGazeTiles } = this.state

    // Build gaze set for quick lookup
    const gazeSet = new Set<string>()
    for (const gt of activeGazeTiles) {
      gazeSet.add(`${gt.x},${gt.y}`)
    }

    // Draw tiles
    for (let ty = 0; ty < levelDef.height; ty++) {
      for (let tx = 0; tx < levelDef.width; tx++) {
        const tile = levelDef.tiles[ty]?.[tx]
        const { px, py } = this.tileToPixel(tx, ty)

        switch (tile) {
          case 'wall':
            g.fillStyle(0x3a3a4a)
            g.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            g.lineStyle(1, 0x222233)
            g.strokeRect(px, py, TILE_SIZE, TILE_SIZE)
            break
          case 'exit':
            g.fillStyle(0x003322)
            g.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            g.lineStyle(2, 0x00ff88)
            g.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            g.fillStyle(0x00ff88, 0.15)
            g.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            break
          default: // floor
            g.fillStyle(0x1e1e2e)
            g.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            g.lineStyle(1, 0x2a2a3a)
            g.strokeRect(px, py, TILE_SIZE, TILE_SIZE)
            break
        }

        // Gaze overlay
        if (gazeSet.has(`${tx},${ty}`)) {
          g.fillStyle(0xff2222, 0.28)
          g.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
        }
      }
    }
  }

  private drawEntities(): void {
    // Destroy previous entity objects
    for (const obj of this.entityObjects) {
      (obj as Phaser.GameObjects.GameObject & { destroy: () => void }).destroy()
    }
    this.entityObjects = []

    const g = this.graphics
    const { statueStates, enemyStates, itemStates, playerPos, companion } = this.state

    // Items (depth 2) — small oil bottle silhouette
    for (const item of itemStates) {
      if (item.consumed) continue
      const { px, py } = this.tileToPixel(item.pos.x, item.pos.y)
      const cx = px + TILE_SIZE / 2
      const cy = py + TILE_SIZE / 2
      // Bottle body (yellow-brown rectangle)
      g.fillStyle(0xccaa44)
      g.fillRect(cx - 6, cy - 4, 12, 10)
      // Bottle neck (small circle top)
      g.fillStyle(0xaa8833)
      g.fillRect(cx - 3, cy - 8, 6, 4)
      g.fillCircle(cx, cy - 8, 3)
    }

    // Statues (depth 3) — marble silhouette
    for (const statue of statueStates) {
      if (statue.isRestored) continue
      const { px, py } = this.tileToPixel(statue.pos.x, statue.pos.y)
      const cx = px + TILE_SIZE / 2
      const cy = py + TILE_SIZE / 2

      // Body: light grey fill with darker outline
      g.fillStyle(0xccccdd)
      g.fillRect(cx - 12, cy - 8, 24, 24)
      // Rounded head blob
      g.fillCircle(cx, cy - 14, 10)
      // Outline
      g.lineStyle(1, 0xaaaacc)
      g.strokeRect(cx - 12, cy - 8, 24, 24)
      g.strokeCircle(cx, cy - 14, 10)

      // Name initial label
      const initial = this.add.text(
        cx, cy + 6,
        statue.def.name[0],
        { fontSize: '10px', color: '#555577', fontStyle: 'bold' }
      ).setOrigin(0.5, 0.5).setDepth(3)
      this.entityObjects.push(initial)
    }

    // Enemies (depth 4)
    for (const enemy of enemyStates) {
      const { px, py } = this.tileToPixel(enemy.pos.x, enemy.pos.y)
      const cx = px + TILE_SIZE / 2
      const cy = py + TILE_SIZE / 2

      if (enemy.def.type === 'sentinel') {
        // Sentinel: dark blue body
        g.fillStyle(0x334466)
        g.fillRect(cx - 14, cy - 14, 28, 28)
        // Rotating eye indicator (direction dot)
        const facingOffsets: Record<string, [number, number]> = {
          N: [0, -10], E: [10, 0], S: [0, 10], W: [-10, 0]
        }
        const [fox, foy] = facingOffsets[enemy.facing] ?? [0, 0]
        g.fillStyle(0xaabbff)
        g.fillCircle(cx + fox, cy + foy, 4)
        g.lineStyle(1, 0x6677aa)
        g.strokeRect(cx - 14, cy - 14, 28, 28)
      } else {
        // Gorgon: dark red body
        g.fillStyle(0xaa2222)
        g.fillRect(cx - 14, cy - 14, 28, 28)
        // Yellow eyes (2px dots)
        g.fillStyle(0xffff00)
        g.fillRect(cx - 6, cy - 4, 3, 3)
        g.fillRect(cx + 3, cy - 4, 3, 3)
        // Snake protrusions (4 short lines from top)
        g.lineStyle(1, 0x88ff44)
        g.lineBetween(cx - 6, cy - 14, cx - 8, cy - 20)
        g.lineBetween(cx - 2, cy - 14, cx - 2, cy - 21)
        g.lineBetween(cx + 2, cy - 14, cx + 2, cy - 21)
        g.lineBetween(cx + 6, cy - 14, cx + 8, cy - 20)
        g.lineStyle(1, 0x882222)
        g.strokeRect(cx - 14, cy - 14, 28, 28)
      }

      // Type initial label
      const typeInitial: Record<string, string> = {
        'lesser-gorgon': 'G',
        'watcher': 'W',
        'gaze-trap': 'T',
        'sentinel': 'S',
        'boss': 'B',
      }
      const label = this.add.text(
        cx, cy + 2,
        typeInitial[enemy.def.type] ?? '?',
        { fontSize: '10px', color: '#ffaaaa', fontStyle: 'bold' }
      ).setOrigin(0.5, 0.5).setDepth(4)
      this.entityObjects.push(label)
    }

    // Companion (depth 5, drawn before player so player is on top)
    if (companion !== null) {
      const { px, py } = this.tileToPixel(companion.pos.x, companion.pos.y)
      const cx = px + TILE_SIZE / 2
      const cy = py + TILE_SIZE / 2

      // Same as player but slightly smaller and with blue tint overlay
      // Hair (small rect top)
      g.fillStyle(0x3a1f1f)
      g.fillRect(cx - 8, cy - 19, 16, 6)
      // Head (skin tone)
      g.fillCircle(cx, cy - 14, 7)
      g.fillStyle(0xc8956c)
      g.fillCircle(cx, cy - 14, 7)
      // Body
      g.fillStyle(0x555588)
      g.fillRect(cx - 7, cy - 7, 14, 14)
      // Legs
      g.fillStyle(0x5555aa)
      g.fillRect(cx - 7, cy + 7, 6, 7)
      g.fillRect(cx + 1, cy + 7, 6, 7)
      // Feet
      g.fillStyle(0x3333aa)
      g.fillRect(cx - 8, cy + 13, 6, 2)
      g.fillRect(cx + 2, cy + 13, 6, 2)
      // Blue tint overlay
      g.fillStyle(0x8888ff, 0.3)
      g.fillRect(cx - 8, cy - 19, 16, 34)
    }

    // Player (depth 5)
    {
      const { px, py } = this.tileToPixel(playerPos.x, playerPos.y)
      const cx = px + TILE_SIZE / 2
      const cy = py + TILE_SIZE / 2

      // Hair (small rect top, white/light)
      g.fillStyle(0xe8d8a0)
      g.fillRect(cx - 9, cy - 20, 18, 7)
      // Head (skin tone circle)
      g.fillStyle(0xc8956c)
      g.fillCircle(cx, cy - 14, 8)
      // Body (dark rectangle)
      g.fillStyle(0x444444)
      g.fillRect(cx - 8, cy - 6, 16, 16)
      // Legs (#666)
      g.fillStyle(0x666666)
      g.fillRect(cx - 8, cy + 10, 7, 8)
      g.fillRect(cx + 1, cy + 10, 7, 8)
      // Feet (#333)
      g.fillStyle(0x333333)
      g.fillRect(cx - 9, cy + 17, 7, 2)
      g.fillRect(cx + 2, cy + 17, 7, 2)
    }
  }

  private drawOverlays(): void {
    const { phase } = this.state
    const allEscaped = phase === 'escaped' && this.currentLevelIndex >= LEVELS.length - 1

    if (phase === 'game-over') {
      this.drawCenteredOverlay('You have become stone.', '#cc4444', 'Press Enter to try again.')
    } else if (phase === 'escaped' && !allEscaped) {
      this.drawCenteredOverlay('You escaped!', '#44cc88', 'Press Enter for next level.')
    } else if (allEscaped) {
      this.drawCenteredOverlay('You escaped the labyrinth!', '#88eecc', 'Press Enter to restart.')
    }
  }

  private drawCenteredOverlay(headline: string, headlineColor: string, subtext: string): void {
    // Semi-transparent dark overlay covering grid area
    const gridW = GRID_OFFSET_X + this.state.levelDef.width * TILE_SIZE + GRID_OFFSET_X
    const g = this.graphics
    g.fillStyle(0x000000, 0.65)
    g.fillRect(0, 0, gridW, 576)

    const cx = gridW / 2
    const headlineText = this.add.text(cx, 260, headline, {
      fontSize: '32px',
      color: headlineColor,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(90)

    const subtextObj = this.add.text(cx, 305, subtext, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0.5).setDepth(90)

    this.entityObjects.push(headlineText, subtextObj)
  }
}
