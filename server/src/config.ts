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
  /**
   * Outdoor dos guardrails na vila: o plugin que os aplica (chave de `enabledPlugins` no settings.json) e o arquivo
   * com a lista (`## G<n> — título`). Fica no config local (caminho pessoal); sem ele, não há outdoor.
   */
  guardrails: { plugin: string; core: string } | null;
  /**
   * Projetos pessoais (decisão do usuário, 01/11/2026): o que está nas `roots` abre o terminal com
   * `CLAUDE_CONFIG_DIR=configDir`, um perfil do Claude Code que fala com outra API (DeepSeek), para não gastar a licença
   * do trabalho. Fica no config local (caminho pessoal); sem ele, todo projeto é profissional.
   */
  perfilPessoal: { roots: string[]; configDir: string } | null;
  /** Porão (MA-1): quantas sessões de trabalho o maestro abre por rodada (padrão e máximo: 5, decisão de 03/11/2026). */
  porao: { tetoSessoes: number };
}

/** Sessões de trabalho por rodada do maestro (decisão do usuário, 03/11/2026); `porao.tetoSessoes` no config só baixa. */
export const TETO_PADRAO = 5;

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
    perfilPessoal: merged.perfilPessoal?.roots?.length && merged.perfilPessoal.configDir
      ? { roots: merged.perfilPessoal.roots.map(expandHome), configDir: expandHome(merged.perfilPessoal.configDir) }
      : null,
    porao: { tetoSessoes: Math.min(TETO_PADRAO, Math.max(1, Math.floor(Number(merged.porao?.tetoSessoes) || TETO_PADRAO))) },
    guardrails: merged.guardrails?.plugin && merged.guardrails.core ? { plugin: merged.guardrails.plugin, core: expandHome(merged.guardrails.core) } : null,
  };
}
