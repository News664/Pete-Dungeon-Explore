/**
 * MessageLog.ts — Phaser UI component for the scrolling message log
 *
 * Definitions:
 *   MessageLog: renders the last N messages as stacked text in the UI panel
 *
 * Invariants:
 *   - Shows at most MAX_VISIBLE messages at once.
 *   - Most recent message is at the top.
 *   - Each message is a single line; long messages wrap at panel width.
 */
import Phaser from 'phaser'

const MAX_VISIBLE = 10

export class MessageLog {
  private texts: Phaser.GameObjects.Text[] = []
  private scene: Phaser.Scene
  private x: number
  private y: number
  private width: number

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.width = width
  }

  update(messages: string[]): void {
    this.texts.forEach(t => t.destroy())
    this.texts = []
    const visible = messages.slice(0, MAX_VISIBLE)
    visible.forEach((msg, i) => {
      const alpha = i === 0 ? 1 : Math.max(0.3, 1 - i * 0.08)
      const t = this.scene.add.text(this.x, this.y + i * 20, msg, {
        fontSize: '13px',
        color: '#cccccc',
        wordWrap: { width: this.width },
      })
      t.setAlpha(alpha)
      this.texts.push(t)
    })
  }

  destroy(): void {
    this.texts.forEach(t => t.destroy())
    this.texts = []
  }
}
