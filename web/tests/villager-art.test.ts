import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { agentLookFor, lookFor, type Genero, type Look } from '../src/game/villagerArt.js';

// Ids no formato de verdade (UUID), gerados de forma fixa para o teste não variar.
const ids = Array.from({ length: 600 }, (_, i) => `${i.toString(16).padStart(8, '0')}-4a1b-4c2d-8e3f-${(i * 7919).toString(16).padStart(12, '0')}`);
const todos = (genero: Genero): Look[] => ids.map((id) => lookFor(id, genero));

describe('lookFor: aparência combina com a marca do nome (decisão do usuário, 31/10/2026)', () => {
  test('nome feminino: nunca barba nem bigode; penteados da lista feminina', () => {
    for (const L of todos('f')) {
      assert.equal(L.beard, null);
      assert.ok(['long', 'bob', 'bun', 'ponytail', 'braids', 'curly', 'sidepart'].includes(L.style), L.style);
    }
  });

  test('nome masculino: nunca vestido nem laço; penteados da lista masculina', () => {
    for (const L of todos('m')) {
      assert.notEqual(L.outfit, 'dress');
      assert.notEqual(L.headwear, 'bow');
      assert.ok(['short', 'spiky', 'buzz', 'curly', 'sidepart'].includes(L.style), L.style);
    }
  });

  test('nome neutro pode tudo: aparecem barba, vestido e laço', () => {
    const n = todos(null);
    assert.ok(n.some((L) => L.beard));
    assert.ok(n.some((L) => L.outfit === 'dress'));
    assert.ok(n.some((L) => L.headwear === 'bow'));
  });

  test('chapéu, boné e gorro nunca com penteado que sairia por cima; vestido deixa as pernas na cor da pele', () => {
    for (const L of [...todos('f'), ...todos('m'), ...todos(null)]) {
      if (L.headwear && ['straw', 'cap', 'beanie'].includes(L.headwear)) assert.ok(!['bun', 'spiky', 'curly'].includes(L.style), L.style);
      if (L.outfit === 'dress') assert.equal(L.pants, L.skin);
    }
  });

  test('mesmo id e mesma marca: sempre a mesma aparência', () => {
    assert.deepEqual(lookFor(ids[1], 'f'), lookFor(ids[1], 'f'));
  });
});

describe('agentLookFor: traje de agente secreto (regra 8)', () => {
  test('sem acessório, barba, óculos de grau nem roupa variada', () => {
    for (const id of ids.slice(0, 30)) {
      const L = agentLookFor(`agente-${id}`);
      assert.deepEqual([L.agent, L.style, L.outfit, L.headwear, L.glasses, L.scarf, L.beard], [true, 'short', 'plain', null, null, null, null]);
    }
  });
});
