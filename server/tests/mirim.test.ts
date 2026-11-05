import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { agentDefinition, argsDaConsulta } from '../src/consulta.js';
import { preambuloDaRodada, regrasDoMirim, ultimosPassos } from '../src/mirim.js';
import { Porao } from '../src/porao.js';
import { casa, sessao, subir } from './servidor.js';
import { projeto } from './util.js';

// Maestro mirim e o chamado do maestro (decisão do usuário, 04/11/2026). Conversas e registro em pasta temporária.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-mirim-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const PAGINA = 'http://localhost:4777';

/** Uma conversa `.jsonl` de mentira, no formato do Claude Code. */
function conversa(nome: string, linhas: unknown[], lixoNoComeco = '') {
  const file = path.join(TMP, `${nome}.jsonl`);
  fs.writeFileSync(file, lixoNoComeco + linhas.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}
const T = '2026-11-04T14:05:00.000Z';
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('ultimosPassos: o resumo de cada conversa', () => {
  test('o que a sessão recebeu, disse e usou, com a hora; subagente e linha quebrada ficam de fora', async () => {
    const file = conversa(
      'passos',
      [
        { type: 'user', timestamp: T, message: { content: 'Você trabalha sob o maestro. Leia e siga: ~/x/t1.md' } },
        { type: 'assistant', timestamp: T, message: { content: [{ type: 'text', text: 'Vou começar.' }, { type: 'tool_use', name: 'Edit', input: { file_path: '/p/src/a.ts' } }] } },
        { type: 'assistant', timestamp: T, isSidechain: true, message: { content: [{ type: 'text', text: 'do subagente' }] } },
        { type: 'assistant', timestamp: T, message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] } },
        { type: 'assistant', timestamp: T, message: { content: [{ type: 'tool_use', name: 'SendMessage', input: { to: 'uds:x', message: '[maestro] r1 t1: PRONTA' } }] } },
        { type: 'user', timestamp: T, message: { content: [{ type: 'tool_result', content: 'ok' }] } },
      ],
      '{"cortada no meio\n',
    );
    const h = hhmm(T);
    assert.deepEqual(await ultimosPassos(file), [
      `[${h}] recebeu: Você trabalha sob o maestro. Leia e siga: ~/x/t1.md`,
      `[${h}] disse: Vou começar.`,
      `[${h}] usou Edit /p/src/a.ts`,
      `[${h}] usou Bash: npm test`,
      `[${h}] usou SendMessage → [maestro] r1 t1: PRONTA`,
    ]);
    assert.deepEqual((await ultimosPassos(file, 2)).length, 2, 'só os últimos n');
  });

  test('arquivo que não existe = nenhum passo; texto longo é cortado', async () => {
    assert.deepEqual(await ultimosPassos(path.join(TMP, 'nao-existe.jsonl')), []);
    const file = conversa('longo', [{ type: 'assistant', timestamp: T, message: { content: [{ type: 'text', text: 'a'.repeat(500) }] } }]);
    const [p] = await ultimosPassos(file);
    assert.ok(p!.length < 270 && p!.endsWith('…'));
  });
});

describe('preambuloDaRodada: o estado da rodada que o mirim recebe', () => {
  test('maestro e tarefas deste projeto, com estado, conversa e briefings; as de outro projeto e de fora do porão não entram', async () => {
    const dir = await projeto({});
    const file = conversa('t1', [{ type: 'assistant', timestamp: T, message: { content: [{ type: 'text', text: 'editando' }] } }]);
    const texto = await preambuloDaRodada(
      casa('p', dir),
      [
        sessao('m1', { name: 'Ana', projectId: 'p', live: true, status: 'idle', porao: { papel: 'maestro' }, file: null }),
        sessao('s1', { name: 'Bruno', projectId: 'p', live: true, status: 'permission', porao: { papel: 'tarefa', rodada: 'r1', tarefa: 't1' }, file }),
        sessao('s2', { name: 'Caio', projectId: 'p', live: false, porao: { papel: 'tarefa', rodada: 'r1', tarefa: 't2' }, file: null }),
        sessao('x', { name: 'Fora', projectId: 'q', live: true, porao: { papel: 'tarefa', rodada: 'r9', tarefa: 't1' } }),
        sessao('casa', { name: 'Comum', projectId: 'p', live: true, porao: null }),
      ],
      '/rodadas',
    );
    assert.match(texto, new RegExp(`Projeto: .* — ${dir}`));
    assert.match(texto, /Rodada\(s\): r1 \(briefings em \/rodadas\/r1\/briefings\)/);
    assert.match(texto, /### ✦ Maestro — Ana \(parada/);
    assert.match(texto, /### Tarefa t1 — Bruno \(ESPERANDO PERMISSÃO/);
    assert.match(texto, /disse: editando/);
    assert.match(texto, /### Tarefa t2 — Caio \(encerrada/);
    assert.doesNotMatch(texto, /Fora|Comum|r9/);
  });

  test('sem sessão no porão: diz que não há rodada', async () => {
    const texto = await preambuloDaRodada(casa('p', await projeto({})), []);
    assert.match(texto, /Nenhuma sessão de tarefa no porão agora/);
  });
});

describe('o mirim só lê', () => {
  test('ferramentas: Read, Grep e Glob inteiros; Bash só git status/diff/log/show do projeto; modo estrito', () => {
    const def = agentDefinition('maestro-mirim', { '{{PROJETO}}': '/p' });
    assert.deepEqual(def.tools, ['Read', 'Grep', 'Glob', 'Bash']);
    assert.ok(!def.prompt.includes('{{PROJETO}}'), 'o caminho do projeto entra no texto');
    const args = argsDaConsulta('maestro-mirim', def, 'p', 'id', regrasDoMirim('/p'), true);
    const i = args.indexOf('--allowedTools');
    assert.deepEqual(args.slice(i + 1), ['Read', 'Grep', 'Glob', 'Bash(git -C /p status:*)', 'Bash(git -C /p diff:*)', 'Bash(git -C /p log:*)', 'Bash(git -C /p show:*)']);
    assert.equal(args[args.indexOf('--permission-mode') + 1], 'default');
    assert.ok(!def.tools.includes('Edit') && !def.tools.includes('Write') && !def.tools.includes('SendMessage'));
  });

  test('Bash nunca vai liberado inteiro, para nenhum agente; sem estrito, o modo do usuário vale', () => {
    const args = argsDaConsulta('x', { description: 'd', prompt: 'p', tools: ['Read', 'Bash', 'Edit'], model: 'sonnet' }, 'p', 'id');
    assert.deepEqual(args.slice(args.indexOf('--allowedTools') + 1), ['Read']);
    assert.ok(!args.includes('--permission-mode'));
  });
});

describe('Porao: o maestro chama o usuário', () => {
  async function poraoComMaestro(nome: string) {
    const base = path.join(TMP, nome);
    const p = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), path.join(base, 'rodadas'));
    await p.registrarMaestro('m1', 'p');
    return p;
  }

  test('só o maestro anotado chama; o motivo vira uma linha curta; atender e esquecer tiram o chamado', async () => {
    const p = await poraoComMaestro('chamar');
    assert.equal(await p.chamar('outro', 'oi'), false);
    assert.equal(await p.chamar('m1', '  t2 vai pedir\n para editar   app.ts  '), true);
    assert.deepEqual(p.chamadosAbertos(), { m1: 't2 vai pedir para editar app.ts' });
    p.atender('m1');
    assert.deepEqual(p.chamadosAbertos(), {});
    await p.chamar('m1', 'x'.repeat(500));
    assert.equal(p.chamadosAbertos().m1!.length, 200);
    await p.esquecer('p', ['m1']);
    assert.deepEqual(p.chamadosAbertos(), {});
    assert.equal(await p.chamar('m1', 'depois de encerrada'), false, 'rodada encerrada não chama mais');
  });
});

describe('Rotas do chamado e do mirim', () => {
  async function vila(nome: string, vivo = true) {
    const dir = await projeto({});
    const base = path.join(TMP, nome);
    const porao = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), path.join(base, 'rodadas'));
    await porao.registrarMaestro('m1', 'p');
    const perguntas: { question: string; projeto: string }[] = [];
    const s = await subir(
      { projects: [casa('p', dir)], sessions: [sessao('m1', { projectId: 'p', live: vivo, porao: { papel: 'maestro' } }), sessao('t', { projectId: 'p', live: true })] },
      {
        porao,
        askMirim: async (question, _h, project, _s, onEvent) => {
          perguntas.push({ question, projeto: project.path });
          onEvent({ type: 'step', text: '📖 Lendo t1.md' });
          onEvent({ type: 'answer', text: 'a t1 está editando' });
          return () => {};
        },
      },
    );
    return { s, dir, porao, perguntas };
  }

  test('chamar: o maestro vivo pelo curl (sem Origin); quem não é maestro, maestro parado ou outra origem, 403', async () => {
    const { s, porao } = await vila('rota-chamar');
    assert.equal((await s.enviar('POST', '/api/porao/chamar', { maestro: 'm1', motivo: 'decidir t2' }, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('POST', '/api/porao/chamar', { maestro: 't', motivo: 'x' })).status, 403, 'sessão comum não chama');
    assert.equal((await s.enviar('POST', '/api/porao/chamar', { maestro: 'm1', motivo: 'decidir t2' })).status, 201);
    assert.deepEqual(porao.chamadosAbertos(), { m1: 'decidir t2' });
    const parado = await vila('rota-chamar-parado', false);
    assert.equal((await parado.s.enviar('POST', '/api/porao/chamar', { maestro: 'm1' })).status, 403);
  });

  test('atendido: só pela página (o maestro não se atende sozinho)', async () => {
    const { s, porao } = await vila('rota-atendido');
    await porao.chamar('m1', 'x');
    assert.equal((await s.enviar('POST', '/api/porao/chamar/atendido', { maestro: 'm1' })).status, 403);
    assert.deepEqual(porao.chamadosAbertos(), { m1: 'x' });
    assert.equal((await s.enviar('POST', '/api/porao/chamar/atendido', { maestro: 3 }, PAGINA)).status, 400);
    assert.equal((await s.enviar('POST', '/api/porao/chamar/atendido', { maestro: 'm1' }, PAGINA)).status, 200);
    assert.deepEqual(porao.chamadosAbertos(), {});
  });

  test('mirim: só pela página, projeto da vila e pergunta não vazia; responde em NDJSON com os passos', async () => {
    const { s, dir, perguntas } = await vila('rota-mirim');
    assert.equal((await s.enviar('POST', '/api/porao/mirim', { projectId: 'p', question: 'como está?' })).status, 403, 'sem Origin');
    assert.equal((await s.enviar('POST', '/api/porao/mirim', { projectId: 'nenhum', question: 'como está?' }, PAGINA)).status, 404);
    assert.equal((await s.enviar('POST', '/api/porao/mirim', { projectId: 'p', question: '  ' }, PAGINA)).status, 400);
    assert.equal(perguntas.length, 0);
    const r = await s.enviar('POST', '/api/porao/mirim', { projectId: 'p', question: 'como está a t1?', history: [] }, PAGINA);
    assert.equal(r.status, 200);
    const eventos = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(eventos.map((e) => e.type), ['step', 'answer']);
    assert.deepEqual(perguntas, [{ question: 'como está a t1?', projeto: dir }]);
  });
});
