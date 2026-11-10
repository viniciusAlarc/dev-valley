import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { UsageRow } from '../src/api.js';
import { estadoDosLimites, textoDaClinica, voltaQuando } from '../src/game/limites.js';

const linha = (kind: string, percent: number, severity = 'normal', resetsAt: string | null = null): UsageRow => ({
  kind,
  group: '',
  label: kind,
  percent,
  resetsAt,
  severity,
});
const AGORA = new Date(2026, 10, 2, 10, 0); // segunda, 02/11/2026, 10h

// A cruz da clínica herdou o sino da torre do relógio (09/11/2026).
describe('limites do plano na fachada da clínica', () => {
  test('sem dado: cruz normal e texto dizendo quando aparece', () => {
    assert.deepEqual(estadoDosLimites(null, AGORA), { severidade: 'normal', resumo: '' });
    assert.match(textoDaClinica(null, AGORA), /aparecem depois da primeira resposta/);
  });

  test('cor da cruz: o pior dos limites, inclusive os semanais por modelo', () => {
    const rows = [linha('five_hour', 10), linha('weekly_all', 20), linha('weekly_opus', 92, 'critical')];
    assert.equal(estadoDosLimites({ rows, updatedAt: 0 }, AGORA).severidade, 'critical');
    assert.equal(estadoDosLimites({ rows: [linha('five_hour', 80, 'warning')], updatedAt: 0 }, AGORA).severidade, 'warning');
  });

  test('texto humano: hora quando volta hoje, dia da semana quando volta outro dia', () => {
    assert.match(voltaQuando(new Date(2026, 10, 2, 14, 30).toISOString(), AGORA), /^volta às 14:30$/);
    assert.equal(voltaQuando(new Date(2026, 10, 5, 9, 0).toISOString(), AGORA), 'volta na quinta');
    assert.equal(voltaQuando(null, AGORA), '');
    const rows = [linha('five_hour', 30, 'normal', new Date(2026, 10, 2, 14, 0).toISOString()), linha('seven_day', 12), linha('session', 140)];
    assert.equal(estadoDosLimites({ rows, updatedAt: 0 }, AGORA).resumo, '5h: 30%, volta às 14:00 · Semana: 12%');
    assert.match(textoDaClinica({ rows, updatedAt: 0 }, AGORA), /Limites: 5h: 30%, volta às 14:00 · Semana: 12% — clique para entrar/);
  });
});
