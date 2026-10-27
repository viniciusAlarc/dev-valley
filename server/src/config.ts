import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PombalConfig } from './pombal.js';

export interface Config {
  port: number;
  projectRoots: string[];
  extraProjects: string[];
  ignore: string[];
  sessionMaxAgeDays: number;
  /** Pastas extras de conhecimento que viram estantes na Biblioteca. */
  libraryRoots: string[];
  /**
   * Outdoor dos guardrails na vila: o plugin que os aplica (chave de `enabledPlugins` no settings.json) e o arquivo
   * com a lista (`## G<n> — título`). Fica no config local (caminho pessoal); sem ele, não há outdoor.
   */
  guardrails: { plugin: string; core: string } | null;
  /**
   * Pombal na fachada: nome da pasta do projeto → branches que ele sincroniza. Fica no config local (nome de branch
   * de projeto privado); casa fora daqui não tem pombal.
   */
  pombal: Record<string, PombalConfig>;
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
    guardrails: merged.guardrails?.plugin && merged.guardrails.core ? { plugin: merged.guardrails.plugin, core: expandHome(merged.guardrails.core) } : null,
    pombal: Object.fromEntries(
      Object.entries(merged.pombal ?? {})
        .filter(([, p]) => p?.integracao && p.minha)
        .map(([nome, p]) => [nome, { integracao: p.integracao, minha: p.minha, remoto: p.remoto || 'origin' }]),
    ),
  };
}
