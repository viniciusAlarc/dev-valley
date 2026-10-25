import type { Project, Session } from '../api';
import { openCommit } from './commit';
import { escapeHtml, isPanelOpen, openPanel } from './panel';
import { openProject } from './project';
import { openSessionTerminal } from './terminal';

const tooltip = () => document.getElementById('tooltip')!;

document.addEventListener('mousemove', (e) => {
  const el = tooltip();
  if (el.hidden) return;
  el.style.left = `${e.clientX + 14}px`;
  el.style.top = `${e.clientY + 14}px`;
});

function comingSoon(title: string, text: string) {
  const panel = openPanel({ title });
  panel.body.innerHTML = `<p>${escapeHtml(text)}</p><p class="muted">Em construção — próxima fase do Dev Valley.</p>`;
}

/** Tudo o que a cidade pode pedir para a interface fazer. */
export const ui = {
  isPanelOpen,
  showTooltip(text: string) {
    const el = tooltip();
    el.textContent = text;
    el.hidden = false;
  },
  hideTooltip() {
    tooltip().hidden = true;
  },
  openSession(session: Session) {
    this.hideTooltip();
    openSessionTerminal(session);
  },
  openProject(project: Project) {
    this.hideTooltip();
    openProject(project);
  },
  openCommit(project: Project) {
    this.hideTooltip();
    openCommit(project);
  },
  openLibrary() {
    this.hideTooltip();
    comingSoon('Biblioteca', 'Aqui vão morar seus CLAUDE.md, memórias e documentos de referência.');
  },
  openFactory() {
    this.hideTooltip();
    comingSoon('Fábrica de Agentes', 'Aqui você vai criar e editar os agentes do Claude Code (.claude/agents).');
  },
};
