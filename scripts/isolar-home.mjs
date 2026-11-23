// Preload do `npm test` (--import): troca o HOME por uma pasta temporária antes de qualquer teste carregar.
// Todo caminho de `~` do servidor sai de `os.homedir()` na hora do import, então nenhum teste consegue gravar no
// `~/.claude` ou no `~/.cache` de verdade, mesmo esquecendo de trocar o HOME. Nasceu de duas linhas do RETRABALHO.md
// (29/10 e 08/11/2026). O executor e os processos de cada arquivo de teste herdam a mesma pasta, apagada no fim.
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (!process.env.DEV_VALLEY_HOME_DE_TESTE) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dev-valley-home-'));
  process.env.HOME = dir;
  process.env.DEV_VALLEY_HOME_DE_TESTE = dir;
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
}
