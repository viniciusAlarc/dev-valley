import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { horaDoBastao, type Session } from '../src/api.js';

// Passagem de bastão (BT-1, decisão do usuário de 08/11/2026): aviso a partir de 70%, só em sessão comum aberta pela vila.
const sessao = (percent: number | null, extra: Partial<Session> = {}) =>
  ({ inTown: true, porao: null, context: percent === null ? null : { percent, tokens: 0, window: 0, estimated: false }, ...extra }) as Session;

describe('hora do bastão', () => {
  test('a partir de 70%', () => {
    assert.equal(horaDoBastao(sessao(69)), false);
    assert.equal(horaDoBastao(sessao(70)), true);
    assert.equal(horaDoBastao(sessao(null)), false);
  });

  test('só sessão comum aberta pela vila', () => {
    assert.equal(horaDoBastao(sessao(90, { inTown: false })), false);
    assert.equal(horaDoBastao(sessao(90, { porao: { papel: 'maestro' } })), false);
  });
});
