import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { readRelatorios, RelatoriosLidos } from '../src/relatorios.js';
import { casa, subir } from './servidor.js';
import { projeto } from './util.js';

// Relatórios do maestro (MA-1, fase 4; estante de partitura do porão desde 04/11/2026): os `.md` de `docs-dev/maestro/`, o mais
// novo primeiro. O caso feliz básico está em `porao.test.ts`; aqui ficam as bordas e o "novo até abrir".

const nomes = (r: Awaited<ReturnType<typeof readRelatorios>>) => r?.map((x) => path.basename(x.path));

describe('readRelatorios: o que entra no quadro', () => {
  test('pasta vazia dá lista vazia (não null): o projeto tem o porão, só não tem rodada fechada', async () => {
    const dir = await projeto();
    await fs.mkdir(path.join(dir, 'docs-dev', 'maestro'), { recursive: true });
    assert.deepEqual(await readRelatorios(dir), []);
  });

  test('sem docs-dev/maestro, null (inclusive com docs-dev existindo)', async () => {
    assert.equal(await readRelatorios(await projeto({ 'docs-dev/painel.json': '{}' })), null);
  });

  test('só arquivo .md: outras extensões e subpasta (mesmo com nome .md) ficam de fora', async () => {
    const dir = await projeto({
      'docs-dev/maestro/2026-11-01-a.md': '# A\n',
      'docs-dev/maestro/2026-11-02-b.txt': '# B\n',
      'docs-dev/maestro/notas.json': '{}',
      'docs-dev/maestro/rascunho.md/dentro.md': '# Dentro\n',
      'docs-dev/maestro/antigos/2026-10-01-c.md': '# C\n',
    });
    assert.deepEqual(nomes(await readRelatorios(dir)), ['2026-11-01-a.md']);
  });

  test('ordem pelo nome, decrescente: a data no começo põe o mais novo em cima, e no mesmo dia o assunto desempata', async () => {
    const dir = await projeto({
      'docs-dev/maestro/2026-10-31-x.md': '# X\n',
      'docs-dev/maestro/2026-11-03-a.md': '# A\n',
      'docs-dev/maestro/2026-11-03-b.md': '# B\n',
      'docs-dev/maestro/2026-11-01-y.md': '# Y\n',
    });
    assert.deepEqual(nomes(await readRelatorios(dir)), [
      '2026-11-03-b.md',
      '2026-11-03-a.md',
      '2026-11-01-y.md',
      '2026-10-31-x.md',
    ]);
  });

  test('path é absoluto e aponta para o arquivo dentro do projeto (o leitor da biblioteca abre por ele)', async () => {
    const dir = await projeto({ 'docs-dev/maestro/2026-11-03-a.md': '# A\n' });
    const [r] = (await readRelatorios(dir)) ?? [];
    assert.equal(r.path, path.join(dir, 'docs-dev', 'maestro', '2026-11-03-a.md'));
    assert.ok(path.isAbsolute(r.path));
  });
});

describe('readRelatorios: título e data', () => {
  const tituloDe = async (texto: string, nome = '2026-11-03-assunto.md') => {
    const dir = await projeto({ [`docs-dev/maestro/${nome}`]: texto });
    return (await readRelatorios(dir))?.[0];
  };

  test('o primeiro "# " do arquivo, mesmo depois de outras linhas; "## " não conta', async () => {
    assert.equal((await tituloDe('---\nrodada: x\n---\n## Seção\n# Título de verdade\n# Outro\n'))?.title, 'Título de verdade');
  });

  test('espaço sobrando em volta do título sai', async () => {
    assert.equal((await tituloDe('#    Porão   \n'))?.title, 'Porão');
  });

  test('"Rodada:" do modelo sai em qualquer caixa, só no começo', async () => {
    assert.equal((await tituloDe('# RODADA:   testes dos módulos\n'))?.title, 'testes dos módulos');
    assert.equal((await tituloDe('# Fim da Rodada: x\n'))?.title, 'Fim da Rodada: x');
  });

  test('sem título (arquivo vazio, só "## ", ou "# Rodada:" sozinho), vale o nome do arquivo sem .md', async () => {
    assert.equal((await tituloDe(''))?.title, '2026-11-03-assunto');
    assert.equal((await tituloDe('## Só subtítulo\ntexto\n'))?.title, '2026-11-03-assunto');
    assert.equal((await tituloDe('# Rodada:\n'))?.title, '2026-11-03-assunto');
  });

  test('data só quando o nome começa com AAAA-MM-DD', async () => {
    assert.equal((await tituloDe('# A\n', '2026-11-03-a.md'))?.data, '2026-11-03');
    assert.equal((await tituloDe('# A\n', '2026-11-03.md'))?.data, '2026-11-03');
    assert.equal((await tituloDe('# A\n', 'rodada-2026-11-03.md'))?.data, null);
    assert.equal((await tituloDe('# A\n', '2026-1-3-a.md'))?.data, null);
  });
});

describe('RelatoriosLidos: "novo" até o usuário abrir', () => {
  test('sem o arquivo, nada lido; marcar grava, não repete e o readRelatorios passa a dizer lido', async () => {
    const dir = await projeto({ 'docs-dev/maestro/2026-11-01-a.md': '# a', 'docs-dev/maestro/2026-11-02-b.md': '# b' });
    const lidos = new RelatoriosLidos(path.join(await projeto({}), 'sub', 'lidos.json'));
    assert.equal((await lidos.lidos()).size, 0);
    const [b, a] = (await readRelatorios(dir, await lidos.lidos())) ?? [];
    assert.deepEqual([a?.lido, b?.lido], [false, false]);
    await lidos.marcar(a!.path);
    await lidos.marcar(a!.path);
    assert.deepEqual([...(await lidos.lidos())], [a!.path]);
    const depois = (await readRelatorios(dir, await lidos.lidos())) ?? [];
    assert.deepEqual(depois.map((r) => [path.basename(r.path), r.lido]), [['2026-11-02-b.md', false], ['2026-11-01-a.md', true]]);
  });

  test('arquivo estragado ou com lixo vale como nada lido, sem quebrar o mundo', async () => {
    const base = await projeto({ 'ruim.json': '{', 'lixo.json': '{"lidos":[1,null,"/x.md"]}' });
    assert.equal((await new RelatoriosLidos(path.join(base, 'ruim.json')).lidos()).size, 0);
    assert.deepEqual([...(await new RelatoriosLidos(path.join(base, 'lixo.json')).lidos())], ['/x.md']);
  });
});

describe('POST /api/relatorios/lido', () => {
  const PAGINA = 'http://localhost:4777';

  async function vila() {
    const dir = await projeto({});
    const rel = { path: path.join(dir, 'docs-dev', 'maestro', '2026-11-03-x.md'), title: 'x', data: '2026-11-03', lido: false };
    const marcados: string[] = [];
    const s = await subir(
      { projects: [casa('p', dir, { relatorios: [rel, { ...rel, path: rel.path.replace('-x', '-y'), lido: true }] }), casa('q', dir + '-outro')] },
      { relatoriosLidos: { marcar: async (c: string) => void marcados.push(c) } },
    );
    return { s, rel, marcados };
  }

  test('pela página, marca o relatório listado; o já lido não grava de novo', async () => {
    const { s, rel, marcados } = await vila();
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'p', path: rel.path }, PAGINA)).status, 200);
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'p', path: rel.path.replace('-x', '-y') }, PAGINA)).status, 200);
    assert.deepEqual(marcados, [rel.path]);
  });

  test('sem origem ou de outra origem: 403; caminho que não é relatório do projeto, ou de outro projeto: 404', async () => {
    const { s, rel, marcados } = await vila();
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'p', path: rel.path })).status, 403);
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'p', path: rel.path }, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'p', path: '/etc/passwd' }, PAGINA)).status, 404);
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'q', path: rel.path }, PAGINA)).status, 404);
    assert.equal((await s.enviar('POST', '/api/relatorios/lido', { projectId: 'nenhum', path: rel.path }, PAGINA)).status, 404);
    assert.deepEqual(marcados, []);
  });
});
