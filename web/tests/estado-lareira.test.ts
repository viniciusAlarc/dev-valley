import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { estadoLareira, type Lado } from '../src/api.js';

const lado = (l: Partial<Lado>): Lado => ({
  lado: 'back',
  pasta: '.',
  cwd: '/tmp/projeto',
  comando: 'npm start',
  porta: 8080,
  ocupada: false,
  pid: null,
  problema: null,
  vila: null,
  ...l,
});

// Os 7 casos da tabela de estados do plano da lareira (docs-dev/context/lareira-subir-sistema.md).
describe('estadoLareira', () => {
  test('apagada: nada ligado', () => {
    assert.equal(estadoLareira({ lados: [lado({}), lado({ lado: 'front' })] }), 'apagada');
  });

  test('acendendo: processo da vila rodando, porta ainda livre', () => {
    assert.equal(estadoLareira({ lados: [lado({ vila: { estado: 'rodando', pid: 1 } })] }), 'acendendo');
  });

  test('acendendo: um lado com a porta ocupada, outro não', () => {
    assert.equal(estadoLareira({ lados: [lado({ ocupada: true }), lado({ lado: 'front' })] }), 'acendendo');
  });

  test('acesa: todas as portas ocupadas, mesmo ligadas fora da vila', () => {
    assert.equal(estadoLareira({ lados: [lado({ ocupada: true, vila: { estado: 'rodando', pid: 1 } }), lado({ lado: 'front', ocupada: true })] }), 'acesa');
  });

  test('erro: lado ligado pela vila saiu com código diferente de 0', () => {
    assert.equal(estadoLareira({ lados: [lado({ ocupada: true }), lado({ lado: 'front', vila: { estado: 'saiu', codigo: 1 } })] }), 'erro');
  });

  test('apagada: a vila apagou (saiu com 0)', () => {
    assert.equal(estadoLareira({ lados: [lado({ vila: { estado: 'saiu', codigo: 0 } })] }), 'apagada');
  });

  test('lados sem comando ou com problema não contam', () => {
    const ignorados = [lado({ comando: null }), lado({ problema: 'pasta não existe', vila: { estado: 'saiu', codigo: 1 } })];
    assert.equal(estadoLareira({ lados: [lado({ ocupada: true }), ...ignorados] }), 'acesa');
  });
});
