import type { Project } from '../api';

export const TILE = 16;
const MARGIN = 4; // faixa de floresta ao redor da vila
const CIVIC_H = 12; // linha de cima: biblioteca, praça e fábrica
const PLOT_W = 12;
const PLOT_H = 11;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Plot {
  project: Project;
  /** Pixel do canto inferior-centro da casa (âncora do sprite). */
  house: { x: number; y: number };
  bin: { x: number; y: number };
  sign: { x: number; y: number };
  /** Área do quintal onde os moradores passeiam. */
  yard: Rect;
}

export interface Layout {
  width: number;
  height: number;
  cols: number;
  /** Tiles de terra/pedra, em coordenadas de tile. */
  dirt: Set<string>;
  stone: Set<string>;
  plots: Plot[];
  library: { x: number; y: number };
  factory: { x: number; y: number };
  well: { x: number; y: number };
  plaza: Rect;
  /** Regiões onde não plantamos árvores nem flores (em tiles). */
  reserved: Rect[];
}

const key = (x: number, y: number) => `${x},${y}`;

export function computeLayout(projects: Project[]): Layout {
  const cols = Math.max(3, Math.min(4, projects.length));
  const rows = Math.max(1, Math.ceil(projects.length / cols));
  const wTiles = MARGIN * 2 + cols * PLOT_W;
  const hTiles = MARGIN * 2 + CIVIC_H + rows * PLOT_H;
  const dirt = new Set<string>();
  const stone = new Set<string>();
  const reserved: Rect[] = [];

  const hLine = (y: number, x0: number, x1: number, set = dirt) => {
    for (let x = x0; x <= x1; x++) {
      set.add(key(x, y));
      set.add(key(x, y + 1));
    }
  };
  const vLine = (x: number, y0: number, y1: number, set = dirt) => {
    for (let y = y0; y <= y1; y++) {
      set.add(key(x, y));
      set.add(key(x + 1, y));
    }
  };

  const left = MARGIN - 1;
  const right = wTiles - MARGIN;
  const midX = Math.floor(wTiles / 2) - 1;

  // ---- linha cívica ----
  const civicTop = MARGIN;
  const plaza: Rect = { x: midX - 5, y: civicTop + 3, w: 12, h: 7 };
  for (let y = plaza.y; y < plaza.y + plaza.h; y++) for (let x = plaza.x; x < plaza.x + plaza.w; x++) stone.add(key(x, y));
  reserved.push(plaza);
  const civicRoadY = civicTop + CIVIC_H - 2;
  hLine(civicRoadY, left, right);
  vLine(midX, plaza.y + plaza.h, civicRoadY);

  const libraryTile = { x: MARGIN + 3, y: civicTop + 1 };
  const factoryTile = { x: wTiles - MARGIN - 10, y: civicTop + 1 };
  reserved.push({ ...libraryTile, w: 7, h: 9 }, { ...factoryTile, w: 7, h: 9 });
  vLine(libraryTile.x + 3, libraryTile.y + 6, civicRoadY);
  vLine(factoryTile.x + 3, factoryTile.y + 7, civicRoadY);

  // ---- lotes das casas ----
  const plots: Plot[] = projects.map((project, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = MARGIN + col * PLOT_W;
    const py = MARGIN + CIVIC_H + row * PLOT_H;
    const doorX = px + Math.floor(PLOT_W / 2) - 1;
    const roadY = py + PLOT_H - 2;
    vLine(doorX, py + 6, roadY);
    reserved.push({ x: px + 2, y: py, w: 8, h: 7 });
    return {
      project,
      house: { x: (doorX + 1) * TILE, y: (py + 6) * TILE },
      bin: { x: (doorX + 4) * TILE, y: (py + 6) * TILE - 2 },
      sign: { x: (doorX - 2) * TILE, y: (py + 7) * TILE },
      yard: { x: (px + 1) * TILE, y: (py + 6) * TILE + 8, w: (PLOT_W - 2) * TILE, h: 2 * TILE },
    };
  });
  for (let r = 0; r < rows; r++) hLine(MARGIN + CIVIC_H + r * PLOT_H + PLOT_H - 2, left, right);
  // estrada central ligando todas as ruas
  vLine(midX, civicRoadY, MARGIN + CIVIC_H + rows * PLOT_H - 1);

  return {
    width: wTiles * TILE,
    height: hTiles * TILE,
    cols,
    dirt,
    stone,
    plots,
    library: { x: (libraryTile.x + 3.5) * TILE, y: (libraryTile.y + 6) * TILE },
    factory: { x: (factoryTile.x + 3.5) * TILE, y: (factoryTile.y + 7) * TILE },
    well: { x: (plaza.x + plaza.w / 2) * TILE, y: (plaza.y + 3) * TILE },
    plaza: { x: plaza.x * TILE, y: plaza.y * TILE, w: plaza.w * TILE, h: plaza.h * TILE },
    reserved,
  };
}

export function inRects(x: number, y: number, rects: Rect[]): boolean {
  return rects.some((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
}

export function isPath(layout: Layout, x: number, y: number) {
  return layout.dirt.has(key(x, y)) || layout.stone.has(key(x, y));
}
