import Phaser from 'phaser';
import { activityOf, getWorld, onWorld, rodadaConduzindo, type PedidoPorao, type Project, type Session, type World } from '../api';
import { ui } from '../ui/actions';
import { label, makeInteractive, VillagerView } from './common';
import { generateInteriorTextures, generatePoraoTextures } from './interiorTextures';
import { StatusBubble } from './statusBubble';
import { villagerTexture } from './villager';

const W = 288;
const WALL_H = 40;
const DESK_COLS = 3;
const DESK_SPACING_X = 80;
const FIRST_DESK_Y = WALL_H + 86;
const DESK_SPACING_Y = 58;
/**
 * Cinco mesas fixas, o teto de sessões por rodada, vazias até o cartão ser aprovado. As mesas são só das tarefas: a
 * conversa do maestro mora no ✦, nunca vira morador (decisão do usuário, 03/11/2026).
 */
const DESKS = 5;
/** Dois bancos de 3 lugares para quem já terminou (rodadas antigas, para reabrir). */
const BENCH_X = [W / 2 - 62, W / 2 + 62];
const BENCH_SEATS = 3;
const MAESTRO_X = W / 2 - 8;
const MAESTRO_Y = WALL_H + 30;
/** O mirim fica à esquerda do maestro, menor, no espaço onde era o quadro. */
const MIRIM_X = MAESTRO_X - 30;
const MIRIM_Y = WALL_H + 32;
/** Gongo de "Encerrar rodada", no chão à direita, abaixo dos barris. */
const GONGO_X = W - 24;
const GONGO_Y = WALL_H + 52;

/** Rótulo curto da mesa: qual tarefa a sessão faz. */
function papelDe(s: Session): string {
  return s.porao?.papel === 'tarefa' ? s.porao.tarefa : '';
}

/** Por rodada e tarefa, para a sala não embaralhar a cada atualização. */
function ordem(a: Session, b: Session): number {
  return papelDe(a).localeCompare(papelDe(b)) || (a.porao?.papel === 'tarefa' && b.porao?.papel === 'tarefa' ? a.porao.rodada.localeCompare(b.porao.rodada) : 0);
}

/** Texto do estado da conversa do maestro, para o tooltip do ✦. */
const ESTADO_MAESTRO = { working: 'trabalhando', permission: 'pedindo permissão a você', idle: 'esperando você', offline: 'parado' } as const;

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
  /** ❗ em cima da estante de partitura enquanto o maestro espera o cartão ser decidido. */
  private avisoPedido?: Phaser.GameObjects.Image;
  private pedidoKey = '';
  /** ♪ em cima da estante de partitura quando há relatório de rodada que o usuário ainda não abriu (e nenhum pedido). */
  private notaRelatorio?: Phaser.GameObjects.Text;
  /** Balão do ✦: o estado da conversa do maestro da rodada em andamento. */
  private maestroBubble?: StatusBubble;
  /** Regência (04/11/2026): a batuta e o balanço do maestro, ligados só enquanto alguma tarefa da rodada trabalha. */
  private batuta?: Phaser.GameObjects.Image;
  private regencia: Phaser.Tweens.Tween[] = [];
  private regendo = false;

  constructor() {
    super('porao');
  }

  init(data: { projectId: string }) {
    this.projectId = data.projectId;
    this.signature = '';
    this.pedidoKey = '';
  }

  /** O pedido mais antigo do projeto esperando decisão; os outros aparecem depois que este for decidido. */
  private pedidoDaqui(world: World): PedidoPorao | undefined {
    return world.pedidosPorao.filter((p) => p.projectId === this.projectId).sort((a, b) => a.criadoEm - b.criadoEm)[0];
  }

  private mostrarPedido(pedido: PedidoPorao | undefined) {
    const key = pedido?.id ?? '';
    if (key === this.pedidoKey && (!pedido || this.avisoPedido?.active)) return;
    this.pedidoKey = key;
    this.avisoPedido?.destroy();
    this.avisoPedido = undefined;
    if (!pedido) return;
    const x = MAESTRO_X + 20;
    const y = MAESTRO_Y - 30;
    this.avisoPedido = this.add.image(x, y, 'alert').setDepth(100000);
    this.tweens.add({ targets: this.avisoPedido, y: y - 2, yoyo: true, repeat: -1, duration: 400 });
    makeInteractive(
      this.avisoPedido,
      () => `Cartão do maestro — quer abrir ${pedido.tarefas.length} sessão(ões) para a rodada ${pedido.rodada} — clique para decidir`,
      () => ui.openPedidoPorao(pedido, this.project(getWorld())!),
    );
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

  /** Rodada em andamento = a conversa do maestro deste projeto ainda aberta (a mais recente, se houver mais de uma). */
  private maestroAtivo(world: World): Session | undefined {
    return world.sessions
      .filter((s) => s.projectId === this.projectId && s.porao?.papel === 'maestro' && s.live)
      .sort((a, b) => b.lastActivity - a.lastActivity)[0];
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
    const sessions = world.sessions.filter((s) => s.projectId === this.projectId && s.porao?.papel === 'tarefa').sort(ordem);
    const live = sessions.filter((s) => s.live);
    const desks: (Session | null)[] = Array.from({ length: DESKS }, (_, i) => live[i] ?? null);
    const resto = [...live.slice(DESKS), ...sessions.filter((s) => !s.live).sort((a, b) => b.lastActivity - a.lastActivity)];
    const banco = resto.slice(0, BENCH_X.length * BENCH_SEATS);
    const escondidos = resto.length - banco.length;
    const signature = JSON.stringify([desks.map((s) => s?.id ?? '-'), desks.map((s) => (s ? papelDe(s) : '')), banco.map((s) => s.id), escondidos]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.buildRoom(project, desks, banco, escondidos);
    }
    for (const s of sessions) this.villagers.get(s.id)?.update(s);
    const ativo = this.maestroAtivo(world);
    // Chamou você no meio da rodada: o ❗ aparece nele, como o da permissão.
    this.maestroBubble?.set(ativo ? (ativo.id in world.maestroChamando ? 'permission' : activityOf(ativo)) : 'offline');
    this.reger(!!ativo && rodadaConduzindo(world, project.id));
    const pedido = this.pedidoDaqui(world);
    this.mostrarPedido(pedido);
    this.notaRelatorio?.setVisible(!pedido && (project.relatorios ?? []).some((r) => !r.lido));
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
    ui.setLocation(`${project.name} · porão`, 'Maestro ✦: rodada nova ou conversa (regendo, ele fica com o mirim) · mirim ✦: dúvidas da rodada · estante: cartão e relatórios · morador: abrir a sessão · escada ou Esc: voltar');

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
      () => {
        const w = getWorld();
        const ativo = this.maestroAtivo(w);
        if (!ativo) return '✦ Maestro — agente permanente\n"Quer dividir um trabalho entre várias sessões? Me diga o quê." — clique para começar uma rodada';
        const motivo = w.maestroChamando[ativo.id];
        if (motivo !== undefined) return `✦ Maestro — chamou você${motivo ? `: ${motivo}` : ''} — clique para conversar`;
        if (ativo.status !== 'permission' && rodadaConduzindo(w, this.projectId))
          return '✦ Maestro — regendo a rodada, não interrompa: ele te chama com o ❗ quando precisar — clique para falar com o mirim';
        return `✦ Maestro — rodada em andamento, ${ESTADO_MAESTRO[activityOf(ativo)]} — clique para continuar a conversa`;
      },
      () => void ui.falarComMaestro(this.project(getWorld()) ?? project, this.maestroAtivo(getWorld())),
    );
    // A batuta na mão direita (do lado da estante); gira enquanto ele rege, e o corpo balança junto.
    this.batuta = this.add.image(MAESTRO_X + 5, MAESTRO_Y - 13, 'batuta').setOrigin(0, 0.5).setDepth(MAESTRO_Y + 0.5).setVisible(false);
    this.regencia = [
      this.tweens.add({ targets: this.batuta, angle: { from: -55, to: 15 }, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut', paused: true }),
      this.tweens.add({ targets: maestro, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 840, ease: 'Sine.inOut', paused: true }),
    ];
    this.regendo = false;

    // ---- o maestro mirim ✦: o assistente, para as dúvidas enquanto o maestro rege (04/11/2026) ----
    const mirim = this.add
      .sprite(MIRIM_X, MIRIM_Y, villagerTexture(this, 'mirim-dev-valley', true), 0)
      .setOrigin(0.5, 1)
      .setScale(0.75)
      .setDepth(MIRIM_Y);
    this.add.image(MIRIM_X, MIRIM_Y + 1, 'shadow').setOrigin(0.5).setScale(0.75).setDepth(MIRIM_Y - 1);
    makeInteractive(
      mirim,
      () => '✦ Maestro mirim — assistente do maestro\n"Quer saber como está a rodada? Me pergunte, que eu olho sem atrapalhar ele." — clique para perguntar',
      () => ui.openMirim(this.project(getWorld()) ?? project),
    );
    const estrelinha = this.add.text(MIRIM_X + 5, MIRIM_Y - 26, '✦', { fontFamily: 'serif', fontSize: '8px', color: '#f7d046', resolution: 4 }).setOrigin(0.5).setDepth(100000);
    estrelinha.setStroke('#5e3a1c', 2);
    this.tweens.add({ targets: estrelinha, y: estrelinha.y - 2, alpha: 0.6, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.inOut' });
    this.maestroBubble = new StatusBubble(this);
    this.maestroBubble.setPosition(MAESTRO_X - 6, MAESTRO_Y - 33);
    const partitura = this.prop('podium', MAESTRO_X + 20, MAESTRO_Y + 2);
    makeInteractive(
      partitura,
      () => {
        const p = this.pedidoDaqui(getWorld());
        if (p) return `Estante de partitura — o maestro pediu ${p.tarefas.length} sessão(ões) para a rodada ${p.rodada} — clique para decidir`;
        const list = this.project(getWorld())?.relatorios ?? [];
        const novos = list.filter((r) => !r.lido).length;
        if (!list.length) return 'Estante de partitura — nenhum pedido esperando e nenhuma rodada fechada ainda';
        return novos
          ? `Estante de partitura — ${novos} relatório(s) de rodada que você ainda não abriu — clique para ler`
          : `Estante de partitura — ${list.length} relatório(s) de rodada — clique para ver`;
      },
      // Com pedido esperando, o cartão; senão, os relatórios das rodadas (a partitura tocada, 04/11/2026).
      () => {
        const cur = this.project(getWorld()) ?? project;
        const p = this.pedidoDaqui(getWorld());
        if (p) ui.openPedidoPorao(p, cur);
        else ui.openRelatorios(cur);
      },
    );
    this.notaRelatorio = this.add
      .text(MAESTRO_X + 20, MAESTRO_Y - 28, '♪', { fontFamily: 'serif', fontSize: '10px', color: '#fffaf0', resolution: 4 })
      .setOrigin(0.5)
      .setDepth(100000)
      .setVisible(false);
    this.notaRelatorio.setStroke('#2b1a0e', 2);
    this.tweens.add({ targets: this.notaRelatorio, y: this.notaRelatorio.y - 3, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    // A sala foi refeita: o ❗ do pedido volta por cima dela.
    this.pedidoKey = '';
    this.avisoPedido = undefined;
    const star = this.add.text(MAESTRO_X + 7, MAESTRO_Y - 34, '✦', { fontFamily: 'serif', fontSize: '10px', color: '#f7d046', resolution: 4 }).setOrigin(0.5).setDepth(100000);
    star.setStroke('#5e3a1c', 2);
    this.tweens.add({ targets: star, y: star.y - 3, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

    // ---- gongo de encerrar (os relatórios ficam na estante de partitura, ao lado do maestro) ----
    const gongo = this.prop('poraoGongo', GONGO_X, GONGO_Y);
    makeInteractive(
      gongo,
      () => {
        const n = getWorld().sessions.filter((s) => s.projectId === this.projectId && s.porao).length;
        return n ? `Gongo — encerrar a rodada: apaga as ${n} conversa(s) do porão (o relatório e os commits ficam)` : 'Gongo — nada para encerrar, o porão está vazio';
      },
      () => ui.openEncerrarRodada(this.project(getWorld()) ?? project),
    );

    // ---- mesas: as sessões de trabalho da rodada ----
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

  /** Liga ou desliga a regência; parado, a batuta some e o maestro volta ao prumo. */
  private reger(sim: boolean) {
    if (sim === this.regendo || !this.batuta?.active) return;
    this.regendo = sim;
    this.batuta.setVisible(sim);
    for (const t of this.regencia) {
      if (sim) t.play();
      else {
        t.pause();
        t.seek(0);
        for (const alvo of t.targets as Phaser.GameObjects.Components.Transform[]) alvo.angle = 0;
      }
    }
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
