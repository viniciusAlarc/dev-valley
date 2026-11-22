import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { CONTA_CLAUDE, type Conta } from '../src/config.js';
import { agentDefinition, ambienteDaConsulta, argsDaConsulta, askAgent } from '../src/consulta.js';
import { problemaDaContaSync } from '../src/perfil.js';

// Base dos agentes da vila (regra 5): o que cada consulta pode usar sai daqui.
const agente = (tools: string[]) => ({ description: 'd', prompt: 'p', tools, model: 'sonnet' });

describe('argumentos da consulta a um agente da vila', () => {
  test('agente sem ferramenta: --tools "" e nenhum --allowedTools (02/11/2026)', () => {
    const args = argsDaConsulta('jornaleiro-conversa', agente([]), 'pergunta', 'id');
    const i = args.indexOf('--tools');
    assert.ok(i > 0 && args[i + 1] === '', 'desliga todas as ferramentas');
    assert.ok(!args.includes('--allowedTools'));
    assert.ok(args.includes('--no-session-persistence'), 'não vira morador');
  });

  test('agente com ferramentas: libera as dele, e Edit só pelos caminhos de allow', () => {
    const args = argsDaConsulta('administrador', agente(['Read', 'Grep', 'Edit']), 'p', 'id', ['Edit(//x/PROGRESS.md)']);
    assert.deepEqual(args.slice(args.indexOf('--allowedTools') + 1), ['Read', 'Grep', 'Edit(//x/PROGRESS.md)']);
    assert.ok(!args.includes('--tools'));
  });

  test('definição dos agentes da vila: campo de ferramentas vazio não lê a linha de baixo', () => {
    const conversa = agentDefinition('jornaleiro-conversa');
    assert.deepEqual(conversa.tools, []);
    assert.equal(conversa.model, 'sonnet');
    assert.deepEqual(agentDefinition('escrevente').tools, ['Read']);
    assert.ok(argsDaConsulta('jornaleiro-conversa', conversa, 'p', 'id').includes('--tools'));
  });
});

describe('conta das consultas aos agentes que só leem (19/11/2026)', () => {
  const deepseek = (configDir: string): Conta => ({ nome: 'DeepSeek teste', provedor: 'deepseek', configDir, roots: [], finalidade: 'trabalho' });

  test('conta DeepSeek entra como CLAUDE_CONFIG_DIR e preserva o resto do ambiente', () => {
    const env = ambienteDaConsulta(deepseek('/tmp/conta-deepseek'), { HOME: '/h', PATH: '/bin' });
    assert.equal(env.CLAUDE_CONFIG_DIR, '/tmp/conta-deepseek');
    assert.equal(env.HOME, '/h');
  });

  test('conta do Claude tira o CLAUDE_CONFIG_DIR herdado (servidor iniciado numa sessão DeepSeek)', () => {
    const env = ambienteDaConsulta(CONTA_CLAUDE, { HOME: '/h', CLAUDE_CONFIG_DIR: '/conta-deepseek' });
    assert.ok(!('CLAUDE_CONFIG_DIR' in env));
  });

  test('a trava recusa conta sem base URL ou sem chave, e aceita a configurada', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conta-agentes-'));
    try {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: 'chave-de-teste' } }));
      assert.match(problemaDaContaSync(dir) ?? '', /ANTHROPIC_BASE_URL/);
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic', ANTHROPIC_AUTH_TOKEN: 'COLE_AQUI' } }));
      assert.match(problemaDaContaSync(dir) ?? '', /sem a chave/);
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic', ANTHROPIC_AUTH_TOKEN: 'chave-de-teste' } }));
      assert.equal(problemaDaContaSync(dir), null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('conta sem configuração: erro claro no painel e o claude não é chamado', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conta-sem-config-'));
    try {
      const evento = await new Promise<{ type: string; text?: string }>((resolve) => {
        askAgent(
          { name: 'escrevente', who: 'O escrevente', conta: deepseek(dir), stepFor: () => '' },
          'pergunta',
          [],
          resolve,
          new Set(),
        );
      });
      assert.equal(evento.type, 'error');
      assert.match(evento.text ?? '', /DeepSeek teste/);
      assert.match(evento.text ?? '', /não existe ou não é JSON válido/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
