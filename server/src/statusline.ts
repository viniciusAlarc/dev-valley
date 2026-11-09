import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Recebe o JSON do status line do Claude Code (instalado por `npm run hooks:install`).
 * É de lá que vêm, prontos e calculados pelo próprio Claude Code:
 *  - a janela de contexto usada por sessão;
 *  - os limites do plano (sessão de 5h, semanal...), como o servidor da Anthropic os informa.
 */

export interface UsageRow {
  kind: string;
  group: string;
  label: string;
  percent: number;
  resetsAt: string | null;
  severity: 'normal' | 'warning' | 'critical' | string;
}

export interface Usage {
  rows: UsageRow[];
  updatedAt: number;
}

export interface SessionContext {
  percent: number;
  tokens: number;
  window: number;
  updatedAt: number;
}

const KIND_LABEL: Record<string, string> = {
  session: 'Sessão atual (5h)',
  five_hour: 'Sessão atual (5h)',
  weekly_all: 'Semana — todos os modelos',
  seven_day: 'Semana — todos os modelos',
};

function severityFor(percent: number) {
  return percent >= 90 ? 'critical' : percent >= 75 ? 'warning' : 'normal';
}

function toIso(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v * (v < 1e12 ? 1000 : 1)).toISOString();
  return null;
}

/** Aceita o formato novo (limits[] do servidor) e o antigo (five_hour/seven_day). */
function parseRateLimits(rl: any): UsageRow[] | null {
  if (!rl || typeof rl !== 'object') return null;
  if (Array.isArray(rl.limits)) {
    return rl.limits.map((l: any) => {
      const scoped = l.scope?.model?.display_name ?? l.scope?.surface?.display_name;
      return {
        kind: String(l.kind),
        group: String(l.group ?? ''),
        label: scoped ? `Semana — ${scoped}` : (KIND_LABEL[l.kind] ?? String(l.kind)),
        percent: Number(l.percent ?? 0),
        resetsAt: toIso(l.resets_at),
        severity: l.severity ?? severityFor(Number(l.percent ?? 0)),
      };
    });
  }
  const rows: UsageRow[] = [];
  for (const kind of ['five_hour', 'seven_day']) {
    const w = rl[kind];
    if (!w) continue;
    const percent = Number(w.used_percentage ?? 0);
    rows.push({ kind, group: kind === 'five_hour' ? 'session' : 'weekly', label: KIND_LABEL[kind], percent, resetsAt: toIso(w.resets_at), severity: severityFor(percent) });
  }
  return rows.length ? rows : null;
}

/** Uma leitura da porcentagem de um limite. */
export interface Amostra {
  t: number;
  percent: number;
}

/** Previsão de um limite do plano, no moinho (decisão do usuário, 08/11/2026). */
export interface RitmoLimite {
  label: string;
  /** 'session' (5h) ou 'weekly'. */
  group: string;
  percent: number;
  resetsAt: string | null;
  /** Pontos percentuais por hora no ritmo usado; null = ainda sem dado bastante. */
  porHora: number | null;
  /** Quando chega a 100% nesse ritmo, se for antes de renovar; null = não estoura antes. */
  estouraEm: number | null;
  /** Porcentagem prevista na hora de renovar, quando não estoura antes; null = sem previsão. */
  aoRenovar: number | null;
}

const HORA = 3_600_000;
const SEMANA_MS = 7 * 24 * HORA;
/** O ritmo da sessão de 5h é o da última hora; menos de 10 minutos de leitura ainda não diz nada. */
const JANELA_SESSAO = HORA;
const MINIMO_SESSAO = 10 * 60_000;

/**
 * Previsão de um limite: na sessão de 5h, o ritmo da última hora (o que está acontecendo agora); na semana, o ritmo
 * médio desde que ela começou (uma hora intensa não diz como a semana fecha). Sem DOM nem relógio, para teste.
 */
export function preverLimite(row: UsageRow, amostras: Amostra[], agora: number): RitmoLimite {
  const base = { label: row.label, group: row.group, percent: row.percent, resetsAt: row.resetsAt };
  const renova = row.resetsAt ? Date.parse(row.resetsAt) : NaN;
  let porMs: number | null = null;
  if (row.group === 'session') {
    const recentes = amostras.filter((a) => agora - a.t <= JANELA_SESSAO);
    const [primeira, ultima] = [recentes[0], recentes[recentes.length - 1]];
    if (primeira && ultima && ultima.t - primeira.t >= MINIMO_SESSAO) porMs = Math.max(0, (ultima.percent - primeira.percent) / (ultima.t - primeira.t));
  } else if (Number.isFinite(renova)) {
    const decorrido = agora - (renova - SEMANA_MS);
    if (decorrido >= HORA) porMs = row.percent / decorrido;
  }
  if (porMs === null) return { ...base, porHora: null, estouraEm: null, aoRenovar: null };
  const estoura = porMs > 0 ? agora + (100 - row.percent) / porMs : Infinity;
  if (row.percent < 100 && Number.isFinite(estoura) && (!Number.isFinite(renova) || estoura < renova))
    return { ...base, porHora: porMs * HORA, estouraEm: Math.round(estoura), aoRenovar: null };
  const aoRenovar = Number.isFinite(renova) ? Math.min(100, row.percent + porMs * Math.max(0, renova - agora)) : null;
  return { ...base, porHora: porMs * HORA, estouraEm: null, aoRenovar };
}

/** Guardados em disco para sobreviver a reinícios da vila. */
const CACHE_DIR = path.join(os.homedir(), '.cache', 'dev-valley');
const WINDOWS_FILE = path.join(CACHE_DIR, 'context-windows.json');
const USAGE_FILE = path.join(CACHE_DIR, 'usage.json');

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export class StatusLineStore {
  private contexts = new Map<string, SessionContext>();
  /** Tamanho da janela por modelo, aprendido do status line — usado para estimar sessões antigas. */
  private windows = new Map<string, number>(Object.entries(readJson<Record<string, number>>(WINDOWS_FILE, {})));
  /**
   * O Claude Code só manda os limites depois da primeira resposta da API numa sessão,
   * então o último valor conhecido fica salvo e aparece com "atualizado há X".
   */
  usage: Usage | null = readJson<Usage | null>(USAGE_FILE, null);
  /** Leituras de cada limite (por `label`) desde que a janela dele renovou, para a previsão do moinho. Só na memória. */
  private amostras = new Map<string, { resetsAt: string | null; lista: Amostra[] }>();

  private amostrar(rows: UsageRow[], agora: number) {
    for (const r of rows) {
      const a = this.amostras.get(r.label);
      const ultima = a?.lista[a.lista.length - 1];
      // Janela nova (renovou) ou porcentagem que caiu: o ritmo recomeça do zero.
      if (!a || a.resetsAt !== r.resetsAt || (ultima && r.percent < ultima.percent)) {
        this.amostras.set(r.label, { resetsAt: r.resetsAt, lista: [{ t: agora, percent: r.percent }] });
        continue;
      }
      if (ultima && ultima.percent === r.percent && agora - ultima.t < 5 * 60_000) continue;
      a.lista.push({ t: agora, percent: r.percent });
      a.lista = a.lista.filter((x) => agora - x.t <= 2 * HORA);
    }
  }

  /** Previsão de cada limite conhecido (moinho); vazio até a primeira sessão reportar. */
  ritmo(agora = Date.now()): RitmoLimite[] {
    return (this.usage?.rows ?? []).map((r) => preverLimite(r, this.amostras.get(r.label)?.lista ?? [], agora));
  }

  private learnWindow(model: string, size: number) {
    if (this.windows.get(model) === size) return;
    this.windows.set(model, size);
    writeJson(WINDOWS_FILE, Object.fromEntries(this.windows));
  }

  handle(p: any): boolean {
    let changed = false;
    const rows = parseRateLimits(p?.rate_limits);
    if (rows) {
      this.usage = { rows, updatedAt: Date.now() };
      this.amostrar(rows, this.usage.updatedAt);
      writeJson(USAGE_FILE, this.usage);
      // "atualizado há X" também muda, então a vila redesenha a cada reporte.
      changed = true;
    }
    const cw = p?.context_window;
    const id = typeof p?.session_id === 'string' && /^[0-9a-f-]{36}$/.test(p.session_id) ? p.session_id : null;
    if (cw && typeof cw.context_window_size === 'number') {
      if (typeof p.model === 'string') this.learnWindow(p.model, cw.context_window_size);
      if (id && typeof cw.used_percentage === 'number') {
        const prev = this.contexts.get(id);
        this.contexts.set(id, {
          percent: cw.used_percentage,
          tokens: Number(cw.total_input_tokens ?? 0),
          window: cw.context_window_size,
          updatedAt: Date.now(),
        });
        changed ||= Math.round(prev?.percent ?? -1) !== Math.round(cw.used_percentage);
      }
    }
    return changed;
  }

  context(sessionId: string) {
    return this.contexts.get(sessionId);
  }

  windowFor(model: string | null) {
    return (model && this.windows.get(model)) || null;
  }
}
