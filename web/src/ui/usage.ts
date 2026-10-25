import { onWorld, type World } from '../api';
import { escapeHtml, timeAgo } from './panel';

const WEEKDAYS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const COLLAPSED_KEY = 'dv-usage-collapsed';

function resetText(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  const min = Math.round((at.getTime() - Date.now()) / 60000);
  if (min <= 0) return 'reiniciando…';
  if (min < 60) return `reinicia em ${min} min`;
  if (min < 24 * 60) return `reinicia em ${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min`;
  return `reinicia ${WEEKDAYS[at.getDay()]} ${at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function shortLabel(kind: string, label: string) {
  if (kind === 'session' || kind === 'five_hour') return '5h';
  if (kind === 'weekly_all' || kind === 'seven_day') return '7d';
  return label.replace(/^Semana — /, '');
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Painel do canto inferior esquerdo: limites do plano, como no /usage do Claude Code. */
export function mountUsage() {
  const el = document.createElement('div');
  el.className = 'hud-usage';
  document.getElementById('hud')!.append(el);
  let usage: World['usage'] = null;
  let collapsed = readCollapsed();

  const render = () => {
    el.classList.toggle('collapsed', collapsed);
    const rows = usage?.rows ?? [];
    const header = `
      <button class="usage-title" title="${collapsed ? 'Expandir' : 'Minimizar'}">
        <span>Uso do Claude</span>
        ${
          collapsed && rows.length
            ? `<span class="usage-chips">${rows
                .map((r) => `<span class="usage-chip sev-${escapeHtml(r.severity)}">${escapeHtml(shortLabel(r.kind, r.label))} ${Math.round(r.percent)}%</span>`)
                .join('')}</span>`
            : ''
        }
        <span class="usage-toggle">${collapsed ? '▴' : '▾'}</span>
      </button>`;
    if (collapsed) {
      el.innerHTML = header;
      return;
    }
    if (!rows.length) {
      el.innerHTML = `${header}<p class="usage-empty">Aparece após a primeira resposta do Claude numa sessão (com o status line instalado).</p>`;
      return;
    }
    el.innerHTML = `
      ${header}
      ${rows
        .map((r) => {
          const pct = Math.max(0, Math.min(100, Math.round(r.percent)));
          return `
          <div class="usage-row">
            <div class="usage-label"><span>${escapeHtml(r.label)}</span><b>${pct}%</b></div>
            <div class="usage-bar"><div class="usage-fill sev-${escapeHtml(r.severity)}" style="width:${pct}%"></div></div>
            <div class="usage-reset">${resetText(r.resetsAt)}</div>
          </div>`;
        })
        .join('')}
      <div class="usage-updated">atualizado ${timeAgo(usage!.updatedAt)}</div>`;
  };

  el.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.usage-title')) return;
    collapsed = !collapsed;
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // sem armazenamento: só não lembra a preferência
    }
    render();
  });

  onWorld((w) => {
    usage = w.usage;
    render();
  });
  // Mantém a contagem do reset andando mesmo sem novos dados.
  setInterval(render, 30_000);
  render();
}
