import type { PlanoAcao, Project } from '../api';
import { ui } from './actions';
import { button, escapeHtml, openPanel } from './panel';

const planoUrl = (project: Project, i: number) => `/api/quadro?project=${encodeURIComponent(project.id)}&i=${i}`;

/**
 * Quadro negro da casa: o plano de ação de cada fase em andamento do `painel.json` (`doc` da fase). HTML abre aqui,
 * num iframe isolado (`sandbox` sem `allow-same-origin`: o script do plano não alcança a vila); Markdown abre no
 * leitor da biblioteca. Mais de um plano em andamento: a lista na lateral escolhe qual mostrar.
 */
export function openQuadro(project: Project) {
  const list = project.quadro;
  if (list.length === 1 && list[0].kind === 'md') return ui.openLibrary({ path: list[0].path });

  const panel = openPanel({
    title: `Quadro negro — ${project.name}`,
    subtitle: list.length ? `${list.length} plano(s) de ação em andamento · docs-dev/painel.json` : 'docs-dev/painel.json',
    size: 'lg',
    scroll: !list.length,
  });
  if (!list.length) {
    panel.body.innerHTML =
      '<p class="empty">Nenhum plano de ação em andamento. O quadro mostra o <code>doc</code> de cada fase em andamento do <code>docs-dev/painel.json</code>.</p>';
    return;
  }

  const nav = list
    .map((p, i) => `<button class="book" data-i="${i}" title="${escapeHtml(rel(project, p))}">${escapeHtml(p.fase)}${p.kind === 'md' ? ' <span class="muted">(md)</span>' : ''}</button>`)
    .join('');
  panel.body.innerHTML = `
    <div class="${list.length > 1 ? 'library-layout' : 'quadro-single'}">
      ${list.length > 1 ? `<aside class="library-nav"><div class="library-tree">${nav}</div></aside>` : ''}
      <section class="library-reader">
        <header class="reader-header">
          <div class="reader-title"></div>
          <div class="reader-actions"></div>
        </header>
        <iframe class="quadro-frame" sandbox="allow-scripts" title="Plano de ação"></iframe>
      </section>
    </div>`;
  const title = panel.body.querySelector<HTMLElement>('.reader-title')!;
  const frame = panel.body.querySelector<HTMLIFrameElement>('.quadro-frame')!;
  const books = [...panel.body.querySelectorAll<HTMLButtonElement>('.book')];
  let current = 0;
  panel.body.querySelector('.reader-actions')!.append(button('Abrir em aba nova', () => window.open(planoUrl(project, current), '_blank', 'noopener')));
  for (const b of books) b.addEventListener('click', () => show(Number(b.dataset.i)));

  function show(i: number) {
    const p = list[i];
    if (p.kind === 'md') return ui.openLibrary({ path: p.path });
    current = i;
    title.innerHTML = `<b>${escapeHtml(p.fase)}</b> <span class="muted">${escapeHtml(rel(project, p))}</span>`;
    frame.src = planoUrl(project, i);
    for (const b of books) b.classList.toggle('active', Number(b.dataset.i) === i);
  }
  show(Math.max(0, list.findIndex((p) => p.kind === 'html')));
}

function rel(project: Project, p: PlanoAcao) {
  return p.path.slice(project.path.length + 1);
}
