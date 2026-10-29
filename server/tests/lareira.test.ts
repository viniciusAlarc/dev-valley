import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { readLareira } from '../src/lareira.js';
import { projeto } from './util.js';

const OPERACAO = 'docs-dev/guias/OPERACAO.md';
const semPortas = new Map<number, number | null>();

const operacao = (linhas: string) => `# Operação

## Subir (lido pela Fábrica de agentes)

| Lado | Pasta | Comando | Porta |
|---|---|---|---|
${linhas}

## Outra seção

| Lado | Pasta | Comando | Porta |
|---|---|---|---|
| ignorado | . | \`echo não\` | 1 |
`;

describe('readLareira (tabela "Subir")', () => {
  test('sem OPERACAO.md, sem a seção ou sem lado com comando: null', async () => {
    assert.equal(await readLareira(await projeto(), semPortas), null);
    assert.equal(await readLareira(await projeto({ [OPERACAO]: '# Operação\n\nNada.\n' }), semPortas), null);
    assert.equal(await readLareira(await projeto({ [OPERACAO]: operacao('| back | . |  | 8080 |') }), semPortas), null);
  });

  test('lê os lados até a próxima seção, tira crase e desfaz pipe escapado', async () => {
    const dir = await projeto({ [OPERACAO]: operacao('| back | . | `npm start \\| tee log` | 8080 |\n| front | web | `npm run dev` | 5173 |') });
    await fs.mkdir(path.join(dir, 'web'));
    const lareira = await readLareira(dir, new Map([[8080, 1234]]));
    assert.deepEqual(lareira, {
      lados: [
        { lado: 'back', pasta: '.', cwd: dir, comando: 'npm start | tee log', porta: 8080, ocupada: true, pid: 1234, problema: null, vila: null },
        { lado: 'front', pasta: 'web', cwd: path.join(dir, 'web'), comando: 'npm run dev', porta: 5173, ocupada: false, pid: null, problema: null, vila: null },
      ],
    });
  });

  test('problema de cada lado: pasta fora, pasta inexistente, porta inválida', async () => {
    const dir = await projeto({
      [OPERACAO]: operacao(
        ['| a | ../.. | `ls` | 1 |', '| b | nao-existe | `ls` | 2 |', '| c | . | `ls` | oito |', '| d | ../.. |  |  |'].join('\n'),
      ),
    });
    const lados = (await readLareira(dir, semPortas))?.lados ?? [];
    assert.deepEqual(
      lados.map((l) => [l.lado, l.problema, l.cwd === null]),
      [
        ['a', 'pasta fora do projeto', true],
        ['b', 'pasta não existe', true],
        ['c', 'porta inválida', false],
        // Sem comando a vila não liga o lado, então não há problema a apontar.
        ['d', null, true],
      ],
    );
  });
});
