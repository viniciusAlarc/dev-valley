import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { Bastao, pedidoDoBastao, promptDoSucessor } from '../src/bastao.js';
import { sessao, subir } from './servidor.js';

// Passagem de bastão (BT-1, decisão do usuário de 08/11/2026): pasta temporária, nunca a home de verdade.
const LOCAL = 'http://localhost:4777';
const ID = '00000000-0000-0000-0000-0000000000a1';

async function pasta() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bastao-'));
}

describe('Bastao: pedido e sucessor', () => {
  test('o pedido é uma linha só, com o arquivo e as seções; o sucessor lê o arquivo', () => {
    const pedido = pedidoDoBastao('/tmp/b/x.md');
    assert.ok(!pedido.includes('\n'));
    for (const secao of ['Objetivo', 'O que foi feito', 'O que ficou aberto', 'Arquivos tocados', 'Próximo passo', 'Cuidados']) assert.ok(pedido.includes(secao));
    assert.ok(pedido.includes('/tmp/b/x.md'));
    assert.ok(promptDoSucessor('Vera', '/tmp/b/x.md').includes('/tmp/b/x.md'));
  });

  test('só abre o sucessor quando o resumo aparece, uma vez, na mesma pasta e com leitura só do bastão', async () => {
    const dir = await pasta();
    const b = new Bastao(dir);
    await b.pedir(ID, 'Vera', '/projetos/x');
    assert.equal(b.pendente(ID), true);
    const abertos: { sessionId: string; cwd: string; prompt: string; permitir: string[] }[] = [];
    const abrir = async (o: (typeof abertos)[number]) => (abertos.push(o), null);
    assert.deepEqual(await b.conferir(abrir), []);
    await fs.writeFile(b.arquivoDe(ID), '# Objetivo\n...');
    const r = await b.conferir(abrir);
    assert.equal(r.length, 1);
    assert.equal(abertos[0]!.cwd, '/projetos/x');
    assert.deepEqual(abertos[0]!.permitir, [`Read(/${b.arquivoDe(ID)})`]);
    assert.ok(abertos[0]!.prompt.includes('Vera'));
    assert.equal(b.pendente(ID), false);
    assert.deepEqual(await b.conferir(abrir), []);
  });

  test('resumo antigo (de um bastão anterior) não conta; pedido caduca em 15 min', async () => {
    const dir = await pasta();
    let agora = Date.now() + 60_000;
    const b = new Bastao(dir, () => agora);
    await fs.writeFile(path.join(dir, `${ID}.md`), 'resumo velho');
    await b.pedir(ID, 'Vera', '/projetos/x');
    const abrir = async () => null;
    assert.deepEqual(await b.conferir(abrir), []);
    agora += 16 * 60_000;
    await b.conferir(abrir);
    assert.equal(b.pendente(ID), false);
  });
});

describe('POST /api/bastao', () => {
  async function cenario(extra: Parameters<typeof sessao>[1] = {}) {
    const dir = await pasta();
    const bastao = new Bastao(dir);
    const escritos: string[] = [];
    const s = await subir(
      { sessions: [sessao(ID, { name: 'Vera', status: 'idle', live: true, ...extra })] },
      { bastao, terminaisDoBastao: { live: () => [{ id: ID, cwd: '/projetos/x', startedAt: 0 }], escrever: (_id, t) => (escritos.push(t), true) } },
    );
    return { s, bastao, escritos };
  }

  test('sucesso: digita o pedido no terminal e anota', async () => {
    const { s, bastao, escritos } = await cenario();
    const r = await s.enviar('POST', '/api/bastao', { sessionId: ID }, LOCAL);
    assert.equal(r.status, 202);
    assert.equal(escritos.length, 1);
    assert.ok(escritos[0]!.includes(bastao.arquivoDe(ID)));
    assert.equal(bastao.pendente(ID), true);
    assert.equal((await s.enviar('POST', '/api/bastao', { sessionId: ID }, LOCAL)).status, 409);
  });

  test('sem a página, sessão de fora, do porão ou trabalhando: recusa sem digitar nada', async () => {
    const { s, escritos } = await cenario();
    assert.equal((await s.enviar('POST', '/api/bastao', { sessionId: ID })).status, 403);
    assert.equal((await s.enviar('POST', '/api/bastao', { sessionId: '00000000-0000-0000-0000-0000000000ff' }, LOCAL)).status, 404);
    const porao = await cenario({ porao: { papel: 'maestro' } });
    assert.equal((await porao.s.enviar('POST', '/api/bastao', { sessionId: ID }, LOCAL)).status, 404);
    const ocupado = await cenario({ status: 'working' });
    assert.equal((await ocupado.s.enviar('POST', '/api/bastao', { sessionId: ID }, LOCAL)).status, 409);
    assert.equal(escritos.length + porao.escritos.length + ocupado.escritos.length, 0);
  });
});
