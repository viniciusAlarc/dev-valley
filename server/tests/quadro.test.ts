import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import type { Painel } from '../src/painel.js';
import { readQuadro } from '../src/quadro.js';
import { projeto } from './util.js';

type Fase = NonNullable<Painel['plano']>['fases'][number];
const fase = (nome: string, doc: string | null, estado: Fase['estado'] = 'andamento'): Fase => ({ nome, estado, doc, etapas: [] });
const painel = (doc: string | null, fases: Fase[] = []): Painel => ({ plano: { nome: 'Plano', doc, fases }, entregas: [], json: '{}' });

describe('readQuadro (quadro negro da casa)', () => {
  test('sem painel ou sem doc nenhum, o quadro fica vazio', async () => {
    const dir = await projeto({ 'docs-dev/plano.md': '# plano' });
    assert.deepEqual(await readQuadro(dir, null), []);
    assert.deepEqual(await readQuadro(dir, painel(null, [fase('F1', null)])), []);
  });

  test('doc do plano primeiro e o de cada fase depois, em qualquer estado, com caminho absoluto e tipo', async () => {
    const dir = await projeto({
      'docs-dev/plano.html': '<p>plano</p>',
      'docs-dev/f1.md': '# f1',
      'docs-dev/f2.htm': '<p>f2</p>',
      'docs-dev/F3.HTML': '<p>f3</p>',
    });
    const r = await readQuadro(
      dir,
      painel('docs-dev/plano.html', [fase('F1', 'docs-dev/f1.md', 'feito'), fase('Sem doc', null), fase('F2', 'docs-dev/f2.htm', 'a fazer'), fase('F3', 'docs-dev/F3.HTML')]),
    );
    assert.deepEqual(r, [
      { fase: 'Plano', doc: 'docs-dev/plano.html', path: path.join(dir, 'docs-dev/plano.html'), kind: 'html' },
      { fase: 'F1', doc: 'docs-dev/f1.md', path: path.join(dir, 'docs-dev/f1.md'), kind: 'md' },
      { fase: 'F2', doc: 'docs-dev/f2.htm', path: path.join(dir, 'docs-dev/f2.htm'), kind: 'html' },
      { fase: 'F3', doc: 'docs-dev/F3.HTML', path: path.join(dir, 'docs-dev/F3.HTML'), kind: 'html' },
    ]);
  });

  test('fica de fora: arquivo que não existe, pasta, e extensão que não é HTML nem Markdown', async () => {
    const dir = await projeto({ 'docs-dev/notas.txt': 'x', 'docs-dev/dados.json': '{}', 'docs-dev/pasta.md/dentro.md': '# x', 'docs-dev/ok.md': '# ok' });
    const r = await readQuadro(
      dir,
      painel('docs-dev/sumiu.html', [fase('A', 'docs-dev/notas.txt'), fase('B', 'docs-dev/dados.json'), fase('C', 'docs-dev/pasta.md'), fase('D', 'docs-dev/ok.md')]),
    );
    assert.deepEqual(r.map((p) => p.fase), ['D']);
  });

  test('doc fora da pasta do projeto nunca entra, nem por ../ nem por caminho absoluto', async () => {
    const fora = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-valley-fora-'));
    try {
      await fs.writeFile(path.join(fora, 'segredo.md'), '# fora');
      const dir = await projeto({ 'docs-dev/ok.md': '# ok' });
      // Pasta irmã com o mesmo prefixo: `startsWith(base)` sem o separador deixaria passar.
      const irma = `${dir}-irma`;
      await fs.mkdir(irma);
      await fs.writeFile(path.join(irma, 'x.md'), '# irmã');
      try {
        const r = await readQuadro(
          dir,
          painel(path.join(fora, 'segredo.md'), [
            fase('A', path.relative(dir, path.join(fora, 'segredo.md'))),
            fase('B', `../${path.basename(irma)}/x.md`),
            fase('C', 'docs-dev/../docs-dev/ok.md'),
          ]),
        );
        assert.deepEqual(r, [{ fase: 'C', doc: 'docs-dev/../docs-dev/ok.md', path: path.join(dir, 'docs-dev/ok.md'), kind: 'md' }]);
      } finally {
        await fs.rm(irma, { recursive: true, force: true });
      }
    } finally {
      await fs.rm(fora, { recursive: true, force: true });
    }
  });
});
