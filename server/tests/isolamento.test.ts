import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CLAUDE_PROJECTS_DIR } from '../src/config.js';
import { MORADORES_DIR } from '../src/moradores.js';

// O `npm test` roda com `--import ./scripts/isolar-home.mjs`: o HOME é uma pasta temporária, nunca o de verdade.
test('o HOME dos testes é temporário: nenhum teste alcança o ~ de verdade', () => {
  const real = os.userInfo().homedir;
  assert.notEqual(os.homedir(), real, 'rode pelo `npm test` (o preload scripts/isolar-home.mjs troca o HOME)');
  assert.ok(os.homedir().startsWith(os.tmpdir() + path.sep), 'o HOME de teste mora na pasta temporária');
  for (const p of [CLAUDE_PROJECTS_DIR, MORADORES_DIR]) assert.ok(!p.startsWith(real + path.sep), `${p} aponta para o ~ de verdade`);
});
