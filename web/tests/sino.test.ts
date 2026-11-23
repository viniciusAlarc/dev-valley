import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bellCount, pendenciasAConferir, type Project, type World } from '../src/api.js';

// Sino em todas as casas (22/11/2026): pendência aberta, dona 👤, que diz "falta … conferir".
const pend = (item: string, owner: 'user' | 'code' | 'infra' | null = 'user') => ({ id: 'X-1', priority: 4, owner, item, openedAt: '' });
const casa = (pendencias: ReturnType<typeof pend>[], toCheck = 0) =>
  ({ pendencias, progress: { entries: 1, lastDate: '', toCheck: Array.from({ length: toCheck }, (_, i) => ({ date: '', title: `e${i}` })) } }) as unknown as Project;

describe('pendências que esperam conferência', () => {
  test('pega as redações dos repositórios', () => {
    const p = casa([
      pend('**Telas codadas em 20/11, falta conferir na tela.** Detalhe'),
      pend('Quarto codado. Falta: reiniciar a vila e conferir (porta na sala)'),
      pend('Tela nova, falta a conferência na interface'),
    ]);
    assert.equal(pendenciasAConferir(p).length, 3);
  });

  test('deixa de fora o que não é conferência do usuário', () => {
    const p = casa([
      pend('falta conferir na tela', 'code'),
      pend('Decidir o motivo do desligamento'),
      pend('Conferido na tela em 20/11; falta só o commit. Depois conferir o deploy'),
    ]);
    assert.deepEqual(pendenciasAConferir(p), []);
  });

  test('o sino soma entregas e pendências de todas as casas', () => {
    const world = { projects: [casa([pend('falta conferir na tela')], 2), casa([pend('falta conferir no navegador')])], restart: { server: false, web: false } } as unknown as World;
    assert.equal(bellCount(world), 4);
  });
});
