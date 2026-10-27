import fs from 'node:fs/promises';
import path from 'node:path';

export type PhaseState = 'feito' | 'andamento' | 'a fazer';

/** Subfase (`etapas` da fase ou de outra etapa), em quantos níveis o `painel.json` tiver. */
export interface Etapa {
  nome: string;
  estado: PhaseState;
  etapas: Etapa[];
}

export interface Painel {
  plano: {
    nome: string;
    doc: string | null;
    /** `doc` da fase: documento do plano de ação dela (campo opcional, fora do exemplo do G14). */
    fases: { nome: string; estado: PhaseState; doc: string | null; etapas: Etapa[] }[];
  } | null;
  entregas: { data: string; o_que: string; como: string }[];
  /** O arquivo inteiro como está, campos fora do formato inclusive (quadro negro). */
  json: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const state = (v: unknown): PhaseState => (v === 'feito' || v === 'andamento' ? v : 'a fazer');
/** Até 6 níveis: protege contra JSON torto, sem limitar nenhum painel real. */
const etapas = (v: unknown, depth = 0): Etapa[] =>
  Array.isArray(v) && depth < 6 ? v.map((e: any) => ({ nome: str(e?.nome), estado: state(e?.estado), etapas: etapas(e?.etapas, depth + 1) })) : [];

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
            fases: (Array.isArray(plano.fases) ? plano.fases : []).map((f: any) => ({ nome: str(f?.nome), estado: state(f?.estado), doc: str(f?.doc) || null, etapas: etapas(f?.etapas) })),
          }
        : null,
    entregas: (Array.isArray(data?.entregas) ? data.entregas : []).map((e: any) => ({ data: str(e?.data), o_que: str(e?.o_que), como: str(e?.como) })),
    json: JSON.stringify(data, null, 2),
  };
}
