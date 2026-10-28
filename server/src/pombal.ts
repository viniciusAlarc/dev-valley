import { commit, git } from './git.js';

/**
 * Pombal no quintal (decisões de 27 e 28/10/2026): a única peça de git da casa, em dois estágios. **Local**: o que só
 * você tem (alterações sem commit ou commits que o upstream não tem), cartas espalhadas no chão. **Enviado**: o time
 * já tem. "Enviar para o time" faz commit, pull com rebase e push de uma vez; "Trazer" é o pull da manhã. Toda casa
 * com git tem pombal; sem upstream, só o commit funciona.
 */
export interface Pombal {
  branch: string;
  /** Upstream da branch, como o git mostra (`origin/desenv`); null = branch sem upstream (só commit local). */
  upstream: string | null;
  /** Arquivos que só você tem: diferentes do ponto em que a branch saiu do upstream, com e sem commit (cartas no chão). */
  locais: number;
  /** Commits do upstream que a branch ainda não tem (pombo com carta no telhado). */
  aReceber: number;
  /** Último fetch bem-sucedido (ms); null = ainda não buscou desde que o servidor subiu. */
  buscadoEm: number | null;
  /** Falha do fetch automático: só aparece no texto do pombal, sem o "!" (decisão de 28/10/2026). */
  falhaBusca: string | null;
  /**
   * Falha da última viagem que você disparou: acende o "!". Some na próxima que der certo, ou quando o HEAD sai do
   * commit em que ela aconteceu (o conflito foi resolvido por fora, com um morador).
   */
  erro: string | null;
}

export interface Carta {
  hash: string;
  autor: string;
  data: string;
  assunto: string;
}

/** Fetch e erro por pasta: o mundo é refeito a cada 3 s, isto não. */
const memoria = new Map<string, { buscadoEm: number | null; falhaBusca: string | null; erro: string | null; erroEm?: string }>();
/** Pastas com viagem em curso: dois cliques não disparam dois rebases. */
const voando = new Set<string>();

const lembrar = (dir: string) => memoria.get(dir) ?? { buscadoEm: null, falhaBusca: null, erro: null };
const linhas = (out: string) => out.split('\n').filter(Boolean);

async function upstreamOf(dir: string): Promise<string | null> {
  return (await git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).catch(() => '')).trim() || null;
}

/**
 * Arquivos que só você tem. Compara com o ponto em que a branch saiu do upstream (merge-base), não com o upstream:
 * o que o time mandou e você ainda não trouxe não conta como seu. Sem upstream, compara com o último commit.
 */
async function arquivosLocais(dir: string, upstream: string | null): Promise<string[]> {
  const base = upstream ? (await git(dir, ['merge-base', '@{u}', 'HEAD']).catch(() => '')).trim() || 'HEAD' : 'HEAD';
  const [rastreados, novos] = await Promise.all([
    git(dir, ['diff', '--name-only', base]).catch(() => ''),
    git(dir, ['ls-files', '--others', '--exclude-standard']).catch(() => ''),
  ]);
  return [...new Set([...linhas(rastreados), ...linhas(novos)])];
}

/** Estado do pombal só com o que já está no disco (sem rede): roda a cada atualização do mundo. */
export async function readPombal(dir: string, branch: string | null): Promise<Pombal | null> {
  if (!branch) return null;
  const upstream = await upstreamOf(dir);
  const [locais, receber] = await Promise.all([
    arquivosLocais(dir, upstream),
    upstream ? git(dir, ['rev-list', '--count', 'HEAD..@{u}']).catch(() => '0') : Promise.resolve('0'),
  ]);
  const { buscadoEm, falhaBusca, erro, erroEm } = lembrar(dir);
  const head = erro ? (await git(dir, ['rev-parse', 'HEAD']).catch(() => '')).trim() : '';
  return { branch, upstream, locais: locais.length, aReceber: Number(receber) || 0, buscadoEm, falhaBusca, erro: erro && head === erroEm ? erro : null };
}

/** Busca o remoto da branch (rede). Guarda o resultado para o próximo `readPombal`. */
export async function buscar(dir: string): Promise<void> {
  try {
    await git(dir, ['fetch', '--quiet'], { network: true });
    memoria.set(dir, { ...lembrar(dir), buscadoEm: Date.now(), falhaBusca: null });
  } catch (err) {
    memoria.set(dir, { ...lembrar(dir), falhaBusca: `não consegui buscar o remoto: ${(err as Error).message}` });
  }
}

/** O que o painel mostra: commits chegando, commits seus que ainda não foram e os arquivos locais. */
export async function cartas(dir: string): Promise<{ receber: Carta[]; enviar: Carta[]; arquivos: string[] }> {
  const upstream = await upstreamOf(dir);
  const log = async (range: string): Promise<Carta[]> => {
    const out = await git(dir, ['log', '--no-merges', '--max-count=50', '--date=short', '--format=%h%x09%an%x09%ad%x09%s', range]).catch(() => '');
    return linhas(out).map((l) => {
      const [hash, autor, data, ...assunto] = l.split('\t');
      return { hash, autor, data, assunto: assunto.join('\t') };
    });
  };
  const [receber, enviar, arquivos] = await Promise.all([
    upstream ? log('HEAD..@{u}') : [],
    upstream ? log('@{u}..HEAD') : [],
    arquivosLocais(dir, upstream),
  ]);
  return { receber, enviar, arquivos };
}

export class PombalError extends Error {
  constructor(
    message: string,
    /** Arquivos em conflito no rebase (já desfeito). */
    readonly conflitos: string[] = [],
    /** Passos que deram certo antes da falha. */
    public passos: string[] = [],
  ) {
    super(message);
  }
}

/**
 * Uma viagem do pombo. `receber` (manhã): fetch e rebase do que é seu em cima do upstream. `enviar`: commit das
 * alterações (mensagem obrigatória quando há o que commitar; `arquivos` vazio = todas), o mesmo rebase e o push, que o
 * git só aceita como fast-forward. O rebase usa `--autostash`: alteração sem commit não impede trazer. Rebase com
 * conflito = `rebase --abort`, o repositório fica como estava (o commit recém-feito continua, só não foi). Sem
 * upstream, `enviar` só commita. Devolve os passos feitos, para o painel mostrar.
 */
export async function voar(dir: string, acao: 'receber' | 'enviar', opts: { mensagem?: string; arquivos?: string[] } = {}): Promise<string[]> {
  if (voando.has(dir)) throw new PombalError('O pombo já está voando. Espere ele voltar.');
  voando.add(dir);
  const passos: string[] = [];
  try {
    const upstream = await upstreamOf(dir);
    if (acao === 'receber' && !upstream) throw new PombalError('A branch desta casa não tem upstream: não há de onde trazer.');

    if (acao === 'enviar' && (await git(dir, ['status', '--porcelain'])).trim()) {
      const mensagem = opts.mensagem?.trim();
      if (!mensagem) throw new PombalError('Escreva o que mudou: a mensagem vai junto com as cartas.');
      await commit(dir, mensagem, opts.arquivos ?? []);
      passos.push(`Guardou as alterações: "${mensagem.split('\n')[0]}"`);
    }
    if (!upstream) {
      passos.push('A branch não tem upstream: ficou só aqui');
      memoria.set(dir, { ...lembrar(dir), erro: null });
      return passos;
    }

    await git(dir, ['fetch', '--quiet'], { network: true });
    passos.push('Buscou o remoto');

    const antes = (await git(dir, ['rev-parse', 'HEAD'])).trim();
    const stashes = linhas(await git(dir, ['stash', 'list'])).length;
    try {
      await git(dir, ['rebase', '--autostash', '@{u}']);
    } catch (err) {
      const conflitos = linhas(await git(dir, ['diff', '--name-only', '--diff-filter=U']).catch(() => ''));
      await git(dir, ['rebase', '--abort']).catch(() => {});
      throw new PombalError(
        conflitos.length
          ? `O que chegou de ${upstream} conflita com o que é seu. Desfiz o rebase; nada se perdeu. Resolva com um morador da casa (git pull --rebase).`
          : `O rebase falhou e nada mudou: ${(err as Error).message}`,
        conflitos,
      );
    }
    // O autostash que não volta limpo fica guardado no stash: sem perda, mas fora da pasta até alguém resolver.
    if (linhas(await git(dir, ['stash', 'list'])).length > stashes)
      throw new PombalError('Trouxe o que chegou, mas suas alterações sem commit conflitaram e ficaram guardadas no stash. Resolva com um morador (git stash pop).');
    const depois = (await git(dir, ['rev-parse', 'HEAD'])).trim();
    passos.push(antes === depois ? `Já tinha tudo de ${upstream}` : `Trouxe o que chegou de ${upstream}`);

    if (acao === 'enviar' && linhas(await git(dir, ['rev-list', '@{u}..HEAD'])).length) {
      // Remoto e ref do upstream pela config do git: nome de branch pode ter "/".
      const branch = (await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      const remoto = (await git(dir, ['config', `branch.${branch}.remote`])).trim();
      const ref = (await git(dir, ['config', `branch.${branch}.merge`])).trim();
      await git(dir, ['push', '--quiet', remoto, `HEAD:${ref}`], { network: true });
      passos.push(`Entregou em ${upstream}: o time já tem`);
    }
    memoria.set(dir, { buscadoEm: Date.now(), falhaBusca: null, erro: null });
    return passos;
  } catch (err) {
    // Recusa antes de sair (upstream, mensagem, clique duplo) não marca o pombal; falha no caminho, sim.
    if (!(err instanceof PombalError) || passos.length) {
      const erroEm = (await git(dir, ['rev-parse', 'HEAD']).catch(() => '')).trim();
      memoria.set(dir, { ...lembrar(dir), erro: (err as Error).message, erroEm });
    }
    const e = err instanceof PombalError ? err : new PombalError((err as Error).message);
    e.passos = passos;
    throw e;
  } finally {
    voando.delete(dir);
  }
}
