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

export interface Session {
  id: string;
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
  /** Limites do plano, vindos do status line; null até a primeira sessão reportar. */
  usage: { rows: UsageRow[]; updatedAt: number } | null;
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
  newSession: (project: string) => request<{ sessionId: string; cwd: string }>('POST', '/api/sessions', { project }),
  killSession: (id: string) => request('DELETE', `/api/sessions/${id}`),
};

export function wsUrl(path: string): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
}

// ---- Estado do mundo (atualizado pelo servidor via WebSocket) ----

let world: World = { projects: [], sessions: [], usage: null };
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
