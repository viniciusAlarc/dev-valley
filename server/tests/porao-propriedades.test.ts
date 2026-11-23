import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import fc from 'fast-check';
import { Porao, type AbrirSessao, type SessaoAgora } from '../src/porao.js';
import { lerRodada } from '../src/rodada.js';

// Teste por propriedade da rodada do porão (RETRABALHO.md, 11/11/2026): o clique em "Abrir" (`aprovar`) e a volta
// automática (`avancar`) juntos abriam cada tarefa livre duas vezes. Os testes de exemplo cobriam cada função sozinha;
// aqui o fast-check sorteia a rodada (tarefas, dependências, terminais que não abrem) e a ORDEM em que tudo acontece
// (clique, voltas, terminais subindo devagar, devolutivas), e as invariantes têm que valer em todas.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-porao-prop-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

interface Cenario {
  deps: number[][]; // deps[i] = índices (< i) das tarefas que a tarefa i espera
  falha: number[]; // tarefas cujo terminal não abre
  voltas: number[]; // quantas voltas automáticas correm junto em cada rodada da vila
}

const cenario: fc.Arbitrary<Cenario> = fc.integer({ min: 1, max: 5 }).chain((n) =>
  fc.record({
    deps: fc.tuple(...Array.from({ length: n }, (_, i) => fc.subarray(Array.from({ length: i }, (_, j) => j)))),
    falha: fc.subarray(Array.from({ length: n }, (_, i) => i), { maxLength: Math.min(2, n) }),
    voltas: fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 4 }),
  }),
);

let execucao = 0;

async function rodar(c: Cenario, s: fc.Scheduler): Promise<void> {
  const nome = (i: number) => `t${i}`;
  const n = c.deps.length;
  const base = path.join(TMP, String(execucao++));
  const rodadas = path.join(base, 'rodadas');
  const pasta = path.join(base, 'casa');
  const dir = path.join(rodadas, 'r1');
  fs.mkdirSync(path.join(dir, 'briefings'), { recursive: true });
  fs.mkdirSync(pasta, { recursive: true });
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, 'briefings', `${nome(i)}.md`), '# briefing');

  const porao = new Porao(path.join(base, 'porao.json'), path.join(base, 'maestro.md'), rodadas, '/scripts/porao-hook.sh', async (comando) => ({ comando, codigo: 0, duracaoMs: 1 }));
  const aberturas: string[] = []; // cada chamada ao terminal, na ordem
  const sessoes = new Map<string, string>(); // tarefa → sessão que abriu
  const devolvidas = new Set<string>();
  const cedo: string[] = [];

  const abrir: AbrirSessao = async (id, prompt) => {
    const t = /\/(t\d+)\.md$/.exec(prompt)![1]!;
    const i = Number(t.slice(1));
    for (const d of c.deps[i]!) if (!devolvidas.has(nome(d))) cedo.push(`${t} abriu antes de ${nome(d)} devolver`);
    aberturas.push(t);
    await s.schedule(Promise.resolve(), `terminal de ${t} subindo`); // a abertura lenta, como a do terminal de verdade
    if (c.falha.includes(i)) return 'o terminal não abriu';
    sessoes.set(t, id);
    return null;
  };
  const devolver = (t: string) => {
    fs.mkdirSync(path.join(dir, 'devolutivas'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'devolutivas', `${t}.md`), `---\ntarefa: ${t}\narquivos: ${t}.ts\ntestes: 1/1 → 1/1\nmexeu_em_tela: não\nficou_de_fora: nada\n---\nFeito.\n`);
    devolvidas.add(t);
  };
  const agora = (): SessaoAgora[] => [...sessoes.values()].map((id) => ({ id, live: true, status: 'idle', name: `Nome-${id.slice(0, 4)}` }));

  await porao.registrarMaestro('m1', 'p');
  const tarefas = c.deps.map((d, i) => ({ id: nome(i), arquivos: [`${nome(i)}.ts`], dependeDe: d.map(nome) }));
  const pedido = await porao.pedir({ maestro: 'm1', rodada: 'r1', tarefas }, 5, pasta);
  assert.ok(!('erro' in pedido), JSON.stringify(pedido));

  // A vila: o clique e as voltas automáticas correm juntos; quem abriu devolve no meio do caminho. As voltas vêm em
  // cadeia (cada uma agenda a próxima, como o `refreshWorld`), para sempre haver uma pendente competindo com o
  // terminal que está subindo: é nessa janela que a corrida de 11/11 abria a mesma tarefa duas vezes.
  const cadeia = async (rodada: number, voltas: number) => {
    for (let v = 0; v < voltas; v++) {
      await s.schedule(Promise.resolve(), `volta ${rodada}.${v}`);
      await porao.avancar(agora(), () => abrir);
    }
  };
  for (let rodada = 0; rodada < 2 * n + 3; rodada++) {
    const trabalhos: Promise<unknown>[] = [cadeia(rodada, c.voltas[rodada % c.voltas.length]!)];
    if (rodada === 0) trabalhos.push(porao.aprovar(pedido.id, abrir));
    for (const t of sessoes.keys()) if (!devolvidas.has(t)) trabalhos.push(s.schedule(Promise.resolve(), `${t} devolve`).then(() => devolver(t)));
    await s.waitFor(Promise.all(trabalhos));
  }
  await porao.avancar(agora(), () => abrir); // uma última volta, sozinha

  // 1. Uma sessão por tarefa: nenhuma tarefa chama o terminal duas vezes.
  const repetidas = aberturas.filter((t, i) => aberturas.indexOf(t) !== i);
  assert.deepEqual(repetidas, [], `tarefa aberta mais de uma vez (${aberturas.join(', ')})`);
  // 2. Nenhuma tarefa abre antes de as donas devolverem.
  assert.deepEqual(cedo, []);
  // 3. Quem não abriu sai do registro do porão: só as sessões de verdade ocupam vaga no teto.
  const registro = JSON.parse(fs.readFileSync(path.join(base, 'porao.json'), 'utf8')) as { tarefas: Record<string, unknown> };
  assert.equal(Object.keys(registro.tarefas).length, sessoes.size);
  // 4. Nada trava: toda tarefa que não depende (direta ou indiretamente) de um terminal que falhou abre e fica pronta.
  const bloqueada = (i: number): boolean => c.falha.includes(i) || c.deps[i]!.some(bloqueada);
  const r = (await lerRodada(dir))!;
  for (let i = 0; i < n; i++) {
    // Dona bloqueada: nunca tenta abrir (esperando). Livre mas o terminal falhou: erro. O resto: pronta.
    const esperado = c.deps[i]!.some(bloqueada) ? 'esperando' : c.falha.includes(i) ? 'erro' : 'pronta';
    assert.equal(r.tarefas[nome(i)]!.estado, esperado, `${nome(i)} (depende de ${c.deps[i]!.map(nome).join(', ') || 'ninguém'})`);
  }
  // 5. Sem terminal que falhou, a vila monta o relatório.
  if (!c.falha.length) assert.ok(r.relatorio, 'rodada inteira pronta e sem relatório');
}

describe('porão: aprovar e avancar juntos, em qualquer ordem (teste por propriedade)', () => {
  test('uma sessão por tarefa, dependências respeitadas, registro limpo e nada travado', async () => {
    await fc.assert(fc.asyncProperty(cenario, fc.scheduler(), rodar), { numRuns: 100 });
  });
});
