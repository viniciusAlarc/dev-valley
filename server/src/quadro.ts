import fs from 'node:fs/promises';
import path from 'node:path';
import type { Painel } from './painel.js';

/** Plano de ação de uma fase em andamento: o `doc` dela no `painel.json`. */
export interface PlanoAcao {
  fase: string;
  /** Caminho absoluto, sempre dentro da pasta do projeto. */
  path: string;
  /** `html` abre isolado no painel do quadro; `md` abre no leitor da biblioteca. */
  kind: 'html' | 'md';
}

const KIND: Record<string, PlanoAcao['kind']> = { '.html': 'html', '.htm': 'html', '.md': 'md' };

/**
 * Quadro negro da casa (decisão de 27/10/2026): o plano de ação de cada fase em `andamento` do `painel.json` que tem
 * `doc`. Só entra arquivo que existe, fica dentro do projeto e é HTML ou Markdown. Lista vazia = quadro sem conteúdo.
 */
export async function readQuadro(dir: string, painel: Painel | null): Promise<PlanoAcao[]> {
  const base = path.resolve(dir);
  const fases = (painel?.plano?.fases ?? []).filter((f) => f.estado === 'andamento' && f.doc);
  const planos = await Promise.all(
    fases.map(async (f): Promise<PlanoAcao | null> => {
      const full = path.resolve(base, f.doc!);
      const kind = KIND[path.extname(full).toLowerCase()];
      if (!kind || !full.startsWith(base + path.sep)) return null;
      const s = await fs.stat(full).catch(() => null);
      return s?.isFile() ? { fase: f.nome, path: full, kind } : null;
    }),
  );
  return planos.filter((p): p is PlanoAcao => p !== null);
}
