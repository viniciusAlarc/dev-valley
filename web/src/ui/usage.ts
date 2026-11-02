import type { World } from '../api';
import { voltaQuando } from '../game/torre';
import { escapeHtml, openPanel, timeAgo } from './panel';

/**
 * Painel da torre do relógio: os limites do plano, como no /usage do Claude Code. Antes ficava fixo no canto da tela;
 * desde 02/11/2026 abre no clique da torre (decisão do usuário: a torre substitui o painel do canto).
 */
export function openUsage(usage: World['usage']) {
  const rows = usage?.rows ?? [];
  const panel = openPanel({
    title: 'Torre do relógio',
    subtitle: usage ? `Limites do Claude · atualizado ${timeAgo(usage.updatedAt)}` : 'Limites do Claude',
  });
  if (!rows.length) {
    panel.body.innerHTML =
      '<p class="usage-empty">O relógio começa a andar depois da primeira resposta do Claude numa sessão (com o status line instalado).</p>';
    return;
  }
  panel.body.innerHTML = `
    <p class="usage-empty">Ponteiro: a sessão de 5h (uma volta inteira é o limite). Céu: a semana, da manhã à noite. Sino
    amarelo a partir de 75%, vermelho a partir de 90%.</p>
    ${rows
      .map((r) => {
        const pct = Math.max(0, Math.min(100, Math.round(r.percent)));
        return `
        <div class="usage-row">
          <div class="usage-label"><span>${escapeHtml(r.label)}</span><b>${pct}%</b></div>
          <div class="usage-bar"><div class="usage-fill sev-${escapeHtml(r.severity)}" style="width:${pct}%"></div></div>
          <div class="usage-reset">${escapeHtml(voltaQuando(r.resetsAt))}</div>
        </div>`;
      })
      .join('')}`;
}
