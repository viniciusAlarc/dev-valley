import fs from 'node:fs/promises';
import path from 'node:path';
import type { Config } from './config.js';
import * as gitOps from './git.js';
import type { HookState, SessionStatus } from './hooks.js';
import type { StatusLineStore, Usage } from './statusline.js';
import { readPainel, type Painel } from './painel.js';
import { readPendencias, type Pendencia } from './pendencias.js';
import { summarizeProgress, type ProgressSummary } from './progress.js';
import { restartPending, type RestartPending } from './reinicio.js';
import type { AgentSummary, Agents } from './agents.js';
import type { Moradores } from './moradores.js';
import { listSessions, type SessionInfo } from './sessions.js';

export interface Project {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  branch: string | null;
  remote: string | null;
  changes: gitOps.FileChange[];
  /** Linhas abertas do `PENDENCIAS.md`; null = o projeto não tem o arquivo. */
  pendencias: Pendencia[] | null;
  /** `docs-dev/painel.json` (plano e fases); null = o projeto não tem o arquivo. */
  painel: Painel | null;
  /** Resumo do `PROGRESS.md`; null = o projeto não tem o arquivo. */
  progress: ProgressSummary | null;
}

export interface WorldSession extends SessionInfo {
  /** Nome do morador, único na vila (ver moradores.ts). */
  name: string;
  /** Id do projeto onde o NPC mora; null = mora na praça. */
  projectId: string | null;
  /** Terminal aberto pela própria vila. */
  inTown: boolean;
  /** Processo do Claude rodando (na vila ou fora dela, visto pelos hooks). */
  live: boolean;
  /** Estado informado pelos hooks; null = sem hooks para esta sessão. */
  status: SessionStatus | null;
  /** Janela de contexto usada. `estimated` = calculada do .jsonl, sem o status line. */
  context: { percent: number; tokens: number; window: number; estimated: boolean } | null;
}

export interface World {
  projects: Project[];
  sessions: WorldSession[];
  /** Agentes globais e dos projetos (Fábrica, PD-4). */
  agents: AgentSummary[];
  usage: Usage | null;
  /** Código do Dev Valley mudou depois que a vila subiu (sino da praça). */
  restart: RestartPending;
}

/** Janelas possíveis quando ainda não sabemos o tamanho real para o modelo. */
const DEFAULT_WINDOW = 200_000;
const LARGE_WINDOW = 1_000_000;

/**
 * Sem o status line, deduz a janela de cada modelo: se alguma sessão dele já passou de 200k
 * tokens, a janela só pode ser a grande.
 */
function guessWindows(sessions: SessionInfo[]): Map<string, number> {
  const guess = new Map<string, number>();
  for (const s of sessions) {
    if (!s.model || s.contextTokens === null) continue;
    if (s.contextTokens > DEFAULT_WINDOW) guess.set(s.model, LARGE_WINDOW);
    else if (!guess.has(s.model)) guess.set(s.model, DEFAULT_WINDOW);
  }
  return guess;
}

function contextOf(s: SessionInfo, statusLine: StatusLineStore, guessed: Map<string, number>): WorldSession['context'] {
  const exact = statusLine.context(s.id);
  // O status line é a fonte exata; o .jsonl só ganha se for mais novo (ex.: sessão continuou sem ele).
  if (exact && exact.updatedAt >= s.lastActivity - 5000) {
    return { percent: Math.round(exact.percent), tokens: exact.tokens, window: exact.window, estimated: false };
  }
  if (s.contextTokens === null) return null;
  const window = statusLine.windowFor(s.model) ?? (s.model ? guessed.get(s.model) : undefined) ?? DEFAULT_WINDOW;
  return { percent: Math.min(100, Math.round((s.contextTokens / window) * 100)), tokens: s.contextTokens, window, estimated: true };
}

async function discoverProjectDirs(config: Config): Promise<string[]> {
  const dirs = new Set<string>(config.extraProjects);
  for (const root of config.projectRoots) {
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || config.ignore.includes(e.name)) continue;
      dirs.add(path.join(root, e.name));
    }
  }
  return [...dirs].sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function loadProject(dir: string): Promise<Project> {
  const [isGit, pendencias, painel, progress] = await Promise.all([
    gitOps.isGitRepo(dir),
    readPendencias(dir),
    readPainel(dir),
    summarizeProgress(dir),
  ]);
  const base: Project = {
    id: dir,
    name: path.basename(dir),
    path: dir,
    isGit,
    branch: null,
    remote: null,
    changes: [],
    pendencias,
    painel,
    progress,
  };
  if (!isGit) return base;
  const [branch, remote, changes] = await Promise.all([
    gitOps.branch(dir),
    gitOps.remoteUrl(dir),
    gitOps.changes(dir).catch(() => []),
  ]);
  return { ...base, branch, remote, changes };
}

function ownerOf(session: SessionInfo, projects: Project[]): Project | null {
  // O projeto de caminho mais longo vence (subpastas aninhadas).
  let best: Project | null = null;
  for (const p of projects) {
    if (session.cwd === p.path || session.cwd.startsWith(p.path + '/')) {
      if (!best || p.path.length > best.path.length) best = p;
    }
  }
  return best;
}

export interface LiveSession {
  id: string;
  cwd: string;
  startedAt: number;
}

export async function buildWorld(
  config: Config,
  terminals: LiveSession[],
  hooks: HookState[],
  statusLine: StatusLineStore,
  moradores: Moradores,
  agents: Agents,
): Promise<World> {
  const dirs = await discoverProjectDirs(config);
  const projects = await Promise.all(dirs.map(loadProject));
  const all = await listSessions(config.sessionMaxAgeDays);
  const known = new Set(all.map((s) => s.id));
  const inTown = new Set(terminals.map((t) => t.id));
  const hookById = new Map(hooks.map((h) => [h.id, h]));

  // Sessões recém-abertas que ainda não gravaram o .jsonl.
  for (const s of [...terminals.map((t) => ({ id: t.id, cwd: t.cwd, at: t.startedAt })), ...hooks.map((h) => ({ id: h.id, cwd: h.cwd, at: h.updatedAt }))]) {
    if (known.has(s.id) || !s.cwd) continue;
    known.add(s.id);
    all.unshift({ id: s.id, cwd: s.cwd, title: 'Nova sessão', gitBranch: null, lastActivity: s.at, contextTokens: null, model: null, file: null });
  }

  const guessed = guessWindows(all);
  const sessions: WorldSession[] = all.map((s) => {
    const hook = hookById.get(s.id);
    return {
      ...s,
      name: '',
      lastActivity: Math.max(s.lastActivity, hook?.updatedAt ?? 0),
      projectId: ownerOf(s, projects)?.id ?? null,
      inTown: inTown.has(s.id),
      live: inTown.has(s.id) || !!hook,
      status: hook?.status ?? null,
      context: contextOf(s, statusLine, guessed),
    };
  });
  await moradores.sync(sessions, projects);
  return { projects, sessions, agents: await agents.list(projects), usage: statusLine.usage, restart: await restartPending() };
}
