import Phaser from 'phaser';
import type { Project, Session, World } from '../api';
import { ui } from '../ui/actions';
import { computeLayout, inRects, isPath, TILE, type Layout, type Plot, type Rect } from './layout';
import { villagerName } from './names';
import { generateTextures, hash, mulberry32, ROOFS, villagerTexture } from './textures';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Pixelify Sans", monospace',
  fontSize: '8px',
  color: '#3b2312',
  resolution: 4,
};

const ROOF_NAMES = Object.keys(ROOFS).filter((r) => r !== 'grey');

interface Villager {
  session: Session;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Container;
  area: Rect;
  walkAnim: string;
  timer?: Phaser.Time.TimerEvent;
}

interface HouseView {
  plot: Plot;
  glows: Phaser.GameObjects.Image[];
  badge?: Phaser.GameObjects.Container;
  badgeText?: Phaser.GameObjects.Text;
}

/** Diferencia clique de arraste (o arraste move a câmera). */
function isClick(pointer: Phaser.Input.Pointer) {
  return pointer.getDistance() < 6 && pointer.getDuration() < 500;
}

export class TownScene extends Phaser.Scene {
  private layout!: Layout;
  private projectKey = '';
  private houses = new Map<string, HouseView>();
  private villagers = new Map<string, Villager>();
  private world: World = { projects: [], sessions: [] };
  private ready = false;
  private pendingWorld: World | null = null;
  private keys?: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('town');
  }

  create() {
    generateTextures(this);
    this.input.keyboard!.disableGlobalCapture();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as any;

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 1.5, 6));
    });
    this.scale.on('resize', () => this.clampCamera());

    this.ready = true;
    if (this.pendingWorld) this.applyWorld(this.pendingWorld);
  }

  update(_t: number, dt: number) {
    if (!this.keys || ui.isPanelOpen()) return;
    const k = this.keys;
    const speed = (dt * 0.4) / this.cameras.main.zoom;
    const cam = this.cameras.main;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= speed;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += speed;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= speed;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += speed;
  }

  applyWorld(world: World) {
    // O mundo pode chegar pelo WebSocket antes de o Phaser terminar de iniciar a cena.
    if (!this.ready) {
      this.pendingWorld = world;
      return;
    }
    this.world = world;
    const projectKey = world.projects.map((p) => `${p.id}:${p.isGit}`).join('|');
    if (projectKey !== this.projectKey) {
      this.projectKey = projectKey;
      this.buildTown(world.projects);
    }
    for (const view of this.houses.values()) {
      const project = world.projects.find((p) => p.id === view.plot.project.id);
      if (project) this.updateHouse(view, project);
    }
    this.syncVillagers(world.sessions);
  }

  // ---------------- construção do mapa ----------------

  private buildTown(projects: Project[]) {
    for (const v of this.villagers.values()) v.timer?.remove();
    this.villagers.clear();
    this.houses.clear();
    this.children.removeAll(true);

    const layout = (this.layout = computeLayout(projects));
    const rnd = mulberry32(42);
    const wT = layout.width / TILE;
    const hT = layout.height / TILE;

    const ground = this.add.renderTexture(0, 0, layout.width, layout.height).setOrigin(0).setDepth(-10);
    ground.beginDraw();
    for (let y = 0; y < hT; y++)
      for (let x = 0; x < wT; x++) {
        const k = `${x},${y}`;
        const tex = layout.stone.has(k) ? 'stone' : layout.dirt.has(k) ? 'dirt' : `grass${Math.floor(rnd() * 3)}`;
        ground.batchDraw(tex, x * TILE, y * TILE);
      }
    ground.endDraw();

    // floresta na borda + algumas árvores e flores soltas
    for (let y = -1; y < hT + 1; y++)
      for (let x = -1; x < wT + 1; x++) {
        const border = x < 3 || y < 3 || x > wT - 4 || y > hT - 3;
        if (isPath(layout, x, y) || inRects(x, y, layout.reserved)) continue;
        if (border && rnd() < 0.55) this.addSprite(`tree${rnd() < 0.5 ? 0 : 1}`, x * TILE + 8 + (rnd() - 0.5) * 6, y * TILE + 14);
        else if (!border && rnd() < 0.05) this.addSprite(['flowerR', 'flowerY', 'flowerB'][Math.floor(rnd() * 3)], x * TILE + rnd() * 10, y * TILE + 10, -5);
      }

    this.buildCivic(layout);
    for (const plot of layout.plots) this.buildHouse(plot, rnd);

    const cam = this.cameras.main;
    cam.setBounds(-TILE, -TILE, layout.width + TILE * 2, layout.height + TILE * 2);
    // Na primeira vez enquadra a vila inteira (sem a floresta da borda).
    if (cam.zoom === 1) {
      const fit = Math.min(cam.width / (layout.width - TILE * 6), cam.height / (layout.height - TILE * 4));
      cam.setZoom(Phaser.Math.Clamp(fit, 1.5, 3));
    }
    cam.centerOn(layout.width / 2, layout.height / 2);
  }

  private addSprite(key: string, x: number, y: number, depth?: number) {
    return this.add
      .image(Math.round(x), Math.round(y), key)
      .setOrigin(0.5, 1)
      .setDepth(depth ?? y);
  }

  private label(x: number, y: number, text: string, depth: number) {
    const t = this.add.text(0, 0, text, TEXT_STYLE).setOrigin(0.5);
    const w = Math.ceil(t.width) + 8;
    const board = this.add.graphics();
    board.fillStyle(0x2b1a0e).fillRect(-w / 2 - 1, -7, w + 2, 14);
    board.fillStyle(0xe9c88f).fillRect(-w / 2, -6, w, 12);
    board.fillStyle(0xc99a5b).fillRect(-w / 2, 4, w, 2);
    return this.add.container(Math.round(x), Math.round(y), [board, t]).setDepth(depth);
  }

  private makeInteractive(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, tooltip: () => string, onClick: () => void) {
    obj.setInteractive({ useHandCursor: true });
    obj.on('pointerover', () => {
      obj.setTint(0xfff2c4);
      ui.showTooltip(tooltip());
    });
    obj.on('pointerout', () => {
      obj.clearTint();
      ui.hideTooltip();
    });
    obj.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (isClick(p)) onClick();
    });
  }

  private buildCivic(layout: Layout) {
    const lib = this.addSprite('library', layout.library.x, layout.library.y);
    this.makeInteractive(lib, () => 'Biblioteca — base de conhecimento', () => ui.openLibrary());
    this.label(layout.library.x, layout.library.y + 10, 'Biblioteca', layout.library.y + 10);

    const fac = this.addSprite('factory', layout.factory.x, layout.factory.y);
    this.makeInteractive(fac, () => 'Fábrica — criação de agentes', () => ui.openFactory());
    this.label(layout.factory.x, layout.factory.y + 10, 'Fábrica de Agentes', layout.factory.y + 10);
    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const puff = this.add.circle(layout.factory.x + 30, layout.factory.y - 96, 3, 0xd8d8d8, 0.8).setDepth(9999);
        this.tweens.add({
          targets: puff,
          y: puff.y - 30,
          x: puff.x + 10,
          scale: 2.5,
          alpha: 0,
          duration: 3000,
          onComplete: () => puff.destroy(),
        });
      },
    });

    this.addSprite('well', layout.well.x, layout.well.y + 18);
    this.label(layout.well.x, layout.plaza.y + layout.plaza.h - 4, 'Praça', layout.plaza.y + layout.plaza.h);
  }

  private buildHouse(plot: Plot, rnd: () => number) {
    const p = plot.project;
    const roof = p.isGit ? ROOF_NAMES[hash(p.name) % ROOF_NAMES.length] : 'grey';
    const house = this.addSprite(`house-${roof}`, plot.house.x, plot.house.y);
    this.makeInteractive(
      house,
      () => {
        const cur = this.currentProject(p.id);
        return `${cur.name}${cur.branch ? ` — ${cur.branch}` : ''}${cur.isGit ? '' : ' (sem git)'}`;
      },
      () => ui.openProject(this.currentProject(p.id)),
    );
    const glows = [-21, 11].map((dx) =>
      this.add
        .image(plot.house.x + dx, plot.house.y - 27, 'glow')
        .setOrigin(0)
        .setDepth(plot.house.y + 1)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD),
    );

    this.addSprite('bush', plot.house.x - 40, plot.house.y + 2);
    if (rnd() < 0.6) this.addSprite('bush', plot.house.x + 40, plot.house.y + 2);
    this.label(plot.house.x, plot.house.y + 26, p.name, plot.house.y + 26);

    const view: HouseView = { plot, glows };
    if (p.isGit) {
      const bin = this.addSprite('bin', plot.bin.x, plot.bin.y);
      this.makeInteractive(
        bin,
        () => {
          const n = this.currentProject(p.id).changes.length;
          return n ? `Caixa de envio — ${n} mudança(s) sem commit` : 'Caixa de envio — vazia';
        },
        () => ui.openCommit(this.currentProject(p.id)),
      );
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x2b1a0e).fillCircle(0, 0, 6);
      badgeBg.fillStyle(0xd6402f).fillCircle(0, 0, 5);
      const badgeText = this.add.text(0, 0, '', { ...TEXT_STYLE, color: '#ffffff', fontSize: '7px' }).setOrigin(0.5, 0.55);
      view.badge = this.add.container(plot.bin.x + 11, plot.bin.y - 20, [badgeBg, badgeText]).setDepth(plot.bin.y + 1);
      view.badgeText = badgeText;
      this.tweens.add({ targets: view.badge, y: view.badge.y - 2, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
    }
    this.houses.set(p.id, view);
  }

  private currentProject(id: string): Project {
    return this.world.projects.find((p) => p.id === id)!;
  }

  private updateHouse(view: HouseView, project: Project) {
    if (view.badge && view.badgeText) {
      const n = project.changes.length;
      view.badge.setVisible(n > 0);
      view.badgeText.setText(n > 99 ? '99+' : String(n));
    }
    const lit = this.world.sessions.some((s) => s.projectId === project.id && s.live);
    for (const g of view.glows) {
      this.tweens.killTweensOf(g);
      this.tweens.add({ targets: g, alpha: lit ? 0.85 : 0, duration: 500 });
    }
  }

  // ---------------- moradores ----------------

  private syncVillagers(sessions: Session[]) {
    const ids = new Set(sessions.map((s) => s.id));
    for (const [id, v] of this.villagers) {
      if (!ids.has(id) || this.areaFor(v.session) !== this.areaFor(sessions.find((s) => s.id === id)!)) {
        v.timer?.remove();
        v.sprite.destroy();
        v.shadow.destroy();
        v.bubble.destroy();
        this.villagers.delete(id);
      }
    }
    for (const s of sessions) {
      const existing = this.villagers.get(s.id);
      if (existing) {
        existing.session = s;
        existing.bubble.setVisible(s.live);
      } else {
        this.spawnVillager(s);
      }
    }
  }

  private areaFor(s: Session): Rect | undefined {
    if (!this.layout) return undefined;
    if (!s.projectId) return this.layout.plaza;
    return this.layout.plots.find((p) => p.project.id === s.projectId)?.yard;
  }

  private spawnVillager(session: Session) {
    const area = this.areaFor(session);
    if (!area) return;
    const tex = villagerTexture(this, session.id);
    const rnd = mulberry32(hash(session.id));
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    const shadow = this.add.image(x, y, 'shadow').setOrigin(0.5);
    const sprite = this.add.sprite(x, y, tex, 0).setOrigin(0.5, 1);

    const dots = [0, 1, 2].map((i) => this.add.rectangle(-4 + i * 4, -8, 2, 2, 0x3b2312));
    const bubble = this.add.container(x + 4, y - 24, [this.add.image(0, -6, 'bubble'), ...dots]).setVisible(session.live);
    dots.forEach((d, i) =>
      this.tweens.add({ targets: d, y: d.y - 2, yoyo: true, repeat: -1, duration: 300, delay: i * 150 }),
    );

    const v: Villager = { session, sprite, shadow, bubble, area, walkAnim: `${tex}-walk` };
    this.makeInteractive(
      sprite,
      () => `${villagerName(v.session.id)}: ${v.session.title}${v.session.live ? ' (trabalhando)' : ''}`,
      () => ui.openSession(v.session),
    );
    this.villagers.set(session.id, v);
    this.placeVillager(v);
    this.scheduleWander(v, 500 + rnd() * 3000);
  }

  private placeVillager(v: Villager) {
    v.sprite.setDepth(v.sprite.y);
    v.shadow.setPosition(v.sprite.x, v.sprite.y).setDepth(v.sprite.y - 1);
    v.bubble.setPosition(v.sprite.x + 4, v.sprite.y - 24).setDepth(100000);
  }

  private scheduleWander(v: Villager, delay: number) {
    v.timer = this.time.delayedCall(delay, () => {
      if (!v.sprite.active) return;
      const tx = v.area.x + Math.random() * v.area.w;
      const ty = v.area.y + Math.random() * v.area.h;
      const dist = Phaser.Math.Distance.Between(v.sprite.x, v.sprite.y, tx, ty);
      v.sprite.setFlipX(tx < v.sprite.x);
      v.sprite.play(v.walkAnim);
      this.tweens.add({
        targets: v.sprite,
        x: tx,
        y: ty,
        duration: dist * 45,
        onUpdate: () => this.placeVillager(v),
        onComplete: () => {
          v.sprite.stop();
          v.sprite.setFrame(0);
          // Sessões trabalhando ficam mais agitadas.
          this.scheduleWander(v, (v.session.live ? 1500 : 4000) + Math.random() * 4000);
        },
      });
    });
  }

  private clampCamera() {
    const cam = this.cameras.main;
    cam.setScroll(cam.scrollX, cam.scrollY);
  }
}
