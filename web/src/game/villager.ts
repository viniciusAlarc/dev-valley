import Phaser from 'phaser';
import { hash } from './textures';

/**
 * Moradores no padrão Stardew: 16x32, cabeça grande, sombreamento em 3 tons,
 * contorno colorido (versão escura da cor vizinha) e 3 direções x 4 quadros de caminhada.
 *
 * Folha 64x96: linha 0 = de frente, 1 = de lado (olhando p/ direita), 2 = de costas.
 * Quadros: 0 parado, 1 passo esquerdo, 2 parado, 3 passo direito.
 */

export const VILLAGER_W = 16;
export const VILLAGER_H = 32;
export type Facing = 'down' | 'side' | 'up';
export const FACING_ROW: Record<Facing, number> = { down: 0, side: 1, up: 2 };

type Ctx = CanvasRenderingContext2D;

// ---------------- cores ----------------

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]) {
  return '#' + [r, g, b].map((v) => Math.round(Phaser.Math.Clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function mix(a: string, b: string, t: number) {
  const ca = parse(a);
  const cb = parse(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** Tom de sombra puxado para o roxo, como na paleta do Stardew. */
const shade = (c: string, t = 0.28) => mix(c, '#2a1840', t);
const light = (c: string, t = 0.25) => mix(c, '#fff4d6', t);

interface Tone {
  base: string;
  dark: string;
  light: string;
}

const tone = (c: string): Tone => ({ base: c, dark: shade(c), light: light(c) });

// ---------------- variações ----------------

const SKINS = ['#f7d3b0', '#eab48a', '#c98e62', '#9a6340', '#6e4429'];
const HAIRS = ['#4a2c17', '#e0b252', '#a3431f', '#26201f', '#efe4d2', '#7b4fb0', '#d0662f', '#3f6fb5', '#e48aa8'];
const SHIRTS = ['#d9534f', '#3b8fd6', '#4caf50', '#9b59b6', '#f0932b', '#1abc9c', '#f6c945', '#e86fa0', '#f4efe3', '#5d6d7e'];
const PANTS = ['#3c4a7d', '#5a4130', '#33585a', '#6a4f8a', '#2f3640', '#7a5a3a'];
const EYES = ['#2b1d14', '#2f4f7a', '#2f6a3a', '#5a3a1a'];

type HairStyle = 'short' | 'long' | 'spiky' | 'bun' | 'bob';
const HAIR_STYLES: HairStyle[] = ['short', 'long', 'spiky', 'bun', 'bob'];
type Outfit = 'plain' | 'overalls' | 'stripes' | 'vest';
const OUTFITS: Outfit[] = ['plain', 'overalls', 'stripes', 'vest'];

interface Look {
  skin: Tone;
  hair: Tone;
  shirt: Tone;
  pants: Tone;
  eye: string;
  style: HairStyle;
  outfit: Outfit;
  hat: boolean;
}

function lookFor(id: string): Look {
  const h = hash(id);
  const h2 = hash(id + '#');
  const hat = (h2 >>> 8) % 6 === 0;
  let style = HAIR_STYLES[h2 % HAIR_STYLES.length];
  // Coque e espetado ficariam saindo por cima do chapéu.
  if (hat && (style === 'bun' || style === 'spiky')) style = 'short';
  return {
    skin: tone(SKINS[h % SKINS.length]),
    hair: tone(HAIRS[(h >>> 4) % HAIRS.length]),
    shirt: tone(SHIRTS[(h >>> 8) % SHIRTS.length]),
    pants: tone(PANTS[(h >>> 12) % PANTS.length]),
    eye: EYES[(h >>> 16) % EYES.length],
    style,
    outfit: OUTFITS[(h2 >>> 4) % OUTFITS.length],
    hat,
  };
}

// ---------------- primitivas ----------------

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const SHOE = tone('#6b4426');
const BELT = '#4a2f1a';
const BUCKLE = '#e8c252';
const HAT = tone('#e6c46e');
const HAT_BAND = '#c0392b';
const SCLERA = '#fbf6ea';

/** Pernas e sapatos — comuns às três direções, variando só a passada. */
function legs(ctx: Ctx, L: Look, facing: Facing, frame: number) {
  const p = L.pants;
  if (facing === 'side') {
    if (frame % 2 === 0) {
      px(ctx, 6, 26, 4, 3, p.base);
      px(ctx, 6, 26, 1, 3, p.dark);
      px(ctx, 6, 29, 5, 2, SHOE.base);
      px(ctx, 6, 30, 5, 1, SHOE.dark);
    } else {
      // perna de trás
      px(ctx, 4, 26, 3, 2, p.dark);
      px(ctx, 3, 28, 3, 2, SHOE.dark);
      // perna da frente
      px(ctx, 8, 26, 3, 3, p.base);
      px(ctx, 9, 29, 4, 2, SHOE.base);
      px(ctx, 9, 30, 4, 1, SHOE.dark);
    }
    return;
  }
  const liftL = frame === 1 ? 1 : 0;
  const liftR = frame === 3 ? 1 : 0;
  px(ctx, 4, 26, 3, 3 - liftL, p.base);
  px(ctx, 9, 26, 3, 3 - liftR, p.base);
  px(ctx, 11, 26, 1, 3 - liftR, p.dark);
  px(ctx, 4, 29 - liftL, 3, 2, SHOE.base);
  px(ctx, 9, 29 - liftR, 3, 2, SHOE.base);
  px(ctx, 4, 30 - liftL, 3, 1, SHOE.dark);
  px(ctx, 9, 30 - liftR, 3, 1, SHOE.dark);
}

/** Tronco, braços, cinto e quadril. `u` é o deslocamento vertical da passada. */
function body(ctx: Ctx, L: Look, facing: Facing, frame: number, u: number) {
  const s = L.shirt;
  const p = L.pants;
  if (facing === 'side') {
    px(ctx, 5, 17 + u, 6, 7, s.base);
    px(ctx, 5, 17 + u, 2, 7, s.dark);
    px(ctx, 10, 17 + u, 1, 3, s.light);
    if (L.outfit === 'overalls') {
      px(ctx, 6, 20 + u, 5, 4, p.base);
      px(ctx, 8, 17 + u, 1, 3, p.base);
    }
    if (L.outfit === 'stripes') px(ctx, 5, 20 + u, 6, 1, s.dark), px(ctx, 5, 22 + u, 6, 1, s.dark);
    if (L.outfit === 'vest') px(ctx, 9, 17 + u, 2, 7, shade(s.base, 0.5));
    px(ctx, 5, 24 + u, 6, 1, BELT);
    px(ctx, 5, 25 + u, 6, 1, p.base);
    // braço balançando
    const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    px(ctx, 7 + swing, 18 + u, 2, 3, s.dark);
    px(ctx, 7 + swing, 21 + u, 2, 2, L.skin.base);
    px(ctx, 8 + swing, 22 + u, 1, 1, L.skin.dark);
    return;
  }

  px(ctx, 4, 17 + u, 8, 7, s.base);
  px(ctx, 10, 17 + u, 2, 7, s.dark);
  px(ctx, 4, 23 + u, 8, 1, s.dark);
  px(ctx, 5, 17 + u, 2, 2, s.light);
  if (facing === 'down') px(ctx, 7, 17 + u, 2, 1, L.skin.dark); // gola em V

  if (L.outfit === 'overalls') {
    px(ctx, 5, 20 + u, 6, 4, p.base);
    px(ctx, 9, 20 + u, 2, 4, p.dark);
    px(ctx, 5, 17 + u, 1, 3, p.base);
    px(ctx, 10, 17 + u, 1, 3, p.base);
    if (facing === 'down') px(ctx, 5, 20 + u, 1, 1, BUCKLE), px(ctx, 10, 20 + u, 1, 1, BUCKLE);
  }
  if (L.outfit === 'stripes') {
    px(ctx, 4, 19 + u, 8, 1, s.dark);
    px(ctx, 4, 21 + u, 8, 1, s.dark);
  }
  if (L.outfit === 'vest' && facing === 'down') {
    const v = shade(s.base, 0.5);
    px(ctx, 4, 17 + u, 2, 7, v);
    px(ctx, 10, 17 + u, 2, 7, v);
  }

  px(ctx, 4, 24 + u, 8, 1, BELT);
  if (facing === 'down') px(ctx, 7, 24 + u, 2, 1, BUCKLE);
  px(ctx, 4, 25 + u, 8, 1, p.base);
  px(ctx, 7, 25 + u, 2, 1, p.dark);

  // braços: na passada um braço desce, o outro sobe
  const armL = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const armR = -armL;
  px(ctx, 3, 18 + u + armL, 1, 3, s.base);
  px(ctx, 12, 18 + u + armR, 1, 3, s.dark);
  px(ctx, 3, 21 + u + armL, 1, 2, L.skin.base);
  px(ctx, 12, 21 + u + armR, 1, 2, L.skin.dark);
}

function head(ctx: Ctx, L: Look, facing: Facing, u: number) {
  const k = L.skin;
  const h = L.hair;
  const y = (n: number) => n + u;

  if (facing === 'side') {
    px(ctx, 5, y(6), 8, 10, k.base);
    px(ctx, 13, y(11), 1, 2, k.base); // nariz
    px(ctx, 5, y(15), 7, 1, k.dark);
    px(ctx, 6, y(16), 4, 1, k.dark); // pescoço
    // olhando para a direita: pupila na frente, esclera atrás
    px(ctx, 10, y(11), 1, 2, SCLERA);
    px(ctx, 11, y(11), 1, 2, L.eye);
    px(ctx, 10, y(10), 2, 1, h.dark);
    px(ctx, 11, y(13), 1, 1, mix(k.base, '#ff6f6f', 0.35));
    px(ctx, 11, y(14), 1, 1, mix(k.base, '#b34a4a', 0.35));
    // cabelo
    px(ctx, 5, y(3), 7, 1, h.base);
    px(ctx, 4, y(4), 9, 2, h.base);
    px(ctx, 3, y(6), 6, 4, h.base);
    px(ctx, 9, y(6), 4, 2, h.base);
    px(ctx, 3, y(10), 4, 3, h.base);
    px(ctx, 6, y(4), 4, 1, h.light);
    px(ctx, 3, y(9), 3, 1, h.dark);
    px(ctx, 7, y(11), 1, 2, k.dark); // orelha
    if (L.style === 'long' || L.style === 'bob') px(ctx, 2, y(12), 5, L.style === 'long' ? 8 : 3, h.base), px(ctx, 2, y(12), 1, L.style === 'long' ? 8 : 3, h.dark);
    if (L.style === 'spiky') px(ctx, 6, y(2), 1, 1, h.base), px(ctx, 9, y(1), 2, 2, h.base), px(ctx, 3, y(3), 2, 1, h.base);
    if (L.style === 'bun') px(ctx, 2, y(3), 3, 3, h.base), px(ctx, 2, y(5), 3, 1, h.dark);
    return;
  }

  // cabeça (frente e costas)
  px(ctx, 3, y(6), 10, 9, k.base);
  px(ctx, 4, y(15), 8, 1, k.base);
  px(ctx, 12, y(7), 1, 8, k.dark);
  px(ctx, 10, y(15), 2, 1, k.dark);
  px(ctx, 6, y(16), 4, 1, k.dark);

  if (facing === 'down') {
    // olho = esclera branca + pupila, legível em qualquer tom de pele
    px(ctx, 4, y(11), 1, 2, SCLERA);
    px(ctx, 11, y(11), 1, 2, SCLERA);
    px(ctx, 5, y(11), 1, 2, L.eye);
    px(ctx, 10, y(11), 1, 2, L.eye);
    px(ctx, 4, y(10), 2, 1, h.dark);
    px(ctx, 10, y(10), 2, 1, h.dark);
    px(ctx, 4, y(13), 1, 1, mix(k.base, '#ff6f6f', 0.35));
    px(ctx, 11, y(13), 1, 1, mix(k.base, '#ff6f6f', 0.35));
    px(ctx, 7, y(14), 2, 1, mix(k.base, '#b34a4a', 0.35)); // boca discreta, sem cara de barba
  }

  // cabelo — calota
  px(ctx, 5, y(3), 6, 1, h.base);
  px(ctx, 4, y(4), 8, 1, h.base);
  px(ctx, 3, y(5), 10, 3, h.base);
  px(ctx, 6, y(4), 3, 1, h.light);
  px(ctx, 4, y(5), 2, 1, h.light);
  px(ctx, 11, y(5), 2, 3, h.dark);

  if (facing === 'up') {
    // de costas o cabelo cobre a cabeça toda
    px(ctx, 3, y(8), 10, 6, h.base);
    px(ctx, 4, y(14), 8, 1, h.dark);
    px(ctx, 11, y(8), 2, 6, h.dark);
    px(ctx, 2, y(10), 1, 2, k.base);
    px(ctx, 13, y(10), 1, 2, k.dark);
  } else {
    // franja varrida para o lado
    px(ctx, 3, y(8), 3, 1, h.base);
    px(ctx, 8, y(8), 5, 1, h.base);
    px(ctx, 3, y(9), 2, 1, h.base);
    px(ctx, 10, y(9), 3, 1, h.dark);
    px(ctx, 3, y(10), 1, 1, h.base);
    px(ctx, 12, y(10), 1, 1, h.dark);
    px(ctx, 2, y(11), 1, 2, k.base); // orelhas
    px(ctx, 13, y(11), 1, 2, k.dark);
  }

  if (L.style === 'long') {
    px(ctx, 2, y(7), 2, 13, h.base);
    px(ctx, 12, y(7), 2, 13, h.dark);
    if (facing === 'up') px(ctx, 4, y(14), 8, 6, h.base), px(ctx, 4, y(19), 8, 1, h.dark);
  }
  if (L.style === 'bob') {
    px(ctx, 2, y(7), 2, 8, h.base);
    px(ctx, 12, y(7), 2, 8, h.dark);
    if (facing === 'up') px(ctx, 3, y(14), 10, 2, h.dark);
  }
  if (L.style === 'spiky') {
    px(ctx, 4, y(2), 1, 2, h.base);
    px(ctx, 7, y(1), 2, 2, h.base);
    px(ctx, 10, y(2), 2, 2, h.dark);
    px(ctx, 7, y(1), 1, 1, h.light);
  }
  if (L.style === 'bun') {
    px(ctx, 6, y(0), 4, 3, h.base);
    px(ctx, 6, y(0), 2, 1, h.light);
    px(ctx, 9, y(1), 1, 2, h.dark);
  }
}

/** Chapéu de palha, o clássico da fazenda. */
function hat(ctx: Ctx, facing: Facing, u: number) {
  if (facing === 'side') {
    px(ctx, 2, 6 + u, 13, 1, HAT.base);
    px(ctx, 2, 7 + u, 13, 1, HAT.dark);
    px(ctx, 4, 2 + u, 8, 4, HAT.base);
    px(ctx, 4, 5 + u, 8, 1, HAT_BAND);
    px(ctx, 5, 2 + u, 4, 1, HAT.light);
    return;
  }
  px(ctx, 1, 6 + u, 14, 1, HAT.base);
  px(ctx, 1, 7 + u, 14, 1, HAT.dark);
  px(ctx, 4, 2 + u, 8, 4, HAT.base);
  px(ctx, 4, 5 + u, 8, 1, HAT_BAND);
  px(ctx, 5, 2 + u, 3, 1, HAT.light);
  px(ctx, 10, 2 + u, 2, 3, HAT.dark);
}

/** Contorno escuro na cor do pixel vizinho — evita o "recortado" do contorno preto. */
function colorOutline(ctx: Ctx, x0: number, y0: number, w: number, h: number) {
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? (y * w + x) * 4 : -1);
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (d[i + 3] > 128) continue;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const j = at(x + dx, y + dy);
        if (j < 0 || d[j + 3] <= 128) continue;
        out[i] = d[j] * 0.35 + 20;
        out[i + 1] = d[j + 1] * 0.3 + 10;
        out[i + 2] = d[j + 2] * 0.35 + 25;
        out[i + 3] = 255;
        break;
      }
    }
  ctx.putImageData(new ImageData(out, w, h), x0, y0);
}

function drawFrame(ctx: Ctx, L: Look, facing: Facing, frame: number) {
  const u = frame % 2 === 1 ? 1 : 0;
  legs(ctx, L, facing, frame);
  if (facing === 'up') {
    head(ctx, L, facing, u);
    body(ctx, L, facing, frame, u);
  } else {
    body(ctx, L, facing, frame, u);
    head(ctx, L, facing, u);
  }
  if (L.hat) hat(ctx, facing, u);
}

/** Gera (uma vez por combinação) a folha de sprites de um morador e suas animações. */
export function villagerTexture(scene: Phaser.Scene, id: string): string {
  const L = lookFor(id);
  const key = `villager-${[L.skin.base, L.hair.base, L.shirt.base, L.pants.base, L.eye, L.style, L.outfit, L.hat].join('-')}`;
  if (scene.textures.exists(key)) return key;

  const c = document.createElement('canvas');
  c.width = VILLAGER_W * 4;
  c.height = VILLAGER_H * 3;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const facings: Facing[] = ['down', 'side', 'up'];
  facings.forEach((facing, row) => {
    for (let f = 0; f < 4; f++) {
      ctx.save();
      ctx.translate(f * VILLAGER_W, row * VILLAGER_H);
      drawFrame(ctx, L, facing, f);
      ctx.restore();
      colorOutline(ctx, f * VILLAGER_W, row * VILLAGER_H, VILLAGER_W, VILLAGER_H);
    }
  });

  const tex = scene.textures.addCanvas(key, c)!;
  for (let i = 0; i < 12; i++) tex.add(i, 0, (i % 4) * VILLAGER_W, Math.floor(i / 4) * VILLAGER_H, VILLAGER_W, VILLAGER_H);
  for (const facing of facings) {
    const row = FACING_ROW[facing];
    scene.anims.create({
      key: `${key}-walk-${facing}`,
      frames: [0, 1, 2, 3].map((f) => ({ key, frame: row * 4 + f })),
      frameRate: 7,
      repeat: -1,
    });
  }
  return key;
}
