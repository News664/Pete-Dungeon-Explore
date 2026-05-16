/**
 * main.ts — Phaser game boot and configuration
 *
 * Definitions:
 *   Game config: 1024×640 canvas, WebGL renderer, #1a1a2e background, parent 'game'
 *
 * Invariants:
 *   - Only GameScene is registered; MenuScene deferred.
 *   - autoFocus true for immediate keyboard capture.
 */
import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1024,
  height: 640,
  backgroundColor: '#1a1a2e',
  parent: 'game',
  scene: [GameScene],
  autoFocus: true,
})
