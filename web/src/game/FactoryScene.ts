import Phaser from 'phaser';
import { getWorld, plugins } from '../api';
import { ui } from '../ui/actions';
import { label, makeInteractive } from './common';
import { generateFactoryTextures, generateInteriorTextures, SWITCHBOARD } from './interiorTextures';

const W = 240;
const WALL_H = 40;
const H = 150;

/**
 * A Fábrica por dentro (decisão de 26/10/2026): a bancada abre os agentes, a parede de ferramentas abre as skills.
 * Os NPCs ✦ dos agentes continuam no pátio, do lado de fora.
 */
export class FactoryScene extends Phaser.Scene {
  private instant = false;

  constructor() {
    super('factory');
  }

  init(data: { instant?: boolean }) {
    this.instant = !!data.instant;
  }

  create() {
    generateInteriorTextures(this);
    generateFactoryTextures(this);
    this.cameras.main.setBackgroundColor('#1a120b');
    ui.setLocation('Fábrica', 'Bancada: agentes · parede de ferramentas: skills · quadro de força: plugins · Esc ou tapete para sair');

    const onResize = () => this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!ui.isPanelOpen()) this.leave();
    });
    if (!this.instant) this.cameras.main.fadeIn(250);

    // Tijolo e aço, como a fachada da Fábrica na vila.
    this.add.tileSprite(0, WALL_H, W, H - WALL_H, 'factoryFloor').setOrigin(0).setDepth(-20);
    this.add.tileSprite(0, 0, W, WALL_H, 'factoryWall').setOrigin(0).setDepth(-19);
    const frame = this.add.graphics().setDepth(99999);
    frame.fillStyle(0x3f464c).fillRect(-6, 0, 6, H).fillRect(W, 0, 6, H).fillRect(-6, H, W + 12, 6);
    frame.fillRect(0, H - 4, W / 2 - 18, 4).fillRect(W / 2 + 18, H - 4, W / 2 - 18, 4);
    this.add.image(60, 22, 'wallWindow').setDepth(-18);

    // ---- parede de ferramentas (skills), pendurada na parede ----
    const board = this.prop('pegboard', 168, WALL_H - 4);
    makeInteractive(
      board,
      () => `Parede de ferramentas — ${getWorld().skills.length} skill(s), globais e dos projetos — clique para abrir`,
      () => ui.openSkills(),
    );
    label(this, 168, WALL_H + 8, 'Skills', WALL_H + 8);

    // ---- quadro de força (plugins e MCP, só leitura), entre a janela e a parede de ferramentas ----
    this.buildSwitchboard(112, WALL_H - 6);

    // ---- bancada (agentes) ----
    const benchY = WALL_H + 62;
    const bench = this.prop('workbench', 80, benchY);
    makeInteractive(
      bench,
      () => {
        const n = getWorld().agents.filter((a) => !a.village).length;
        return `Bancada — ${n} agente(s), globais e dos projetos — clique para abrir`;
      },
      () => ui.openFactory(),
    );
    label(this, 80, benchY + 10, 'Agentes', benchY + 10);

    this.prop('plant', W - 14, WALL_H + 10);
    const mat = this.prop('doormat', W / 2, H + 2);
    makeInteractive(mat, () => 'Sair (Esc)', () => this.leave());
    this.frameCamera();
  }

  /** Uma alavanca por plugin (até cinco): para cima e verde = ligado, para baixo e vermelha = desligado. */
  private buildSwitchboard(x: number, y: number) {
    const box = this.prop('switchboard', x, y);
    let resumo = 'Quadro de força — plugins e MCP — clique para ver';
    makeInteractive(box, () => resumo, () => ui.openPlugins());
    label(this, x, WALL_H + 8, 'Plugins', WALL_H + 8);
    void plugins
      .list()
      .then((v) => {
        if (!this.scene.isActive()) return;
        const ligados = v.plugins.filter((p) => p.enabled).length;
        resumo = `Quadro de força — ${v.plugins.length} plugin(s), ${ligados} ligado(s), ${v.mcp.length} servidor(es) MCP — clique para ver`;
        const g = this.add.graphics().setDepth(box.depth + 1);
        const left = Math.round(x) - SWITCHBOARD.w / 2;
        const top = Math.round(y) - SWITCHBOARD.h;
        v.plugins.slice(0, SWITCHBOARD.slots.length).forEach((p, i) => {
          const sx = left + SWITCHBOARD.slots[i]!;
          const ky = top + (p.enabled ? SWITCHBOARD.top : SWITCHBOARD.bottom - 4);
          g.fillStyle(0xc9d1d8).fillRect(sx, ky + (p.enabled ? 3 : -1), 2, 2);
          g.fillStyle(p.enabled ? 0x4f9a32 : 0xc0392b).fillRect(sx - 1, ky, 4, 3);
        });
      })
      .catch(() => {
        resumo = 'Quadro de força — não deu para ler os plugins agora';
      });
  }

  private prop(key: string, x: number, y: number) {
    return this.add.image(Math.round(x), Math.round(y), key).setOrigin(0.5, 1).setDepth(y);
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

  private frameCamera() {
    const { width, height } = this.scale.gameSize;
    const cam = this.cameras.main;
    cam.setSize(width, height);
    cam.setZoom(Phaser.Math.Clamp(Math.min(width / (W + 48), (height - 40) / (H + 56)), 1.5, 4));
    cam.centerOn(W / 2, (H + 8) / 2);
  }
}
