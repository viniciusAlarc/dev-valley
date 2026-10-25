import Phaser from 'phaser';
import type { SessionStatus } from '../api';

type Activity = SessionStatus | 'offline';

/** Balão sobre a cabeça: "..." trabalhando, "!" pedindo permissão, nada quando parado. */
export class StatusBubble {
  readonly container: Phaser.GameObjects.Container;
  private working: Phaser.GameObjects.Container;
  private alert: Phaser.GameObjects.Image;
  private alertTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    const dots = [0, 1, 2].map((i) => scene.add.rectangle(-4 + i * 4, -8, 2, 2, 0x3b2312));
    dots.forEach((d, i) => scene.tweens.add({ targets: d, y: d.y - 2, yoyo: true, repeat: -1, duration: 300, delay: i * 150 }));
    this.working = scene.add.container(0, 0, [scene.add.image(0, -6, 'bubble'), ...dots]);
    this.alert = scene.add.image(0, -8, 'alert');
    this.alertTween = scene.tweens.add({ targets: this.alert, y: -11, yoyo: true, repeat: -1, duration: 260, ease: 'Sine.inOut', paused: true });
    this.container = scene.add.container(0, 0, [this.working, this.alert]).setDepth(100000);
    this.set('offline');
  }

  set(activity: Activity) {
    this.working.setVisible(activity === 'working');
    this.alert.setVisible(activity === 'permission');
    if (activity === 'permission') this.alertTween.resume();
    else this.alertTween.pause();
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  destroy() {
    this.alertTween.remove();
    this.container.destroy();
  }
}
