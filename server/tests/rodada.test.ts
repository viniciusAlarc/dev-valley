import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import type { ExecutarComando } from '../src/gate.js';
import { Porao, type AbrirSessao, type SessaoAgora } from '../src/porao.js';
import { HOOK_SCRIPT, lerDevolutiva, lerRodada, montarRelatorio, settingsDaTarefa, validarDependencias, type Rodada } from '../src/rodada.js';

// Maestro v2 (docs-dev/a-codar/maestro-v2.md): a vila conduz a rodada. Tudo em pasta temporária, nunca em ~/.claude.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-rodada-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const DEVOLUTIVA = (extra = '') => `---\ntarefa: t1\narquivos: a.ts, b.ts\ntestes: 10/10 → 12/12\nmexeu_em_tela: não\nficou_de_fora: nada\n${extra}---\nFez a coisa pedida.\n`;

/** Porão com o maestro m1 do projeto p e os briefings da rodada r1; a pasta do projeto existe (o relatório vai nela). */
function montar(nome: string, briefings: string[]) {
  const base = path.join(TMP, nome);
  const rodadas = path.join(base, 'rodadas');
  const pasta = path.join(base, 'casa');
  fs.mkdirSync(path.join(rodadas, 'r1', 'briefings'), { recursive: true });
  fs.mkdirSync(pasta, { recursive: true });
  for (const t of briefings) fs.writeFileSync(path.join(rodadas, 'r1', 'briefings', `${t}.md`), '# briefing');
  // Gate (maestro v3) de mentira: o resultado de cada comando vem de `gate` (padrão: passa); nenhum comando de verdade roda.
  const gate: { antes: Record<string, number | null>; depois: Record<string, number | null>; rodados: string[]; segurar?: Promise<void> } = { antes: {}, depois: {}, rodados: [] };
  const executar: ExecutarComando = async (comando, _cwd, saida) => {
    const momento = path.basename(saida).startsWith('antes') ? 'antes' : 'depois';
    gate.rodados.push(`${momento}:${comando}`);
    if (gate.segurar) await gate.segurar;
    return { comando, codigo: gate[momento][comando] === undefined ? 0 : gate[momento][comando]!, duracaoMs: 1000 };
  };
  const porao = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), rodadas, '/scripts/porao-hook.sh', executar);
  const dir = path.join(rodadas, 'r1');
  const abertas: { id: string; prompt: string; permitir: string[]; settings?: string; projeto?: string }[] = [];
  const abrir: AbrirSessao = async (id, prompt, permitir, settings) => (abertas.push({ id, prompt, permitir, settings }), null);
  const abrirNo = (projeto: string): AbrirSessao => async (id, prompt, permitir, settings) => (abertas.push({ id, prompt, permitir, settings, projeto }), null);
  const devolver = (t: string, texto = DEVOLUTIVA()) => {
    fs.mkdirSync(path.join(dir, 'devolutivas'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'devolutivas', `${t}.md`), texto);
  };
  return { porao, pasta, dir, abertas, abrir, abrirNo, devolver, gate };
}

const idDe = (abertas: { id: string; prompt: string }[], t: string) => abertas.find((a) => a.prompt.endsWith(`/${t}.md`))!.id;
const parada = (id: string): SessaoAgora => ({ id, live: true, status: 'idle', name: `Nome-${id.slice(0, 4)}` });
const trabalhando = (id: string): SessaoAgora => ({ id, live: true, status: 'working' });

describe('validarDependencias', () => {
  test('sem dependência, ou em cadeia, passa; de si mesma, desconhecida ou em ciclo, não', () => {
    assert.equal(validarDependencias({ t1: [], t2: [] }), null);
    assert.equal(validarDependencias({ t1: [], t2: ['t1'], t3: ['t2', 't1'] }), null);
    assert.match(validarDependencias({ t1: ['t1'] })!, /si mesma/);
    assert.match(validarDependencias({ t1: ['t9'] })!, /não está no pedido/);
    assert.match(validarDependencias({ t1: ['t3'], t2: ['t1'], t3: ['t2'] })!, /ciclo/);
  });
});

describe('lerDevolutiva', () => {
  test('cabeçalho vira campos, o resto é o corpo; sem cabeçalho, tudo é corpo; vazia ou ausente, null', async () => {
    const f = path.join(TMP, 'dev.md');
    fs.writeFileSync(f, DEVOLUTIVA());
    const d = await lerDevolutiva(f);
    assert.equal(d?.campos.testes, '10/10 → 12/12');
    assert.equal(d?.campos.mexeu_em_tela, 'não');
    assert.equal(d?.corpo, 'Fez a coisa pedida.');
    fs.writeFileSync(f, 'só texto');
    assert.deepEqual(await lerDevolutiva(f), { campos: {}, corpo: 'só texto' });
    fs.writeFileSync(f, '  \n');
    assert.equal(await lerDevolutiva(f), null);
    assert.equal(await lerDevolutiva(path.join(TMP, 'nao-existe.md')), null);
  });
});

describe('montarRelatorio', () => {
  test('uma linha por tarefa com nome, tempo, o que fez, arquivos e testes; pendências e roteiro no fim', () => {
    const t0 = new Date(2026, 10, 11, 14, 0, 0).getTime();
    const r: Rodada = {
      versao: 2, rodada: '20261111-1400-quadro-porao', projectId: 'p', pasta: '/x', aprovadaEm: t0,
      tarefas: {
        t1: { arquivos: ['a.ts'], testes: [], dependeDe: [], estado: 'pronta', sessionId: 's1', abertaEm: t0, prontaEm: t0 + 250_000 },
        t2: { arquivos: ['b.ts'], testes: [], dependeDe: ['t1'], estado: 'pronta', sessionId: 's2', abertaEm: t0 + 250_000, prontaEm: t0 + 600_000 },
      },
    };
    const md = montarRelatorio(r, {
      t1: { campos: { testes: '1 → 2', arquivos: 'a.ts', mexeu_em_tela: 'sim', ficou_de_fora: 'nada' }, corpo: 'Fez | a\nprimeira.' },
      t2: { campos: { ficou_de_fora: 'falta o ícone' }, corpo: 'Fez a segunda.' },
    }, (id) => (id === 's1' ? 'Lia' : 'Caio'));
    assert.match(md, /^# Rodada: quadro porao$/m);
    assert.match(md, /11\/11\/2026 · 2 sessões · 14:00 → 14:10 · 10 min 0 s/);
    assert.match(md, /\| t1 \| Lia \| 4 min 10 s \| Fez \\\| a primeira\. \| `a\.ts` \| 1 → 2 \|/);
    assert.match(md, /\| t2 \| Caio \| 5 min 50 s \| Fez a segunda\. \| `b\.ts` \| - \|/);
    assert.match(md, /\*\*Ficou de fora \/ pendências:\*\* t2: falta o ícone/);
    assert.match(md, /\*\*Roteiro de testes:\*\* a fazer/);
    assert.doesNotMatch(md, /Lastro na spec/, 'devolutivas sem os campos (antigas): sem a seção');
  });

  test('lastro na spec: tabela por tarefa, aviso de fora da spec e de lastro não informado (21/11/2026)', () => {
    const r: Rodada = {
      versao: 2, rodada: '20261121-1000-lastro', projectId: 'p', pasta: '/x', aprovadaEm: 0,
      tarefas: {
        t1: { arquivos: ['a.ts'], testes: [], dependeDe: [], estado: 'pronta' },
        t2: { arquivos: ['b.ts'], testes: [], dependeDe: [], estado: 'pronta' },
        t3: { arquivos: ['c.ts'], testes: [], dependeDe: [], estado: 'pronta' },
      },
    };
    const md = montarRelatorio(r, {
      t1: { campos: { lastro: 'RN-01, MSG-14 (Consultar v1.3)', fora_da_spec: 'nada', revisao: 'spec sem achado' }, corpo: 'a' },
      t2: { campos: { lastro: 'RN-02', fora_da_spec: 'ordenação por nome', revisao: '1 confirmado, corrigido' }, corpo: 'b' },
      t3: { campos: {}, corpo: 'c' },
    }, () => '-');
    assert.match(md, /^## Lastro na spec$/m);
    assert.match(md, /\| t1 \| RN-01, MSG-14 \(Consultar v1\.3\) \| nada \| spec sem achado \|/);
    assert.match(md, /\| t3 \| não informado \| não informado \| não informado \|/);
    assert.match(md, /\*\*Fora da spec em t2:\*\*/);
    assert.match(md, /\*\*Sem lastro informado em t3:\*\*/);
  });
});

describe('settingsDaTarefa', () => {
  test('Stop e PreToolUse só desta tarefa, com o script e a pasta da rodada', () => {
    const s = JSON.parse(settingsDaTarefa('/home/u/.claude/maestro/rodadas/r1', 't2', '/repo/scripts/porao-hook.sh'));
    assert.equal(s.hooks.Stop[0].hooks[0].command, "bash '/repo/scripts/porao-hook.sh' parar '/home/u/.claude/maestro/rodadas/r1' t2");
    assert.equal(s.hooks.PreToolUse[0].matcher, 'Edit|Write|MultiEdit|NotebookEdit');
    assert.equal(s.hooks.PreToolUse[1].matcher, 'Bash');
    assert.match(s.hooks.PreToolUse[1].hooks[0].command, / bash '\/home\/u\/\.claude\/maestro\/rodadas\/r1' t2$/);
    assert.match(s.hooks.PreToolUse[0].hooks[0].command, / posse '\/home\/u\/\.claude\/maestro\/rodadas\/r1' t2$/);
    assert.throws(() => settingsDaTarefa("/tmp/a'b", 't1'));
  });

  test('a sessão de trabalho vai no Sonnet, sem depender do modelo do maestro (20/11/2026)', () => {
    assert.equal(JSON.parse(settingsDaTarefa('/tmp/r1', 't1')).model, 'sonnet');
  });
});

describe('Porao v2: o clique aprova a rodada inteira, a vila conduz', () => {
  test('pedido com dependência desconhecida ou em ciclo é recusado', async () => {
    const { porao, pasta } = montar('dep-ruim', ['t1', 't2']);
    await porao.registrarMaestro('m1', 'p');
    const r = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], dependeDe: ['t9'] }] }, 5, pasta);
    assert.equal((r as { status: number }).status, 400);
    const c = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], dependeDe: ['t2'] }, { id: 't2', arquivos: ['b.ts'], dependeDe: ['t1'] }] }, 5, pasta);
    assert.match((c as { erro: string }).erro, /ciclo/);
  });

  test('aprovar grava o rodada.json e abre só quem não depende de ninguém, com regras e hooks', async () => {
    const { porao, pasta, dir, abertas, abrir } = montar('aprovar', ['t1', 't2']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }, { id: 't2', arquivos: ['a.ts', 'b.ts'], dependeDe: ['t1'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    assert.deepEqual(pedido.dependencias, { t1: [], t2: ['t1'] });
    await porao.aprovar(pedido.id, abrir);
    // t1 traz comando de teste: a linha de base roda antes de qualquer tarefa abrir (maestro v3).
    assert.equal(abertas.length, 0, 'conferindo a linha de base');
    assert.equal((await lerRodada(dir))?.tarefas.t1?.estado, 'esperando');
    await porao.gatesEmCurso();
    await porao.avancar([], () => abrir);
    assert.equal(abertas.length, 1, 't2 espera t1');
    assert.equal(JSON.parse(abertas[0]!.settings!).hooks.Stop[0].hooks[0].command, `bash '/scripts/porao-hook.sh' parar '${dir}' t1`);
    const r = await lerRodada(dir);
    assert.equal(r?.tarefas.t1?.estado, 'aberta');
    assert.equal(r?.tarefas.t1?.sessionId, abertas[0]!.id);
    assert.equal(r?.tarefas.t2?.estado, 'esperando');
    assert.equal(r?.pasta, pasta);
    // O teto conta também quem espera a vez.
    const mais = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: ['t1b'] }, 2, pasta);
    assert.equal((mais as { status: number }).status, 409);
  });

  test('pronta = devolutiva e sessão parada; a dependente abre no projeto dela; com todas prontas, o relatório sai', async () => {
    const { porao, pasta, dir, abertas, abrir, abrirNo, devolver } = montar('conduzir', ['t1', 't2']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }, { id: 't2', arquivos: ['b.ts'], dependeDe: ['t1'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    await porao.aprovar(pedido.id, abrir);
    const s1 = idDe(abertas, 't1');

    // Trabalhando: nada muda; o quadro mostra t1 aberta e t2 esperando.
    await porao.avancar([trabalhando(s1)], abrirNo);
    assert.deepEqual(porao.rodadasNoMundo()[0]!.tarefas.map((t) => [t.id, t.estado, t.parouSemTerminar]), [['t1', 'aberta', false], ['t2', 'esperando', false]]);
    // Parou sem devolutiva: precisa do usuário.
    await porao.avancar([parada(s1)], abrirNo);
    assert.equal(porao.rodadasNoMundo()[0]!.tarefas[0]!.parouSemTerminar, true);
    // Devolutiva gravada mas ainda trabalhando: espera ela parar.
    devolver('t1');
    await porao.avancar([trabalhando(s1)], abrirNo);
    assert.equal((await lerRodada(dir))?.tarefas.t1?.estado, 'aberta');
    // Parou com a devolutiva: pronta, e t2 abre sozinha no projeto da rodada.
    assert.equal(await porao.avancar([parada(s1)], abrirNo), true);
    assert.equal((await lerRodada(dir))?.tarefas.t1?.estado, 'pronta');
    assert.equal(abertas.length, 2);
    assert.equal(abertas[1]!.projeto, 'p');
    assert.match(abertas[1]!.prompt, /briefings\/t2\.md$/);
    const papeis = await porao.papeis();
    assert.deepEqual(papeis.get(abertas[1]!.id), { papel: 'tarefa', rodada: 'r1', tarefa: 't2' }, 'anotada no porão');

    // t2 termina e mexeu em tela: relatório na pasta do projeto e cartão do roteiro na estante.
    devolver('t2', DEVOLUTIVA().replace('mexeu_em_tela: não', 'mexeu_em_tela: sim'));
    await porao.avancar([parada(s1), parada(abertas[1]!.id)], abrirNo);
    const r = await lerRodada(dir);
    assert.ok(r?.relatorio?.startsWith('docs-dev/maestro/'));
    const md = fs.readFileSync(path.join(pasta, r!.relatorio!), 'utf8');
    assert.match(md, /\| t1 \| Nome-/);
    assert.match(md, /\| t2 \|/);
    const roteiro = porao.pedidosAbertos().find((p) => p.roteiro);
    assert.equal(roteiro?.roteiro, r!.relatorio);
    // Outra volta não remonta nem pede outro roteiro.
    await porao.avancar([parada(s1), parada(abertas[1]!.id)], abrirNo);
    assert.equal(porao.pedidosAbertos().filter((p) => p.roteiro).length, 1);
    assert.equal(fs.readdirSync(path.join(pasta, 'docs-dev', 'maestro')).length, 1);
  });

  test('sessão fechada (vila reiniciou) com a devolutiva também conta como pronta; sem roteiro se ninguém mexeu em tela', async () => {
    const { porao, pasta, dir, abertas, abrir, abrirNo, devolver } = montar('fechada', ['t1']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    await porao.aprovar(pedido.id, abrir);
    devolver('t1');
    await porao.avancar([], abrirNo);
    assert.equal((await lerRodada(dir))?.tarefas.t1?.estado, 'pronta');
    assert.ok((await lerRodada(dir))?.relatorio);
    assert.equal(porao.pedidosAbertos().length, 0);
    assert.equal(abertas.length, 1);
  });

  test('a que não abriu fica com o erro; a dependente dela nunca abre e o relatório sai com o que ficou pronto', async () => {
    const { porao, pasta, dir, abertas, abrirNo, devolver } = montar('erro', ['t1', 't2', 't3']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }, { id: 't2', arquivos: ['b.ts'] }, { id: 't3', arquivos: ['c.ts'], dependeDe: ['t2'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    await porao.aprovar(pedido.id, async (id, prompt, permitir, settings) => (abertas.push({ id, prompt, permitir, settings }), prompt.endsWith('/t2.md') ? 'perfil sem configuração' : null));
    const r0 = await lerRodada(dir);
    assert.equal(r0?.tarefas.t2?.estado, 'erro');
    assert.equal(r0?.tarefas.t2?.erro, 'perfil sem configuração');
    devolver('t1');
    await porao.avancar([parada(idDe(abertas, 't1'))], abrirNo);
    const r = await lerRodada(dir);
    assert.equal(r?.tarefas.t3?.estado, 'esperando');
    assert.ok(r?.relatorio, 'nada mais pode abrir: relatório com o que ficou pronto');
  });

  test('o gongo encerra a rodada: sai do quadro e nada mais abre', async () => {
    const { porao, pasta, dir, abertas, abrir, abrirNo, devolver } = montar('gongo', ['t1', 't2']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }, { id: 't2', arquivos: ['b.ts'], dependeDe: ['t1'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    await porao.aprovar(pedido.id, abrir);
    await porao.avancar([], abrirNo);
    assert.equal(porao.rodadasNoMundo().length, 1);
    await porao.esquecer('p', [abertas[0]!.id]);
    assert.equal(porao.rodadasNoMundo().length, 0);
    assert.ok((await lerRodada(dir))?.encerradaEm);
    devolver('t1');
    await porao.avancar([], abrirNo);
    assert.equal(abertas.length, 1, 't2 não abre depois do gongo');
    assert.equal(porao.rodadasNoMundo().length, 0);
  });

  test('corrida de 11/11: clique e volta automática ao mesmo tempo, com abertura lenta, abrem cada tarefa uma vez só', async () => {
    const { porao, pasta, dir } = montar('corrida', ['A1a', 'A1b', 'A5', 'A2']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [
      { id: 'A1a', arquivos: ['a'] }, { id: 'A1b', arquivos: ['b'] }, { id: 'A5', arquivos: ['c'] }, { id: 'A2', arquivos: ['d'], dependeDe: ['A1a'] },
    ] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    const abertas: string[] = [];
    // Subir um terminal de verdade leva tempo: é nessa janela que a volta automática abria de novo.
    const lento: AbrirSessao = async (_id, prompt) => (abertas.push(prompt.split('/').pop()!), await new Promise((r) => setTimeout(r, 120)), null);
    const clique = porao.aprovar(pedido.id, lento);
    const voltas = [10, 60, 130, 250].map((ms) => new Promise((r) => setTimeout(r, ms)).then(() => porao.avancar([], () => lento)));
    await Promise.all([clique, ...voltas]);
    await porao.avancar([], () => lento);
    assert.deepEqual(abertas.sort(), ['A1a.md', 'A1b.md', 'A5.md'], 'uma sessão por tarefa livre; A2 espera A1a');
    const r = await lerRodada(dir);
    assert.deepEqual(Object.values(r!.tarefas).map((t) => t.estado).sort(), ['aberta', 'aberta', 'aberta', 'esperando']);
    assert.equal((await porao.papeis()).size, 4, 'maestro + 3 tarefas anotadas, nada em dobro');
  });

  test('pedido que repete tarefa já na rodada é recusado (uma sessão por tarefa)', async () => {
    const { porao, pasta, abrir } = montar('repetida', ['t1']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    await porao.aprovar(pedido.id, abrir);
    const de_novo = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'] }] }, 5, pasta);
    assert.equal((de_novo as { status: number }).status, 409);
  });

  test('"abrindo" que sobrou de uma vila que caiu: com sessão vira aberta, sem sessão volta a esperar; nunca abre por cima', async () => {
    const { porao, pasta, dir, abrirNo, abertas } = montar('abrindo', ['t1', 't2']);
    fs.mkdirSync(dir, { recursive: true });
    const r: Rodada = {
      versao: 2, rodada: 'r1', projectId: 'p', pasta, aprovadaEm: 1,
      tarefas: {
        t1: { arquivos: ['a'], testes: [], dependeDe: [], estado: 'abrindo', sessionId: 's1' },
        t2: { arquivos: ['b'], testes: [], dependeDe: ['t1'], estado: 'abrindo' },
      },
    };
    fs.writeFileSync(path.join(dir, 'rodada.json'), JSON.stringify({ ...r }));
    await porao.avancar([trabalhando('s1')], abrirNo);
    const depois = await lerRodada(dir);
    assert.equal(depois?.tarefas.t1?.estado, 'aberta');
    assert.equal(depois?.tarefas.t2?.estado, 'esperando');
    assert.equal(abertas.length, 0);
  });

  test('retomada (MA-3): a tarefa volta com as regras e os hooks com que nasceu; sessão comum, null', async () => {
    const { porao, pasta, dir, abertas, abrir } = montar('retomada', ['t1']);
    await porao.registrarMaestro('m1', 'p');
    const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas: [{ id: 't1', arquivos: ['a.ts'], testes: ['npm test'] }] }, 5, pasta);
    assert.ok(!('erro' in pedido));
    await porao.aprovar(pedido.id, abrir, ['/regras/**']);
    await porao.gatesEmCurso();
    await porao.avancar([], () => abrir, ['/regras/**']);
    const r = await porao.retomada(abertas[0]!.id, ['/regras/**']);
    assert.deepEqual(r?.permitir, abertas[0]!.permitir);
    assert.equal(r?.settings, abertas[0]!.settings);
    assert.ok(r?.permitir.includes(`Edit(/${path.join(dir, 'devolutivas', 't1.md')})`));
    assert.equal(await porao.retomada('outra'), null);
  });
});

describe('scripts/porao-hook.sh', () => {
  const temJq = spawnSync('jq', ['--version']).status === 0;
  const rodar = (modo: string, dir: string, tarefa: string, entrada: object) =>
    spawnSync('bash', [HOOK_SCRIPT, modo, dir, tarefa], { input: JSON.stringify(entrada), encoding: 'utf8' });

  test('parar: sem devolutiva, 2 com o aviso; com ela, ou na segunda volta, 0', { skip: !temJq && 'sem jq' }, () => {
    const dir = path.join(TMP, 'hook-parar');
    fs.mkdirSync(path.join(dir, 'devolutivas'), { recursive: true });
    const sem = rodar('parar', dir, 't1', { stop_hook_active: false });
    assert.equal(sem.status, 2);
    assert.match(sem.stderr, /devolutivas\/t1\.md/);
    assert.equal(rodar('parar', dir, 't1', { stop_hook_active: true }).status, 0);
    fs.writeFileSync(path.join(dir, 'devolutivas', 't1.md'), '---\ntarefa: t1\nlastro: RN-01\n---\nfeito');
    const semCampos = rodar('parar', dir, 't1', {});
    assert.equal(semCampos.status, 2, 'devolutiva sem os campos de lastro é lembrada');
    assert.match(semCampos.stderr, /sem: fora_da_spec revisao\./);
    assert.equal(rodar('parar', dir, 't1', { stop_hook_active: true }).status, 0, 'lembra uma vez só');
    fs.writeFileSync(path.join(dir, 'devolutivas', 't1.md'), '---\ntarefa: t1\nlastro: RN-01\nfora_da_spec: nada\nrevisao: não se aplica: sem rubrica\n---\nfeito');
    assert.equal(rodar('parar', dir, 't1', {}).status, 0);
  });

  test('posse: arquivo de outra tarefa aberta, 2; o seu, o de tarefa pronta ou esperando, o rastro e fora do projeto, 0', { skip: !temJq && 'sem jq' }, () => {
    const dir = path.join(TMP, 'hook-posse');
    const pasta = path.join(TMP, 'hook-casa');
    fs.mkdirSync(dir, { recursive: true });
    const r: Rodada = {
      versao: 2, rodada: 'r1', projectId: 'p', pasta, aprovadaEm: 0,
      tarefas: {
        t1: { arquivos: ['src/a.ts', 'PROGRESS.md'], testes: [], dependeDe: [], estado: 'aberta' },
        t2: { arquivos: ['src/b.ts', 'PROGRESS.md'], testes: [], dependeDe: [], estado: 'aberta' },
        t3: { arquivos: ['src/c.ts'], testes: [], dependeDe: [], estado: 'pronta' },
        t5: { arquivos: ['src/e.ts'], testes: [], dependeDe: [], estado: 'abrindo' },
        t4: { arquivos: ['src/d.ts'], testes: [], dependeDe: ['t1'], estado: 'esperando' },
      },
    };
    fs.writeFileSync(path.join(dir, 'rodada.json'), JSON.stringify(r));
    const editar = (arq: string) => rodar('posse', dir, 't1', { tool_name: 'Edit', tool_input: { file_path: arq } });
    const outra = editar(path.join(pasta, 'src', 'b.ts'));
    assert.equal(outra.status, 2);
    assert.match(outra.stderr, /src\/b\.ts é da tarefa t2/);
    assert.equal(editar(path.join(pasta, 'src', '..', 'src', 'b.ts')).status, 2, 'caminho com .. também');
    assert.equal(editar(path.join(pasta, 'src', 'a.ts')).status, 0);
    assert.equal(editar(path.join(pasta, 'src', 'e.ts')).status, 2, 'dona ainda abrindo também é dona');
    assert.equal(editar(path.join(pasta, 'src', 'c.ts')).status, 0, 'dona pronta');
    assert.equal(editar(path.join(pasta, 'src', 'd.ts')).status, 0, 'dona esperando');
    assert.equal(editar(path.join(pasta, 'PROGRESS.md')).status, 0, 'rastro soma');
    assert.equal(editar('/outro/lugar/b.ts').status, 0);
  });

  test('posse de arquivo que ninguém declarou: a primeira tarefa que edita fica dona até ficar pronta', { skip: !temJq && 'sem jq' }, () => {
    const dir = path.join(TMP, 'hook-reserva');
    const pasta = path.join(TMP, 'hook-reserva-casa');
    fs.mkdirSync(dir, { recursive: true });
    const gravar = (e1: string) => fs.writeFileSync(path.join(dir, 'rodada.json'), JSON.stringify({
      versao: 2, rodada: 'r1', projectId: 'p', pasta, aprovadaEm: 0,
      tarefas: { t1: { arquivos: ['a.ts'], testes: [], dependeDe: [], estado: e1 }, t2: { arquivos: ['b.ts'], testes: [], dependeDe: [], estado: 'aberta' } },
    }));
    gravar('aberta');
    const editar = (t: string, rel: string) => rodar('posse', dir, t, { tool_name: 'Edit', tool_input: { file_path: path.join(pasta, rel) } });
    assert.equal(editar('t1', 'comum.ts').status, 0, 't1 pega o arquivo livre');
    assert.equal(editar('t1', 'comum.ts').status, 0, 'e continua editando');
    const t2 = editar('t2', 'comum.ts');
    assert.equal(t2.status, 2, 't2 não edita enquanto t1 trabalha');
    assert.match(t2.stderr, /comum\.ts é da tarefa t1/);
    assert.equal(editar('t2', 'PENDENCIAS.md').status, 0, 'rastro não tem dona');
    gravar('pronta');
    assert.equal(editar('t2', 'comum.ts').status, 0, 't1 pronta: passa para t2');
    assert.equal(fs.readFileSync(path.join(dir, 'posse', 'comum.ts'), 'utf8').trim(), 't2');
  });

  test('bash: escrever arquivo e git que mexe no repositório são recusados; ler e testar passam', { skip: !temJq && 'sem jq' }, () => {
    const dir = path.join(TMP, 'hook-bash');
    fs.mkdirSync(dir, { recursive: true });
    const roda = (command: string) => rodar('bash', dir, 't1', { tool_name: 'Bash', tool_input: { command } });
    for (const c of [
      "printf 'x' >> src/soma.js",
      'sed -i "s/a/b/" src/soma.js',
      'sed -n 1p a; sed --in-place s/a/b/ b',
      'cat > src/novo.js <<EOF',
      'echo oi | tee src/a.js',
      'cp a.js b.js',
      'rm -f src/a.js',
      'git add .',
      'git -C /x commit -m oi',
      'cd proj && git stash',
    ]) assert.equal(roda(c).status, 2, c);
    for (const c of [
      'npm test 2>&1 | tail -15',
      'cat src/soma.js test/soma.test.js',
      "grep -n '<h1>' public/index.html",
      'grep -E "a>b|c" x 2>/dev/null',
      'node --test > /dev/null',
      'git status --short; git diff src/a.js; git log -3',
      'ls -R src test',
      'sed -n 1,20p src/soma.js',
    ]) assert.equal(roda(c).status, 0, c);
  });
});
