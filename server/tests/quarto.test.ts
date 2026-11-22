import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { Quarto } from '../src/quarto.js';
import { listSessions } from '../src/sessions.js';
import { projeto } from './util.js';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

describe('quarto da casa (21/11/2026)', () => {
  it('dormir, acordar e esquecer quem não existe mais; grava no arquivo e lê de volta', async () => {
    const file = path.join(await projeto(), 'sub', 'dormindo.json');
    const q = new Quarto(file);
    assert.deepEqual([...(await q.ids())], []);
    await q.dormir([A, B]);
    assert.deepEqual([...(await new Quarto(file).ids())].sort(), [A, B]);
    assert.equal(await q.acordar([A]), true);
    assert.equal(await q.acordar([A]), false);
    await q.manter(new Set([A]));
    assert.deepEqual([...(await new Quarto(file).ids())], []);
  });

  it('arquivo estragado vale como quarto vazio', async () => {
    const dir = await projeto({ 'dormindo.json': '{ não é json' });
    assert.deepEqual([...(await new Quarto(path.join(dir, 'dormindo.json')).ids())], []);
  });

  it('quem dorme entra na lista de sessões mesmo mais velho que o prazo da vila', async () => {
    const linha = JSON.stringify({ type: 'user', cwd: '/x/app', message: { role: 'user', content: 'oi' } }) + '\n';
    const root = await projeto({ [`p/${A}.jsonl`]: linha, [`p/${B}.jsonl`]: linha });
    const velho = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    for (const id of [A, B]) await fs.utimes(path.join(root, 'p', `${id}.jsonl`), velho, velho);
    assert.deepEqual((await listSessions(14, [root])).map((s) => s.id), []);
    assert.deepEqual((await listSessions(14, [root], new Set([B]))).map((s) => s.id), [B]);
  });
});
