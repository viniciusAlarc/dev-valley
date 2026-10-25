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
}

export interface Session {
  id: string;
  cwd: string;
  title: string;
  gitBranch: string | null;
  lastActivity: number;
  projectId: string | null;
  live: boolean;
}

export interface World {
  projects: Project[];
  sessions: Session[];
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

let world: World = { projects: [], sessions: [] };
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
