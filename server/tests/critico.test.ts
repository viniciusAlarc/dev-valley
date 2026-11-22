import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { apontamentosValidos, cartaoParaCritica, criticaDoPorao, criticar, lerJson, vereditos, type AgenteDaCritica, type Perguntar } from '../src/critico.js';
import type { PedidoPorao } from '../src/porao.js';
import { casa, sessao, subir } from './servidor.js';
import { projeto } from './util.js';

// Crítica do cartão (21/11/2026): crítico e verificador são imitados; nada chama `claude` de verdade.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-critico-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function pedido(extra: Partial<PedidoPorao> = {}): PedidoPorao {
  return {
    id: 'ped-1',
    projectId: 'p',
    pasta: '/casa',
    maestro: 'sessao-do-maestro-123',
    rodada: 'r1',
    tarefas: ['t1', 't2'],
    permissoes: { t1: { arquivos: ['src/a.ts'], testes: ['npm test'] }, t2: { arquivos: ['src/a.ts'], testes: [] } },
    dependencias: { t1: [], t2: [] },
    criadoEm: 0,
    estado: 'aguardando',
    sessoes: {},
    ...extra,
  };
}

/** Imitação: cada agente responde o texto dado e anota o que recebeu. */
function imitacao(respostas: Partial<Record<AgenteDaCritica, string | Error>>) {
  const chamadas: { agente: AgenteDaCritica; preamble: string }[] = [];
  const perguntar: Perguntar = async (agente, preamble) => {
    chamadas.push({ agente, preamble });
    const r = respostas[agente];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error(`${agente} não devia ser chamado`);
    return r;
  };
  return { perguntar, chamadas };
}

const A = (item: string, tarefa: string | null, evidencia = '"src/a.ts" (briefings/t1.md)') => ({ item, tarefa, problema: 'algo', evidencia });

describe('lerJson', () => {
  test('com cerca, sem cerca, com texto em volta; lixo = null', () => {
    assert.deepEqual(lerJson('```json\n{"a": 1}\n```'), { a: 1 });
    assert.deepEqual(lerJson('Aqui: {"a": [1]} fim'), { a: [1] });
    assert.equal(lerJson('Tudo certo!'), null);
    assert.equal(lerJson('{quebrado'), null);
  });
});

describe('apontamentosValidos: só item do checklist, com evidência, e até o teto', () => {
  test('sem evidência, item desconhecido ou tarefa fora do cartão: cai; R1 aceita tarefa null', () => {
    const r = apontamentosValidos(
      { apontamentos: [A('C2', 't1'), A('C1', 't1', ''), A('X9', 't1'), A('C3', 'outra'), A('R1', null), A('c4', 't2')], foraDoTeto: 0 },
      ['t1', 't2'],
    )!;
    assert.deepEqual(r.apontamentos.map((a) => a.item), ['C2', 'R1', 'C4']);
    assert.equal(r.foraDoTeto, 0);
  });
  test('mais que 5: os 5 primeiros, o resto soma ao foraDoTeto declarado', () => {
    const r = apontamentosValidos({ apontamentos: Array.from({ length: 7 }, () => A('C1', 't1')), foraDoTeto: 2 }, ['t1'])!;
    assert.equal(r.apontamentos.length, 5);
    assert.equal(r.foraDoTeto, 4);
  });
  test('sem a lista de apontamentos: fora do formato (null)', () => {
    assert.equal(apontamentosValidos({ ok: true }, ['t1']), null);
    assert.equal(apontamentosValidos(null, ['t1']), null);
  });
});

describe('vereditos', () => {
  test('por número; o que faltar ou vier estranho fica incerto', () => {
    assert.deepEqual(vereditos({ veredictos: [{ n: 2, veredito: 'Refutado' }, { n: 1, veredito: 'confirmado' }, { n: 9, veredito: 'confirmado' }, { n: 3, veredito: 'talvez' }] }, 3), ['confirmado', 'refutado', 'incerto']);
    assert.deepEqual(vereditos(null, 2), ['incerto', 'incerto']);
  });
});

describe('criticar', () => {
  test('o cartão vai sem o maestro: nem o id da sessão nem o modelo', () => {
    const texto = cartaoParaCritica(pedido(), '/rodadas');
    assert.ok(!texto.includes('sessao-do-maestro-123'));
    assert.ok(!/opus|sonnet/i.test(texto));
    assert.match(texto, /Briefing: \/rodadas\/r1\/briefings\/t1\.md/);
    assert.match(texto, /Editar: src\/a\.ts/);
  });

  test('nada a apontar: pronta, sem chamar o verificador', async () => {
    const { perguntar, chamadas } = imitacao({ 'critico-do-cartao': '{"apontamentos": [], "foraDoTeto": 0}' });
    const c = await criticar(pedido(), perguntar, '/rodadas');
    assert.equal(c.estado, 'pronta');
    assert.equal(c.apontamentos.length, 0);
    assert.deepEqual(chamadas.map((x) => x.agente), ['critico-do-cartao']);
  });

  test('só o confirmado chega ao cartão; refutado e incerto só contam', async () => {
    const { perguntar, chamadas } = imitacao({
      'critico-do-cartao': JSON.stringify({ apontamentos: [A('C2', 't1'), A('C5', 't2'), A('R1', null)], foraDoTeto: 0 }),
      'verificador-do-cartao': '```json\n{"veredictos": [{"n": 1, "veredito": "confirmado"}, {"n": 2, "veredito": "refutado"}]}\n```',
    });
    const c = await criticar(pedido(), perguntar, '/rodadas');
    assert.equal(c.estado, 'pronta');
    assert.deepEqual(c.apontamentos.map((a) => a.item), ['C2']);
    assert.deepEqual([c.levantados, c.refutados, c.incertos], [3, 1, 1]);
    // O verificador recebe os apontamentos numerados, sem saber quem os escreveu.
    const v = chamadas.find((x) => x.agente === 'verificador-do-cartao')!.preamble;
    assert.match(v, /^1\. \[C2 · tarefa t1\]/m);
    assert.ok(!/crítico|deepseek|flash/i.test(v));
  });

  test('resposta fora do formato ou erro da consulta: falhou, sem lançar', async () => {
    assert.equal((await criticar(pedido(), imitacao({ 'critico-do-cartao': 'Está ótimo!' }).perguntar, '/r')).estado, 'falhou');
    const c = await criticar(pedido(), imitacao({ 'critico-do-cartao': new Error('DeepSeek trabalho: sem chave') }).perguntar, '/r');
    assert.equal(c.estado, 'falhou');
    assert.match(c.erro!, /sem chave/);
  });
});

describe('criticaDoPorao: segundo plano, registro e decisão', () => {
  test('marca conferindo, termina pronta, grava o registro e anota a decisão do usuário', async () => {
    const rodadas = path.join(TMP, 'rodadas');
    let avisos = 0;
    let fim!: () => void;
    const terminou = new Promise<void>((ok) => (fim = ok));
    const { perguntar } = imitacao({ 'critico-do-cartao': '{"apontamentos": []}' });
    const critica = criticaDoPorao(perguntar, rodadas, () => (avisos++, fim()));
    const p = pedido();
    critica.iniciar(p);
    assert.equal(p.critica?.estado, 'conferindo');
    await terminou;
    assert.equal(p.critica?.estado, 'pronta');
    assert.equal(avisos, 1);
    const arquivo = path.join(rodadas, 'r1', 'critica-ped-1.json');
    assert.equal(JSON.parse(fs.readFileSync(arquivo, 'utf8')).decisao, 'aguardando');
    p.estado = 'recusado';
    await critica.anotarDecisao(p);
    assert.equal(JSON.parse(fs.readFileSync(arquivo, 'utf8')).decisao, 'recusado');
  });

  test('pedido do roteiro de testes não passa pela crítica', () => {
    const critica = criticaDoPorao(imitacao({}).perguntar, path.join(TMP, 'r2'), () => {});
    const p = pedido({ roteiro: 'docs-dev/maestro/x.md', tarefas: [] });
    critica.iniciar(p);
    assert.equal(p.critica, undefined);
  });
});

describe('Rota do pedido liga a crítica', () => {
  test('pedido aceito inicia a crítica; o GET devolve o que ela tem; aprovar anota a decisão', async () => {
    const dir = await projeto({});
    const iniciados: string[] = [];
    const decididos: string[] = [];
    const p = pedido({ pasta: dir, tarefas: ['t1'], permissoes: {}, dependencias: { t1: [] } });
    const s = await subir(
      { projects: [casa('p', dir)], sessions: [sessao('m1', { projectId: 'p', live: true, porao: { papel: 'maestro' } })] },
      {
        porao: {
          pedir: async () => p,
          pedido: (id: string) => (id === p.id ? p : undefined),
          aprovar: async () => ((p.estado = 'aprovado'), p),
        } as never,
        criticaDoCartao: {
          iniciar: (x) => {
            iniciados.push(x.id);
            x.critica = { estado: 'conferindo', apontamentos: [], levantados: 0, refutados: 0, incertos: 0, foraDoTeto: 0, inicio: 'agora' };
          },
          anotarDecisao: async (x) => void decididos.push(`${x.id}:${x.estado}`),
        },
      },
    );
    const r = await s.enviar('POST', '/api/porao/pedidos', { maestro: 'm1', rodada: 'r1', tarefas: ['t1'] });
    assert.equal(r.status, 201);
    assert.deepEqual(iniciados, ['ped-1']);
    assert.equal((await (await s.get('/api/porao/pedidos/ped-1')).json()).critica.estado, 'conferindo');
    assert.equal((await s.enviar('POST', '/api/porao/pedidos/ped-1/aprovar', undefined, 'http://localhost:4777')).status, 200);
    assert.deepEqual(decididos, ['ped-1:aprovado']);
  });
});
