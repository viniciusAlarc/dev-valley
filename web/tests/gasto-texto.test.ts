import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { comparacao, faltam, fatia, numeroCurto, projecao, ritmo, voltaDasPas } from '../src/ui/gasto-texto.js';

describe('moinho: textos em linguagem de gente (02/11/2026)', () => {
  test('ritmo desconta quanto da semana já passou', () => {
    assert.equal(ritmo(50, 100, 0.5), 1);
    assert.equal(ritmo(10, 0, 0.5), null);
  });

  test('comparação: título curto, sem número cru', () => {
    assert.equal(comparacao(100, 100, 1), 'No mesmo ritmo da semana passada.');
    assert.equal(comparacao(130, 100, 1), 'Gastando mais rápido que na semana passada.');
    assert.equal(comparacao(20, 100, 1), 'Gastando mais devagar que na semana passada.');
    assert.equal(comparacao(10, 0, 0.3), 'Sem registro da semana passada para comparar.');
    assert.equal(comparacao(0, 0, 0.3), 'Nada gasto ainda nesta semana.');
  });

  test('projeção diz como a semana fecha, descontando o que já passou', () => {
    assert.equal(projecao(70, 100, 0.5), 'No ritmo de agora, esta semana fecha em 1,4× o que foi a anterior.');
    assert.equal(projecao(300, 100, 1), 'No ritmo de agora, esta semana fecha em 3× o que foi a anterior.');
    assert.equal(projecao(50, 100, 0.5), 'No ritmo de agora, esta semana fecha perto do que foi a anterior.');
    assert.equal(projecao(10, 100, 0.5), 'No ritmo de agora, esta semana fecha em 20% do que foi a anterior.');
    assert.equal(projecao(10, 0, 0.5), '');
  });

  test('quanto falta para a semana virar', () => {
    const h = 3_600_000;
    assert.equal(faltam(50 * h, 0), 'faltam 2 dias');
    assert.equal(faltam(30 * h, 0), 'falta 1 dia');
    assert.equal(faltam(5.5 * h, 0), 'termina em 5 h');
    assert.equal(faltam(10, 0), 'termina em menos de 1 h');
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
