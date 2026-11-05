import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { readSementes } from '../src/sementes.js';
import { projeto } from './util.js';

describe('caixa de sementes (readSementes)', () => {
  test('sem docs-dev/a-codar/ devolve null', async () => {
    const dir = await projeto({ 'docs-dev/painel.json': '{}' });
    assert.equal(await readSementes(dir), null);
  });

  test('pasta vazia devolve lista vazia, não null', async () => {
    const dir = await projeto();
    await fs.mkdir(path.join(dir, 'docs-dev', 'a-codar'), { recursive: true });
    assert.deepEqual(await readSementes(dir), []);
  });

  test('só .md do primeiro nível, sem o README (em qualquer caixa), em ordem de nome', async () => {
    const dir = await projeto({
      'docs-dev/a-codar/b-plano.md': '# Plano B\n',
      'docs-dev/a-codar/a-plano.md': '# Plano A\n',
      'docs-dev/a-codar/README.md': '# Índice\n',
      'docs-dev/a-codar/Readme.MD': '# Outro índice\n',
      'docs-dev/a-codar/notas.txt': 'não é plano',
      'docs-dev/a-codar/sub/c-plano.md': '# Plano C, numa subpasta\n',
    });
    const sementes = await readSementes(dir);
    assert.deepEqual(
      sementes?.map((s) => path.basename(s.path)),
      ['a-plano.md', 'b-plano.md'],
    );
  });

  test('pasta terminada em .md não vira semente', async () => {
    const dir = await projeto({ 'docs-dev/a-codar/pasta.md/dentro.md': '# Dentro\n' });
    assert.deepEqual(await readSementes(dir), []);
  });

  test('caminho absoluto e título do primeiro "# ", mesmo depois de outras linhas', async () => {
    const dir = await projeto({
      'docs-dev/a-codar/plano.md': 'Decidido em 26/10.\n\n#   Título com espaços   \n\n# Segundo título\n',
    });
    const [s] = (await readSementes(dir)) ?? [];
    assert.equal(s.path, path.join(dir, 'docs-dev', 'a-codar', 'plano.md'));
    assert.ok(path.isAbsolute(s.path));
    assert.equal(s.title, 'Título com espaços');
  });

  test('sem "# " o título é o nome do arquivo sem .md ("## " não conta)', async () => {
    const dir = await projeto({
      'docs-dev/a-codar/sem-titulo.md': '## Só subtítulo\n\ntexto\n',
      'docs-dev/a-codar/vazio.md': '',
    });
    const sementes = await readSementes(dir);
    assert.deepEqual(sementes?.map((s) => s.title), ['sem-titulo', 'vazio']);
  });

  test('toCheck acende com "falta conferir na vila" e não com a frase citada entre aspas', async () => {
    const dir = await projeto({
      'docs-dev/a-codar/a.md': '# A\n\n- [ ] Passo 2: Falta conferir na vila (reinício do usuário).\n',
      'docs-dev/a-codar/b.md': '# B\n\nO sino avisa quando aparece "falta conferir na vila".\n',
      'docs-dev/a-codar/c.md': '# C\n\nTudo codado.\n',
    });
    const sementes = await readSementes(dir);
    assert.deepEqual(
      sementes?.map((s) => [s.title, s.toCheck]),
      [['A', true], ['B', false], ['C', false]],
    );
  });
});
