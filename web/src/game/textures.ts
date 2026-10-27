import Phaser from 'phaser';

/**
 * Toda a pixel art é gerada em código para o MVP não depender de assets externos.
 * Quando quisermos um tileset de verdade, basta trocar estas funções por `this.load.image`.
 */

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#2b1a0e';

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true })! };
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) ctx.fillRect(cx + x, cy + y, 1, 1);
}

/** Contorno escuro de 1px ao redor dos pixels opacos — o "look" Stardew. */
export function outline(ctx: Ctx, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 128;
  const marks: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!opaque(x, y) && (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)))
        marks.push(x, y);
  ctx.fillStyle = OUTLINE;
  for (let i = 0; i < marks.length; i += 2) ctx.fillRect(marks[i], marks[i + 1], 1, 1);
}

export function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

// ---------------- chão ----------------

function grass(scene: Phaser.Scene, key: string, seed: number) {
  const { c, ctx } = makeCanvas(16, 16);
  const rnd = mulberry32(seed);
  rect(ctx, 0, 0, 16, 16, '#6fb04a');
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rnd() * 16);
    const y = Math.floor(rnd() * 15);
    rect(ctx, x, y, 1, 2, '#5a9a3a');
  }
  for (let i = 0; i < 6; i++) rect(ctx, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1, '#88c65e');
  add(scene, key, c);
}

function dirt(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 16);
  const rnd = mulberry32(7);
  rect(ctx, 0, 0, 16, 16, '#c9a36b');
  for (let i = 0; i < 20; i++) rect(ctx, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1, rnd() > 0.5 ? '#b8915a' : '#d8b682');
  for (let i = 0; i < 3; i++) rect(ctx, Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 1, '#9b7848');
  add(scene, 'dirt', c);
}

function stone(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 16);
  rect(ctx, 0, 0, 16, 16, '#bdb4a2');
  rect(ctx, 0, 7, 16, 1, '#958c7c');
  rect(ctx, 0, 15, 16, 1, '#958c7c');
  rect(ctx, 7, 0, 1, 7, '#958c7c');
  rect(ctx, 3, 8, 1, 7, '#958c7c');
  rect(ctx, 12, 8, 1, 7, '#958c7c');
  rect(ctx, 1, 1, 3, 1, '#cfc7b6');
  rect(ctx, 9, 9, 2, 1, '#cfc7b6');
  add(scene, 'stone', c);
}

// ---------------- natureza ----------------

function tree(scene: Phaser.Scene, key: string, palette: [string, string, string]) {
  const { c, ctx } = makeCanvas(34, 50);
  rect(ctx, 14, 30, 6, 18, '#6b4423');
  rect(ctx, 14, 30, 2, 18, '#553419');
  rect(ctx, 12, 46, 10, 2, '#6b4423');
  disc(ctx, 17, 18, 15, palette[0]);
  disc(ctx, 11, 22, 9, palette[0]);
  disc(ctx, 23, 22, 9, palette[0]);
  disc(ctx, 16, 15, 12, palette[1]);
  disc(ctx, 13, 11, 6, palette[2]);
  disc(ctx, 22, 17, 4, palette[2]);
  outline(ctx, 34, 50);
  add(scene, key, c);
}

function bush(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(18, 14);
  disc(ctx, 6, 8, 5, '#2f6e30');
  disc(ctx, 12, 8, 5, '#2f6e30');
  disc(ctx, 9, 6, 5, '#3f8a3a');
  disc(ctx, 7, 5, 2, '#58a84a');
  rect(ctx, 11, 7, 1, 1, '#d64545');
  rect(ctx, 6, 9, 1, 1, '#d64545');
  outline(ctx, 18, 14);
  add(scene, 'bush', c);
}

/** Erva daninha do quintal: uma linha do `RETRABALHO.md` (G17). A variante com flor só muda o desenho. */
function weed(scene: Phaser.Scene, key: string, flower: boolean) {
  const { c, ctx } = makeCanvas(9, 9);
  for (const [x, top, color] of [[1, 4, '#5f7d2a'], [3, 1, '#7a9a34'], [4, 3, '#5f7d2a'], [6, 2, '#8aa83c'], [7, 5, '#5f7d2a']] as const)
    rect(ctx, x, top, 1, 9 - top, color);
  rect(ctx, 2, 6, 5, 3, '#4b6522');
  if (flower) {
    rect(ctx, 2, 1, 3, 1, '#a35bc4');
    rect(ctx, 3, 0, 1, 3, '#a35bc4');
    rect(ctx, 3, 1, 1, 1, '#f5d142');
  }
  outline(ctx, 9, 9);
  add(scene, key, c);
}

/** Placa de vistoria embaixo da janela da esquerda: no prazo (papel) ou vencida (amarela). */
function plaque(scene: Phaser.Scene, key: string, face: string, lines: string) {
  const { c, ctx } = makeCanvas(9, 7);
  rect(ctx, 0, 0, 9, 7, '#6b4423');
  rect(ctx, 1, 1, 7, 5, face);
  rect(ctx, 2, 2, 5, 1, lines);
  rect(ctx, 2, 4, 3, 1, lines);
  add(scene, key, c);
}

/**
 * Pombal: casinha de passarinho num poste, no quintal à direita da caixa de envio (sincronização com a branch comum
 * do time). Parede azul e telhado vermelho para destacar do resto do quintal. `pigeon`: buraco vazio (o pombo saiu
 * ou não pode sair), dormindo (em dia) ou acordado (há cartas suas esperando para ir).
 */
function dovecote(scene: Phaser.Scene, key: string, pigeon: 'none' | 'sleep' | 'awake') {
  const W = 24;
  const H = 46;
  const { c, ctx } = makeCanvas(W, H);
  // poste e base
  rect(ctx, 10, 28, 4, 16, '#8d5f30');
  rect(ctx, 10, 28, 1, 16, '#a0703a');
  rect(ctx, 7, 43, 10, 2, '#6b4423');
  // casinha
  rect(ctx, 4, 12, 16, 15, '#6fa8dc');
  for (const y of [16, 20, 24]) rect(ctx, 4, y, 16, 1, '#5b8fc0');
  // telhado em duas águas, com beiral escuro
  for (let i = 0; i < 9; i++) {
    const w = 4 + i * 2;
    rect(ctx, 12 - w / 2, 3 + i, w, 1, i === 8 ? '#8e2b20' : i % 3 === 0 ? '#d95a4a' : '#c0392b');
  }
  disc(ctx, 12, 18, 3, '#2b1a0e');
  if (pigeon !== 'none') {
    disc(ctx, 12, 19, 2, '#b9bcc4');
    rect(ctx, 14, 19, 1, 1, '#e8892b');
    if (pigeon === 'sleep') rect(ctx, 11, 18, 2, 1, '#6e7078');
    else rect(ctx, 12, 18, 1, 1, '#2b1a0e');
  }
  // poleiro
  rect(ctx, 2, 27, 20, 2, '#a0703a');
  rect(ctx, 2, 28, 20, 1, '#7a4b20');
  outline(ctx, W, H);
  add(scene, key, c);
}

/** Pombo pousado no telhado do pombal com uma carta no bico: chegou coisa nova da branch comum. */
function pigeonLetter(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(21, 14);
  rect(ctx, 1, 7, 3, 3, '#8b8e96');
  disc(ctx, 7, 8, 4, '#b9bcc4');
  rect(ctx, 5, 7, 4, 1, '#a7aab3');
  rect(ctx, 9, 6, 3, 2, '#6fa58a');
  disc(ctx, 11, 4, 3, '#a7aab3');
  rect(ctx, 12, 3, 1, 1, '#2b1a0e');
  rect(ctx, 14, 4, 1, 1, '#e8892b');
  rect(ctx, 15, 3, 5, 4, '#f4efe0');
  rect(ctx, 17, 4, 1, 2, '#c0392b');
  for (const x of [6, 9]) rect(ctx, x, 12, 1, 1, '#e8892b');
  outline(ctx, 21, 14);
  add(scene, 'pigeon-letter', c);
}

/** Carta no poleiro do pombal: um commit seu que a branch comum ainda não tem. */
function letter(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(9, 7);
  rect(ctx, 1, 1, 7, 5, '#f4efe0');
  for (const [x, y] of [[1, 1], [7, 1], [2, 2], [6, 2], [3, 3], [5, 3]]) rect(ctx, x, y, 1, 1, '#c9b99a');
  rect(ctx, 4, 3, 1, 1, '#c0392b');
  outline(ctx, 9, 7);
  add(scene, 'letter', c);
}

/** Andaime na frente da fachada: projeto sem a estrutura de acompanhamento dos guardrails (casa em obra). */
function scaffold(scene: Phaser.Scene) {
  const W = 26;
  const H = 46;
  const { c, ctx } = makeCanvas(W, H);
  // travessas em X entre os pisos
  for (let i = 0; i < 12; i++) {
    rect(ctx, 3 + i * 1.7, 4 + i, 1, 1, '#8d5f30');
    rect(ctx, 22 - i * 1.7, 4 + i, 1, 1, '#8d5f30');
    rect(ctx, 3 + i * 1.7, 22 + i, 1, 1, '#8d5f30');
    rect(ctx, 22 - i * 1.7, 22 + i, 1, 1, '#8d5f30');
  }
  // postes
  for (const x of [1, 23]) {
    rect(ctx, x, 0, 2, H, '#a0703a');
    rect(ctx, x, 0, 1, H, '#c79a5e');
  }
  // pisos de tábua
  for (const y of [16, 34]) {
    rect(ctx, 0, y, W, 3, '#c79a5e');
    rect(ctx, 0, y + 2, W, 1, '#8d5f30');
  }
  // fita de obra no piso de baixo
  for (let x = 0; x < W; x += 4) rect(ctx, x, 35, 2, 1, '#f5d142');
  outline(ctx, W, H);
  add(scene, 'scaffold', c);
}

/** Canteiro da horta: uma fase do `painel.json`. Terra arada (a fazer), broto (andamento) ou planta madura (feito). */
function crop(scene: Phaser.Scene, key: string, stage: 0 | 1 | 2) {
  const { c, ctx } = makeCanvas(14, 16);
  rect(ctx, 1, 9, 12, 6, '#8a5a2e');
  for (const y of [11, 13]) rect(ctx, 2, y, 10, 1, '#6e4521');
  rect(ctx, 1, 9, 12, 1, '#a8743c');
  if (stage === 1) {
    rect(ctx, 6, 6, 1, 4, '#3f8a3a');
    rect(ctx, 4, 6, 2, 1, '#58a84a');
    rect(ctx, 7, 5, 2, 1, '#58a84a');
  }
  if (stage === 2) {
    rect(ctx, 6, 2, 2, 8, '#2f6e30');
    disc(ctx, 4, 5, 2, '#3f8a3a');
    disc(ctx, 10, 5, 2, '#3f8a3a');
    disc(ctx, 7, 2, 2, '#58a84a');
    rect(ctx, 3, 7, 2, 2, '#e8892b');
    rect(ctx, 9, 7, 2, 2, '#e8892b');
    rect(ctx, 7, 0, 1, 1, '#f5d142');
  }
  outline(ctx, 14, 16);
  add(scene, key, c);
}

function flower(scene: Phaser.Scene, key: string, petal: string) {
  const { c, ctx } = makeCanvas(5, 6);
  rect(ctx, 2, 3, 1, 3, '#3f8a3a');
  rect(ctx, 1, 0, 3, 3, petal);
  rect(ctx, 0, 1, 5, 1, petal);
  rect(ctx, 2, 1, 1, 1, '#f5d142');
  add(scene, key, c);
}

// ---------------- construções ----------------

export const ROOFS: Record<string, [string, string, string]> = {
  red: ['#b8402f', '#8c2c20', '#d45a44'],
  blue: ['#2f6db0', '#1f4c80', '#4b8cd2'],
  green: ['#3c8a48', '#285f31', '#56a862'],
  purple: ['#7a4aa0', '#573373', '#9566bb'],
  orange: ['#d07a2a', '#a35a19', '#e6964a'],
  teal: ['#2a8f8a', '#1b6663', '#46aea8'],
  grey: ['#7d7f84', '#5b5d61', '#9a9ca1'],
};

function roof(ctx: Ctx, x0: number, w: number, top: number, bottom: number, pal: [string, string, string]) {
  const h = bottom - top;
  for (let y = 0; y < h; y++) {
    const inset = Math.round(((h - y) * 10) / h);
    const color = y % 5 === 4 ? pal[1] : pal[0];
    rect(ctx, x0 + inset, top + y, w - inset * 2, 1, color);
    if (y % 5 === 0) rect(ctx, x0 + inset + 2, top + y, w - inset * 2 - 4, 1, pal[2]);
  }
  rect(ctx, x0, bottom - 2, w, 2, pal[1]);
}

export function window_(ctx: Ctx, x: number, y: number) {
  rect(ctx, x, y, 12, 10, '#4a2a12');
  rect(ctx, x + 1, y + 1, 10, 8, '#8fc8de');
  rect(ctx, x + 1, y + 1, 4, 3, '#c6e8f2');
  rect(ctx, x + 6, y + 1, 1, 8, '#4a2a12');
  rect(ctx, x + 1, y + 5, 10, 1, '#4a2a12');
  rect(ctx, x - 1, y + 10, 14, 2, '#7a4b20');
}

export function planks(ctx: Ctx, x: number, y: number, w: number, h: number) {
  rect(ctx, x, y, w, h, '#b9854a');
  for (let yy = y + 4; yy < y + h; yy += 5) rect(ctx, x, yy, w, 1, '#8d5f30');
  rect(ctx, x, y, 3, h, '#6b4220');
  rect(ctx, x + w - 3, y, 3, h, '#6b4220');
}

function house(scene: Phaser.Scene, key: string, pal: [string, string, string]) {
  const W = 64;
  const H = 74;
  const { c, ctx } = makeCanvas(W, H);
  // chaminé
  rect(ctx, 44, 2, 7, 14, '#8e3b2e');
  rect(ctx, 43, 2, 9, 2, '#6d2b21');
  planks(ctx, 5, 36, W - 10, 34);
  rect(ctx, 5, 68, W - 10, 4, '#8a8478');
  roof(ctx, 0, W, 8, 38, pal);
  window_(ctx, 10, 46);
  window_(ctx, 42, 46);
  // porta
  rect(ctx, 25, 50, 14, 22, '#4a2a12');
  rect(ctx, 26, 51, 12, 21, '#7a4724');
  rect(ctx, 26, 58, 12, 1, '#5e3519');
  rect(ctx, 35, 61, 2, 2, '#e8c252');
  outline(ctx, W, H);
  add(scene, key, c);
}

/** Janela em arco da biblioteca com as estantes de livros aparecendo por dentro. */
function bookWindow(ctx: Ctx, x: number, y: number, rnd: () => number) {
  const H = 25;
  const SPINES = ['#8c2c20', '#2f6db0', '#3c8a48', '#d07a2a', '#7a4aa0', '#e8c252', '#2a8f8a', '#f2e6c4'];
  rect(ctx, x + 3, y, 6, 1, '#4a2a12');
  rect(ctx, x + 1, y + 1, 10, 1, '#4a2a12');
  rect(ctx, x, y + 2, 12, H - 2, '#4a2a12');
  rect(ctx, x + 3, y + 1, 6, 1, '#3a2010');
  rect(ctx, x + 1, y + 2, 10, H - 3, '#3a2010');
  for (let row = 0; row < 3; row++) {
    const board = y + 9 + row * 7;
    for (let xx = x + 1; xx < x + 11; ) {
      const w = rnd() > 0.7 ? 2 : 1;
      const h = 4 + Math.floor(rnd() * 3);
      if (rnd() > 0.12) rect(ctx, xx, board - h, Math.min(w, x + 11 - xx), h, SPINES[Math.floor(rnd() * SPINES.length)]);
      xx += w;
    }
    rect(ctx, x + 1, board, 10, 1, '#8d5f30');
  }
  rect(ctx, x - 1, y + H, 14, 2, '#c4bca9');
}

/**
 * Biblioteca: fachada clássica (frontão com livro aberto, colunas, escadaria) e janelas em arco que deixam ver
 * as estantes cheias de livros por dentro, para ser reconhecida como biblioteca à primeira vista.
 */
function library(scene: Phaser.Scene) {
  const W = 100;
  const H = 90;
  const { c, ctx } = makeCanvas(W, H);
  const rnd = mulberry32(11);
  // parede de pedra
  rect(ctx, 6, 38, W - 12, 44, '#b3ab9c');
  for (let y = 42; y < 82; y += 6) {
    rect(ctx, 6, y, W - 12, 1, '#8f877a');
    for (let x = 6 + ((y / 6) % 2) * 6; x < W - 6; x += 12) rect(ctx, x, y - 5, 1, 5, '#8f877a');
  }
  // telhado em duas águas com o frontão de pedra na frente
  const pal = ['#4b3d7a', '#33295a', '#6656a0'];
  for (let i = 0; i < 30; i++) {
    const hw = 2 + Math.round((i * 46) / 29);
    rect(ctx, 50 - hw, 4 + i, hw * 2, 1, i % 5 === 4 ? pal[1] : pal[0]);
    if (i % 5 === 0 && hw > 4) rect(ctx, 50 - hw + 2, 4 + i, hw * 2 - 4, 1, pal[2]);
  }
  for (let i = 0; i < 22; i++) {
    const hw = Math.round((i * 36) / 21);
    rect(ctx, 50 - hw, 10 + i, hw * 2, 1, i === 21 ? '#c4bca9' : '#e3dccb');
  }
  // livro aberto no frontão
  rect(ctx, 38, 20, 24, 10, '#5a4630');
  rect(ctx, 39, 22, 10, 6, '#f7f0dc');
  rect(ctx, 51, 22, 10, 6, '#f7f0dc');
  rect(ctx, 40, 21, 8, 1, '#f7f0dc');
  rect(ctx, 52, 21, 8, 1, '#f7f0dc');
  for (const y of [23, 25]) {
    rect(ctx, 41, y, 6, 1, '#b8ad90');
    rect(ctx, 53, y, 6, 1, '#b8ad90');
  }
  rect(ctx, 49, 21, 2, 8, '#8c2c20');
  rect(ctx, 38, 28, 24, 2, '#8c2c20');
  // arquitrave com a inscrição e os dentículos
  rect(ctx, 2, 32, W - 4, 6, '#e3dccb');
  rect(ctx, 2, 32, W - 4, 1, '#efe9db');
  for (let x = 37; x < 63; x += 3) rect(ctx, x, 34, 2, 2, '#8f877a');
  for (let x = 4; x < W - 4; x += 4) rect(ctx, x, 37, 2, 2, '#c4bca9');
  // colunas
  for (const x of [6, 30, 64, 88]) {
    rect(ctx, x, 39, 6, 41, '#e3dccb');
    rect(ctx, x + 4, 39, 2, 41, '#c4bca9');
    rect(ctx, x + 2, 42, 1, 36, '#d2cab8');
    rect(ctx, x - 1, 39, 8, 2, '#efe9db');
    rect(ctx, x - 1, 78, 8, 2, '#c4bca9');
  }
  bookWindow(ctx, 15, 46, rnd);
  bookWindow(ctx, 73, 46, rnd);
  // porta em arco, de duas folhas
  rect(ctx, 44, 52, 12, 1, '#4a2a12');
  rect(ctx, 42, 53, 16, 1, '#4a2a12');
  rect(ctx, 41, 54, 18, 26, '#4a2a12');
  rect(ctx, 44, 53, 12, 1, '#6b3f1f');
  rect(ctx, 42, 54, 16, 26, '#6b3f1f');
  rect(ctx, 49, 54, 2, 26, '#4a2a12');
  for (const x of [43, 52]) {
    rect(ctx, x, 60, 5, 1, '#5e3519');
    rect(ctx, x, 70, 5, 1, '#5e3519');
  }
  rect(ctx, 47, 66, 1, 2, '#e8c252');
  rect(ctx, 52, 66, 1, 2, '#e8c252');
  // lampiões dos lados da porta
  for (const x of [37, 60]) {
    rect(ctx, x, 55, 3, 1, '#2b1a0e');
    rect(ctx, x, 56, 3, 4, '#f5d142');
    rect(ctx, x + 1, 57, 1, 2, '#fff3b0');
    rect(ctx, x, 60, 3, 1, '#2b1a0e');
  }
  // base e escadaria
  rect(ctx, 0, 84, W, 6, '#8a8478');
  rect(ctx, 2, 80, W - 4, 4, '#cfc7b6');
  rect(ctx, 2, 80, W - 4, 1, '#e3dccb');
  rect(ctx, 2, 83, W - 4, 1, '#a39b8b');
  rect(ctx, 36, 84, 28, 3, '#cfc7b6');
  rect(ctx, 36, 84, 28, 1, '#e3dccb');
  rect(ctx, 32, 87, 36, 3, '#bdb4a2');
  rect(ctx, 32, 87, 36, 1, '#d8d0c0');
  outline(ctx, W, H);
  add(scene, 'library', c);
}

/** Janela industrial da fábrica: caixilho de aço em grade e verga de tijolo. */
function factoryWindow(ctx: Ctx, x: number, y: number) {
  rect(ctx, x - 1, y - 3, 15, 3, '#b45a40');
  rect(ctx, x, y, 13, 15, '#3f464c');
  for (const px of [x + 1, x + 7])
    for (const py of [y + 1, y + 8]) {
      rect(ctx, px, py, 5, 6, '#8fc8de');
      rect(ctx, px, py, 2, 1, '#c6e8f2');
    }
  rect(ctx, x - 1, y + 15, 15, 2, '#bdb4a2');
}

/**
 * Fábrica de agentes: galpão de tijolo com telhado dente-de-serra e claraboias, chaminé soltando fumaça
 * e portão de enrolar sob uma viga de aço.
 */
function factory(scene: Phaser.Scene) {
  const W = 100;
  const H = 96;
  const { c, ctx } = makeCanvas(W, H);
  // telhado dente-de-serra, com claraboia de vidro em cada dente
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 24;
    for (let y = 0; y < 20; y++) rect(ctx, x0, 24 + y, Math.round((y * 21) / 19), 1, y % 5 === 4 ? '#56606a' : '#66717b');
    rect(ctx, x0 + 21, 24, 3, 20, '#3f464c');
    rect(ctx, x0 + 22, 25, 1, 18, '#9fd0e6');
  }
  rect(ctx, 0, 44, W, 3, '#3f464c');
  // parede de tijolo
  rect(ctx, 4, 47, W - 8, 42, '#a24e37');
  for (let y = 47; y < 89; y += 5) {
    rect(ctx, 4, y + 4, W - 8, 1, '#8e4430');
    const off = ((y - 47) / 5) % 2 === 0 ? 0 : 8;
    for (let x = 12 + off; x < W - 8; x += 16) rect(ctx, x, y, 1, 4, '#8e4430');
  }
  // pilares de canto
  for (const x of [4, 91]) {
    rect(ctx, x, 47, 5, 42, '#93463a');
    rect(ctx, x + 4, 47, 1, 42, '#7d3a2b');
  }
  factoryWindow(ctx, 14, 62);
  factoryWindow(ctx, 73, 62);
  // viga de aço e portão de enrolar
  rect(ctx, 32, 58, 36, 4, '#4c545c');
  rect(ctx, 32, 58, 36, 1, '#66717b');
  rect(ctx, 34, 62, 32, 27, '#4c545c');
  for (let y = 64; y < 88; y += 4) rect(ctx, 36, y, 28, 3, '#66717b');
  // base de pedra
  rect(ctx, 2, 89, W - 4, 7, '#8a8478');
  rect(ctx, 2, 89, W - 4, 1, '#a39b8b');
  // chaminé de tijolo com fumaça
  rect(ctx, 76, 14, 11, 30, '#7d3a2b');
  for (let y = 19; y < 44; y += 5) rect(ctx, 76, y, 11, 1, '#6a3124');
  rect(ctx, 85, 14, 2, 30, '#6a3124');
  rect(ctx, 74, 10, 15, 4, '#5a281d');
  disc(ctx, 81, 6, 3, '#d9dcde');
  disc(ctx, 87, 3, 2, '#e8eaeb');
  outline(ctx, W, H);
  add(scene, 'factory', c);
}

function bin(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(24, 20);
  rect(ctx, 1, 7, 22, 13, '#a0662e');
  for (let x = 6; x < 22; x += 5) rect(ctx, x, 8, 1, 12, '#7a4b20');
  rect(ctx, 1, 7, 2, 13, '#6f6f6f');
  rect(ctx, 21, 7, 2, 13, '#6f6f6f');
  rect(ctx, 0, 2, 24, 6, '#b87838');
  rect(ctx, 0, 6, 24, 2, '#8a5524');
  rect(ctx, 2, 3, 20, 1, '#d09050');
  outline(ctx, 24, 20);
  add(scene, 'bin', c);
}

function fountain(scene: Phaser.Scene) {
  const W = 56;
  const H = 40;
  const { c, ctx } = makeCanvas(W, H);
  // bacia de baixo
  rect(ctx, 2, 22, W - 4, 16, '#9a9284');
  for (let y = 30; y < 38; y += 4) rect(ctx, 2, y, W - 4, 1, '#7a7366');
  for (const x of [14, 28, 42]) rect(ctx, x, 27, 1, 11, '#7a7366');
  rect(ctx, 0, 20, W, 4, '#bdb4a2');
  rect(ctx, 0, 23, W, 1, '#958c7c');
  rect(ctx, 3, 24, W - 6, 4, '#3a6ea8');
  rect(ctx, 6, 25, 8, 1, '#7fb0e0');
  rect(ctx, 38, 26, 6, 1, '#7fb0e0');
  // coluna e taça de cima
  rect(ctx, 25, 11, 6, 13, '#bdb4a2');
  rect(ctx, 29, 11, 2, 13, '#958c7c');
  rect(ctx, 17, 8, 22, 3, '#bdb4a2');
  rect(ctx, 19, 11, 18, 1, '#958c7c');
  rect(ctx, 19, 8, 18, 1, '#7fb0e0');
  // água transbordando da taça e o jato do topo
  for (const x of [17, 21, 34, 38]) rect(ctx, x, 11, 1, 2, '#7fb0e0');
  rect(ctx, 27, 1, 2, 7, '#9fd0f0');
  rect(ctx, 26, 0, 4, 2, '#c6e8f2');
  outline(ctx, W, H);
  add(scene, 'fountain', c);
}

function noticeBoard(scene: Phaser.Scene) {
  const W = 28;
  const H = 30;
  const { c, ctx } = makeCanvas(W, H);
  for (const x of [4, 22]) rect(ctx, x, 6, 2, 24, '#6b4423');
  // telhadinho
  rect(ctx, 0, 2, W, 3, '#b8402f');
  rect(ctx, 2, 0, W - 4, 2, '#d45a44');
  rect(ctx, 0, 4, W, 1, '#8c2c20');
  // moldura e cortiça
  rect(ctx, 2, 6, W - 4, 16, '#7a4b20');
  rect(ctx, 3, 7, W - 6, 14, '#c79a5e');
  // recados
  rect(ctx, 5, 8, 6, 7, '#f2e6c4');
  rect(ctx, 6, 10, 4, 1, '#958c7c');
  rect(ctx, 6, 12, 3, 1, '#958c7c');
  rect(ctx, 13, 9, 5, 5, '#f5d142');
  rect(ctx, 19, 8, 4, 8, '#f2e6c4');
  rect(ctx, 20, 10, 2, 1, '#958c7c');
  rect(ctx, 8, 16, 7, 4, '#8fc8de');
  rect(ctx, 7, 8, 1, 1, '#d64545');
  rect(ctx, 15, 9, 1, 1, '#d64545');
  outline(ctx, W, H);
  add(scene, 'noticeboard', c);
}

// ---------------- praça ----------------

/** Outdoor dos guardrails atrás da praça: painel em branco; o texto e o estado são escritos pela cena. */
function billboard(scene: Phaser.Scene) {
  const W = 64;
  const H = 40;
  const { c, ctx } = makeCanvas(W, H);
  // postes e travessa de apoio
  for (const x of [12, 50]) {
    rect(ctx, x, 20, 3, 20, '#6b4423');
    rect(ctx, x, 20, 1, 20, '#8d5f30');
  }
  rect(ctx, 10, 30, 44, 2, '#6b4423');
  // moldura e painel
  rect(ctx, 0, 0, W, 24, '#7a4b20');
  rect(ctx, 0, 0, W, 1, '#a8743c');
  rect(ctx, 2, 2, W - 4, 20, '#f2e6c4');
  rect(ctx, 2, 20, W - 4, 2, '#d6cebd');
  outline(ctx, W, H);
  add(scene, 'billboard', c);
}

/** Sino de conferência: entregas esperando o usuário conferir na vila. */
function bell(scene: Phaser.Scene) {
  const W = 10;
  const H = 30;
  const { c, ctx } = makeCanvas(W, H);
  // poste e travessa
  rect(ctx, 4, 4, 2, 26, '#6b4423');
  rect(ctx, 4, 4, 1, 26, '#8d5f30');
  rect(ctx, 1, 2, 8, 3, '#8d5f30');
  rect(ctx, 1, 2, 8, 1, '#b9854a');
  outline(ctx, W, H);
  add(scene, 'bell-post', c);

  // o sino é peça separada para poder balançar
  const b = makeCanvas(10, 11);
  rect(b.ctx, 4, 0, 2, 1, '#3f464c');
  rect(b.ctx, 3, 1, 4, 2, '#e8b84a');
  rect(b.ctx, 2, 3, 6, 4, '#e8b84a');
  rect(b.ctx, 1, 7, 8, 2, '#e8b84a');
  rect(b.ctx, 3, 2, 1, 5, '#fff1b8');
  rect(b.ctx, 6, 3, 2, 6, '#b8862a');
  rect(b.ctx, 4, 9, 2, 1, '#6b4423');
  outline(b.ctx, 10, 11);
  add(scene, 'bell', b.c);
}

function bench(scene: Phaser.Scene) {
  const W = 38;
  const { c, ctx } = makeCanvas(W, 15);
  // encosto
  rect(ctx, 1, 0, W - 2, 3, '#b9854a');
  rect(ctx, 1, 2, W - 2, 1, '#8d5f30');
  rect(ctx, 1, 4, W - 2, 3, '#b9854a');
  rect(ctx, 1, 6, W - 2, 1, '#8d5f30');
  rect(ctx, 2, 0, 8, 1, '#d09a5c');
  // assento
  rect(ctx, 0, 8, W, 3, '#a0703a');
  rect(ctx, 0, 10, W, 1, '#6b4220');
  // pés de ferro
  for (const x of [2, W / 2 - 1, W - 4]) {
    rect(ctx, x, 0, 2, 15, '#3f464c');
    rect(ctx, x, 0, 1, 15, '#5a636b');
  }
  outline(ctx, W, 15);
  add(scene, 'bench', c);
}

function lamppost(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(10, 34);
  // base e poste
  rect(ctx, 2, 30, 6, 4, '#3f464c');
  rect(ctx, 4, 11, 2, 20, '#3f464c');
  rect(ctx, 4, 11, 1, 20, '#5a636b');
  // lanterna
  rect(ctx, 1, 2, 8, 2, '#3f464c');
  rect(ctx, 2, 4, 6, 6, '#ffd76a');
  rect(ctx, 2, 4, 2, 3, '#fff1b8');
  rect(ctx, 4, 4, 2, 6, '#e8b84a');
  rect(ctx, 2, 10, 6, 1, '#3f464c');
  rect(ctx, 4, 0, 2, 2, '#3f464c');
  outline(ctx, 10, 34);
  add(scene, 'lamppost', c);
}

function planter(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(18, 16);
  disc(ctx, 6, 6, 4, '#2f6e30');
  disc(ctx, 12, 6, 4, '#2f6e30');
  disc(ctx, 9, 4, 4, '#3f8a3a');
  for (const [x, y, color] of [[5, 4, '#e05a6a'], [10, 2, '#f5d142'], [13, 6, '#7aa8f0'], [8, 7, '#e05a6a']] as const) {
    rect(ctx, x, y, 2, 2, color);
  }
  // vaso de pedra
  rect(ctx, 1, 8, 16, 8, '#9a9284');
  rect(ctx, 1, 8, 16, 2, '#bdb4a2');
  rect(ctx, 1, 12, 16, 1, '#7a7366');
  rect(ctx, 14, 10, 3, 6, '#7a7366');
  outline(ctx, 18, 16);
  add(scene, 'planter', c);
}

/** Calçamento circular em volta do chafariz; fica no chão, sem contorno. */
function plazaRing(scene: Phaser.Scene) {
  const W = 88;
  const H = 36;
  const { c, ctx } = makeCanvas(W, H);
  const inside = (x: number, y: number, rx: number, ry: number) => ((x - W / 2 + 0.5) / rx) ** 2 + ((y - H / 2 + 0.5) / ry) ** 2 <= 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y, W / 2, H / 2)) continue;
      const border = !inside(x, y, W / 2 - 3, H / 2 - 2);
      const ring = inside(x, y, W / 2 - 10, H / 2 - 5) && !inside(x, y, W / 2 - 12, H / 2 - 6);
      rect(ctx, x, y, 1, 1, border ? '#958c7c' : ring ? '#a89f8e' : (x + y) % 6 === 0 ? '#c4bca9' : '#d6cebd');
    }
  add(scene, 'plaza-ring', c);
}

function signBoard(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(12, 14);
  rect(ctx, 5, 6, 2, 8, '#6b4423');
  rect(ctx, 0, 0, 12, 8, '#b9854a');
  rect(ctx, 0, 7, 12, 1, '#8d5f30');
  rect(ctx, 2, 2, 8, 1, '#6b4220');
  rect(ctx, 2, 4, 6, 1, '#6b4220');
  outline(ctx, 12, 14);
  add(scene, 'signpost', c);
}

function glow(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(10, 8);
  rect(ctx, 0, 0, 10, 8, '#ffd76a');
  rect(ctx, 0, 0, 4, 3, '#fff1b8');
  add(scene, 'glow', c);
}

function bubble(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 12);
  rect(ctx, 1, 0, 14, 8, '#ffffff');
  rect(ctx, 0, 1, 16, 6, '#ffffff');
  rect(ctx, 4, 8, 3, 2, '#ffffff');
  rect(ctx, 4, 10, 1, 1, '#ffffff');
  outline(ctx, 16, 12);
  add(scene, 'bubble', c);
}

/** Balão amarelo com "!" — a sessão precisa de você. */
function alert(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(12, 16);
  rect(ctx, 1, 0, 10, 12, '#f7d046');
  rect(ctx, 0, 1, 12, 10, '#f7d046');
  rect(ctx, 1, 1, 3, 2, '#fff1a8');
  rect(ctx, 9, 2, 2, 9, '#d9a520');
  rect(ctx, 1, 10, 10, 1, '#d9a520');
  rect(ctx, 4, 12, 3, 2, '#f7d046');
  rect(ctx, 5, 14, 1, 1, '#f7d046');
  rect(ctx, 5, 2, 2, 5, '#b8241c');
  rect(ctx, 5, 8, 2, 2, '#b8241c');
  outline(ctx, 12, 16);
  add(scene, 'alert', c);
}

function shadow(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(14, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(7, 2.5, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  add(scene, 'shadow', c);
}

export function generateTextures(scene: Phaser.Scene) {
  grass(scene, 'grass0', 1);
  grass(scene, 'grass1', 2);
  grass(scene, 'grass2', 3);
  dirt(scene);
  stone(scene);
  tree(scene, 'tree0', ['#2f6b2f', '#3f8a3a', '#5aa64a']);
  tree(scene, 'tree1', ['#2a5f34', '#357a45', '#4f9a58']);
  bush(scene);
  scaffold(scene);
  plaque(scene, 'plaque-ok', '#f2e6c4', '#958c7c');
  plaque(scene, 'plaque-due', '#f5d142', '#8c5a00');
  dovecote(scene, 'dovecote-empty', 'none');
  dovecote(scene, 'dovecote-sleep', 'sleep');
  dovecote(scene, 'dovecote-awake', 'awake');
  pigeonLetter(scene);
  letter(scene);
  weed(scene, 'weed0', false);
  weed(scene, 'weed1', true);
  crop(scene, 'crop-todo', 0);
  crop(scene, 'crop-growing', 1);
  crop(scene, 'crop-done', 2);
  flower(scene, 'flowerR', '#e05a6a');
  flower(scene, 'flowerY', '#f5d142');
  flower(scene, 'flowerB', '#7aa8f0');
  for (const [name, pal] of Object.entries(ROOFS)) house(scene, `house-${name}`, pal);
  library(scene);
  factory(scene);
  bin(scene);
  fountain(scene);
  noticeBoard(scene);
  billboard(scene);
  bell(scene);
  bench(scene);
  lamppost(scene);
  planter(scene);
  plazaRing(scene);
  signBoard(scene);
  glow(scene);
  bubble(scene);
  alert(scene);
  shadow(scene);
}
