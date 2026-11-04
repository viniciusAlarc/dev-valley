import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { briefingDe, Porao } from '../src/porao.js';
import { casa, subir } from './servidor.js';
import { projeto } from './util.js';

// Porão da casa (MA-1): quem é do porão e a rota que abre uma rodada com o maestro. Registro e agente em pasta temporária.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-porao-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe('briefingDe: sessão de trabalho de uma rodada, pelo primeiro prompt', () => {
  test('a frase do maestro, com ~ ou caminho absoluto, dá a rodada e a tarefa', () => {
    assert.deepEqual(briefingDe('Você trabalha sob o maestro. Leia e siga: ~/.claude/maestro/rodadas/20261103-1430-porao/briefings/t1.md'), {
      rodada: '20261103-1430-porao',
      tarefa: 't1',
    });
    assert.deepEqual(briefingDe('  Você trabalha sob o maestro. Leia e siga: /home/x/.claude/maestro/rodadas/r-2/briefings/t0.md\n'), { rodada: 'r-2', tarefa: 't0' });
  });
  test('prompt comum, citação no meio do texto ou caminho de outra pasta: não é do porão', () => {
    assert.equal(briefingDe(null), null);
    assert.equal(briefingDe('Arruma o botão de salvar'), null);
    assert.equal(briefingDe('Olha isto: Você trabalha sob o maestro. Leia e siga: ~/.claude/maestro/rodadas/r/briefings/t1.md'), null);
    assert.equal(briefingDe('Você trabalha sob o maestro. Leia e siga: ~/outra/rodadas/r/briefings/t1.md'), null);
  });
});

describe('Porao: registro dos maestros', () => {
  test('sem arquivo, nenhum; registrar grava e soma sem perder os anteriores', async () => {
    const p = new Porao(path.join(TMP, 'reg', 'porao.json'), path.join(TMP, 'nao-existe.md'));
    assert.equal((await p.maestros()).size, 0);
    await p.registrarMaestro('a', 'proj');
    await p.registrarMaestro('b', 'proj');
    assert.deepEqual([...(await p.maestros())].sort(), ['a', 'b']);
    assert.equal(await p.maestroInstalado(), false);
  });
  test('arquivo corrompido não derruba: vale como vazio', async () => {
    const file = path.join(TMP, 'ruim.json');
    fs.writeFileSync(file, '{ não é json');
    assert.equal((await new Porao(file).maestros()).size, 0);
  });
});

describe('POST /api/porao/maestro', () => {
  test('abre rodada: anota no porão antes do terminal e a sessão nasce com --agent maestro na pasta do projeto', async () => {
    const dir = await projeto({});
    const agente = path.join(TMP, 'maestro.md');
    fs.writeFileSync(agente, '---\nname: maestro\ndescription: x\n---\n');
    const porao = new Porao(path.join(TMP, 'rota', 'porao.json'), agente);
    const s = await subir({ projects: [casa('p', dir)] }, { porao });
    const r = await s.enviar('POST', '/api/porao/maestro', { projectId: 'p' });
    assert.equal(r.status, 200);
    const { sessionId, projectId } = await r.json();
    assert.equal(projectId, 'p');
    assert.deepEqual(s.ctx.agentSessions.get(sessionId), { cwd: dir, agent: 'maestro' });
    assert.ok((await porao.maestros()).has(sessionId));
  });
  test('projeto desconhecido, 404; agente não instalado, 409 e nada anotado; outra origem, recusado', async () => {
    const dir = await projeto({});
    const porao = new Porao(path.join(TMP, 'sem-agente', 'porao.json'), path.join(TMP, 'sem-agente.md'));
    const s = await subir({ projects: [casa('p', dir)] }, { porao });
    assert.equal((await s.enviar('POST', '/api/porao/maestro', { projectId: 'x' })).status, 404);
    assert.equal((await s.enviar('POST', '/api/porao/maestro', { projectId: 'p' })).status, 409);
    assert.equal((await porao.maestros()).size, 0);
    assert.equal(s.ctx.agentSessions.size, 0);
    assert.equal((await s.enviar('POST', '/api/porao/maestro', { projectId: 'p' }, 'http://evil.example')).status, 403);
  });
});
