import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { comparacao, fatia, numeroCurto, ritmo, voltaDasPas } from '../src/ui/gasto-texto.js';

describe('moinho: textos em linguagem de gente (02/11/2026)', () => {
  test('ritmo desconta quanto da semana já passou', () => {
    assert.equal(ritmo(50, 100, 0.5), 1);
    assert.equal(ritmo(10, 0, 0.5), null);
  });

  test('comparação em frases, sem número cru', () => {
    assert.equal(comparacao(100, 100, 1), 'Ritmo parecido com o da semana passada.');
    assert.equal(comparacao(100, 50, 1), 'Ritmo dobrado em relação à semana passada.');
    assert.equal(comparacao(300, 100, 1), 'Ritmo 3 vezes maior que o da semana passada.');
    assert.equal(comparacao(130, 100, 1), 'Ritmo 30% maior que o da semana passada.');
    assert.equal(comparacao(50, 100, 1), 'Ritmo pela metade em relação à semana passada.');
    assert.equal(comparacao(20, 100, 1), 'Ritmo 80% menor que o da semana passada.');
    assert.equal(comparacao(10, 0, 0.3), 'Sem registro da semana passada para comparar.');
  });

  test('pás: paradas sem gasto, 6 s no mesmo ritmo, mais rápidas com ritmo maior e com limites', () => {
    assert.equal(voltaDasPas(0, 100, 0.5), 0);
    assert.equal(voltaDasPas(50, 100, 0.5), 6000);
    assert.equal(voltaDasPas(200, 100, 0.5), 1500);
    assert.equal(voltaDasPas(1, 1000, 1), 16000);
  });

  test('fatia e número curto', () => {
    assert.equal(fatia(45, 100), '45%');
    assert.equal(fatia(1, 1000), 'menos de 1%');
    assert.equal(numeroCurto(1_380_448), '1,4 mi');
    assert.equal(numeroCurto(237_048), '237 mil');
  });
});
