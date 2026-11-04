import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { briefingDe, Porao } from '../src/porao.js';
import { casa, sessao, subir } from './servidor.js';
import { projeto } from './util.js';

// Porão da casa (MA-1): quem é do porão e a rota que abre uma rodada com o maestro. Registro e agente em pasta temporária.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-porao-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

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
  const porao = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), rodadas);
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
    assert.deepEqual(await p.pedir({ maestro: 'outro', rodada: 'r1', tarefas: ['t1'] }, 5), { erro: 'Só o maestro aberto no porão pede sessões.', status: 403 });
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: '../x', tarefas: ['t1'] }, 5)) as { status: number }).status, 400);
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't1'] }, 5)) as { status: number }).status, 400);
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [] }, 5)) as { status: number }).status, 400);
    assert.match(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t9'] }, 5)) as { erro: string }).erro, /Falta o briefing/);
    assert.equal(p.pedidosAbertos().length, 0);
  });

  test('teto: conta as sessões que a rodada já tem mais as pedidas', async () => {
    const p = await poraoComMaestro('teto', ['t1', 't2', 't3']);
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't2', 't3'] }, 2)) as { status: number }).status, 409);
    const um = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'] }, 2);
    assert.ok(!('erro' in um));
    await p.aprovar(um.id, async () => null);
    assert.ok(!('erro' in (await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t2'] }, 2))));
    assert.equal(((await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t3'] }, 2)) as { status: number }).status, 409, 'uma aberta + uma pedida = teto');
  });

  test('aprovar abre uma sessão por tarefa com a frase do briefing, anotada antes; a que não abriu sai do registro', async () => {
    const p = await poraoComMaestro('aprovar', ['t1', 't2']);
    const pedido = await p.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1', 't2'] }, 5);
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

  async function vilaComRodada(nome: string, maestroFora = false) {
    const dir = await projeto({});
    const porao = await poraoComMaestro(nome, ['t1']);
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'] }, 5);
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
        apagarConversa: async (id: string) => void apagadas.push(id),
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

  test('sem a página, 403; projeto desconhecido, 404; aberta em outro terminal, 409 e nada apagado', async () => {
    const { s, apagadas } = await vilaComRodada('encerrar-trava');
    assert.equal((await s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' })).status, 403);
    assert.equal((await s.enviar('POST', '/api/porao/encerrar', { projectId: 'x' }, PAGINA)).status, 404);
    const fora = await vilaComRodada('encerrar-fora', true);
    assert.equal((await fora.s.enviar('POST', '/api/porao/encerrar', { projectId: 'p' }, PAGINA)).status, 409);
    assert.deepEqual([...apagadas, ...fora.apagadas], []);
  });
});
