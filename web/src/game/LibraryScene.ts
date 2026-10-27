import Phaser from 'phaser';
import { library, type LibrarySection } from '../api';
import { ui } from '../ui/actions';
import { label, makeInteractive } from './common';
import { generateInteriorTextures, generateLibraryTextures, libraryShelf } from './interiorTextures';
import { hash, ROOFS } from './textures';
import { villagerTexture } from './villager';

const W = 368;
const WALL_H = 40;
const SHELF_COLS = 7;
const SHELF_SPACING_X = 50;
const SHELF_ROW_H = 78;

const ROOF_NAMES = Object.keys(ROOFS).filter((r) => r !== 'grey');

/** Cor da moldura de cada estante — projetos usam a mesma cor do telhado da casa. */
function trimFor(s: LibrarySection) {
  if (s.kind === 'global') return '#c9a227';
  if (s.kind === 'memory') return '#7a4aa0';
  if (s.kind === 'root') return '#2a8f8a';
  return ROOFS[ROOF_NAMES[hash(s.title) % ROOF_NAMES.length]][0];
}

/** Estantes pouco cheias com poucos arquivos, lotadas a partir de ~200. */
const fillFor = (n: number) => (n ? Math.min(1, 0.08 + Math.log10(n + 1) / Math.log10(200)) : 0);

/** A plaquinha é curta; o nome completo aparece no tooltip. */
function shortTitle(s: LibrarySection) {
  if (s.kind === 'global') return 'Global';
  if (s.kind === 'memory') return 'Memórias';
  return s.title.length > 8 ? s.title.slice(0, 7) + '…' : s.title;
}

/** A Biblioteca por dentro: uma estante por seção de conhecimento. */
export class LibraryScene extends Phaser.Scene {
  private instant = false;
  private roomHeight = 0;

  constructor() {
    super('library');
  }

  init(data: { instant?: boolean }) {
    this.instant = !!data.instant;
  }

  async create() {
    generateInteriorTextures(this);
    generateLibraryTextures(this);
    this.cameras.main.setBackgroundColor('#1a120b');
    ui.setLocation('Biblioteca', 'Clique numa estante para ler · fichário ou bibliotecária para buscar · Esc ou tapete para sair');

    const onResize = () => this.frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!ui.isPanelOpen()) this.leave();
    });
    if (!this.instant) this.cameras.main.fadeIn(250);

    const sections = await library.sections().catch(() => []);
    this.buildRoom(sections);

    // Link direto para uma estante: ?casa=biblioteca&estante=<id ou nome>
    const shelf = new URLSearchParams(location.search).get('estante');
    const section = this.instant && shelf && sections.find((s) => s.id === shelf || s.title === shelf || s.kind === shelf);
    if (section) ui.openLibrary({ sectionId: section.id });
    else if (this.instant && shelf === 'bibliotecaria') ui.openLibrarian();
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

  private buildRoom(sections: LibrarySection[]) {
    const rows = Math.max(1, Math.ceil(sections.length / SHELF_COLS));
    const loungeTop = WALL_H + rows * SHELF_ROW_H;
    const H = loungeTop + 96;

    this.add.tileSprite(0, WALL_H, W, H - WALL_H, 'libFloor').setOrigin(0).setDepth(-20);
    this.add.tileSprite(0, 0, W, WALL_H, 'libWall').setOrigin(0).setDepth(-19);
    const frame = this.add.graphics().setDepth(99999);
    frame.fillStyle(0x3a2412).fillRect(-6, 0, 6, H).fillRect(W, 0, 6, H).fillRect(-6, H, W + 12, 6);
    frame.fillRect(0, H - 4, W / 2 - 18, 4).fillRect(W / 2 + 18, H - 4, W / 2 - 18, 4);

    // ---- estantes: uma por seção ----
    sections.forEach((s, i) => {
      const col = i % SHELF_COLS;
      const row = Math.floor(i / SHELF_COLS);
      const inRow = Math.min(SHELF_COLS, sections.length - row * SHELF_COLS);
      const x = W / 2 + (col - (inRow - 1) / 2) * SHELF_SPACING_X;
      const y = WALL_H + 12 + row * SHELF_ROW_H + 48;
      const key = libraryShelf(this, `shelf-${hash(s.id)}-${s.files.length}`, trimFor(s), fillFor(s.files.length), hash(s.id));
      const shelf = this.prop(key, x, y);
      makeInteractive(
        shelf,
        () => `${s.title} — ${s.files.length} livro(s)${s.missingClaudeMd ? ' · sem CLAUDE.md' : ''}`,
        () => ui.openLibrary({ sectionId: s.id }),
      );
      label(this, x, y + 9, shortTitle(s), y + 9);
      // Projeto sem CLAUDE.md ganha um aviso pulando em cima da estante.
      if (s.missingClaudeMd) {
        const warn = this.add.image(x + 12, y - 58, 'alert').setDepth(y + 1).setScale(0.75);
        this.tweens.add({ targets: warn, y: warn.y - 2, yoyo: true, repeat: -1, duration: 400 });
      }
    });

    // ---- balcão, fichário e mesa de leitura ----
    const counterY = loungeTop + 54;
    const librarian = this.add
      .sprite(W / 2, counterY - 6, villagerTexture(this, 'bibliotecaria-dev-valley', true), 0)
      .setOrigin(0.5, 1)
      .setDepth(counterY - 10);
    makeInteractive(
      librarian,
      () => '✦ Bibliotecária — agente permanente\n"Procurando algum conhecimento? Eu sei onde está."',
      () => ui.openLibrarian(),
    );
    this.prop('counter', W / 2, counterY);
    // NPCs especiais (agentes, não sessões) ganham uma estrela dourada flutuando.
    const star = this.add.text(W / 2 + 7, counterY - 40, '✦', { fontFamily: 'serif', fontSize: '10px', color: '#f7d046', resolution: 4 }).setOrigin(0.5).setDepth(100000);
    star.setStroke('#5e3a1c', 2);
    this.tweens.add({ targets: star, y: star.y - 3, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

    const catalog = this.prop('catalog', 40, counterY - 4);
    makeInteractive(catalog, () => 'Fichário — buscar em todos os livros', () => ui.openLibrary({ search: true }));

    this.prop('readingTable', W - 50, counterY - 6);
    this.prop('globe', W - 18, loungeTop + 24);
    this.prop('plant', 16, loungeTop + 22);

    const mat = this.prop('doormat', W / 2, H + 2);
    makeInteractive(mat, () => 'Sair (Esc)', () => this.leave());

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
}
