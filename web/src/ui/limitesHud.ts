import { api, onWorld, type Vitais, type World } from '../api';
import { linhasDaMaquina, linhasDosLimites, type Linha } from './limites-texto';
import { escapeHtml, timeAgo } from './panel';

/**
 * Canto inferior esquerdo: limites do Claude (5h e semana) e a máquina (WSL). Voltou para o canto em 09/11/2026 (decisão
 * do usuário: dentro da clínica ficava difícil de achar). O monitor de sinais vitais da clínica saiu em 10/11/2026: o canto é o único lugar.
 * Minimizado, vira uma linha de chips; a escolha fica no navegador.
 */
const COLLAPSED_KEY = 'dv-usage-collapsed';
const VITAIS_MS = 30_000;

const barra = (l: Linha) => `
  <div class="usage-row">
    <div class="usage-label"><span>${escapeHtml(l.rotulo)}</span><b>${Math.round(l.percent)}%</b></div>
    <div class="usage-bar"><div class="usage-fill sev-${l.sev}" style="width:${Math.max(0, Math.min(100, l.percent))}%"></div></div>
    ${l.detalhe ? `<div class="usage-reset">${escapeHtml(l.detalhe)}</div>` : ''}
  </div>`;

const chip = (l: Linha) => `<span class="usage-chip sev-${l.sev}">${escapeHtml(l.curto)} ${Math.round(l.percent)}%</span>`;

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function mountLimitesHud() {
  const el = document.createElement('div');
  el.className = 'hud-usage';
  document.getElementById('hud')!.append(el);
  let usage: World['usage'] = null;
  let vitais: Vitais | null = null;
  let collapsed = readCollapsed();

  const render = () => {
    el.classList.toggle('collapsed', collapsed);
    const claude = linhasDosLimites(usage);
    const maquina = linhasDaMaquina(vitais);
    const header = `
      <button class="usage-title" title="${collapsed ? 'Expandir' : 'Minimizar'}">
        <span>Limites e máquina</span>
        ${collapsed ? `<span class="usage-chips">${[...claude, ...maquina.filter((l) => l.curto === 'Mem')].map(chip).join('')}</span>` : ''}
        <span class="usage-toggle">${collapsed ? '▴' : '▾'}</span>
      </button>`;
    if (collapsed) {
      el.innerHTML = header;
      return;
    }
    el.innerHTML = `
      ${header}
      <div class="usage-section">Claude${usage ? ` <span>· atualizado ${escapeHtml(timeAgo(usage.updatedAt))}</span>` : ''}</div>
      ${claude.length ? claude.map(barra).join('') : '<p class="usage-empty">Aparece após a primeira resposta do Claude numa sessão (com o status line instalado).</p>'}
      <div class="usage-section">Máquina (WSL)</div>
      ${maquina.length ? maquina.map(barra).join('') : '<p class="usage-empty">Medindo…</p>'}`;
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

  const medir = async () => {
    try {
      vitais = await api.vitais();
    } catch {
      // servidor sem a rota (antes do reinício) ou fora do ar: mantém a última leitura
    }
    render();
  };

  onWorld((w) => {
    usage = w.usage;
    render();
  });
  void medir();
  setInterval(medir, VITAIS_MS);
  render();
}
