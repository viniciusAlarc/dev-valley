import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { projeto } from './util.js';

// PD-8, passo 2: rotas da Fábrica (agentes e skills) e da biblioteca com as classes DE VERDADE, para o teste conferir a
// trava que recusa caminho de fora (G9), não uma imitação dela. Elas calculam ~/.claude ao carregar o módulo: o HOME
// vira uma pasta temporária ANTES do import, e só este arquivo (o node:test roda cada arquivo num processo) o enxerga.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-home-'));
process.env.HOME = HOME;
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { Agents, GLOBAL_AGENTS_DIR } = await import('../src/agents.js');
const { Skills, GLOBAL_SKILLS_DIR } = await import('../src/skills.js');
const { Library } = await import('../src/library.js');
const { CATALOG_PATH } = await import('../src/catalog.js');
const { casa, subir } = await import('./servidor.js');
type Project = import('../src/world.js').Project;
type Config = import('../src/config.js').Config;

// Nenhuma escrita acontece se a troca não pegou: tudo que a vila grava em ~ tem que cair na pasta temporária.
for (const p of [os.homedir(), GLOBAL_AGENTS_DIR, GLOBAL_SKILLS_DIR, CATALOG_PATH]) {
  if (!p.startsWith(HOME)) throw new Error(`HOME de teste não pegou: ${p}`);
}

const FORMULARIO = { description: 'Ajuda em algo', instructions: 'Faça assim.' };
const AGENTE_DA_VILA = path.resolve(import.meta.dirname, '../agents/bibliotecaria.md');

/** Vila com a Fábrica de verdade sobre os projetos dados. */
async function fabrica(projects: Project[], extra = {}) {
  return subir({ projects }, { agents: new Agents(() => projects), skills: new Skills(() => projects), refreshWorld: async () => {}, ...extra });
}

describe('Agentes: /api/agents', () => {
  test('criar: no projeto e global; descrição vazia, nome ruim ou projeto desconhecido: 400', async () => {
    const dir = await projeto();
    const s = await fabrica([casa('p', dir)]);
    const noProjeto = await s.enviar('POST', '/api/agents', { projectId: 'p', name: 'revisor', ...FORMULARIO });
    assert.deepEqual(await noProjeto.json(), { path: path.join(dir, '.claude/agents/revisor.md') });
    const global = await s.enviar('POST', '/api/agents', { projectId: null, name: 'revisor', ...FORMULARIO });
    assert.deepEqual(await global.json(), { path: path.join(GLOBAL_AGENTS_DIR, 'revisor.md') });
    assert.equal((await s.enviar('POST', '/api/agents', { projectId: 'p', name: 'outro', description: ' ', instructions: '' })).status, 400);
    assert.equal((await s.enviar('POST', '/api/agents', { projectId: 'p', name: '../fora', ...FORMULARIO })).status, 400);
    assert.equal((await s.enviar('POST', '/api/agents', { projectId: 'x', name: 'outro', ...FORMULARIO })).status, 400);
    assert.equal((await s.enviar('POST', '/api/agents', { projectId: 'p', name: 'revisor', ...FORMULARIO })).status, 400, 'já existe');
  });

  test('ler, salvar e apagar: só arquivo das pastas de agentes; fora delas, 404', async () => {
    const dir = await projeto({ '.claude/agents/revisor.md': '---\nname: revisor\ndescription: x\n---\n\nAntes.\n', 'solto.md': '# x' });
    const s = await fabrica([casa('p', dir)]);
    const arquivo = path.join(dir, '.claude/agents/revisor.md');
    const lido = await (await s.get(`/api/agents/file?path=${encodeURIComponent(arquivo)}`)).json();
    assert.equal(lido.instructions, 'Antes.');
    for (const fora of [path.join(dir, 'solto.md'), path.join(dir, '.claude/agents/../../solto.md'), '/etc/passwd', 'revisor.md']) {
      assert.equal((await s.get(`/api/agents/file?path=${encodeURIComponent(fora)}`)).status, 404, fora);
      assert.equal((await s.enviar('PUT', '/api/agents', { path: fora, mtime: 0, ...FORMULARIO })).status, 404, fora);
      assert.equal((await s.enviar('DELETE', `/api/agents?path=${encodeURIComponent(fora)}`)).status, 404, fora);
    }
    assert.equal(fs.readFileSync(path.join(dir, 'solto.md'), 'utf8'), '# x');

    assert.equal((await s.enviar('PUT', '/api/agents', { path: arquivo, mtime: lido.mtime - 5000, ...FORMULARIO })).status, 409, 'mudou no disco');
    assert.equal((await s.enviar('PUT', '/api/agents', { path: arquivo, mtime: lido.mtime, description: '' })).status, 400);
    assert.equal((await s.enviar('PUT', '/api/agents', { path: arquivo, mtime: lido.mtime, ...FORMULARIO })).status, 200);
    assert.match(fs.readFileSync(arquivo, 'utf8'), /Faça assim\./);
    assert.equal((await s.enviar('DELETE', `/api/agents?path=${encodeURIComponent(arquivo)}`)).status, 200);
    assert.equal(fs.existsSync(arquivo), false);
  });

  test('agente do Dev Valley (cópia instalada) não é salvo nem apagado pela Fábrica: 403', async () => {
    const copia = path.join(GLOBAL_AGENTS_DIR, 'bibliotecaria.md');
    fs.mkdirSync(GLOBAL_AGENTS_DIR, { recursive: true });
    fs.writeFileSync(copia, '---\nname: bibliotecaria\ndescription: x\n---\n<!-- dev-valley: gerenciado -->\nTexto.\n');
    const s = await fabrica([]);
    const { mtime } = await (await s.get(`/api/agents/file?path=${encodeURIComponent(copia)}`)).json();
    assert.equal((await s.enviar('PUT', '/api/agents', { path: copia, mtime, ...FORMULARIO })).status, 403);
    assert.equal((await s.enviar('DELETE', `/api/agents?path=${encodeURIComponent(copia)}`)).status, 403);
    assert.ok(fs.existsSync(copia));
  });

  test('conversa com agente: de projeto roda no projeto; da vila, 403; desconhecido, 404', async () => {
    const dir = await projeto({ '.claude/agents/revisor.md': '---\nname: revisor\ndescription: x\n---\nOi.\n' });
    const s = await fabrica([casa('p', dir)]);
    const r = await (await s.enviar('POST', '/api/agents/session', { path: path.join(dir, '.claude/agents/revisor.md') })).json();
    assert.equal(r.projectId, 'p');
    assert.deepEqual(s.ctx.agentSessions.get(r.sessionId), { cwd: dir, agent: 'revisor' });
    assert.equal((await s.enviar('POST', '/api/agents/session', { path: AGENTE_DA_VILA })).status, 403);
    assert.equal((await s.enviar('POST', '/api/agents/session', { path: '/etc/passwd' })).status, 404);
  });
});

describe('Skills: /api/skills', () => {
  test('criar, ler, salvar e apagar a pasta inteira; fora das pastas de skills, 404', async () => {
    const dir = await projeto({ 'docs/SKILL.md': '# não é skill' });
    const s = await fabrica([casa('p', dir)]);
    const criada = await (await s.enviar('POST', '/api/skills', { projectId: 'p', name: 'deploy', ...FORMULARIO })).json();
    assert.equal(criada.path, path.join(dir, '.claude/skills/deploy/SKILL.md'));
    assert.equal((await s.enviar('POST', '/api/skills', { projectId: 'x', name: 'deploy', ...FORMULARIO })).status, 400);
    assert.equal((await s.enviar('POST', '/api/skills', { projectId: 'p', name: 'Deploy!', ...FORMULARIO })).status, 400);
    assert.equal((await s.enviar('POST', '/api/skills', { projectId: 'p', name: 'outra', description: '' })).status, 400);

    const lida = await (await s.get(`/api/skills/file?path=${encodeURIComponent(criada.path)}`)).json();
    assert.equal(lida.instructions, 'Faça assim.');
    assert.equal((await s.enviar('PUT', '/api/skills', { path: criada.path, mtime: lida.mtime - 5000, ...FORMULARIO })).status, 409);
    assert.equal((await s.enviar('PUT', '/api/skills', { path: criada.path, mtime: lida.mtime, ...FORMULARIO, instructions: 'Novo.' })).status, 200);

    const fora = path.join(dir, 'docs/SKILL.md');
    assert.equal((await s.get(`/api/skills/file?path=${encodeURIComponent(fora)}`)).status, 404);
    assert.equal((await s.enviar('PUT', '/api/skills', { path: fora, mtime: 0, ...FORMULARIO })).status, 404);
    assert.equal((await s.enviar('DELETE', `/api/skills?path=${encodeURIComponent(fora)}`)).status, 404);
    assert.ok(fs.existsSync(fora));

    assert.equal((await s.enviar('DELETE', `/api/skills?path=${encodeURIComponent(criada.path)}`)).status, 200);
    assert.equal(fs.existsSync(path.dirname(criada.path)), false);
  });

  test('skill instalada por link não é salva nem apagada: 403, e a fonte fica intacta', async () => {
    const fonte = await projeto({ 'SKILL.md': '---\nname: regras\ndescription: x\n---\nFonte.\n' });
    fs.mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
    const link = path.join(GLOBAL_SKILLS_DIR, 'regras');
    fs.symlinkSync(fonte, link);
    const s = await fabrica([]);
    const arquivo = path.join(link, 'SKILL.md');
    const { mtime } = await (await s.get(`/api/skills/file?path=${encodeURIComponent(arquivo)}`)).json();
    assert.equal((await s.enviar('PUT', '/api/skills', { path: arquivo, mtime, ...FORMULARIO })).status, 403);
    assert.equal((await s.enviar('DELETE', `/api/skills?path=${encodeURIComponent(arquivo)}`)).status, 403);
    assert.match(fs.readFileSync(path.join(fonte, 'SKILL.md'), 'utf8'), /Fonte\./);
  });
});

describe('Biblioteca: /api/library', () => {
  const CONFIG = { libraryRoots: [] } as unknown as Config;
  async function biblioteca() {
    const dir = await projeto({ 'CLAUDE.md': '# Regras do projeto\n\nUse tabs.\n', 'docs/pagina.html': '<p>oi</p>', '.env': 'SEGREDO=1' });
    const projects = [casa('p', dir)];
    const chamadas: string[][] = [];
    const s = await subir({ projects }, { library: new Library(CONFIG, () => projects), abrirVscode: (args) => void chamadas.push(args) });
    return { dir, s, chamadas };
  }

  test('estantes, busca e catálogo (gravado no HOME de teste)', async () => {
    const { dir, s } = await biblioteca();
    const secoes = await (await s.get('/api/library')).json();
    const doProjeto = secoes.find((x: { id: string }) => x.id === 'project:p');
    assert.deepEqual(doProjeto.files.map((f: { rel: string }) => f.rel).sort(), ['CLAUDE.md', 'docs/pagina.html']);
    assert.ok(fs.existsSync(CATALOG_PATH));
    const achados = await (await s.get('/api/library/search?q=tabs')).json();
    assert.deepEqual(achados.map((a: { path: string; line: number }) => [a.path, a.line]), [[path.join(dir, 'CLAUDE.md'), 3]]);
    assert.deepEqual(await (await s.get('/api/library/search?q=t')).json(), [], 'busca com menos de 2 letras');
  });

  test('ler, abrir HTML isolado, salvar e abrir no VS Code: só livro da varredura; fora dela, 404', async () => {
    const { dir, s, chamadas } = await biblioteca();
    const md = path.join(dir, 'CLAUDE.md');
    const lido = await (await s.get(`/api/library/file?path=${encodeURIComponent(md)}`)).json();
    assert.match(lido.content, /Use tabs/);
    const html = await s.get(`/api/library/html?path=${encodeURIComponent(path.join(dir, 'docs/pagina.html'))}`);
    assert.equal(html.headers.get('content-security-policy'), 'sandbox allow-scripts');
    assert.equal((await s.get(`/api/library/html?path=${encodeURIComponent(md)}`)).status, 404, 'md não abre como HTML');

    assert.equal((await s.enviar('PUT', '/api/library/file', { path: md, content: 'novo', mtime: lido.mtime - 5000 })).status, 409);
    assert.equal((await s.enviar('PUT', '/api/library/file', { path: md, content: 'novo', mtime: lido.mtime })).status, 200);
    assert.equal(fs.readFileSync(md, 'utf8'), 'novo');
    assert.equal((await s.enviar('POST', '/api/library/open-vscode', { path: md })).status, 200);
    assert.deepEqual(chamadas, [['--goto', md]]);

    for (const fora of [path.join(dir, '.env'), '/etc/passwd', 'CLAUDE.md']) {
      assert.equal((await s.get(`/api/library/file?path=${encodeURIComponent(fora)}`)).status, 404, fora);
      assert.equal((await s.enviar('PUT', '/api/library/file', { path: fora, content: 'x', mtime: 0 })).status, 404, fora);
      assert.equal((await s.enviar('POST', '/api/library/open-vscode', { path: fora })).status, 404, fora);
    }
    assert.equal(fs.readFileSync(path.join(dir, '.env'), 'utf8'), 'SEGREDO=1');
    assert.equal(chamadas.length, 1);
  });
});
