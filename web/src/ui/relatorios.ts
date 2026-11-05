import { api, type Project } from '../api';
import { ui } from './actions';
import { escapeHtml, openPanel } from './panel';

/**
 * Estante de partitura do porão, sem pedido esperando (04/11/2026, no lugar do quadro): os relatórios das rodadas do
 * maestro (`docs-dev/maestro/`), o mais novo primeiro. O que ainda não foi aberto leva o selo "novo"; abrir tira o selo.
 */
export function openRelatorios(project: Project) {
  const list = project.relatorios ?? [];
  const novos = list.filter((r) => !r.lido).length;
  const panel = openPanel({
    title: `Relatórios do maestro — ${project.name}`,
    subtitle: `${list.length} rodada(s)${novos ? ` · ${novos} nova(s)` : ''} · docs-dev/maestro/`,
    size: 'lg',
    scroll: true,
  });
  if (!list.length) {
    panel.body.innerHTML = '<p class="empty">Nenhuma rodada fechada ainda. O maestro escreve o relatório ao fechar cada uma.</p>';
    return;
  }
  panel.body.innerHTML = `<ul class="session-list pend-list">${list
    .map(
      (r, i) => `<li>
        <span class="pend-item">${r.lido ? '' : '<span class="ctx-pill warning">novo</span> '}${escapeHtml(r.title)}</span>
        <code class="book-link" data-i="${i}" title="Abrir na biblioteca">${escapeHtml(r.data ?? r.path.split('/').pop() ?? '')}</code>
      </li>`,
    )
    .join('')}</ul>`;
  for (const el of panel.body.querySelectorAll<HTMLElement>('[data-i]'))
    el.addEventListener('click', () => {
      const r = list[Number(el.dataset.i)]!;
      // Marca antes de abrir; se falhar, o relatório abre do mesmo jeito e continua "novo".
      if (!r.lido) api.relatorioLido(project.id, r.path).catch(() => {});
      ui.openLibrary({ path: r.path });
    });
}
