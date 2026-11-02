import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { UsageRow } from '../src/api.js';
import { ceuDa, estadoTorre, voltaQuando } from '../src/game/torre.js';

const linha = (kind: string, percent: number, severity = 'normal', resetsAt: string | null = null): UsageRow => ({
  kind,
  group: '',
  label: kind,
  percent,
  resetsAt,
  severity,
});
const AGORA = new Date(2026, 10, 2, 10, 0); // segunda, 02/11/2026, 10h

describe('torre do relógio (02/11/2026)', () => {
  test('sem dado: relógio parado, sem céu e sino normal', () => {
    const e = estadoTorre(null, AGORA);
    assert.equal(e.angulo, null);
    assert.equal(e.ceu, null);
    assert.equal(e.sino, 'normal');
  });

  test('ponteiro: sessão de 5h, volta inteira no limite', () => {
    assert.equal(estadoTorre({ rows: [linha('five_hour', 0)], updatedAt: 0 }, AGORA).angulo, 0);
    assert.equal(estadoTorre({ rows: [linha('session', 25)], updatedAt: 0 }, AGORA).angulo, 90);
    assert.equal(estadoTorre({ rows: [linha('five_hour', 140)], updatedAt: 0 }, AGORA).angulo, 360);
  });

  test('céu: manhã, dia, tarde e noite pela semana', () => {
    assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(ceuDa), ['manha', 'manha', 'dia', 'dia', 'tarde', 'tarde', 'noite', 'noite']);
    assert.equal(estadoTorre({ rows: [linha('weekly_all', 80)], updatedAt: 0 }, AGORA).ceu, 'noite');
  });

  test('sino: o pior dos limites, inclusive os semanais por modelo', () => {
    const rows = [linha('five_hour', 10), linha('weekly_all', 20), linha('weekly_opus', 92, 'critical')];
    assert.equal(estadoTorre({ rows, updatedAt: 0 }, AGORA).sino, 'critical');
    assert.equal(estadoTorre({ rows: [linha('five_hour', 80, 'warning')], updatedAt: 0 }, AGORA).sino, 'warning');
  });

  test('texto humano: hora quando volta hoje, dia da semana quando volta outro dia', () => {
    assert.match(voltaQuando(new Date(2026, 10, 2, 14, 30).toISOString(), AGORA), /^volta às 14:30$/);
    assert.equal(voltaQuando(new Date(2026, 10, 5, 9, 0).toISOString(), AGORA), 'volta na quinta');
    assert.equal(voltaQuando(null, AGORA), '');
    const rows = [linha('five_hour', 30, 'normal', new Date(2026, 10, 2, 14, 0).toISOString()), linha('seven_day', 12)];
    assert.match(estadoTorre({ rows, updatedAt: 0 }, AGORA).texto, /5h: 30%, volta às 14:00 · Semana: 12% —/);
  });
});
