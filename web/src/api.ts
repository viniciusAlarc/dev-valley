export interface FileChange {
  path: string;
  status: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  branch: string | null;
  remote: string | null;
  changes: FileChange[];
  /** Linhas abertas do `PENDENCIAS.md`; null = o projeto não tem o arquivo. */
  pendencias: Pendencia[] | null;
  /** `docs-dev/painel.json` (plano e fases); null = o projeto não tem o arquivo. */
  painel: Painel | null;
  /** Documentos citados no `painel.json` (`doc` do plano e das fases) que o quadro negro abre. */
  quadro: PlanoAcao[];
  /** Resumo do `PROGRESS.md` (as entregas vêm por `api.progress`); null = o projeto não tem o arquivo. */
  progress: { entries: number; lastDate: string; toCheck: { date: string; title: string }[] } | null;
  /** Arquivos de acompanhamento que faltam (casa em obra); vazio = estrutura completa. */
  missingStructure: string[];
  /** Planos em `docs-dev/a-codar/` (caixa de sementes); null = o projeto não tem a pasta. */
  sementes: { path: string; title: string }[] | null;
  /** `docs-dev/context/` (estante): `html` abre isolado, `md` no leitor; null = o projeto não tem a pasta. */
  estante: { path: string; title: string; kind: 'html' | 'md' }[] | null;
  /** `RETRABALHO.md` (ervas do quintal): cabeçalho e linhas como estão no arquivo; null = sem o arquivo. */
  retrabalho: { header: string[]; rows: string[][] } | null;
  /** Vencimento da auditoria das regras, `AAAA-MM-DD` (placa de vistoria); null = sem o arquivo. */
  auditoria: string | null;
  /** Pombal (sincronização com a branch comum do time); null = projeto sem `pombal` no config local. */
  pombal: Pombal | null;
  /** Tabela "Subir" do `OPERACAO.md` com o estado das portas (lareira); null = sem lado com comando. */
  lareira: { lados: Lado[] } | null;
}

/** Pombal na fachada: cartas chegando (commits da branch comum) e a levar (commits da minha). */
export interface Pombal {
  integracao: string;
  minha: string;
  remoto: string;
  branchErrada: boolean;
  aReceber: number;
  aEnviar: number;
  buscadoEm: number | null;
  erro: string | null;
}

export interface Carta {
  hash: string;
  autor: string;
  data: string;
  assunto: string;
}

/** Resultado de uma viagem do pombo; `error` = não completou (o repositório ficou como estava). */
export interface Voo {
  passos: string[];
  error?: string;
  conflitos?: string[];
}

export interface ProgressEntry {
  date: string;
  title: string;
  /** Markdown da entrega, sem o título. */
  body: string;
}

export type PhaseState = 'feito' | 'andamento' | 'a fazer';

/** Subfase (`etapas` da fase ou de outra etapa), em quantos níveis o `painel.json` tiver. */
export interface Etapa {
  nome: string;
  estado: PhaseState;
  etapas: Etapa[];
}

export interface Painel {
  plano: { nome: string; doc: string | null; fases: { nome: string; estado: PhaseState; doc: string | null; etapas: Etapa[] }[] } | null;
  entregas: { data: string; o_que: string; como: string }[];
  /** O arquivo inteiro como está, campos fora do formato inclusive (quadro negro). */
  json: string;
}

/** Documento citado no `painel.json` (`doc` do plano ou de uma fase): `html` abre isolado no quadro, `md` no leitor. */
export interface PlanoAcao {
  fase: string;
  /** O `doc` como está no `painel.json`. */
  doc: string;
  path: string;
  kind: 'html' | 'md';
}

/** Um lado da tabela "Subir" (back, front…): `comando` null = a vila não liga; `problema` = não dá para ligar. */
export interface Lado {
  lado: string;
  pasta: string;
  cwd: string | null;
  comando: string | null;
  porta: number | null;
  ocupada: boolean;
  pid: number | null;
  problema: string | null;
  /** O que a vila ligou: `rodando` ou `saiu` (com o código); null = a vila não ligou este lado. */
  vila: { estado: 'rodando'; pid: number } | { estado: 'saiu'; codigo: number } | null;
}

export interface Pendencia {
  id: string;
  /** 1 (crítico) a 4 (baixo). */
  priority: number;
  owner: 'user' | 'code' | 'infra' | null;
  item: string;
  openedAt: string;
}

/** Pendências P1 (crítico) abertas: só elas acendem o sinal na fachada da casa (decisão de 25/10/2026). */
export function urgentPendencias(project: Project): Pendencia[] {
  return (project.pendencias ?? []).filter((p) => p.priority === 1);
}

/** Sino da praça: quantas entregas esperam conferência na vila, mais o reinício pendente do próprio Dev Valley. */
export function bellCount(world: World): number {
  const entries = world.projects.reduce((n, p) => n + (p.progress?.toCheck.length ?? 0), 0);
  return entries + (world.restart.server || world.restart.web ? 1 : 0);
}

export interface Session {
  id: string;
  /** Nome do morador, único na vila (dado pelo servidor, server/src/moradores.ts). */
  name: string;
  cwd: string;
  title: string;
  gitBranch: string | null;
  lastActivity: number;
  projectId: string | null;
  /** Terminal aberto pela própria vila. */
  inTown: boolean;
  /** Processo do Claude rodando (na vila ou fora, visto pelos hooks). */
  live: boolean;
  /** Estado vindo dos hooks; null quando não há hooks para a sessão. */
  status: SessionStatus | null;
  /** Janela de contexto usada; `estimated` quando calculada sem o status line. */
  context: { percent: number; tokens: number; window: number; estimated: boolean } | null;
  model: string | null;
}

/** A partir daqui vale começar uma sessão nova (o Claude compacta perto do fim da janela). */
export const CONTEXT_WARN = 70;
export const CONTEXT_CRITICAL = 85;

export function contextText(s: Session): string | null {
  if (!s.context) return null;
  const pct = `${s.context.estimated ? '~' : ''}${s.context.percent}%`;
  const filled = Math.round(Math.min(100, s.context.percent) / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  const hint = s.context.percent >= CONTEXT_CRITICAL ? ' — hora de uma sessão nova!' : s.context.percent >= CONTEXT_WARN ? ' — ficando cheio' : '';
  return `contexto ${bar} ${pct}${hint}`;
}

export interface UsageRow {
  kind: string;
  group: string;
  label: string;
  percent: number;
  resetsAt: string | null;
  severity: string;
}

export type SessionStatus = 'working' | 'permission' | 'idle';

/** Estado efetivo para desenhar: sem hooks, sessão viva conta como trabalhando. */
export function activityOf(s: Session): SessionStatus | 'offline' {
  if (s.status) return s.status;
  return s.live ? 'working' : 'offline';
}

export interface World {
  projects: Project[];
  sessions: Session[];
  /** Agentes globais e dos projetos (Fábrica, PD-4). */
  agents: AgentSummary[];
  /** Skills globais e dos projetos (Fábrica, parede de ferramentas). */
  skills: SkillSummary[];
  /** Limites do plano, vindos do status line; null até a primeira sessão reportar. */
  usage: { rows: UsageRow[]; updatedAt: number } | null;
  /** Código do Dev Valley mudou depois que a vila subiu: falta o reinício do usuário (sino da praça). */
  restart: { server: boolean; web: boolean };
  /** Outdoor dos guardrails; null = não configurado no config local. */
  guardrails: { enabled: boolean; plugin: string; core: string; items: { id: string; title: string }[] } | null;
}

/** Avulsas encerradas que continuam soltas na praça (elas não têm casa para onde ir). */
const PLAZA_OFFLINE_LIMIT = 4;

/**
 * Quem aparece no quintal: só sessões vivas (quem precisa de você, quem trabalha, depois os mais recentes).
 * Sessão encerrada fica dentro de casa até ser retomada ou passar de `sessionMaxAgeDays`.
 * Na praça (avulsas, `projectId` null) ficam todas as vivas mais as encerradas mais recentes.
 */
export function yardResidents(world: World, projectId: string | null): Session[] {
  const rank = { permission: 0, working: 1, idle: 2, offline: 3 };
  const sorted = world.sessions
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => rank[activityOf(a)] - rank[activityOf(b)] || b.lastActivity - a.lastActivity);
  if (projectId !== null) return sorted.filter((s) => s.live);
  const live = sorted.filter((s) => s.live).length;
  return sorted.slice(0, Math.max(PLAZA_OFFLINE_LIMIT, live));
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export interface AgentSummary {
  path: string;
  name: string;
  description: string;
  /** null = global; senão o projeto onde o agente mora. */
  projectId: string | null;
  /** Gerado pelo Dev Valley (ex.: a bibliotecária): só leitura. */
  managed: boolean;
  /** Agente da vila (`server/agents/` no repo): só leitura, sem NPC no pátio e sem conversa por `--agent`. */
  village: boolean;
}

export interface AgentFile extends AgentSummary {
  /** null = herda todas as ferramentas da sessão. */
  tools: string[] | null;
  /** null = o mesmo modelo da sessão. */
  model: string | null;
  instructions: string;
  mtime: number;
}

export interface AgentInput {
  description: string;
  tools: string[] | null;
  model: string | null;
  instructions: string;
}

export const agents = {
  read: (path: string) => request<AgentFile>('GET', `/api/agents/file?path=${encodeURIComponent(path)}`),
  create: (projectId: string | null, name: string, input: AgentInput) => request<{ path: string }>('POST', '/api/agents', { projectId, name, ...input }),
  save: (path: string, mtime: number, input: AgentInput) => request<{ mtime: number }>('PUT', '/api/agents', { path, mtime, ...input }),
  remove: (path: string) => request('DELETE', `/api/agents?path=${encodeURIComponent(path)}`),
  /** Conversa nova com o agente (o servidor escolhe a pasta: o projeto dele, ou a praça se for global). */
  talk: (path: string) => request<{ sessionId: string; projectId: string | null; name: string }>('POST', '/api/agents/session', { path }),
};

export interface SkillSummary {
  /** Caminho do `SKILL.md`. */
  path: string;
  name: string;
  description: string;
  /** null = global; senão o projeto onde a skill mora. */
  projectId: string | null;
  /** Destino do link quando a skill foi instalada por link (só leitura: edita-se na fonte). */
  linkedTo: string | null;
}

export interface SkillFile extends SkillSummary {
  instructions: string;
  /** Arquivos da pasta (a confirmação de apagar mostra o que vai junto). */
  files: string[];
  mtime: number;
}

export interface SkillInput {
  description: string;
  instructions: string;
}

export const skills = {
  read: (path: string) => request<SkillFile>('GET', `/api/skills/file?path=${encodeURIComponent(path)}`),
  create: (projectId: string | null, name: string, input: SkillInput) => request<{ path: string }>('POST', '/api/skills', { projectId, name, ...input }),
  save: (path: string, mtime: number, input: SkillInput) => request<{ mtime: number }>('PUT', '/api/skills', { path, mtime, ...input }),
  remove: (path: string) => request('DELETE', `/api/skills?path=${encodeURIComponent(path)}`),
};

export type SectionKind = 'global' | 'memory' | 'project' | 'root';

export interface LibraryFile {
  path: string;
  rel: string;
  size: number;
  mtime: number;
}

export interface LibrarySection {
  id: string;
  title: string;
  kind: SectionKind;
  base: string;
  projectId?: string;
  files: LibraryFile[];
  missingClaudeMd?: boolean;
}

export interface SearchHit {
  path: string;
  section: string;
  rel: string;
  line: number;
  text: string;
}

export const library = {
  sections: () => request<LibrarySection[]>('GET', '/api/library'),
  read: (path: string) => request<{ path: string; content: string; mtime: number }>('GET', `/api/library/file?path=${encodeURIComponent(path)}`),
  write: (path: string, content: string, mtime: number) => request<{ mtime: number }>('PUT', '/api/library/file', { path, content, mtime }),
  createClaudeMd: (project: string) => request<{ path: string }>('POST', '/api/library/claude-md', { project }),
  search: (q: string) => request<SearchHit[]>('GET', `/api/library/search?q=${encodeURIComponent(q)}`),
  openVsCode: (path: string) => request('POST', '/api/library/open-vscode', { path }),
};

export const api = {
  diff: (project: string, file: string) =>
    request<{ original: string; modified: string }>(
      'GET',
      `/api/diff?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`,
    ),
  commit: (project: string, message: string, files: string[]) =>
    request<{ output: string }>('POST', '/api/commit', { project, message, files }),
  openVsCode: (project: string, file?: string) => request('POST', '/api/open-vscode', { project, file }),
  /** Sem `project`: sessão avulsa (nasce na home e mora na praça). */
  newSession: (project?: string) => request<{ sessionId: string; cwd: string }>('POST', '/api/sessions', { project }),
  /** Encerra e apaga a conversa de vez. */
  deleteSession: (id: string) => request('DELETE', `/api/sessions/${id}`),
  progress: (project: string) => request<ProgressEntry[]>('GET', `/api/progress?project=${encodeURIComponent(project)}`),
  /** Busca o remoto e lista as cartas dos dois sentidos. */
  cartas: (project: string) => request<{ receber: Carta[]; enviar: Carta[] }>('GET', `/api/pombal?project=${encodeURIComponent(project)}`),
  /** Não lança no 409: o painel mostra o erro junto com os conflitos e os passos que deram certo. */
  voar: async (project: string, acao: 'receber' | 'enviar'): Promise<Voo> => {
    const res = await fetch('/api/pombal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project, acao }) });
    const data = await res.json();
    if (!res.ok && res.status !== 409) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data as Voo;
  },
};

export function wsUrl(path: string): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
}

// ---- Estado do mundo (atualizado pelo servidor via WebSocket) ----

let world: World = { projects: [], sessions: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null };
const listeners = new Set<(w: World) => void>();

export function getWorld(): World {
  return world;
}

export function onWorld(fn: (w: World) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setWorld(w: World) {
  world = w;
  for (const fn of listeners) fn(world);
}

export function connectWorld() {
  void request<World>('GET', '/api/world').then(setWorld, () => {});
  const ws = new WebSocket(wsUrl('/ws/events'));
  ws.onmessage = (ev) => setWorld(JSON.parse(ev.data));
  ws.onclose = () => setTimeout(connectWorld, 2000);
}
