/**
 * Contas do Claude Code (decisão do usuário, 01/11/2026; redesenhada em 19/11/2026). Cada conta é um perfil do Claude
 * Code com nome, pasta de configuração e provedor: Claude (a de `~/.claude`) ou DeepSeek (as assinaturas). O objetivo
 * continua o de antes: não gastar a licença do trabalho com coisa pessoal, sem fronteira de dados.
 *
 * A casa escolhe a conta pela raiz (`roots`): a casa pessoal abre na conta pessoal, o resto no Claude. Toda sessão nova
 * pode escolher outra conta do mesmo tipo (pessoal ou trabalho) na tela do painel da casa; a escolha vale só para ela.
 * Ao retomar, a pasta da conversa (`.jsonl`) manda, nunca a pasta do projeto.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CLAUDE_PROJECTS_DIR, CONTA_CLAUDE, type Config, type Conta } from './config.js';

export type { Conta, Finalidade, Provedor } from './config.js';

const dentro = (dir: string, root: string) => {
  const rel = path.relative(root, dir);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

/** Um arquivo de conversa mora em `<configDir>/projects/...` de uma das contas. */
const dentroDoPerfil = (file: string, configDir: string) => dentro(file, path.join(configDir, 'projects'));

/** Todas as contas, Claude primeiro; tolera um Config montado à mão sem a conta do Claude. */
export function contasDe(config: Pick<Config, 'contas'>): Conta[] {
  const contas = config.contas ?? [];
  return contas.some((c) => c.configDir === CONTA_CLAUDE.configDir) ? contas : [CONTA_CLAUDE, ...contas];
}

/** A conta padrão de uma pasta: a primeira cuja raiz contém a pasta; sem raiz, o Claude. */
export function contaPadraoDe(dir: string, config: Pick<Config, 'contas'>): Conta {
  return contasDe(config).find((c) => c.roots.some((r) => dentro(dir, r))) ?? CONTA_CLAUDE;
}

/** As contas que a casa oferece: as da mesma finalidade da conta padrão (pessoal ou trabalho). */
export function contasDaCasa(dir: string, config: Pick<Config, 'contas'>): Conta[] {
  const padrao = contaPadraoDe(dir, config);
  return contasDe(config).filter((c) => c.finalidade === padrao.finalidade);
}

/** Conta pelo nome (o que o front manda ao abrir a sessão); null = não existe mais no config. */
export function contaPorNome(config: Pick<Config, 'contas'>, nome: string | null | undefined): Conta | null {
  if (!nome) return null;
  return contasDe(config).find((c) => c.nome === nome) ?? null;
}

/**
 * A conta dona de uma conversa salva: a pasta de configuração em que o `.jsonl` mora. É a fonte para retomar sem abrir
 * na conta errada (um `--resume` no perfil de sempre não encontra a conversa gravada no DeepSeek). null = arquivo fora
 * das contas configuradas (config mudou desde a sessão).
 */
export function contaDoArquivo(file: string, config: Pick<Config, 'contas'>): Conta | null {
  return contasDe(config).find((c) => dentroDoPerfil(file, c.configDir)) ?? (dentro(file, CLAUDE_PROJECTS_DIR) ? CONTA_CLAUDE : null);
}

/**
 * Conta exata de uma sessão: a conversa salva manda; sem arquivo ainda, a escolha feita ao abrir; sem escolha, a pasta
 * do projeto (como era antes das contas).
 */
export function contaDaSessao(
  s: { cwd: string; file: string | null },
  config: Pick<Config, 'contas'>,
  escolha?: Conta | null,
): Conta {
  if (s.file) {
    const doArquivo = contaDoArquivo(s.file, config);
    if (doArquivo) return doArquivo;
  }
  return escolha ?? contaPadraoDe(s.cwd, config);
}

/** Onde o Claude Code grava as conversas: a pasta de cada conta. */
export function projectsDirs(config: Pick<Config, 'contas'>): string[] {
  return [...new Set(contasDe(config).map((c) => path.join(c.configDir, 'projects')))];
}

/** A mesma lista, com a conta dona de cada pasta (moinho e biblioteca). */
export function projectsDirsPorConta(config: Pick<Config, 'contas'>): { dir: string; conta: Conta }[] {
  return contasDe(config).map((c) => ({ dir: path.join(c.configDir, 'projects'), conta: c }));
}

/**
 * Trava: uma conta que fala com outra API só abre se o `settings.json` dela manda para fora da Anthropic e tem a chave
 * preenchida. Sem isso o `claude` cairia no login de sempre, que é a licença do trabalho. Devolve o motivo, ou null
 * quando está tudo certo. Nunca põe o valor da chave na mensagem (G13).
 */
export function problemaDaContaSync(configDir: string): string | null {
  const arquivo = path.join(configDir, 'settings.json');
  let env: Record<string, unknown>;
  try {
    env = JSON.parse(readFileSync(arquivo, 'utf8')).env ?? {};
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

/** Delega para a síncrona: a regra de "fora da Anthropic + chave" mora num lugar só. */
export async function problemaDaConta(configDir: string): Promise<string | null> {
  return problemaDaContaSync(configDir);
}

/**
 * Variáveis extras do terminal de uma pasta. Com escolha (conta escolhida na sessão, ou a conversa que já diz onde mora):
 * abre nela, ou devolve o motivo de não poder. Sem escolha: a conta padrão pela raiz da pasta. O Claude de ~/.claude
 * nunca recebe `CLAUDE_CONFIG_DIR`, e as contas DeepSeek sempre recebem (com a trava da chave).
 */
export async function ambienteDoTerminal(
  cwd: string,
  config: Pick<Config, 'contas'>,
  escolha?: Conta | null,
): Promise<{ env: Record<string, string | undefined> } | { erro: string }> {
  const alvo = escolha ?? contaPadraoDe(cwd, config);
  if (alvo.provedor === 'claude') {
    return { env: { CLAUDE_CONFIG_DIR: alvo.configDir === CONTA_CLAUDE.configDir ? undefined : alvo.configDir } };
  }
  const erro = await problemaDaConta(alvo.configDir);
  return erro ? { erro: `${alvo.nome}: ${erro}` } : { env: { CLAUDE_CONFIG_DIR: alvo.configDir } };
}
