import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { colunaDa, rodadaDoPorao, type Session, type TarefaPorao, type World } from '../src/api.js';

// Quadro da rodada (maestro v2, fase 4): a coluna junta o estado gravado pela vila com o estado ao vivo da sessão.
const tarefa = (t: Partial<TarefaPorao>): TarefaPorao => ({
  id: 't1', estado: 'aberta', sessionId: 's1', dependeDe: [], arquivos: [], abertaEm: 1, prontaEm: null, erro: null, parouSemTerminar: false, ...t,
});
const mundo = (status: Session['status']): World =>
  ({
    projects: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null, conversas: [], pedidosPorao: [], maestroChamando: {},
    sessions: [{ id: 's1', status, live: true } as Session],
    rodadasPorao: [
      { projectId: 'p', rodada: 'r-nova', aprovadaEm: 2, relatorio: null, tarefas: [] },
      { projectId: 'p', rodada: 'r-velha', aprovadaEm: 1, relatorio: null, tarefas: [] },
    ],
  }) as World;

describe('colunaDa', () => {
  test('gravado manda em esperando, pronta e erro; aberta segue a sessão ao vivo', () => {
    assert.equal(colunaDa(tarefa({ estado: 'esperando', sessionId: null }), mundo(null)), 'esperando');
    assert.equal(colunaDa(tarefa({ estado: 'pronta' }), mundo('permission')), 'pronta');
    assert.equal(colunaDa(tarefa({ estado: 'erro', sessionId: null }), mundo(null)), 'precisa');
    assert.equal(colunaDa(tarefa({}), mundo('working')), 'trabalhando');
    assert.equal(colunaDa(tarefa({}), mundo(null)), 'trabalhando', 'acabou de abrir, sem evento ainda');
    assert.equal(colunaDa(tarefa({}), mundo('permission')), 'precisa');
    assert.equal(colunaDa(tarefa({ parouSemTerminar: true }), mundo('idle')), 'precisa');
  });
  test('rodadaDoPorao: a primeira do projeto (o servidor manda a mais nova primeiro); outro projeto, nenhuma', () => {
    assert.equal(rodadaDoPorao(mundo(null), 'p')?.rodada, 'r-nova');
    assert.equal(rodadaDoPorao(mundo(null), 'outro'), undefined);
  });
});
