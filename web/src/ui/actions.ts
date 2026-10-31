import { agents, api, getWorld, type AgentSummary, type Project, type Session, type World } from '../api';
import { villagerName } from '../game/names';
import { openConferir } from './conferir';
import { openGuardrails } from './guardrails';
import { openLibrary } from './library';
import { openAdministrador, openLibrarian } from './librarian';
import { escapeHtml, isPanelOpen, openPanel } from './panel';
import { openDiary } from './diario';
import { openFactory } from './factory';
import { openObra } from './obra';
import { openPainel } from './painel';
import { openPendencias, openUserPendencias } from './pendencias';
import { openProject } from './project';
import { openRetrabalho } from './retrabalho';
import { openSementes } from './sementes';
import { openQuadro } from './quadro';
import { openPombal } from './pombal';
import { openLareira } from './lareira';
import { openSkills } from './skills';
import { openSessionTerminal, openTerminal } from './terminal';

const tooltip = () => document.getElementById('tooltip')!;

document.addEventListener('mousemove', (e) => {
  const el = tooltip();
  if (el.hidden) return;
  el.style.left = `${e.clientX + 14}px`;
  el.style.top = `${e.clientY + 14}px`;
});

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
  openGuardrails(g: NonNullable<World['guardrails']>) {
    this.hideTooltip();
    openGuardrails(g);
  },
  openConferir(world: World) {
    this.hideTooltip();
    openConferir(world);
  },
  openDiary(project: Project) {
    this.hideTooltip();
    void openDiary(project);
  },
  openObra(project: Project) {
    this.hideTooltip();
    openObra(project);
  },
  openRetrabalho(project: Project) {
    this.hideTooltip();
    openRetrabalho(project);
  },
  openSementes(project: Project) {
    this.hideTooltip();
    openSementes(project);
  },
  openLareira(project: Project) {
    this.hideTooltip();
    openLareira(project);
  },
  openEstante(project: Project) {
    this.hideTooltip();
    void openLibrary({ project: { id: project.id, name: project.name } });
  },
  openQuadro(project: Project) {
    this.hideTooltip();
    openQuadro(project);
  },
  openPainel(project: Project) {
    this.hideTooltip();
    openPainel(project);
  },
  openPombal(project: Project) {
    this.hideTooltip();
    openPombal(project);
  },
  openLibrary(opts: { sectionId?: string; search?: boolean; path?: string } = {}) {
    this.hideTooltip();
    void openLibrary(opts);
  },
  openAdministrador() {
    this.hideTooltip();
    openAdministrador();
  },
  openLibrarian() {
    this.hideTooltip();
    openLibrarian();
  },
  /** Clique num NPC ✦ da Fábrica: conversa nova com o agente (decisão do usuário, 26/10/2026). */
  async talkToAgent(agent: AgentSummary) {
    this.hideTooltip();
    const { sessionId, projectId, name } = await agents.talk(agent.path);
    const project = getWorld().projects.find((p) => p.id === agent.projectId);
    const where = project ? `Agente do projeto ${project.name}` : 'Agente global';
    const description = agent.description.length > 140 ? `${agent.description.slice(0, 139)}…` : agent.description;
    openTerminal({ sessionId, projectId, title: `✦ ${name}`, agent: { subtitle: description ? `${where}: ${description}` : where } });
  },
  /** Banco da praça: sessão nova avulsa, na home (decisão do usuário, 27/10/2026). */
  async newAvulsa() {
    this.hideTooltip();
    const { sessionId } = await api.newSession();
    openTerminal({ sessionId, projectId: null, title: 'Nova sessão avulsa' });
  },
  /** `path`: abre já na edição desse agente. */
  openSkills(path?: string) {
    this.hideTooltip();
    void openSkills(path);
  },
  openFactory(path?: string) {
    this.hideTooltip();
    void openFactory(path);
  },
};
