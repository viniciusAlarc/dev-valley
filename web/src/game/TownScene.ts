import Phaser from 'phaser';
import { bellCount, urgentPendencias, yardResidents, type Project, type Session, type World } from '../api';
import { ui } from '../ui/actions';
import { AgentNpc, label, makeInteractive, TEXT_STYLE, VillagerView } from './common';
import { computeLayout, inRects, isPath, TILE, type Layout, type Plot, type Rect } from './layout';
import { generateTextures, hash, mulberry32, ROOFS } from './textures';
import { villagerTexture } from './villager';

const ROOF_NAMES = Object.keys(ROOFS).filter((r) => r !== 'grey');
/** Horta à esquerda da casa: um canteiro por fase do `painel.json`, 3 colunas x 3 linhas. */
const GARDEN_COLS = 3;
const GARDEN_MAX = 9;
/** Ervas à direita da casa, acima da caixa de envio: uma por linha do `RETRABALHO.md`, 3 colunas x 3 linhas. */
/** A data do arquivo é o último dia do prazo; vence no dia seguinte (comparação pela data local). */
function auditoriaVencida(due: string | null): boolean {
  if (!due) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return due < today;
}

const WEEDS_COLS = 3;
const WEEDS_MAX = 9;
const CROP_TEXTURE = { feito: 'crop-done', andamento: 'crop-growing', 'a fazer': 'crop-todo' } as const;
const PHASE_TEXT = { feito: 'feito', andamento: 'em andamento', 'a fazer': 'a fazer' } as const;
/** NPCs ✦ em volta da Fábrica (os demais agentes ficam só no painel). */
const MAX_AGENT_NPCS = 8;

interface Resident {
  view: VillagerView;
  area: Rect;
  timer?: Phaser.Time.TimerEvent;
}

interface HouseView {
  plot: Plot;
  glows: Phaser.GameObjects.Image[];
  badge?: Phaser.GameObjects.Container;
  badgeText?: Phaser.GameObjects.Text;
  /** "!" sobre o telhado quando há pendência P1 aberta. */
  alert: Phaser.GameObjects.Container;
  /** Andaime: falta estrutura de acompanhamento (casa em obra). */
  scaffold: Phaser.GameObjects.Image;
  /** Placa de vistoria (data da auditoria das regras); amarela quando vencida. */
  plaque: Phaser.GameObjects.Image;
  crops: Phaser.GameObjects.Image[];
  cropsKey: string;
  weeds: Phaser.GameObjects.Image[];
  weedsKey: string;
}

export class TownScene extends Phaser.Scene {
  private layout!: Layout;
  private plazaWalkArea!: Rect;
  private projectKey = '';
  private houses = new Map<string, HouseView>();
  private residents = new Map<string, Resident>();
  private agentNpcs = new Map<string, { npc: AgentNpc; timer?: Phaser.Time.TimerEvent }>();
  private agentArea!: Rect;
  private world: World = { projects: [], sessions: [], agents: [], usage: null, restart: { server: false, web: false } };
  private ready = false;
  /** Sino da praça: balança de tempos em tempos enquanto há algo para conferir. */
  private bell?: Phaser.GameObjects.Image;
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
    // Voltando de dentro de uma casa.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.cameras.main.fadeIn(250));

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
      const firstBuild = !this.projectKey;
      this.projectKey = projectKey;
      this.buildTown(world.projects);
      // Link direto para dentro de uma casa: http://localhost:4777/?casa=<nome> (ou #casa=<nome>)
      const params = new URLSearchParams(location.search || location.hash.slice(1));
      const target = params.get('casa');
      const project = firstBuild && world.projects.find((p) => p.name === target);
      if (project) this.enterHouse(project, true);
      else if (firstBuild && target === 'biblioteca') this.enter('library', {}, true);
    }
    for (const view of this.houses.values()) {
      const project = world.projects.find((p) => p.id === view.plot.project.id);
      if (project) this.updateHouse(view, project);
    }
    this.syncResidents();
    this.syncAgents();
  }

  /** Três balanços curtos a cada poucos segundos, só enquanto há entrega a conferir ou reinício pendente. */
  private ringBell() {
    if (!this.bell || !this.world || !bellCount(this.world) || this.tweens.isTweening(this.bell)) return;
    this.tweens.add({ targets: this.bell, angle: { from: -14, to: 14 }, duration: 180, yoyo: true, repeat: 2, onComplete: () => this.bell?.setAngle(0) });
  }

  private enterHouse(project: Project, instant = false) {
    this.enter('interior', { projectId: project.id }, instant);
  }

  private enter(sceneKey: 'interior' | 'library', data: object, instant = false) {
    ui.hideTooltip();
    const go = () => {
      this.scene.sleep();
      this.scene.launch(sceneKey, { ...data, instant });
    };
    if (instant) return go();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }

  // ---------------- construção do mapa ----------------

  private buildTown(projects: Project[]) {
    for (const r of this.residents.values()) r.timer?.remove();
    this.residents.clear();
    for (const a of this.agentNpcs.values()) a.timer?.remove();
    this.agentNpcs.clear();
    this.houses.clear();
    this.children.removeAll(true);

    const layout = (this.layout = computeLayout(projects));
    // Faixa da praça na frente do chafariz, entre os postes dos cantos, para ninguém andar por cima deles.
    const plazaTop = layout.fountain.y + 30;
    this.plazaWalkArea = {
      x: layout.plaza.x + 22,
      y: plazaTop,
      w: layout.plaza.w - 44,
      h: layout.plaza.y + layout.plaza.h - plazaTop - 4,
    };
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

  private buildCivic(layout: Layout) {
    const lib = this.addSprite('library', layout.library.x, layout.library.y);
    makeInteractive(lib, () => 'Biblioteca — instruções, memórias e docs — clique para entrar', () => this.enter('library', {}));
    label(this, layout.library.x, layout.library.y + 10, 'Biblioteca', layout.library.y + 10);

    const fac = this.addSprite('factory', layout.factory.x, layout.factory.y);
    makeInteractive(fac, () => 'Fábrica — criação de agentes', () => ui.openFactory());
    label(this, layout.factory.x, layout.factory.y + 10, 'Fábrica de Agentes', layout.factory.y + 10);
    // Pátio da Fábrica, entre a placa e a rua: onde os agentes passeiam.
    this.agentArea = { x: layout.factory.x - 56, y: layout.factory.y + 18, w: 112, h: 10 };
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

    this.buildPlaza(layout);
    label(this, layout.fountain.x, layout.plaza.y + layout.plaza.h - 4, 'Praça', layout.plaza.y + layout.plaza.h);
  }

  /**
   * Chafariz no centro; árvores, quadro de avisos, banco, canteiro e arbustos nas duas fileiras de cima,
   * postes nos cantos de baixo. A faixa de baixo fica livre para os moradores andarem.
   */
  private buildPlaza(layout: Layout) {
    const { fountain, plaza } = layout;
    // Meio-fio, aberto embaixo onde a estrada central encontra a praça.
    const curb = this.add.graphics().setDepth(-9).fillStyle(0x958c7c);
    const bottom = plaza.y + plaza.h - 2;
    const roadL = fountain.x - TILE;
    curb.fillRect(plaza.x, plaza.y, plaza.w, 2).fillRect(plaza.x, plaza.y, 2, plaza.h).fillRect(plaza.x + plaza.w - 2, plaza.y, 2, plaza.h);
    curb.fillRect(plaza.x, bottom, roadL - plaza.x, 2).fillRect(roadL + TILE * 2, bottom, plaza.x + plaza.w - roadL - TILE * 2, 2);
    this.add.image(fountain.x, fountain.y + 12, 'plaza-ring').setDepth(-9);

    this.addSprite('fountain', fountain.x, fountain.y + 20);
    const board = this.addSprite('noticeboard', fountain.x - 40, plaza.y + 30);
    makeInteractive(
      board,
      () => {
        const n = this.world.projects.flatMap((p) => p.pendencias ?? []).filter((p) => p.owner === 'user').length;
        return n ? `Quadro de avisos — ${n} decisão(ões) esperando você` : 'Quadro de avisos — nada esperando decisão sua';
      },
      () => ui.openUserPendencias(this.world.projects),
    );
    this.addSprite('planter', fountain.x + 34, plaza.y + 28);
    // Sino entre o canteiro e a árvore do canto (poste de 10px, sobra folga dos dois lados).
    const post = this.addSprite('bell-post', fountain.x + 52, plaza.y + 30);
    this.bell = this.add.image(Math.round(fountain.x + 52), plaza.y + 5, 'bell').setOrigin(0.5, 0).setDepth(post.depth + 1);
    makeInteractive(
      this.bell,
      () => {
        const n = bellCount(this.world);
        return n ? `Sino — ${n} item(ns) esperando você conferir na vila` : 'Sino — nada esperando conferência';
      },
      () => ui.openConferir(this.world),
    );
    this.time.addEvent({ delay: 6000, loop: true, callback: () => this.ringBell() });

    // ✦ Administrador da praça (agente permanente), entre o quadro de avisos e o chafariz: explica o sino e o quadro e
    // registra o que o usuário conferiu. Mesmos fundamentos da bibliotecária (consulta curta, não vira morador).
    const adminX = fountain.x - 20;
    const adminY = plaza.y + 34;
    const admin = this.add.sprite(adminX, adminY, villagerTexture(this, 'administrador-dev-valley'), 0).setOrigin(0.5, 1).setDepth(adminY);
    makeInteractive(
      admin,
      () => '✦ Administrador da praça — agente permanente\n"Dúvida sobre o sino ou o quadro? Já conferiu algo? Fale comigo."',
      () => ui.openAdministrador(),
    );
    const star = this.add.text(adminX + 7, adminY - 34, '✦', { fontFamily: 'serif', fontSize: '10px', color: '#f7d046', resolution: 4 }).setOrigin(0.5).setDepth(100000);
    star.setStroke('#5e3a1c', 2);
    this.tweens.add({ targets: star, y: star.y - 3, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    // Um banco só, à esquerda, e os arbustos juntos à direita: a praça não fica espelhada.
    this.addSprite('bench', fountain.x - 64, fountain.y + 16);
    this.addSprite('bush', fountain.x + 72, fountain.y + 12);
    this.addSprite('bush', fountain.x + 58, fountain.y + 17);
    for (const side of [-1, 1]) {
      this.addSprite(side < 0 ? 'tree0' : 'tree1', fountain.x + side * 78, plaza.y + 30);
      this.addSprite('lamppost', fountain.x + side * 86, plaza.y + plaza.h - 6);
    }

    // Gotas saindo do jato do chafariz.
    const jetY = fountain.y - 18;
    this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const drop = this.add.rectangle(fountain.x + dir, jetY, 1, 1, 0xc6e8f2).setDepth(fountain.y + 21);
        this.tweens.add({
          targets: drop,
          x: drop.x + dir * (4 + Math.random() * 6),
          y: jetY + 8,
          alpha: 0,
          duration: 500,
          ease: 'Quad.in',
          onComplete: () => drop.destroy(),
        });
      },
    });
  }

  private buildHouse(plot: Plot, rnd: () => number) {
    const p = plot.project;
    const roof = p.isGit ? ROOF_NAMES[hash(p.name) % ROOF_NAMES.length] : 'grey';
    const house = this.addSprite(`house-${roof}`, plot.house.x, plot.house.y);
    makeInteractive(
      house,
      () => {
        const cur = this.currentProject(p.id);
        const n = this.world.sessions.filter((s) => s.projectId === p.id).length;
        const urgent = urgentPendencias(cur).length;
        return `${cur.name}${cur.branch ? ` — ${cur.branch}` : ''}${cur.isGit ? '' : ' (sem git)'} · ${n} morador(es)${urgent ? ` · ❗ ${urgent} pendência(s) crítica(s)` : ''} — clique para entrar`;
      },
      () => this.enterHouse(this.currentProject(p.id)),
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
    label(this, plot.house.x, plot.house.y + 26, p.name, plot.house.y + 26);

    const alertBg = this.add.graphics();
    alertBg.fillStyle(0x2b1a0e).fillRoundedRect(-5, -8, 10, 15, 3);
    alertBg.fillStyle(0xd6402f).fillRoundedRect(-4, -7, 8, 13, 2);
    const alertText = this.add.text(0, 0, '!', { ...TEXT_STYLE, color: '#ffffff', fontSize: '9px' }).setOrigin(0.5, 0.55);
    const alert = this.add
      .container(plot.house.x - 14, plot.house.y - 80, [alertBg, alertText])
      .setDepth(plot.house.y + 2)
      .setVisible(false);
    this.tweens.add({ targets: alert, y: alert.y - 3, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });

    // Andaime na frente da metade direita da fachada (por cima da janela, por baixo do "!").
    const scaffold = this.add.image(plot.house.x + 17, plot.house.y - 1, 'scaffold').setOrigin(0.5, 1).setDepth(plot.house.y + 1.5).setVisible(false);
    makeInteractive(
      scaffold,
      () => `Em obra — falta: ${this.currentProject(p.id).missingStructure.join(', ')} — clique para ver como resolver`,
      () => ui.openObra(this.currentProject(p.id)),
    );

    // Placa de vistoria embaixo da janela da esquerda, entre o peitoril e a fundação.
    const plaque = this.add.image(plot.house.x - 16, plot.house.y - 8, 'plaque-ok').setOrigin(0.5, 1).setDepth(plot.house.y + 1).setVisible(false);
    makeInteractive(
      plaque,
      () => {
        const due = this.currentProject(p.id).auditoria ?? '';
        const [y, m, d] = due.split('-');
        return auditoriaVencida(due)
          ? `Vistoria das regras vencida desde ${d}/${m}/${y} — numa sessão desta casa, rode /auditar-regras`
          : `Vistoria das regras em dia — próxima até ${d}/${m}/${y} (/auditar-regras)`;
      },
      // A placa está na fachada: o clique continua entrando na casa.
      () => this.enterHouse(this.currentProject(p.id)),
    );

    const view: HouseView = { plot, glows, alert, scaffold, plaque, crops: [], cropsKey: '', weeds: [], weedsKey: '' };
    if (p.isGit) {
      const bin = this.addSprite('bin', plot.bin.x, plot.bin.y);
      makeInteractive(
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

  /** Replanta a horta só quando as fases mudam; sem plano no `painel.json`, sem horta. */
  /** Uma erva por retrabalho (até 9), à direita da casa; só replanta quando a contagem muda. Sem o arquivo, nada. */
  private growWeeds(view: HouseView, project: Project) {
    const n = Math.min(project.retrabalho?.rows.length ?? 0, WEEDS_MAX);
    const key = String(n);
    if (key === view.weedsKey) return;
    view.weedsKey = key;
    for (const w of view.weeds) w.destroy();
    const { x, y } = view.plot.house;
    view.weeds = Array.from({ length: n }, (_, i) => {
      const weed = this.addSprite(i % 3 === 1 ? 'weed1' : 'weed0', x + 42 + (i % WEEDS_COLS) * 9, y - 48 + Math.floor(i / WEEDS_COLS) * 9);
      makeInteractive(
        weed,
        () => `Retrabalho — ${this.currentProject(project.id).retrabalho?.rows.length ?? 0} registro(s) no RETRABALHO.md — clique para ver`,
        () => ui.openRetrabalho(this.currentProject(project.id)),
      );
      return weed;
    });
  }

  private plantGarden(view: HouseView, project: Project) {
    const plano = project.painel?.plano;
    const fases = (plano?.fases ?? []).slice(0, GARDEN_MAX);
    const key = JSON.stringify(fases);
    if (key === view.cropsKey) return;
    view.cropsKey = key;
    for (const c of view.crops) c.destroy();
    const { x, y } = view.plot.house;
    view.crops = fases.map((f, i) => {
      const crop = this.addSprite(CROP_TEXTURE[f.estado], x - 72 + (i % GARDEN_COLS) * 14, y - 42 + Math.floor(i / GARDEN_COLS) * 14);
      makeInteractive(
        crop,
        () => `Horta — ${plano!.nome}: ${f.nome} (${PHASE_TEXT[f.estado]}) — clique para ver o plano`,
        () => ui.openPainel(this.currentProject(project.id)),
      );
      return crop;
    });
  }

  private updateHouse(view: HouseView, project: Project) {
    if (view.badge && view.badgeText) {
      const n = project.changes.length;
      view.badge.setVisible(n > 0);
      view.badgeText.setText(n > 99 ? '99+' : String(n));
    }
    view.alert.setVisible(urgentPendencias(project).length > 0);
    view.scaffold.setVisible(project.missingStructure.length > 0);
    view.plaque.setVisible(!!project.auditoria).setTexture(auditoriaVencida(project.auditoria) ? 'plaque-due' : 'plaque-ok');
    this.plantGarden(view, project);
    this.growWeeds(view, project);
    const lit = this.world.sessions.some((s) => s.projectId === project.id && s.live);
    for (const g of view.glows) {
      this.tweens.killTweensOf(g);
      this.tweens.add({ targets: g, alpha: lit ? 0.85 : 0, duration: 500 });
    }
  }

  // ---------------- moradores ----------------

  /** Do lado de fora só ficam os moradores mais relevantes; o resto está dentro de casa. */
  /** Um NPC ✦ por agente (menos os do Dev Valley, como a bibliotecária, que mora na biblioteca). */
  private syncAgents() {
    if (!this.agentArea) return;
    const shown = this.world.agents.filter((a) => !a.managed).slice(0, MAX_AGENT_NPCS);
    const byPath = new Map(shown.map((a) => [a.path, a]));
    for (const [path, a] of this.agentNpcs) {
      if (byPath.has(path)) continue;
      a.timer?.remove();
      a.npc.destroy();
      this.agentNpcs.delete(path);
    }
    for (const agent of shown) {
      const existing = this.agentNpcs.get(agent.path);
      if (existing) {
        existing.npc.agent = agent;
        continue;
      }
      const where = agent.projectId === null ? 'global' : `projeto ${this.world.projects.find((p) => p.id === agent.projectId)?.name ?? ''}`;
      const rnd = mulberry32(hash(agent.path));
      const area = this.agentArea;
      const entry: { npc: AgentNpc; timer?: Phaser.Time.TimerEvent } = {
        npc: new AgentNpc(this, agent, where, area.x + rnd() * area.w, area.y + rnd() * area.h),
      };
      this.agentNpcs.set(agent.path, entry);
      this.wanderAgent(entry, 800 + rnd() * 3000);
    }
  }

  /** Passeio do agente: só na horizontal, pelo pátio da Fábrica. */
  private wanderAgent(entry: { npc: AgentNpc; timer?: Phaser.Time.TimerEvent }, delay: number) {
    entry.timer = this.time.delayedCall(delay, () => {
      const { npc } = entry;
      if (!npc.sprite.active) return;
      const tx = Math.round(this.agentArea.x + Math.random() * this.agentArea.w);
      const dist = Math.abs(tx - npc.sprite.x);
      npc.walk('side', tx < npc.sprite.x);
      this.tweens.add({
        targets: npc.sprite,
        x: tx,
        duration: Math.max(1, dist) * 50,
        onUpdate: () => npc.place(),
        onComplete: () => {
          if (!npc.sprite.active) return;
          npc.stand();
          if (Math.random() < 0.7) npc.face('down');
          this.wanderAgent(entry, 2500 + Math.random() * 5000);
        },
      });
    });
  }

  private visibleSessions(): Session[] {
    const owners = [null, ...this.world.projects.map((p) => p.id)];
    return owners.flatMap((id) => yardResidents(this.world, id));
  }

  private syncResidents() {
    const visible = this.visibleSessions();
    const byId = new Map(visible.map((s) => [s.id, s]));
    for (const [id, r] of this.residents) {
      const s = byId.get(id);
      if (!s || this.areaFor(s) !== r.area) {
        r.timer?.remove();
        r.view.destroy();
        this.residents.delete(id);
      }
    }
    for (const s of visible) {
      const existing = this.residents.get(s.id);
      if (existing) existing.view.update(s);
      else this.spawnResident(s);
    }
  }

  private areaFor(s: Session): Rect | undefined {
    if (!this.layout) return undefined;
    if (!s.projectId) return this.plazaWalkArea;
    return this.layout.plots.find((p) => p.project.id === s.projectId)?.yard;
  }

  private spawnResident(session: Session) {
    const area = this.areaFor(session);
    if (!area) return;
    const rnd = mulberry32(hash(session.id));
    const view = new VillagerView(this, session, area.x + rnd() * area.w, area.y + rnd() * area.h);
    const r: Resident = { view, area };
    this.residents.set(session.id, r);
    this.scheduleWander(r, 500 + rnd() * 3000);
  }

  /** Anda em linha reta numa só direção, como no Stardew (nada de diagonal). */
  private walkStraight(r: Resident, axis: 'x' | 'y', target: number, done: () => void) {
    const sprite = r.view.sprite;
    const from = sprite[axis];
    const dist = Math.abs(target - from);
    if (dist < 2) return done();
    if (axis === 'x') r.view.walk('side', target < from);
    else r.view.walk(target > from ? 'down' : 'up');
    this.tweens.add({
      targets: sprite,
      [axis]: target,
      duration: dist * 45,
      onUpdate: () => r.view.place(),
      onComplete: done,
    });
  }

  private scheduleWander(r: Resident, delay: number) {
    r.timer = this.time.delayedCall(delay, () => {
      if (!r.view.sprite.active) return;
      // Quem precisa de você fica parado olhando para a tela, com o "!" na cabeça.
      if (r.view.session.status === 'permission') {
        r.view.stand();
        r.view.face('down');
        return this.scheduleWander(r, 1500);
      }
      const tx = Math.round(r.area.x + Math.random() * r.area.w);
      const ty = Math.round(r.area.y + Math.random() * r.area.h);
      const xFirst = Math.random() < 0.5;
      const [a1, t1, a2, t2] = xFirst ? (['x', tx, 'y', ty] as const) : (['y', ty, 'x', tx] as const);
      this.walkStraight(r, a1, t1, () =>
        this.walkStraight(r, a2, t2, () => {
          if (!r.view.sprite.active) return;
          r.view.stand();
          // Ao parar, quase sempre se vira para a frente, como quem olha para o jogador.
          if (Math.random() < 0.7) r.view.face('down');
          // Sessões ativas ficam mais agitadas.
          this.scheduleWander(r, (r.view.session.live ? 1500 : 4000) + Math.random() * 4000);
        }),
      );
    });
  }
}
