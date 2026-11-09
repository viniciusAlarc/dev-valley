import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BALAO_ICONE, ICONES, PALETA_ICONE, posicaoDoIcone } from '../src/game/iconesBalao.js';

// Ícones do balão de quem trabalha (08/11/2026): cabem no miolo, sem encostar na borda, e só usam a paleta.
describe('ícones do balão', () => {
  test('uma categoria para cada atividade que o mod manda', () => {
    assert.deepEqual(Object.keys(ICONES).sort(), ['agente', 'editar', 'ler', 'rodar', 'web']);
  });

  for (const [nome, icone] of Object.entries(ICONES)) {
    test(`${nome}: cabe no miolo com folga e só usa cores da paleta`, () => {
      const w = Math.max(...icone.map((l) => l.length));
      const { x, y } = posicaoDoIcone(icone);
      assert.ok(x >= 1 && x + w <= BALAO_ICONE.w - 1, `largura ${w}`);
      assert.ok(y >= 0 && y + icone.length <= BALAO_ICONE.miolo, `altura ${icone.length}`);
      for (const c of icone.join('')) assert.ok(c === '.' || c in PALETA_ICONE, `cor ${c}`);
    });
  }
});
