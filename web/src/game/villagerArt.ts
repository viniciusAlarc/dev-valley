import { hash, mulberry32 } from './hash';

/**
 * Arte dos moradores, sem Phaser (roda no Node: prévia em PNG e testes). O `villager.ts` registra a textura no jogo.
 *
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
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

function mix(a: string, b: string, t: number) {
  const ca = parse(a);
  const cb = parse(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** Tom de sombra puxado para o roxo, como na paleta do Stardew. */
const shade = (c: string, t = 0.28) => mix(c, '#2a1840', t);
const light = (c: string, t = 0.25) => mix(c, '#fff4d6', t);

export interface Tone {
  base: string;
  dark: string;
  light: string;
}

export const tone = (c: string): Tone => ({ base: c, dark: shade(c), light: light(c) });

// ---------------- variações ----------------

const SKINS = ['#f7d3b0', '#eab48a', '#c98e62', '#9a6340', '#6e4429'];
const HAIRS = ['#4a2c17', '#e0b252', '#a3431f', '#26201f', '#efe4d2', '#7b4fb0', '#d0662f', '#3f6fb5', '#e48aa8'];
const SHIRTS = ['#d9534f', '#3b8fd6', '#4caf50', '#9b59b6', '#f0932b', '#1abc9c', '#f6c945', '#e86fa0', '#f4efe3', '#5d6d7e'];
const PANTS = ['#3c4a7d', '#5a4130', '#33585a', '#6a4f8a', '#2f3640', '#7a5a3a'];
const EYES = ['#2b1d14', '#2f4f7a', '#2f6a3a', '#5a3a1a'];
/** Boné, gorro, faixa, laço, lenço e a fita do rabo de cavalo e das tranças. */
const ACCENTS = ['#c0392b', '#2e6fb5', '#3f8f4a', '#e8a33a', '#7b4fb0', '#e86fa0', '#26201f', '#f4efe3'];
const JACKETS = ['#3b5b8c', '#6b4426', '#5b6b3a', '#2b2b30', '#7a2e3a'];
/** Armação dos óculos de grau (os escuros são só dos agentes, regra 8). */
const FRAMES = ['#2b1d14', '#7a5a3a', '#c9a227', '#8a8f98'];

/** Marca do nome do morador (servidor, `generoDoNome`): penteado e detalhes combinam com ela; null = neutro. */
export type Genero = 'f' | 'm' | null;

export type HairStyle = 'short' | 'long' | 'spiky' | 'bun' | 'bob' | 'buzz' | 'curly' | 'ponytail' | 'braids' | 'sidepart';
const STYLES_F: HairStyle[] = ['long', 'bob', 'bun', 'ponytail', 'braids', 'curly', 'sidepart'];
const STYLES_M: HairStyle[] = ['short', 'spiky', 'buzz', 'curly', 'sidepart'];
const STYLES_ALL: HairStyle[] = [...new Set([...STYLES_F, ...STYLES_M])];
/** Penteados que sairiam por cima do chapéu, do boné ou do gorro. */
const TALL: HairStyle[] = ['bun', 'spiky', 'curly'];

export type Outfit = 'plain' | 'overalls' | 'stripes' | 'vest' | 'hoodie' | 'jacket' | 'apron' | 'sweater' | 'plaid' | 'dress';
const OUTFITS: Outfit[] = ['plain', 'overalls', 'stripes', 'vest', 'hoodie', 'jacket', 'apron', 'sweater', 'plaid'];

export type Headwear = 'straw' | 'cap' | 'beanie' | 'headband' | 'bow';
const HEADWEAR: Headwear[] = ['straw', 'cap', 'beanie', 'headband'];
/** Os que cobrem o alto da cabeça. */
const COVERS: Headwear[] = ['straw', 'cap', 'beanie'];

export type Beard = 'mustache' | 'beard';

export interface Look {
  /** Agente (NPC ✦): traje de agente secreto, sempre o mesmo; só pele e cabelo variam. */
  agent: boolean;
  skin: Tone;
  hair: Tone;
  shirt: Tone;
  /** Calça; no vestido, a cor das pernas (a pele). */
  pants: Tone;
  eye: string;
  style: HairStyle;
  outfit: Outfit;
  /** Por cima do cabelo; null = nada. */
  headwear: Headwear | null;
  /** Cor do boné, gorro, faixa, laço e da fita do cabelo (o chapéu de palha tem a dele). */
  accent: Tone;
  /** Jaqueta aberta, só na roupa `jacket`. */
  jacket: Tone;
  /** Cor da armação dos óculos de grau; null = sem óculos. */
  glasses: string | null;
  /** Lenço no pescoço; null = sem. */
  scarf: Tone | null;
  /** Nunca em nome feminino. */
  beard: Beard | null;
}

/**
 * Sorteio da aparência pelo id da sessão, combinando com a marca do nome (decisão do usuário, 31/10/2026): barba e
 * bigode nunca em nome feminino; vestido e laço nunca em nome masculino; penteados de cada lista; neutro pode tudo.
 */
export function lookFor(id: string, genero: Genero = null): Look {
  const r = mulberry32(hash(id));
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const chance = (p: number) => r() < p;
  const skin = tone(pick(SKINS));
  let style = pick(genero === 'f' ? STYLES_F : genero === 'm' ? STYLES_M : STYLES_ALL);
  const outfit = pick<Outfit>(genero === 'm' ? OUTFITS : [...OUTFITS, 'dress']);
  const headwear = chance(0.35) ? pick<Headwear>(genero === 'm' ? HEADWEAR : [...HEADWEAR, 'bow']) : null;
  if (headwear && COVERS.includes(headwear) && TALL.includes(style)) style = genero === 'f' ? 'long' : 'short';
  return {
    agent: false,
    skin,
    hair: tone(pick(HAIRS)),
    shirt: tone(pick(SHIRTS)),
    pants: outfit === 'dress' ? skin : tone(pick(PANTS)),
    eye: pick(EYES),
    style,
    outfit,
    headwear,
    accent: tone(pick(ACCENTS)),
    jacket: tone(pick(JACKETS)),
    glasses: chance(0.2) ? pick(FRAMES) : null,
    scarf: chance(0.12) ? tone(pick(ACCENTS)) : null,
    beard: genero !== 'f' && chance(genero === 'm' ? 0.3 : 0.15) ? pick<Beard>(['mustache', 'beard']) : null,
  };
}

/** Cabelos naturais: o agente não usa as cores de fantasia dos moradores. */
const AGENT_HAIRS = HAIRS.slice(0, 5);
const SUIT = tone('#23252b');

/**
 * Agentes (NPCs ✦) vestem traje de agente secreto, estilo "homens de preto" (decisão do usuário, 27/10/2026):
 * paletó e calça pretos, camisa branca, gravata preta e óculos escuros, cabelo curto, sem chapéu. Só pele e cor do
 * cabelo variam, para um agente se distinguir do outro sem deixar de ser nitidamente diferente das sessões.
 */
export function agentLookFor(id: string): Look {
  const combo = agentCombo(id);
  return {
    agent: true,
    skin: tone(SKINS[combo % SKINS.length]),
    hair: tone(AGENT_HAIRS[Math.floor(combo / SKINS.length)]),
    shirt: SUIT,
    pants: SUIT,
    eye: '#000000',
    style: 'short',
    outfit: 'plain',
    headwear: null,
    accent: SUIT,
    jacket: SUIT,
    glasses: null,
    scarf: null,
    beard: null,
  };
}

/**
 * Combinação pele × cabelo de cada agente: a sorteada pelo id, ou a próxima livre se outro agente já a usa, para dois
 * agentes nunca saírem iguais (enquanto houver combinação livre). Os agentes da vila reservam a deles primeiro.
 */
const agentCombos = new Map<string, number>();

function agentCombo(id: string): number {
  const known = agentCombos.get(id);
  if (known !== undefined) return known;
  const total = SKINS.length * AGENT_HAIRS.length;
  const h = hash(id);
  let combo = ((h >>> 4) % AGENT_HAIRS.length) * SKINS.length + (h % SKINS.length);
  const taken = new Set(agentCombos.values());
  for (let i = 0; i < total && taken.has(combo); i++) combo = (combo + 1) % total;
  agentCombos.set(id, combo);
  return combo;
}

for (const id of ['administrador-dev-valley', 'bibliotecaria-dev-valley']) agentCombo(id);

// ---------------- primitivas ----------------

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const SHOE_DEFAULT = tone('#6b4426');
const BELT = '#4a2f1a';
const BUCKLE = '#e8c252';
const HAT = tone('#e6c46e');
const HAT_BAND = '#c0392b';
const SCLERA = '#fbf6ea';
const AGENT_SHOE = tone('#141418');
const WHITE_SHIRT = '#f4f1ea';
const TIE = '#0d0d10';
const LENS = '#0d0d10';
const GLINT = '#6f7a88';
const APRON = tone('#efe6d2');
const STRING = '#f4efe3';

/** Pernas e sapatos — comuns às três direções, variando só a passada. */
function legs(ctx: Ctx, L: Look, facing: Facing, frame: number) {
  const p = L.pants;
  const SHOE = L.agent ? AGENT_SHOE : SHOE_DEFAULT;
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
  const o = L.outfit;
  // Na jaqueta aberta, o tronco e as mangas são da jaqueta; a camisa aparece na frente.
  const torso = o === 'jacket' ? L.jacket : s;
  const dress = o === 'dress';
  if (facing === 'side') {
    px(ctx, 5, 17 + u, 6, 7, torso.base);
    px(ctx, 5, 17 + u, 2, 7, torso.dark);
    px(ctx, 10, 17 + u, 1, 3, torso.light);
    if (o === 'jacket') px(ctx, 10, 17 + u, 1, 7, s.base);
    if (o === 'overalls') {
      px(ctx, 6, 20 + u, 5, 4, p.base);
      px(ctx, 8, 17 + u, 1, 3, p.base);
    }
    if (o === 'stripes') px(ctx, 5, 20 + u, 6, 1, s.dark), px(ctx, 5, 22 + u, 6, 1, s.dark);
    if (o === 'vest') px(ctx, 9, 17 + u, 2, 7, shade(s.base, 0.5));
    if (o === 'hoodie') {
      px(ctx, 4, 16 + u, 3, 3, s.dark); // capuz caído nas costas
      px(ctx, 10, 18 + u, 1, 2, STRING);
    }
    if (o === 'sweater') {
      px(ctx, 5, 19 + u, 6, 1, s.light);
      px(ctx, 5, 21 + u, 6, 1, s.light);
      for (const x of [6, 8, 10]) px(ctx, x, 20 + u, 1, 1, s.dark);
    }
    if (o === 'plaid') {
      px(ctx, 8, 17 + u, 1, 7, s.dark);
      px(ctx, 5, 19 + u, 6, 1, s.dark);
      px(ctx, 5, 22 + u, 6, 1, s.dark);
      px(ctx, 8, 19 + u, 1, 1, shade(s.base, 0.55));
      px(ctx, 8, 22 + u, 1, 1, shade(s.base, 0.55));
    }
    if (L.agent) px(ctx, 10, 17 + u, 1, 2, WHITE_SHIRT), px(ctx, 10, 19 + u, 1, 2, TIE);
    if (dress) {
      // saia rodada, mais cheia atrás
      px(ctx, 4, 24 + u, 7, 1, s.base);
      px(ctx, 3, 25 + u, 9, 2, s.base);
      px(ctx, 3, 25 + u, 2, 2, s.dark);
      px(ctx, 3, 27 + u, 9, 1, s.dark);
    } else {
      px(ctx, 5, 24 + u, 6, 1, L.agent ? s.base : o === 'hoodie' ? s.dark : BELT);
      px(ctx, 5, 25 + u, 6, 1, p.base);
    }
    if (o === 'apron') {
      px(ctx, 9, 19 + u, 2, 6, APRON.base);
      px(ctx, 9, 17 + u, 1, 2, APRON.dark);
      px(ctx, 5, 22 + u, 4, 1, APRON.dark); // laço nas costas
    }
    // braço balançando
    const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    px(ctx, 7 + swing, 18 + u, 2, 3, torso.dark);
    px(ctx, 7 + swing, 21 + u, 2, 2, L.skin.base);
    px(ctx, 8 + swing, 22 + u, 1, 1, L.skin.dark);
    return;
  }

  px(ctx, 4, 17 + u, 8, 7, torso.base);
  px(ctx, 10, 17 + u, 2, 7, torso.dark);
  px(ctx, 4, 23 + u, 8, 1, torso.dark);
  px(ctx, 5, 17 + u, 2, 2, torso.light);
  const down = facing === 'down';
  if (down && !L.agent && !['hoodie', 'sweater', 'jacket'].includes(o)) px(ctx, 7, 17 + u, 2, 1, L.skin.dark); // gola em V
  if (down && L.agent) {
    // camisa branca entre as lapelas e a gravata preta descendo até o cinto
    px(ctx, 6, 17 + u, 4, 3, WHITE_SHIRT);
    px(ctx, 7, 17 + u, 2, 6, TIE);
    px(ctx, 5, 17 + u, 1, 1, s.light);
  }

  if (o === 'jacket' && down) {
    px(ctx, 6, 17 + u, 4, 6, s.base);
    px(ctx, 9, 17 + u, 1, 6, s.dark);
    px(ctx, 6, 17 + u, 1, 2, L.jacket.light); // lapelas
    px(ctx, 9, 17 + u, 1, 2, L.jacket.dark);
  }
  if (o === 'overalls') {
    px(ctx, 5, 20 + u, 6, 4, p.base);
    px(ctx, 9, 20 + u, 2, 4, p.dark);
    px(ctx, 5, 17 + u, 1, 3, p.base);
    px(ctx, 10, 17 + u, 1, 3, p.base);
    if (down) px(ctx, 5, 20 + u, 1, 1, BUCKLE), px(ctx, 10, 20 + u, 1, 1, BUCKLE);
  }
  if (o === 'stripes') {
    px(ctx, 4, 19 + u, 8, 1, s.dark);
    px(ctx, 4, 21 + u, 8, 1, s.dark);
  }
  if (o === 'vest' && down) {
    const v = shade(s.base, 0.5);
    px(ctx, 4, 17 + u, 2, 7, v);
    px(ctx, 10, 17 + u, 2, 7, v);
  }
  if (o === 'hoodie') {
    if (down) {
      px(ctx, 4, 16 + u, 2, 1, s.dark); // capuz em volta do pescoço
      px(ctx, 10, 16 + u, 2, 1, s.dark);
      px(ctx, 5, 17 + u, 6, 1, s.dark);
      px(ctx, 6, 18 + u, 1, 2, STRING); // cordões
      px(ctx, 9, 18 + u, 1, 2, STRING);
      px(ctx, 5, 21 + u, 6, 2, s.dark); // bolso canguru
      px(ctx, 6, 21 + u, 4, 1, shade(s.base, 0.5));
    } else {
      px(ctx, 4, 16 + u, 8, 4, s.dark); // capuz caído nas costas
      px(ctx, 5, 17 + u, 6, 2, shade(s.base, 0.5));
    }
  }
  if (o === 'sweater') {
    if (down) px(ctx, 6, 17 + u, 4, 1, s.light); // gola canelada
    px(ctx, 4, 19 + u, 8, 1, s.light);
    px(ctx, 4, 21 + u, 8, 1, s.light);
    for (const x of [5, 7, 9, 11]) px(ctx, x, 20 + u, 1, 1, s.dark);
  }
  if (o === 'plaid') {
    for (const x of [6, 9]) px(ctx, x, 17 + u, 1, 7, s.dark);
    for (const yy of [19, 22]) {
      px(ctx, 4, yy + u, 8, 1, s.dark);
      px(ctx, 6, yy + u, 1, 1, shade(s.base, 0.55));
      px(ctx, 9, yy + u, 1, 1, shade(s.base, 0.55));
    }
  }

  if (dress) {
    // saia rodada até o joelho
    px(ctx, 4, 24 + u, 8, 1, s.base);
    px(ctx, 3, 25 + u, 10, 2, s.base);
    px(ctx, 10, 24 + u, 2, 3, s.dark);
    px(ctx, 3, 27 + u, 10, 1, s.dark);
    px(ctx, 4, 25 + u, 2, 1, s.light);
  } else {
    // o paletó cobre o cinto do agente; o moletom, também
    px(ctx, 4, 24 + u, 8, 1, L.agent || o === 'hoodie' ? s.dark : BELT);
    if (down && !L.agent && o !== 'hoodie' && o !== 'apron') px(ctx, 7, 24 + u, 2, 1, BUCKLE);
    px(ctx, 4, 25 + u, 8, 1, p.base);
    px(ctx, 7, 25 + u, 2, 1, p.dark);
  }
  if (o === 'apron') {
    if (down) {
      px(ctx, 5, 19 + u, 6, 6, APRON.base);
      px(ctx, 10, 19 + u, 1, 6, APRON.dark);
      px(ctx, 6, 17 + u, 1, 2, APRON.dark); // alças
      px(ctx, 9, 17 + u, 1, 2, APRON.dark);
      px(ctx, 6, 22 + u, 4, 1, APRON.dark); // bolso
    } else {
      px(ctx, 4, 22 + u, 8, 1, APRON.dark); // amarração e laço nas costas
      px(ctx, 7, 21 + u, 2, 3, APRON.base);
    }
  }

  // braços: na passada um braço desce, o outro sobe
  const armL = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const armR = -armL;
  px(ctx, 3, 18 + u + armL, 1, 3, torso.base);
  px(ctx, 12, 18 + u + armR, 1, 3, torso.dark);
  px(ctx, 3, 21 + u + armL, 1, 2, L.skin.base);
  px(ctx, 12, 21 + u + armR, 1, 2, L.skin.dark);
}

function head(ctx: Ctx, L: Look, facing: Facing, u: number) {
  const k = L.skin;
  const h = L.hair;
  const y = (n: number) => n + u;
  const st = L.style;
  // Raspado: o couro cabeludo aparece por baixo do cabelo.
  const buzz = tone(mix(h.base, k.base, 0.45));
  const mouth = mix(k.base, '#b34a4a', 0.35);

  if (facing === 'side') {
    if (st === 'curly') {
      // volume em volta da cabeça, atrás do rosto
      px(ctx, 4, y(1), 7, 1, h.base);
      px(ctx, 3, y(2), 9, 2, h.base);
      px(ctx, 2, y(4), 9, 7, h.base);
      px(ctx, 1, y(6), 2, 6, h.dark);
      px(ctx, 2, y(11), 5, 2, h.base);
      px(ctx, 5, y(2), 1, 1, h.light);
      px(ctx, 8, y(3), 1, 1, h.light);
      px(ctx, 3, y(7), 1, 1, h.light);
      px(ctx, 4, y(10), 1, 1, h.dark);
    }
    px(ctx, 5, y(6), 8, 10, k.base);
    px(ctx, 13, y(11), 1, 2, k.base); // nariz
    px(ctx, 5, y(15), 7, 1, k.dark);
    px(ctx, 6, y(16), 4, 1, k.dark); // pescoço
    // olhando para a direita: pupila na frente, esclera atrás
    px(ctx, 10, y(11), 1, 2, SCLERA);
    px(ctx, 11, y(11), 1, 2, L.eye);
    px(ctx, 10, y(10), 2, 1, h.dark);
    px(ctx, 11, y(13), 1, 1, mix(k.base, '#ff6f6f', 0.35));
    px(ctx, 11, y(14), 1, 1, mouth);
    // cabelo
    if (st === 'buzz') {
      px(ctx, 5, y(4), 7, 1, buzz.base);
      px(ctx, 4, y(5), 8, 1, buzz.base);
      px(ctx, 4, y(6), 4, 4, buzz.base);
      px(ctx, 4, y(9), 3, 1, buzz.dark);
    } else {
      px(ctx, 5, y(3), 7, 1, h.base);
      px(ctx, 4, y(4), 9, 2, h.base);
      px(ctx, 3, y(6), 6, 4, h.base);
      px(ctx, 9, y(6), 4, 2, h.base);
      px(ctx, 3, y(10), 4, 3, h.base);
      px(ctx, 6, y(4), 4, 1, h.light);
      px(ctx, 3, y(9), 3, 1, h.dark);
    }
    px(ctx, 7, y(11), 1, 2, k.dark); // orelha
    if (st === 'long' || st === 'bob') px(ctx, 2, y(12), 5, st === 'long' ? 8 : 3, h.base), px(ctx, 2, y(12), 1, st === 'long' ? 8 : 3, h.dark);
    if (st === 'spiky') px(ctx, 6, y(2), 1, 1, h.base), px(ctx, 9, y(1), 2, 2, h.base), px(ctx, 3, y(3), 2, 1, h.base);
    if (st === 'bun') px(ctx, 2, y(3), 3, 3, h.base), px(ctx, 2, y(5), 3, 1, h.dark);
    if (st === 'sidepart') {
      px(ctx, 9, y(8), 4, 1, h.base); // franja longa para a frente
      px(ctx, 12, y(9), 1, 1, h.dark);
      px(ctx, 2, y(12), 4, 2, h.base);
    }
    if (st === 'ponytail') {
      px(ctx, 1, y(6), 3, 2, h.base);
      px(ctx, 0, y(8), 2, 7, h.base);
      px(ctx, 0, y(8), 1, 7, h.dark);
      px(ctx, 2, y(6), 1, 2, L.accent.base); // fita
    }
    if (st === 'braids') {
      for (let j = 0; j < 8; j++) px(ctx, 3, y(12 + j), 2, 1, j % 2 ? h.dark : h.base);
      px(ctx, 3, y(20), 2, 1, L.accent.base);
    }
    if (L.agent) px(ctx, 9, y(11), 3, 2, LENS), px(ctx, 6, y(11), 3, 1, LENS), px(ctx, 11, y(11), 1, 1, GLINT);
    if (L.glasses) {
      const g = L.glasses;
      px(ctx, 9, y(10), 4, 1, g);
      px(ctx, 9, y(13), 4, 1, g);
      px(ctx, 9, y(11), 1, 2, g);
      px(ctx, 12, y(11), 1, 2, g);
      px(ctx, 8, y(11), 1, 1, g); // haste até a orelha
    }
    if (L.beard) {
      const b = shade(h.base, 0.4);
      px(ctx, 10, y(13), 3, 1, b); // bigode
      if (L.beard === 'beard') {
        px(ctx, 8, y(12), 1, 2, b); // costeleta
        px(ctx, 8, y(14), 5, 1, b);
        px(ctx, 8, y(15), 4, 1, shade(b, 0.3));
      }
      px(ctx, 11, y(14), 1, 1, mouth);
    }
    return;
  }

  if (st === 'curly') {
    // volume em volta da cabeça, atrás do rosto, com o contorno ondulado dos cachos
    px(ctx, 4, y(1), 3, 1, h.base);
    px(ctx, 9, y(1), 3, 1, h.base);
    px(ctx, 2, y(2), 12, 2, h.base);
    px(ctx, 1, y(4), 14, 9, h.base);
    px(ctx, 12, y(4), 3, 9, h.dark);
    px(ctx, 0, y(6), 1, 2, h.base);
    px(ctx, 0, y(10), 1, 2, h.base);
    px(ctx, 15, y(7), 1, 2, h.dark);
    curls(ctx, h, u);
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
    px(ctx, 7, y(14), 2, 1, mouth); // boca discreta, sem cara de barba
    if (L.agent) {
      // óculos escuros: duas lentes e a ponte
      px(ctx, 3, y(11), 4, 2, LENS);
      px(ctx, 9, y(11), 4, 2, LENS);
      px(ctx, 7, y(11), 2, 1, LENS);
      px(ctx, 4, y(11), 1, 1, GLINT);
      px(ctx, 10, y(11), 1, 1, GLINT);
    }
  }

  // cabelo — calota
  if (st === 'buzz') {
    px(ctx, 5, y(4), 6, 1, buzz.base);
    px(ctx, 3, y(5), 10, 2, buzz.base);
    px(ctx, 11, y(5), 2, 2, buzz.dark);
    px(ctx, 6, y(4), 2, 1, buzz.light);
  } else {
    px(ctx, 5, y(3), 6, 1, h.base);
    px(ctx, 4, y(4), 8, 1, h.base);
    px(ctx, 3, y(5), 10, 3, h.base);
    px(ctx, 6, y(4), 3, 1, h.light);
    px(ctx, 4, y(5), 2, 1, h.light);
    px(ctx, 11, y(5), 2, 3, h.dark);
  }

  if (facing === 'up') {
    // de costas o cabelo cobre a cabeça toda
    const c = st === 'buzz' ? buzz : h;
    px(ctx, 3, y(st === 'buzz' ? 7 : 8), 10, st === 'buzz' ? 6 : 6, c.base);
    px(ctx, 4, y(14), 8, 1, c.dark);
    px(ctx, 11, y(8), 2, 6, c.dark);
    px(ctx, 2, y(10), 1, 2, k.base);
    px(ctx, 13, y(10), 1, 2, k.dark);
  } else if (st === 'buzz') {
    px(ctx, 3, y(7), 10, 1, buzz.base); // linha do cabelo rente
    px(ctx, 11, y(7), 2, 1, buzz.dark);
    px(ctx, 2, y(11), 1, 2, k.base); // orelhas
    px(ctx, 13, y(11), 1, 2, k.dark);
  } else if (st === 'sidepart') {
    // franja longa varrida de um lado só, cobrindo a sobrancelha
    px(ctx, 3, y(8), 8, 1, h.base);
    px(ctx, 3, y(9), 5, 1, h.base);
    px(ctx, 3, y(10), 3, 1, h.dark);
    px(ctx, 11, y(8), 2, 1, h.dark);
    px(ctx, 2, y(11), 1, 2, k.base);
    px(ctx, 13, y(11), 1, 2, k.dark);
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

  if (st === 'long') {
    px(ctx, 2, y(7), 2, 13, h.base);
    px(ctx, 12, y(7), 2, 13, h.dark);
    if (facing === 'up') px(ctx, 4, y(14), 8, 6, h.base), px(ctx, 4, y(19), 8, 1, h.dark);
  }
  if (st === 'bob' || st === 'sidepart') {
    px(ctx, 2, y(7), 2, st === 'bob' ? 8 : 6, h.base);
    px(ctx, 12, y(7), 2, st === 'bob' ? 8 : 6, h.dark);
    if (facing === 'up') px(ctx, 3, y(14), 10, 2, h.dark);
  }
  if (st === 'spiky') {
    px(ctx, 4, y(2), 1, 2, h.base);
    px(ctx, 7, y(1), 2, 2, h.base);
    px(ctx, 10, y(2), 2, 2, h.dark);
    px(ctx, 7, y(1), 1, 1, h.light);
  }
  if (st === 'bun') {
    px(ctx, 6, y(0), 4, 3, h.base);
    px(ctx, 6, y(0), 2, 1, h.light);
    px(ctx, 9, y(1), 1, 2, h.dark);
  }
  if (st === 'curly' && facing === 'up') curls(ctx, h, u, true);
  if (st === 'curly' && facing === 'down') {
    // franja de cachos
    px(ctx, 3, y(8), 2, 1, h.base);
    px(ctx, 6, y(8), 2, 1, h.base);
    px(ctx, 10, y(8), 2, 1, h.dark);
  }
  if (st === 'ponytail' && facing === 'down') px(ctx, 13, y(9), 2, 6, h.dark); // o rabo aparece atrás da orelha
  if (st === 'braids' && facing === 'down') {
    // duas tranças caindo na frente dos ombros
    for (const x of [2, 12])
      for (let j = 0; j < 9; j++) px(ctx, x, y(11 + j), 2, 1, j % 2 ? h.dark : x === 2 ? h.base : h.dark);
    px(ctx, 2, y(20), 2, 1, L.accent.base);
    px(ctx, 12, y(20), 2, 1, L.accent.dark);
  }

  if (facing === 'down' && L.glasses) {
    // óculos de grau: armação em volta dos olhos, que continuam aparecendo
    const g = L.glasses;
    for (const x of [3, 9]) {
      px(ctx, x + 1, y(10), 2, 1, g);
      px(ctx, x + 1, y(13), 2, 1, g);
      px(ctx, x, y(11), 1, 2, g);
      px(ctx, x + 3, y(11), 1, 2, g);
    }
    px(ctx, 7, y(11), 2, 1, g); // ponte
  }
  if (facing === 'down' && L.beard) {
    // no tom escuro do cabelo: o tom normal some na pele quando o cabelo é claro
    const b = shade(h.base, 0.4);
    const bd = shade(b, 0.3);
    px(ctx, 6, y(13), 4, 1, b); // bigode
    px(ctx, 9, y(13), 1, 1, bd);
    if (L.beard === 'beard') {
      px(ctx, 3, y(12), 1, 3, b); // costeletas descendo até o queixo
      px(ctx, 12, y(12), 1, 3, bd);
      px(ctx, 4, y(14), 3, 1, b);
      px(ctx, 9, y(14), 3, 1, bd);
      px(ctx, 4, y(15), 8, 1, b);
      px(ctx, 9, y(15), 3, 1, bd);
    }
    px(ctx, 7, y(14), 2, 1, mouth);
  }
}

/** Pontos de luz e sombra dos cachos; `costas` = também no meio, onde de frente fica o rosto. */
function curls(ctx: Ctx, h: Tone, u: number, costas = false) {
  const y = (n: number) => n + u;
  for (const [x, yy] of [[5, 1], [10, 1], [3, 3], [8, 2], [1, 5], [2, 9], [13, 4]]) px(ctx, x, y(yy), 1, 1, h.light);
  for (const [x, yy] of [[6, 3], [11, 3], [1, 7], [14, 6], [13, 10], [2, 12]]) px(ctx, x, y(yy), 1, 1, shade(h.base, 0.45));
  if (!costas) return;
  for (const [x, yy] of [[5, 6], [9, 7], [4, 10], [8, 11], [11, 9]]) px(ctx, x, y(yy), 1, 1, h.light);
  for (const [x, yy] of [[7, 5], [6, 9], [10, 12], [3, 8]]) px(ctx, x, y(yy), 1, 1, shade(h.base, 0.45));
}

/** O que cai pelas costas por cima da roupa (de costas, o corpo é desenhado depois da cabeça). */
function backHair(ctx: Ctx, L: Look, u: number) {
  const h = L.hair;
  const y = (n: number) => n + u;
  if (L.style === 'ponytail') {
    px(ctx, 7, y(9), 2, 1, L.accent.base); // fita
    px(ctx, 7, y(10), 2, 9, h.base);
    px(ctx, 8, y(10), 1, 9, h.dark);
  }
  if (L.style === 'braids') {
    for (const x of [4, 10]) for (let j = 0; j < 8; j++) px(ctx, x, y(12 + j), 2, 1, j % 2 ? h.dark : h.base);
    px(ctx, 4, y(20), 2, 1, L.accent.base);
    px(ctx, 10, y(20), 2, 1, L.accent.base);
  }
}

/** Lenço no pescoço. */
function scarf(ctx: Ctx, sc: Tone, facing: Facing, u: number) {
  if (facing === 'side') {
    px(ctx, 5, 16 + u, 6, 2, sc.base);
    px(ctx, 5, 16 + u, 2, 2, sc.dark);
    px(ctx, 4, 17 + u, 2, 4, sc.dark); // ponta caindo nas costas
    return;
  }
  px(ctx, 4, 16 + u, 8, 2, sc.base);
  px(ctx, 10, 16 + u, 2, 2, sc.dark);
  if (facing === 'down') {
    px(ctx, 9, 18 + u, 2, 3, sc.base); // ponta do nó
    px(ctx, 10, 18 + u, 1, 3, sc.dark);
  }
}

/** Por cima do cabelo: chapéu de palha (o clássico da fazenda), boné, gorro, faixa ou laço. */
function headwear(ctx: Ctx, L: Look, facing: Facing, u: number) {
  const a = L.accent;
  const y = (n: number) => n + u;
  const side = facing === 'side';
  switch (L.headwear) {
    case 'straw':
      if (side) {
        px(ctx, 2, y(6), 13, 1, HAT.base);
        px(ctx, 2, y(7), 13, 1, HAT.dark);
        px(ctx, 4, y(2), 8, 4, HAT.base);
        px(ctx, 4, y(5), 8, 1, HAT_BAND);
        px(ctx, 5, y(2), 4, 1, HAT.light);
        return;
      }
      px(ctx, 1, y(6), 14, 1, HAT.base);
      px(ctx, 1, y(7), 14, 1, HAT.dark);
      px(ctx, 4, y(2), 8, 4, HAT.base);
      px(ctx, 4, y(5), 8, 1, HAT_BAND);
      px(ctx, 5, y(2), 3, 1, HAT.light);
      px(ctx, 10, y(2), 2, 3, HAT.dark);
      return;
    case 'cap':
      if (side) {
        px(ctx, 5, y(2), 6, 1, a.base);
        px(ctx, 4, y(3), 8, 3, a.base);
        px(ctx, 4, y(3), 2, 3, a.dark);
        px(ctx, 6, y(3), 2, 1, a.light);
        px(ctx, 11, y(5), 4, 1, a.dark); // aba para a frente
        px(ctx, 12, y(6), 3, 1, shade(a.base, 0.5));
        return;
      }
      px(ctx, 5, y(2), 6, 1, a.base);
      px(ctx, 4, y(3), 8, 3, a.base);
      px(ctx, 10, y(3), 2, 3, a.dark);
      px(ctx, 5, y(3), 2, 1, a.light);
      px(ctx, 7, y(1), 2, 1, a.dark); // botão
      px(ctx, 8, y(2), 1, 4, a.dark); // costura do meio
      if (facing === 'down') {
        px(ctx, 2, y(6), 12, 1, a.light); // aba larga, vista de frente
        px(ctx, 2, y(7), 12, 1, a.dark);
        px(ctx, 4, y(8), 8, 1, shade(a.base, 0.55)); // sombra da aba na testa
      } else {
        px(ctx, 3, y(6), 10, 1, a.base);
        px(ctx, 6, y(6), 4, 1, a.dark); // regulagem atrás
      }
      return;
    case 'beanie':
      px(ctx, 4, y(2), 8, 1, a.base);
      px(ctx, 3, y(3), 10, 4, a.base);
      px(ctx, side ? 3 : 11, y(3), 2, 4, a.dark);
      px(ctx, 5, y(3), 2, 1, a.light);
      px(ctx, 3, y(6), 10, 2, a.dark); // barra dobrada
      for (const x of [4, 6, 8, 10]) px(ctx, x, y(6), 1, 2, shade(a.base, 0.5));
      px(ctx, 7, y(0), 2, 2, a.light); // pompom
      return;
    case 'headband':
      if (side) {
        px(ctx, 4, y(5), 9, 1, a.base);
        px(ctx, 4, y(5), 2, 1, a.dark);
        return;
      }
      px(ctx, 3, y(5), 10, 1, a.base);
      px(ctx, 11, y(5), 2, 1, a.dark);
      return;
    case 'bow':
      if (side) {
        px(ctx, 2, y(2), 3, 3, a.base);
        px(ctx, 3, y(3), 1, 1, a.dark);
        return;
      }
      px(ctx, 8, y(2), 2, 3, a.base); // duas alças e o nó, no alto, de lado
      px(ctx, 11, y(2), 2, 3, a.base);
      px(ctx, 10, y(3), 1, 1, a.dark);
      px(ctx, 8, y(4), 2, 1, a.dark);
      px(ctx, 11, y(4), 2, 1, a.dark);
      return;
  }
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

export function drawFrame(ctx: Ctx, L: Look, facing: Facing, frame: number) {
  const u = frame % 2 === 1 ? 1 : 0;
  legs(ctx, L, facing, frame);
  if (facing === 'up') {
    head(ctx, L, facing, u);
    body(ctx, L, facing, frame, u);
    backHair(ctx, L, u);
  } else {
    body(ctx, L, facing, frame, u);
    head(ctx, L, facing, u);
  }
  if (L.scarf) scarf(ctx, L.scarf, facing, u);
  if (L.headwear) headwear(ctx, L, facing, u);
}

export const FACINGS: Facing[] = ['down', 'side', 'up'];

/** Chave de textura: uma folha por combinação visível. */
export function lookKey(L: Look): string {
  const tons = [L.skin, L.hair, L.shirt, L.pants, L.accent, L.jacket, L.scarf].map((t) => t?.base ?? '-');
  return `villager-${[L.agent ? 'agent' : 'npc', ...tons, L.eye, L.style, L.outfit, L.headwear, L.glasses, L.beard].join('-')}`;
}

/** Folha 64x96 inteira (3 direções x 4 quadros), com o contorno colorido de cada quadro. */
export function drawSheet(ctx: Ctx, L: Look) {
  FACINGS.forEach((facing, row) => {
    for (let f = 0; f < 4; f++) {
      ctx.save();
      ctx.translate(f * VILLAGER_W, row * VILLAGER_H);
      drawFrame(ctx, L, facing, f);
      ctx.restore();
      colorOutline(ctx, f * VILLAGER_W, row * VILLAGER_H, VILLAGER_W, VILLAGER_H);
    }
  });
}
