import Phaser from 'phaser';
import { getWorld, noQuarto, onWorld, provedorDaSessao, type Project, type Session, type World } from '../api';
import { ui } from '../ui/actions';
import { timeAgo } from '../ui/panel';
import { label, makeInteractive } from './common';
import { generateInteriorTextures, generateQuartoTextures } from './interiorTextures';
import { villagerName } from './names';
import { villagerTexture, VILLAGER_W } from './villager';

const W = 288;
const WALL_H = 40;
const BED_COLS = 4;
const BED_SPACING_X = 62;
const FIRST_BED_Y = WALL_H + 52;
const BED_SPACING_Y = 52;
/** Até 12 camas (3 fileiras); quem passa disso aparece na placa e na escrivaninha conta todos. */
const MAX_BEDS = 12;
/** Cor da esclera do morador (`SCLERA` em villagerArt.ts): onde ela está, o olho é fechado. */
const SCLERA = [0xfb, 0xf6, 0xea];

/**
 * Quarto da casa (21/11/2026): quem a escrivaninha mandou dormir, cada um na sua cama. Dormir = processo encerrado, a
 * conversa fica; clicar na cama abre o chat, a sessão acorda e volta à sala (decisão do usuário). Entra pela porta da
 * parede direita da sala; sai pelo tapete ou Esc.
 */
export class QuartoScene extends Phaser.Scene {
  private projectId = '';
  private signature = '';
  private roomHeight = 0;
  private unsubscribe?: () => void;

  constructor() {
    super('quarto');
  }

  init(data: { projectId: string }) {
    this.projectId = data.projectId;
    this.signature = '';
  }

  create() {
    generateInteriorTextures(this);
    generateQuartoTextures(this);
    this.cameras.main.setBackgroundColor('#120d0a');
    this.unsubscribe = onWorld((w) => this.applyWorld(w));
    const onResize = () => this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.unsubscribe?.();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!ui.isPanelOpen()) this.leave();
    });
    this.applyWorld(getWorld());
    this.cameras.main.fadeIn(250);
  }

  private project(world: World): Project | undefined {
    return world.projects.find((p) => p.id === this.projectId);
  }

  /** Volta à sala (a casa só dormiu enquanto isso). */
  private leave() {
    ui.hideTooltip();
    this.cameras.main.fadeOut(200);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop();
      this.scene.wake('interior');
    });
  }

  private applyWorld(world: World) {
    const project = this.project(world);
    if (!project) return this.leave();
    const dormindo = noQuarto(world, this.projectId);
    const signature = JSON.stringify(dormindo.map((s) => s.id));
    if (signature === this.signature) return;
    this.signature = signature;
    this.buildRoom(project, dormindo);
  }

  private buildRoom(project: Project, dormindo: Session[]) {
    this.children.removeAll(true);
    this.tweens.killAll();
    ui.setLocation(`${project.name} · quarto`);

    const camas = dormindo.slice(0, MAX_BEDS);
    const fora = dormindo.length - camas.length;
    const rows = Math.max(1, Math.ceil(camas.length / BED_COLS));
    const H = FIRST_BED_Y + (rows - 1) * BED_SPACING_Y + 46;

    this.add.tileSprite(0, WALL_H, W, H - WALL_H, 'floor').setOrigin(0).setDepth(-20);
    this.add.tileSprite(0, 0, W, WALL_H, 'wall').setOrigin(0).setDepth(-19);
    const frame = this.add.graphics().setDepth(100000 - 1);
    frame.fillStyle(0x3a2412).fillRect(-6, 0, 6, H).fillRect(W, 0, 6, H).fillRect(-6, H, W + 12, 6);
    frame.fillStyle(0x3a2412).fillRect(0, H - 4, W / 2 - 18, 4).fillRect(W / 2 + 18, H - 4, W / 2 - 18, 4);
    this.add.image(W / 2, 22, 'nightWindow').setDepth(-18);
    this.add.image(W / 2, H - 30, 'rug').setDepth(-15).setAlpha(0.8);

    const placa = dormindo.length
      ? `${dormindo.length} dormindo${fora ? ` (+${fora} sem cama)` : ''}`
      : 'Ninguém dormindo';
    label(this, 52, 22, placa, 100);

    // Camas: as ocupadas primeiro; sem ninguém, uma fileira de camas feitas.
    const total = Math.max(BED_COLS, camas.length);
    for (let i = 0; i < Math.min(total, rows * BED_COLS); i++) {
      const col = i % BED_COLS;
      const row = Math.floor(i / BED_COLS);
      const x = W / 2 + (col - (BED_COLS - 1) / 2) * BED_SPACING_X;
      const y = FIRST_BED_Y + row * BED_SPACING_Y;
      if (col < BED_COLS - 1) this.prop('nightstand', x + BED_SPACING_X / 2, y - 14);
      const s = camas[i];
      if (!s) {
        this.prop('bedMade', x, y);
        continue;
      }
      this.deitar(s, x, y);
    }

    const mat = this.prop('doormat', W / 2, H + 2);
    makeInteractive(mat, () => 'Voltar à sala (Esc)', () => this.leave());

    this.roomHeight = H + 8;
    this.frameCamera();
  }

  /** Cama, cabeça no travesseiro de olhos fechados, colcha por cima e os "z" subindo. Clique acorda (abre o chat). */
  private deitar(s: Session, x: number, y: number) {
    const cama = this.prop('bed', x, y);
    const top = y - 38;
    const cabeca = this.cabecaDormindo(villagerTexture(this, s.id, false, s.genero, provedorDaSessao(s)));
    this.add.image(x, top + 2, cabeca).setOrigin(0.5, 0).setDepth(y + 0.1);
    this.add.image(x, y, 'bedBlanket').setOrigin(0.5, 1).setDepth(y + 0.2);
    const z = this.add.text(x + 9, top + 2, 'z', { fontFamily: 'Pixelify Sans', fontSize: '8px', color: '#e9c88f' }).setDepth(y + 1).setResolution(4);
    this.tweens.add({ targets: z, y: top - 8, alpha: { from: 1, to: 0 }, duration: 2200, repeat: -1, delay: (x * 7) % 1500 });
    makeInteractive(
      cama,
      () => `${villagerName(s.id)}: ${s.title}\n💤 dormindo, última atividade ${timeAgo(s.lastActivity)} — clique para acordar e abrir o chat`,
      () => ui.openSession(s),
    );
  }

  /**
   * A metade de cima do quadro de frente (cabeça e cabelo) com os olhos fechados: onde há esclera, a pele de entre os
   * olhos cobre o olho e a sobrancelha desce um pixel como pálpebra. Uma textura por aparência.
   */
  private cabecaDormindo(textura: string): string {
    const key = `${textura}-dormindo`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(textura).getSourceImage() as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = VILLAGER_W;
    c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, VILLAGER_W, 16, 0, 0, VILLAGER_W, 16);
    const img = ctx.getImageData(0, 0, VILLAGER_W, 16);
    const d = img.data;
    const at = (x: number, y: number) => (y * VILLAGER_W + x) * 4;
    const cor = (i: number) => [d[i], d[i + 1], d[i + 2], d[i + 3]];
    const pinta = (x: number, y: number, [r, g, b, a]: number[]) => {
      const i = at(x, y);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a;
    };
    const esclera = (x: number, y: number) => {
      const i = at(x, y);
      return d[i] === SCLERA[0] && d[i + 1] === SCLERA[1] && d[i + 2] === SCLERA[2] && d[i + 3] > 200;
    };
    // Tudo lido do quadro original antes de pintar: (x, y) de cada pixel de olho, a pele e a cor da pálpebra.
    const olhos: { x: number; y: number; pele: number[]; palpebra: number[] | null }[] = [];
    for (let y = 1; y < 15; y++) {
      for (let x = 1; x < VILLAGER_W - 1; x++) {
        if (!esclera(x, y)) continue;
        const pupila = x < VILLAGER_W / 2 ? x + 1 : x - 1;
        const topo = esclera(x, y - 1) ? y - 1 : y;
        // A linha de baixo do olho (o olho tem 2 de altura) vira a pálpebra fechada, na cor da sobrancelha.
        const palpebra = esclera(x, y + 1) ? null : cor(at(x, topo - 1));
        for (const px of [x, pupila]) olhos.push({ x: px, y, pele: cor(at(7, y)), palpebra });
      }
    }
    for (const o of olhos) pinta(o.x, o.y, o.palpebra ?? o.pele);
    ctx.putImageData(img, 0, 0);
    this.textures.addCanvas(key, c);
    return key;
  }

  private frameCamera() {
    const { width, height } = this.scale.gameSize;
    const cam = this.cameras.main;
    cam.setSize(width, height);
    cam.setZoom(Phaser.Math.Clamp(Math.min(width / (W + 48), (height - 40) / (this.roomHeight + 48)), 1.5, 4));
    cam.centerOn(W / 2, this.roomHeight / 2);
  }

  private prop(key: string, x: number, y: number) {
    return this.add.image(Math.round(x), Math.round(y), key).setOrigin(0.5, 1).setDepth(y);
  }
}
