import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { linhasAcrescentadas, procurar, termosPrivados } from '../../scripts/conferir-publico.mjs';

// Regra 1 (repositório público) cobrada pelos hooks do git em .githooks/. Nomes de mentira: nunca os de verdade.
describe('conferir-publico: nome de projeto e caminho pessoal fora do repositório', () => {
  test('termos: nome com cara de identificador e os pedaços dele; palavra comum e o próprio repositório ficam de fora', () => {
    assert.deepEqual(termosPrivados(['ProjetoAlfa_docs', 'loja-b2b', 'infra', 'docs', 'dev-valley', '.cache', 'api_v2x'], 'dev-valley'), [
      'ProjetoAlfa_docs',
      'ProjetoAlfa',
      'loja-b2b',
      'api_v2x',
    ]);
  });

  test('acha o termo como palavra inteira, sem caixa; parte de outra palavra não conta', () => {
    const termos = ['loja-b2b', 'ProjetoAlfa'];
    const onde = (n: number) => `x:${n}`;
    assert.deepEqual(procurar('ajuste na tela da loja-b2b\noutra', termos, 'fulano', onde), [{ onde: 'x:1', termo: 'loja-b2b' }]);
    assert.deepEqual(procurar('o PROJETOALFA mudou', termos, 'fulano', onde), [{ onde: 'x:1', termo: 'ProjetoAlfa' }]);
    assert.deepEqual(procurar('superloja-b2bx e ProjetoAlfaBeta', termos, 'fulano', onde), []);
  });

  test('caminho pessoal: /home/<usuário>, \\\\wsl...\\home\\<usuário> e /Users/<usuário>; ~ e outro usuário passam', () => {
    const onde = (n: number) => `x:${n}`;
    assert.equal(procurar('cd /home/fulano/projetos', [], 'fulano', onde).length, 1);
    assert.equal(procurar('\\\\wsl.localhost\\Ubuntu\\home\\fulano\\a', [], 'fulano', onde).length, 1);
    assert.equal(procurar('/Users/fulano', [], 'fulano', onde).length, 1);
    assert.deepEqual(procurar('~/projetos e /home/outro/x e /home/fulanos/y', [], 'fulano', onde), []);
  });

  test('do diff, só as linhas acrescentadas, com arquivo e linha nova', () => {
    const diff = [
      'diff --git a/a.md b/a.md',
      '--- a/a.md',
      '+++ b/a.md',
      '@@ -3,0 +4,2 @@',
      '+nova um',
      '+nova dois',
      '@@ -10 +12 @@',
      '-velha',
      '+trocada',
    ].join('\n');
    assert.deepEqual(linhasAcrescentadas(diff), [
      { arquivo: 'a.md', linha: 4, texto: 'nova um' },
      { arquivo: 'a.md', linha: 5, texto: 'nova dois' },
      { arquivo: 'a.md', linha: 12, texto: 'trocada' },
    ]);
  });
});
