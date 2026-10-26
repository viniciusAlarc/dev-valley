import fs from 'node:fs/promises';
import path from 'node:path';

/** `RETRABALHO.md` (G17): cabeçalho da tabela e uma linha por retrabalho, como estão no arquivo. */
export interface Retrabalho {
  header: string[];
  rows: string[][];
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/**
 * Ervas daninhas do quintal (decisão de 26/10/2026): cada linha da tabela é um retrabalho. Os projetos variam o
 * formato (data `AAAA-MM-DD` ou `DD/MM`, colunas extras), então o cabeçalho vem junto e nada é reinterpretado.
 * Só leitura; null quando o projeto não tem o arquivo.
 */
export async function readRetrabalho(dir: string): Promise<Retrabalho | null> {
  let text: string;
  try {
    text = await fs.readFile(path.join(dir, 'RETRABALHO.md'), 'utf8');
  } catch {
    return null;
  }
  let header: string[] = [];
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row.every((c) => /^:?-{3,}:?$/.test(c))) continue; // separador |---|
    if (!header.length) header = row;
    else if (row.some(Boolean)) rows.push(row);
  }
  return { header, rows };
}
