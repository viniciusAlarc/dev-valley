import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { arquivoPermitido, isLocalOrigin } from '../src/seguranca.js';
import { projeto } from './util.js';

describe('isLocalOrigin (regra 2: só página local)', () => {
  test('aceita sem Origin, localhost e 127.0.0.1 em qualquer porta', () => {
    for (const o of [undefined, '', 'http://localhost:5173', 'http://127.0.0.1:4777', 'https://localhost'])
      assert.equal(isLocalOrigin(o), true, String(o));
  });

  test('recusa outro host, host que só começa com localhost e origem que não é URL', () => {
    for (const o of ['https://exemplo.com', 'http://localhost.exemplo.com', 'http://192.168.0.10:4777', 'null'])
      assert.equal(isLocalOrigin(o), false, o);
  });
});

describe('arquivoPermitido (/api/arquivo)', () => {
  test('entrega arquivo de dentro do projeto pelo caminho real', async () => {
    const dir = await projeto({ 'docs/guia.md': '# Guia' });
    assert.equal(arquivoPermitido(path.join(dir, 'docs', 'guia.md'), [dir]), await fs.realpath(path.join(dir, 'docs', 'guia.md')));
  });

  test('recusa caminho relativo, pasta, inexistente e arquivo fora dos projetos', async () => {
    const dir = await projeto({ 'a.md': '' });
    const fora = await projeto({ 'b.md': '' });
    assert.equal(arquivoPermitido('a.md', [dir]), null);
    assert.equal(arquivoPermitido(dir, [dir]), null);
    assert.equal(arquivoPermitido(path.join(dir, 'nao-existe.md'), [dir]), null);
    assert.equal(arquivoPermitido(path.join(fora, 'b.md'), [dir]), null);
    assert.equal(arquivoPermitido(path.join(dir, '..', path.basename(fora), 'b.md'), [dir]), null);
  });

  test('pasta vizinha com o mesmo começo de nome não conta como dentro', async () => {
    const dir = await projeto();
    const vizinha = `${dir}-vizinha`;
    await fs.mkdir(vizinha);
    await fs.writeFile(path.join(vizinha, 'x.md'), '');
    try {
      assert.equal(arquivoPermitido(path.join(vizinha, 'x.md'), [dir]), null);
    } finally {
      await fs.rm(vizinha, { recursive: true, force: true });
    }
  });

  test('nada que comece com ponto, em qualquer nível', async () => {
    const dir = await projeto({ '.env': 'SEGREDO=1', '.git/config': '', 'docs/.rascunho/a.md': '' });
    for (const f of ['.env', '.git/config', 'docs/.rascunho/a.md']) assert.equal(arquivoPermitido(path.join(dir, f), [dir]), null, f);
  });

  test('link simbólico de dentro do projeto para fora não escapa', async () => {
    const dir = await projeto();
    const fora = await projeto({ 'segredo.txt': 'x' });
    await fs.symlink(path.join(fora, 'segredo.txt'), path.join(dir, 'atalho.txt'));
    assert.equal(arquivoPermitido(path.join(dir, 'atalho.txt'), [dir]), null);
  });
});
