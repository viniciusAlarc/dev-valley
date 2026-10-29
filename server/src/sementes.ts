import fs from 'node:fs/promises';
import path from 'node:path';
import { TO_CHECK } from './progress.js';

/** Um plano decidido e ainda não codado (G7): um `.md` em `docs-dev/a-codar/`. */
export interface Semente {
  /** Caminho absoluto (abre no leitor da biblioteca). */
  path: string;
  title: string;
  /** Algum passo ainda diz "falta conferir na vila": o sino avisa que o plano não sai com a caixinha. */
  toCheck: boolean;
}

/**
 * Caixa de sementes da casa (decisão de 26/10/2026): os planos em `docs-dev/a-codar/` (só o primeiro nível, sem o
 * `README.md`, que é o índice). Título = primeiro `# ` do arquivo, ou o nome dele. Só leitura.
 * Retorna null quando o projeto não tem a pasta.
 */
export async function readSementes(dir: string): Promise<Semente[] | null> {
  const base = path.join(dir, 'docs-dev', 'a-codar');
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md').map((e) => e.name).sort();
  return Promise.all(
    files.map(async (name) => {
      const full = path.join(base, name);
      const text = await fs.readFile(full, 'utf8').catch(() => '');
      const title = text.match(/^#\s+(.+)$/m)?.[1].trim() || name.replace(/\.md$/, '');
      return { path: full, title, toCheck: TO_CHECK.test(text) };
    }),
  );
}
