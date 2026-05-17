/**
 * HtmlBridge.ts — DOM update bridge between GameScene and the HTML UI panels
 *
 * Exports:
 *   HtmlBridge: class with methods called by GameScene to update all HTML panels
 *
 * Definitions:
 *   updateStats(state): updates floor, turns, petrif bar, stage, inventory, companion
 *   showStatuePanel(statue, stage): populates and shows the right-panel statue inspect view
 *   hideStatuePanel(): hides statue panel
 *   pushMessage(text, type): prepends a message to the log ('normal'|'danger'|'good')
 *   showMenu(title, options, selectedIndex): shows interaction menu with options
 *   updateMenuSelection(selectedIndex): updates highlighted menu option
 *   hideMenu(): hides interaction menu
 *
 * Invariants:
 *   - All DOM element lookups are cached in constructor (fail-fast if element missing).
 *   - HtmlBridge never reads GameState directly; all data is passed as arguments.
 *   - Message log shows newest message first, keeps last 20 entries.
 */
import type { GameState } from '../systems/levelLoader'
import type { StatueState } from '../types/state'
import { thresholdLabel } from '../systems/petrification'

type MessageType = 'normal' | 'danger' | 'good'

export class HtmlBridge {
  private elFloor: HTMLElement
  private elTurns: HTMLElement
  private petrifFill: HTMLElement
  private petrifLabel: HTMLElement
  private elStage: HTMLElement
  private invList: HTMLElement
  private companionBox: HTMLElement
  private companionName: HTMLElement
  private companionStatus: HTMLElement
  private statuePanelBox: HTMLElement
  private statuePortraitBox: HTMLElement
  private statueName: HTMLElement
  private statueMeta: HTMLElement
  private inspectionLines: HTMLElement
  private msgList: HTMLElement
  private menuBox: HTMLElement
  private menuHeader: HTMLElement
  private menuOptionsList: HTMLElement

  private messages: { text: string; type: MessageType }[] = []

  constructor() {
    this.elFloor = this.el('stat-floor')
    this.elTurns = this.el('stat-turns')
    this.petrifFill = this.el('petrif-bar-fill')
    this.petrifLabel = this.el('petrif-label')
    this.elStage = this.el('stat-stage')
    this.invList = this.el('inventory-list')
    this.companionBox = this.el('companion-box')
    this.companionName = this.el('companion-name')
    this.companionStatus = this.el('companion-status')
    this.statuePanelBox = this.el('statue-panel-box')
    this.statuePortraitBox = this.el('statue-portrait-box')
    this.statueName = this.el('statue-name')
    this.statueMeta = this.el('statue-meta')
    this.inspectionLines = this.el('inspection-lines')
    this.msgList = this.el('message-list')
    this.menuBox = this.el('interaction-menu-box')
    this.menuHeader = this.el('menu-header')
    this.menuOptionsList = this.el('menu-options-list')
  }

  private el(id: string): HTMLElement {
    const el = document.getElementById(id)
    if (!el) throw new Error(`HtmlBridge: element #${id} not found`)
    return el
  }

  updateStats(state: GameState): void {
    this.elFloor.textContent = state.levelDef.name
    this.elTurns.textContent = String(state.turns)
    const pct = Math.min(100, state.petrification)
    this.petrifFill.style.width = `${pct}%`
    const color = pct < 40 ? '#6644aa' : pct < 70 ? '#aa4488' : pct < 90 ? '#cc3333' : '#ff2222'
    this.petrifFill.style.background = color
    this.petrifLabel.textContent = thresholdLabel(pct)
    this.elStage.textContent = state.softLimitReached ? 'Urgent' : 'Normal'

    // Inventory
    if (state.inventory.length === 0) {
      this.invList.innerHTML = '<span style="color:#444">empty</span>'
    } else {
      this.invList.innerHTML = state.inventory
        .map(item => `<div class="inv-item">${item === 'softening-oil' ? '🧴 Softening Oil' : item}</div>`)
        .join('')
    }

    // Companion
    if (state.companion) {
      this.companionBox.classList.add('active')
      const statueState = state.statueStates.find(s => s.def.id === state.companion!.sourceStatueId)
      this.companionName.textContent = statueState?.def.name ?? 'Companion'
      this.companionStatus.textContent = 'following'
    } else {
      this.companionBox.classList.remove('active')
    }
  }

  showStatuePanel(statue: StatueState): void {
    const def = statue.def
    const stage = def.memoryStages[statue.unlockedStageIndex]

    this.statueName.textContent = def.name
    this.statueMeta.textContent = `${def.material} · ${def.job}`

    // Portrait
    if (def.portraitKey) {
      this.statuePortraitBox.innerHTML = `<img src="assets/portraits/${def.portraitKey}.png" alt="${def.name}" />`
    } else {
      this.statuePortraitBox.innerHTML = '<span>[portrait]</span>'
    }

    // Inspection lines
    if (stage) {
      this.inspectionLines.innerHTML = stage.lines.map(line =>
        `<div class="inspection-line">
          <div class="inspection-label">${line.label}</div>
          <div class="inspection-text">${line.text}</div>
        </div>`
      ).join('')
    } else {
      this.inspectionLines.innerHTML = ''
    }

    this.statuePanelBox.classList.add('visible')
  }

  hideStatuePanel(): void {
    this.statuePanelBox.classList.remove('visible')
  }

  showMenu(title: string, options: string[], selectedIndex: number): void {
    this.menuHeader.textContent = title
    this.menuOptionsList.innerHTML = options
      .map((opt, i) =>
        `<div class="menu-option${i === selectedIndex ? ' selected' : ''}">${opt}</div>`
      )
      .join('')
    ;(this.menuBox as HTMLElement).style.display = 'block'
  }

  updateMenuSelection(selectedIndex: number): void {
    const divs = this.menuOptionsList.querySelectorAll('.menu-option')
    divs.forEach((div, i) => {
      div.classList.toggle('selected', i === selectedIndex)
    })
  }

  hideMenu(): void {
    ;(this.menuBox as HTMLElement).style.display = 'none'
    this.menuHeader.textContent = ''
    this.menuOptionsList.innerHTML = ''
  }

  pushMessage(text: string, type: MessageType = 'normal'): void {
    this.messages.unshift({ text, type })
    if (this.messages.length > 20) this.messages.length = 20
    this.renderMessages()
  }

  private renderMessages(): void {
    this.msgList.innerHTML = this.messages
      .map((m, i) => `<div class="msg ${i === 0 ? 'recent' : ''} ${m.type}">${m.text}</div>`)
      .join('')
  }
}
