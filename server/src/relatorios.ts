import fs from 'node:fs/promises';
import path from 'node:path';
import { MORADORES_DIR } from './moradores.js';

/** Relatório de uma rodada do maestro: um `.md` em `docs-dev/maestro/` (MA-1, fase 4; estante de partitura do porão, 04/11/2026). */
export interface Relatorio {
  /** Caminho absoluto (abre no leitor da biblioteca). */
  path: string;
  title: string;
  /** `AAAA-MM-DD` do começo do nome do arquivo; null se o nome não começa com data. */
  data: string | null;
  /** O usuário já abriu este relatório pela vila (estante de partitura do porão); até lá, ele aparece como novo. */
  lido: boolean;
}

/**
 * Estante de partitura do porão: os relatórios que o maestro escreve ao fechar cada rodada
 * (`docs-dev/maestro/AAAA-MM-DD-<assunto>.md`), o mais novo primeiro. Título = primeiro `# ` do arquivo, sem o
 * "Rodada: " do modelo; `lidos` = caminhos absolutos já abertos (`RelatoriosLidos`). Só leitura. Retorna null quando o
 * projeto não tem a pasta.
 */
export async function readRelatorios(dir: string, lidos: ReadonlySet<string> = new Set()): Promise<Relatorio[] | null> {
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
      return { path: full, title, data: name.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null, lido: lidos.has(full) };
    }),
  );
}

export const LIDOS_FILE = path.join(MORADORES_DIR, 'relatorios-lidos.json');

/**
 * Quais relatórios o usuário já abriu pela vila (decisão do usuário, 03/11/2026: "novo" até abrir). Fora do git, em
 * `~/.claude/dev-valley/`, como o `porao.json`: é estado da vila, não do projeto. Guarda caminhos absolutos.
 */
export class RelatoriosLidos {
  constructor(private file = LIDOS_FILE) {}

  async lidos(): Promise<Set<string>> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      return new Set(Array.isArray(raw?.lidos) ? raw.lidos.filter((x: unknown) => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  }

  /** Marca como lido; o caminho já vem conferido pela rota (só relatório listado no mundo). */
  async marcar(caminho: string): Promise<void> {
    const lidos = await this.lidos();
    if (lidos.has(caminho)) return;
    lidos.add(caminho);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify({ lidos: [...lidos].sort() }, null, 2));
  }
}
