/**
 * Perfil pessoal × profissional (decisão do usuário, 01/11/2026). Projeto numa das `perfilPessoal.roots` abre o
 * `claude` com `CLAUDE_CONFIG_DIR` apontando para outro perfil, cujo `settings.json` manda as chamadas para outra API
 * (DeepSeek). O objetivo é só não gastar a licença do trabalho com coisa pessoal: não há fronteira de dados.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CLAUDE_PROJECTS_DIR, type Config } from './config.js';

export type Perfil = 'pessoal' | 'profissional';

const dentro = (dir: string, root: string) => {
  const rel = path.relative(root, dir);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

export function perfilDe(dir: string, config: Pick<Config, 'perfilPessoal'>): Perfil {
  return config.perfilPessoal?.roots.some((r) => dentro(dir, r)) ? 'pessoal' : 'profissional';
}

/** Onde o Claude Code grava as conversas: o perfil de sempre e, se configurado, o pessoal. */
export function projectsDirs(config: Pick<Config, 'perfilPessoal'>): string[] {
  return config.perfilPessoal ? [CLAUDE_PROJECTS_DIR, path.join(config.perfilPessoal.configDir, 'projects')] : [CLAUDE_PROJECTS_DIR];
}

/**
 * Trava: o perfil pessoal só abre se o `settings.json` dele manda para outra API e tem a chave preenchida. Sem isso o
 * `claude` cairia no login de sempre, que é a licença do trabalho. Devolve o motivo, ou null quando está tudo certo.
 * Nunca põe o valor da chave na mensagem (G13).
 */
export async function problemaDoPerfilPessoal(configDir: string): Promise<string | null> {
  const arquivo = path.join(configDir, 'settings.json');
  let env: Record<string, unknown>;
  try {
    env = JSON.parse(await fs.readFile(arquivo, 'utf8')).env ?? {};
  } catch {
    return `${arquivo} não existe ou não é JSON válido.`;
  }
  const url = typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL : '';
  if (!url || /(^|\.)anthropic\.com/.test(new URL(url, 'http://x').hostname)) {
    return `${arquivo} não tem ANTHROPIC_BASE_URL apontando para outra API (env).`;
  }
  const chave = [env.ANTHROPIC_AUTH_TOKEN, env.ANTHROPIC_API_KEY].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  if (!chave || chave.startsWith('COLE_')) return `${arquivo} está sem a chave da API (ANTHROPIC_AUTH_TOKEN no env).`;
  return null;
}

/**
 * Variáveis extras do terminal de uma pasta. Pessoal: `CLAUDE_CONFIG_DIR` do perfil, ou o motivo de não poder abrir.
 * Profissional: tira `CLAUDE_CONFIG_DIR` herdado, para nunca cair no perfil pessoal por engano.
 */
export async function ambienteDoTerminal(
  cwd: string,
  config: Pick<Config, 'perfilPessoal'>,
): Promise<{ env: Record<string, string | undefined> } | { erro: string }> {
  if (perfilDe(cwd, config) === 'profissional') return { env: { CLAUDE_CONFIG_DIR: undefined } };
  const configDir = config.perfilPessoal!.configDir;
  const erro = await problemaDoPerfilPessoal(configDir);
  return erro ? { erro: `Projeto pessoal: ${erro}` } : { env: { CLAUDE_CONFIG_DIR: configDir } };
}
