import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { comandosDoGate, executarComando, resultadoDoGate, veredito, type ExecutarComando, type GateDaRodada } from '../src/gate.js';
import { tokensDaConversa } from '../src/gasto.js';
import { Porao, type AbrirSessao, type SessaoAgora } from '../src/porao.js';
import { aceiteDe, estadoDoGate, lerRodada, montarRelatorio, type Rodada } from '../src/rodada.js';

// Maestro v3 (docs-dev/context/maestro-v3.md): gate com linha de base rodado pela vila, aceite na devolutiva e medição.
// Tudo em pasta temporária, nunca em ~/.claude; os comandos do gate são de mentira, menos no teste do executarComando.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-gate-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const DEVOLUTIVA = (extra = '') => `---\ntarefa: t\narquivos: a.ts\ntestes: 10/10 → 12/12\nmexeu_em_tela: não\nficou_de_fora: nada\n${extra}---\nFez a coisa pedida.\n`;

/** Porão com o maestro m1 do projeto p e os briefings da rodada r1; o gate responde pelo que estiver em `gate`. */
function montar(nome: string, briefings: string[]) {
  const base = path.join(TMP, nome);
  const rodadas = path.join(base, 'rodadas');
  const pasta = path.join(base, 'casa');
  const dir = path.join(rodadas, 'r1');
  fs.mkdirSync(path.join(dir, 'briefings'), { recursive: true });
  fs.mkdirSync(pasta, { recursive: true });
  for (const t of briefings) fs.writeFileSync(path.join(dir, 'briefings', `${t}.md`), '# briefing');
  let soltar: () => void = () => {};
  const gate = {
    antes: {} as Record<string, number | null>,
    depois: {} as Record<string, number | null>,
    rodados: [] as string[],
    segurar: null as Promise<void> | null,
    /** Os próximos comandos ficam presos até `soltar()`. */
    prender() {
      this.segurar = new Promise<void>((r) => (soltar = r));
    },
    soltar() {
      this.segurar = null;
      soltar();
    },
  };
  const executar: ExecutarComando = async (comando, _cwd, saida) => {
    const momento = path.basename(saida).startsWith('antes') ? 'antes' : 'depois';
    gate.rodados.push(`${momento}:${comando}`);
    if (gate.segurar) await gate.segurar;
    const c = gate[momento][comando];
    return { comando, codigo: c === undefined ? 0 : c, duracaoMs: 2000 };
  };
  const porao = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), rodadas, '/scripts/porao-hook.sh', executar);
  const abertas: { id: string; prompt: string }[] = [];
  const abrir: AbrirSessao = async (id, prompt) => (abertas.push({ id, prompt }), null);
  const devolver = (t: string, texto = DEVOLUTIVA()) => {
    fs.mkdirSync(path.join(dir, 'devolutivas'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'devolutivas', `${t}.md`), texto);
  };
  return { porao, pasta, dir, abertas, abrir, devolver, gate };
}

const idDe = (abertas: { id: string; prompt: string }[], t: string) => abertas.find((a) => a.prompt.endsWith(`/${t}.md`))!.id;
const parada = (id: string, file?: string): SessaoAgora => ({ id, live: true, status: 'idle', name: `Nome-${id.slice(0, 4)}`, file });

/** Pede e aprova a rodada; devolve o pedido (já sem erro). */
async function aprovarRodada(m: ReturnType<typeof montar>, tarefas: unknown[], extra: Record<string, unknown> = {}) {
  await m.porao.registrarMaestro('m1', 'p');
  const pedido = await m.porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas, ...extra }, 5, m.pasta);
  assert.ok(!('erro' in pedido), JSON.stringify(pedido));
  await m.porao.aprovar(pedido.id, m.abrir);
  return pedido;
}

describe('gate: comandos e veredito', () => {
  test('comandos = os testes das tarefas, na ordem, sem repetição', () => {
    assert.deepEqual(comandosDoGate([['npm test', 'npm run build'], [], ['npm run build', 'npm run typecheck']]), ['npm test', 'npm run build', 'npm run typecheck']);
  });
  test('antes → depois: passou, já estava vermelho, quebrou, consertou; sem linha de base, o depois decide', () => {
    const r = (codigo: number | null) => ({ comando: 'x', codigo, duracaoMs: 1 });
    assert.equal(veredito(r(0), r(0)), 'passou');
    assert.equal(veredito(r(1), r(1)), 'já estava vermelho');
    assert.equal(veredito(r(0), r(1)), 'quebrou');
    assert.equal(veredito(r(0), r(null)), 'quebrou', 'estourou o tempo conta como falha');
    assert.equal(veredito(r(2), r(0)), 'consertou');
    assert.equal(veredito(undefined, r(0)), 'passou');
    assert.equal(veredito(undefined, r(1)), 'quebrou');
  });
  test('aprovada = nenhum comando quebrou; null enquanto o gate final não terminou', () => {
    const g: GateDaRodada = {
      comandos: ['a', 'b'],
      linhaDeBase: { inicio: 1, fim: 2, resultados: [{ comando: 'a', codigo: 1, duracaoMs: 1 }, { comando: 'b', codigo: 0, duracaoMs: 1 }] },
      final: { inicio: 3 },
    };
    assert.equal(resultadoDoGate(g), null);
    assert.equal(estadoDoGate(g), 'conferindo');
    g.final = { inicio: 3, fim: 4, resultados: [{ comando: 'a', codigo: 1, duracaoMs: 1 }, { comando: 'b', codigo: 0, duracaoMs: 1 }] };
    assert.equal(resultadoDoGate(g)?.aprovada, true, 'já estava vermelho não reprova');
    assert.equal(estadoDoGate(g), 'aprovada');
    g.final.resultados![1]!.codigo = 1;
    assert.equal(resultadoDoGate(g)?.aprovada, false);
    assert.equal(estadoDoGate(g), 'reprovada');
    assert.equal(estadoDoGate(undefined), null, 'sem comandos, sem gate');
    assert.equal(estadoDoGate({ comandos: ['a'], linhaDeBase: { inicio: 1 } }), 'linha-de-base');
  });
});

describe('executarComando: sem shell, com limite de tempo, saída só no arquivo', () => {
  const pasta = path.join(TMP, 'exec');
  fs.mkdirSync(pasta, { recursive: true });
  test('código de saída e saída no arquivo; nada que o shell interpretaria é interpretado', async () => {
    const ok = await executarComando(`${process.execPath} --version`, pasta, path.join(pasta, 'gate', 'antes-1.txt'), 10_000);
    assert.equal(ok.codigo, 0);
    assert.match(fs.readFileSync(path.join(pasta, 'gate', 'antes-1.txt'), 'utf8'), /^v\d+/);
    const falha = await executarComando(`${process.execPath} nao-existe.js`, pasta, path.join(pasta, 'gate', 'antes-2.txt'), 10_000);
    assert.notEqual(falha.codigo, 0);
    assert.notEqual(falha.codigo, null);
    // Sem shell, `$HOME` e `;` chegam ao programa como texto.
    await executarComando('echo $HOME;ls', pasta, path.join(pasta, 'gate', 'antes-3.txt'), 10_000);
    assert.equal(fs.readFileSync(path.join(pasta, 'gate', 'antes-3.txt'), 'utf8').trim(), '$HOME;ls');
  });
  test('programa que não existe: código null; estourou o tempo: morto, código null e estourou', async () => {
    const nada = await executarComando('programa-que-nao-existe-dv', pasta, path.join(pasta, 'gate', 'x.txt'), 10_000);
    assert.equal(nada.codigo, null);
    const t0 = Date.now();
    const lento = await executarComando('sleep 5', pasta, path.join(pasta, 'gate', 'y.txt'), 200);
    assert.equal(lento.codigo, null);
    assert.equal(lento.estourou, true);
    assert.ok(Date.now() - t0 < 4000);
  });
});

describe('Porao v3: linha de base, gate final e relatório', () => {
  test('linha de base antes de abrir: o clique responde, nada abre até ela terminar; falha nela não bloqueia', async () => {
    const m = montar('base', ['t1', 't2']);
    m.gate.antes['npm test'] = 1; // já vermelho antes da rodada
    m.gate.prender();
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }, { id: 't2', arquivos: ['b.ts'], testes: ['npm test', 'npm run build'] }]);
    assert.equal(m.abertas.length, 0);
    const r0 = await lerRodada(m.dir);
    assert.deepEqual(r0?.gate?.comandos, ['npm test', 'npm run build']);
    assert.ok(r0?.gate?.linhaDeBase?.inicio && !r0.gate.linhaDeBase.fim);
    // Voltas enquanto a linha de base roda: nada abre, nenhum gate a mais, e o quadro diz "linha de base".
    await m.porao.avancar([], () => m.abrir);
    await m.porao.avancar([], () => m.abrir);
    assert.equal(m.abertas.length, 0);
    assert.equal(m.porao.rodadasNoMundo()[0]!.gate?.estado, 'linha-de-base');
    m.gate.soltar();
    await m.porao.gatesEmCurso();
    assert.deepEqual(m.gate.rodados, ['antes:npm test', 'antes:npm run build'], 'cada comando uma vez, na ordem');
    const r1 = await lerRodada(m.dir);
    assert.equal(r1?.gate?.linhaDeBase?.resultados?.[0]?.codigo, 1);
    // Saída de comando nunca vai para o rodada.json: só comando, código e duração.
    assert.deepEqual(Object.keys(r1!.gate!.linhaDeBase!.resultados![0]!).sort(), ['codigo', 'comando', 'duracaoMs']);
    await m.porao.avancar([], () => m.abrir);
    assert.equal(m.abertas.length, 2, 'as duas abrem depois da linha de base, mesmo com ela vermelha');
  });

  test('todas prontas: o gate final roda uma vez antes do relatório; quebrou = reprovada, ❗ e nenhuma sessão reaberta', async () => {
    const m = montar('reprovada', ['t1', 't2']);
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }, { id: 't2', arquivos: ['b.ts'], testes: ['npm run build'] }], { estimativaSessaoUnicaMin: 90 });
    await m.porao.gatesEmCurso();
    await m.porao.avancar([], () => m.abrir);
    const [s1, s2] = [idDe(m.abertas, 't1'), idDe(m.abertas, 't2')];
    m.devolver('t1', DEVOLUTIVA('aceite: sim, rodei npm test e passou\n'));
    m.devolver('t2', DEVOLUTIVA('mexeu_em_tela: sim\n').replace('mexeu_em_tela: não\n', ''));
    m.gate.depois['npm test'] = 1; // a rodada quebrou o npm test
    m.gate.prender();
    await m.porao.avancar([parada(s1), parada(s2)], () => m.abrir);
    const r0 = await lerRodada(m.dir);
    assert.ok(r0?.gate?.final?.inicio && !r0.gate.final.fim);
    assert.equal(r0?.relatorio, undefined, 'relatório só depois do gate');
    assert.equal(m.porao.rodadasNoMundo()[0]!.gate?.estado, 'conferindo');
    // Voltas com o gate rodando não disparam outro (mesmo cuidado do `abrindo`).
    await m.porao.avancar([parada(s1), parada(s2)], () => m.abrir);
    await m.porao.avancar([parada(s1), parada(s2)], () => m.abrir);
    m.gate.soltar();
    await m.porao.gatesEmCurso();
    assert.deepEqual(m.gate.rodados.filter((x) => x.startsWith('depois:')), ['depois:npm test', 'depois:npm run build']);
    await m.porao.avancar([parada(s1), parada(s2)], () => m.abrir);
    const r = await lerRodada(m.dir);
    assert.ok(r?.relatorio);
    const md = fs.readFileSync(path.join(m.pasta, r!.relatorio!), 'utf8');
    assert.match(md, /^\*\*Reprovada:\*\* a rodada quebrou `npm test` \(saída em `.*\/gate\/depois-1\.txt`\)/m);
    assert.match(md, /\| `npm test` \| passou, 2 s \| falhou \(código 1\), 2 s \| quebrou \|/);
    assert.match(md, /\| `npm run build` \| passou, 2 s \| passou, 2 s \| passou \|/);
    assert.match(md, /\| sim: rodei npm test e passou \|$/m, 'coluna do aceite');
    assert.match(md, /Estimativa em sessão única: 90 min/);
    // ❗ na estante, nenhuma sessão reaberta, e o cartão do roteiro continua sendo oferecido.
    const noMundo = m.porao.rodadasNoMundo()[0]!;
    assert.deepEqual(noMundo.gate, { estado: 'reprovada', comandos: ['npm test', 'npm run build'], quebrou: ['npm test'] });
    assert.equal(m.abertas.length, 2);
    assert.ok(m.porao.pedidosAbertos().some((p) => p.roteiro === r!.relatorio));
  });

  test('o que já estava vermelho e continua não reprova; o que voltou a passar é "consertou"', async () => {
    const m = montar('aprovada', ['t1']);
    m.gate.antes = { 'npm test': 1, 'npm run lint': 1 };
    m.gate.depois = { 'npm test': 1, 'npm run lint': 0 };
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test', 'npm run lint'] }]);
    await m.porao.gatesEmCurso();
    await m.porao.avancar([], () => m.abrir);
    m.devolver('t1');
    await m.porao.avancar([parada(idDe(m.abertas, 't1'))], () => m.abrir);
    await m.porao.gatesEmCurso();
    await m.porao.avancar([parada(idDe(m.abertas, 't1'))], () => m.abrir);
    const r = await lerRodada(m.dir);
    const md = fs.readFileSync(path.join(m.pasta, r!.relatorio!), 'utf8');
    assert.match(md, /^\*\*Aprovada:\*\*/m);
    assert.match(md, /\| `npm test` \| .* \| já estava vermelho \|/);
    assert.match(md, /\| `npm run lint` \| .* \| consertou \|/);
    assert.equal(m.porao.rodadasNoMundo()[0]!.gate?.estado, 'aprovada');
  });

  test('gongo durante a linha de base: encerra; o resultado que chega depois é descartado e nada abre', async () => {
    const m = montar('gongo-base', ['t1']);
    m.gate.prender();
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test', 'npm run build'] }]);
    await m.porao.esquecer('p', []);
    m.gate.soltar();
    await m.porao.gatesEmCurso();
    const r = await lerRodada(m.dir);
    assert.ok(r?.encerradaEm);
    assert.equal(r?.gate?.linhaDeBase?.fim, undefined, 'resultado descartado');
    assert.deepEqual(m.gate.rodados, ['antes:npm test'], 'o comando seguinte nem roda');
    await m.porao.avancar([], () => m.abrir);
    assert.equal(m.abertas.length, 0);
  });

  test('gongo durante o gate final: sem resultado e sem relatório', async () => {
    const m = montar('gongo-final', ['t1']);
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }]);
    await m.porao.gatesEmCurso();
    await m.porao.avancar([], () => m.abrir);
    m.devolver('t1');
    m.gate.prender();
    await m.porao.avancar([parada(idDe(m.abertas, 't1'))], () => m.abrir);
    await m.porao.esquecer('p', []);
    m.gate.soltar();
    await m.porao.gatesEmCurso();
    await m.porao.avancar([parada(idDe(m.abertas, 't1'))], () => m.abrir);
    const r = await lerRodada(m.dir);
    assert.equal(r?.gate?.final?.fim, undefined);
    assert.equal(r?.relatorio, undefined);
  });

  test('vila que caiu no meio da linha de base: a volta seguinte roda de novo, uma vez', async () => {
    const m = montar('caiu', ['t1']);
    m.gate.prender();
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }]);
    // Outra vila (outro processo) lendo o mesmo rodada.json: a linha de base sem fim é retomada por ela.
    const outra = new Porao(path.join(TMP, 'caiu', 'porao.json'), path.join(TMP, 'caiu', 'maestro.md'), path.join(TMP, 'caiu', 'rodadas'), '/x', async (comando) => ({ comando, codigo: 0, duracaoMs: 5 }));
    await outra.avancar([], () => m.abrir);
    await outra.avancar([], () => m.abrir);
    await outra.gatesEmCurso();
    assert.ok((await lerRodada(m.dir))?.gate?.linhaDeBase?.fim);
    await outra.avancar([], () => m.abrir);
    assert.equal(m.abertas.length, 1);
    m.gate.soltar();
    await m.porao.gatesEmCurso();
  });

  test('rodada sem testes: sem gate, abre no clique e o relatório diz "sem verificação automática"', async () => {
    const m = montar('sem-testes', ['t1']);
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'] }]);
    assert.equal(m.abertas.length, 1);
    m.devolver('t1');
    await m.porao.avancar([parada(idDe(m.abertas, 't1'))], () => m.abrir);
    const r = await lerRodada(m.dir);
    assert.equal(r?.gate, undefined);
    assert.equal(m.gate.rodados.length, 0);
    assert.match(fs.readFileSync(path.join(m.pasta, r!.relatorio!), 'utf8'), /^\*\*Sem verificação automática:\*\*/m);
    assert.equal(m.porao.rodadasNoMundo()[0]!.gate, null);
  });
});

describe('Medição: estimativa no pedido e tokens da conversa', () => {
  test('estimativaSessaoUnicaMin: opcional; número positivo vai para o rodada.json; outra coisa é recusada', async () => {
    const m = montar('estimativa', ['t1', 't2']);
    await m.porao.registrarMaestro('m1', 'p');
    for (const ruim of ['90', -5, 0, Number.NaN]) {
      const r = await m.porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'], estimativaSessaoUnicaMin: ruim }, 5, m.pasta);
      assert.equal((r as { status: number }).status, 400, String(ruim));
    }
    const sem = await m.porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t2'] }, 5, m.pasta);
    assert.ok(!('erro' in sem) && sem.estimativaSessaoUnicaMin === undefined);
    m.porao.recusar(sem.id);
    const p = await m.porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1'], estimativaSessaoUnicaMin: 45 }, 5, m.pasta);
    assert.ok(!('erro' in p));
    await m.porao.aprovar(p.id, m.abrir);
    assert.equal((await lerRodada(m.dir))?.estimativaSessaoUnicaMin, 45);
  });

  test('tokensDaConversa: cada resposta uma vez, sem <synthetic>, somando os subagentes; ilegível = null', async () => {
    const base = path.join(TMP, 'tokens');
    fs.mkdirSync(path.join(base, 'sessao', 'subagents'), { recursive: true });
    const linha = (id: string, u: object, model = 'claude-x') => JSON.stringify({ type: 'assistant', message: { id, model, usage: u, content: 'segredo' } });
    const u = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 };
    fs.writeFileSync(
      path.join(base, 'sessao.jsonl'),
      [linha('m1', u), linha('m1', u), JSON.stringify({ type: 'user', message: { content: 'oi' } }), linha('m2', u), linha('m3', u, '<synthetic>'), 'lixo'].join('\n') + '\n',
    );
    fs.writeFileSync(path.join(base, 'sessao', 'subagents', 'a.jsonl'), linha('s1', u) + '\n');
    assert.deepEqual(await tokensDaConversa(path.join(base, 'sessao.jsonl')), { entrada: 30, saida: 15, cacheCriado: 300, cacheLido: 3000 });
    assert.equal(await tokensDaConversa(path.join(base, 'nao-existe.jsonl')), null);
  });

  test('a tarefa pronta guarda os tokens da conversa dela; o relatório soma em "Custo e ganho"', async () => {
    const m = montar('custo', ['t1']);
    await aprovarRodada(m, [{ id: 't1', arquivos: ['a.ts'] }], { estimativaSessaoUnicaMin: 30 });
    const conversa = path.join(TMP, 'custo', 'conversa.jsonl');
    fs.writeFileSync(conversa, JSON.stringify({ type: 'assistant', message: { id: 'a', usage: { input_tokens: 1234, output_tokens: 56, cache_creation_input_tokens: 7, cache_read_input_tokens: 89000 } } }) + '\n');
    m.devolver('t1');
    await m.porao.avancar([parada(idDe(m.abertas, 't1'), conversa)], () => m.abrir);
    const r = await lerRodada(m.dir);
    assert.deepEqual(r?.tarefas.t1?.tokens, { entrada: 1234, saida: 56, cacheCriado: 7, cacheLido: 89000 });
    const md = fs.readFileSync(path.join(m.pasta, r!.relatorio!), 'utf8');
    assert.match(md, /^## Custo e ganho$/m);
    assert.match(md, /\| t1 \| 1\.234 \| 56 \| 7 \| 89\.000 \|/);
    assert.match(md, /\| \*\*Total\*\* \| 1\.234 \| 56 \| 7 \| 89\.000 \|/);
    assert.match(md, /a rodada levou \d+ min a menos que a estimativa/);
    assert.match(md, /^A estimativa foi declarada antes da rodada; não é medição\.$/m);
  });
});

describe('Aceite na devolutiva e relatório v3', () => {
  test('aceiteDe: sim/não e como conferiu; devolutiva antiga sem o campo = null', () => {
    assert.deepEqual(aceiteDe({ campos: { aceite: 'sim, rodei npm test' }, corpo: '' }), { ok: true, como: 'rodei npm test' });
    assert.deepEqual(aceiteDe({ campos: { aceite: 'não — o botão ainda some' }, corpo: '' }), { ok: false, como: 'o botão ainda some' });
    assert.deepEqual(aceiteDe({ campos: { aceite: 'Sim' }, corpo: '' }), { ok: true, como: '' });
    assert.equal(aceiteDe({ campos: {}, corpo: '' }), null);
    assert.equal(aceiteDe({ campos: { aceite: 'talvez' }, corpo: '' }), null);
    assert.equal(aceiteDe(null), null);
  });

  test('relatório: devolutiva antiga sai com aceite vazio; sem estimativa nem tokens, os números dizem que faltam', () => {
    const t0 = new Date(2026, 10, 11, 14, 0, 0).getTime();
    const r: Rodada = {
      versao: 2, rodada: '20261111-1400-x', projectId: 'p', pasta: '/x', aprovadaEm: t0,
      tarefas: { t1: { arquivos: ['a.ts'], testes: [], dependeDe: [], estado: 'pronta', sessionId: 's1', abertaEm: t0, prontaEm: t0 + 60_000 } },
    };
    const md = montarRelatorio(r, { t1: { campos: { testes: '1 → 1' }, corpo: 'Fez.' } }, () => 'Lia');
    assert.match(md, /\| Tarefa \| Sessão \| Tempo \| O que fez \| Arquivos \| Testes \| Aceite \|/);
    assert.match(md, /\| t1 \| Lia \| 1 min 0 s \| Fez\. \| `a\.ts` \| 1 → 1 \| - \|/);
    assert.match(md, /Estimativa em sessão única: não declarada/);
    assert.match(md, /\| t1 \| - \| - \| - \| - \|/);
    assert.doesNotMatch(md, /## Verificação/);
  });
});
