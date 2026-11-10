import Phaser from 'phaser';
import { ui } from '../ui/actions';
import { label, makeInteractive } from './common';
import { generateClinicTextures, generateInteriorTextures } from './interiorTextures';
import { MEDICA_ID } from './villagerArt';
import { villagerTexture } from './villager';

const W = 288;
const H = 176;
const WALL_H = 40;

/**
 * A clínica por dentro (decisão do usuário, 09/11/2026): maca de triagem (os moradores vivos), armário e a
 * mesa da médica. A médica e a maca abrem a triagem; de lá se escolhe quem ela examina.
 * Armário dos "pacientes esquecidos" (etapa 2, CL-1): o que roda fora da vila. Só aponta; quem encerra é o usuário.
 */
export class ClinicaScene extends Phaser.Scene {
  private instant = false;

  constructor() {
    super('clinica');
  }

  init(data: { instant?: boolean }) {
    this.instant = !!data.instant;
  }

  create() {
    generateInteriorTextures(this);
    generateClinicTextures(this);
    this.cameras.main.setBackgroundColor('#1a120b');
    ui.setLocation('Clínica', 'Triagem (maca) à esquerda · consultório (médica, armário) à direita · Esc ou tapete para sair');

    const onResize = () => this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!ui.isPanelOpen()) this.leave();
    });
    if (!this.instant) this.cameras.main.fadeIn(250);
    this.buildRoom();
  }

  private leave() {
    ui.hideTooltip();
    this.cameras.main.fadeOut(200);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      ui.setLocation(null);
      this.scene.stop();
      this.scene.wake('town');
    });
  }

  private prop(key: string, x: number, y: number) {
    return this.add.image(Math.round(x), Math.round(y), key).setOrigin(0.5, 1).setDepth(y);
  }

  private buildRoom() {
    this.add.tileSprite(0, WALL_H, W, H - WALL_H, 'clinicFloor').setOrigin(0).setDepth(-20);
    this.add.tileSprite(0, 0, W, WALL_H, 'clinicWall').setOrigin(0).setDepth(-19);
    const frame = this.add.graphics().setDepth(99999);
    frame.fillStyle(0x3a2412).fillRect(-6, 0, 6, H).fillRect(W, 0, 6, H).fillRect(-6, H, W + 12, 6);
    frame.fillRect(0, H - 4, W / 2 - 18, 4).fillRect(W / 2 + 18, H - 4, W / 2 - 18, 4);

    // Planta (09/11/2026, decisão do usuário: estava mal distribuída): triagem à esquerda (a maca; o monitor de sinais vitais saiu em 10/11/2026),
    // consultório à direita (mesa da médica com o armário na parede atrás dela) e o corredor do meio livre da porta ao fundo.
    // Rótulos dos dois lados na mesma linha. Larguras: maca e mesa 56, armário 28; rótulo de 8px ≈ 4px por letra.
    const chaoY = WALL_H + 72; // pé da maca e da mesa
    const rotuloY = chaoY + 9;

    // ---- triagem, à esquerda ----
    const macaX = W - 196; // espelho da mesa da médica em relação ao corredor
    const maca = this.prop('maca', macaX, chaoY);
    makeInteractive(maca, () => 'Maca de triagem — quem está vivo agora e o que cada um roda; escolha quem a médica examina', () => ui.openTriagem());
    label(this, macaX, rotuloY, 'Triagem', rotuloY);

    // ---- consultório, à direita ----
    const mesaX = W - 92;
    const medica = this.add
      .sprite(mesaX, chaoY - 8, villagerTexture(this, MEDICA_ID, true), 0)
      .setOrigin(0.5, 1)
      .setDepth(chaoY - 10);
    makeInteractive(
      medica,
      () => '✦ Dra. Lia — médica da clínica\n"Alguém demorando? Eu examino e digo se é para esperar ou intervir."',
      () => ui.openTriagem(),
    );
    this.prop('mesaMedica', mesaX, chaoY);
    label(this, mesaX, rotuloY, 'Médica', rotuloY);
    // NPCs especiais (agentes, não sessões) ganham uma estrela dourada flutuando.
    const star = this.add.text(mesaX + 7, chaoY - 42, '✦', { fontFamily: 'serif', fontSize: '10px', color: '#f7d046', resolution: 4 }).setOrigin(0.5).setDepth(100000);
    star.setStroke('#5e3a1c', 2);
    this.tweens.add({ targets: star, y: star.y - 3, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

    const armarioX = W - 44;
    const armarioY = WALL_H + 34;
    const armario = this.prop('armarioRemedios', armarioX, armarioY);
    makeInteractive(
      armario,
      () => 'Armário — pacientes esquecidos: Claude e servidores rodando fora da vila, containers Docker de pé',
      () => ui.openArmario(),
    );
    label(this, armarioX, armarioY + 9, 'Armário', armarioY + 9);

    // Vasos nos cantos do fundo, longe das peças.
    this.prop('plant', 14, WALL_H + 22);
    this.prop('plant', W - 14, WALL_H + 22);

    const mat = this.prop('doormat', W / 2, H + 2);
    makeInteractive(mat, () => 'Sair (Esc)', () => this.leave());
    this.frameCamera();
  }

  private frameCamera() {
    const { width, height } = this.scale.gameSize;
    const cam = this.cameras.main;
    cam.setSize(width, height);
    cam.setZoom(Phaser.Math.Clamp(Math.min(width / (W + 48), (height - 40) / (H + 56)), 1.5, 4));
    cam.centerOn(W / 2, (H + 8) / 2);
  }
}
