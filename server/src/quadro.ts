import fs from 'node:fs/promises';
import path from 'node:path';
import type { Painel } from './painel.js';

/** Documento citado no `painel.json`: o `doc` do plano ou de uma fase. */
export interface PlanoAcao {
  /** Nome do plano ou da fase dona do `doc`. */
  fase: string;
  /** O `doc` como está no `painel.json`; o quadro acha o documento por ele. */
  doc: string;
  /** Caminho absoluto, sempre dentro da pasta do projeto. */
  path: string;
  /** `html` abre isolado no painel do quadro; `md` abre no leitor da biblioteca. */
  kind: 'html' | 'md';
}

const KIND: Record<string, PlanoAcao['kind']> = { '.html': 'html', '.htm': 'html', '.md': 'md' };

/**
 * Documentos que o quadro negro da casa abre (decisão de 27/10/2026: o quadro mostra o `painel.json` inteiro): o `doc`
 * do plano e o de cada fase, em qualquer estado. Só entra arquivo que existe, fica dentro do projeto e é HTML ou Markdown.
 */
export async function readQuadro(dir: string, painel: Painel | null): Promise<PlanoAcao[]> {
  const base = path.resolve(dir);
  const plano = painel?.plano;
  const docs = [...(plano?.doc ? [{ nome: plano.nome, doc: plano.doc }] : []), ...(plano?.fases ?? []).filter((f) => f.doc)];
  const planos = await Promise.all(
    docs.map(async (f): Promise<PlanoAcao | null> => {
      const full = path.resolve(base, f.doc!);
      const kind = KIND[path.extname(full).toLowerCase()];
      if (!kind || !full.startsWith(base + path.sep)) return null;
      const s = await fs.stat(full).catch(() => null);
      return s?.isFile() ? { fase: f.nome, doc: f.doc!, path: full, kind } : null;
    }),
  );
  return planos.filter((p): p is PlanoAcao => p !== null);
}
