import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Config } from './config.js';
import { projectsDirs, type Perfil } from './perfil.js';
import type { Usage } from './statusline.js';
import type { Project } from './world.js';

/**
 * Moinho: quanto cada projeto gastou (decisões do usuário, 02/11/2026, "segue as recomendações"):
 *  - peso de cada resposta = entrada + saída + criação de cache + leitura de cache ÷ 10 (a proporção de preço da API).
 *    Não é custo em reais (o plano é assinatura): é o peso de um projeto em relação aos outros;
 *  - janela = a semana do plano (a mesma da torre do relógio); sem esse dado, os últimos 7 dias;
 *  - perfil pessoal (DeepSeek) em lista separada.
 *
 * Lê os `.jsonl` das conversas dos dois perfis (inclusive subagentes) de forma incremental: guarda por arquivo até onde
 * já leu e os totais por hora, em `~/.cache/dev-valley/gasto.json`. O Claude Code grava a mesma resposta em várias
 * linhas (uma por bloco), todas com o mesmo `usage`: conta cada `message.id` uma vez só.
 */

const HORA = 3600_000;
const SEMANA = 7 * 24 * HORA;
/** Quanto tempo o resumo calculado vale antes de ler os arquivos de novo. */
const VALIDADE = 2 * 60_000;

interface Arquivo {
  /** Até onde o arquivo já foi lido (bytes, sempre no fim de uma linha completa). */
  offset: number;
  sessionId: string;
  cwd: string | null;
  perfil: Perfil;
  /** Peso por hora: `2026-11-02T14` (UTC) → peso. */
  horas: Record<string, number>;
  /** Últimos ids de mensagem vistos (as repetições vêm em linhas seguidas). */
  ultimos: string[];
}

interface Cache {
  versao: 1;
  arquivos: Record<string, Arquivo>;
}

export interface GastoSessao {
  id: string;
  peso: number;
}

export interface GastoProjeto {
  /** null = sessões fora de qualquer projeto da vila (praça). */
  projectId: string | null;
  nome: string;
  peso: number;
  /** As 3 sessões que mais gastaram no projeto. */
  sessoes: GastoSessao[];
}

export interface GastoPerfil {
  perfil: Perfil;
  total: number;
  /** Total da janela anterior, do mesmo tamanho, para comparar ("o dobro da semana passada"). */
  anterior: number;
  projetos: GastoProjeto[];
}

export interface GastoView {
  janela: { inicio: number; fim: number; fonte: 'plano' | '7dias' };
  perfis: GastoPerfil[];
}

/** Peso de uma resposta: leitura de cache vale 1/10 (decisão do usuário, 02/11/2026). */
export function pesoDe(u: any): number {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return n(u?.input_tokens) + n(u?.output_tokens) + n(u?.cache_creation_input_tokens) + n(u?.cache_read_input_tokens) / 10;
}

/** Janela da semana do plano pelo `resetsAt` do limite semanal; sem ele, os últimos 7 dias. */
export function janelaDe(usage: Usage | null, agora = Date.now()): GastoView['janela'] {
  const semanal = usage?.rows.find((r) => r.kind === 'weekly_all' || r.kind === 'seven_day');
  const fim = semanal?.resetsAt ? Date.parse(semanal.resetsAt) : NaN;
  if (Number.isFinite(fim) && fim > agora && fim - agora <= SEMANA) return { inicio: fim - SEMANA, fim, fonte: 'plano' };
  return { inicio: agora - SEMANA, fim: agora, fonte: '7dias' };
}

async function jsonlDe(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await jsonlDe(full)));
    else if (e.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

/** Sessão dona do arquivo: `<id>.jsonl`, ou `<id>/subagents/<x>.jsonl` (subagente gasta na conta da sessão). */
function sessaoDoArquivo(file: string): string {
  const parts = file.split(path.sep);
  const i = parts.lastIndexOf('subagents');
  return i > 0 ? parts[i - 1]! : path.basename(file, '.jsonl');
}

function donoDe(cwd: string | null, projects: Project[]): Project | null {
  let best: Project | null = null;
  if (!cwd) return null;
  for (const p of projects)
    if ((cwd === p.path || cwd.startsWith(p.path + '/')) && (!best || p.path.length > best.path.length)) best = p;
  return best;
}

export class Gasto {
  private cache: Cache | null = null;
  private calculado: { em: number; chave: string; view: GastoView } | null = null;

  constructor(
    private config: Pick<Config, 'perfilPessoal'>,
    private projects: () => Project[],
    private cacheFile = path.join(os.homedir(), '.cache', 'dev-valley', 'gasto.json'),
    private dirs: () => { dir: string; perfil: Perfil }[] = () =>
      projectsDirs(this.config).map((dir, i) => ({ dir, perfil: i === 0 ? 'profissional' : 'pessoal' })),
  ) {}

  private async carregar(): Promise<Cache> {
    if (this.cache) return this.cache;
    try {
      const c = JSON.parse(await fs.readFile(this.cacheFile, 'utf8'));
      if (c?.versao === 1 && c.arquivos) return (this.cache = c);
    } catch {
      // sem cache: lê tudo do começo
    }
    return (this.cache = { versao: 1, arquivos: {} });
  }

  /** Lê o que cresceu em cada `.jsonl` desde a última passada. Devolve se algo mudou. */
  async atualizar(): Promise<boolean> {
    const cache = await this.carregar();
    let mudou = false;
    const vivos = new Set<string>();
    for (const { dir, perfil } of this.dirs()) {
      for (const file of await jsonlDe(dir)) {
        vivos.add(file);
        const st = await fs.stat(file).catch(() => null);
        if (!st) continue;
        let a = cache.arquivos[file];
        // Arquivo novo, ou menor do que já lemos (foi reescrito): começa do zero.
        if (!a || st.size < a.offset) a = cache.arquivos[file] = { offset: 0, sessionId: sessaoDoArquivo(file), cwd: null, perfil, horas: {}, ultimos: [] };
        if (st.size === a.offset) continue;
        const fh = await fs.open(file, 'r');
        try {
          const buf = Buffer.alloc(st.size - a.offset);
          await fh.read(buf, 0, buf.length, a.offset);
          const fimLinha = buf.lastIndexOf(0x0a);
          if (fimLinha < 0) continue; // linha ainda sendo escrita
          for (const line of buf.subarray(0, fimLinha).toString('utf8').split('\n')) {
            if (!line) continue;
            let e: any;
            try {
              e = JSON.parse(line);
            } catch {
              continue;
            }
            if (!a.cwd && typeof e.cwd === 'string') a.cwd = e.cwd;
            const u = e.type === 'assistant' ? e.message?.usage : null;
            if (!u || e.message?.model === '<synthetic>') continue;
            const id = String(e.message?.id ?? e.uuid ?? '');
            if (id && a.ultimos.includes(id)) continue;
            if (id) a.ultimos = [...a.ultimos.slice(-49), id];
            const t = Date.parse(e.timestamp);
            if (!Number.isFinite(t)) continue;
            const hora = new Date(t).toISOString().slice(0, 13);
            a.horas[hora] = (a.horas[hora] ?? 0) + pesoDe(u);
          }
          a.offset += fimLinha + 1;
          mudou = true;
        } finally {
          await fh.close();
        }
      }
    }
    // Conversa apagada (pelo Claude Code ou pela vila) sai do cache.
    for (const file of Object.keys(cache.arquivos))
      if (!vivos.has(file)) {
        delete cache.arquivos[file];
        mudou = true;
      }
    if (mudou) {
      await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
      await fs.writeFile(this.cacheFile, JSON.stringify(cache));
    }
    return mudou;
  }

  async resumo(usage: Usage | null, agora = Date.now()): Promise<GastoView> {
    const janela = janelaDe(usage, agora);
    const chave = `${janela.inicio}`;
    if (this.calculado && this.calculado.chave === chave && agora - this.calculado.em < VALIDADE) return this.calculado.view;
    await this.atualizar();
    const cache = await this.carregar();
    const projects = this.projects();
    const anteriorInicio = janela.inicio - SEMANA;
    const perfis = new Map<Perfil, { total: number; anterior: number; projetos: Map<string, GastoProjeto & { porSessao: Map<string, number> }> }>();
    for (const a of Object.values(cache.arquivos)) {
      let dentro = 0;
      let antes = 0;
      for (const [hora, peso] of Object.entries(a.horas)) {
        const t = Date.parse(`${hora}:00:00Z`);
        if (t >= janela.inicio && t < janela.fim) dentro += peso;
        else if (t >= anteriorInicio && t < janela.inicio) antes += peso;
      }
      if (!dentro && !antes) continue;
      const p = perfis.get(a.perfil) ?? { total: 0, anterior: 0, projetos: new Map() };
      perfis.set(a.perfil, p);
      p.total += dentro;
      p.anterior += antes;
      if (!dentro) continue;
      const dono = donoDe(a.cwd, projects);
      const key = dono?.id ?? '';
      const proj = p.projetos.get(key) ?? { projectId: dono?.id ?? null, nome: dono?.name ?? 'Praça (sessões avulsas)', peso: 0, sessoes: [], porSessao: new Map() };
      p.projetos.set(key, proj);
      proj.peso += dentro;
      proj.porSessao.set(a.sessionId, (proj.porSessao.get(a.sessionId) ?? 0) + dentro);
    }
    const ordem: Perfil[] = ['profissional', 'pessoal'];
    const view: GastoView = {
      janela,
      perfis: [...perfis]
        .sort(([a], [b]) => ordem.indexOf(a) - ordem.indexOf(b))
        .map(([perfil, p]) => ({
          perfil,
          total: Math.round(p.total),
          anterior: Math.round(p.anterior),
          projetos: [...p.projetos.values()]
            .map(({ porSessao, ...proj }) => ({
              ...proj,
              peso: Math.round(proj.peso),
              sessoes: [...porSessao]
                .sort((x, y) => y[1] - x[1])
                .slice(0, 3)
                .map(([id, peso]) => ({ id, peso: Math.round(peso) })),
            }))
            .sort((x, y) => y.peso - x.peso),
        })),
    };
    this.calculado = { em: agora, chave, view };
    return view;
  }
}
