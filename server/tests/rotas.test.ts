import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import type { Contexto } from '../src/app.js';
import type { AgentEvent } from '../src/consulta.js';
import type { Lareira } from '../src/lareira.js';
import type { Pombal } from '../src/pombal.js';
import type { Project } from '../src/world.js';
import { casa, sessao, subir } from './servidor.js';
import { projeto } from './util.js';

// PD-8, passo 2: por rota, um caso de sucesso e os de entrada inválida (G11). Recurso de outro projeto ou de fora
// responde igual a inexistente (G9). Começa pelas rotas que recebem caminho ou projeto do navegador.

const FORA = 'https://exemplo.com';
const POMBAL = { branch: 'main', upstream: 'origin/main', locais: 0, aReceber: 0, buscadoEm: null } as unknown as Pombal;
const LAREIRA: Lareira = { lados: [] };

describe('GET /api/arquivo', () => {
  test('sucesso: texto abre como text/plain, HTML abre isolado', async () => {
    const dir = await projeto({ 'docs/guia.md': '# Guia', 'docs/pagina.html': '<p>oi</p>' });
    const s = await subir({ projects: [casa('p', dir)] });
    const md = await s.get(`/api/arquivo?path=${encodeURIComponent(path.join(dir, 'docs/guia.md'))}`);
    assert.equal(md.status, 200);
    assert.match(md.headers.get('content-type') ?? '', /^text\/plain/);
    assert.equal(await md.text(), '# Guia');
    const html = await s.get(`/api/arquivo?path=${encodeURIComponent(path.join(dir, 'docs/pagina.html'))}`);
    assert.equal(html.status, 200);
    assert.equal(html.headers.get('content-security-policy'), 'sandbox allow-scripts');
  });

  test('fora do projeto, arquivo com ponto e inexistente respondem o mesmo 404 (G9)', async () => {
    const dir = await projeto({ '.env': 'SEGREDO=1' });
    const fora = await projeto({ 'outro.md': 'x' });
    const s = await subir({ projects: [casa('p', dir)] });
    const respostas = await Promise.all(
      [path.join(fora, 'outro.md'), path.join(dir, '.env'), path.join(dir, 'nao-existe.md'), 'relativo.md', ''].map(async (p) => {
        const r = await s.get(`/api/arquivo?path=${encodeURIComponent(p)}`);
        return [r.status, await r.text()];
      }),
    );
    for (const r of respostas) assert.deepEqual(r, respostas[2]);
    assert.equal(respostas[2][0], 404);
  });
});

describe('GET /api/progress', () => {
  test('sucesso: entregas do PROGRESS.md; projeto desconhecido: 400', async () => {
    const dir = await projeto({ 'PROGRESS.md': '## 2026-10-01 — Algo\n\nFeito.\n' });
    const s = await subir({ projects: [casa('p', dir)] });
    const ok = await s.get('/api/progress?project=p');
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), [{ date: '2026-10-01', title: 'Algo', body: 'Feito.' }]);
    assert.equal((await s.get('/api/progress?project=outro')).status, 400);
  });
});

describe('POST /api/progress/conferir', () => {
  const PROGRESS = '## 2026-10-01 — Algo\n\nFalta conferir na vila.\n';
  const listado = { date: '2026-10-01', title: 'Algo' };
  const mundo = async () => {
    const dir = await projeto({ 'PROGRESS.md': PROGRESS });
    return { dir, projects: [casa('p', dir, { progress: { entries: 1, lastDate: '2026-10-01', toCheck: [listado] } })] };
  };

  test('sucesso: marca a entrega listada pelo sino', async () => {
    const { dir, projects } = await mundo();
    const s = await subir({ projects });
    const r = await s.enviar('POST', '/api/progress/conferir', { project: 'p', items: [listado] });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { marcadas: 1 });
    assert.match(await fs.readFile(path.join(dir, 'PROGRESS.md'), 'utf8'), /Conferido na vila pelo usuário/);
  });

  test('página de fora: 403 e o arquivo fica como estava', async () => {
    const { dir, projects } = await mundo();
    const s = await subir({ projects });
    assert.equal((await s.enviar('POST', '/api/progress/conferir', { project: 'p', items: [listado] }, FORA)).status, 403);
    assert.equal(await fs.readFile(path.join(dir, 'PROGRESS.md'), 'utf8'), PROGRESS);
  });

  test('entrega que o sino não lista ou projeto desconhecido: 400', async () => {
    const { projects } = await mundo();
    const s = await subir({ projects });
    assert.equal((await s.enviar('POST', '/api/progress/conferir', { project: 'p', items: [{ date: '2026-10-01', title: 'Outra' }] })).status, 400);
    assert.equal((await s.enviar('POST', '/api/progress/conferir', { project: 'x', items: [listado] })).status, 400);
  });
});

describe('GET /api/quadro e /api/estante', () => {
  test('sucesso: HTML listado no mundo abre isolado; índice ou projeto inválido: 404', async () => {
    const dir = await projeto({ 'docs-dev/plano.html': '<p>plano</p>', 'docs-dev/context/livro.md': '# Livro' });
    const html = { path: path.join(dir, 'docs-dev/plano.html'), kind: 'html' as const };
    const s = await subir({
      projects: [
        casa('p', dir, {
          quadro: [{ fase: 'F', doc: 'docs-dev/plano.html', ...html }],
          estante: [{ title: 'Plano', ...html }, { title: 'Livro', path: path.join(dir, 'docs-dev/context/livro.md'), kind: 'md' }],
        }),
      ],
    });
    for (const rota of ['/api/quadro?project=p&i=0', '/api/estante?project=p&i=0']) {
      const r = await s.get(rota);
      assert.equal(r.status, 200, rota);
      assert.equal(r.headers.get('content-security-policy'), 'sandbox allow-scripts');
    }
    for (const rota of ['/api/quadro?project=p&i=5', '/api/quadro?project=x&i=0', '/api/estante?project=p&i=abc', '/api/estante?project=p&i=1'])
      assert.equal((await s.get(rota)).status, 404, rota);
  });
});

describe('GET /api/diff', () => {
  test('sucesso: versão do último commit e a do disco; arquivo fora do projeto ou projeto desconhecido: 400', async () => {
    const dir = await projeto({ 'a.txt': 'antes\n' });
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
    git('init', '-q');
    git('add', '.');
    git('commit', '-qm', 'inicio');
    await fs.writeFile(path.join(dir, 'a.txt'), 'depois\n');
    const s = await subir({ projects: [casa('p', dir, { isGit: true })] });
    const r = await s.get('/api/diff?project=p&file=a.txt');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { original: 'antes\n', modified: 'depois\n' });
    for (const rota of ['/api/diff?project=p&file=../../etc/passwd', '/api/diff?project=p', '/api/diff?project=x&file=a.txt'])
      assert.equal((await s.get(rota)).status, 400, rota);
  });
});

describe('POST /api/open-vscode', () => {
  test('sucesso: abre o projeto no arquivo; arquivo de fora não entra no --goto; projeto desconhecido: 400', async () => {
    const dir = await projeto();
    const chamadas: string[][] = [];
    const s = await subir({ projects: [casa('p', dir)] }, { abrirVscode: (args) => void chamadas.push(args) });
    assert.equal((await s.enviar('POST', '/api/open-vscode', { project: 'p', file: 'src/a.ts' })).status, 200);
    assert.equal((await s.enviar('POST', '/api/open-vscode', { project: 'p', file: '../../etc/passwd' })).status, 200);
    assert.equal((await s.enviar('POST', '/api/open-vscode', { project: 'x' })).status, 400);
    assert.deepEqual(chamadas, [[dir, '--goto', path.join(dir, 'src/a.ts')], [dir]]);
  });
});

describe('POST /api/pombal/sugerir', () => {
  test('sucesso: escrevente recebe só caminhos relativos de dentro do projeto', async () => {
    const dir = await projeto();
    let pedido: string[] = [];
    const s = await subir({ projects: [casa('p', dir, { pombal: POMBAL })] }, { sugerirMensagem: async (_d, arquivos) => ((pedido = arquivos), 'Texto') });
    const r = await s.enviar('POST', '/api/pombal/sugerir', { project: 'p', arquivos: [path.join(dir, 'a.ts'), 'b.ts'] });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { texto: 'Texto' });
    assert.deepEqual(pedido, ['a.ts', 'b.ts']);
  });

  test('página de fora: 403; sem pombal ou arquivo de fora: 400 (o escrevente não é chamado)', async () => {
    const dir = await projeto();
    const s = await subir({ projects: [casa('p', dir, { pombal: POMBAL }), casa('sem', dir)] });
    assert.equal((await s.enviar('POST', '/api/pombal/sugerir', { project: 'p' }, FORA)).status, 403);
    assert.equal((await s.enviar('POST', '/api/pombal/sugerir', { project: 'sem' })).status, 400);
    assert.equal((await s.enviar('POST', '/api/pombal/sugerir', { project: 'p', arquivos: ['../fora.ts'] })).status, 400);
  });
});

// Sucesso do pombal (buscar, commit, rebase, push) fica para o passo 3, com repositórios git de mentira.
describe('GET e POST /api/pombal (entrada inválida)', () => {
  test('página de fora: 403; sem pombal, ação desconhecida ou arquivo de fora: 400', async () => {
    const dir = await projeto();
    const s = await subir({ projects: [casa('p', dir, { pombal: POMBAL }), casa('sem', dir)] });
    assert.equal((await s.get('/api/pombal?project=sem')).status, 400);
    assert.equal((await s.enviar('POST', '/api/pombal', { project: 'p', acao: 'enviar' }, FORA)).status, 403);
    assert.equal((await s.enviar('POST', '/api/pombal', { project: 'sem', acao: 'enviar' })).status, 400);
    assert.equal((await s.enviar('POST', '/api/pombal', { project: 'p', acao: 'forcar' })).status, 400);
    assert.equal((await s.enviar('POST', '/api/pombal', { project: 'p', acao: 'enviar', arquivos: ['../fora.ts'] })).status, 400);
  });
});

describe('POST /api/lareira/acender e /apagar', () => {
  test('sucesso: liga e apaga o projeto pedido', async () => {
    const dir = await projeto();
    const feitos: string[] = [];
    const s = await subir(
      { projects: [casa('p', dir, { lareira: LAREIRA })] },
      { lareiras: { acender: (id) => (feitos.push(`acender ${id}`), ['back']), apagar: async (id) => void feitos.push(`apagar ${id}`) } },
    );
    const r = await s.enviar('POST', '/api/lareira/acender', { project: 'p' });
    assert.deepEqual(await r.json(), { ligados: ['back'] });
    assert.equal((await s.enviar('POST', '/api/lareira/apagar', { project: 'p' })).status, 200);
    assert.deepEqual(feitos, ['acender p', 'apagar p']);
  });

  test('página de fora: 403; projeto sem lareira ou desconhecido: 404 (nada é ligado)', async () => {
    const dir = await projeto();
    const s = await subir({ projects: [casa('p', dir, { lareira: LAREIRA }), casa('sem', dir)] });
    for (const acao of ['acender', 'apagar']) {
      assert.equal((await s.enviar('POST', `/api/lareira/${acao}`, { project: 'p' }, FORA)).status, 403);
      assert.equal((await s.enviar('POST', `/api/lareira/${acao}`, { project: 'sem' })).status, 404);
      assert.equal((await s.enviar('POST', `/api/lareira/${acao}`, { project: 'x' })).status, 404);
    }
  });
});

describe('POST /api/library/claude-md', () => {
  test('sucesso: cria no projeto pedido; já existe: 409; projeto desconhecido: 400', async () => {
    const dir = await projeto();
    let existe = false;
    const s = await subir(
      { projects: [casa('p', dir)] },
      { library: { createClaudeMd: async (p: Project) => (existe ? null : ((existe = true), path.join(p.path, 'CLAUDE.md'))) } as unknown as Contexto['library'] },
    );
    const r = await s.enviar('POST', '/api/library/claude-md', { project: 'p' });
    assert.deepEqual(await r.json(), { path: path.join(dir, 'CLAUDE.md') });
    assert.equal((await s.enviar('POST', '/api/library/claude-md', { project: 'p' })).status, 409);
    assert.equal((await s.enviar('POST', '/api/library/claude-md', { project: 'x' })).status, 400);
  });
});

describe('POST /api/sessions', () => {
  test('sucesso: sessão no projeto ou avulsa na home; projeto desconhecido: 400', async () => {
    const dir = await projeto();
    const s = await subir({ projects: [casa('p', dir)] });
    const noProjeto = await (await s.enviar('POST', '/api/sessions', { project: 'p' })).json();
    assert.equal(noProjeto.cwd, dir);
    assert.match(noProjeto.sessionId, /^[0-9a-f-]{36}$/);
    const avulsa = await (await s.enviar('POST', '/api/sessions', {})).json();
    assert.ok(s.ctx.avulsaSessions.has(avulsa.sessionId));
    assert.equal((await s.enviar('POST', '/api/sessions', { project: 'x' })).status, 400);
  });
});

describe('DELETE /api/sessions/:id', () => {
  const ID = '00000000-0000-0000-0000-000000000001';

  test('sucesso: encerra o terminal, apaga a conversa e esquece o estado', async () => {
    const feitos: string[] = [];
    const s = await subir(
      { sessions: [sessao(ID)] },
      {
        terminals: { kill: async (id) => void feitos.push(`kill ${id}`) },
        apagarConversa: async (id) => void feitos.push(`apagar ${id}`),
        hooks: { handle: () => false, forget: (id) => void feitos.push(`forget ${id}`) },
      },
    );
    assert.equal((await s.enviar('DELETE', `/api/sessions/${ID}`)).status, 200);
    assert.deepEqual(feitos, [`kill ${ID}`, `apagar ${ID}`, `forget ${ID}`]);
  });

  test('sessão desconhecida: 404; aberta fora da vila: 409 (nada é apagado)', async () => {
    const s = await subir({ sessions: [sessao(ID, { live: true, inTown: false })] });
    assert.equal((await s.enviar('DELETE', '/api/sessions/00000000-0000-0000-0000-000000000002')).status, 404);
    assert.equal((await s.enviar('DELETE', `/api/sessions/${ID}`)).status, 409);
  });
});

// ---- Rotas que só repassam ao serviço: o teste confere a validação da rota e o que ela entrega ao serviço ----

describe('GET /api/world', () => {
  test('sucesso: o mundo atual', async () => {
    const dir = await projeto();
    const s = await subir({ projects: [casa('p', dir)] });
    const mundo = await (await s.get('/api/world')).json();
    assert.deepEqual(mundo.projects.map((p: Project) => p.id), ['p']);
  });
});

describe('POST /api/hooks', () => {
  test('sucesso: o evento vai ao HookStore; sessão interna da vila é ignorada', async () => {
    const recebidos: unknown[] = [];
    const s = await subir({}, { hooks: { handle: (p) => (recebidos.push(p), true), forget: () => {} } });
    s.ctx.internalSessions.add('interna');
    assert.equal((await s.enviar('POST', '/api/hooks', { session_id: 'aaa', hook_event_name: 'Stop' })).status, 200);
    assert.equal((await s.enviar('POST', '/api/hooks', { session_id: 'interna', hook_event_name: 'Stop' })).status, 200);
    assert.deepEqual(recebidos, [{ session_id: 'aaa', hook_event_name: 'Stop' }]);
  });
});

describe('POST /api/moradores/nome', () => {
  const ID = '00000000-0000-0000-0000-00000000000a';

  test('sucesso: nome do morador; sessão interna da vila não vira morador', async () => {
    const s = await subir({}, { moradores: { claim: async (id) => (id === ID ? 'Vera' : 'outro') } });
    assert.deepEqual(await (await s.enviar('POST', '/api/moradores/nome', { session_id: ID })).json(), { name: 'Vera' });
    s.ctx.internalSessions.add(ID);
    assert.deepEqual(await (await s.enviar('POST', '/api/moradores/nome', { session_id: ID })).json(), { name: null });
  });

  test('id que não é de sessão: 400 (nada é reservado)', async () => {
    const s = await subir({});
    for (const corpo of [{}, { session_id: 42 }, { session_id: '../x' }, { session_id: 'abc' }])
      assert.equal((await s.enviar('POST', '/api/moradores/nome', corpo)).status, 400, JSON.stringify(corpo));
  });
});

describe('POST /api/statusline e GET /api/statusline/last', () => {
  test('sucesso: guarda o último e repassa ao StatusLineStore', async () => {
    const recebidos: unknown[] = [];
    const s = await subir({}, { statusLine: { handle: (p) => (recebidos.push(p), false) } });
    assert.equal(await (await s.get('/api/statusline/last')).text(), 'null');
    assert.equal((await s.enviar('POST', '/api/statusline', { session_id: 'aaa' })).status, 200);
    assert.deepEqual(await (await s.get('/api/statusline/last')).json(), { session_id: 'aaa' });
    assert.deepEqual(recebidos, [{ session_id: 'aaa' }]);
  });
});

describe('POST /api/librarian/ask e /api/administrador/ask', () => {
  const responder = (onEvent: (e: AgentEvent) => void) => {
    onEvent({ type: 'step', text: 'Lendo' });
    onEvent({ type: 'answer', text: 'Achei' });
    return () => {};
  };

  test('sucesso: passos e resposta em NDJSON, uma linha por evento; o administrador recebe os projetos', async () => {
    const dir = await projeto();
    const perguntas: string[] = [];
    const s = await subir(
      { projects: [casa('p', dir)] },
      {
        askLibrarian: (question, _h, onEvent) => (perguntas.push(question), responder(onEvent)),
        askAdministrador: (question, _h, projects, onEvent) => (perguntas.push(`${question} [${projects.map((p) => p.id)}]`), responder(onEvent)),
      },
    );
    for (const rota of ['/api/librarian/ask', '/api/administrador/ask']) {
      const r = await s.enviar('POST', rota, { question: '  onde fica?  ' });
      assert.equal(r.headers.get('content-type'), 'application/x-ndjson', rota);
      assert.equal(await r.text(), '{"type":"step","text":"Lendo"}\n{"type":"answer","text":"Achei"}\n', rota);
    }
    assert.deepEqual(perguntas, ['onde fica?', 'onde fica? [p]']);
  });

  test('pergunta vazia: 400 (o Claude não é consultado)', async () => {
    const s = await subir({});
    for (const rota of ['/api/librarian/ask', '/api/administrador/ask']) {
      assert.equal((await s.enviar('POST', rota, { question: '   ' })).status, 400, rota);
      assert.equal((await s.enviar('POST', rota, {})).status, 400, rota);
    }
  });
});
