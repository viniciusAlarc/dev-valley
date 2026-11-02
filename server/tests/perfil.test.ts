import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ambienteDoTerminal, perfilDe, problemaDoPerfilPessoal, projectsDirs } from '../src/perfil.js';
import { listSessions } from '../src/sessions.js';
import { projeto } from './util.js';

const settings = (env: Record<string, string>) => JSON.stringify({ env });
const OK = { ANTHROPIC_BASE_URL: 'https://api.exemplo.com/anthropic', ANTHROPIC_AUTH_TOKEN: 'sk-teste' };

describe('perfil pessoal (decisão do usuário, 01/11/2026)', () => {
  const config = { perfilPessoal: { roots: ['/x/pessoais'], configDir: '/x/perfil' } };

  it('classifica pela pasta-raiz: dentro = pessoal, vizinho de nome parecido = profissional', () => {
    assert.equal(perfilDe('/x/pessoais/app', config), 'pessoal');
    assert.equal(perfilDe('/x/pessoais', config), 'pessoal');
    assert.equal(perfilDe('/x/pessoais-velhos/app', config), 'profissional');
    assert.equal(perfilDe('/x/trabalho/app', config), 'profissional');
    assert.equal(perfilDe('/x/pessoais/app', { perfilPessoal: null }), 'profissional');
  });

  it('lê as conversas dos dois perfis', () => {
    assert.equal(projectsDirs(config).length, 2);
    assert.equal(projectsDirs(config)[1], path.join('/x/perfil', 'projects'));
    assert.equal(projectsDirs({ perfilPessoal: null }).length, 1);
  });

  it('trava: sem settings, sem outra API ou sem chave, não abre', async () => {
    assert.match((await problemaDoPerfilPessoal(await projeto()))!, /não existe/);
    const semUrl = await projeto({ 'settings.json': settings({ ANTHROPIC_AUTH_TOKEN: 'sk' }) });
    assert.match((await problemaDoPerfilPessoal(semUrl))!, /ANTHROPIC_BASE_URL/);
    const anthropic = await projeto({ 'settings.json': settings({ ...OK, ANTHROPIC_BASE_URL: 'https://api.anthropic.com' }) });
    assert.match((await problemaDoPerfilPessoal(anthropic))!, /ANTHROPIC_BASE_URL/);
    const semChave = await projeto({ 'settings.json': settings({ ...OK, ANTHROPIC_AUTH_TOKEN: 'COLE_A_CHAVE_AQUI' }) });
    const motivo = (await problemaDoPerfilPessoal(semChave))!;
    assert.match(motivo, /sem a chave/);
    assert.ok(!motivo.includes('COLE_A_CHAVE_AQUI'), 'a mensagem nunca carrega o valor da chave');
    assert.equal(await problemaDoPerfilPessoal(await projeto({ 'settings.json': settings(OK) })), null);
  });

  it('o terminal pessoal recebe CLAUDE_CONFIG_DIR; o profissional tira o herdado', async () => {
    const perfil = await projeto({ 'settings.json': settings(OK) });
    const cfg = { perfilPessoal: { roots: ['/x/pessoais'], configDir: perfil } };
    assert.deepEqual(await ambienteDoTerminal('/x/pessoais/app', cfg), { env: { CLAUDE_CONFIG_DIR: perfil } });
    assert.deepEqual(await ambienteDoTerminal('/x/trabalho/app', cfg), { env: { CLAUDE_CONFIG_DIR: undefined } });
    const quebrado = { perfilPessoal: { roots: ['/x/pessoais'], configDir: await projeto() } };
    assert.ok('erro' in (await ambienteDoTerminal('/x/pessoais/app', quebrado)));
  });

  it('listSessions junta as conversas das duas pastas de perfil', async () => {
    const linha = (cwd: string) => JSON.stringify({ type: 'user', cwd, message: { role: 'user', content: 'oi' } }) + '\n';
    const a = await projeto({ 'p1/11111111-1111-1111-1111-111111111111.jsonl': linha('/x/trabalho/app') });
    const b = await projeto({ 'p2/22222222-2222-2222-2222-222222222222.jsonl': linha('/x/pessoais/app') });
    const ids = (await listSessions(1, [a, b, '/nao/existe'])).map((s) => s.id).sort();
    assert.deepEqual(ids, ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
  });
});
