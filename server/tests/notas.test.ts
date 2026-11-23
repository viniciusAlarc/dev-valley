import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { NOTA_MAX, Notas, type Nota } from '../src/notas.js';
import { subir } from './servidor.js';
import { projeto } from './util.js';

const LOCAL = 'http://localhost:4777';

describe('notas do quadro de avisos (21/11/2026)', () => {
  it('sem arquivo o quadro está vazio; cria na ordem e exclui só a nota pedida', async () => {
    const file = path.join(await projeto(), 'sub', 'notas.json');
    const notas = new Notas(file);
    assert.deepEqual(await notas.list(), []);
    const a = await notas.criar('Primeira');
    const b = await notas.criar('Segunda');
    assert.deepEqual((await notas.list()).map((n) => n.texto), ['Primeira', 'Segunda']);
    assert.ok(a.id !== b.id && !Number.isNaN(Date.parse(a.criadaEm)));
    assert.equal(await notas.excluir(a.id), true);
    assert.equal(await notas.excluir(a.id), false);
    assert.deepEqual(await new Notas(file).list(), [b]);
  });

  it('arquivo estragado ou com item torto não derruba o quadro', async () => {
    const dir = await projeto();
    const file = path.join(dir, 'notas.json');
    await fs.writeFile(file, '{ não é json');
    assert.deepEqual(await new Notas(file).list(), []);
    await fs.writeFile(file, JSON.stringify([{ id: 'x', texto: 'ok', criadaEm: '2026-11-21T00:00:00.000Z' }, { id: 1 }, null]));
    assert.deepEqual((await new Notas(file).list()).map((n) => n.id), ['x']);
  });
});

describe('rotas /api/notas', () => {
  const nota: Nota = { id: 'n1', texto: 'Lembrar', criadaEm: '2026-11-21T00:00:00.000Z' };

  it('sucesso: lista, cria com o texto limpo e exclui', async () => {
    const criadas: string[] = [];
    const excluidas: string[] = [];
    const s = await subir(
      {},
      {
        notas: {
          list: async () => [nota],
          criar: async (texto) => (criadas.push(texto), { ...nota, texto }),
          excluir: async (id) => (excluidas.push(id), id === 'n1'),
        },
      },
    );
    assert.deepEqual(await (await s.get('/api/notas')).json(), { notas: [nota] });
    const res = await s.enviar('POST', '/api/notas', { texto: '  Ligar para o fornecedor\n' }, LOCAL);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).texto, 'Ligar para o fornecedor');
    assert.equal((await s.enviar('DELETE', '/api/notas/n1', undefined, LOCAL)).status, 200);
    assert.equal((await s.enviar('DELETE', '/api/notas/outra', undefined, LOCAL)).status, 404);
    assert.deepEqual(criadas, ['Ligar para o fornecedor']);
    assert.deepEqual(excluidas, ['n1', 'outra']);
  });

  it('entrada inválida: 400; outra origem ou sem origem: 403 (nada é gravado nem apagado)', async () => {
    const s = await subir({});
    assert.equal((await s.enviar('POST', '/api/notas', { texto: '   ' }, LOCAL)).status, 400);
    assert.equal((await s.enviar('POST', '/api/notas', { texto: 3 }, LOCAL)).status, 400);
    assert.equal((await s.enviar('POST', '/api/notas', {}, LOCAL)).status, 400);
    assert.equal((await s.enviar('POST', '/api/notas', { texto: 'x'.repeat(NOTA_MAX + 1) }, LOCAL)).status, 400);
    assert.equal((await s.enviar('POST', '/api/notas', { texto: 'a' }, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('POST', '/api/notas', { texto: 'a' })).status, 403);
    assert.equal((await s.enviar('DELETE', '/api/notas/n1', undefined, 'http://evil.example')).status, 403);
    assert.equal((await s.enviar('DELETE', '/api/notas/n1')).status, 403);
  });
});
