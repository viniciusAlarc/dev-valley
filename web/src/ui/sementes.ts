import type { Project } from '../api';
import { ui } from './actions';
import { escapeHtml, openPanel } from './panel';

/**
 * Caixa de sementes da casa: os planos em `docs-dev/a-codar/` (decididos e ainda não codados, G7). Só leitura;
 * clicar num plano abre o arquivo no leitor da biblioteca.
 */
export function openSementes(project: Project) {
  const list = project.sementes ?? [];
  const panel = openPanel({ title: `Sementes — ${project.name}`, subtitle: `${list.length} plano(s) decidido(s) e não codado(s) · docs-dev/a-codar/`, size: 'lg' });
  if (!list.length) {
    panel.body.innerHTML = '<p class="empty">Nenhum plano esperando código. A caixa está vazia.</p>';
    return;
  }
  panel.body.innerHTML = `<ul class="session-list pend-list">${list
    .map(
      (s, i) => `<li>
        <span class="pend-item">${escapeHtml(s.title)}</span>
        <code class="book-link" data-i="${i}" title="Abrir na biblioteca">${escapeHtml(s.path.split('/').pop() ?? '')}</code>
      </li>`,
    )
    .join('')}</ul>`;
  for (const el of panel.body.querySelectorAll<HTMLElement>('[data-i]'))
    el.addEventListener('click', () => ui.openLibrary({ path: list[Number(el.dataset.i)].path }));
}
