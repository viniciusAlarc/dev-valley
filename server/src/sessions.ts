import fs from 'node:fs/promises';
import path from 'node:path';
import { CLAUDE_PROJECTS_DIR } from './config.js';

export interface SessionInfo {
  id: string;
  cwd: string;
  title: string;
  gitBranch: string | null;
  lastActivity: number;
  /** Tokens de entrada da última resposta = quanto da janela de contexto está ocupado. */
  contextTokens: number | null;
  model: string | null;
  /** Caminho do `.jsonl` da conversa; null enquanto a sessão nova ainda não gravou nada. */
  file: string | null;
}

interface CacheEntry {
  mtimeMs: number;
  info: SessionInfo | null;
}

const cache = new Map<string, CacheEntry>();

function parseSession(id: string, raw: string, mtimeMs: number, file: string): SessionInfo | null {
  let cwd: string | null = null;
  let aiTitle: string | null = null;
  let lastPrompt: string | null = null;
  let firstPrompt: string | null = null;
  let gitBranch: string | null = null;
  let contextTokens: number | null = null;
  let model: string | null = null;

  for (const line of raw.split('\n')) {
    if (!line) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // linha sendo escrita no momento
    }
    if (entry.cwd && !cwd) cwd = entry.cwd;
    if (entry.gitBranch) gitBranch = entry.gitBranch;
    if (entry.type === 'ai-title' && entry.aiTitle) aiTitle = entry.aiTitle;
    if (entry.type === 'last-prompt' && entry.lastPrompt) lastPrompt = entry.lastPrompt;
    if (!firstPrompt && entry.type === 'user' && typeof entry.message?.content === 'string') {
      firstPrompt = entry.message.content;
    }
    // Subagentes têm contexto próprio; só a conversa principal conta.
    const usage = entry.type === 'assistant' && !entry.isSidechain ? entry.message?.usage : null;
    if (usage && entry.message.model !== '<synthetic>') {
      contextTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
      model = entry.message.model ?? model;
    }
  }
  if (!cwd) return null;
  const title = aiTitle ?? (lastPrompt ?? firstPrompt ?? 'Sessão sem título').slice(0, 80);
  return { id, cwd, title, gitBranch, lastActivity: mtimeMs, contextTokens, model, file };
}

/** Lê as sessões salvas pelo Claude Code em ~/.claude/projects/<projeto>/<id>.jsonl. */
export async function listSessions(maxAgeDays: number): Promise<SessionInfo[]> {
  const minMtime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const result: SessionInfo[] = [];
  let projectDirs: string[];
  try {
    projectDirs = await fs.readdir(CLAUDE_PROJECTS_DIR);
  } catch {
    return [];
  }
  for (const dir of projectDirs) {
    const full = path.join(CLAUDE_PROJECTS_DIR, dir);
    let files: string[];
    try {
      files = (await fs.readdir(full)).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const file of files) {
      const filePath = path.join(full, file);
      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        continue; // apagado entre o readdir e o stat (ex.: sessão encerrada na vila)
      }
      if (stat.mtimeMs < minMtime) continue;
      const cached = cache.get(filePath);
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        if (cached.info) result.push(cached.info);
        continue;
      }
      const info = parseSession(file.replace(/\.jsonl$/, ''), await fs.readFile(filePath, 'utf8'), stat.mtimeMs, filePath);
      cache.set(filePath, { mtimeMs: stat.mtimeMs, info });
      if (info) result.push(info);
    }
  }
  return result.sort((a, b) => b.lastActivity - a.lastActivity);
}

/**
 * Apaga a conversa de vez (decisão do usuário, 26/10/2026: encerrar na vila = a sessão deixa de existir):
 * o `<id>.jsonl` e, se houver, a pasta `<id>/` ao lado (subagentes e resultados de ferramentas), em qualquer
 * pasta de ~/.claude/projects. Procura pelo id em vez de usar o caminho do mundo porque a sessão nova pode
 * ter gravado o arquivo só ao fechar.
 */
export async function deleteSessionFiles(id: string): Promise<void> {
  // O id vira nome de pasta no `rm` recursivo: só UUID, nunca `..` ou vazio.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('id de sessão inválido');
  let projectDirs: string[];
  try {
    const entries = await fs.readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
    projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return;
  }
  for (const dir of projectDirs) {
    const file = path.join(CLAUDE_PROJECTS_DIR, dir, `${id}.jsonl`);
    await fs.rm(file, { force: true });
    await fs.rm(path.join(CLAUDE_PROJECTS_DIR, dir, id), { recursive: true, force: true });
    cache.delete(file);
  }
}
