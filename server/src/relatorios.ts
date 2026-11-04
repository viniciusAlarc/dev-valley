import fs from 'node:fs/promises';
import path from 'node:path';

/** Relatório de uma rodada do maestro: um `.md` em `docs-dev/maestro/` (MA-1, fase 4). */
export interface Relatorio {
  /** Caminho absoluto (abre no leitor da biblioteca). */
  path: string;
  title: string;
  /** `AAAA-MM-DD` do começo do nome do arquivo; null se o nome não começa com data. */
  data: string | null;
}

/**
 * Quadro de relatórios do porão: os relatórios que o maestro escreve ao fechar cada rodada
 * (`docs-dev/maestro/AAAA-MM-DD-<assunto>.md`), o mais novo primeiro. Título = primeiro `# ` do arquivo, sem o
 * "Rodada: " do modelo. Só leitura. Retorna null quando o projeto não tem a pasta.
 */
export async function readRelatorios(dir: string): Promise<Relatorio[] | null> {
  const base = path.join(dir, 'docs-dev', 'maestro');
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort().reverse();
  return Promise.all(
    files.map(async (name) => {
      const full = path.join(base, name);
      const text = await fs.readFile(full, 'utf8').catch(() => '');
      const title = text.match(/^#\s+(.+)$/m)?.[1].trim().replace(/^Rodada:\s*/i, '') || name.replace(/\.md$/, '');
      return { path: full, title, data: name.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null };
    }),
  );
}
