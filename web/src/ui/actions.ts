import type { Project, Session } from '../api';
import { villagerName } from '../game/names';
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
  /** Onde o jogador está: null = na vila, ou o nome da casa. */
  setLocation(houseName: string | null) {
    const title = document.querySelector('.hud-title');
    const help = document.querySelector('.hud-help');
    if (title) title.textContent = houseName ? `Dev Valley › ${houseName}` : 'Dev Valley';
    if (help)
      help.textContent = houseName
        ? 'Clique num morador para abrir o chat · escrivaninha = painel do projeto · Esc ou tapete para sair'
        : 'Arraste ou WASD para andar · roda do mouse para zoom · clique em pessoas, casas e caixas';
  },
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
    // Retomar uma sessão que já roda em outro terminal criaria dois processos na mesma conversa.
    if (session.live && !session.inTown) {
      const panel = openPanel({ title: `${villagerName(session.id)} está ocupado(a)` });
      panel.body.innerHTML = `
        <p>A sessão <b>${escapeHtml(session.title)}</b> está aberta em outro terminal (VS Code, por exemplo).</p>
        <p class="muted">Continue por lá — ou encerre a sessão lá e clique de novo aqui para retomá-la na vila.</p>`;
      return;
    }
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
