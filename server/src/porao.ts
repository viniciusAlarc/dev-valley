import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MORADORES_DIR } from './moradores.js';
export { TETO_PADRAO } from './config.js';

/**
 * Porão da casa (MA-1, `docs-dev/a-codar/maestro.md`): onde o maestro coordena até 5 sessões em paralelo no projeto.
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
  /** Sessão do maestro que pediu. */
  maestro: string;
  rodada: string;
  tarefas: string[];
  criadoEm: number;
  estado: 'aguardando' | 'aprovado' | 'recusado';
  /** Depois de aprovado: tarefa → sessão aberta, ou o motivo de não ter aberto. */
  sessoes: Record<string, { sessionId: string } | { erro: string }>;
}

const NOME_RE = /^[\w.-]{1,80}$/;
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
  async pedir(entrada: { maestro: unknown; rodada: unknown; tarefas: unknown }, teto: number): Promise<PedidoPorao | { erro: string; status: number }> {
    const { maestro, rodada, tarefas } = entrada;
    const reg = await this.ler();
    if (typeof maestro !== 'string' || !reg.maestros[maestro]) return { erro: 'Só o maestro aberto no porão pede sessões.', status: 403 };
    if (typeof rodada !== 'string' || !NOME_RE.test(rodada)) return { erro: 'Rodada inválida.', status: 400 };
    if (!Array.isArray(tarefas) || !tarefas.length || tarefas.some((t) => typeof t !== 'string' || !NOME_RE.test(t)) || new Set(tarefas).size !== tarefas.length) {
      return { erro: 'Tarefas inválidas: lista de nomes únicos (letras, números, ponto, hífen).', status: 400 };
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
      projectId: reg.maestros[maestro]!.projeto,
      maestro,
      rodada,
      tarefas: tarefas as string[],
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
  async aprovar(id: string, abrir: (sessionId: string, prompt: string) => Promise<string | null>): Promise<PedidoPorao | null> {
    const pedido = this.pedidos.get(id);
    if (!pedido || pedido.estado !== 'aguardando') return null;
    pedido.estado = 'aprovado';
    for (const tarefa of pedido.tarefas) {
      const sessionId = randomUUID();
      const reg = await this.ler();
      reg.tarefas[sessionId] = { projeto: pedido.projectId, rodada: pedido.rodada, tarefa, criadoEm: new Date().toISOString() };
      await this.gravar(reg);
      const erro = await abrir(sessionId, promptDoBriefing(pedido.rodada, tarefa));
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

  recusar(id: string): PedidoPorao | null {
    const pedido = this.pedidos.get(id);
    if (!pedido || pedido.estado !== 'aguardando') return null;
    pedido.estado = 'recusado';
    return pedido;
  }
}
