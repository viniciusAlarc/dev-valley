import { activityOf, api, getWorld, type Project } from '../api';
import { villagerName } from '../game/names';
import { ui } from './actions';
import { openCommit } from './commit';
import { button, escapeHtml, openPanel, timeAgo } from './panel';
import { openTerminal } from './terminal';

export function openProject(project: Project) {
  const panel = openPanel({ title: project.name, subtitle: project.path });
  const sessions = getWorld().sessions.filter((s) => s.projectId === project.id);

  panel.body.innerHTML = `
    <dl class="facts">
      <dt>Branch</dt><dd>${escapeHtml(project.branch ?? '—')}</dd>
      <dt>Remoto</dt><dd>${project.remote ? escapeHtml(project.remote) : '—'}</dd>
      <dt>Mudanças</dt><dd>${project.isGit ? project.changes.length : 'sem git'}</dd>
    </dl>
    <h3>Moradores (sessões)</h3>
    <ul class="session-list"></ul>
    <div class="button-row"></div>`;

  const list = panel.body.querySelector('.session-list')!;
  if (!sessions.length) list.innerHTML = '<li class="empty">Ninguém mora aqui ainda.</li>';
  const STATUS_TEXT = { permission: '❗ precisa de você', working: 'trabalhando', idle: 'esperando você' };
  for (const s of [...sessions].sort((a, b) => b.lastActivity - a.lastActivity)) {
    const activity = activityOf(s);
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="dot ${activity}"></span>
      <b>${escapeHtml(villagerName(s.id))}</b>
      <span class="session-title">${escapeHtml(s.title)}</span>
      <span class="muted">${activity === 'offline' ? timeAgo(s.lastActivity) : STATUS_TEXT[activity]}</span>`;
    li.addEventListener('click', () => ui.openSession(s));
    list.append(li);
  }

  panel.body.querySelector('.button-row')!.append(
    button('Nova sessão', async () => {
      const { sessionId } = await api.newSession(project.id);
      openTerminal({ sessionId, projectId: project.id, title: 'Nova sessão' });
    }, 'primary'),
    button('Abrir no VS Code', () => api.openVsCode(project.id)),
    button('📚 Documentação', () => ui.openLibrary({ sectionId: `project:${project.id}` })),
    ...(project.isGit ? [button(`Caixa de envio (${project.changes.length})`, () => openCommit(project))] : []),
  );
}
