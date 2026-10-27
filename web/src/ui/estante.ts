import type { Project } from '../api';
import { ui } from './actions';
import { button, escapeHtml, openPanel } from './panel';

const livroUrl = (project: Project, i: number) => `/api/estante?project=${encodeURIComponent(project.id)}&i=${i}`;

/**
 * Estante da casa: o que já foi construído, `docs-dev/context/` (G7). Só leitura. Markdown abre no leitor da
 * biblioteca; HTML abre aqui, no mesmo iframe isolado do quadro negro (o script do documento não alcança a vila).
 */
export function openEstante(project: Project) {
  const list = project.estante ?? [];
  const panel = openPanel({ title: `Estante — ${project.name}`, subtitle: `${list.length} documento(s) do que já foi construído · docs-dev/context/`, size: 'lg', scroll: true });
  if (!list.length) {
    panel.body.innerHTML = '<p class="empty">Nenhum documento em <code>docs-dev/context/</code>. A estante está vazia.</p>';
    return;
  }
  panel.body.innerHTML = `<ul class="session-list pend-list">${list
    .map(
      (l, i) => `<li>
        <span class="pend-item">${escapeHtml(l.title)}</span>
        <code class="book-link" data-i="${i}" title="${l.kind === 'html' ? 'Abrir aqui' : 'Abrir na biblioteca'}">${escapeHtml(l.path.split('/').pop() ?? '')}</code>
      </li>`,
    )
    .join('')}</ul>`;
  for (const el of panel.body.querySelectorAll<HTMLElement>('[data-i]'))
    el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      if (list[i].kind === 'md') ui.openLibrary({ path: list[i].path });
      else openLivroHtml(project, i);
    });
}

function openLivroHtml(project: Project, i: number) {
  const livro = project.estante![i];
  const panel = openPanel({ title: livro.title, subtitle: `docs-dev/context/${livro.path.split('/').pop()}`, size: 'lg' });
  panel.actions.append(
    button('← Estante', () => openEstante(project)),
    button('Abrir em aba nova', () => window.open(livroUrl(project, i), '_blank', 'noopener')),
  );
  panel.body.innerHTML = '<div class="quadro-single"><iframe class="quadro-frame" sandbox="allow-scripts"></iframe></div>';
  const frame = panel.body.querySelector<HTMLIFrameElement>('.quadro-frame')!;
  frame.title = livro.title;
  frame.src = livroUrl(project, i);
}
