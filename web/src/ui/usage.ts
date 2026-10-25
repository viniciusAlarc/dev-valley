import { onWorld, type World } from '../api';
import { escapeHtml, timeAgo } from './panel';

const WEEKDAYS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

function resetText(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  const min = Math.round((at.getTime() - Date.now()) / 60000);
  if (min <= 0) return 'reiniciando…';
  if (min < 60) return `reinicia em ${min} min`;
  if (min < 24 * 60) return `reinicia em ${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min`;
  return `reinicia ${WEEKDAYS[at.getDay()]} ${at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Painel do canto inferior esquerdo: limites do plano, como no /usage do Claude Code. */
export function mountUsage() {
  const el = document.createElement('div');
  el.className = 'hud-usage';
  document.getElementById('hud')!.append(el);
  let usage: World['usage'] = null;

  const render = () => {
    if (!usage?.rows.length) {
      el.innerHTML = `
        <div class="usage-title">Uso do Claude</div>
        <p class="usage-empty">Aparece após a primeira resposta do Claude numa sessão (com o status line instalado).</p>`;
      return;
    }
    el.innerHTML = `
      <div class="usage-title">Uso do Claude</div>
      ${usage.rows
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
      <div class="usage-updated">atualizado ${timeAgo(usage.updatedAt)}</div>`;
  };

  onWorld((w) => {
    usage = w.usage;
    render();
  });
  // Mantém a contagem do reset andando mesmo sem novos dados.
  setInterval(render, 30_000);
  render();
}
