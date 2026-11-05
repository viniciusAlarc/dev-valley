import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MORADORES_DIR } from './moradores.js';
export { TETO_PADRAO } from './config.js';

/**
 * Porão da casa (MA-1, `docs-dev/context/maestro.md`): onde o maestro coordena até 5 sessões em paralelo no projeto.
 * Quem mora no porão não aparece no mapa nem dentro da casa, só lá embaixo (decisão do usuário, 03/11/2026).
 *
 * Três jeitos de uma sessão ser do porão:
 * - **maestro**: aberto pelo clique no maestro ✦ do porão; a vila anota o id em `porao.json` (único escritor: a vila);
 * - **tarefa pela vila** (fase 3): o maestro pede as sessões, o usuário aprova no cartão do porão e a vila as abre já
 *   anotadas no `porao.json`;
 * - **tarefa aberta à mão**: o primeiro prompt é a frase fixa do briefing (`promptDoBriefing`); ela é lida do `.jsonl`,
 *   aqui na máquina, como o título.
 */

/** Nome do agente (`--agent`), instalado pelo `instalar.sh` do repositório de regras. */
export const MAESTRO = 'maestro';
export const PORAO_FILE = path.join(MORADORES_DIR, 'porao.json');
export const MAESTRO_AGENT_FILE = path.join(os.homedir(), '.claude', 'agents', `${MAESTRO}.md`);
/** Pasta das rodadas, escrita pelo maestro (`~/Documents/IA/claude/agents/maestro.md`). */
export const RODADAS_DIR = path.join(os.homedir(), '.claude', 'maestro', 'rodadas');

export type PapelNoPorao = { papel: 'maestro' } | { papel: 'tarefa'; rodada: string; tarefa: string };

/** Pedido do maestro para abrir sessões, esperando o clique do usuário no cartão do porão. */
export interface PedidoPorao {
  id: string;
  projectId: string;
  /** Pasta do projeto: base dos arquivos liberados em `permissoes`. */
  pasta: string;
  /** Sessão do maestro que pediu. */
  maestro: string;
  rodada: string;
  tarefas: string[];
  /**
   * O que cada sessão pode fazer sem pedir permissão (04/11/2026): editar só os arquivos da tarefa e rodar só os
   * comandos de teste. Aparece no cartão: o clique em "Abrir" aprova isso junto. Tarefa sem entrada aqui = sessão comum,
   * que pede permissão para tudo.
   */
  permissoes: Record<string, PermissoesDaTarefa>;
  criadoEm: number;
  estado: 'aguardando' | 'aprovado' | 'recusado';
  /** Depois de aprovado: tarefa → sessão aberta, ou o motivo de não ter aberto. */
  sessoes: Record<string, { sessionId: string } | { erro: string }>;
}

export interface PermissoesDaTarefa {
  /** Relativos à pasta do projeto, já conferidos (`validarPermissoes`). */
  arquivos: string[];
  /** Comandos de teste, cada um liberado com qualquer argumento a mais (`Bash(<comando>:*)`). */
  testes: string[];
}

const NOME_RE = /^[\w.-]{1,80}$/;
export const MAX_ARQUIVOS = 30;
export const MAX_TESTES = 5;
// Uma palavra por vez, sem nada que o shell interprete: nada de ; | & $ ` < > aspas, parêntese, curinga ou quebra de linha.
const COMANDO_RE = /^[\w./@=+:-]+( [\w./@=+:-]+)*$/;
/** Comando que nunca vira "teste": apaga, mexe no git, rede, privilégio, outro shell, banco, container. */
const NUNCA = new Set(['rm', 'rmdir', 'mv', 'cp', 'dd', 'chmod', 'chown', 'sudo', 'su', 'git', 'gh', 'curl', 'wget', 'ssh', 'scp', 'rsync', 'kill', 'pkill', 'killall', 'bash', 'sh', 'zsh', 'eval', 'exec', 'env', 'xargs', 'nohup', 'docker', 'psql', 'mysql', 'sqlite3', 'claude', 'tee', 'truncate', 'ln', 'find']);
/** Pastas e arquivos que nenhuma sessão de trabalho edita sozinha: dariam a ela mais permissão, ou mexem no git/segredo. */
const PROTEGIDO = (rel: string) => {
  const partes = rel.split(path.sep);
  return partes[0] === '.git' || partes[0] === '.claude' || partes.some((x) => x === '.git') || /^\.env/.test(path.basename(rel));
};

/**
 * Confere o que o maestro pede para uma tarefa: arquivos dentro do projeto (relativos, sem curinga, fora de `.git/`,
 * `.claude/` e `.env*`) e comandos de teste simples (sem nada que o shell interprete, nem comando da lista `NUNCA`).
 * Devolve as permissões limpas, ou o motivo da recusa.
 */
export function validarPermissoes(projeto: string, tarefa: string, arquivos: unknown, testes: unknown): PermissoesDaTarefa | string {
  if (!Array.isArray(arquivos) || !arquivos.length) return `${tarefa}: "arquivos" é a lista dos arquivos da tarefa (pelo menos um).`;
  if (arquivos.length > MAX_ARQUIVOS) return `${tarefa}: mais de ${MAX_ARQUIVOS} arquivos; divida a tarefa.`;
  const limpos: string[] = [];
  for (const a of arquivos) {
    if (typeof a !== 'string' || !a || a.length > 200 || /[*?[\]{}()\\\n]/.test(a) || path.isAbsolute(a)) return `${tarefa}: arquivo inválido: ${JSON.stringify(a)} (relativo ao projeto, sem curinga).`;
    const resolvido = path.resolve(projeto, a);
    if (!resolvido.startsWith(projeto + path.sep)) return `${tarefa}: arquivo fora do projeto: ${a}`;
    const rel = path.relative(projeto, resolvido);
    if (PROTEGIDO(rel)) return `${tarefa}: ${rel} não pode ser liberado (.git, .claude e .env ficam com o usuário).`;
    if (!limpos.includes(rel)) limpos.push(rel);
  }
  const lista = testes === undefined ? [] : testes;
  if (!Array.isArray(lista) || lista.length > MAX_TESTES) return `${tarefa}: "testes" é uma lista de até ${MAX_TESTES} comandos.`;
  const cmds: string[] = [];
  for (const t of lista) {
    const c = typeof t === 'string' ? t.trim() : '';
    if (!c || c.length > 120 || !COMANDO_RE.test(c)) return `${tarefa}: comando de teste inválido: ${JSON.stringify(t)} (só palavras, sem ; | & $ aspas nem curinga).`;
    const primeiro = path.basename(c.split(' ')[0]!);
    if (NUNCA.has(primeiro)) return `${tarefa}: "${primeiro}" não é comando de teste.`;
    if (!cmds.includes(c)) cmds.push(c);
  }
  return { arquivos: limpos, testes: cmds };
}

/**
 * Regras `--allowedTools` da sessão de trabalho: ler o briefing da rodada e o que o config libera (`porao.leitura`),
 * editar só os arquivos da tarefa (`Edit` cobre também o `Write`), rodar só os comandos de teste.
 */
export function regrasDaTarefa(projeto: string, rodadaDir: string, perm: PermissoesDaTarefa, leitura: string[] = []): string[] {
  const abs = (p: string) => `/${p}`; // `//caminho` = absoluto na sintaxe das regras do Claude Code
  return [
    `Read(${abs(path.join(rodadaDir, '**'))})`,
    ...leitura.map((l) => `Read(${abs(l)})`),
    ...perm.arquivos.map((a) => `Edit(${abs(path.join(projeto, a))})`),
    ...perm.testes.map((t) => `Bash(${t}:*)`),
  ];
}
const caminhoDoBriefing = (rodada: string, tarefa: string) => `~/.claude/maestro/rodadas/${rodada}/briefings/${tarefa}.md`;

/** A primeira mensagem da sessão de trabalho: a mesma frase que o maestro manda rodar à mão (etapa 5 do agente). */
export function promptDoBriefing(rodada: string, tarefa: string): string {
  return `Você trabalha sob o maestro. Leia e siga: ${caminhoDoBriefing(rodada, tarefa)}`;
}

// "Você trabalha sob o maestro. Leia e siga: ~/.claude/maestro/rodadas/<id>/briefings/<tarefa>.md"
const BRIEFING_RE = /^Você trabalha sob o maestro\. Leia e siga: \S*?\.claude\/maestro\/rodadas\/([\w.-]+)\/briefings\/([\w.-]+)\.md/;

/** Rodada e tarefa de uma sessão de trabalho, pelo primeiro prompt; null = não nasceu de briefing do maestro. */
export function briefingDe(primeiroPrompt: string | null): { rodada: string; tarefa: string } | null {
  const m = primeiroPrompt ? BRIEFING_RE.exec(primeiroPrompt.trim()) : null;
  return m ? { rodada: m[1]!, tarefa: m[2]! } : null;
}

interface Registro {
  maestros: Record<string, { projeto: string; criadoEm: string }>;
  tarefas: Record<string, { projeto: string; rodada: string; tarefa: string; criadoEm: string }>;
}

const objeto = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, any>) : {});

export class Porao {
  /** Pedidos ficam só na memória: reiniciar a vila encerra os terminais, e o maestro pede de novo. */
  private pedidos = new Map<string, PedidoPorao>();
  /**
   * Maestros que chamaram o usuário (04/11/2026): durante a rodada o clique no maestro abre o mirim; com o chamado, o
   * ❗ aparece nele e o clique abre a conversa com ele. Só na memória, como os pedidos: id → o motivo, numa linha.
   */
  private chamados = new Map<string, string>();

  constructor(
    private file = PORAO_FILE,
    private agentFile = MAESTRO_AGENT_FILE,
    private rodadasDir = RODADAS_DIR,
  ) {}

  private async ler(): Promise<Registro> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      return { maestros: objeto(raw?.maestros), tarefas: objeto(raw?.tarefas) };
    } catch {
      return { maestros: {}, tarefas: {} };
    }
  }

  private async gravar(reg: Registro): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(reg, null, 2) + '\n');
    await fs.rename(tmp, this.file);
  }

  /** Ids das sessões de maestro abertas pela vila. */
  async maestros(): Promise<Set<string>> {
    return new Set(Object.keys((await this.ler()).maestros));
  }

  /** Papel de cada sessão anotada no porão (maestro ou tarefa aberta pela vila). */
  async papeis(): Promise<Map<string, PapelNoPorao>> {
    const reg = await this.ler();
    const out = new Map<string, PapelNoPorao>();
    for (const [id, t] of Object.entries(reg.tarefas)) out.set(id, { papel: 'tarefa', rodada: String(t.rodada), tarefa: String(t.tarefa) });
    for (const id of Object.keys(reg.maestros)) out.set(id, { papel: 'maestro' });
    return out;
  }

  async registrarMaestro(sessionId: string, projeto: string): Promise<void> {
    const reg = await this.ler();
    reg.maestros[sessionId] = { projeto, criadoEm: new Date().toISOString() };
    await this.gravar(reg);
  }

  /** Sem o agente instalado, o `--agent maestro` abriria uma sessão comum: melhor recusar e dizer como instalar. */
  async maestroInstalado(): Promise<boolean> {
    try {
      await fs.access(this.agentFile);
      return true;
    } catch {
      return false;
    }
  }

  /** O maestro chama o usuário (`curl`): só a sessão de maestro anotada aqui. */
  async chamar(maestro: unknown, motivo: unknown): Promise<boolean> {
    if (typeof maestro !== 'string' || !(await this.ler()).maestros[maestro]) return false;
    this.chamados.set(maestro, typeof motivo === 'string' ? motivo.replace(/\s+/g, ' ').trim().slice(0, 200) : '');
    return true;
  }

  /** O usuário abriu a conversa com o maestro: o chamado foi atendido. */
  atender(maestro: string): void {
    this.chamados.delete(maestro);
  }

  chamadosAbertos(): Record<string, string> {
    return Object.fromEntries(this.chamados);
  }

  /** Pedidos esperando o clique do usuário (o cartão no porão). */
  pedidosAbertos(): PedidoPorao[] {
    return [...this.pedidos.values()].filter((p) => p.estado === 'aguardando');
  }

  pedido(id: string): PedidoPorao | undefined {
    return this.pedidos.get(id);
  }

  /**
   * O maestro pede sessões para tarefas de uma rodada. Só a sessão de maestro anotada aqui pede, e para o projeto dela;
   * cada tarefa precisa do briefing já escrito; o teto conta as sessões que a rodada já tem mais as pedidas.
   */
  async pedir(entrada: { maestro: unknown; rodada: unknown; tarefas: unknown }, teto: number, pasta: string): Promise<PedidoPorao | { erro: string; status: number }> {
    const { maestro, rodada } = entrada;
    const reg = await this.ler();
    if (typeof maestro !== 'string' || !reg.maestros[maestro]) return { erro: 'Só o maestro aberto no porão pede sessões.', status: 403 };
    if (typeof rodada !== 'string' || !NOME_RE.test(rodada)) return { erro: 'Rodada inválida.', status: 400 };
    // Cada tarefa: o nome (sessão comum, pede permissão para tudo) ou { id, arquivos, testes } (04/11/2026).
    const lista = Array.isArray(entrada.tarefas) ? (entrada.tarefas as unknown[]) : [];
    const tarefas = lista.map((t) => (typeof t === 'string' ? t : objeto(t).id));
    if (!tarefas.length || tarefas.some((t) => typeof t !== 'string' || !NOME_RE.test(t)) || new Set(tarefas).size !== tarefas.length) {
      return { erro: 'Tarefas inválidas: lista de nomes únicos (letras, números, ponto, hífen), ou de { id, arquivos, testes }.', status: 400 };
    }
    const projeto = reg.maestros[maestro]!.projeto;
    if (!path.isAbsolute(pasta)) return { erro: 'Pasta do projeto inválida.', status: 400 };
    const permissoes: Record<string, PermissoesDaTarefa> = {};
    for (const t of lista) {
      if (typeof t === 'string') continue;
      const o = objeto(t);
      const p = validarPermissoes(pasta, o.id, o.arquivos, o.testes);
      if (typeof p === 'string') return { erro: p, status: 400 };
      permissoes[o.id] = p;
    }
    const jaTem = Object.values(reg.tarefas).filter((t) => t.rodada === rodada).length;
    const pedidas = this.pedidosAbertos().filter((p) => p.rodada === rodada).reduce((n, p) => n + p.tarefas.length, 0);
    if (jaTem + pedidas + tarefas.length > teto) {
      return { erro: `Passa do teto de ${teto} sessões por rodada (a rodada já tem ${jaTem} e ${pedidas} pedida(s)).`, status: 409 };
    }
    for (const t of tarefas as string[]) {
      try {
        await fs.access(path.join(this.rodadasDir, rodada, 'briefings', `${t}.md`));
      } catch {
        return { erro: `Falta o briefing ${caminhoDoBriefing(rodada, t)}.`, status: 400 };
      }
    }
    const pedido: PedidoPorao = {
      id: randomUUID(),
      projectId: projeto,
      pasta,
      maestro,
      rodada,
      tarefas: tarefas as string[],
      permissoes,
      criadoEm: Date.now(),
      estado: 'aguardando',
      sessoes: {},
    };
    this.pedidos.set(pedido.id, pedido);
    return pedido;
  }

  /**
   * Clique em "Abrir" no cartão: uma sessão por tarefa, anotada no porão **antes** de abrir (para nunca aparecer na
   * casa). `abrir` devolve o motivo quando não abre (ex.: perfil pessoal sem configuração).
   */
  async aprovar(id: string, abrir: (sessionId: string, prompt: string, permitir: string[]) => Promise<string | null>, leitura: string[] = []): Promise<PedidoPorao | null> {
    const pedido = this.pedidos.get(id);
    if (!pedido || pedido.estado !== 'aguardando') return null;
    pedido.estado = 'aprovado';
    for (const tarefa of pedido.tarefas) {
      const sessionId = randomUUID();
      const reg = await this.ler();
      reg.tarefas[sessionId] = { projeto: pedido.projectId, rodada: pedido.rodada, tarefa, criadoEm: new Date().toISOString() };
      await this.gravar(reg);
      const perm = pedido.permissoes[tarefa];
      const permitir = perm ? regrasDaTarefa(pedido.pasta, path.join(this.rodadasDir, pedido.rodada), perm, leitura) : [];
      const erro = await abrir(sessionId, promptDoBriefing(pedido.rodada, tarefa), permitir);
      pedido.sessoes[tarefa] = erro ? { erro } : { sessionId };
      if (erro) {
        // Não abriu: tira a anotação, para a vaga não ficar presa no teto.
        const depois = await this.ler();
        delete depois.tarefas[sessionId];
        await this.gravar(depois);
      }
    }
    return pedido;
  }

  /**
   * "Encerrar rodada" (fase 4): depois que as conversas foram apagadas, tira os ids do registro e dá como recusado o
   * pedido do projeto que ainda esperava o cartão.
   */
  async esquecer(projectId: string, ids: string[]): Promise<void> {
    const reg = await this.ler();
    for (const id of ids) {
      delete reg.maestros[id];
      delete reg.tarefas[id];
      this.chamados.delete(id);
    }
    await this.gravar(reg);
    for (const p of this.pedidosAbertos()) if (p.projectId === projectId) p.estado = 'recusado';
  }

  recusar(id: string): PedidoPorao | null {
    const pedido = this.pedidos.get(id);
    if (!pedido || pedido.estado !== 'aguardando') return null;
    pedido.estado = 'recusado';
    return pedido;
  }
}
