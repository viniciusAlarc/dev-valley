import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  port: number;
  projectRoots: string[];
  extraProjects: string[];
  ignore: string[];
  sessionMaxAgeDays: number;
  /** Pastas extras de conhecimento que viram estantes na Biblioteca. */
  libraryRoots: string[];
}

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

export function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function readJson(file: string): Partial<Config> {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// dev-valley.config.local.json (gitignored) sobrescreve o config versionado.
export function loadConfig(): Config {
  const base = readJson(path.join(ROOT_DIR, 'dev-valley.config.json'));
  const local = readJson(path.join(ROOT_DIR, 'dev-valley.config.local.json'));
  const merged = { ...base, ...local } as Config;
  return {
    port: merged.port ?? 4777,
    projectRoots: (merged.projectRoots ?? []).map(expandHome),
    extraProjects: (merged.extraProjects ?? []).map(expandHome),
    ignore: merged.ignore ?? [],
    sessionMaxAgeDays: merged.sessionMaxAgeDays ?? 14,
    libraryRoots: (merged.libraryRoots ?? []).map(expandHome),
  };
}
