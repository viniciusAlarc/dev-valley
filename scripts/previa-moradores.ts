/**
 * Prévia dos moradores em PNG, sem navegador (a `web/sprites.html` só roda no `npm run dev`, que derruba os terminais
 * da vila, regra 6). Desenha com a mesma arte do jogo (`web/src/game/villagerArt.ts`) num canvas de mentira que entende
 * só o que ela usa: retângulos e leitura/escrita de pixels (contorno colorido).
 *
 * Uso: npx tsx scripts/previa-moradores.ts <saida.png> [quantos=24 | catalogo] [escala=4]
 * `catalogo`: cada penteado, roupa e acessório sobre o mesmo morador, para conferir peça por peça.
 * Cada morador aparece de frente, de lado e de costas; a última linha são agentes ✦. As colunas alternam a marca do
 * nome: feminino, masculino e neutro (f, m, n). Rótulo do sorteio no console.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  agentLookFor,
  drawSheet,
  lookFor,
  VILLAGER_H,
  VILLAGER_W,
  type Genero,
  type HairStyle,
  type Headwear,
  type Look,
  type Outfit,
  tone,
} from '../web/src/game/villagerArt';

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}
(globalThis as any).ImageData = FakeImageData;

/** Só o pedaço do CanvasRenderingContext2D que a arte dos moradores usa. */
class FakeCtx {
  fillStyle = '#000000';
  private ox = 0;
  private oy = 0;
  private stack: [number, number][] = [];
  constructor(
    readonly w: number,
    readonly h: number,
    readonly px = new Uint8ClampedArray(w * h * 4),
  ) {}
  save() {
    this.stack.push([this.ox, this.oy]);
  }
  restore() {
    [this.ox, this.oy] = this.stack.pop() ?? [0, 0];
  }
  translate(x: number, y: number) {
    this.ox += x;
    this.oy += y;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const n = parseInt(this.fillStyle.slice(1), 16);
    for (let j = y + this.oy; j < y + this.oy + h; j++)
      for (let i = x + this.ox; i < x + this.ox + w; i++) {
        if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
        const k = (j * this.w + i) * 4;
        this.px.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], k);
      }
  }
  getImageData(x0: number, y0: number, w: number, h: number) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < h; j++) d.set(this.px.subarray(((y0 + j) * this.w + x0) * 4, ((y0 + j) * this.w + x0 + w) * 4), j * w * 4);
    return new FakeImageData(d, w, h);
  }
  putImageData(img: FakeImageData, x0: number, y0: number) {
    for (let j = 0; j < img.height; j++) this.px.set(img.data.subarray(j * img.width * 4, (j + 1) * img.width * 4), ((y0 + j) * this.w + x0) * 4);
  }
}

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(w: number, h: number, rgba: Uint8ClampedArray): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const [saida, quantos = '24', escala = '4'] = process.argv.slice(2);
if (!saida) throw new Error('uso: npx tsx scripts/previa-moradores.ts <saida.png> [quantos] [escala]');
const s = Number(escala);
const COLS = 8;
const CELL_W = VILLAGER_W * 3 + 6;
const CELL_H = VILLAGER_H + 4;
function catalogo(): [string, Look][] {
  // Cores que contrastam entre si, para cada peça aparecer.
  const base: Look = {
    ...lookFor('morador-3'),
    skin: tone('#eab48a'),
    hair: tone('#4a2c17'),
    shirt: tone('#3b8fd6'),
    pants: tone('#5a4130'),
    accent: tone('#c0392b'),
    jacket: tone('#6b4426'),
    style: 'short',
    outfit: 'plain',
    headwear: null,
    glasses: null,
    scarf: null,
    beard: null,
  };
  const styles: HairStyle[] = ['short', 'long', 'spiky', 'bun', 'bob', 'buzz', 'curly', 'ponytail', 'braids', 'sidepart'];
  const outfits: Outfit[] = ['plain', 'overalls', 'stripes', 'vest', 'hoodie', 'jacket', 'apron', 'sweater', 'plaid', 'dress'];
  const hats: Headwear[] = ['straw', 'cap', 'beanie', 'headband', 'bow'];
  return [
    ...styles.map((style): [string, Look] => [`penteado ${style}`, { ...base, style }]),
    ...outfits.map((outfit): [string, Look] => [`roupa ${outfit}`, { ...base, outfit, pants: outfit === 'dress' ? base.skin : base.pants }]),
    ...hats.map((headwear): [string, Look] => [`acessório ${headwear}`, { ...base, style: 'long', headwear }]),
    ['óculos', { ...base, glasses: '#2b1d14' }],
    ['lenço', { ...base, scarf: base.accent }],
    ['bigode', { ...base, beard: 'mustache' }],
    ['barba', { ...base, beard: 'beard' }],
  ];
}

const sorteio = (n: number): [string, Look][] =>
  Array.from({ length: n }, (_, i): [string, Look] => {
    const genero = (['f', 'm', null] as Genero[])[i % 3];
    return [`morador-${i} (${genero ?? 'n'})`, lookFor(`morador-${i}`, genero)];
  });
const agentes = Array.from({ length: COLS }, (_, i): [string, Look] => [`agente-${i}`, agentLookFor(`agente-${i}`)]);
const moradores = quantos === 'catalogo' ? catalogo() : sorteio(Number(quantos));
const n = moradores.length;
// Os agentes começam numa linha nova (fora do catálogo).
const looks = quantos === 'catalogo' ? moradores : [...moradores, ...agentes];
const rows = Math.ceil(n / COLS) + (quantos === 'catalogo' ? 0 : 1);
const W = COLS * CELL_W + 4;
const H = rows * CELL_H + 4;
const out = new FakeCtx(W, H);
out.fillStyle = '#6fb04a';
out.fillRect(0, 0, W, H);
looks.forEach(([id, L], idx) => {
  const sheet = new FakeCtx(VILLAGER_W * 4, VILLAGER_H * 3);
  drawSheet(sheet as unknown as CanvasRenderingContext2D, L);
  const cell = idx < n ? idx : Math.ceil(n / COLS) * COLS + (idx - n);
  const cx = 4 + (cell % COLS) * CELL_W;
  const cy = 2 + Math.floor(cell / COLS) * CELL_H;
  // quadro 0 de cada direção: de frente, de lado, de costas
  for (let row = 0; row < 3; row++)
    for (let y = 0; y < VILLAGER_H; y++)
      for (let x = 0; x < VILLAGER_W; x++) {
        const k = ((row * VILLAGER_H + y) * sheet.w + x) * 4;
        if (sheet.px[k + 3] < 128) continue;
        out.px.set(sheet.px.subarray(k, k + 4), ((cy + y) * W + cx + row * (VILLAGER_W + 1) + x) * 4);
      }
  console.log(`${id}: ${[L.style, L.outfit, L.headwear, L.glasses && 'óculos', L.scarf && 'lenço', L.beard].filter(Boolean).join(' ')}`);
});
// escala inteira, sem suavizar (pixel art)
const big = new Uint8ClampedArray(W * s * H * s * 4);
for (let y = 0; y < H * s; y++)
  for (let x = 0; x < W * s; x++) big.set(out.px.subarray(((Math.floor(y / s) * W) + Math.floor(x / s)) * 4, ((Math.floor(y / s) * W) + Math.floor(x / s)) * 4 + 4), (y * W * s + x) * 4);
fs.writeFileSync(saida, png(W * s, H * s, big));
console.log(`${saida}: ${W * s}x${H * s}`);
