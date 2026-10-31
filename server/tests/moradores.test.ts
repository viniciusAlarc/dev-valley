import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generoDoNome } from '../src/moradores.js';

describe('generoDoNome: marca do nome do morador', () => {
  test('feminino, masculino e neutro (ambíguos ficam neutros)', () => {
    assert.equal(generoDoNome('Helena'), 'f');
    assert.equal(generoDoNome('Pedro'), 'm');
    for (const n of ['Rafa', 'Duda', 'Gabi', 'Cacau', 'Juju', 'Jade', 'Zuza']) assert.equal(generoDoNome(n), null, n);
  });

  test('nome repetido com número usa a marca do nome base; nome fora da lista é neutro', () => {
    assert.equal(generoDoNome('Ana2'), 'f');
    assert.equal(generoDoNome('Bento12'), 'm');
    assert.equal(generoDoNome('Desconhecido'), null);
  });
});
