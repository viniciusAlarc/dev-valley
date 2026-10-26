import type { World } from '../api';
import { escapeHtml, openPanel } from './panel';

/**
 * Sino da praça: entregas do `PROGRESS.md` de todos os projetos que ainda dizem "Falta conferir na vila", e o reinício
 * pendente do próprio Dev Valley. Só leitura: a entrega sai daqui quando a sessão troca o texto (decisão de 26/10/2026).
 */
export function openConferir(world: World) {
  const groups = world.projects
    .map((project) => ({ project, list: project.progress?.toCheck ?? [] }))
    .filter((g) => g.list.length)
    .sort((a, b) => a.project.name.localeCompare(b.project.name));
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  const panel = openPanel({ title: 'Sino de conferência', subtitle: `${total} entrega(s) esperando você conferir · PROGRESS.md`, size: 'lg', scroll: true });

  const restart = [
    world.restart.server && 'O servidor do Dev Valley mudou depois que a vila subiu.',
    world.restart.web && 'O front do Dev Valley mudou depois do último build.',
  ].filter(Boolean) as string[];
  const restartHtml = restart.length
    ? `<h3>Reinício pendente</h3>
       <p>${restart.map(escapeHtml).join(' ')} Rode <code>npm start</code> de novo quando as sessões da vila terminarem:
       o reinício encerra todos os terminais.</p>`
    : '';

  if (!total && !restartHtml) {
    panel.body.innerHTML = '<p class="empty">Nada esperando conferência na vila.</p>';
    return;
  }
  panel.body.innerHTML =
    restartHtml +
    groups
      .map(
        ({ project, list }) => `<h3>${escapeHtml(project.name)}</h3>
          <ul class="session-list pend-list">${list
            .map((e) => `<li><span class="muted">${escapeHtml(e.date)}</span> <span class="pend-item">${escapeHtml(e.title)}</span></li>`)
            .join('')}</ul>`,
      )
      .join('');
}
