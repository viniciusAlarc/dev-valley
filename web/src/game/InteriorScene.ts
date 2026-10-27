import Phaser from 'phaser';
import { activityOf, getWorld, onWorld, type Project, type Session, type World } from '../api';
import { ui } from '../ui/actions';
import { makeInteractive, VillagerView } from './common';
import { generateInteriorTextures, SEED_COLORS, SHELF_BOOKS } from './interiorTextures';

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
/** Quadro de pendências na parede: posição e grade dos bilhetes (5 colunas x 3 linhas). */
const BOARD_X = 86;
const BOARD_Y = WALL_H - 4;
const NOTE_COLS = 5;
const MAX_NOTES = 15;
/** Atril do diário (PROGRESS.md), no chão entre a estante e o quadro. */
const DIARY_X = 53;
/** Caixa de sementes (docs-dev/a-codar/), no chão entre a janela e a escrivaninha. */
const SEEDS_X = 184;
const SEEDS_Y = WALL_H + 16;
/** Estante (`docs-dev/context/`), no canto esquerdo; 34x44, os livros são pregados a partir do canto de cima. */
const SHELF_X = 26;
const SHELF_Y = WALL_H + 8;
/** Quadro negro (o docs-dev/painel.json inteiro), na parede entre a janela e a escrivaninha. */
const CHALK_X = 188;

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
  private notes: Phaser.GameObjects.Image[] = [];
  private notesKey = '';
  private packets: Phaser.GameObjects.Image[] = [];
  private packetsKey = '';
  private chalkboard?: Phaser.GameObjects.Image;
  private books: Phaser.GameObjects.Image[] = [];
  private booksKey = '';
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
    this.pinNotes(project);
    this.fillSeedBox(project);
    this.fillShelf(project);
    this.chalkboard?.setTexture(project.painel ? 'chalkboardWritten' : 'chalkboard');
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
    this.notes = [];
    this.notesKey = '';
    this.packets = [];
    this.packetsKey = '';
    this.books = [];
    this.booksKey = '';
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
    const shelf = this.prop('bookshelf', SHELF_X, SHELF_Y);
    makeInteractive(
      shelf,
      () => {
        const n = this.project(getWorld())?.estante?.length ?? 0;
        return n ? `Estante — ${n} documento(s) do que já foi construído` : 'Estante — vazia, nada em docs-dev/context/';
      },
      () => ui.openEstante(this.project(getWorld()) ?? project),
    );
    this.prop('plant', W - 14, WALL_H + 10);

    const study = this.prop('study', W - 60, WALL_H + 16);
    makeInteractive(
      study,
      () => `Escrivaninha — ${project.name}${placement.hidden ? ` (+${placement.hidden} moradores antigos)` : ''}`,
      () => ui.openProject(this.project(getWorld()) ?? project),
    );

    if (project.pendencias) {
      const board = this.prop('corkBoard', BOARD_X, BOARD_Y);
      makeInteractive(
        board,
        () => {
          const list = this.project(getWorld())?.pendencias ?? [];
          if (!list.length) return 'Quadro de pendências — nenhuma aberta';
          const urgent = list.filter((p) => p.priority <= 2).length;
          const mine = list.filter((p) => p.owner === 'user').length;
          return `Quadro de pendências — ${list.length} aberta(s)${urgent ? `, ${urgent} P1/P2` : ''}${mine ? ` · ${mine} esperam decisão sua` : ''}`;
        },
        () => ui.openPendencias(this.project(getWorld()) ?? project),
      );
    }

    if (project.progress) {
      const lectern = this.prop('lectern', DIARY_X, WALL_H + 18);
      makeInteractive(
        lectern,
        () => {
          const p = this.project(getWorld())?.progress;
          return p?.entries ? `Diário — ${p.entries} entrega(s)${p.lastDate ? `, a última em ${p.lastDate}` : ''}` : 'Diário — nenhuma entrega ainda';
        },
        () => ui.openDiary(this.project(getWorld()) ?? project),
      );
    }

    if (project.sementes) {
      const box = this.prop('seedBox', SEEDS_X, SEEDS_Y);
      makeInteractive(
        box,
        () => {
          const n = this.project(getWorld())?.sementes?.length ?? 0;
          return n ? `Caixa de sementes — ${n} plano(s) decidido(s) e ainda não codado(s)` : 'Caixa de sementes — vazia, nenhum plano esperando código';
        },
        () => ui.openSementes(this.project(getWorld()) ?? project),
      );
    }

    // Todo projeto tem quadro negro com o docs-dev/painel.json inteiro; sem o arquivo, ele fica limpo.
    this.chalkboard = this.prop(project.painel ? 'chalkboardWritten' : 'chalkboard', CHALK_X, BOARD_Y);
    makeInteractive(
      this.chalkboard,
      () => {
        const painel = this.project(getWorld())?.painel;
        if (!painel) return 'Quadro negro — sem docs-dev/painel.json';
        const plano = painel.plano;
        if (!plano) return `Quadro negro — nenhum plano em andamento, ${painel.entregas.length} entrega(s)`;
        const done = plano.fases.filter((f) => f.estado === 'feito').length;
        return `Quadro negro — ${plano.nome}: ${done} de ${plano.fases.length} fase(s) feitas`;
      },
      () => ui.openQuadro(this.project(getWorld()) ?? project),
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

  /** Um pacote por plano em `a-codar/` (até 6), saindo da caixa por trás da frente; só redesenha quando muda. */
  private fillSeedBox(project: Project) {
    const n = Math.min(project.sementes?.length ?? 0, SEED_COLORS.length);
    const key = project.sementes ? String(n) : '';
    if (key === this.packetsKey) return;
    this.packetsKey = key;
    for (const p of this.packets) p.destroy();
    this.packets = Array.from({ length: n }, (_, i) =>
      this.add
        .image(SEEDS_X - 9 + i * 3.6, SEEDS_Y - 6 - (i % 2), `seedPacket${i}`)
        .setOrigin(0.5, 1)
        .setDepth(SEEDS_Y - 0.5),
    );
  }

  /** Um livro por documento de `docs-dev/context/` (mais do que cabe = estante cheia); só redesenha quando muda. */
  private fillShelf(project: Project) {
    const n = Math.min(project.estante?.length ?? 0, SHELF_BOOKS.length);
    if (String(n) === this.booksKey) return;
    this.booksKey = String(n);
    for (const b of this.books) b.destroy();
    const left = SHELF_X - 17;
    const top = SHELF_Y - 44;
    this.books = SHELF_BOOKS.slice(0, n).map((slot, i) =>
      this.add.image(left + slot.x, top + slot.bottom, `shelfBook${i}`).setOrigin(0, 1).setDepth(SHELF_Y + 0.5),
    );
  }

  /** Um bilhete por pendência, as mais graves primeiro; só redesenha quando a lista muda. */
  private pinNotes(project: Project) {
    const list = [...(project.pendencias ?? [])].sort((a, b) => a.priority - b.priority).slice(0, MAX_NOTES);
    const key = list.map((p) => p.priority).join('');
    if (key === this.notesKey) return;
    this.notesKey = key;
    for (const n of this.notes) n.destroy();
    const left = BOARD_X - 23 + 3;
    const top = BOARD_Y - 30 + 3;
    // leve desalinho fixo por posição, para parecer pregado à mão
    const jitter = [0, 1, 0, -1, 1, -1, 0, 1, 0, 0, 1, -1, 0, 1, -1];
    this.notes = list.map((p, i) =>
      this.add
        .image(left + (i % NOTE_COLS) * 8, top + Math.floor(i / NOTE_COLS) * 8 + jitter[i], `note${p.priority}`)
        .setOrigin(0)
        .setDepth(BOARD_Y + 0.5),
    );
  }

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
