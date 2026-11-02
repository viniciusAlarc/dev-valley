import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { agentDefinition, argsDaConsulta } from '../src/consulta.js';

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
