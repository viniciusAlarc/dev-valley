import fs from 'node:fs/promises';
import path from 'node:path';
import { git } from './git.js';

/** Branches de um projeto com pombal, do `dev-valley.config.local.json` (nome de branch de projeto privado). */
export interface PombalConfig {
  /** Branch comum do time, para onde vai o trabalho do dia. */
  integracao: string;
  /** Branch de quem usa a vila; a casa precisa estar nela para o pombo sair. */
  minha: string;
  remoto: string;
}

/**
 * Pombal na fachada (decisão de 27/10/2026): sincroniza a branch de trabalho com a branch comum do time. De manhã o
 * pombo traz as cartas (merge da comum na minha); no fim do dia leva as suas (push da minha para a comum).
 */
export interface Pombal extends PombalConfig {
  /** A casa está em outra branch: o pombo não sai. */
  branchErrada: boolean;
  /** Commits da branch comum que a minha ainda não tem (cartas chegando). */
  aReceber: number;
  /** Commits da minha que a comum ainda não tem (cartas a levar). */
  aEnviar: number;
  /** Último fetch bem-sucedido (ms); null = ainda não buscou desde que o servidor subiu. */
  buscadoEm: number | null;
  /** Falha do último fetch ou da última viagem; some na próxima que der certo. */
  erro: string | null;
}

export interface Carta {
  hash: string;
  autor: string;
  data: string;
  assunto: string;
}

/** Fetch e erro por pasta: o mundo é refeito a cada 3 s, isto não. */
const memoria = new Map<string, { buscadoEm: number | null; erro: string | null }>();
/** Pastas com viagem em curso: dois cliques não disparam dois merges. */
const voando = new Set<string>();

const lembrar = (dir: string) => memoria.get(dir) ?? { buscadoEm: null, erro: null };

/** Estado do pombal só com o que já está no disco (sem rede): roda a cada atualização do mundo. */
export async function readPombal(dir: string, cfg: PombalConfig, branchAtual: string | null): Promise<Pombal> {
  const { buscadoEm, erro } = lembrar(dir);
  const base = { ...cfg, branchErrada: branchAtual !== cfg.minha, aReceber: 0, aEnviar: 0, buscadoEm, erro };
  try {
    // "<atrás>\t<à frente>" da minha em relação à comum, como o remoto estava no último fetch. Sem os merges: o merge
    // da manhã sozinho não é carta a levar, senão o pombal nunca ficaria em dia depois do pull.
    const [atras, frente] = (await git(dir, ['rev-list', '--no-merges', '--left-right', '--count', `${cfg.remoto}/${cfg.integracao}...${cfg.minha}`])).trim().split(/\s+/).map(Number);
    return { ...base, aReceber: atras || 0, aEnviar: frente || 0 };
  } catch {
    return { ...base, erro: erro ?? `branch ${cfg.remoto}/${cfg.integracao} ou ${cfg.minha} não encontrada` };
  }
}

/** Busca o remoto (rede). Guarda o resultado para o próximo `readPombal`. */
export async function buscar(dir: string, cfg: PombalConfig): Promise<void> {
  try {
    await git(dir, ['fetch', '--quiet', cfg.remoto], { network: true });
    memoria.set(dir, { buscadoEm: Date.now(), erro: null });
  } catch (err) {
    memoria.set(dir, { ...lembrar(dir), erro: `não consegui buscar o remoto: ${(err as Error).message}` });
  }
}

/** Cartas nos dois sentidos, sem os commits de merge (eles só dizem "trouxe a comum"). */
export async function cartas(dir: string, cfg: PombalConfig): Promise<{ receber: Carta[]; enviar: Carta[] }> {
  const comum = `${cfg.remoto}/${cfg.integracao}`;
  const log = async (range: string): Promise<Carta[]> => {
    const out = await git(dir, ['log', '--no-merges', '--max-count=50', '--date=short', '--format=%h%x09%an%x09%ad%x09%s', range]).catch(() => '');
    return out
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [hash, autor, data, ...assunto] = l.split('\t');
        return { hash, autor, data, assunto: assunto.join('\t') };
      });
  };
  const [receber, enviar] = await Promise.all([log(`${cfg.minha}..${comum}`), log(`${comum}..${cfg.minha}`)]);
  return { receber, enviar };
}

export class PombalError extends Error {
  constructor(
    message: string,
    /** Arquivos em conflito no merge (já desfeito). */
    readonly conflitos: string[] = [],
    /** Passos que deram certo antes da falha. */
    public passos: string[] = [],
  ) {
    super(message);
  }
}

/**
 * Uma viagem do pombo. As duas começam igual: fetch, merge da comum na minha (conflito se resolve na minha, nunca
 * na comum) e push da minha. `enviar` termina com o push da minha para a comum, que o git só aceita como
 * fast-forward: se alguém entregou nesse meio-tempo, ele recusa e nada se perde. Falhou no meio = o repositório
 * fica como estava (merge desfeito com `--abort`). Devolve os passos feitos, para o painel mostrar.
 */
export async function voar(dir: string, cfg: PombalConfig, acao: 'receber' | 'enviar'): Promise<string[]> {
  if (voando.has(dir)) throw new PombalError('O pombo já está voando. Espere ele voltar.');
  voando.add(dir);
  const passos: string[] = [];
  const comum = `${cfg.remoto}/${cfg.integracao}`;
  try {
    const atual = (await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    if (atual !== cfg.minha) throw new PombalError(`A casa está na branch ${atual}; o pombo só sai da ${cfg.minha}.`);
    // Arquivo novo fora do git não atrapalha; o merge recusa sozinho se fosse sobrescrever um.
    if ((await git(dir, ['status', '--porcelain', '--untracked-files=no'])).trim())
      throw new PombalError('Há mudanças sem commit. Passe pela caixa de envio antes de mandar o pombo.');

    await git(dir, ['fetch', '--quiet', cfg.remoto], { network: true });
    passos.push(`Buscou ${cfg.remoto}`);

    try {
      const out = await git(dir, ['merge', '--no-edit', comum]);
      passos.push(/up to date|atualizad/i.test(out) ? `${cfg.minha} já tinha tudo da ${cfg.integracao}` : `Trouxe a ${cfg.integracao} para a ${cfg.minha}`);
    } catch (err) {
      const conflitos = (await git(dir, ['diff', '--name-only', '--diff-filter=U']).catch(() => '')).split('\n').filter(Boolean);
      const emMerge = await fs.access(path.join(dir, '.git', 'MERGE_HEAD')).then(() => true, () => false);
      if (emMerge) await git(dir, ['merge', '--abort']);
      throw new PombalError(
        conflitos.length
          ? `A ${cfg.integracao} conflita com a ${cfg.minha}. Desfiz o merge; nada mudou. Resolva com um morador da casa (git merge ${comum}).`
          : `O merge falhou e nada mudou: ${(err as Error).message}`,
        conflitos,
      );
    }

    await git(dir, ['push', '--quiet', cfg.remoto, cfg.minha], { network: true });
    passos.push(`Enviou a ${cfg.minha} para o ${cfg.remoto}`);

    if (acao === 'enviar') {
      await git(dir, ['push', '--quiet', cfg.remoto, `${cfg.minha}:${cfg.integracao}`], { network: true });
      passos.push(`Entregou a ${cfg.minha} na ${cfg.integracao}`);
    }
    memoria.set(dir, { buscadoEm: Date.now(), erro: null });
    return passos;
  } catch (err) {
    // Recusa antes de sair (branch, caixa de envio, clique duplo) não marca o pombal; falha no caminho, sim.
    if (!(err instanceof PombalError) || passos.length) memoria.set(dir, { ...lembrar(dir), erro: (err as Error).message });
    const e = err instanceof PombalError ? err : new PombalError((err as Error).message);
    e.passos = passos;
    throw e;
  } finally {
    voando.delete(dir);
  }
}
