import fs from 'node:fs/promises';
import path from 'node:path';
import type { Config } from './config.js';
import * as gitOps from './git.js';
import { listSessions, type SessionInfo } from './sessions.js';

export interface Project {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  branch: string | null;
  remote: string | null;
  changes: gitOps.FileChange[];
}

export interface WorldSession extends SessionInfo {
  /** Id do projeto onde o NPC mora; null = mora na praça. */
  projectId: string | null;
  live: boolean;
}

export interface World {
  projects: Project[];
  sessions: WorldSession[];
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
  const isGit = await gitOps.isGitRepo(dir);
  const base: Project = {
    id: dir,
    name: path.basename(dir),
    path: dir,
    isGit,
    branch: null,
    remote: null,
    changes: [],
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

export async function buildWorld(config: Config, live: LiveSession[]): Promise<World> {
  const dirs = await discoverProjectDirs(config);
  const projects = await Promise.all(dirs.map(loadProject));
  const all = await listSessions(config.sessionMaxAgeDays);
  const liveIds = new Set(live.map((l) => l.id));

  // Sessões abertas pela cidade que ainda não gravaram o .jsonl.
  for (const l of live) {
    if (!all.some((s) => s.id === l.id)) {
      all.unshift({ id: l.id, cwd: l.cwd, title: 'Nova sessão', gitBranch: null, lastActivity: l.startedAt });
    }
  }

  const perOwner = new Map<string, number>();
  const sessions: WorldSession[] = [];
  for (const s of all) {
    const owner = ownerOf(s, projects);
    const key = owner?.id ?? '__praca__';
    const isLive = liveIds.has(s.id);
    const count = perOwner.get(key) ?? 0;
    // Sessões vivas sempre aparecem; as demais respeitam o limite por casa.
    if (!isLive && count >= config.sessionsPerProject) continue;
    perOwner.set(key, count + 1);
    sessions.push({ ...s, projectId: owner?.id ?? null, live: isLive });
  }
  return { projects, sessions };
}
