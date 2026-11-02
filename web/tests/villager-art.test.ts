import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { agentLookFor, lookFor, paletaDo, type Genero, type Look } from '../src/game/villagerArt.js';

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

describe('lookFor: roupa quente no Claude, fria no DeepSeek (decisão do usuário, 02/11/2026)', () => {
  const generos: Genero[] = ['f', 'm', null];
  test('cada peça de roupa sai da paleta do perfil', () => {
    for (const perfil of ['profissional', 'pessoal'] as const) {
      const P = paletaDo(perfil);
      for (const g of generos)
        for (const id of ids) {
          const L = lookFor(id, g, perfil);
          assert.ok(P.shirts.includes(L.shirt.base), `${perfil} camisa ${L.shirt.base}`);
          assert.ok(P.jackets.includes(L.jacket.base), `${perfil} jaqueta ${L.jacket.base}`);
          assert.ok(P.accents.includes(L.accent.base), `${perfil} acessório ${L.accent.base}`);
          if (L.scarf) assert.ok(P.accents.includes(L.scarf.base), `${perfil} lenço ${L.scarf.base}`);
          if (L.outfit !== 'dress') assert.ok(P.pants.includes(L.pants.base), `${perfil} calça ${L.pants.base}`);
        }
    }
  });

  test('as duas paletas não têm cor em comum', () => {
    const q = paletaDo('profissional');
    const f = paletaDo('pessoal');
    const quentes = new Set([...q.shirts, ...q.pants, ...q.accents, ...q.jackets]);
    for (const c of [...f.shirts, ...f.pants, ...f.accents, ...f.jackets]) assert.ok(!quentes.has(c), c);
  });

  test('o perfil não mexe em pele, cabelo, olhos, penteado nem no corte da roupa', () => {
    for (const g of generos)
      for (const id of ids) {
        const a = lookFor(id, g, 'profissional');
        const b = lookFor(id, g, 'pessoal');
        assert.deepEqual([a.skin, a.hair, a.eye, a.style, a.outfit, a.headwear, a.glasses, a.beard, !!a.scarf], [b.skin, b.hair, b.eye, b.style, b.outfit, b.headwear, b.glasses, b.beard, !!b.scarf]);
      }
  });

  test('sem perfil = profissional (Claude)', () => {
    assert.deepEqual(lookFor(ids[2], 'm'), lookFor(ids[2], 'm', 'profissional'));
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
