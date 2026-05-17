/**
 * main.ts — Phaser game boot and configuration
 *
 * Definitions:
 *   Game config: 1040×848 canvas, WebGL renderer, #0d0d1a background, parent 'game'
 *   Canvas is the grid-only view; all UI panels are in HTML (see index.html)
 *
 * Invariants:
 *   - Only GameScene is registered; MenuScene deferred.
 *   - autoFocus true for immediate keyboard capture.
 *   - pixelArt mode enabled; antialias disabled for crisp procedural sprites.
 */
import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1040,
  height: 848,
  backgroundColor: '#0d0d1a',
  parent: 'game',
  scene: [GameScene],
  autoFocus: true,
  render: {
    antialias: false,
    pixelArt: true,
  },
})
