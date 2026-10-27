import fs from 'node:fs/promises';
import path from 'node:path';

/** Um documento de arquitetura já implementada (G7): um `.md` ou `.html` em `docs-dev/context/`. */
export interface Livro {
  /** Caminho absoluto. */
  path: string;
  title: string;
  /** `html` abre isolado num painel; `md` abre no leitor da biblioteca. */
  kind: 'html' | 'md';
}

const KIND: Record<string, Livro['kind']> = { '.html': 'html', '.htm': 'html', '.md': 'md' };

/**
 * Estante da casa (decisão de 27/10/2026): o que já foi construído, `docs-dev/context/` (só o primeiro nível, sem o
 * `README.md`, que é o índice). Fecha o ciclo do plano: semente (`a-codar/`) → quadro negro (em andamento) → livro.
 * Título = primeiro `# ` do Markdown ou `<title>` do HTML, ou o nome do arquivo. Só leitura.
 * Retorna null quando o projeto não tem a pasta.
 */
export async function readEstante(dir: string): Promise<Livro[] | null> {
  const base = path.join(dir, 'docs-dev', 'context');
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = entries
    .filter((e) => e.isFile() && KIND[path.extname(e.name).toLowerCase()] && e.name.toLowerCase() !== 'readme.md')
    .map((e) => e.name)
    .sort();
  return Promise.all(
    files.map(async (name) => {
      const full = path.join(base, name);
      const kind = KIND[path.extname(name).toLowerCase()];
      const text = await fs.readFile(full, 'utf8').catch(() => '');
      const found = kind === 'md' ? text.match(/^#\s+(.+)$/m)?.[1] : text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
      return { path: full, title: found?.trim() || name.replace(/\.[^.]+$/, ''), kind };
    }),
  );
}
