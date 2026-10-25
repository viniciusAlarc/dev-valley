import fs from 'node:fs/promises';
import path from 'node:path';

export type PhaseState = 'feito' | 'andamento' | 'a fazer';

export interface Painel {
  plano: { nome: string; doc: string | null; fases: { nome: string; estado: PhaseState }[] } | null;
  entregas: { data: string; o_que: string; como: string }[];
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const state = (v: unknown): PhaseState => (v === 'feito' || v === 'andamento' ? v : 'a fazer');

/**
 * Lê o `docs-dev/painel.json` do projeto (formato do G14). Só leitura. Retorna null quando o projeto não tem
 * o arquivo ou ele não é JSON válido; campos fora do formato são ignorados.
 */
export async function readPainel(dir: string): Promise<Painel | null> {
  let data: any;
  try {
    data = JSON.parse(await fs.readFile(path.join(dir, 'docs-dev', 'painel.json'), 'utf8'));
  } catch {
    return null;
  }
  const plano = data?.plano;
  return {
    plano:
      plano && typeof plano === 'object'
        ? {
            nome: str(plano.nome),
            doc: str(plano.doc) || null,
            fases: (Array.isArray(plano.fases) ? plano.fases : []).map((f: any) => ({ nome: str(f?.nome), estado: state(f?.estado) })),
          }
        : null,
    entregas: (Array.isArray(data?.entregas) ? data.entregas : []).map((e: any) => ({ data: str(e?.data), o_que: str(e?.o_que), como: str(e?.como) })),
  };
}
