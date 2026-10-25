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

/** Guardado em disco para as estimativas continuarem certas depois de reiniciar a vila. */
const WINDOWS_FILE = path.join(os.homedir(), '.cache', 'dev-valley', 'context-windows.json');

export class StatusLineStore {
  private contexts = new Map<string, SessionContext>();
  /** Tamanho da janela por modelo, aprendido do status line — usado para estimar sessões antigas. */
  private windows = new Map<string, number>(this.loadWindows());
  usage: Usage | null = null;

  private loadWindows(): [string, number][] {
    try {
      return Object.entries(JSON.parse(fs.readFileSync(WINDOWS_FILE, 'utf8')));
    } catch {
      return [];
    }
  }

  private learnWindow(model: string, size: number) {
    if (this.windows.get(model) === size) return;
    this.windows.set(model, size);
    fs.mkdirSync(path.dirname(WINDOWS_FILE), { recursive: true });
    fs.writeFileSync(WINDOWS_FILE, JSON.stringify(Object.fromEntries(this.windows), null, 2));
  }

  handle(p: any): boolean {
    let changed = false;
    const rows = parseRateLimits(p?.rate_limits);
    if (rows) {
      const before = JSON.stringify(this.usage?.rows);
      this.usage = { rows, updatedAt: Date.now() };
      changed ||= before !== JSON.stringify(rows);
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
