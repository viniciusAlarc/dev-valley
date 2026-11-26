import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Provedor da API: é o que decide a roupa do morador (tons quentes no Claude, frios no DeepSeek). */
export type Provedor = 'claude' | 'deepseek';

/** Finalidade da conta: casa pessoal só abre contas pessoais; casa de trabalho, contas de trabalho (19/11/2026). */
export type Finalidade = 'pessoal' | 'trabalho';

/**
 * Conta: um perfil do Claude Code com nome, pasta de configuração e provedor (decisão do usuário, 19/11/2026). `roots`
 * são as raízes cujos projetos abrem nela por padrão (a casa pessoal); sem raiz, a conta só abre por escolha na sessão.
 * O terminal usa o `configDir` como `CLAUDE_CONFIG_DIR`; a conta do Claude de ~/.claude é a única sem essa variável.
 */
export interface Conta {
  nome: string;
  provedor: Provedor;
  configDir: string;
  roots: string[];
  finalidade: Finalidade;
}

/** A conta do Claude Code de sempre: sempre a primeira, e a única que não recebe `CLAUDE_CONFIG_DIR`. */
export const CONTA_CLAUDE: Conta = {
  nome: 'Claude',
  provedor: 'claude',
  configDir: path.join(os.homedir(), '.claude'),
  roots: [],
  finalidade: 'trabalho',
};

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
   * Contas do Claude Code (decisão do usuário, 01/11/2026; redesenhada em 19/11/2026): o Claude de `~/.claude` é sempre
   * a primeira; as demais vêm do config local, com nome, pasta de configuração, provedor e, quando for casa pessoal,
   * as `roots`. A conta escolhida vira `CLAUDE_CONFIG_DIR` no terminal.
   */
  contas: Conta[];
  /**
   * Agentes da vila (decisão do usuário, 19/11/2026): a conta que responde pelas consultas dos agentes que só leem
   * (bibliotecária, jornaleiro, jornaleiro da conversa, escrevente, médica, maestro mirim). `null` = Claude. O
   * administrador fica sempre no Claude, porque é o único que edita arquivos.
   */
  agentes: { conta: string | null };
  /**
   * Porão (MA-1): quantas sessões de trabalho o maestro abre por rodada (padrão e máximo: 5, decisão de 03/11/2026),
   * quantas delas ficam abertas ao mesmo tempo (`simultaneas`, padrão 3, máximo 5: modo início de sprint, 25/11/2026),
   * e o que elas podem ler fora do projeto sem pedir permissão (`leitura`, absolutos: ex. o contrato "Sob o maestro").
   */
  porao: { tetoSessoes: number; simultaneas: number; leitura: string[] };
}

/** Sessões de trabalho por rodada do maestro (decisão do usuário, 03/11/2026); `porao.tetoSessoes` no config só baixa. */
export const TETO_PADRAO = 5;
/** Sessões de uma rodada abertas ao mesmo tempo (P3, 25/11/2026): o resto abre em ondas. `porao.simultaneas`, até 5. */
export const SIMULTANEAS_PADRAO = 3;

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

export function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** O JSON do config é dado bruto: `contas` e as chaves antigas (`perfilPessoal`, `perfisExtras`) são validadas abaixo. */
type ConfigBruto = Omit<Partial<Config>, 'contas'> & {
  contas?: unknown;
  perfilPessoal?: { roots?: unknown; configDir?: unknown } | null;
  perfisExtras?: unknown[];
};

function readJson(file: string): ConfigBruto {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Caminho absoluto do JSON, com `~` expandido; null quando vazio ou relativo (aposta num diretório qualquer). */
function caminhoDoConfig(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const p = expandHome(valor.trim());
  return path.isAbsolute(p) ? path.resolve(p) : null;
}

/**
 * As contas do config local, validadas. O Claude de `~/.claude` é sempre a primeira e não pode ser repetido; nome e
 * pasta são únicos. Conta sem `finalidade` é pessoal quando tem raiz (a casa pessoal) e de trabalho quando não tem.
 */
function normalizarContas(lista: unknown): Conta[] {
  const contas: Conta[] = [CONTA_CLAUDE];
  const nomes = new Set([CONTA_CLAUDE.nome.toLowerCase()]);
  const dirs = new Set([CONTA_CLAUDE.configDir]);
  for (const bruto of Array.isArray(lista) ? lista : []) {
    if (!bruto || typeof bruto !== 'object') continue;
    const e = bruto as Record<string, unknown>;
    const nome = typeof e.nome === 'string' ? e.nome.replace(/\s+/g, ' ').trim() : '';
    if (!nome || nome.length > 40 || nomes.has(nome.toLowerCase())) continue;
    const configDir = caminhoDoConfig(e.configDir);
    if (!configDir || dirs.has(configDir)) continue;
    const roots = [...new Set((Array.isArray(e.roots) ? e.roots : []).map(caminhoDoConfig).filter((r): r is string => !!r))];
    const provedor: Provedor = String(e.provedor ?? '').toLowerCase() === 'claude' ? 'claude' : 'deepseek';
    const finalidade: Finalidade = e.finalidade === 'pessoal' || e.finalidade === 'trabalho' ? e.finalidade : roots.length ? 'pessoal' : 'trabalho';
    nomes.add(nome.toLowerCase());
    dirs.add(configDir);
    contas.push({ nome, provedor, configDir, roots, finalidade });
  }
  return contas;
}

/** Config antigo (uma chave pessoal + extras) convertido para a lista de contas, para não quebrar quem ainda não migrou. */
function contasLegadas(bruto: ConfigBruto): unknown[] {
  const out: unknown[] = [];
  const p = bruto.perfilPessoal;
  if (p && typeof p.configDir === 'string' && Array.isArray(p.roots) && p.roots.length) {
    out.push({ nome: 'DeepSeek pessoal', provedor: 'deepseek', configDir: p.configDir, roots: p.roots, finalidade: 'pessoal' });
  }
  for (const e of Array.isArray(bruto.perfisExtras) ? bruto.perfisExtras : []) {
    if (e && typeof e === 'object' && typeof (e as Record<string, unknown>).nome === 'string' && typeof (e as Record<string, unknown>).configDir === 'string') {
      out.push({ ...(e as object), provedor: 'deepseek', finalidade: 'trabalho' });
    }
  }
  return out;
}

// dev-valley.config.local.json (gitignored) sobrescreve o config versionado.
export function loadConfig(): Config {
  const base = readJson(path.join(ROOT_DIR, 'dev-valley.config.json'));
  const local = readJson(path.join(ROOT_DIR, 'dev-valley.config.local.json'));
  const merged = { ...base, ...local } as ConfigBruto;
  return {
    port: merged.port ?? 4777,
    projectRoots: (merged.projectRoots ?? []).map(expandHome),
    extraProjects: (merged.extraProjects ?? []).map(expandHome),
    ignore: merged.ignore ?? [],
    sessionMaxAgeDays: merged.sessionMaxAgeDays ?? 14,
    libraryRoots: (merged.libraryRoots ?? []).map(expandHome),
    contas: normalizarContas(Array.isArray(merged.contas) ? merged.contas : contasLegadas(merged)),
    agentes: {
      conta: typeof merged.agentes?.conta === 'string' && merged.agentes.conta.trim() ? merged.agentes.conta.trim() : null,
    },
    porao: {
      tetoSessoes: Math.min(TETO_PADRAO, Math.max(1, Math.floor(Number(merged.porao?.tetoSessoes) || TETO_PADRAO))),
      simultaneas: Math.min(TETO_PADRAO, Math.max(1, Math.floor(Number(merged.porao?.simultaneas) || SIMULTANEAS_PADRAO))),
      // Só caminho absoluto (ou com ~), sem parêntese nem `..`: vira regra `Read(//…)` das sessões de trabalho.
      leitura: (Array.isArray(merged.porao?.leitura) ? merged.porao.leitura : [])
        .filter((x): x is string => typeof x === 'string')
        .map(expandHome)
        .filter((x) => path.isAbsolute(x) && !/[()\n]/.test(x) && !x.split('/').includes('..')),
    },
    guardrails: merged.guardrails?.plugin && merged.guardrails.core ? { plugin: merged.guardrails.plugin, core: expandHome(merged.guardrails.core) } : null,
  };
}
