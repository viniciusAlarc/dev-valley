import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { askAgent, type AgentEvent, type Exchange } from './consulta.js';
import { git } from './git.js';
import type { World } from './world.js';

/**
 * Banca de jornal (decisões do usuário, 02/11/2026, "segue as recomendações"): o que mudou nos projetos desde a última
 * vez que o jornal foi lido (piso de 24h, teto de 7 dias), **em linguagem de gente, nada técnico**. Seus commits e os do
 * time entram separados. Projeto parado há 14 dias ou mais vai numa linha no rodapé.
 *
 * Uma edição por dia, gerada depois das 6h (ou no clique "Imprimir"), guardada em `~/.cache/dev-valley/jornal/`. Abrir de
 * novo não gasta nada. Sem commit no período, não chama o agente. O jornaleiro (`server/agents/jornaleiro.md`) é um
 * agente da vila como o escrevente (`claude -p --no-session-persistence`, regra 5) e recebe só as mensagens de commit e os
 * nomes dos arquivos, nunca o diff. A banca não faz rede: usa o que o pombal já buscou do remoto.
 */

const HORA = 3600_000;
const DIA = 24 * HORA;
const PARADO_DIAS = 14;
const MAX_COMMITS = 40;
const MAX_ARQUIVOS = 8;
/** Conversa com o jornaleiro: até onde ele enxerga, e quantos commits por lado e por projeto. */
const JANELA_CONVERSA = 30 * DIA;
const MAX_COMMITS_CONVERSA = 150;

export interface Commit {
  hash: string;
  quando: number;
  assunto: string;
  arquivos: string[];
}

export interface Movimento {
  nome: string;
  voce: Commit[];
  time: Commit[];
}

export interface Noticia {
  nome: string;
  /** Título curto da notícia (Gazeta do Vale, 02/11/2026); sem título na resposta, o nome do projeto. */
  titulo: string;
  voce: string;
  time: string;
}

export interface Edicao {
  /** `AAAA-MM-DD` (data local). */
  data: string;
  geradaEm: number;
  desde: number;
  manchete: string;
  noticias: Noticia[];
  /** Projetos sem nenhum commit no período. */
  semNovidade: string[];
  /** Projetos sem commit nem conversa há 14 dias ou mais. */
  parados: { nome: string; dias: number }[];
  /** Edição extra, pedida na conversa com o jornaleiro: outro período ou um projeto só (02/11/2026). */
  extra?: boolean;
}

export interface JornalView {
  edicao: Edicao | null;
  /** A última edição extra pedida ao jornaleiro; null = nenhuma. */
  extra: Edicao | null;
  gerando: boolean;
  erro: string | null;
}

export const dataLocal = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Início do período: a última leitura, com piso de 24h e teto de 7 dias. */
export function desdeQuando(lidoEm: number | null, agora: number): number {
  const piso = agora - DIA;
  if (!lidoEm || lidoEm > piso) return piso;
  return Math.max(lidoEm, agora - 7 * DIA);
}

/** Commits do período em todas as branches (inclusive o que o pombal já trouxe do remoto), sem merge, sem repetir. */
export async function commitsDesde(dir: string, desde: number, limite = MAX_COMMITS): Promise<{ voce: Commit[]; time: Commit[] }> {
  const meuEmail = (await git(dir, ['config', 'user.email']).catch(() => '')).trim().toLowerCase();
  const out = await git(dir, ['log', '--all', '--no-merges', `--since=${new Date(desde).toISOString()}`, '--name-only', '--format=%x1e%H%x1f%ae%x1f%ct%x1f%s']).catch(() => '');
  const voce: Commit[] = [];
  const time: Commit[] = [];
  const vistos = new Set<string>();
  for (const bloco of out.split('\x1e')) {
    const [cab, ...resto] = bloco.split('\n');
    const [hash, email, ct, assunto] = (cab ?? '').split('\x1f');
    if (!hash || !assunto || vistos.has(hash)) continue;
    vistos.add(hash);
    const c = { hash, quando: Number(ct) * 1000, assunto, arquivos: resto.filter(Boolean).slice(0, MAX_ARQUIVOS) };
    (meuEmail && email?.toLowerCase() === meuEmail ? voce : time).push(c);
  }
  return { voce: voce.slice(0, limite), time: time.slice(0, limite) };
}

/** O que a vila manda ao jornaleiro: só assunto e nomes de arquivo. */
export function pauta(movimentos: Movimento[], desde: number): string {
  const bloco = (titulo: string, cs: Commit[]) =>
    cs.length ? `${titulo}:\n${cs.map((c) => `- ${c.assunto}${c.arquivos.length ? ` (arquivos: ${c.arquivos.join(', ')})` : ''}`).join('\n')}` : '';
  return [
    `Período: desde ${new Date(desde).toLocaleString('pt-BR')}.`,
    ...movimentos.map((m) => [`## ${m.nome}`, bloco('Você fez', m.voce), bloco('O time fez', m.time)].filter(Boolean).join('\n\n')),
  ].join('\n\n');
}

/** Lê a resposta do jornaleiro (JSON); devolve null se não der para entender. */
export function lerResposta(texto: string, nomes: string[]): { manchete: string; noticias: Noticia[] } | null {
  const ini = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    const j = JSON.parse(texto.slice(ini, fim + 1));
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const noticias: Noticia[] = (Array.isArray(j.noticias) ? j.noticias : [])
      .map((n: any) => {
        const nome = s(n?.projeto ?? n?.nome);
        return { nome, titulo: s(n?.titulo) || nome, voce: s(n?.voce), time: s(n?.time) };
      })
      .filter((n: Noticia) => nomes.includes(n.nome) && (n.voce || n.time));
    const manchete = s(j.manchete);
    return manchete && noticias.length ? { manchete, noticias } : null;
  } catch {
    return null;
  }
}

function pedirAoJornaleiro(preamble: string, hooksToIgnore: Set<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    askAgent(
      { name: 'jornaleiro', who: 'O jornaleiro', preamble, stepFor: (tool) => `🔧 ${tool}` },
      'Escreva a edição de hoje do jornal da vila.',
      [],
      (e) => {
        if (e.type === 'answer') resolve(e.text);
        else if (e.type === 'error') reject(new Error(e.text));
      },
      hooksToIgnore,
    );
  });
}

export class Jornal {
  private gerando: Promise<void> | null = null;
  private erro: string | null = null;

  constructor(
    private world: () => Pick<World, 'projects' | 'sessions'>,
    private hooksToIgnore: Set<string>,
    private dir = path.join(os.homedir(), '.cache', 'dev-valley', 'jornal'),
    private escrever: (preamble: string) => Promise<string> = (p) => pedirAoJornaleiro(p, this.hooksToIgnore),
  ) {}

  private arquivo = (data: string) => path.join(this.dir, `${data}.json`);
  private lidoFile = () => path.join(this.dir, 'lido.json');
  private extraFile = () => path.join(this.dir, 'extra.json');

  private async lerJson<T>(file: string): Promise<T | null> {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return null;
    }
  }

  async edicaoDe(data: string): Promise<Edicao | null> {
    return this.lerJson<Edicao>(this.arquivo(data));
  }

  /** A edição mais recente que existe (a de hoje ou, antes das 6h, a de ontem). */
  async ultima(agora = Date.now()): Promise<Edicao | null> {
    return (await this.edicaoDe(dataLocal(agora))) ?? (await this.edicaoDe(dataLocal(agora - DIA)));
  }

  async view(agora = Date.now()): Promise<JornalView> {
    return { edicao: await this.ultima(agora), extra: await this.lerJson<Edicao>(this.extraFile()), gerando: !!this.gerando, erro: this.erro };
  }

  /** O usuário abriu o jornal: a próxima edição começa daqui (com piso de 24h). */
  async marcarLido(agora = Date.now()) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.lidoFile(), JSON.stringify({ em: agora }));
  }

  /** Chamado de tempos em tempos pela vila: imprime a edição do dia depois das 6h, se ainda não existe. */
  async garantirDoDia(agora = Date.now()) {
    if (new Date(agora).getHours() < 6 || (await this.edicaoDe(dataLocal(agora)))) return;
    await this.imprimir(agora);
  }

  /** Imprime a edição de hoje (substitui a que houver). Uma impressão por vez. */
  imprimir(agora = Date.now()): Promise<void> {
    this.gerando ??= this.montar(agora)
      .then(() => {
        this.erro = null;
      })
      .catch((err: Error) => {
        this.erro = err.message;
      })
      .finally(() => {
        this.gerando = null;
      });
    return this.gerando;
  }

  /** Edição do dia (sem `extra`) ou edição extra: outro período e, se pedido, um projeto só. */
  /**
   * Edição extra (conversa com o jornaleiro, 02/11/2026): desde uma data (no máximo 30 dias atrás) e, se pedido, só um
   * projeto. Não marca o jornal como lido nem troca a edição do dia. Projeto que não é da vila: `fora` (a rota dá 404);
   * outra edição sendo escrita: `ocupado` (409), para a página não mostrar a extra antiga como se fosse a nova.
   */
  imprimirExtra(opcoes: { desde: number; projectId?: string }, agora = Date.now()): 'ok' | 'fora' | 'ocupado' {
    if (opcoes.projectId && !this.world().projects.some((p) => p.id === opcoes.projectId)) return 'fora';
    if (this.gerando) return 'ocupado';
    const desde = Math.min(agora - HORA, Math.max(Number(opcoes.desde) || 0, agora - JANELA_CONVERSA));
    this.gerando ??= this.montar(agora, { desde, projectId: opcoes.projectId })
      .then(() => {
        this.erro = null;
      })
      .catch((err: Error) => {
        this.erro = err.message;
      })
      .finally(() => {
        this.gerando = null;
      });
    return 'ok';
  }

  /** O que o jornaleiro sabe na conversa: os commits dos últimos 30 dias de todos os projetos (sem hash, sem diff). */
  async pautaDaConversa(agora = Date.now()): Promise<string> {
    const desde = agora - JANELA_CONVERSA;
    const movimentos: Movimento[] = [];
    for (const p of this.world().projects) {
      if (!p.isGit) continue;
      const { voce, time } = await commitsDesde(p.path, desde, MAX_COMMITS_CONVERSA);
      if (voce.length || time.length) movimentos.push({ nome: p.name, voce, time });
    }
    return movimentos.length ? pauta(movimentos, desde) : 'Nenhum commit nos últimos 30 dias em nenhum projeto da vila.';
  }

  private async montar(agora: number, extra?: { desde: number; projectId?: string }) {
    const lido = extra ? null : await this.lerJson<{ em: number }>(this.lidoFile());
    const desde = extra ? extra.desde : desdeQuando(lido?.em ?? null, agora);
    const { sessions } = this.world();
    const projects = this.world().projects.filter((p) => !extra?.projectId || p.id === extra.projectId);
    const movimentos: Movimento[] = [];
    const semNovidade: string[] = [];
    const parados: Edicao['parados'] = [];
    for (const p of projects) {
      const ultimoCommit = p.isGit ? Number((await git(p.path, ['log', '-1', '--format=%ct']).catch(() => '')).trim()) * 1000 || 0 : 0;
      const ultimaConversa = Math.max(0, ...sessions.filter((s) => s.projectId === p.id).map((s) => s.lastActivity));
      const dias = Math.floor((agora - Math.max(ultimoCommit, ultimaConversa)) / DIA);
      if (Math.max(ultimoCommit, ultimaConversa) > 0 && dias >= PARADO_DIAS) parados.push({ nome: p.name, dias });
      const { voce, time } = p.isGit ? await commitsDesde(p.path, desde) : { voce: [], time: [] };
      if (voce.length || time.length) movimentos.push({ nome: p.name, voce, time });
      else semNovidade.push(p.name);
    }
    let manchete = 'Dia calmo na vila: nenhum projeto mudou.';
    let noticias: Noticia[] = [];
    if (movimentos.length) {
      const resposta = await this.escrever(pauta(movimentos, desde));
      const lida = lerResposta(resposta, movimentos.map((m) => m.nome));
      if (!lida) throw new Error('O jornaleiro devolveu um texto que a vila não entendeu. Tente imprimir de novo.');
      ({ manchete, noticias } = lida);
    }
    const edicao: Edicao = { data: dataLocal(agora), geradaEm: agora, desde, manchete, noticias, semNovidade, parados: parados.sort((a, b) => b.dias - a.dias) };
    if (extra) edicao.extra = true;
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(extra ? this.extraFile() : this.arquivo(edicao.data), JSON.stringify(edicao, null, 2));
  }
}

/** A edição do dia em texto corrido, para o contexto da conversa. */
function edicaoEmTexto(e: Edicao | null): string {
  if (!e) return 'A edição de hoje ainda não saiu.';
  const noticias = e.noticias.map((n) => [`- ${n.nome}: ${n.titulo}`, n.voce && `  Você: ${n.voce}`, n.time && `  O time: ${n.time}`].filter(Boolean).join('\n'));
  return [`Manchete: ${e.manchete}`, ...noticias, e.parados.length ? `Parados: ${e.parados.map((p) => `${p.nome} (${p.dias} dias)`).join(', ')}` : ''].filter(Boolean).join('\n');
}

/**
 * Conversa com o jornaleiro (02/11/2026): a vila monta o contexto (data, edição do dia e pauta de 30 dias) e pergunta ao
 * agente `jornaleiro-conversa`, sem ferramenta (`--tools ""`), pela base comum (`consulta.ts`, regra 5).
 */
export function askJornaleiro(
  question: string,
  history: Exchange[],
  jornal: Pick<Jornal, 'view' | 'pautaDaConversa'>,
  onEvent: (e: AgentEvent) => void,
  hooksToIgnore: Set<string>,
): () => void {
  let cancelado = false;
  let cancelar = () => {
    cancelado = true;
  };
  void Promise.all([jornal.view(), jornal.pautaDaConversa()])
    .then(([v, pautaTexto]) => {
      if (cancelado) return;
      const preamble = [
        `Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
        `## Edição de hoje da Gazeta do Vale\n\n${edicaoEmTexto(v.edicao)}`,
        `## Pauta dos últimos 30 dias\n\n${pautaTexto}`,
      ].join('\n\n');
      cancelar = askAgent({ name: 'jornaleiro-conversa', who: 'O jornaleiro', preamble, stepFor: (tool) => `🔧 ${tool}` }, question, history, onEvent, hooksToIgnore);
    })
    .catch((err: Error) => onEvent({ type: 'error', text: `O jornaleiro não conseguiu ler a pauta: ${err.message}` }));
  return () => cancelar();
}
