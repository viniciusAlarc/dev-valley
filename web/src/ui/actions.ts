import type { Project, Session } from '../api';
import { villagerName } from '../game/names';
import { openCommit } from './commit';
import { openLibrary } from './library';
import { openLibrarian } from './librarian';
import { escapeHtml, isPanelOpen, openPanel } from './panel';
import { openDiary } from './diario';
import { openPainel } from './painel';
import { openPendencias, openUserPendencias } from './pendencias';
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
  setLocation(placeName: string | null, helpText?: string) {
    const title = document.querySelector('.hud-title');
    const help = document.querySelector('.hud-help');
    if (title) title.textContent = placeName ? `Dev Valley › ${placeName}` : 'Dev Valley';
    if (help)
      help.textContent =
        helpText ??
        (placeName
          ? 'Clique num morador para abrir o chat · escrivaninha = painel do projeto · quadro = pendências · atril = diário · Esc ou tapete para sair'
          : 'Arraste ou WASD para andar · roda do mouse para zoom · clique em pessoas, casas e caixas');
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
  openPendencias(project: Project) {
    this.hideTooltip();
    openPendencias(project);
  },
  openUserPendencias(projects: Project[]) {
    this.hideTooltip();
    openUserPendencias(projects);
  },
  openDiary(project: Project) {
    this.hideTooltip();
    void openDiary(project);
  },
  openPainel(project: Project) {
    this.hideTooltip();
    openPainel(project);
  },
  openCommit(project: Project) {
    this.hideTooltip();
    openCommit(project);
  },
  openLibrary(opts: { sectionId?: string; search?: boolean; path?: string } = {}) {
    this.hideTooltip();
    void openLibrary(opts);
  },
  openLibrarian() {
    this.hideTooltip();
    openLibrarian();
  },
  openFactory() {
    this.hideTooltip();
    comingSoon('Fábrica de Agentes', 'Aqui você vai criar e editar os agentes do Claude Code (.claude/agents).');
  },
};
