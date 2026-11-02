import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Config } from './config.js';
import { perfilDe, type Perfil } from './perfil.js';
import type { Project } from './world.js';

/**
 * Plugins e servidores MCP na Fábrica (decisão do usuário, 02/11/2026): **só leitura**. Mostra o que está instalado e
 * ligado em cada perfil, e o que cada plugin traz. Nunca mexe no `settings.json`.
 *
 * Do MCP sai só nome, tipo e onde está configurado: comando, argumentos, URL e variáveis ficam de fora, porque às vezes
 * carregam chave (G13). Conectores do claude.ai (ex.: Claude Docs) vêm da conta e não ficam em arquivo: a vila não os vê.
 */

export interface PluginInfo {
  /** `nome@marketplace`, como no `enabledPlugins`. */
  id: string;
  name: string;
  marketplace: string;
  version: string;
  description: string;
  enabled: boolean;
  perfil: Perfil;
  /** `user` = todos os projetos; senão o escopo gravado pelo Claude Code (ex.: `project`). */
  scope: string;
  installedAt: string | null;
  /** O que o plugin traz, pelo que existe na pasta dele. */
  traz: { skills: number; comandos: number; agentes: number; hooks: boolean; mcp: string[] };
}

export interface McpInfo {
  name: string;
  /** `stdio`, `http`, `sse`… (o `type` da configuração; sem ele, `stdio`). */
  type: string;
  perfil: Perfil;
  /** Onde está configurado: `global`, ou o nome do projeto (`.mcp.json` do repositório ou só nesta máquina). */
  onde: string;
}

export interface PluginsView {
  plugins: PluginInfo[];
  mcp: McpInfo[];
}

/** Pasta de um perfil do Claude Code e o arquivo `.claude.json` dele (no perfil padrão, fica na home). */
export interface PerfilDir {
  perfil: Perfil;
  configDir: string;
  claudeJson: string;
}

export function perfisDe(config: Pick<Config, 'perfilPessoal'>, home = os.homedir()): PerfilDir[] {
  const out: PerfilDir[] = [{ perfil: 'profissional', configDir: path.join(home, '.claude'), claudeJson: path.join(home, '.claude.json') }];
  const p = config.perfilPessoal;
  if (p) out.push({ perfil: 'pessoal', configDir: p.configDir, claudeJson: path.join(p.configDir, '.claude.json') });
  return out;
}

async function readJson(file: string): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function count(dir: string, test: (name: string, isDir: boolean) => boolean) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => test(e.name, e.isDirectory())).length;
}

const exists = (p: string) => fs.stat(p).then(() => true, () => false);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

function mcpList(servers: unknown, perfil: Perfil, onde: string): McpInfo[] {
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers as Record<string, any>).map(([name, cfg]) => ({ name, type: str(cfg?.type, 'stdio'), perfil, onde }));
}

async function readPlugin(id: string, entry: any, enabled: boolean, perfil: Perfil): Promise<PluginInfo> {
  const [name, marketplace = ''] = id.split('@');
  const dir = str(entry?.installPath);
  const manifest = dir ? await readJson(path.join(dir, '.claude-plugin', 'plugin.json')) : null;
  const mcp = dir ? await readJson(path.join(dir, '.mcp.json')) : null;
  return {
    id,
    name: str(manifest?.name, name!),
    marketplace,
    version: str(entry?.version, str(manifest?.version)),
    description: str(manifest?.description),
    enabled,
    perfil,
    scope: str(entry?.scope, 'user'),
    installedAt: str(entry?.installedAt) || null,
    traz: {
      skills: dir ? await count(path.join(dir, 'skills'), (_, isDir) => isDir) : 0,
      comandos: dir ? await count(path.join(dir, 'commands'), (n) => n.endsWith('.md')) : 0,
      agentes: dir ? await count(path.join(dir, 'agents'), (n) => n.endsWith('.md')) : 0,
      hooks: dir ? (await exists(path.join(dir, 'hooks'))) || !!manifest?.hooks : false,
      mcp: Object.keys((mcp?.mcpServers ?? mcp ?? {}) as object),
    },
  };
}

export class Plugins {
  constructor(
    private config: Pick<Config, 'perfilPessoal'>,
    private projects: () => Project[],
    private home = os.homedir(),
  ) {}

  async list(): Promise<PluginsView> {
    const plugins: PluginInfo[] = [];
    const mcp: McpInfo[] = [];
    const projects = this.projects();
    for (const { perfil, configDir, claudeJson } of perfisDe(this.config, this.home)) {
      const installed = await readJson(path.join(configDir, 'plugins', 'installed_plugins.json'));
      const settings = await readJson(path.join(configDir, 'settings.json'));
      const enabled = (settings?.enabledPlugins ?? {}) as Record<string, unknown>;
      for (const [id, entries] of Object.entries((installed?.plugins ?? {}) as Record<string, any[]>)) {
        const entry = Array.isArray(entries) ? entries[0] : entries;
        plugins.push(await readPlugin(id, entry, enabled[id] === true, perfil));
      }
      // MCP do perfil: global e "só nesta máquina" por projeto, os dois no `.claude.json`.
      const cj = await readJson(claudeJson);
      mcp.push(...mcpList(cj?.mcpServers, perfil, 'global'));
      for (const p of projects) mcp.push(...mcpList(cj?.projects?.[p.path]?.mcpServers, perfil, p.name));
    }
    // MCP versionado no repositório (`.mcp.json` na raiz do projeto), no perfil em que o projeto abre.
    for (const p of projects) {
      const file = await readJson(path.join(p.path, '.mcp.json'));
      mcp.push(...mcpList(file?.mcpServers, perfilDe(p.path, this.config), p.name));
    }
    plugins.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
    return { plugins, mcp };
  }
}
