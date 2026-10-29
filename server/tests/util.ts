import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';

const criadas: string[] = [];
after(() => Promise.all(criadas.map((d) => fs.rm(d, { recursive: true, force: true }))));

/** Projeto de mentira numa pasta temporária: `{ 'docs-dev/painel.json': '{...}' }`. Apagado no fim do arquivo de teste. */
export async function projeto(arquivos: Record<string, string> = {}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-valley-teste-'));
  criadas.push(dir);
  for (const [nome, texto] of Object.entries(arquivos)) {
    await fs.mkdir(path.dirname(path.join(dir, nome)), { recursive: true });
    await fs.writeFile(path.join(dir, nome), texto);
  }
  return dir;
}
