import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { missingStructure, readAuditoria } from '../src/estrutura.js';
import { readPainel } from '../src/painel.js';
import { readRetrabalho } from '../src/retrabalho.js';
import { projeto } from './util.js';

describe('readPainel (painel.json do G14)', () => {
  test('sem arquivo ou JSON inválido: null', async () => {
    assert.equal(await readPainel(await projeto()), null);
    assert.equal(await readPainel(await projeto({ 'docs-dev/painel.json': '{ quebrado' })), null);
  });

  test('estado desconhecido vira "a fazer", doc vazio vira null, etapas em níveis', async () => {
    const painel = await readPainel(
      await projeto({
        'docs-dev/painel.json': JSON.stringify({
          plano: {
            nome: 'Plano',
            doc: '',
            fases: [
              { nome: 'A', estado: 'feito', doc: 'docs-dev/a.md' },
              { nome: 'B', estado: 'pausado', etapas: [{ nome: 'B1', estado: 'andamento', etapas: [{ nome: 'B1a' }] }] },
            ],
          },
          entregas: [{ data: '2026-10-01', o_que: 'Algo', como: 'Assim', extra: 1 }],
        }),
      }),
    );
    assert.deepEqual(painel?.plano, {
      nome: 'Plano',
      doc: null,
      fases: [
        { nome: 'A', estado: 'feito', doc: 'docs-dev/a.md', etapas: [] },
        {
          nome: 'B',
          estado: 'a fazer',
          doc: null,
          etapas: [{ nome: 'B1', estado: 'andamento', etapas: [{ nome: 'B1a', estado: 'a fazer', etapas: [] }] }],
        },
      ],
    });
    assert.deepEqual(painel?.entregas, [{ data: '2026-10-01', o_que: 'Algo', como: 'Assim' }]);
  });

  test('sem plano: plano null, entregas vazias', async () => {
    const painel = await readPainel(await projeto({ 'docs-dev/painel.json': '{}' }));
    assert.equal(painel?.plano, null);
    assert.deepEqual(painel?.entregas, []);
  });
});

describe('readRetrabalho (ervas do quintal)', () => {
  test('sem arquivo: null', async () => {
    assert.equal(await readRetrabalho(await projeto()), null);
  });

  test('cabeçalho como está e uma linha por retrabalho, sem separador nem linha vazia', async () => {
    const dir = await projeto({
      'RETRABALHO.md': `# Retrabalho

| Data | Causa | Extra |
|:---|---|---:|
| 2026-10-01 | Assumi o formato | x |
|  |  |  |
| 02/10 | Render à toa | |
`,
    });
    assert.deepEqual(await readRetrabalho(dir), {
      header: ['Data', 'Causa', 'Extra'],
      rows: [
        ['2026-10-01', 'Assumi o formato', 'x'],
        ['02/10', 'Render à toa', ''],
      ],
    });
  });
});

describe('missingStructure e readAuditoria (casa em obra e placa de vistoria)', () => {
  test('lista o que falta, na ordem da estrutura', async () => {
    const dir = await projeto({ 'CLAUDE.md': '', 'PROGRESS.md': '' });
    assert.deepEqual(await missingStructure(dir), ['PENDENCIAS.md', 'docs-dev/painel.json', 'scripts/auditar-referencias.py']);
  });

  test('data da auditoria: a primeira linha só com data', async () => {
    assert.equal(await readAuditoria(await projeto()), null);
    assert.equal(await readAuditoria(await projeto({ '.claude/auditoria-regras.txt': 'próxima auditoria\n2026-11-30\n' })), '2026-11-30');
    assert.equal(await readAuditoria(await projeto({ '.claude/auditoria-regras.txt': 'em 2026-11-30\n' })), null);
  });
});
