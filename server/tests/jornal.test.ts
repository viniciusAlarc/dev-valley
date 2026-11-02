import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { commitsDesde, dataLocal, desdeQuando, Jornal, lerResposta, pauta } from '../src/jornal.js';
import type { Project, World } from '../src/world.js';
import { subir } from './servidor.js';
import { projeto } from './util.js';

// Banca de jornal (02/11/2026). O git deste processo não lê a configuração do usuário (como em pombal.test.ts).
Object.assign(process.env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });

const HORA = 3600_000;
const AGORA = new Date(2026, 10, 5, 9, 0).getTime(); // quinta, 9h (local)

function commit(dir: string, arquivo: string, assunto: string, email: string, quando: number) {
  execFileSync('git', ['add', '-A'], { cwd: dir });
  const data = new Date(quando).toISOString();
  const env = { ...process.env, GIT_AUTHOR_NAME: 'X', GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: 'X', GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: data, GIT_COMMITTER_DATE: data };
  execFileSync('git', ['commit', '-q', '-m', assunto, '--', arquivo], { cwd: dir, env });
}

async function repo(commits: { arquivo: string; assunto: string; email: string; quando: number }[]) {
  const dir = await projeto();
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'eu@exemplo.com'], { cwd: dir });
  for (const c of commits) {
    await fs.writeFile(path.join(dir, c.arquivo), c.assunto);
    commit(dir, c.arquivo, c.assunto, c.email, c.quando);
  }
  return dir;
}

async function vila() {
  const ativo = await repo([
    { arquivo: 'velho.txt', assunto: 'Coisa da semana passada', email: 'eu@exemplo.com', quando: AGORA - 5 * 24 * HORA },
    { arquivo: 'pedidos.ts', assunto: 'feat: desconto no pedido', email: 'eu@exemplo.com', quando: AGORA - 3 * HORA },
    { arquivo: 'login.ts', assunto: 'fix: login travando', email: 'colega@exemplo.com', quando: AGORA - 2 * HORA },
  ]);
  const parado = await repo([{ arquivo: 'a.txt', assunto: 'Começo', email: 'eu@exemplo.com', quando: AGORA - 30 * 24 * HORA }]);
  const projects = [
    { id: 'a', name: 'ativo', path: ativo, isGit: true },
    { id: 'b', name: 'parado', path: parado, isGit: true },
  ] as Project[];
  const world = (): Pick<World, 'projects' | 'sessions'> => ({ projects, sessions: [] });
  const pautas: string[] = [];
  let resposta = '{"manchete": "No ativo, pedidos com desconto", "noticias": [{"projeto": "ativo", "voce": "Você deixou o pedido aceitar desconto.", "time": "O time destravou o login."}]}';
  const jornal = new Jornal(world, new Set(), await projeto(), async (p) => {
    pautas.push(p);
    return resposta;
  });
  return { jornal, pautas, ativo, setResposta: (r: string) => (resposta = r) };
}

describe('banca de jornal', () => {
  test('período: desde a última leitura, com piso de 24h e teto de 7 dias', () => {
    assert.equal(desdeQuando(null, AGORA), AGORA - 24 * HORA);
    assert.equal(desdeQuando(AGORA - 2 * HORA, AGORA), AGORA - 24 * HORA, 'leu há pouco: piso de 24h');
    assert.equal(desdeQuando(AGORA - 72 * HORA, AGORA), AGORA - 72 * HORA, 'segunda-feira cobre o fim de semana');
    assert.equal(desdeQuando(AGORA - 30 * 24 * HORA, AGORA), AGORA - 7 * 24 * HORA);
  });

  test('commits do período, seus e do time separados pelo e-mail do git config', async () => {
    const { ativo } = await vila();
    const { voce, time } = await commitsDesde(ativo, AGORA - 24 * HORA);
    assert.deepEqual(voce.map((c) => [c.assunto, c.arquivos]), [['feat: desconto no pedido', ['pedidos.ts']]]);
    assert.deepEqual(time.map((c) => c.assunto), ['fix: login travando']);
  });

  test('a pauta leva assunto e nome de arquivo, nunca o hash', async () => {
    const { ativo } = await vila();
    const { voce, time } = await commitsDesde(ativo, AGORA - 24 * HORA);
    const texto = pauta([{ nome: 'ativo', voce, time }], AGORA - 24 * HORA);
    assert.match(texto, /Você fez:\n- feat: desconto no pedido \(arquivos: pedidos\.ts\)/);
    assert.match(texto, /O time fez:\n- fix: login travando/);
    assert.ok(!texto.includes(voce[0]!.hash));
  });

  test('resposta do jornaleiro: JSON com projeto conhecido; o resto vira null', () => {
    const ok = lerResposta('Aqui: {"manchete": "M", "noticias": [{"projeto": "a", "voce": "V", "time": ""}, {"projeto": "x", "voce": "inventado"}]}', ['a']);
    assert.deepEqual(ok, { manchete: 'M', noticias: [{ nome: 'a', voce: 'V', time: '' }] });
    assert.equal(lerResposta('sem json', ['a']), null);
    assert.equal(lerResposta('{"manchete": "M", "noticias": []}', ['a']), null);
  });

  test('imprime a edição: notícias, projeto sem novidade e projeto parado; abrir de novo não chama o jornaleiro', async () => {
    const { jornal, pautas } = await vila();
    await jornal.imprimir(AGORA);
    const v = await jornal.view(AGORA);
    assert.equal(v.erro, null);
    assert.equal(v.edicao!.data, dataLocal(AGORA));
    assert.equal(v.edicao!.manchete, 'No ativo, pedidos com desconto');
    assert.deepEqual(v.edicao!.semNovidade, ['parado']);
    assert.deepEqual(v.edicao!.parados, [{ nome: 'parado', dias: 30 }]);
    await jornal.garantirDoDia(AGORA);
    assert.equal(pautas.length, 1, 'edição do dia já existe');
  });

  test('antes das 6h não imprime sozinha; sem commit não chama o jornaleiro', async () => {
    const { jornal, pautas } = await vila();
    await jornal.garantirDoDia(new Date(2026, 10, 5, 5, 0).getTime());
    assert.equal((await jornal.view(new Date(2026, 10, 5, 5, 0).getTime())).edicao, null);
    const depois = AGORA + 10 * 24 * HORA; // nada nos últimos dias
    await jornal.garantirDoDia(depois);
    assert.equal(pautas.length, 0);
    assert.match((await jornal.view(depois)).edicao!.manchete, /Dia calmo/);
  });

  test('resposta que a vila não entende vira erro, sem edição', async () => {
    const { jornal, setResposta } = await vila();
    setResposta('não sei');
    await jornal.imprimir(AGORA);
    const v = await jornal.view(AGORA);
    assert.equal(v.edicao, null);
    assert.match(v.erro!, /não entendeu/);
  });

  test('rotas: GET entrega a edição; imprimir e marcar lido só de página local', async () => {
    const { jornal } = await vila();
    const s = await subir({}, { jornal });
    assert.equal((await s.get('/api/jornal')).status, 200);
    assert.equal((await s.enviar('POST', '/api/jornal/lido', {}, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('POST', '/api/jornal/imprimir', {}, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('POST', '/api/jornal/lido', {}, 'http://localhost:4777')).status, 200);
  });
});
