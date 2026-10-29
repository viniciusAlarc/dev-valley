import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readPendencias } from '../src/pendencias.js';
import { projeto } from './util.js';

describe('readPendencias (quadro de pendências)', () => {
  test('sem PENDENCIAS.md: null', async () => {
    assert.equal(await readPendencias(await projeto()), null);
  });

  test('prioridade pela seção, com emoji no título e até P6', async () => {
    const dir = await projeto({
      'PENDENCIAS.md': `# Pendências

## 🔴 P1 — Crítico

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-1 | 👤 | Decidir o nome | 2026-10-01 |

## P6 — Ideias

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-2 | 🖥️ | Subir servidor | 2026-10-02 |
| PD-3 | 💻 | Escrever teste | 2026-10-03 |
`,
    });
    assert.deepEqual(await readPendencias(dir), [
      { id: 'PD-1', priority: 1, owner: 'user', item: 'Decidir o nome', openedAt: '2026-10-01' },
      { id: 'PD-2', priority: 6, owner: 'infra', item: 'Subir servidor', openedAt: '2026-10-02' },
      { id: 'PD-3', priority: 6, owner: 'code', item: 'Escrever teste', openedAt: '2026-10-03' },
    ]);
  });

  test('item fechado (ID riscado ou com ✅) não conta', async () => {
    const dir = await projeto({
      'PENDENCIAS.md': `## P2 — Alto

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| ~~PD-1~~ | 💻 | Já feito | 2026-10-01 |
| ✅ PD-2 | 💻 | Também feito | 2026-10-01 |
| **PD-3** | 💻 | Aberto | 2026-10-01 |
`,
    });
    assert.deepEqual((await readPendencias(dir))?.map((p) => p.id), ['PD-3']);
  });

  test('colunas em outra ordem são lidas pelo cabeçalho', async () => {
    const dir = await projeto({
      'PENDENCIAS.md': `## P3 — Médio

| Item | Aberto em | Dono | ID |
|---|---|---|---|
| Trocar ícone | 2026-10-05 | 💻 | PD-9 |
`,
    });
    assert.deepEqual(await readPendencias(dir), [
      { id: 'PD-9', priority: 3, owner: 'code', item: 'Trocar ícone', openedAt: '2026-10-05' },
    ]);
  });

  test('tabela fora de uma seção P não conta', async () => {
    const dir = await projeto({
      'PENDENCIAS.md': `## P4 — Baixo

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-1 | 💻 | Conta | 2026-10-01 |

## Legenda

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-X | 💻 | Não conta | 2026-10-01 |
`,
    });
    assert.deepEqual((await readPendencias(dir))?.map((p) => p.id), ['PD-1']);
  });
});
