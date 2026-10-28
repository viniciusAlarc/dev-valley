import fs from 'node:fs/promises';
import path from 'node:path';

export type Owner = 'user' | 'code' | 'infra' | null;

export interface Pendencia {
  id: string;
  /** 1 (crítico) a 6, pela seção `## P<n>` onde a linha está (aceita emoji antes do P: `## 🔴 P1 — …`). */
  priority: number;
  owner: Owner;
  item: string;
  openedAt: string;
}

function ownerOf(cell: string): Owner {
  if (cell.includes('👤')) return 'user';
  if (cell.includes('💻')) return 'code';
  if (cell.includes('🖥')) return 'infra';
  return null;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/**
 * Lê o `PENDENCIAS.md` do projeto (formato do G6: uma tabela `| ID | Dono | Item | Aberto em |` por
 * prioridade). Só leitura. Retorna null quando o projeto não tem o arquivo.
 */
export async function readPendencias(dir: string): Promise<Pendencia[] | null> {
  let text: string;
  try {
    text = await fs.readFile(path.join(dir, 'PENDENCIAS.md'), 'utf8');
  } catch {
    return null;
  }
  const out: Pendencia[] = [];
  let priority = 0;
  // Posição de cada coluna, lida do cabeçalho da tabela (cai na ordem do template se faltar).
  let col = { id: 0, owner: 1, item: 2, openedAt: 3 };
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(?:\S+\s+)?P([1-6])\b/);
    if (heading) {
      priority = Number(heading[1]);
      continue;
    }
    if (line.startsWith('#')) {
      priority = 0;
      continue;
    }
    if (!priority || !line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row.every((c) => /^:?-+:?$/.test(c))) continue;
    if (row.some((c) => c.toLowerCase() === 'dono')) {
      const find = (re: RegExp, fallback: number) => {
        const i = row.findIndex((c) => re.test(c));
        return i >= 0 ? i : fallback;
      };
      col = { id: find(/^id$/i, 0), owner: find(/^dono$/i, 1), item: find(/^(item|pendência)$/i, 2), openedAt: find(/^aberto/i, 3) };
      continue;
    }
    const item = row[col.item] ?? '';
    if (!item) continue;
    // Item fechado que ficou na tabela: ID riscado (`~~ID~~`) ou marcado com ✅.
    const id = (row[col.id] ?? '').replace(/\*\*/g, '');
    if (id.startsWith('~~') || id.includes('✅')) continue;
    out.push({ id, priority, owner: ownerOf(row[col.owner] ?? ''), item, openedAt: row[col.openedAt] ?? '' });
  }
  return out;
}
