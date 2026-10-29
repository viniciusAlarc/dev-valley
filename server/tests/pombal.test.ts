import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { buscar, cartas, PombalError, readPombal, voar } from '../src/pombal.js';
import { casa, subir } from './servidor.js';
import { projeto } from './util.js';

// PD-8, passo 3: o pombal roda git de verdade em repositórios de mentira. Nada de rede: o "remoto" é uma pasta.
// O git deste processo não lê a configuração do usuário (assinatura, hooks, nome) e tem autor fixo.
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Teste',
  GIT_AUTHOR_EMAIL: 'teste@exemplo.com',
  GIT_COMMITTER_NAME: 'Teste',
  GIT_COMMITTER_EMAIL: 'teste@exemplo.com',
});

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const escrever = (dir: string, arquivo: string, texto: string) => fs.writeFileSync(path.join(dir, arquivo), texto);
const ler = (dir: string, arquivo: string) => fs.readFileSync(path.join(dir, arquivo), 'utf8');

/** Remoto (bare) com um commit inicial, e dois clones: `eu` (onde o pombal age) e `colega` (o time). */
async function vila() {
  const base = await projeto();
  const remoto = path.join(base, 'remoto.git');
  const eu = path.join(base, 'eu');
  const colega = path.join(base, 'colega');
  git(base, 'init', '-q', '--bare', '-b', 'main', remoto);
  git(base, 'clone', '-q', remoto, colega);
  escrever(colega, 'a.txt', 'linha 1\n');
  git(colega, 'add', '.');
  git(colega, 'commit', '-qm', 'inicio');
  git(colega, 'push', '-q', 'origin', 'main');
  git(base, 'clone', '-q', remoto, eu);
  /** O colega manda um commit para o remoto. */
  const colegaEnvia = (arquivo: string, texto: string, msg: string) => {
    git(colega, 'pull', '-q', '--rebase');
    escrever(colega, arquivo, texto);
    git(colega, 'add', '.');
    git(colega, 'commit', '-qm', msg);
    git(colega, 'push', '-q');
  };
  return { remoto, eu, colega, colegaEnvia };
}

describe('readPombal, buscar e cartas', () => {
  test('sem branch não há pombal', async () => {
    assert.equal(await readPombal(await projeto(), null), null);
  });

  test('conta arquivos só seus e commits a receber depois de buscar; cartas lista os dois sentidos', async () => {
    const { eu, colegaEnvia } = await vila();
    colegaEnvia('b.txt', 'do colega\n', 'colega: b');
    escrever(eu, 'a.txt', 'linha 1\nminha\n');
    escrever(eu, 'novo.txt', 'novo\n');

    const antes = await readPombal(eu, 'main');
    assert.deepEqual([antes?.upstream, antes?.locais, antes?.aReceber, antes?.buscadoEm], ['origin/main', 2, 0, null]);
    await buscar(eu);
    const depois = await readPombal(eu, 'main');
    assert.equal(depois?.aReceber, 1);
    assert.equal(typeof depois?.buscadoEm, 'number');
    assert.equal(depois?.falhaBusca, null);

    const c = await cartas(eu);
    assert.deepEqual(c.receber.map((x) => x.assunto), ['colega: b']);
    assert.deepEqual(c.enviar, []);
    assert.deepEqual(c.arquivos.sort(), ['a.txt', 'novo.txt']);
  });

  test('remoto inacessível: falhaBusca preenchida, sem erro de viagem', async () => {
    const { eu, remoto } = await vila();
    fs.rmSync(remoto, { recursive: true });
    await buscar(eu);
    const p = await readPombal(eu, 'main');
    assert.match(p?.falhaBusca ?? '', /^não consegui buscar o remoto/);
    assert.equal(p?.erro, null);
  });
});

describe('voar: enviar', () => {
  test('commit, rebase e push: o remoto fica com o commit e o que o colega mandou antes', async () => {
    const { eu, remoto, colegaEnvia } = await vila();
    colegaEnvia('b.txt', 'do colega\n', 'colega: b');
    escrever(eu, 'c.txt', 'meu\n');
    const passos = await voar(eu, 'enviar', { mensagem: 'Meu arquivo' });
    assert.deepEqual(passos, ['Guardou as alterações: "Meu arquivo"', 'Buscou o remoto', 'Trouxe o que chegou de origin/main', 'Entregou em origin/main: o time já tem']);
    assert.deepEqual(git(remoto, 'log', '--format=%s', 'main').split('\n'), ['Meu arquivo', 'colega: b', 'inicio']);
    assert.equal(ler(eu, 'b.txt'), 'do colega\n');
    assert.equal(git(eu, 'status', '--porcelain'), '');
  });

  test('só os arquivos escolhidos vão; o resto continua local', async () => {
    const { eu, remoto } = await vila();
    escrever(eu, 'vai.txt', 'x\n');
    escrever(eu, 'fica.txt', 'y\n');
    await voar(eu, 'enviar', { mensagem: 'Só um', arquivos: ['vai.txt'] });
    assert.equal(git(remoto, 'show', '--name-only', '--format=', 'main'), 'vai.txt');
    assert.equal(git(eu, 'status', '--porcelain'), '?? fica.txt');
  });

  test('sem mensagem com algo a commitar: recusa antes de sair, nada muda e o pombal não marca erro', async () => {
    const { eu } = await vila();
    escrever(eu, 'c.txt', 'meu\n');
    const head = git(eu, 'rev-parse', 'HEAD');
    await assert.rejects(voar(eu, 'enviar', { mensagem: '  ' }), (e: PombalError) => /Escreva o que mudou/.test(e.message) && e.passos.length === 0);
    assert.equal(git(eu, 'rev-parse', 'HEAD'), head);
    assert.equal((await readPombal(eu, 'main'))?.erro, null);
  });

  test('conflito no rebase (regra 9): rebase desfeito, commit local preservado, remoto intacto e "!" no pombal', async () => {
    const { eu, remoto, colegaEnvia } = await vila();
    colegaEnvia('a.txt', 'linha do colega\n', 'colega: a');
    const remotoAntes = git(remoto, 'rev-parse', 'main');
    escrever(eu, 'a.txt', 'linha minha\n');

    await assert.rejects(voar(eu, 'enviar', { mensagem: 'Minha versão' }), (e: PombalError) => {
      assert.deepEqual(e.conflitos, ['a.txt']);
      assert.deepEqual(e.passos, ['Guardou as alterações: "Minha versão"', 'Buscou o remoto']);
      assert.match(e.message, /Desfiz o rebase; nada se perdeu/);
      return true;
    });
    assert.equal(git(eu, 'log', '-1', '--format=%s'), 'Minha versão');
    assert.equal(ler(eu, 'a.txt'), 'linha minha\n');
    assert.equal(fs.existsSync(path.join(eu, '.git/rebase-merge')) || fs.existsSync(path.join(eu, '.git/rebase-apply')), false, 'rebase em andamento');
    assert.equal(git(eu, 'status', '--porcelain'), '');
    assert.equal(git(remoto, 'rev-parse', 'main'), remotoAntes);
    assert.match((await readPombal(eu, 'main'))?.erro ?? '', /conflita/);

    // O "!" some quando o HEAD sai do commit em que o erro aconteceu (conflito resolvido por fora).
    git(eu, 'reset', '-q', '--hard', 'origin/main');
    assert.equal((await readPombal(eu, 'main'))?.erro, null);
  });

  test('sem upstream: só commita e avisa que ficou aqui', async () => {
    const dir = await projeto({ 'a.txt': '1\n' });
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'inicio');
    escrever(dir, 'a.txt', '2\n');
    assert.deepEqual(await voar(dir, 'enviar', { mensagem: 'Local' }), ['Guardou as alterações: "Local"', 'A branch não tem upstream: ficou só aqui']);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'Local');
    await assert.rejects(voar(dir, 'receber'), /não tem upstream/);
  });

  test('dois cliques: a segunda viagem é recusada enquanto a primeira voa', async () => {
    const { eu } = await vila();
    const primeira = voar(eu, 'receber');
    await assert.rejects(voar(eu, 'receber'), /já está voando/);
    await primeira;
  });
});

describe('voar: receber', () => {
  test('traz o que chegou e mantém a alteração sem commit (autostash)', async () => {
    const { eu, colegaEnvia } = await vila();
    colegaEnvia('b.txt', 'do colega\n', 'colega: b');
    escrever(eu, 'a.txt', 'linha 1\nminha sem commit\n');
    assert.deepEqual(await voar(eu, 'receber'), ['Buscou o remoto', 'Trouxe o que chegou de origin/main']);
    assert.equal(ler(eu, 'b.txt'), 'do colega\n');
    assert.equal(ler(eu, 'a.txt'), 'linha 1\nminha sem commit\n');
    assert.deepEqual(await voar(eu, 'receber'), ['Buscou o remoto', 'Já tinha tudo de origin/main']);
  });

  test('alteração sem commit que conflita com o que chegou: fica guardada no stash, nada se perde', async () => {
    const { eu, colegaEnvia } = await vila();
    colegaEnvia('a.txt', 'linha do colega\n', 'colega: a');
    escrever(eu, 'a.txt', 'linha minha sem commit\n');
    await assert.rejects(voar(eu, 'receber'), /ficaram guardadas no stash/);
    assert.equal(git(eu, 'log', '-1', '--format=%s'), 'colega: a');
    assert.match(git(eu, 'stash', 'show', '-p'), /\+linha minha sem commit/);
  });
});

describe('/api/pombal com o pombal de verdade', () => {
  test('GET busca e lista as cartas; POST enviar entrega no remoto', async () => {
    const { eu, remoto, colegaEnvia } = await vila();
    const pombal = await readPombal(eu, 'main');
    const s = await subir({ projects: [casa('p', eu, { isGit: true, branch: 'main', pombal })] });
    colegaEnvia('b.txt', 'do colega\n', 'colega: b');
    const c = await (await s.get('/api/pombal?project=p')).json();
    assert.deepEqual(c.receber.map((x: { assunto: string }) => x.assunto), ['colega: b']);

    escrever(eu, 'c.txt', 'meu\n');
    const r = await s.enviar('POST', '/api/pombal', { project: 'p', acao: 'enviar', mensagem: 'Pela rota', arquivos: ['c.txt'] });
    assert.equal(r.status, 200);
    assert.equal(git(remoto, 'log', '-1', '--format=%s', 'main'), 'Pela rota');
  });

  test('conflito pela rota: 409 com os arquivos em conflito e os passos feitos', async () => {
    const { eu, colegaEnvia } = await vila();
    const s = await subir({ projects: [casa('p', eu, { isGit: true, branch: 'main', pombal: await readPombal(eu, 'main') })] });
    colegaEnvia('a.txt', 'linha do colega\n', 'colega: a');
    escrever(eu, 'a.txt', 'linha minha\n');
    const r = await s.enviar('POST', '/api/pombal', { project: 'p', acao: 'enviar', mensagem: 'Minha' });
    assert.equal(r.status, 409);
    const corpo = await r.json();
    assert.deepEqual([corpo.conflitos, corpo.passos.length], [['a.txt'], 2]);
  });
});
