import Phaser from 'phaser';
import { add, disc, makeCanvas, mulberry32, outline, rect } from './textures';

/** Móveis e acabamentos do interior das casas — mesma técnica de pixel art gerada em código. */

function floor(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 16);
  const rnd = mulberry32(11);
  rect(ctx, 0, 0, 16, 16, '#c8935a');
  for (let y = 0; y < 16; y += 4) {
    rect(ctx, 0, y + 3, 16, 1, '#9f6c38');
    const seam = y % 8 === 0 ? 5 : 12;
    rect(ctx, seam, y, 1, 3, '#a8743f');
    rect(ctx, 0, y, 16, 1, '#d6a46a');
  }
  for (let i = 0; i < 6; i++) rect(ctx, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 2, 1, '#b8834c');
  add(scene, 'floor', c);
}

function wall(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 40);
  // papel de parede listrado
  rect(ctx, 0, 0, 16, 26, '#e9d6a9');
  for (let x = 1; x < 16; x += 4) rect(ctx, x, 0, 2, 26, '#dfc690');
  for (let y = 4; y < 26; y += 8) rect(ctx, 3, y, 1, 1, '#c9a76a'), rect(ctx, 11, y + 4, 1, 1, '#c9a76a');
  // moldura e lambri
  rect(ctx, 0, 26, 16, 2, '#b9854a');
  rect(ctx, 0, 28, 16, 10, '#8f5f30');
  rect(ctx, 2, 30, 5, 6, '#9d6b3a');
  rect(ctx, 9, 30, 5, 6, '#9d6b3a');
  rect(ctx, 0, 38, 16, 2, '#5e3a1c');
  add(scene, 'wall', c);
}

function wallWindow(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(30, 24);
  rect(ctx, 3, 2, 24, 18, '#6b4220');
  rect(ctx, 5, 4, 20, 14, '#9fd6ec');
  rect(ctx, 5, 4, 8, 5, '#d3eef7');
  rect(ctx, 14, 4, 2, 14, '#6b4220');
  rect(ctx, 5, 10, 20, 2, '#6b4220');
  // cortinas
  rect(ctx, 0, 0, 30, 3, '#8c2c20');
  rect(ctx, 0, 3, 5, 19, '#c0392b');
  rect(ctx, 25, 3, 5, 19, '#c0392b');
  rect(ctx, 1, 3, 1, 19, '#e05a4a');
  rect(ctx, 26, 3, 1, 19, '#e05a4a');
  outline(ctx, 30, 24);
  add(scene, 'wallWindow', c);
}

function desk(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(34, 22);
  rect(ctx, 1, 4, 32, 5, '#b9854a');
  rect(ctx, 1, 4, 32, 1, '#d6a46a');
  rect(ctx, 1, 9, 32, 11, '#8f5f30');
  rect(ctx, 3, 11, 12, 7, '#9d6b3a');
  rect(ctx, 8, 14, 3, 1, '#e8c252');
  rect(ctx, 19, 11, 12, 7, '#9d6b3a');
  rect(ctx, 24, 14, 3, 1, '#e8c252');
  rect(ctx, 1, 20, 3, 2, '#5e3a1c');
  rect(ctx, 30, 20, 3, 2, '#5e3a1c');
  // teclado e caneca
  rect(ctx, 11, 5, 12, 3, '#d8d2c4');
  rect(ctx, 12, 6, 10, 1, '#a9a294');
  rect(ctx, 27, 2, 4, 5, '#e8e2d2');
  rect(ctx, 31, 3, 1, 2, '#e8e2d2');
  rect(ctx, 28, 2, 2, 1, '#6b3f1f');
  outline(ctx, 34, 22);
  add(scene, 'desk', c);
}

function monitor(scene: Phaser.Scene, key: string, screen: 'off' | 'on' | 'alert') {
  const { c, ctx } = makeCanvas(18, 16);
  rect(ctx, 1, 0, 16, 12, '#3a3f47');
  rect(ctx, 2, 1, 14, 10, screen === 'off' ? '#1f2a33' : screen === 'alert' ? '#3a2a10' : '#14302a');
  if (screen === 'on') {
    const rnd = mulberry32(5);
    for (let y = 2; y < 10; y += 2) rect(ctx, 3 + Math.floor(rnd() * 2), y, 4 + Math.floor(rnd() * 8), 1, rnd() > 0.4 ? '#5fd3a0' : '#e8c252');
  }
  if (screen === 'alert') {
    rect(ctx, 8, 3, 2, 4, '#f7d046');
    rect(ctx, 8, 8, 2, 1, '#f7d046');
  }
  if (screen === 'off') rect(ctx, 3, 2, 3, 1, '#2f3d48');
  rect(ctx, 7, 12, 4, 2, '#2c3036');
  rect(ctx, 5, 14, 8, 2, '#3a3f47');
  outline(ctx, 18, 16);
  add(scene, key, c);
}

function chair(scene: Phaser.Scene) {
  // vista por trás: o encosto cobre as pernas de quem está sentado
  const { c, ctx } = makeCanvas(14, 12);
  rect(ctx, 1, 0, 12, 8, '#8f5f30');
  rect(ctx, 2, 1, 10, 6, '#a8743c');
  rect(ctx, 3, 2, 8, 1, '#c9955a');
  rect(ctx, 2, 8, 2, 4, '#5e3a1c');
  rect(ctx, 10, 8, 2, 4, '#5e3a1c');
  outline(ctx, 14, 12);
  add(scene, 'chair', c);
}

/** Escrivaninha do dono da casa: papéis, luminária e tinteiro. Abre o painel do projeto. */
function study(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(40, 30);
  rect(ctx, 1, 12, 38, 5, '#7a4b20');
  rect(ctx, 1, 12, 38, 1, '#a8743c');
  rect(ctx, 1, 17, 38, 11, '#5e3a1c');
  rect(ctx, 4, 19, 14, 7, '#6b4423');
  rect(ctx, 22, 19, 14, 7, '#6b4423');
  rect(ctx, 10, 22, 3, 1, '#e8c252');
  rect(ctx, 28, 22, 3, 1, '#e8c252');
  // papéis e pergaminho
  rect(ctx, 5, 9, 10, 5, '#f4ead2');
  rect(ctx, 6, 10, 7, 1, '#b9a985');
  rect(ctx, 6, 12, 5, 1, '#b9a985');
  rect(ctx, 16, 10, 8, 4, '#fbf3df');
  rect(ctx, 17, 11, 6, 1, '#c9b991');
  // tinteiro com pena
  rect(ctx, 26, 10, 3, 3, '#2b2b45');
  rect(ctx, 28, 4, 1, 7, '#f2f2f2');
  rect(ctx, 29, 3, 1, 3, '#f2f2f2');
  // luminária
  rect(ctx, 33, 4, 1, 9, '#c9a227');
  rect(ctx, 30, 1, 7, 4, '#2f8f5a');
  rect(ctx, 31, 5, 5, 1, '#fff1a8');
  outline(ctx, 40, 30);
  add(scene, 'study', c);
}

function sofa(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(56, 26);
  const base = '#3f7a5a';
  const dark = '#2c5a41';
  const light = '#5a9a76';
  rect(ctx, 4, 0, 48, 12, base);
  rect(ctx, 4, 0, 48, 2, light);
  for (const x of [19, 35]) rect(ctx, x, 2, 1, 10, dark);
  rect(ctx, 0, 6, 7, 16, dark);
  rect(ctx, 49, 6, 7, 16, dark);
  rect(ctx, 1, 6, 5, 2, base);
  rect(ctx, 50, 6, 5, 2, base);
  rect(ctx, 6, 12, 44, 8, light);
  rect(ctx, 6, 18, 44, 4, base);
  for (const x of [20, 36]) rect(ctx, x, 12, 1, 8, base);
  rect(ctx, 2, 22, 3, 3, '#5e3a1c');
  rect(ctx, 51, 22, 3, 3, '#5e3a1c');
  outline(ctx, 56, 26);
  add(scene, 'sofa', c);
}

/** Frente do sofá (assento e braços), desenhada por cima de quem está sentado. */
function sofaFront(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(56, 26);
  rect(ctx, 0, 6, 7, 16, '#2c5a41');
  rect(ctx, 49, 6, 7, 16, '#2c5a41');
  rect(ctx, 1, 6, 5, 2, '#3f7a5a');
  rect(ctx, 50, 6, 5, 2, '#3f7a5a');
  rect(ctx, 6, 18, 44, 4, '#3f7a5a');
  rect(ctx, 6, 18, 44, 1, '#5a9a76');
  rect(ctx, 2, 22, 3, 3, '#5e3a1c');
  rect(ctx, 51, 22, 3, 3, '#5e3a1c');
  outline(ctx, 56, 26);
  add(scene, 'sofaFront', c);
}

function bookshelf(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(34, 44);
  rect(ctx, 1, 1, 32, 42, '#6b4220');
  rect(ctx, 3, 3, 28, 38, '#4a2c14');
  const colors = ['#c0392b', '#2e86c1', '#27ae60', '#d4ac0d', '#8e44ad', '#e67e22', '#ecf0f1'];
  const rnd = mulberry32(3);
  for (const y of [3, 16, 29]) {
    let x = 4;
    while (x < 29) {
      const w = 2 + Math.floor(rnd() * 2);
      const h = 7 + Math.floor(rnd() * 4);
      rect(ctx, x, y + 11 - h, w, h, colors[Math.floor(rnd() * colors.length)]);
      x += w + (rnd() < 0.2 ? 2 : 0);
    }
    rect(ctx, 3, y + 11, 28, 2, '#8f5f30');
  }
  outline(ctx, 34, 44);
  add(scene, 'bookshelf', c);
}

function plant(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(18, 26);
  disc(ctx, 9, 8, 7, '#2f6e30');
  disc(ctx, 5, 11, 4, '#3f8a3a');
  disc(ctx, 13, 11, 4, '#3f8a3a');
  disc(ctx, 8, 6, 3, '#58a84a');
  rect(ctx, 4, 16, 10, 9, '#b8573a');
  rect(ctx, 3, 15, 12, 2, '#d06a48');
  rect(ctx, 11, 17, 2, 8, '#94452d');
  outline(ctx, 18, 26);
  add(scene, 'plant', c);
}

function rug(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(72, 40);
  rect(ctx, 2, 0, 68, 40, '#8c3a3a');
  rect(ctx, 0, 2, 72, 36, '#8c3a3a');
  rect(ctx, 5, 4, 62, 32, '#b85450');
  rect(ctx, 9, 8, 54, 24, '#d8a35a');
  rect(ctx, 12, 11, 48, 18, '#b85450');
  for (let x = 16; x < 58; x += 8) rect(ctx, x, 19, 4, 2, '#e9c88f');
  add(scene, 'rug', c);
}

function doormat(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(32, 12);
  rect(ctx, 0, 0, 32, 12, '#6b4a2a');
  rect(ctx, 2, 2, 28, 8, '#9a7448');
  for (let x = 4; x < 28; x += 3) rect(ctx, x, 3, 1, 6, '#7d5b36');
  outline(ctx, 32, 12);
  add(scene, 'doormat', c);
}

/** Cor do bilhete por prioridade (P1..P4) — as mesmas do painel de pendências (`.pend-prio` no style.css). */
export const NOTE_COLORS = ['#d6402f', '#e8892b', '#e8c252', '#f2e6c4'];

/** Quadro de cortiça da parede: os bilhetes (pendências) são pregados por cima, um sprite cada. */
function corkBoard(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(46, 30);
  rect(ctx, 0, 0, 46, 30, '#7a4b20');
  rect(ctx, 0, 0, 46, 1, '#a8743c');
  rect(ctx, 2, 2, 42, 26, '#c79a5e');
  const rnd = mulberry32(17);
  for (let i = 0; i < 24; i++) rect(ctx, 2 + Math.floor(rnd() * 42), 2 + Math.floor(rnd() * 26), 1, 1, rnd() > 0.5 ? '#b5864a' : '#d6ab70');
  outline(ctx, 46, 30);
  add(scene, 'corkBoard', c);
}

function note(scene: Phaser.Scene, priority: number) {
  const { c, ctx } = makeCanvas(7, 8);
  rect(ctx, 0, 1, 7, 7, NOTE_COLORS[priority - 1]);
  rect(ctx, 1, 4, 5, 1, '#00000033');
  rect(ctx, 1, 6, 3, 1, '#00000033');
  rect(ctx, 3, 0, 1, 2, '#3a3f47');
  add(scene, `note${priority}`, c);
}

/** Atril com o diário aberto (o `PROGRESS.md` do projeto). */
function lectern(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(18, 24);
  // pé e base
  rect(ctx, 8, 10, 3, 12, '#6b4220');
  rect(ctx, 3, 21, 13, 2, '#5e3a1c');
  // tampo inclinado
  rect(ctx, 1, 6, 16, 5, '#8f5f30');
  rect(ctx, 1, 6, 16, 1, '#b9854a');
  // livro aberto, com fita marcadora
  rect(ctx, 2, 2, 7, 6, '#f4ead2');
  rect(ctx, 10, 2, 7, 6, '#fbf3df');
  rect(ctx, 9, 2, 1, 6, '#b9a985');
  for (const y of [3, 5]) rect(ctx, 3, y, 5, 1, '#b9a985'), rect(ctx, 11, y, 5, 1, '#c9b991');
  rect(ctx, 13, 8, 1, 3, '#c0392b');
  outline(ctx, 18, 24);
  add(scene, 'lectern', c);
}

export function generateInteriorTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('floor')) return;
  floor(scene);
  wall(scene);
  wallWindow(scene);
  desk(scene);
  monitor(scene, 'monitorOff', 'off');
  monitor(scene, 'monitorOn', 'on');
  monitor(scene, 'monitorAlert', 'alert');
  chair(scene);
  study(scene);
  sofa(scene);
  sofaFront(scene);
  bookshelf(scene);
  plant(scene);
  rug(scene);
  doormat(scene);
  corkBoard(scene);
  lectern(scene);
  for (let p = 1; p <= 4; p++) note(scene, p);
}

// ---------------- biblioteca ----------------

const BOOK_COLORS = ['#c0392b', '#2e86c1', '#27ae60', '#d4ac0d', '#8e44ad', '#e67e22', '#ecf0f1', '#16a085', '#7d5b36'];

/** Estante alta com moldura na cor da seção; `fill` (0..1) decide quantos livros aparecem. */
export function libraryShelf(scene: Phaser.Scene, key: string, trim: string, fill: number, seed: number) {
  if (scene.textures.exists(key)) return key;
  const { c, ctx } = makeCanvas(38, 56);
  rect(ctx, 1, 2, 36, 53, '#5e3a1c');
  rect(ctx, 3, 4, 32, 49, '#3a2412');
  rect(ctx, 0, 0, 38, 4, trim);
  rect(ctx, 0, 3, 38, 1, '#2b1a0e');
  const rnd = mulberry32(seed);
  const shelves = [4, 16, 28, 40];
  const capacity = shelves.length * 10;
  let books = Math.round(fill * capacity);
  for (const y of shelves) {
    let x = 4;
    while (x < 33 && books > 0) {
      const w = 2 + Math.floor(rnd() * 2);
      const h = 7 + Math.floor(rnd() * 4);
      if (x + w > 34) break;
      // de vez em quando um livro tombado
      if (rnd() < 0.08 && x + 7 < 34) {
        rect(ctx, x, y + 9, 7, 2, BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)]);
        x += 8;
      } else {
        rect(ctx, x, y + 11 - h, w, h, BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)]);
        rect(ctx, x, y + 11 - h + 2, w, 1, 'rgba(255,255,255,0.25)');
        x += w;
      }
      books--;
    }
    rect(ctx, 3, y + 11, 32, 2, '#7a4b20');
  }
  rect(ctx, 1, 53, 36, 3, trim);
  outline(ctx, 38, 56);
  add(scene, key, c);
  return key;
}

function libFloor(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 16);
  rect(ctx, 0, 0, 16, 16, '#a8744a');
  rect(ctx, 0, 0, 8, 8, '#9a6a42');
  rect(ctx, 8, 8, 8, 8, '#9a6a42');
  rect(ctx, 0, 7, 16, 1, '#7d5434');
  rect(ctx, 7, 0, 1, 16, '#7d5434');
  rect(ctx, 1, 1, 3, 1, '#b8845a');
  rect(ctx, 9, 9, 3, 1, '#b07c50');
  add(scene, 'libFloor', c);
}

function libWall(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(16, 40);
  rect(ctx, 0, 0, 16, 26, '#3f5e4a');
  for (let x = 0; x < 16; x += 8) rect(ctx, x + 3, 0, 2, 26, '#476a54');
  for (let y = 5; y < 26; y += 10) rect(ctx, 7, y, 2, 2, '#c9a227');
  rect(ctx, 0, 26, 16, 2, '#c9a227');
  rect(ctx, 0, 28, 16, 10, '#5e3a1c');
  rect(ctx, 2, 30, 12, 6, '#6b4423');
  rect(ctx, 0, 38, 16, 2, '#3a2412');
  add(scene, 'libWall', c);
}

function counter(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(72, 28);
  rect(ctx, 0, 6, 72, 6, '#8f5f30');
  rect(ctx, 0, 6, 72, 1, '#c9955a');
  rect(ctx, 2, 12, 68, 15, '#6b4423');
  for (let x = 6; x < 68; x += 16) rect(ctx, x, 14, 12, 11, '#7a4f2a');
  // pilha de livros, sineta e carimbo
  rect(ctx, 6, 1, 12, 2, '#2e86c1');
  rect(ctx, 7, 3, 11, 2, '#c0392b');
  rect(ctx, 5, 5, 13, 2, '#27ae60');
  disc(ctx, 56, 4, 3, '#e8c252');
  rect(ctx, 55, 0, 2, 2, '#e8c252');
  rect(ctx, 40, 3, 4, 4, '#5e3a1c');
  rect(ctx, 39, 2, 6, 2, '#c0392b');
  outline(ctx, 72, 28);
  add(scene, 'counter', c);
}

function catalog(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(32, 36);
  rect(ctx, 1, 2, 30, 32, '#7a4b20');
  rect(ctx, 0, 0, 32, 3, '#a8743c');
  for (let y = 5; y < 32; y += 7)
    for (let x = 3; x < 29; x += 9) {
      rect(ctx, x, y, 8, 6, '#a8743c');
      rect(ctx, x + 3, y + 3, 2, 1, '#e8c252');
      rect(ctx, x + 2, y + 1, 4, 1, '#f4ead2');
    }
  outline(ctx, 32, 36);
  add(scene, 'catalog', c);
}

function readingTable(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(50, 26);
  rect(ctx, 0, 8, 50, 6, '#8f5f30');
  rect(ctx, 0, 8, 50, 1, '#c9955a');
  rect(ctx, 3, 14, 4, 11, '#5e3a1c');
  rect(ctx, 43, 14, 4, 11, '#5e3a1c');
  // livro aberto
  rect(ctx, 12, 5, 9, 5, '#fbf3df');
  rect(ctx, 21, 5, 9, 5, '#f4ead2');
  rect(ctx, 20, 5, 2, 5, '#c9b991');
  rect(ctx, 13, 6, 6, 1, '#b9a985');
  rect(ctx, 23, 7, 5, 1, '#b9a985');
  // vela
  rect(ctx, 38, 2, 3, 7, '#f4efe3');
  rect(ctx, 39, 0, 1, 2, '#f7a400');
  outline(ctx, 50, 26);
  add(scene, 'readingTable', c);
}

function globe(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(18, 28);
  disc(ctx, 9, 8, 7, '#3a6ea8');
  rect(ctx, 5, 4, 4, 3, '#4f9a32');
  rect(ctx, 10, 9, 4, 4, '#4f9a32');
  rect(ctx, 6, 11, 2, 2, '#4f9a32');
  rect(ctx, 8, 16, 2, 8, '#6b4423');
  rect(ctx, 4, 24, 10, 3, '#5e3a1c');
  outline(ctx, 18, 28);
  add(scene, 'globe', c);
}

export function generateLibraryTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('libFloor')) return;
  libFloor(scene);
  libWall(scene);
  counter(scene);
  catalog(scene);
  readingTable(scene);
  globe(scene);
}
