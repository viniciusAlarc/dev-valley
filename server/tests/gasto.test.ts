import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { Gasto, janelaDe, pesoDe } from '../src/gasto.js';
import { preverLimite } from '../src/statusline.js';
import type { Project } from '../src/world.js';
import { subir } from './servidor.js';
import { projeto } from './util.js';

// Moinho (02/11/2026): peso = entrada + saída + criação de cache + leitura ÷ 10; semana do plano; perfis separados.
const AGORA = Date.parse('2026-11-05T12:00:00Z');
const USAGE = { rows: [{ kind: 'weekly_all', group: '', label: '', percent: 10, resetsAt: '2026-11-08T10:00:00Z', severity: 'normal' }], updatedAt: 0 };

const resposta = (id: string, quando: string, u: object, extra: object = {}) =>
  JSON.stringify({ type: 'assistant', timestamp: quando, message: { id, model: 'claude', usage: u }, ...extra }) + '\n';

async function cenario() {
  const repo = await projeto();
  const prof = await projeto({
    // sessão do projeto: a mesma resposta repetida em 3 linhas (uma por bloco) conta uma vez só
    's1.jsonl':
      JSON.stringify({ type: 'user', cwd: `${repo}/sub` }) +
      '\n' +
      resposta('m1', '2026-11-04T10:00:00Z', { input_tokens: 100, output_tokens: 50 }).repeat(3) +
      resposta('m2', '2026-11-04T11:00:00Z', { cache_read_input_tokens: 1000, cache_creation_input_tokens: 10 }),
    // subagente da s1 gasta na conta dela
    's1/subagents/agent-a.jsonl': resposta('m3', '2026-11-04T12:00:00Z', { output_tokens: 40 }, { cwd: repo }),
    // sessão avulsa (fora de projeto), e uma resposta da semana anterior
    's2.jsonl':
      resposta('m4', '2026-11-03T10:00:00Z', { input_tokens: 5 }, { cwd: '/fora' }) +
      resposta('m5', '2026-10-30T10:00:00Z', { input_tokens: 70 }, { cwd: '/fora' }) +
      resposta('m6', '2026-11-03T10:00:00Z', { input_tokens: 999 }, { cwd: '/fora', message: undefined }),
  });
  const pessoal = await projeto({ 'p1.jsonl': resposta('m7', '2026-11-04T10:00:00Z', { input_tokens: 30 }, { cwd: repo }) });
  const cacheFile = path.join(await projeto(), 'gasto.json');
  const projects = [{ id: 'r', name: 'repo', path: repo } as Project];
  const dirs = () => [
    { dir: prof, perfil: 'profissional' as const },
    { dir: pessoal, perfil: 'pessoal' as const },
  ];
  return { prof, cacheFile, gasto: new Gasto({ perfilPessoal: null }, () => projects, cacheFile, dirs) };
}

describe('moinho: gasto por projeto', () => {
  test('peso: leitura de cache vale 1/10', () => {
    assert.equal(pesoDe({ input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 40 }), 10);
    assert.equal(pesoDe(null), 0);
  });

  test('janela: semana do plano pelo reset semanal; sem ele, últimos 7 dias', () => {
    assert.deepEqual(janelaDe(USAGE, AGORA), { inicio: Date.parse('2026-11-01T10:00:00Z'), fim: Date.parse('2026-11-08T10:00:00Z'), fonte: 'plano' });
    assert.equal(janelaDe(null, AGORA).fonte, '7dias');
  });

  test('soma por projeto e perfil, sem contar a repetição, com subagente na conta da sessão', async () => {
    const { gasto } = await cenario();
    const v = await gasto.resumo(USAGE, AGORA);
    const [prof, pessoal] = v.perfis;
    assert.equal(prof!.perfil, 'profissional');
    // repo: m1 (150) + m2 (100 + 10) + m3 (40) = 300; praça: m4 (5); semana anterior: m5 (70)
    assert.deepEqual(
      prof!.projetos.map((p) => [p.nome, p.peso]),
      [
        ['repo', 300],
        ['Praça (sessões avulsas)', 5],
      ],
    );
    assert.deepEqual(prof!.projetos[0]!.sessoes, [{ id: 's1', peso: 300 }]);
    assert.equal(prof!.total, 305);
    assert.equal(prof!.anterior, 70);
    assert.deepEqual([pessoal!.perfil, pessoal!.total], ['pessoal', 30]);
  });

  test('incremental: lê só o que cresceu, ignora linha pela metade e esquece arquivo apagado', async () => {
    const { gasto, prof, cacheFile } = await cenario();
    await gasto.atualizar();
    await fs.appendFile(path.join(prof, 's2.jsonl'), resposta('m8', '2026-11-04T09:00:00Z', { input_tokens: 20 }) + '{"type":"assis');
    assert.equal(await gasto.atualizar(), true);
    assert.equal(await gasto.atualizar(), false, 'nada novo: não relê');
    let v = await gasto.resumo(USAGE, AGORA);
    assert.equal(v.perfis[0]!.projetos.find((p) => p.projectId === null)!.peso, 25);
    await fs.rm(path.join(prof, 's2.jsonl'));
    v = await gasto.resumo(USAGE, AGORA + 10 * 60_000);
    assert.equal(v.perfis[0]!.projetos.find((p) => p.projectId === null), undefined);
    assert.ok(!(await fs.readFile(cacheFile, 'utf8')).includes('s2.jsonl'));
  });

  test('rota GET /api/gasto usa os limites do mundo e traz a previsão deles', async () => {
    const { gasto } = await cenario();
    const limite = { label: 'Sessão atual (5h)', group: 'session', percent: 40, resetsAt: null, porHora: 20, estouraEm: 1, aoRenovar: null };
    const s = await subir({}, { gasto, statusLine: { handle: () => false, ritmo: () => [limite] } });
    const r = await s.get('/api/gasto');
    assert.equal(r.status, 200);
    const corpo = (await r.json()) as { perfis: unknown[]; limites: unknown[] };
    assert.ok(Array.isArray(corpo.perfis));
    assert.deepEqual(corpo.limites, [limite]);
  });
});

describe('Moinho: previsão dos limites do plano (08/11/2026)', () => {
  const MIN = 60_000;
  const H = 60 * MIN;
  const sessao = (percent: number, renovaEm: number | null) => ({
    kind: 'five_hour', group: 'session', label: 'Sessão atual (5h)', percent, severity: 'normal',
    resetsAt: renovaEm === null ? null : new Date(AGORA + renovaEm).toISOString(),
  });

  test('sessão de 5h: ritmo da última hora; estoura antes de renovar', () => {
    // 30% → 50% em 40 min = 30%/h; faltam 50% → 1h40 depois.
    const r = preverLimite(sessao(50, 3 * H), [{ t: AGORA - 40 * MIN, percent: 30 }, { t: AGORA, percent: 50 }], AGORA);
    assert.equal(Math.round(r.porHora!), 30);
    assert.equal(r.estouraEm, AGORA + 100 * MIN);
    assert.equal(r.aoRenovar, null);
  });

  test('sessão de 5h: renova antes de estourar, com a porcentagem prevista na renovação', () => {
    const r = preverLimite(sessao(50, H), [{ t: AGORA - 30 * MIN, percent: 40 }, { t: AGORA, percent: 50 }], AGORA);
    assert.equal(r.estouraEm, null);
    assert.equal(Math.round(r.aoRenovar!), 70);
  });

  test('sessão de 5h: menos de 10 min de leitura, ou leitura de mais de 1h atrás, ainda não prevê', () => {
    assert.equal(preverLimite(sessao(50, H), [{ t: AGORA - 5 * MIN, percent: 45 }, { t: AGORA, percent: 50 }], AGORA).porHora, null);
    assert.equal(preverLimite(sessao(50, H), [{ t: AGORA - 2 * H, percent: 10 }], AGORA).porHora, null);
    const parado = preverLimite(sessao(50, H), [{ t: AGORA - 30 * MIN, percent: 50 }, { t: AGORA, percent: 50 }], AGORA);
    assert.equal(parado.porHora, 0);
    assert.equal(parado.estouraEm, null);
    assert.equal(parado.aoRenovar, 50);
  });

  test('semana: ritmo médio desde o começo dela', () => {
    // Semana começou há 2 dias (renova em 5 dias) com 20% usados = 10%/dia: chega a 70% ao renovar.
    const semana = { kind: 'weekly_all', group: 'weekly', label: 'Semana', percent: 20, severity: 'normal', resetsAt: new Date(AGORA + 5 * 24 * H).toISOString() };
    const r = preverLimite(semana, [], AGORA);
    assert.equal(r.estouraEm, null);
    assert.equal(Math.round(r.aoRenovar!), 70);
    // 60% em 2 dias = 30%/dia: estoura em 4/3 dia, antes de renovar.
    const forte = preverLimite({ ...semana, percent: 60 }, [], AGORA);
    assert.equal(forte.estouraEm, AGORA + Math.round((40 / 60) * 2 * 24 * H));
  });
});
