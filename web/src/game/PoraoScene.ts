import Phaser from 'phaser';
import { activityOf, getWorld, onWorld, type Project, type Session, type World } from '../api';
import { ui } from '../ui/actions';
import { label, makeInteractive, VillagerView } from './common';
import { generateInteriorTextures, generatePoraoTextures } from './interiorTextures';
import { villagerTexture } from './villager';

const W = 288;
const WALL_H = 40;
const DESK_COLS = 3;
const DESK_SPACING_X = 80;
const FIRST_DESK_Y = WALL_H + 86;
const DESK_SPACING_Y = 58;
/** Uma mesa para o maestro e uma para cada uma das até 5 sessões da rodada; nunca menos de 3, para não parecer vazio. */
const MIN_DESKS = 3;
const MAX_DESKS = 6;
/** Dois bancos de 3 lugares para quem já terminou (rodadas antigas, para reabrir). */
const BENCH_X = [W / 2 - 62, W / 2 + 62];
const BENCH_SEATS = 3;
const MAESTRO_X = W / 2 - 8;
const MAESTRO_Y = WALL_H + 30;

/** Rótulo curto da mesa: quem é o maestro e qual tarefa cada sessão faz. */
function papelDe(s: Session): string {
  if (!s.porao) return '';
  return s.porao.papel === 'maestro' ? 'maestro' : s.porao.tarefa;
}

/** Maestro primeiro, depois as tarefas por rodada e tarefa, para a sala não embaralhar a cada atualização. */
function ordem(a: Session, b: Session): number {
  const chave = (s: Session) => (s.porao?.papel === 'maestro' ? `0-${-s.lastActivity}` : `1-${s.porao?.papel === 'tarefa' ? `${s.porao.rodada}-${s.porao.tarefa}` : ''}`);
  return chave(a).localeCompare(chave(b));
}

/**
 * Porão da casa (MA-1, decisão do usuário de 03/11/2026): o maestro ✦ espera um pedido e, nas mesas, trabalham as
 * sessões da rodada. Quem mora aqui não aparece na casa nem no mapa. Entra pelo alçapão; sai pela escada ou Esc.
 */
export class PoraoScene extends Phaser.Scene {
  private projectId = '';
  private signature = '';
  private villagers = new Map<string, VillagerView>();
  private monitors = new Map<string, Phaser.GameObjects.Image>();
  private roomHeight = 0;
  private unsubscribe?: () => void;

  constructor() {
    super('porao');
  }

  init(data: { projectId: string }) {
    this.projectId = data.projectId;
    this.signature = '';
  }

  create() {
    generateInteriorTextures(this);
    generatePoraoTextures(this);
    this.cameras.main.setBackgroundColor('#14100c');
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
    this.cameras.main.fadeIn(250);
  }

  private project(world: World): Project | undefined {
    return world.projects.find((p) => p.id === this.projectId);
  }

  /** Sobe para a casa (a casa só dormiu enquanto isso). */
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
    const sessions = world.sessions.filter((s) => s.projectId === this.projectId && s.porao).sort(ordem);
    const live = sessions.filter((s) => s.live);
    const desks: (Session | null)[] = Array.from({ length: Phaser.Math.Clamp(live.length, MIN_DESKS, MAX_DESKS) }, (_, i) => live[i] ?? null);
    const resto = [...live.slice(MAX_DESKS), ...sessions.filter((s) => !s.live).sort((a, b) => b.lastActivity - a.lastActivity)];
    const banco = resto.slice(0, BENCH_X.length * BENCH_SEATS);
    const escondidos = resto.length - banco.length;
    const signature = JSON.stringify([desks.map((s) => s?.id ?? '-'), desks.map((s) => (s ? papelDe(s) : '')), banco.map((s) => s.id), escondidos]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.buildRoom(project, desks, banco, escondidos);
    }
    for (const s of sessions) this.villagers.get(s.id)?.update(s);
    for (const [id, monitor] of this.monitors) {
      const s = sessions.find((x) => x.id === id);
      const a = s ? activityOf(s) : 'offline';
      monitor.setTexture(a === 'permission' ? 'monitorAlert' : a === 'offline' ? 'monitorOff' : 'monitorOn');
      this.villagers.get(id)?.sprite.setData('typing', a === 'working');
    }
  }

  private buildRoom(project: Project, desks: (Session | null)[], banco: Session[], escondidos: number) {
    for (const v of this.villagers.values()) v.destroy();
    this.villagers.clear();
    this.monitors.clear();
    this.children.removeAll(true);
    this.time.removeAllEvents();

    const deskRows = Math.ceil(desks.length / DESK_COLS);
    const benchY = FIRST_DESK_Y + (deskRows - 1) * DESK_SPACING_Y + 56;
    const H = benchY + 22;

    // ---- pedra: paredes e piso ----
    this.add.tileSprite(0, WALL_H, W, H - WALL_H, 'poraoFloor').setOrigin(0).setDepth(-20);
    this.add.tileSprite(0, 0, W, WALL_H, 'poraoWall').setOrigin(0).setDepth(-19);
    const frame = this.add.graphics().setDepth(100000 - 1);
    frame.fillStyle(0x2a2520).fillRect(-6, 0, 6, H).fillRect(W, 0, 6, H).fillRect(-6, H, W + 12, 6);
    ui.setLocation(`${project.name} · porão`, 'Maestro ✦: começar uma rodada · morador: abrir a sessão · escada ou Esc: voltar para a casa');

    const escada = this.prop('ladder', 22, WALL_H + 12);
    makeInteractive(escada, () => 'Escada — voltar para a casa (Esc)', () => this.leave());
    this.prop('barrel', W - 16, WALL_H + 10);
    this.prop('barrel', W - 32, WALL_H + 14);

    // ---- o maestro ✦, sempre esperando, com a estante de partitura ----
    const maestro = this.add
      .sprite(MAESTRO_X, MAESTRO_Y, villagerTexture(this, 'maestro-dev-valley', true), 0)
      .setOrigin(0.5, 1)
      .setDepth(MAESTRO_Y);
    this.add.image(MAESTRO_X, MAESTRO_Y + 1, 'shadow').setOrigin(0.5).setDepth(MAESTRO_Y - 1);
    makeInteractive(
      maestro,
      () => '✦ Maestro — agente permanente\n"Quer dividir um trabalho entre várias sessões? Me diga o quê." — clique para começar uma rodada',
      () => void ui.abrirMaestro(this.project(getWorld()) ?? project),
    );
    this.prop('podium', MAESTRO_X + 20, MAESTRO_Y + 2);
    const star = this.add.text(MAESTRO_X + 7, MAESTRO_Y - 34, '✦', { fontFamily: 'serif', fontSize: '10px', color: '#f7d046', resolution: 4 }).setOrigin(0.5).setDepth(100000);
    star.setStroke('#5e3a1c', 2);
    this.tweens.add({ targets: star, y: star.y - 3, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

    // ---- mesas: o maestro da rodada e as sessões de trabalho ----
    desks.forEach((session, i) => {
      const col = i % DESK_COLS;
      const row = Math.floor(i / DESK_COLS);
      const rowCount = Math.min(DESK_COLS, desks.length - row * DESK_COLS);
      const cx = W / 2 + (col - (rowCount - 1) / 2) * DESK_SPACING_X;
      const y = FIRST_DESK_Y + row * DESK_SPACING_Y;
      this.prop('desk', cx, y);
      const monitor = this.add.image(cx - 6, y - 13, session ? 'monitorOn' : 'monitorOff').setOrigin(0.5, 1).setDepth(y + 0.5);
      this.add.image(cx, y + 12, 'chair').setOrigin(0.5, 1).setDepth(y + 15);
      if (!session) return;
      label(this, cx, y + 22, papelDe(session), y + 22);
      this.monitors.set(session.id, monitor);
      const v = this.addVillager(session, cx, y + 14);
      v.sit('up');
      this.time.addEvent({
        delay: 180,
        loop: true,
        callback: () => {
          if (!v.sprite.active) return;
          v.sprite.y = y + 14 + (v.sprite.getData('typing') && Math.random() < 0.5 ? 1 : 0);
          v.place();
        },
      });
    });

    // ---- bancos: quem já terminou, para reabrir e ver os detalhes ----
    BENCH_X.forEach((bx, b) => {
      const bench = this.prop('poraoBench', bx, benchY);
      bench.setDepth(benchY - 12);
      if (b === BENCH_X.length - 1 && escondidos) {
        makeInteractive(bench, () => `Banco — mais ${escondidos} sessão(ões) antiga(s) do porão, que não couberam`, () => {});
      }
      this.add.image(bx, benchY, 'poraoBenchFront').setOrigin(0.5, 1).setDepth(benchY + 1);
      banco.slice(b * BENCH_SEATS, (b + 1) * BENCH_SEATS).forEach((s, i) => {
        const v = this.addVillager(s, bx + (i - 1) * 15, benchY - 5);
        v.sit('down');
      });
    });

    this.roomHeight = H + 8;
    this.frameCamera();
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

  private addVillager(session: Session, x: number, y: number) {
    const v = new VillagerView(this, session, x, y);
    this.villagers.set(session.id, v);
    return v;
  }
}
