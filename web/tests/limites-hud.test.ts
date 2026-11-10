import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { linhasDaMaquina, linhasDosLimites } from '../src/ui/limites-texto.js';

describe('canto inferior esquerdo: limites e máquina (09/11/2026)', () => {
  test('limites do Claude viram 5h e 7d nos chips', () => {
    const usage = {
      updatedAt: 0,
      rows: [
        { kind: 'five_hour', group: '', label: 'Sessão atual', percent: 30.4, severity: 'normal', resetsAt: null },
        { kind: 'seven_day', group: '', label: 'Semana', percent: 91, severity: 'critical', resetsAt: null },
      ],
    } as any;
    assert.deepEqual(linhasDosLimites(usage).map((l) => [l.curto, l.percent, l.sev]), [['5h', 30, 'normal'], ['7d', 91, 'critical']]);
    assert.deepEqual(linhasDosLimites(null), []);
  });

  test('máquina usa os limiares de aviso e pula swap zerada', () => {
    const l = linhasDaMaquina({ memoria: { totalMb: 1000, usadaMb: 900 }, swap: { totalMb: 0, usadaMb: 0 }, carga: { umMinuto: 1, cpus: 4 }, disco: { totalGb: 100, livreGb: 2 } });
    assert.deepEqual(l.map((x) => [x.curto, Math.round(x.percent), x.sev]), [['Mem', 90, 'warning'], ['CPU', 25, 'normal'], ['Disco', 98, 'critical']]);
    assert.deepEqual(linhasDaMaquina(null), []);
  });
});
