import path from 'node:path';
import { CATALOG_PATH } from './catalog.js';
import { askAgent, type AgentEvent, type Exchange } from './consulta.js';

/**
 * Consultas à bibliotecária feitas pela vila (base comum em `consulta.ts`):
 * a "memória" dela é o catálogo em disco, não a conversa — por isso nunca enche o contexto.
 */

export type { Exchange };
export type LibrarianEvent = AgentEvent;

function stepFor(tool: string, input: any): string {
  const file = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');
  if (tool === 'Read') return input?.file_path === CATALOG_PATH ? '📇 Consultando o catálogo' : `📖 Lendo ${file(input?.file_path)}`;
  if (tool === 'Grep') return `🔎 Procurando "${String(input?.pattern ?? '').slice(0, 40)}"`;
  if (tool === 'Glob') return `🗂️ Olhando as estantes (${String(input?.pattern ?? '').slice(0, 40)})`;
  return `🔧 ${tool}`;
}

export function askLibrarian(
  question: string,
  history: Exchange[],
  onEvent: (e: LibrarianEvent) => void,
  hooksToIgnore: Set<string>,
): () => void {
  return askAgent(
    { name: 'bibliotecaria', who: 'A bibliotecária', replacements: { '{{CATALOGO}}': CATALOG_PATH }, stepFor },
    question,
    history,
    onEvent,
    hooksToIgnore,
  );
}
