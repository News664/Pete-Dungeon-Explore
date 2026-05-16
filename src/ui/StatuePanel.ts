/**
 * StatuePanel.ts — Phaser UI overlay shown when player inspects a statue
 *
 * Definitions:
 *   StatuePanel: modal panel covering centre of screen
 *     shows portrait placeholder, name, material, pose, backstory, memory text
 *
 * Invariants:
 *   - Shown only when GameState.phase === 'inspecting'.
 *   - Closed on any key press (handled in GameScene, which calls hide()).
 *   - portraitKey undefined → renders a labelled grey rectangle as placeholder.
 *   - Memory text shown is memoryStages[unlockedStageIndex].text.
 */
import Phaser from 'phaser'
import type { StatueState } from '../types/state'

export class StatuePanel {
  private container: Phaser.GameObjects.Container
  private scene: Phaser.Scene
  private visible: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = scene.add.container(0, 0)
    this.container.setVisible(false)
    this.container.setDepth(100)
  }

  show(statue: StatueState): void {
    this.container.removeAll(true)

    const panelW = 500
    const panelH = 400
    const cx = (this.scene.scale.width - panelW) / 2
    const cy = (this.scene.scale.height - panelH) / 2

    // Background
    const bg = this.scene.add.rectangle(cx + panelW / 2, cy + panelH / 2, panelW, panelH, 0x1a1a2e, 0.97)
    const border = this.scene.add.rectangle(cx + panelW / 2, cy + panelH / 2, panelW, panelH)
    border.setStrokeStyle(2, 0x8888aa)
    border.setFillStyle(0x000000, 0) // transparent fill

    // Portrait area (left side)
    const portraitW = 140
    const portraitH = 180
    const portraitX = cx + 16
    const portraitY = cy + 16

    const portraitBg = this.scene.add.rectangle(
      portraitX + portraitW / 2,
      portraitY + portraitH / 2,
      portraitW,
      portraitH,
      0x333355
    )

    const objects: Phaser.GameObjects.GameObject[] = [bg, border, portraitBg]

    if (statue.def.portraitKey) {
      const img = this.scene.add.image(portraitX + portraitW / 2, portraitY + portraitH / 2, statue.def.portraitKey)
      img.setDisplaySize(portraitW, portraitH)
      objects.push(img)
    } else {
      const label = this.scene.add.text(
        portraitX + portraitW / 2,
        portraitY + portraitH / 2,
        '[portrait]',
        { fontSize: '13px', color: '#666688' }
      ).setOrigin(0.5, 0.5)
      objects.push(label)
    }

    // Text area (right of portrait)
    const textX = cx + portraitW + 28
    const textW = panelW - portraitW - 44
    const s = statue.def

    const nameText = this.scene.add.text(textX, cy + 16, s.name, {
      fontSize: '20px', color: '#eeeeff', fontStyle: 'bold'
    })
    const materialText = this.scene.add.text(textX, cy + 42, `${s.material} · ${s.pose}`, {
      fontSize: '12px', color: '#aaaacc', wordWrap: { width: textW }
    })
    const backstoryText = this.scene.add.text(textX, cy + 80, s.backstory, {
      fontSize: '13px', color: '#bbbbbb', wordWrap: { width: textW }
    })

    const memoryY = cy + portraitH + 32
    const memoryStage = s.memoryStages[statue.unlockedStageIndex]
    const memoryLabel = this.scene.add.text(cx + 16, memoryY, 'Memory:', {
      fontSize: '13px', color: '#8888cc', fontStyle: 'italic'
    })
    const memoryText = this.scene.add.text(cx + 16, memoryY + 20, memoryStage?.text ?? '', {
      fontSize: '13px', color: '#ccccee', wordWrap: { width: panelW - 32 }
    })

    // Restoration hint if applicable
    if (s.restorationCondition) {
      const restoreHint = this.scene.add.text(cx + 16, memoryY + 60, `Restoration: ${s.restorationCondition}`, {
        fontSize: '12px', color: '#88cc88', wordWrap: { width: panelW - 32 }, fontStyle: 'italic'
      })
      objects.push(restoreHint)
    }

    const closeHint = this.scene.add.text(cx + panelW / 2, cy + panelH - 16, 'Press any key to close', {
      fontSize: '12px', color: '#666666'
    }).setOrigin(0.5, 1)

    objects.push(nameText, materialText, backstoryText, memoryLabel, memoryText, closeHint)
    this.container.add(objects)
    this.container.setVisible(true)
    this.visible = true
  }

  hide(): void {
    this.container.setVisible(false)
    this.container.removeAll(true)
    this.visible = false
  }

  isVisible(): boolean { return this.visible }
}
