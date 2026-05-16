/**
 * GameScene.ts — Main game scene: state management, rendering, and input
 *
 * Responsibilities:
 *   - Owns GameState (single source of truth)
 *   - Renders tile grid, player, statues, enemies, gaze overlay, UI panel
 *   - Handles keyboard input: arrows/WASD (move), I (inspect), P (push), U (use item)
 *   - Advances turns: action → gaze collision check → petrification update → re-render
 *   - Detects win (exit tile) and lose (petrification ≥ 100) conditions
 *   - Recomputes gaze each turn via computeGaze()
 *   - Advances to next level on win; shows game-over overlay on lose
 *
 * Constants (pixels):
 *   TILE_SIZE = 48
 *   GRID_OFFSET_X = 8, GRID_OFFSET_Y = 8  (grid top-left in scene)
 *   UI_X = 640  (right panel start x)
 *   CANVAS_W = 1024, CANVAS_H = 640
 *
 * Rendering layers (depth):
 *   0: tiles, 1: gaze overlay, 2: items, 3: statues, 4: enemies, 5: player, 100: StatuePanel
 */
import Phaser from 'phaser'
import { LEVELS } from '../levels'
import { initGameState, type GameState } from '../systems/levelLoader'
import { computeGaze, rotateClockwise } from '../systems/gaze'
import { actionCost, gazeCost, thresholdLabel, softeningOilEffect } from '../systems/petrification'
import { MessageLog } from '../ui/MessageLog'
import { StatuePanel } from '../ui/StatuePanel'
import type { StatueState } from '../types/state'
import type { EnemyDefinition } from '../types/entity'

const TILE_SIZE = 48
const GRID_OFFSET_X = 8
const GRID_OFFSET_Y = 8
const UI_X = 648

export class GameScene extends Phaser.Scene {
  private state!: GameState
  private currentLevelIndex: number = 0
  private pushPending: boolean = false

  // Persistent graphics objects
  private graphics!: Phaser.GameObjects.Graphics
  private uiGraphics!: Phaser.GameObjects.Graphics

  // Entity layer — destroyed and recreated each render
  private entityObjects: Phaser.GameObjects.GameObject[] = []

  // UI text objects — destroyed and recreated each render
  private uiTexts: Phaser.GameObjects.GameObject[] = []

  // UI components
  private messageLog!: MessageLog
  private statuePanel!: StatuePanel

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.currentLevelIndex = 0
    this.state = initGameState(LEVELS[0], 0)
    this.recomputeGaze()

    // Persistent drawing surfaces
    this.graphics = this.add.graphics()
    this.graphics.setDepth(0)
    this.uiGraphics = this.add.graphics()
    this.uiGraphics.setDepth(0)

    // UI components
    this.messageLog = new MessageLog(this, UI_X + 8, 440, 360)
    this.statuePanel = new StatuePanel(this)

    // Keyboard input
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      this.handleKeyDown(event)
    })

    this.render()
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private handleKeyDown(event: KeyboardEvent): void {
    const { phase } = this.state

    // When inspecting: any key closes the panel
    if (phase === 'inspecting') {
      this.state.phase = 'playing'
      this.state.inspectingStatue = undefined
      this.statuePanel.hide()
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
          this.addMessage('Push cancelled.')
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
        this.addMessage('Push where? (arrow key / WASD)')
        this.render()
        break
      case 'u': case 'U': this.handleUse(); break
    }
  }

  private handleContinue(): void {
    if (this.state.phase === 'escaped') {
      const nextIndex = this.currentLevelIndex + 1
      if (nextIndex < LEVELS.length) {
        this.currentLevelIndex = nextIndex
        this.state = initGameState(LEVELS[nextIndex], nextIndex)
        this.recomputeGaze()
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
      this.addMessage('You cannot go that way.')
      this.render()
      return
    }

    // Tile check
    const tile = levelDef.tiles[newY]?.[newX]
    if (tile === 'wall') {
      this.addMessage('A wall blocks your path.')
      this.render()
      return
    }

    // Statue check — opaque statues block movement
    const statueAtDest = statueStates.find(
      s => !s.isRestored && s.pos.x === newX && s.pos.y === newY
    )
    if (statueAtDest) {
      this.addMessage(`${statueAtDest.def.name} blocks the way. Push with P.`)
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
      this.addMessage('Nothing to inspect nearby.')
      this.render()
      return
    }

    if (adjacent.def.isTrap) {
      // Trigger trap
      const trapDamage = (adjacent.def.trapGazeRange ?? 1) * 5
      this.state.petrification = Math.min(100, this.state.petrification + trapDamage)
      this.addMessage(`It was a trap! You reel back. (+${trapDamage}% petrification)`)
      this.advanceTurn(`You approach ${adjacent.def.name}...`)
      return
    }

    // Normal statue inspect — costs a turn, then opens panel
    this.advanceTurn(`You inspect ${adjacent.def.name}.`)
    // After advanceTurn the statue reference is still valid (we just advanced state)
    const statueState = this.state.statueStates.find(s => s.def.id === adjacent.def.id)
    if (statueState) {
      this.state.phase = 'inspecting'
      this.state.inspectingStatue = statueState
      this.statuePanel.show(statueState)
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
      this.addMessage('Nothing to push there.')
      this.render()
      return
    }

    if (!statue.def.isPushable) {
      this.addMessage(`${statue.def.name} won't budge.`)
      this.render()
      return
    }

    const destX = targetX + dx
    const destY = targetY + dy

    // Bounds check
    if (destX < 0 || destY < 0 || destX >= levelDef.width || destY >= levelDef.height) {
      this.addMessage('No room to push her that way.')
      this.render()
      return
    }

    // Wall check
    if (levelDef.tiles[destY]?.[destX] === 'wall') {
      this.addMessage('A wall blocks the push.')
      this.render()
      return
    }

    // Another statue check
    const otherStatue = statueStates.find(
      s => !s.isRestored && s.pos.x === destX && s.pos.y === destY
    )
    if (otherStatue) {
      this.addMessage('Another statue is in the way.')
      this.render()
      return
    }

    // Execute push
    statue.pos = { x: destX, y: destY }
    this.advanceTurn(`You push ${statue.def.name}.`)
  }

  private handleUse(): void {
    const { inventory, playerPos, statueStates } = this.state

    if (inventory.length === 0) {
      this.addMessage('Your inventory is empty.')
      this.render()
      return
    }

    const itemIndex = inventory.indexOf('softening-oil')
    if (itemIndex === -1) {
      this.addMessage('Nothing usable in inventory.')
      this.render()
      return
    }

    // Check for adjacent restorable statue
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
      this.advanceTurn(`You pour Softening Oil on ${adjacentStatue.def.name}. She stirs.`)
    } else {
      // Use on self — reduce petrification
      inventory.splice(itemIndex, 1)
      const reduction = softeningOilEffect()
      this.state.petrification = Math.max(0, this.state.petrification - reduction)
      this.advanceTurn(`You apply Softening Oil. The stiffness recedes. (-${reduction}% petrification)`)
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
          this.addMessage(`The gorgon stirs, then retreats into the dark.`)
        }
        break
      }
      case 'open-path': {
        for (const tile of effect.tiles) {
          this.state.levelDef.tiles[tile.y][tile.x] = 'floor'
        }
        this.addMessage('A path opens.')
        break
      }
      case 'grant-item': {
        this.state.inventory.push('softening-oil')
        this.addMessage(`You receive ${effect.itemId}.`)
        break
      }
      case 'spawn-enemy': {
        const enemyDef: EnemyDefinition = effect.enemy
        this.state.enemyStates.push({
          def: enemyDef,
          pos: { x: enemyDef.x, y: enemyDef.y },
          facing: enemyDef.gazePattern.facing,
        })
        this.addMessage('Something awakens...')
        break
      }
      case 'none':
        break
    }
  }

  // ─── Turn Advancement ──────────────────────────────────────────────────────

  private advanceTurn(actionMessage: string): void {
    const s = this.state

    this.addMessage(actionMessage)

    // Increment turns
    s.turns++

    // Check soft limit
    if (!s.softLimitReached && s.turns >= s.levelDef.softTurnLimit) {
      s.softLimitReached = true
      this.addMessage('The labyrinth grows heavier. Each step costs more.')
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

    // Apply gaze petrification
    const gazeDmg = gazeCost(s.activeGazeTiles, s.playerPos)
    if (gazeDmg > 0) {
      s.petrification = Math.min(100, s.petrification + gazeDmg)
      this.addMessage(`You are caught in a gaze! (+${gazeDmg}% petrification)`)
    }

    // Pick up items on player tile
    for (const item of s.itemStates) {
      if (!item.consumed && item.pos.x === s.playerPos.x && item.pos.y === s.playerPos.y) {
        item.consumed = true
        s.inventory.push(item.itemType)
        const label = item.itemType === 'softening-oil' ? 'Softening Oil' : item.itemType
        this.addMessage(`You pick up ${label}.`)
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
      this.addMessage(`Something stirs in the dark — a ${enemyDef.type} appears!`)
    }

    // Proximity unlocks for adjacent statues
    for (const statue of s.statueStates) {
      if (statue.isRestored) continue
      const dist = Math.abs(statue.pos.x - s.playerPos.x) + Math.abs(statue.pos.y - s.playerPos.y)
      if (dist <= 1) {
        statue.turnsAdjacent++
        // Check turns-adjacent unlock conditions
        const def = statue.def
        for (let i = statue.unlockedStageIndex + 1; i < def.memoryStages.length; i++) {
          const cond = def.memoryStages[i].unlockCondition
          if (cond.type === 'turns-adjacent' && statue.turnsAdjacent >= cond.turns) {
            statue.unlockedStageIndex = i
            this.addMessage(`A new memory stirs within ${def.name}...`)
            break
          }
        }
      }
    }

    // Check win condition
    const currentTile = s.levelDef.tiles[s.playerPos.y]?.[s.playerPos.x]
    if (currentTile === 'exit') {
      s.phase = 'escaped'
      this.addMessage('You reach the exit!')
      this.render()
      return
    }

    // Check lose condition
    if (s.petrification >= 100) {
      s.phase = 'game-over'
      this.addMessage('You have fully petrified.')
      this.render()
      return
    }

    this.render()
  }

  private addMessage(msg: string): void {
    // Prepend so newest is at index 0
    this.state.messages.unshift(msg)
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
    this.drawUI()
    this.drawOverlays()
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

    // Exit glow label
    for (let ty = 0; ty < levelDef.height; ty++) {
      for (let tx = 0; tx < levelDef.width; tx++) {
        if (levelDef.tiles[ty]?.[tx] === 'exit') {
          const { px, py } = this.tileToPixel(tx, ty)
          g.fillStyle(0x00ff88, 0.15)
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE)
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

    const { statueStates, enemyStates, itemStates, playerPos } = this.state

    // Items (depth 2)
    for (const item of itemStates) {
      if (item.consumed) continue
      const { px, py } = this.tileToPixel(item.pos.x, item.pos.y)
      const cx = px + TILE_SIZE / 2
      const cy = py + TILE_SIZE / 2
      const circle = this.add.circle(cx, cy, 8, 0xffdd00)
      circle.setDepth(2)
      this.entityObjects.push(circle)
    }

    // Statues (depth 3)
    for (const statue of statueStates) {
      if (statue.isRestored) continue
      const { px, py } = this.tileToPixel(statue.pos.x, statue.pos.y)
      const size = TILE_SIZE * 0.8
      const offset = (TILE_SIZE - size) / 2
      const rect = this.add.rectangle(
        px + TILE_SIZE / 2, py + TILE_SIZE / 2,
        size, size,
        statue.def.isPushable ? 0x7777bb : 0x5555aa
      )
      rect.setDepth(3)
      // Name initial
      const initial = this.add.text(
        px + TILE_SIZE / 2, py + TILE_SIZE / 2,
        statue.def.name[0],
        { fontSize: '14px', color: '#ccccff', fontStyle: 'bold' }
      ).setOrigin(0.5, 0.5)
      initial.setDepth(3)
      this.entityObjects.push(rect, initial)
    }

    // Enemies (depth 4)
    for (const enemy of enemyStates) {
      const { px, py } = this.tileToPixel(enemy.pos.x, enemy.pos.y)
      const size = TILE_SIZE * 0.75
      const rect = this.add.rectangle(
        px + TILE_SIZE / 2, py + TILE_SIZE / 2,
        size, size,
        0xcc2222
      )
      rect.setDepth(4)

      // Facing indicator — small bright triangle/dot in facing direction
      const facingOffsets: Record<string, [number, number]> = {
        N: [0, -12], E: [12, 0], S: [0, 12], W: [-12, 0]
      }
      const [fox, foy] = facingOffsets[enemy.facing] ?? [0, 0]
      const indicator = this.add.rectangle(
        px + TILE_SIZE / 2 + fox,
        py + TILE_SIZE / 2 + foy,
        6, 6, 0xff6666
      )
      indicator.setDepth(4)

      // Enemy type initial
      const typeInitial: Record<string, string> = {
        'lesser-gorgon': 'G',
        'watcher': 'W',
        'gaze-trap': 'T',
        'sentinel': 'S',
        'boss': 'B',
      }
      const label = this.add.text(
        px + TILE_SIZE / 2, py + TILE_SIZE / 2,
        typeInitial[enemy.def.type] ?? '?',
        { fontSize: '16px', color: '#ffaaaa', fontStyle: 'bold' }
      ).setOrigin(0.5, 0.5)
      label.setDepth(4)

      this.entityObjects.push(rect, indicator, label)
    }

    // Player (depth 5)
    const { px: ppx, py: ppy } = this.tileToPixel(playerPos.x, playerPos.y)
    const playerCircle = this.add.circle(
      ppx + TILE_SIZE / 2, ppy + TILE_SIZE / 2,
      TILE_SIZE * 0.35,
      0xffffff
    )
    playerCircle.setDepth(5)
    const playerDot = this.add.circle(
      ppx + TILE_SIZE / 2, ppy + TILE_SIZE / 2,
      4, 0x1a1a2e
    )
    playerDot.setDepth(5)
    this.entityObjects.push(playerCircle, playerDot)
  }

  private drawUI(): void {
    // Destroy previous UI texts
    for (const obj of this.uiTexts) {
      (obj as Phaser.GameObjects.Text).destroy()
    }
    this.uiTexts = []

    const ug = this.uiGraphics
    ug.clear()

    const { levelDef, turns, petrification, inventory, phase, messages } = this.state
    const panelW = 1024 - UI_X
    const panelH = 640

    // Panel background
    ug.fillStyle(0x111122)
    ug.fillRect(UI_X, 0, panelW, panelH)
    ug.lineStyle(1, 0x333355)
    ug.strokeRect(UI_X, 0, panelW, panelH)

    let ty = 12
    const tx = UI_X + 10
    const textWidth = panelW - 20

    const addText = (text: string, opts: Phaser.Types.GameObjects.Text.TextStyle, x = tx, y = ty): Phaser.GameObjects.Text => {
      const t = this.add.text(x, y, text, opts)
      t.setDepth(10)
      this.uiTexts.push(t)
      return t
    }

    // Level name
    addText(levelDef.name, { fontSize: '18px', color: '#aaaaee', fontStyle: 'bold' })
    ty += 28

    // Turns
    const softStr = this.state.softLimitReached ? ' [LIMIT REACHED]' : ` / ${levelDef.softTurnLimit}`
    addText(`Turn: ${turns}${softStr}`, { fontSize: '13px', color: '#888899' })
    ty += 20

    // Petrification label
    addText('Petrification:', { fontSize: '13px', color: '#aaaaaa' })
    ty += 18

    // Petrification bar
    const barX = tx
    const barY = ty
    const barW = textWidth
    const barH = 16
    ug.fillStyle(0x333333)
    ug.fillRect(barX, barY, barW, barH)
    const fillW = Math.round((petrification / 100) * barW)
    // Colour interpolates: green → yellow → red
    const barColor = petrification < 40 ? 0x44cc44
      : petrification < 70 ? 0xcccc22
      : petrification < 90 ? 0xcc6622
      : 0xcc2222
    ug.fillStyle(barColor)
    ug.fillRect(barX, barY, fillW, barH)
    ug.lineStyle(1, 0x555566)
    ug.strokeRect(barX, barY, barW, barH)
    addText(`${petrification}%`, { fontSize: '11px', color: '#ffffff' }, barX + 4, barY + 2)
    ty += barH + 4

    // Threshold label
    const label = thresholdLabel(petrification)
    const labelColor = petrification < 40 ? '#88cc88'
      : petrification < 70 ? '#cccc44'
      : petrification < 90 ? '#cc8844'
      : '#cc4444'
    addText(label, { fontSize: '12px', color: labelColor, fontStyle: 'italic' }, tx, ty)
    ty += 20

    // Phase indicator (push-pending etc.)
    if (phase === 'push-pending' || this.pushPending) {
      addText('> Push mode active', { fontSize: '12px', color: '#ffdd44' }, tx, ty)
      ty += 18
    }

    ty += 6
    // Inventory
    addText('Inventory:', { fontSize: '13px', color: '#aaaaaa' })
    ty += 18
    if (inventory.length === 0) {
      addText('(empty)', { fontSize: '12px', color: '#555566' }, tx, ty)
      ty += 16
    } else {
      for (const item of inventory) {
        const itemLabel = item === 'softening-oil' ? 'Softening Oil' : item
        addText(`· ${itemLabel}`, { fontSize: '12px', color: '#ffdd88' }, tx, ty)
        ty += 16
      }
    }

    ty += 6
    // Divider
    ug.lineStyle(1, 0x333355)
    ug.lineBetween(UI_X + 6, ty, UI_X + panelW - 6, ty)
    ty += 8

    // Message log label
    addText('Log:', { fontSize: '12px', color: '#666677' }, tx, ty)
    ty += 16

    // Message log
    this.messageLog.destroy()
    this.messageLog = new MessageLog(this, tx, ty, textWidth)
    this.messageLog.update(messages)

    // Controls hint at bottom
    const hintY = 600
    ug.fillStyle(0x1a1a2e)
    ug.fillRect(UI_X, hintY, panelW, 40)
    addText('Arrow/WASD: Move   I: Inspect', { fontSize: '11px', color: '#444455' }, tx, hintY + 4)
    addText('P: Push   U: Use item', { fontSize: '11px', color: '#444455' }, tx, hintY + 16)
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
    // Semi-transparent dark overlay covering grid area only
    const gridW = GRID_OFFSET_X + this.state.levelDef.width * TILE_SIZE + GRID_OFFSET_X
    const g = this.graphics
    g.fillStyle(0x000000, 0.65)
    g.fillRect(0, 0, gridW, 640)

    const cx = gridW / 2
    const headlineText = this.add.text(cx, 280, headline, {
      fontSize: '36px',
      color: headlineColor,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(90)

    const subtextObj = this.add.text(cx, 330, subtext, {
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0.5).setDepth(90)

    this.entityObjects.push(headlineText, subtextObj)
  }
}
