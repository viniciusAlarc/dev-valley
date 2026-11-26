import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { briefingDe, Porao, type AbrirSessao } from '../src/porao.js';
import { casa, sessao, subir } from './servidor.js';
import { projeto } from './util.js';

// Porão da casa (MA-1): quem é do porão e a rota que abre uma rodada com o maestro. Registro e agente em pasta temporária.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-porao-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
/** Pasta do projeto do maestro nos testes de `pedir` (só serve de base para os arquivos liberados). */
const PASTA = path.join(TMP, 'casa');

describe('briefingDe: sessão de trabalho de uma rodada, pelo primeiro prompt', () => {
  test('a frase do maestro, com ~ ou caminho absoluto, dá a rodada e a tarefa', () => {
    assert.deepEqual(briefingDe('Você trabalha sob o maestro. Leia e siga: ~/.claude/maestro/rodadas/20261103-1430-porao/briefings/t1.md'), {
      rodada: '20261103-1430-porao',
      tarefa: 't1',
    });
    assert.deepEqual(briefingDe('  Você trabalha sob o maestro. Leia e siga: /home/x/.claude/maestro/rodadas/r-2/briefings/t0.md\n'), { rodada: 'r-2', tarefa: 't0' });
  });
  test('prompt comum, citação no meio do texto ou caminho de outra pasta: não é do porão', () => {
    assert.equal(briefingDe(null), null);
    assert.equal(briefingDe('Arruma o botão de salvar'), null);
    assert.equal(briefingDe('Olha isto: Você trabalha sob o maestro. Leia e siga: ~/.claude/maestro/rodadas/r/briefings/t1.md'), null);
    assert.equal(briefingDe('Você trabalha sob o maestro. Leia e siga: ~/outra/rodadas/r/briefings/t1.md'), null);
  });
});

describe('Porao: registro dos maestros', () => {
  test('sem arquivo, nenhum; registrar grava e soma sem perder os anteriores', async () => {
    const p = new Porao(path.join(TMP, 'reg', 'porao.json'), path.join(TMP, 'nao-existe.md'));
    assert.equal((await p.maestros()).size, 0);
    await p.registrarMaestro('a', 'proj');
    await p.registrarMaestro('b', 'proj');
    assert.deepEqual([...(await p.maestros())].sort(), ['a', 'b']);
    assert.equal(await p.maestroInstalado(), false);
  });
  test('arquivo corrompido não derruba: vale como vazio', async () => {
    const file = path.join(TMP, 'ruim.json');
    fs.writeFileSync(file, '{ não é json');
    assert.equal((await new Porao(file).maestros()).size, 0);
  });
});

describe('POST /api/porao/maestro', () => {
  test('abre rodada: anota no porão antes do terminal e a sessão nasce com --agent maestro na pasta do projeto', async () => {
    const dir = await projeto({});
    const agente = path.join(TMP, 'maestro.md');
    fs.writeFileSync(agente, '---\nname: maestro\ndescription: x\n---\n');
    const porao = new Porao(path.join(TMP, 'rota', 'porao.json'), agente);
    const s = await subir({ projects: [casa('p', dir)] }, { porao });
    const r = await s.enviar('POST', '/api/porao/maestro', { projectId: 'p' });
    assert.equal(r.status, 200);
    const { sessionId, projectId } = await r.json();
    assert.equal(projectId, 'p');
    assert.deepEqual(s.ctx.agentSessions.get(sessionId), { cwd: dir, agent: 'maestro' });
    assert.equal(s.ctx.escolhasDeConta.get(sessionId), 'Claude', 'o maestro abre no Claude, mesmo na casa pessoal');
    assert.ok((await porao.maestros()).has(sessionId));
  });
  test('projeto desconhecido, 404; agente não instalado, 409 e nada anotado; outra origem, recusado', async () => {
    const dir = await projeto({});
    const porao = new Porao(path.join(TMP, 'sem-agente', 'porao.json'), path.join(TMP, 'sem-agente.md'));
    const s = await subir({ projects: [casa('p', dir)] }, { porao });
    assert.equal((await s.enviar('POST', '/api/porao/maestro', { projectId: 'x' })).status, 404);
    assert.equal((await s.enviar('POST', '/api/porao/maestro', { projectId: 'p' })).status, 409);
    assert.equal((await porao.maestros()).size, 0);
    assert.equal(s.ctx.agentSessions.size, 0);
    assert.equal((await s.enviar('POST', '/api/porao/maestro', { projectId: 'p' }, 'http://evil.example')).status, 403);
  });
});

// ---------------- fase 3: o maestro pede, o usuário aprova no cartão ----------------

/** Porão com um maestro anotado e os briefings dados já escritos na pasta da rodada. */
async function poraoComMaestro(nome: string, briefings: string[], rodada = 'r1') {
  const base = path.join(TMP, nome);
  const rodadas = path.join(base, 'rodadas');
  fs.mkdirSync(path.join(rodadas, rodada, 'briefings'), { recursive: true });
  for (const t of briefings) fs.writeFileSync(path.join(rodadas, rodada, 'briefings', `${t}.md`), '# briefing');
  // Gate (maestro v3) de mentira: todo comando passa, e nenhum comando de verdade roda.
  const porao = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), rodadas, undefined, async (comando) => ({ comando, codigo: 0, duracaoMs: 1 }));
  await porao.registrarMaestro('m1', 'p');
  return porao;
}

describe('Porao.pedir e aprovar (fase 3)', () => {
  test('a frase do briefing que a vila digita é a mesma que a vila reconhece', async () => {
    const { promptDoBriefing } = await import('../src/porao.js');
    assert.deepEqual(briefingDe(promptDoBriefing('20261103-1430-x', 't2')), { rodada: '20261103-1430-x', tarefa: 't2' });
  });

  test('só o maestro anotado pede; nome inválido, tarefa repetida ou briefing faltando: recusado', async () => {
    const p = await poraoComMaestro('pedir', ['t1']);
    assert.deepEqual(await p.pedir({ maestro: 'outro', rodada: 'r1', tarefas: ['t1'] }, 5, PASTA), { erro: 'Só o maestro aberto no porão pede sessões.', status: 403 });
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: '../x', tarefas: ['t1'] }, 5, PASTA)) as { status: number }).status, 400);
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't1'] }, 5, PASTA)) as { status: number }).status, 400);
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [] }, 5, PASTA)) as { status: number }).status, 400);
    assert.match(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t9'] }, 5, PASTA)) as { erro: string }).erro, /Falta o briefing/);
    assert.equal(p.pedidosAbertos().length, 0);
  });

  test('teto: conta as sessões que a rodada já tem mais as pedidas', async () => {
    const p = await poraoComMaestro('teto', ['t1', 't2', 't3']);
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't2', 't3'] }, 2, PASTA)) as { status: number }).status, 409);
    const um = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'] }, 2, PASTA);
    assert.ok(!('erro' in um));
    await p.aprovar(um.id, async () => null);
    assert.ok(!('erro' in (await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t2'] }, 2, PASTA))));
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t3'] }, 2, PASTA)) as { status: number }).status, 409, 'uma aberta + uma pedida = teto');
  });

  test('aprovar abre uma sessão por tarefa com a frase do briefing, anotada antes; a que não abriu sai do registro', async () => {
    const p = await poraoComMaestro('aprovar', ['t1', 't2']);
    const pedido = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't2'] }, 5, PASTA);
    assert.ok(!('erro' in pedido));
    assert.equal(pedido.projectId, 'p');
    const abertas: { id: string; prompt: string; anotada: boolean }[] = [];
    const r = await p.aprovar(pedido.id, async (id, prompt) => {
      abertas.push({ id, prompt, anotada: (await p.papeis()).has(id) });
      return prompt.includes('t2') ? 'perfil sem configuração' : null;
    });
    assert.equal(r?.estado, 'aprovado');
    assert.ok(abertas.every((a) => a.anotada), 'anotada antes de abrir');
    assert.match(abertas[0]!.prompt, /^Você trabalha sob o maestro\. Leia e siga: ~\/\.claude\/maestro\/rodadas\/r1\/briefings\/t1\.md$/);
    assert.deepEqual(r?.sessoes.t2, { erro: 'perfil sem configuração' });
    const papeis = await p.papeis();
    assert.deepEqual(papeis.get(abertas[0]!.id), { papel: 'tarefa', rodada: 'r1', tarefa: 't1' });
    assert.equal(papeis.has(abertas[1]!.id), false);
    assert.equal(await p.aprovar(pedido.id, async () => null), null, 'decidido uma vez só');
    assert.equal(p.recusar(pedido.id), null);
  });
});

describe('Rotas do pedido (fase 3)', () => {
  const PAGINA = 'http://localhost:4777';

  async function vila(nome: string, vivo = true) {
    const dir = await projeto({});
    const porao = await poraoComMaestro(nome, ['t1']);
    const abertas: { sessionId: string; cwd: string; prompt: string }[] = [];
    const s = await subir(
      { projects: [casa('p', dir)], sessions: [sessao('m1', { projectId: 'p', live: vivo, porao: { papel: 'maestro' } })] },
      { porao, abrirTarefa: async (o) => (abertas.push(o), null) },
    );
    return { s, dir, abertas };
  }

  test('maestro vivo pede (sem Origin, como o curl); a página aprova e a sessão abre na pasta do projeto', async () => {
    const { s, dir, abertas } = await vila('rota-ok');
    const r = await s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r1', tarefas: ['t1'] });
    assert.equal(r.status, 201);
    const { pedidoId } = await r.json();
    assert.equal((await (await s.get(`/api/porao/pedidos/${pedidoId}`)).json()).estado, 'aguardando');

    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`)).status, 403, 'sem Origin: o maestro não se aprova');
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`, undefined, 'http://evil.example')).status, 403);
    assert.equal(abertas.length, 0);

    const ok = await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`, undefined, PAGINA);
    assert.equal(ok.status, 200);
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0]!.cwd, dir);
    assert.match(abertas[0]!.prompt, /briefings\/t1\.md$/);
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`, undefined, PAGINA)).status, 409);
    assert.equal((await (await s.get(`/api/porao/pedidos/${pedidoId}`)).json()).estado, 'aprovado');
  });

  test('quem não é maestro vivo não pede; recusar só pela página; pedido desconhecido, 404', async () => {
    const { s, abertas } = await vila('rota-recusa');
    assert.equal((await s.enviar('POST', '/api/porao/pedidos', { maestro: 'x', rodada: 'r1', tarefas: ['t1'] })).status, 403);
    const { pedidoId } = await (await s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r1', tarefas: ['t1'] })).json();
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/recusar`)).status, 403);
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/recusar`, undefined, PAGINA)).status, 200);
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`, undefined, PAGINA)).status, 409);
    assert.equal((await s.get('/api/porao/pedidos/nao-existe')).status, 404);
    assert.equal(abertas.length, 0);

    const parado = await vila('rota-parado', false);
    assert.equal((await parado.s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r1', tarefas: ['t1'] })).status, 403, 'maestro encerrado');
  });
});

// ---------------- sessão do roteiro de testes (05/11/2026) ----------------

/** Pasta de projeto com o relatório da rodada gravado em `docs-dev/maestro/`. */
function casaComRelatorio(nome: string, relatorio = '2026-11-05-x.md'): string {
  const dir = path.join(TMP, nome, 'casa');
  fs.mkdirSync(path.join(dir, 'docs-dev', 'maestro'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs-dev', 'maestro', relatorio), '# Rodada: x');
  return dir;
}

describe('Porao.pedirRoteiro: a sessão que monta o roteiro de testes', () => {
  const REL = 'docs-dev/maestro/2026-11-05-x.md';

  test('só o maestro anotado pede; rodada ou relatório inválido, ou relatório que não existe: recusado', async () => {
    const p = await poraoComMaestro('roteiro-recusa', []);
    const dir = casaComRelatorio('roteiro-recusa');
    assert.equal(((await p.pedirRoteiro({ maestro: 'outro', rodada: 'r1', relatorio: REL }, dir)) as { status: number }).status, 403);
    assert.equal(((await p.pedirRoteiro({ maestro: 'm1', rodada: '../x', relatorio: REL }, dir)) as { status: number }).status, 400);
    for (const relatorio of ['../segredo.md', '/etc/passwd', 'docs-dev/maestro/../../x.md', 'docs-dev/maestro/x.html', 'PROGRESS.md', 7]) {
      assert.equal(((await p.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio }, dir)) as { status: number }).status, 400, String(relatorio));
    }
    assert.match(((await p.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio: 'docs-dev/maestro/outro.md' }, dir)) as { erro: string }).erro, /não existe/);
    assert.equal(p.pedidosAbertos().length, 0);
  });

  test('um por rodada (o recusado libera outro); fora do teto: não conta nem ocupa vaga das tarefas', async () => {
    const p = await poraoComMaestro('roteiro-um', ['t1', 't2']);
    const dir = casaComRelatorio('roteiro-um');
    const r = await p.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio: REL }, dir);
    assert.ok(!('erro' in r));
    assert.deepEqual([r.tarefas, r.roteiro, r.permissoes], [['roteiro'], REL, {}]);
    assert.equal(((await p.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio: REL }, dir)) as { status: number }).status, 409);
    assert.ok(!('erro' in (await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't2'] }, 2, PASTA))), 'teto 2 com o roteiro pedido');
    p.recusar(r.id);
    assert.ok(!('erro' in (await p.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio: REL }, dir))));
  });

  test('aprovar abre uma sessão com /roteiro-testes <relatório>, sem regra e sem anotar no porão (nasce na casa)', async () => {
    const p = await poraoComMaestro('roteiro-abre', []);
    const dir = casaComRelatorio('roteiro-abre');
    const r = await p.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio: REL }, dir);
    assert.ok(!('erro' in r));
    const abertas: { id: string; prompt: string; permitir: string[]; settings?: string }[] = [];
    const ok = await p.aprovar(r.id, async (id, prompt, permitir, settings) => (abertas.push({ id, prompt, permitir, settings }), null));
    assert.equal(ok?.estado, 'aprovado');
    assert.deepEqual(abertas.map((a) => [a.prompt, a.permitir]), [[`/roteiro-testes ${REL}`, []]]);
    assert.deepEqual(JSON.parse(abertas[0]!.settings!), { model: 'sonnet' }, 'só o modelo, sem hooks da rodada');
    assert.deepEqual(ok?.sessoes.roteiro, { sessionId: abertas[0]!.id });
    assert.equal((await p.papeis()).has(abertas[0]!.id), false);
    assert.equal(briefingDe(abertas[0]!.prompt), null, 'o primeiro prompt também não a põe no porão');
  });
});

describe('POST /api/porao/roteiro', () => {
  const PAGINA = 'http://localhost:4777';
  const REL = 'docs-dev/maestro/2026-11-05-x.md';

  async function vila(nome: string, vivo = true) {
    const dir = casaComRelatorio(nome);
    const porao = await poraoComMaestro(nome, []);
    const abertas: { sessionId: string; cwd: string; prompt: string; permitir: string[] }[] = [];
    const s = await subir(
      { projects: [casa('p', dir)], sessions: [sessao('m1', { projectId: 'p', live: vivo, porao: { papel: 'maestro' } })] },
      { porao, abrirTarefa: async (o) => (abertas.push(o), null) },
    );
    return { s, dir, abertas, porao };
  }

  test('maestro vivo pede (sem Origin, como o curl); o cartão fica esperando; só a página abre, na pasta do projeto', async () => {
    const { s, dir, abertas, porao } = await vila('rota-roteiro');
    const r = await s.enviar('POST', '/api/porao/roteiro', { maestro: 'm1', rodada: 'r1', relatorio: REL });
    assert.equal(r.status, 201);
    const { pedidoId } = await r.json();
    assert.deepEqual(porao.pedidosAbertos().map((p) => [p.id, p.roteiro]), [[pedidoId, REL]]);
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`)).status, 403, 'o maestro não se aprova');
    assert.equal(abertas.length, 0);
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`, undefined, PAGINA)).status, 200);
    assert.deepEqual(abertas.map((a) => [a.cwd, a.prompt, a.permitir]), [[dir, `/roteiro-testes ${REL}`, []]]);
  });

  test('quem não é maestro vivo não pede; outra origem, recusado; relatório faltando, 400', async () => {
    const { s } = await vila('rota-roteiro-recusa');
    assert.equal((await s.enviar('POST', '/api/porao/roteiro', { maestro: 'x', rodada: 'r1', relatorio: REL })).status, 403);
    assert.equal((await s.enviar('POST', '/api/porao/roteiro', { maestro: 'm1', rodada: 'r1', relatorio: REL }, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('POST', '/api/porao/roteiro', { maestro: 'm1', rodada: 'r1', relatorio: 'docs-dev/maestro/nao.md' })).status, 400);
    const parado = await vila('rota-roteiro-parado', false);
    assert.equal((await parado.s.enviar('POST', '/api/porao/roteiro', { maestro: 'm1', rodada: 'r1', relatorio: REL })).status, 403);
  });
});

// ---------------- permissões da tarefa (04/11/2026) ----------------

describe('validarPermissoes: o que o maestro pode liberar para uma sessão de trabalho', () => {
  test('arquivos relativos ao projeto, normalizados e sem repetição; testes sem repetição; sem testes = nenhum', async () => {
    const { validarPermissoes } = await import('../src/porao.js');
    assert.deepEqual(validarPermissoes(PASTA, 't1', ['./server/a.ts', 'server/a.ts', 'web/b.ts', 'PROGRESS.md'], ['npm test', 'npm test', 'npm run typecheck -w server']), {
      arquivos: ['server/a.ts', 'web/b.ts', 'PROGRESS.md'],
      testes: ['npm test', 'npm run typecheck -w server'],
    });
    assert.deepEqual(validarPermissoes(PASTA, 't1', ['a.ts'], undefined), { arquivos: ['a.ts'], testes: [] });
    assert.deepEqual(validarPermissoes(PASTA, 't1', ['a.ts'], ['./mvnw test', 'npx tsc --noEmit -p web', 'pytest tests/x_test.py']), {
      arquivos: ['a.ts'],
      testes: ['./mvnw test', 'npx tsc --noEmit -p web', 'pytest tests/x_test.py'],
    });
  });

  test('recusa arquivo fora do projeto, com curinga, em .git/.claude ou .env, e lista vazia ou grande demais', async () => {
    const { validarPermissoes, MAX_ARQUIVOS } = await import('../src/porao.js');
    const recusa = (arquivos: unknown) => assert.equal(typeof validarPermissoes(PASTA, 't1', arquivos, []), 'string', JSON.stringify(arquivos));
    for (const a of ['/etc/passwd', '../fora.ts', 'a/../../fora.ts', '*.ts', 'src/**', 'a?.ts', 'x[1].ts', 'x{a}.ts', 'Edit(x)', 'a\\b', 'a\nb', '', '.', 'x'.repeat(201)]) recusa([a]);
    for (const a of ['.git/config', 'sub/.git/HEAD', '.claude/settings.json', '.claude/settings.local.json', '.env', 'config/.env.local']) recusa([a]);
    recusa([]);
    recusa('server/a.ts');
    recusa([1]);
    recusa(Array.from({ length: MAX_ARQUIVOS + 1 }, (_, i) => `f${i}.ts`));
    assert.equal(typeof validarPermissoes(PASTA, 't1', Array.from({ length: MAX_ARQUIVOS }, (_, i) => `f${i}.ts`), []), 'object', 'o teto exato passa');
  });

  test('recusa comando com o que o shell interpreta, comando perigoso e lista grande demais', async () => {
    const { validarPermissoes, MAX_TESTES } = await import('../src/porao.js');
    const recusa = (testes: unknown) => assert.equal(typeof validarPermissoes(PASTA, 't1', ['a.ts'], testes), 'string', JSON.stringify(testes));
    for (const t of ['npm test; rm -rf /', 'npm test && curl x', 'npm test | sh', 'npm test > /tmp/x', 'echo $(id)', 'echo `id`', '"npm test"', "npm 'test'", 'npm test\nrm x', 'npm  test', ' ', 'npm test *', 'x'.repeat(121)]) recusa([t]);
    for (const t of ['rm -rf .', 'git status', 'gh pr list', '/usr/bin/curl x', 'bash -c x', 'sudo npm test', 'docker compose up', 'psql -c x', 'claude -p x', 'find . -delete']) recusa([t]);
    recusa('npm test');
    recusa([7]);
    recusa(Array.from({ length: MAX_TESTES + 1 }, (_, i) => `npm run t${i}`));
  });

  test('regras: ler a rodada e o config, editar só os arquivos (absolutos), rodar só os testes com qualquer argumento', async () => {
    const { regrasDaTarefa } = await import('../src/porao.js');
    assert.deepEqual(regrasDaTarefa('/casa/proj', '/home/u/.claude/maestro/rodadas/r1', { arquivos: ['server/a.ts', 'PROGRESS.md'], testes: ['npm test'] }, ['/home/u/regras/**']), [
      'Read(//home/u/.claude/maestro/rodadas/r1/**)',
      'Read(//home/u/regras/**)',
      'Edit(//casa/proj/server/a.ts)',
      'Edit(//casa/proj/PROGRESS.md)',
      'Bash(npm test:*)',
      'Bash(bash /home/u/.claude/maestro/rodadas/r1/testar.sh:*)',
    ]);
  });
});

describe('Porao.pedir e aprovar com permissões', () => {
  test('tarefa com { id, arquivos, testes } guarda as permissões; nome sozinho continua valendo, sem permissão', async () => {
    const p = await poraoComMaestro('perm-pedir', ['t1', 't2']);
    const pedido = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }, 't2'] }, 5, PASTA);
    assert.ok(!('erro' in pedido));
    assert.deepEqual(pedido.tarefas, ['t1', 't2']);
    assert.deepEqual(pedido.permissoes, { t1: { arquivos: ['a.ts'], testes: ['npm test'] } });
    assert.equal(pedido.pasta, PASTA);
  });

  test('uma tarefa com arquivo ou comando recusado derruba o pedido inteiro, com o motivo', async () => {
    const p = await poraoComMaestro('perm-recusa', ['t1', 't2']);
    const r1 = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }, { id: 't2', arquivos: ['.claude/settings.json'] }] }, 5, PASTA);
    assert.deepEqual([(r1 as { status: number }).status, /t2: \.claude\/settings\.json/.test((r1 as { erro: string }).erro)], [400, true]);
    const r2 = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test && rm -rf ~'] }] }, 5, PASTA);
    assert.equal((r2 as { status: number }).status, 400);
    const r3 = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: '../t1', arquivos: ['a.ts'] }] }, 5, PASTA);
    assert.equal((r3 as { status: number }).status, 400);
    const r4 = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }, 't1'] }, 5, PASTA);
    assert.equal((r4 as { status: number }).status, 400, 'tarefa repetida, mesmo misturando os dois jeitos');
    assert.equal(p.pedidosAbertos().length, 0);
  });

  test('aprovar abre cada sessão com as regras dela; a sem permissão abre sem regra nenhuma', async () => {
    const { regrasDaTarefa } = await import('../src/porao.js');
    const p = await poraoComMaestro('perm-aprovar', ['t1', 't2']);
    const pedido = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }, 't2'] }, 5, PASTA);
    assert.ok(!('erro' in pedido));
    const abertas = new Map<string, string[]>();
    const abrir: AbrirSessao = async (_id, prompt, permitir) => (abertas.set(prompt.match(/(t\d)\.md$/)![1]!, permitir), null);
    await p.aprovar(pedido.id, abrir, ['/regras/**']);
    // Com comando de teste, a linha de base roda antes (maestro v3): as tarefas abrem na volta em que ela termina.
    assert.equal(abertas.size, 0);
    await p.gatesEmCurso();
    await p.avancar([], () => abrir, ['/regras/**']);
    assert.deepEqual(abertas.get('t1'), regrasDaTarefa(PASTA, path.join(TMP, 'perm-aprovar', 'rodadas', 'r1'), { arquivos: ['a.ts'], testes: ['npm test'] }, ['/regras/**'], 't1'));
    assert.ok(abertas.get('t1')!.includes(`Edit(/${path.join(TMP, 'perm-aprovar', 'rodadas', 'r1', 'devolutivas', 't1.md')})`), 'grava a própria devolutiva');
    assert.ok(abertas.get('t1')!.includes(`Edit(/${path.join(PASTA, 'a.ts')})`));
    assert.deepEqual(abertas.get('t2'), []);
  });
});

describe('Rotas do pedido com permissões', () => {
  const PAGINA = 'http://localhost:4777';

  test('a rota usa a pasta da casa do maestro; o cartão (pedido no mundo) mostra o que vai ser liberado; arquivo recusado = 400', async () => {
    const dir = await projeto({});
    const porao = await poraoComMaestro('perm-rota', ['t1']);
    const abertas: { cwd: string; permitir: string[] }[] = [];
    const s = await subir(
      { projects: [casa('p', dir)], sessions: [sessao('m1', { projectId: 'p', live: true, porao: { papel: 'maestro' } })] },
      { porao, abrirTarefa: async (o) => (abertas.push(o), null), leituraPorao: ['/regras/**'] },
    );
    const ruim = await s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['../outro/a.ts'] }] });
    assert.equal(ruim.status, 400);
    assert.match((await ruim.json()).error, /fora do projeto/);
    const r = await s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['src/a.ts'], testes: ['npm test'] }] });
    assert.equal(r.status, 201);
    const { pedidoId } = await r.json();
    assert.deepEqual(porao.pedido(pedidoId)?.permissoes, { t1: { arquivos: ['src/a.ts'], testes: ['npm test'] } });
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${pedidoId}/aprovar`, undefined, PAGINA)).status, 200);
    // Com comando de teste, o clique responde já e nada abre antes da linha de base (maestro v3).
    assert.equal(abertas.length, 0);
    await porao.gatesEmCurso();
    // Sem comando de teste, sem linha de base: a rota abre na pasta da casa do maestro, com as regras da tarefa.
    fs.mkdirSync(path.join(TMP, 'perm-rota', 'rodadas', 'r2', 'briefings'), { recursive: true });
    fs.writeFileSync(path.join(TMP, 'perm-rota', 'rodadas', 'r2', 'briefings', 't1.md'), '# briefing');
    const r2 = await s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r2', tarefas: [{ id: 't1', arquivos: ['src/a.ts'] }] });
    assert.equal((await s.enviar('POST', `/api/porao/pedidos/${(await r2.json()).pedidoId}/aprovar`, undefined, PAGINA)).status, 200);
    assert.equal(abertas[0]!.cwd, dir);
    assert.ok(abertas[0]!.permitir.includes(`Edit(/${path.join(dir, 'src/a.ts')})`));
    assert.ok(abertas[0]!.permitir.includes('Read(//regras/**)'));
  });
});

describe('argsDoTerminal: a ordem dos argumentos do claude', () => {
  test('regras por último, depois da primeira mensagem (a opção engoliria a mensagem); resume ignora a mensagem mas leva regras e hooks (MA-3)', async () => {
    const { argsDoTerminal } = await import('../src/terminals.js');
    assert.deepEqual(argsDoTerminal({ sessionId: 's', mode: 'new', prompt: 'leia o briefing', permitir: ['Edit(//a)', 'Bash(npm test:*)'] }), [
      '--session-id', 's', 'leia o briefing', '--allowedTools', 'Edit(//a)', 'Bash(npm test:*)',
    ]);
    assert.deepEqual(argsDoTerminal({ sessionId: 's', mode: 'new', prompt: 'oi', permitir: [] }), ['--session-id', 's', 'oi']);
    assert.deepEqual(argsDoTerminal({ sessionId: 's', mode: 'new', agent: 'maestro' }), ['--session-id', 's', '--agent', 'maestro']);
    assert.deepEqual(argsDoTerminal({ sessionId: 's', mode: 'resume', prompt: 'x', permitir: ['Edit(//a)'], settings: '{}' }), ['--resume', 's', '--settings', '{}', '--allowedTools', 'Edit(//a)']);
    assert.deepEqual(argsDoTerminal({ sessionId: 's', mode: 'resume' }), ['--resume', 's']);
    assert.deepEqual(argsDoTerminal({ sessionId: 's', mode: 'new', prompt: 'oi', settings: '{"hooks":{}}', permitir: ['Edit(//a)'] }), [
      '--session-id', 's', 'oi', '--settings', '{"hooks":{}}', '--allowedTools', 'Edit(//a)',
    ]);
  });
});

// ---------------- fase 4: relatórios e "Encerrar rodada" ----------------

describe('readRelatorios: quadro de relatórios do porão', () => {
  test('o mais novo primeiro, título sem "Rodada:", data pelo nome; sem a pasta, null', async () => {
    const { readRelatorios } = await import('../src/relatorios.js');
    const dir = await projeto({
      'docs-dev/maestro/2026-11-03-biblioteca.md': '# Rodada: biblioteca e carta\n\ntexto',
      'docs-dev/maestro/2026-11-04-porao.md': '# Porão\n',
      'docs-dev/maestro/solto.md': 'sem título',
    });
    const r = await readRelatorios(dir);
    assert.deepEqual(
      r?.map((x) => [path.basename(x.path), x.title, x.data]),
      [
        ['solto.md', 'solto', null],
        ['2026-11-04-porao.md', 'Porão', '2026-11-04'],
        ['2026-11-03-biblioteca.md', 'biblioteca e carta', '2026-11-03'],
      ],
    );
    assert.equal(await readRelatorios(await projeto({})), null);
  });
});

describe('POST /api/porao/encerrar', () => {
  const PAGINA = 'http://localhost:4777';

  async function vilaComRodada(nome: string, maestroFora = false, falharEm: string | null = null) {
    const dir = await projeto({});
    const porao = await poraoComMaestro(nome, ['t1']);
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'] }, 5, PASTA);
    const mortas: string[] = [];
    const apagadas: string[] = [];
    const s = await subir(
      {
        projects: [casa('p', dir), casa('q', dir + '-outro')],
        sessions: [
          sessao('m1', { projectId: 'p', live: true, inTown: !maestroFora, porao: { papel: 'maestro' } }),
          sessao('t1', { projectId: 'p', live: false, porao: { papel: 'tarefa', rodada: 'r1', tarefa: 't1' } }),
          sessao('casa', { projectId: 'p', live: true }),
          sessao('outro', { projectId: 'q', live: false, porao: { papel: 'tarefa', rodada: 'r9', tarefa: 't1' } }),
        ],
      },
      {
        porao,
        terminals: { kill: async (id: string) => void mortas.push(id) },
        apagarConversa: async (id: string) => {
          if (id === falharEm) throw new Error('disco ocupado');
          apagadas.push(id);
        },
        hooks: { handle: async () => {}, forget: () => {} } as never,
      },
    );
    return { s, porao, pedido, mortas, apagadas };
  }

  test('apaga só as conversas do porão deste projeto, tira do registro e recusa o pedido aberto', async () => {
    const { s, porao, pedido, mortas, apagadas } = await vilaComRodada('encerrar-ok');
    const r = await s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' }, PAGINA);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { apagadas: 2 });
    assert.deepEqual(mortas.sort(), ['m1', 't1']);
    assert.deepEqual(apagadas.sort(), ['m1', 't1']);
    assert.equal((await porao.maestros()).has('m1'), false);
    assert.ok(!('erro' in pedido));
    assert.equal(porao.pedido(pedido.id)?.estado, 'recusado');
  });

  test('o gongo não apaga a sessão do roteiro (é da casa) nem recusa o cartão dele', async () => {
    const dir = casaComRelatorio('encerrar-roteiro');
    const porao = await poraoComMaestro('encerrar-roteiro', ['t1']);
    const tarefas = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'] }, 5, PASTA);
    const roteiro = await porao.pedirRoteiro({ maestro: 'm1', rodada: 'r1', relatorio: 'docs-dev/maestro/2026-11-05-x.md' }, dir);
    const apagadas: string[] = [];
    const s = await subir(
      {
        projects: [casa('p', dir)],
        sessions: [
          sessao('m1', { projectId: 'p', live: true, inTown: true, porao: { papel: 'maestro' } }),
          sessao('rot', { projectId: 'p', live: true, inTown: true, title: '/roteiro-testes docs-dev/maestro/2026-11-05-x.md' }),
        ],
      },
      {
        porao,
        terminals: { kill: async () => {} },
        apagarConversa: async (id: string) => void apagadas.push(id),
        hooks: { handle: async () => {}, forget: () => {} } as never,
      },
    );
    assert.equal((await s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' }, PAGINA)).status, 200);
    assert.deepEqual(apagadas, ['m1']);
    assert.ok(!('erro' in tarefas) && !('erro' in roteiro));
    assert.equal(porao.pedido(tarefas.id)?.estado, 'recusado');
    assert.equal(porao.pedido(roteiro.id)?.estado, 'aguardando');
  });

  test('sem a página, 403; projeto desconhecido, 404; aberta em outro terminal, 409 e nada apagado', async () => {
    const { s, apagadas } = await vilaComRodada('encerrar-trava');
    assert.equal((await s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' })).status, 403);
    assert.equal((await s.enviar('POST', '/api/porao/encerrar', { projectId: 'x' }, PAGINA)).status, 404);
    const fora = await vilaComRodada('encerrar-fora', true);
    assert.equal((await fora.s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' }, PAGINA)).status, 409);
    assert.deepEqual([...apagadas, ...fora.apagadas], []);
  });

  test('erro no meio (MA-2): responde 500 com o motivo, e o que já foi apagado sai do registro', async () => {
    const { s, porao, apagadas } = await vilaComRodada('encerrar-erro', false, 't1');
    const r = await s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' }, PAGINA);
    assert.equal(r.status, 500);
    const corpo = await r.json();
    assert.match(corpo.error, /Parou depois de apagar 1 de 2 conversa\(s\): disco ocupado/);
    assert.deepEqual(apagadas, ['m1']);
    assert.equal((await porao.maestros()).has('m1'), false);
  });
});
