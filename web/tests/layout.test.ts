import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Project } from '../src/api.js';
import { chooseCols, computeLayout, TILE } from '../src/game/layout.js';

const casas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}` }) as Project);
const LARGA = { w: 1920, h: 1000 };
const ESTREITA = { w: 900, h: 1000 };

describe('layout da vila ocupa a tela (pedido do usuário, 02/11/2026)', () => {
  test('5 casas numa tela larga ficam numa linha só; numa estreita, quebram em linhas', () => {
    assert.equal(chooseCols(5, LARGA), 5);
    assert.ok(chooseCols(5, ESTREITA) < 5);
    assert.equal(chooseCols(1, LARGA), 3, 'a linha cívica precisa de pelo menos 3 lotes de largura');
  });

  test('a vila enquadrada preenche a largura ou a altura inteira da tela', () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const l = computeLayout(casas(n), LARGA);
      const usadoW = (l.village.w - 6) * TILE * l.zoom;
      const usadoH = (l.village.h - 4) * TILE * l.zoom;
      assert.ok(Math.max(usadoW / LARGA.w, usadoH / LARGA.h) > 0.97, `${n} casas`);
    }
  });

  test('o mundo cobre a tela toda no zoom da visão geral, com a vila no centro', () => {
    for (const view of [LARGA, ESTREITA]) {
      const l = computeLayout(casas(5), view);
      assert.ok(l.width * l.zoom >= view.w && l.height * l.zoom >= view.h, 'sem fundo vazio fora do mapa');
      assert.equal(l.village.x * 2 + l.village.w, l.width / TILE);
      assert.equal(l.village.y * 2 + l.village.h, l.height / TILE);
    }
  });

  test('linha incompleta fica centralizada', () => {
    const l = computeLayout(casas(7), { w: 1200, h: 1000 });
    const ultima = l.plots.slice(l.cols * Math.floor(6 / l.cols));
    const primeira = l.plots.slice(0, l.cols);
    const meio = (ps: typeof l.plots) => (ps[0]!.house.x + ps[ps.length - 1]!.house.x) / 2;
    assert.ok(ultima.length < l.cols);
    assert.equal(meio(ultima), meio(primeira));
  });

  test('nenhuma estrada passa por cima de uma casa', () => {
    for (const [n, view] of [[3, LARGA], [5, LARGA], [5, ESTREITA], [7, { w: 1200, h: 1000 }], [10, LARGA]] as const) {
      const l = computeLayout(casas(n), view);
      for (const p of l.plots) {
        // a casa ocupa ~6 tiles de largura e ~5 de altura acima da âncora (porta)
        const cx = p.house.x / TILE;
        const base = p.house.y / TILE;
        for (let y = base - 5; y < base; y++)
          for (let x = Math.floor(cx - 3); x < cx + 3; x++) assert.ok(!l.dirt.has(`${x},${y}`), `${n} casas: estrada em ${x},${y}`);
      }
    }
  });

  test('linha cívica: torre, banca e moinho cabem entre biblioteca, praça e Fábrica sem se encostar (02/11/2026)', () => {
    for (const [n, view] of [[1, LARGA], [3, ESTREITA], [5, LARGA], [10, LARGA]] as const) {
      const l = computeLayout(casas(n), view);
      // largura em tiles de cada peça, em volta da âncora (x no centro)
      const pecas = [
        ['biblioteca', l.library.x, 7],
        ['torre', l.clockTower.x, 4],
        ['praça', l.plaza.x + l.plaza.w / 2, l.plaza.w / TILE],
        ['banca', l.newsstand.x, 5],
        ['moinho', l.windmill.x, 6],
        ['Fábrica', l.factory.x, 7],
      ] as const;
      for (let i = 1; i < pecas.length; i++) {
        const [a, ax, aw] = pecas[i - 1]!;
        const [b, bx, bw] = pecas[i]!;
        assert.ok(bx / TILE - bw / 2 >= ax / TILE + aw / 2 + 1, `${n} casas: ${a} encosta em ${b}`);
      }
    }
  });

  test('com poucas casas, a linha de casas fica no meio da vila', () => {
    const l = computeLayout(casas(2), LARGA);
    const meio = (l.plots[0]!.house.x + l.plots[1]!.house.x) / 2;
    assert.equal(meio / TILE, l.village.x + l.village.w / 2);
  });
});
