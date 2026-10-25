import Phaser from 'phaser';
import { activityOf, getWorld, onWorld, type Project, type Session, type World } from '../api';
import { ui } from '../ui/actions';
import { makeInteractive, VillagerView } from './common';
import { generateInteriorTextures } from './interiorTextures';

const W = 288;
const WALL_H = 40;
const DESK_COLS = 3;
const DESK_SPACING_X = 80;
const FIRST_DESK_Y = WALL_H + 64;
const DESK_SPACING_Y = 58;
const MIN_DESKS = 3;
const MAX_DESKS = 9;
const SOFA_SEATS = 3;
const MAX_WANDERERS = 6;

interface Placement {
  desks: (Session | null)[];
  sofa: Session[];
  wanderers: Session[];
  hidden: number;
}

/**
 * Dentro da casa de um projeto: cada sessão viva trabalha numa mesa com computador,
 * as antigas descansam no sofá ou circulam pela sala. A escrivaninha abre o painel do projeto.
 */
export class InteriorScene extends Phaser.Scene {
  private projectId = '';
  private signature = '';
  private villagers = new Map<string, VillagerView>();
  private monitors = new Map<string, Phaser.GameObjects.Image>();
  private unsubscribe?: () => void;

  constructor() {
    super('interior');
  }

  private instant = false;

  init(data: { projectId: string; instant?: boolean }) {
    this.projectId = data.projectId;
    this.instant = !!data.instant;
    this.signature = '';
  }

  create() {
    generateInteriorTextures(this);
    this.cameras.main.setBackgroundColor('#1a120b');
    this.unsubscribe = onWorld((w) => this.applyWorld(w));
    const onResize = () => this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.unsubscribe?.();
      this.villagers.clear();
      this.monitors.clear();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!ui.isPanelOpen()) this.leave();
    });
    this.applyWorld(getWorld());
    if (!this.instant) this.cameras.main.fadeIn(250);
  }

  private project(world: World): Project | undefined {
    return world.projects.find((p) => p.id === this.projectId);
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

  private place(sessions: Session[]): Placement {
    const sorted = [...sessions].sort((a, b) => b.lastActivity - a.lastActivity);
    const live = sorted.filter((s) => s.live);
    const offline = sorted.filter((s) => !s.live);
    const deskCount = Phaser.Math.Clamp(live.length, MIN_DESKS, MAX_DESKS);
    const desks: (Session | null)[] = Array.from({ length: deskCount }, (_, i) => live[i] ?? null);
    const extraLive = live.slice(deskCount);
    const rest = [...extraLive, ...offline];
    const sofa = rest.slice(0, SOFA_SEATS);
    const wanderers = rest.slice(SOFA_SEATS, SOFA_SEATS + MAX_WANDERERS);
    return { desks, sofa, wanderers, hidden: Math.max(0, rest.length - SOFA_SEATS - MAX_WANDERERS) };
  }

  applyWorld(world: World) {
    const project = this.project(world);
    if (!project) return this.leave();
    const sessions = world.sessions.filter((s) => s.projectId === this.projectId);
    const placement = this.place(sessions);
    const signature = JSON.stringify([
      placement.desks.map((s) => s?.id ?? '-'),
      placement.sofa.map((s) => s.id),
      placement.wanderers.map((s) => s.id),
      placement.hidden,
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.buildRoom(project, placement);
    }
    for (const s of sessions) this.villagers.get(s.id)?.update(s);
    for (const [id, monitor] of this.monitors) {
      const s = sessions.find((x) => x.id === id);
      const a = s ? activityOf(s) : 'offline';
      monitor.setTexture(a === 'permission' ? 'monitorAlert' : a === 'offline' ? 'monitorOff' : 'monitorOn');
      const typing = a === 'working';
      const v = this.villagers.get(id);
      if (v) v.sprite.setData('typing', typing);
    }
  }

  private buildRoom(project: Project, placement: Placement) {
    for (const v of this.villagers.values()) v.destroy();
    this.villagers.clear();
    this.monitors.clear();
    this.children.removeAll(true);
    this.time.removeAllEvents();

    const deskRows = Math.ceil(placement.desks.length / DESK_COLS);
    const loungeTop = FIRST_DESK_Y + (deskRows - 1) * DESK_SPACING_Y + 30;
    const H = loungeTop + 100;

    // ---- paredes e piso ----
    this.add.tileSprite(0, WALL_H, W, H - WALL_H, 'floor').setOrigin(0).setDepth(-20);
    this.add.tileSprite(0, 0, W, WALL_H, 'wall').setOrigin(0).setDepth(-19);
    const frame = this.add.graphics().setDepth(100000 - 1);
    frame.fillStyle(0x3a2412).fillRect(-6, 0, 6, H).fillRect(W, 0, 6, H).fillRect(-6, H, W + 12, 6);
    frame.fillStyle(0x3a2412).fillRect(0, H - 4, W / 2 - 18, 4).fillRect(W / 2 + 18, H - 4, W / 2 - 18, 4);

    this.add.image(W / 2, 22, 'wallWindow').setDepth(-18);
    ui.setLocation(project.name);
    this.prop('bookshelf', 26, WALL_H + 8);
    this.prop('plant', W - 14, WALL_H + 10);

    const study = this.prop('study', W - 60, WALL_H + 16);
    makeInteractive(
      study,
      () => `Escrivaninha — ${project.name}${placement.hidden ? ` (+${placement.hidden} moradores antigos)` : ''}`,
      () => ui.openProject(this.project(getWorld()) ?? project),
    );

    const mat = this.prop('doormat', W / 2, H + 2);
    makeInteractive(mat, () => 'Sair (Esc)', () => this.leave());

    // ---- mesas de trabalho ----
    placement.desks.forEach((session, i) => {
      const col = i % DESK_COLS;
      const row = Math.floor(i / DESK_COLS);
      const rowCount = Math.min(DESK_COLS, placement.desks.length - row * DESK_COLS);
      const cx = W / 2 + (col - (rowCount - 1) / 2) * DESK_SPACING_X;
      const y = FIRST_DESK_Y + row * DESK_SPACING_Y;
      this.prop('desk', cx, y);
      const monitor = this.add.image(cx - 6, y - 13, session ? 'monitorOn' : 'monitorOff').setOrigin(0.5, 1).setDepth(y + 0.5);
      this.add.image(cx, y + 12, 'chair').setOrigin(0.5, 1).setDepth(y + 15);
      if (!session) return;
      this.monitors.set(session.id, monitor);
      const v = this.addVillager(session, cx, y + 14);
      v.sit('up');
      // digitando: pequeno balanço enquanto a sessão trabalha
      this.time.addEvent({
        delay: 180,
        loop: true,
        callback: () => {
          if (!v.sprite.active) return;
          const typing = v.sprite.getData('typing');
          v.sprite.y = y + 14 + (typing && Math.random() < 0.5 ? 1 : 0);
          v.place();
        },
      });
    });

    // ---- sala de estar ----
    const sofaY = loungeTop + 34;
    this.add.image(W / 2, loungeTop + 58, 'rug').setDepth(-15);
    this.prop('sofa', W / 2, sofaY).setDepth(sofaY - 12);
    this.add.image(W / 2, sofaY, 'sofaFront').setOrigin(0.5, 1).setDepth(sofaY + 1);
    placement.sofa.forEach((s, i) => {
      const v = this.addVillager(s, W / 2 + (i - 1) * 16, sofaY - 3);
      v.sit('down');
    });

    const area = { x: 24, y: loungeTop + 48, w: W - 48, h: 40 };
    placement.wanderers.forEach((s, i) => {
      const v = this.addVillager(s, area.x + ((i * 53) % area.w), area.y + ((i * 17) % area.h));
      this.wander(v, area);
    });

    this.roomHeight = H + 8;
    this.frameCamera();
  }

  private roomHeight = 0;

  /** Enquadra a sala inteira, centralizada, no tamanho atual da janela. */
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

  private addVillager(session: Session, x: number, y: number) {
    const v = new VillagerView(this, session, x, y);
    this.villagers.set(session.id, v);
    return v;
  }

  private wander(v: VillagerView, area: { x: number; y: number; w: number; h: number }) {
    this.time.delayedCall(1500 + Math.random() * 4000, () => {
      if (!v.sprite.active) return;
      const tx = Math.round(area.x + Math.random() * area.w);
      const dist = Math.abs(tx - v.sprite.x);
      v.walk('side', tx < v.sprite.x);
      this.tweens.add({
        targets: v.sprite,
        x: tx,
        duration: dist * 45,
        onUpdate: () => v.place(),
        onComplete: () => {
          if (!v.sprite.active) return;
          v.stand();
          v.face('down');
          this.wander(v, area);
        },
      });
    });
  }
}
