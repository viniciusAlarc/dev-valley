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

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true })! };
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) ctx.fillRect(cx + x, cy + y, 1, 1);
}

/** Contorno escuro de 1px ao redor dos pixels opacos — o "look" Stardew. */
function outline(ctx: Ctx, w: number, h: number) {
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

function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
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

function window_(ctx: Ctx, x: number, y: number) {
  rect(ctx, x, y, 12, 10, '#4a2a12');
  rect(ctx, x + 1, y + 1, 10, 8, '#8fc8de');
  rect(ctx, x + 1, y + 1, 4, 3, '#c6e8f2');
  rect(ctx, x + 6, y + 1, 1, 8, '#4a2a12');
  rect(ctx, x + 1, y + 5, 10, 1, '#4a2a12');
  rect(ctx, x - 1, y + 10, 14, 2, '#7a4b20');
}

function planks(ctx: Ctx, x: number, y: number, w: number, h: number) {
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

function library(scene: Phaser.Scene) {
  const W = 100;
  const H = 90;
  const { c, ctx } = makeCanvas(W, H);
  rect(ctx, 6, 36, W - 12, 50, '#b3ab9c');
  for (let y = 40; y < 86; y += 6) {
    rect(ctx, 6, y, W - 12, 1, '#8f877a');
    for (let x = 6 + ((y / 6) % 2) * 6; x < W - 6; x += 12) rect(ctx, x, y - 5, 1, 5, '#8f877a');
  }
  roof(ctx, 0, W, 4, 40, ['#4b3d7a', '#33295a', '#6656a0']);
  // colunas
  for (const x of [20, 36, 60, 76]) {
    rect(ctx, x, 42, 5, 44, '#e3dccb');
    rect(ctx, x + 3, 42, 2, 44, '#c4bca9');
  }
  rect(ctx, 41, 56, 18, 30, '#4a2a12');
  rect(ctx, 42, 57, 8, 29, '#6b3f1f');
  rect(ctx, 50, 57, 8, 29, '#6b3f1f');
  // livro no frontão
  rect(ctx, 42, 20, 16, 11, '#f2e6c4');
  rect(ctx, 49, 20, 2, 11, '#8c2c20');
  rect(ctx, 0, 84, W, 6, '#8a8478');
  outline(ctx, W, H);
  add(scene, 'library', c);
}

function factory(scene: Phaser.Scene) {
  const W = 100;
  const H = 96;
  const { c, ctx } = makeCanvas(W, H);
  rect(ctx, 74, 0, 12, 40, '#7d3a2b');
  rect(ctx, 72, 0, 16, 4, '#5a281d');
  rect(ctx, 4, 44, W - 8, 48, '#a24e37');
  for (let y = 48; y < 92; y += 5) rect(ctx, 4, y, W - 8, 1, '#83402c');
  // telhado dente-de-serra
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 24;
    for (let y = 0; y < 18; y++) rect(ctx, x0, 26 + y, Math.round((y * 24) / 18), 1, y % 4 === 3 ? '#4c545c' : '#66717b');
    rect(ctx, x0 + 22, 26, 2, 18, '#9fd0e6');
  }
  rect(ctx, 0, 42, W, 3, '#3f464c');
  // portão
  rect(ctx, 36, 60, 28, 32, '#4c545c');
  for (let y = 62; y < 92; y += 4) rect(ctx, 37, y, 26, 2, '#66717b');
  window_(ctx, 12, 56);
  window_(ctx, 76, 56);
  // engrenagem
  disc(ctx, 50, 52, 5, '#e8c252');
  disc(ctx, 50, 52, 2, '#a24e37');
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

function well(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(32, 36);
  rect(ctx, 4, 2, 2, 20, '#6b4423');
  rect(ctx, 26, 2, 2, 20, '#6b4423');
  rect(ctx, 2, 0, 28, 5, '#b8402f');
  rect(ctx, 2, 4, 28, 1, '#8c2c20');
  rect(ctx, 2, 18, 28, 16, '#9a9284');
  for (let y = 22; y < 34; y += 4) rect(ctx, 2, y, 28, 1, '#7a7366');
  rect(ctx, 4, 18, 24, 4, '#3a6ea8');
  rect(ctx, 6, 19, 6, 1, '#7fb0e0');
  rect(ctx, 14, 6, 4, 8, '#7a4b20');
  outline(ctx, 32, 36);
  add(scene, 'well', c);
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

function shadow(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(14, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(7, 2.5, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  add(scene, 'shadow', c);
}

// ---------------- moradores ----------------

const SKINS = ['#f2c9a0', '#e0ac7e', '#b97c50', '#8a5634'];
const HAIRS = ['#3b2414', '#d9a441', '#8b3a1e', '#1c1c1c', '#e6dccb', '#6a3d9a', '#c0562e'];
const SHIRTS = ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d4ac0d', '#e84393'];
const PANTS = ['#3b3f6b', '#4a3a2a', '#2f4f4f', '#5a4a7a'];

/** Gera (uma vez por combinação) uma folha de 3 quadros 16x24: parado, passo esq., passo dir. */
export function villagerTexture(scene: Phaser.Scene, id: string): string {
  const h = hash(id);
  const skin = SKINS[h % SKINS.length];
  const hair = HAIRS[(h >>> 3) % HAIRS.length];
  const shirt = SHIRTS[(h >>> 6) % SHIRTS.length];
  const pants = PANTS[(h >>> 9) % PANTS.length];
  const longHair = ((h >>> 12) & 1) === 1;
  const key = `npc-${skin}-${hair}-${shirt}-${pants}-${longHair}`;
  if (scene.textures.exists(key)) return key;

  const { c, ctx } = makeCanvas(48, 24);
  for (let f = 0; f < 3; f++) {
    const ox = f * 16;
    const bob = f === 0 ? 0 : 1;
    const y0 = 1 + bob;
    // cabeça
    rect(ctx, ox + 4, y0 + 3, 8, 8, skin);
    rect(ctx, ox + 4, y0 + 1, 8, 3, hair);
    rect(ctx, ox + 3, y0 + 2, 10, 2, hair);
    rect(ctx, ox + 3, y0 + 3, 1, longHair ? 9 : 4, hair);
    rect(ctx, ox + 12, y0 + 3, 1, longHair ? 9 : 4, hair);
    rect(ctx, ox + 6, y0 + 7, 1, 2, '#2b1d14');
    rect(ctx, ox + 9, y0 + 7, 1, 2, '#2b1d14');
    rect(ctx, ox + 5, y0 + 9, 1, 1, '#e88c7a');
    rect(ctx, ox + 10, y0 + 9, 1, 1, '#e88c7a');
    // corpo
    rect(ctx, ox + 4, y0 + 11, 8, 6, shirt);
    rect(ctx, ox + 3, y0 + 12, 1, 4, skin);
    rect(ctx, ox + 12, y0 + 12, 1, 4, skin);
    rect(ctx, ox + 4, y0 + 17, 8, 2, pants);
    // pernas
    const legL = f === 1 ? -1 : 0;
    const legR = f === 2 ? -1 : 0;
    rect(ctx, ox + 5, y0 + 19 + legL, 2, 3, pants);
    rect(ctx, ox + 9, y0 + 19 + legR, 2, 3, pants);
    rect(ctx, ox + 5, y0 + 21 + legL, 2, 1, '#3a2414');
    rect(ctx, ox + 9, y0 + 21 + legR, 2, 1, '#3a2414');
  }
  outline(ctx, 48, 24);
  const tex = scene.textures.addCanvas(key, c)!;
  for (let f = 0; f < 3; f++) tex.add(f, 0, f * 16, 0, 16, 24);
  scene.anims.create({ key: `${key}-walk`, frames: [1, 0, 2, 0].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1 });
  return key;
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
  flower(scene, 'flowerR', '#e05a6a');
  flower(scene, 'flowerY', '#f5d142');
  flower(scene, 'flowerB', '#7aa8f0');
  for (const [name, pal] of Object.entries(ROOFS)) house(scene, `house-${name}`, pal);
  library(scene);
  factory(scene);
  bin(scene);
  well(scene);
  signBoard(scene);
  glow(scene);
  bubble(scene);
  shadow(scene);
}
