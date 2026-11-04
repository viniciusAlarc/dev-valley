import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';

// PP-2: a biblioteca lê as memórias dos dois perfis do Claude Code. O ~/.claude/projects é calculado ao carregar o
// módulo: o HOME vira uma pasta temporária ANTES do import (como em rotas-fabrica-biblioteca.test.ts).
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-home-'));
process.env.HOME = HOME;
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { Library } = await import('../src/library.js');
const { CLAUDE_PROJECTS_DIR } = await import('../src/config.js');
const { CATALOG_PATH } = await import('../src/catalog.js');
const { casa } = await import('./servidor.js');
type Config = import('../src/config.js').Config;

for (const p of [CLAUDE_PROJECTS_DIR, CATALOG_PATH]) {
  if (!p.startsWith(HOME)) throw new Error(`HOME de teste não pegou: ${p}`);
}

/** Mesmo esquema de nomes do Claude Code (o da library.ts). */
const codificar = (p: string) => p.replace(/[^a-zA-Z0-9-]/g, '-');

function memoria(projectsDir: string, dir: string, texto: string) {
  const base = path.join(projectsDir, dir, 'memory');
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, 'MEMORY.md'), texto);
  return path.join(base, 'MEMORY.md');
}

// O mesmo projeto de mentira tem memória nos dois perfis; uma pasta solta só no de trabalho.
const PROJETO = path.join(HOME, 'Desenvolvimento', 'vila-teste');
const CASA = casa('vila', PROJETO);
const DIR = codificar(PROJETO);
const PESSOAL = path.join(HOME, '.claude-pessoal');
const TRABALHO_MD = memoria(CLAUDE_PROJECTS_DIR, DIR, '# Memória do trabalho\nfarol azul\n');
memoria(CLAUDE_PROJECTS_DIR, codificar(HOME), '# Pasta pessoal\n');
const PESSOAL_MD = memoria(path.join(PESSOAL, 'projects'), DIR, '# Memória pessoal\nfarol verde\n');

const SEM_PERFIL = { libraryRoots: [], perfilPessoal: null } as unknown as Config;
const COM_PERFIL = { libraryRoots: [], perfilPessoal: { roots: [], configDir: PESSOAL } } as unknown as Config;

const memorias = async (config: Config) =>
  (await new Library(config, () => [CASA]).sections(true)).filter((s) => s.kind === 'memory').map(({ id, title, base, projectId }) => ({ id, title, base, projectId }));

describe('Biblioteca: memórias por perfil (PP-2)', () => {
  test('sem perfil pessoal: só as memórias de ~/.claude/projects, com os ids e títulos de sempre', async () => {
    const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
    assert.deepEqual((await memorias(SEM_PERFIL)).sort(porId), [
      { id: `memory:${DIR}`, title: 'Memórias — vila', base: path.join(CLAUDE_PROJECTS_DIR, DIR, 'memory'), projectId: 'vila' },
      { id: `memory:${codificar(HOME)}`, title: 'Memórias — pasta pessoal (~)', base: path.join(CLAUDE_PROJECTS_DIR, codificar(HOME), 'memory'), projectId: undefined },
    ].sort(porId));
  });

  test('com perfil pessoal: as memórias dele entram com id próprio e título do perfil pessoal', async () => {
    const secoes = await memorias(COM_PERFIL);
    assert.equal(secoes.length, 3);
    assert.equal(new Set(secoes.map((s) => s.id)).size, 3, 'ids não colidem');
    assert.deepEqual(secoes.at(-1), {
      id: `memory:pessoal:${DIR}`,
      title: 'Memórias do perfil pessoal — vila',
      base: path.join(PESSOAL, 'projects', DIR, 'memory'),
      projectId: 'vila',
    });
  });

  test('ler, salvar e buscar um livro do perfil pessoal funciona como os outros', async () => {
    const lib = new Library(COM_PERFIL, () => [CASA]);
    const lido = await lib.read(PESSOAL_MD);
    assert.equal(lido?.content, '# Memória pessoal\nfarol verde\n');
    assert.ok('mtime' in ((await lib.write(PESSOAL_MD, '# Memória pessoal\nfarol roxo\n', lido!.mtime)) ?? {}));
    assert.equal(fs.readFileSync(PESSOAL_MD, 'utf8'), '# Memória pessoal\nfarol roxo\n');
    const achados = await lib.search('farol');
    assert.deepEqual(achados.map((r) => [r.path, r.section]).sort(), [
      [PESSOAL_MD, 'Memórias do perfil pessoal — vila'],
      [TRABALHO_MD, 'Memórias — vila'],
    ].sort());
    // Sem o perfil, o livro dele não é da biblioteca: não lê.
    assert.equal(await new Library(SEM_PERFIL, () => [CASA]).read(PESSOAL_MD), null);
  });
});
