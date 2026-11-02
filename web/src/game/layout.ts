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
  sign: { x: number; y: number };
  /** Área do quintal onde os moradores passeiam. */
  yard: Rect;
}

export interface Layout {
  width: number;
  height: number;
  cols: number;
  /** Zoom que enquadra a vila inteira na tela (visão geral). */
  zoom: number;
  /** A vila sem a floresta extra que completa a tela, em tiles. */
  village: Rect;
  /** Tiles de terra/pedra, em coordenadas de tile. */
  dirt: Set<string>;
  stone: Set<string>;
  plots: Plot[];
  library: { x: number; y: number };
  /** Outdoor dos guardrails, atrás da praça (âncora embaixo-centro). */
  billboard: { x: number; y: number };
  factory: { x: number; y: number };
  fountain: { x: number; y: number };
  plaza: Rect;
  /** Regiões onde não plantamos árvores nem flores (em tiles). */
  reserved: Rect[];
}

/** Tamanho da tela (px) para a qual a vila é montada. */
export interface View {
  w: number;
  h: number;
}

const key = (x: number, y: number) => `${x},${y}`;
const ZOOM_MIN = 1.5;
const ZOOM_MAX = 3;

const villageTiles = (cols: number, rows: number) => ({ w: MARGIN * 2 + cols * PLOT_W, h: MARGIN * 2 + CIVIC_H + rows * PLOT_H });

/** Zoom da visão geral: a vila inteira cabe, com só um tile de floresta de cada lado (era o enquadramento antigo). */
export function fitZoom(wTiles: number, hTiles: number, view: View): number {
  const fit = Math.min(view.w / ((wTiles - 6) * TILE), view.h / ((hTiles - 4) * TILE));
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fit));
}

/**
 * Quantas casas por linha (pedido do usuário, 02/11/2026): a que deixa a vila ocupar mais da tela na visão geral. Com 5
 * casas numa tela larga, uma linha de 5 em vez de 4 + 1 (que deixava a tela com uma faixa vazia ao lado). Empate:
 * menos lotes vazios, depois menos colunas.
 */
export function chooseCols(n: number, view: View): number {
  let best = { cols: 3, fill: -1, empty: 0 };
  for (let cols = 3; cols <= Math.max(3, n); cols++) {
    const rows = Math.max(1, Math.ceil(n / cols));
    const { w, h } = villageTiles(cols, rows);
    const zoom = fitZoom(w, h, view);
    const fill = Math.min(1, ((w - 6) * TILE * zoom) / view.w) * Math.min(1, ((h - 4) * TILE * zoom) / view.h);
    const empty = cols * rows - n;
    const better = fill > best.fill + 0.01 || (Math.abs(fill - best.fill) <= 0.01 && empty < best.empty);
    if (better) best = { cols, fill, empty };
  }
  return best.cols;
}

export function computeLayout(projects: Project[], view: View = { w: 1600, h: 900 }): Layout {
  const cols = chooseCols(projects.length, view);
  const rows = Math.max(1, Math.ceil(projects.length / cols));
  const { w: vwTiles, h: vhTiles } = villageTiles(cols, rows);
  const zoom = fitZoom(vwTiles, vhTiles, view);
  // Floresta extra em volta para a vila ocupar a tela toda, centralizada, sem fundo vazio (02/11/2026).
  const ox = Math.max(0, Math.ceil((view.w / zoom / TILE - vwTiles) / 2) + 1);
  const oy = Math.max(0, Math.ceil((view.h / zoom / TILE - vhTiles) / 2) + 1);
  const wTiles = vwTiles + ox * 2;
  const hTiles = vhTiles + oy * 2;
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

  const x0 = ox + MARGIN; // primeiro tile da vila depois da floresta
  const y0 = oy + MARGIN;
  const left = x0 - 1;
  const right = ox + vwTiles - MARGIN;
  const midX = ox + Math.floor(vwTiles / 2) - 1;

  // ---- linha cívica ----
  const civicTop = y0;
  const plaza: Rect = { x: midX - 5, y: civicTop + 3, w: 12, h: 7 };
  for (let y = plaza.y; y < plaza.y + plaza.h; y++) for (let x = plaza.x; x < plaza.x + plaza.w; x++) stone.add(key(x, y));
  reserved.push(plaza);
  // Faixa atrás da praça para o outdoor dos guardrails (sem árvore nem flor embaixo dos postes).
  reserved.push({ x: midX - 2, y: civicTop - 1, w: 6, h: plaza.y - civicTop + 1 });
  const civicRoadY = civicTop + CIVIC_H - 2;
  hLine(civicRoadY, left, right);
  vLine(midX, plaza.y + plaza.h, civicRoadY);

  const libraryTile = { x: x0 + 3, y: civicTop + 1 };
  const factoryTile = { x: ox + vwTiles - MARGIN - 10, y: civicTop + 1 };
  reserved.push({ ...libraryTile, w: 7, h: 9 }, { ...factoryTile, w: 7, h: 9 });
  vLine(libraryTile.x + 3, libraryTile.y + 6, civicRoadY);
  vLine(factoryTile.x + 3, factoryTile.y + 7, civicRoadY);

  // ---- lotes das casas ----
  const inRow = (row: number) => Math.min(cols, projects.length - row * cols);
  // Linha incompleta fica no meio, não encostada à esquerda (02/11/2026).
  const rowStart = (row: number) => x0 + ((cols - inRow(row)) * PLOT_W) / 2;
  const rowTop = (row: number) => y0 + CIVIC_H + row * PLOT_H;
  const rowRoad = (row: number) => rowTop(row) + PLOT_H - 2;
  const plots: Plot[] = projects.map((project, i) => {
    const row = Math.floor(i / cols);
    const px = rowStart(row) + (i % cols) * PLOT_W;
    const py = rowTop(row);
    const doorX = px + Math.floor(PLOT_W / 2) - 1;
    const roadY = py + PLOT_H - 2;
    vLine(doorX, py + 6, roadY);
    reserved.push({ x: px + 2, y: py, w: 8, h: 7 });
    return {
      project,
      house: { x: (doorX + 1) * TILE, y: (py + 6) * TILE },
      sign: { x: (doorX - 2) * TILE, y: (py + 7) * TILE },
      yard: { x: (px + 1) * TILE, y: (py + 6) * TILE + 8, w: (PLOT_W - 2) * TILE, h: 2 * TILE },
    };
  });
  for (let r = 0; r < rows; r++) {
    hLine(rowRoad(r), left, right);
    // Estrada que desce da rua de cima até a desta linha, no vão entre dois lotes (nunca por cima de uma casa).
    const gapX = rowStart(r) + Math.floor(inRow(r) / 2) * PLOT_W - 1;
    vLine(gapX, r === 0 ? civicRoadY : rowRoad(r - 1), rowRoad(r));
  }

  return {
    width: wTiles * TILE,
    height: hTiles * TILE,
    cols,
    zoom,
    village: { x: ox, y: oy, w: vwTiles, h: vhTiles },
    dirt,
    stone,
    plots,
    library: { x: (libraryTile.x + 3.5) * TILE, y: (libraryTile.y + 6) * TILE },
    billboard: { x: (plaza.x + plaza.w / 2) * TILE, y: plaza.y * TILE - 2 },
    factory: { x: (factoryTile.x + 3.5) * TILE, y: (factoryTile.y + 7) * TILE },
    fountain: { x: (plaza.x + plaza.w / 2) * TILE, y: (plaza.y + 3) * TILE },
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
