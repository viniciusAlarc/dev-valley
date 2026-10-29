import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { markChecked, readProgress, summarizeProgress } from '../src/progress.js';
import { projeto } from './util.js';

const PROGRESS = `# Progresso

## 2026-10-03 — Terceira entrega

Feita. Falta conferir na vila (reinício do
usuário).

## 2026-10-02 — Segunda entrega

Texto que cita a frase "falta conferir na vila" entre aspas.

## 2026-10-01 — Primeira entrega

Falta conferir na vila. Conferido na vila pelo usuário em 02/10/2026.

## Sem data

Nada.
`;

describe('readProgress e summarizeProgress (diário e sino da praça)', () => {
  test('sem PROGRESS.md: null', async () => {
    const dir = await projeto();
    assert.equal(await readProgress(dir), null);
    assert.equal(await summarizeProgress(dir), null);
  });

  test('uma entrega por título, com ou sem data', async () => {
    const entries = await readProgress(await projeto({ 'PROGRESS.md': PROGRESS }));
    assert.deepEqual(
      entries?.map(({ date, title }) => ({ date, title })),
      [
        { date: '2026-10-03', title: 'Terceira entrega' },
        { date: '2026-10-02', title: 'Segunda entrega' },
        { date: '2026-10-01', title: 'Primeira entrega' },
        { date: '', title: 'Sem data' },
      ],
    );
    assert.equal(entries?.[3].body, 'Nada.');
  });

  test('sino: só "Falta conferir" fora de aspas e ainda sem "Conferido"', async () => {
    assert.deepEqual(await summarizeProgress(await projeto({ 'PROGRESS.md': PROGRESS })), {
      entries: 4,
      lastDate: '2026-10-03',
      toCheck: [{ date: '2026-10-03', title: 'Terceira entrega' }],
    });
  });
});

describe('markChecked (sino marca como conferido)', () => {
  test('troca a frase e o parêntese quebrado em duas linhas, só na entrega pedida', async () => {
    const dir = await projeto({ 'PROGRESS.md': PROGRESS });
    const n = await markChecked(dir, [
      { date: '2026-10-03', title: 'Terceira entrega' },
      { date: '2026-10-02', title: 'Segunda entrega' },
    ]);
    assert.equal(n, 1);
    const text = await fs.readFile(path.join(dir, 'PROGRESS.md'), 'utf8');
    assert.match(text, /Feita\. Conferido na vila pelo usuário em \d{2}\/\d{2}\/\d{4}\.\n\n## 2026-10-02/);
    assert.ok(text.includes('"falta conferir na vila" entre aspas'), 'citação entre aspas fica como estava');
    assert.deepEqual((await summarizeProgress(dir))?.toCheck, []);
  });

  test('nada a trocar: arquivo intacto', async () => {
    const dir = await projeto({ 'PROGRESS.md': PROGRESS });
    assert.equal(await markChecked(dir, [{ date: '2026-10-01', title: 'Primeira entrega' }]), 0);
    assert.equal(await fs.readFile(path.join(dir, 'PROGRESS.md'), 'utf8'), PROGRESS);
  });
});
