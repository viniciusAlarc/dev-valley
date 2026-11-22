import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { CLAUDE_PROJECTS_DIR, CONTA_CLAUDE, type Conta } from '../src/config.js';
import {
  ambienteDoTerminal,
  contaDaSessao,
  contaDoArquivo,
  contaPadraoDe,
  contaPorNome,
  contasDaCasa,
  problemaDaConta,
  projectsDirs,
  type Conta as ContaDoPerfil,
} from '../src/perfil.js';
import { listSessions } from '../src/sessions.js';
import { projeto } from './util.js';

const settings = (env: Record<string, string>) => JSON.stringify({ env });
const OK = { ANTHROPIC_BASE_URL: 'https://api.exemplo.com/anthropic', ANTHROPIC_AUTH_TOKEN: 'sk-teste' };
const conta = (nome: string, configDir: string, extra: Partial<Conta> = {}): Conta => ({
  nome,
  provedor: 'deepseek',
  configDir,
  roots: [],
  finalidade: 'trabalho',
  ...extra,
});

const PESSOAL = conta('DeepSeek pessoal', '/x/perfil', { roots: ['/x/pessoais'], finalidade: 'pessoal' });
const TRABALHO = conta('DeepSeek trabalho', '/x/extra');
const CONFIG = { contas: [CONTA_CLAUDE, PESSOAL, TRABALHO] };

describe('contas do Claude Code (01/11/2026; redesenhadas em 19/11/2026)', () => {
  it('a conta padrão vem da raiz: casa pessoal na conta pessoal, o resto no Claude', () => {
    assert.equal(contaPadraoDe('/x/pessoais/app', CONFIG), PESSOAL);
    assert.equal(contaPadraoDe('/x/pessoais', CONFIG), PESSOAL);
    assert.equal(contaPadraoDe('/x/pessoais-velhos/app', CONFIG), CONTA_CLAUDE);
    assert.equal(contaPadraoDe('/x/trabalho/app', CONFIG), CONTA_CLAUDE);
    assert.equal(contaPadraoDe('/x/pessoais/app', { contas: [CONTA_CLAUDE] }), CONTA_CLAUDE);
  });

  it('a casa oferece as contas da mesma finalidade: pessoal só pessoal; trabalho, Claude e as de trabalho', () => {
    assert.deepEqual(contasDaCasa('/x/pessoais/app', CONFIG), [PESSOAL]);
    assert.deepEqual(contasDaCasa('/x/trabalho/app', CONFIG), [CONTA_CLAUDE, TRABALHO]);
  });

  it('lê as conversas de todas as contas, com a do Claude primeiro', () => {
    const dirs = projectsDirs(CONFIG);
    assert.equal(dirs.length, 3);
    assert.equal(dirs[0], CLAUDE_PROJECTS_DIR);
    assert.equal(dirs[1], path.join('/x/perfil', 'projects'));
    assert.equal(dirs[2], path.join('/x/extra', 'projects'));
    assert.deepEqual(projectsDirs({ contas: [CONTA_CLAUDE] }), [CLAUDE_PROJECTS_DIR]);
  });

  it('trava: sem settings, sem outra API ou sem chave, a conta DeepSeek não abre', async () => {
    assert.match((await problemaDaConta(await projeto()))!, /não existe/);
    const semUrl = await projeto({ 'settings.json': settings({ ANTHROPIC_AUTH_TOKEN: 'sk' }) });
    assert.match((await problemaDaConta(semUrl))!, /ANTHROPIC_BASE_URL/);
    const anthropic = await projeto({ 'settings.json': settings({ ...OK, ANTHROPIC_BASE_URL: 'https://api.anthropic.com' }) });
    assert.match((await problemaDaConta(anthropic))!, /ANTHROPIC_BASE_URL/);
    const semChave = await projeto({ 'settings.json': settings({ ...OK, ANTHROPIC_AUTH_TOKEN: 'COLE_A_CHAVE_AQUI' }) });
    const motivo = (await problemaDaConta(semChave))!;
    assert.match(motivo, /sem a chave/);
    assert.ok(!motivo.includes('COLE_A_CHAVE_AQUI'), 'a mensagem nunca carrega o valor da chave');
    assert.equal(await problemaDaConta(await projeto({ 'settings.json': settings(OK) })), null);
  });

  it('o terminal recebe CLAUDE_CONFIG_DIR da conta escolhida; o Claude de ~/.claude tira o herdado', async () => {
    const pessoal = await projeto({ 'settings.json': settings(OK) });
    const extra = await projeto({ 'settings.json': settings(OK) });
    const cfg = {
      contas: [CONTA_CLAUDE, conta('DeepSeek pessoal', pessoal, { roots: ['/x/pessoais'], finalidade: 'pessoal' }), conta('DeepSeek trabalho', extra)],
    };
    assert.deepEqual(await ambienteDoTerminal('/x/pessoais/app', cfg), { env: { CLAUDE_CONFIG_DIR: pessoal } });
    assert.deepEqual(await ambienteDoTerminal('/x/trabalho/app', cfg), { env: { CLAUDE_CONFIG_DIR: undefined } });
    assert.deepEqual(await ambienteDoTerminal('/x/trabalho/app', cfg, cfg.contas[2]), { env: { CLAUDE_CONFIG_DIR: extra } });
    // Escolha explícita do Claude numa pasta pessoal: o herdado sai (a trava da casa é a rota, nunca o ambiente).
    assert.deepEqual(await ambienteDoTerminal('/x/pessoais/app', cfg, CONTA_CLAUDE), { env: { CLAUDE_CONFIG_DIR: undefined } });
    const quebrado = { contas: [CONTA_CLAUDE, conta('DeepSeek pessoal', await projeto(), { roots: ['/x/pessoais'], finalidade: 'pessoal' })] };
    assert.ok('erro' in (await ambienteDoTerminal('/x/pessoais/app', quebrado)));
  });

  it('contaDoArquivo: a pasta da conversa manda; fora das contas, null', () => {
    assert.equal(contaDoArquivo('/x/perfil/projects/app/1.jsonl', CONFIG), PESSOAL);
    assert.equal(contaDoArquivo('/x/extra/projects/app/1.jsonl', CONFIG), TRABALHO);
    assert.equal(contaDoArquivo(path.join(CLAUDE_PROJECTS_DIR, 'app', '1.jsonl'), CONFIG), CONTA_CLAUDE);
    assert.equal(contaDoArquivo('/x/desconhecido/projects/app/1.jsonl', CONFIG), null);
  });

  it('conta da sessão: arquivo salvo, depois a escolha da abertura, depois a pasta', () => {
    const sessao = (cwd: string, file: string | null) => ({ cwd, file });
    assert.equal(contaDaSessao(sessao('/x/trabalho/app', '/x/extra/projects/app/1.jsonl'), CONFIG), TRABALHO);
    assert.equal(contaDaSessao(sessao('/x/trabalho/app', null), CONFIG, TRABALHO), TRABALHO);
    assert.equal(contaDaSessao(sessao('/x/pessoais/app', null), CONFIG), PESSOAL);
    assert.equal(contaDaSessao(sessao('/x/trabalho/app', null), CONFIG), CONTA_CLAUDE);
  });

  it('a escolha guardada só vale enquanto a conta está no config', () => {
    assert.equal(contaPorNome(CONFIG, 'DeepSeek trabalho'), TRABALHO);
    assert.equal(contaPorNome(CONFIG, 'Claude'), CONTA_CLAUDE);
    assert.equal(contaPorNome(CONFIG, 'sumiu'), null);
    assert.equal(contaPorNome(CONFIG, null), null);
  });

  it('listSessions junta as conversas de todas as pastas de conta', async () => {
    const linha = (cwd: string) => JSON.stringify({ type: 'user', cwd, message: { role: 'user', content: 'oi' } }) + '\n';
    const a = await projeto({ 'p1/11111111-1111-1111-1111-111111111111.jsonl': linha('/x/trabalho/app') });
    const b = await projeto({ 'p2/22222222-2222-2222-2222-222222222222.jsonl': linha('/x/pessoais/app') });
    const ids = (await listSessions(1, [a, b, '/nao/existe'])).map((s) => s.id).sort();
    assert.deepEqual(ids, ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  });

  it('o erro da conta sem chave leva o nome da conta, nunca a chave', async () => {
    const quebrado = conta('DeepSeek trabalho', await projeto());
    const erro = (await ambienteDoTerminal('/x/trabalho/app', { contas: [CONTA_CLAUDE, quebrado] }, quebrado)) as { erro: string };
    assert.match(erro.erro, /^DeepSeek trabalho: /);
    assert.match(erro.erro, /não existe/);
  });

  it('o tipo Conta do perfil é o mesmo do config', () => {
    const c: ContaDoPerfil = CONTA_CLAUDE;
    assert.equal(c.nome, 'Claude');
  });
});
