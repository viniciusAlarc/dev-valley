import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { comandosDoGate, executarComando, GATE_LIMITE_MS, resultadoDoGate, saidaDoGate, type ExecutarComando, type MomentoDoGate, type ResultadoDoComando } from './gate.js';
import type { CriticaDoCartao } from './critico.js';
import { tokensDaConversa } from './gasto.js';
import { MORADORES_DIR } from './moradores.js';
import {
  devolutivaDe,
  estadoDoGate,
  gravarRodada,
  HOOK_SCRIPT,
  lerDevolutiva,
  lerRodada,
  montarRelatorio,
  caminhoDoRelatorio,
  mexeuEmTela,
  settingsDaTarefa,
  MODELO_DAS_SESSOES,
  gravarScriptDeTestes,
  testarDaRodada,
  travaDosTestes,
  validarDependencias,
  type Devolutiva,
  type Rodada,
  type RodadaNoMundo,
} from './rodada.js';
import { SIMULTANEAS_PADRAO } from './config.js';
export { SIMULTANEAS_PADRAO, TETO_PADRAO } from './config.js';

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
  /** Tarefa → as que precisam ficar prontas antes de ela abrir (maestro v2, fase 3). Sem entrada = abre no clique. */
  dependencias: Record<string, string[]>;
  /** Estimativa do maestro para fazer tudo numa sessão só, em minutos (maestro v3, medição). Vai para o `rodada.json`. */
  estimativaSessaoUnicaMin?: number;
  /**
   * Pedido da sessão do roteiro de testes (05/11/2026): o relatório da rodada, relativo ao projeto. A sessão nasce na
   * **casa**, como morador comum: fora do teto, sobrevive ao gongo e não segue o contrato "Sob o maestro".
   */
  roteiro?: string;
  criadoEm: number;
  estado: 'aguardando' | 'aprovado' | 'recusado';
  /** Depois de aprovado: tarefa → sessão aberta, ou o motivo de não ter aberto. */
  sessoes: Record<string, { sessionId: string } | { erro: string }>;
  /** Segunda opinião do crítico do cartão (21/11/2026, `critico.ts`): só avisa, nunca bloqueia o clique. */
  critica?: CriticaDoCartao;
  /** Quantas sessões da rodada abrem ao mesmo tempo (P3, 25/11/2026): o cartão avisa das ondas. */
  simultaneas?: number;
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
 * editar só os arquivos da tarefa (`Edit` cobre também o `Write`), rodar só os comandos de teste. Com a tarefa, também
 * gravar a própria devolutiva (maestro v2: é ela que avisa a vila que a tarefa acabou).
 */
export function regrasDaTarefa(projeto: string, rodadaDir: string, perm: PermissoesDaTarefa, leitura: string[] = [], tarefa?: string): string[] {
  const abs = (p: string) => `/${p}`; // `//caminho` = absoluto na sintaxe das regras do Claude Code
  return [
    `Read(${abs(path.join(rodadaDir, '**'))})`,
    ...leitura.map((l) => `Read(${abs(l)})`),
    ...perm.arquivos.map((a) => `Edit(${abs(path.join(projeto, a))})`),
    ...(tarefa ? [`Edit(${abs(devolutivaDe(rodadaDir, tarefa))})`] : []),
    ...perm.testes.map((t) => `Bash(${t}:*)`),
    // A suíte crua roda pela fila da rodada (P2, 25/11/2026); o hook recusa o comando cru e aponta para cá.
    ...(perm.testes.length ? [`Bash(bash ${testarDaRodada(rodadaDir)}:*)`] : []),
  ];
}

/** Abre o terminal da sessão; devolve o motivo quando não abre. `settings` = o `--settings` com os hooks da tarefa. */
export type AbrirSessao = (sessionId: string, prompt: string, permitir: string[], settings?: string) => Promise<string | null>;

/** O que a vila sabe agora de cada sessão (do mundo), para decidir se a tarefa ficou pronta ou parou. */
export interface SessaoAgora {
  id: string;
  live: boolean;
  status: 'working' | 'permission' | 'idle' | null;
  name?: string;
  /** `.jsonl` da conversa: de onde saem os tokens da tarefa quando ela fica pronta (maestro v3). */
  file?: string | null;
}
const caminhoDoBriefing = (rodada: string, tarefa: string) => `~/.claude/maestro/rodadas/${rodada}/briefings/${tarefa}.md`;

/** A primeira mensagem da sessão de trabalho: a mesma frase que o maestro manda rodar à mão (etapa 5 do agente). */
export function promptDoBriefing(rodada: string, tarefa: string): string {
  return `Você trabalha sob o maestro. Leia e siga: ${caminhoDoBriefing(rodada, tarefa)}`;
}

/** Tarefa do pedido do roteiro: um só por pedido, com este nome no cartão. */
export const TAREFA_ROTEIRO = 'roteiro';
/** Relatório da rodada, onde o maestro grava (`docs-dev/maestro/AAAA-MM-DD-<assunto>.md`). */
const RELATORIO_RE = /^docs-dev\/maestro\/[\w.-]+\.md$/;

/** A primeira mensagem da sessão do roteiro: a skill do repositório de regras, com o relatório da rodada. */
export function promptDoRoteiro(relatorio: string): string {
  return `/roteiro-testes ${relatorio}`;
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

/** Caminho com `~` no lugar da pasta pessoal: é o que vai no relatório, dentro do projeto. */
const comTil = (p: string) => (p.startsWith(os.homedir() + path.sep) ? `~${p.slice(os.homedir().length)}` : p);

const objeto = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, any>) : {});

export class Porao {
  /** Pedidos ficam só na memória: reiniciar a vila encerra os terminais, e o maestro pede de novo. */
  private pedidos = new Map<string, PedidoPorao>();
  /**
   * Maestros que chamaram o usuário (04/11/2026): durante a rodada o clique no maestro abre o mirim; com o chamado, o
   * ❗ aparece nele e o clique abre a conversa com ele. Só na memória, como os pedidos: id → o motivo, numa linha.
   */
  private chamados = new Map<string, string>();
  /** Última volta do `avancar` (quadro do porão no mundo). */
  private noMundo: RodadaNoMundo[] = [];
  private trava: Promise<void> = Promise.resolve();
  private ocupada = false;
  /** Gates rodando agora (`<pasta da rodada>:<antes|depois>`): a volta seguinte não dispara outro (maestro v3). */
  private gates = new Map<string, Promise<void>>();
  /**
   * Sessões de uma rodada abertas ao mesmo tempo (modo início de sprint, P3, 25/11/2026; `porao.simultaneas` do config,
   * padrão 3): 4 juntas esgotaram o limite do plano na rodada de 19/11. A tarefa livre que passa disso espera a vaga.
   */
  simultaneas = SIMULTANEAS_PADRAO;

  constructor(
    private file = PORAO_FILE,
    private agentFile = MAESTRO_AGENT_FILE,
    private rodadasDir = RODADAS_DIR,
    private hookScript = HOOK_SCRIPT,
    private executar: ExecutarComando = executarComando,
    private limiteDoGate = GATE_LIMITE_MS,
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
  async pedir(entrada: { maestro: unknown; rodada: unknown; tarefas: unknown; estimativaSessaoUnicaMin?: unknown }, teto: number, pasta: string): Promise<PedidoPorao | { erro: string; status: number }> {
    const { maestro, rodada, estimativaSessaoUnicaMin: est } = entrada;
    const reg = await this.ler();
    if (typeof maestro !== 'string' || !reg.maestros[maestro]) return { erro: 'Só o maestro aberto no porão pede sessões.', status: 403 };
    if (typeof rodada !== 'string' || !NOME_RE.test(rodada)) return { erro: 'Rodada inválida.', status: 400 };
    // Opcional na rota (o agente sempre manda): minutos, número positivo.
    if (est !== undefined && (typeof est !== 'number' || !Number.isFinite(est) || est <= 0 || est > 100_000)) {
      return { erro: '"estimativaSessaoUnicaMin" é a estimativa em minutos para fazer tudo numa sessão só (número positivo).', status: 400 };
    }
    // Cada tarefa: o nome (sessão comum, pede permissão para tudo) ou { id, arquivos, testes } (04/11/2026).
    const lista = Array.isArray(entrada.tarefas) ? (entrada.tarefas as unknown[]) : [];
    const tarefas = lista.map((t) => (typeof t === 'string' ? t : objeto(t).id));
    if (!tarefas.length || tarefas.some((t) => typeof t !== 'string' || !NOME_RE.test(t)) || new Set(tarefas).size !== tarefas.length) {
      return { erro: 'Tarefas inválidas: lista de nomes únicos (letras, números, ponto, hífen), ou de { id, arquivos, testes }.', status: 400 };
    }
    const projeto = reg.maestros[maestro]!.projeto;
    if (!path.isAbsolute(pasta)) return { erro: 'Pasta do projeto inválida.', status: 400 };
    const permissoes: Record<string, PermissoesDaTarefa> = {};
    const dependencias: Record<string, string[]> = Object.fromEntries((tarefas as string[]).map((t) => [t, []]));
    for (const t of lista) {
      if (typeof t === 'string') continue;
      const o = objeto(t);
      const p = validarPermissoes(pasta, o.id, o.arquivos, o.testes);
      if (typeof p === 'string') return { erro: p, status: 400 };
      permissoes[o.id] = p;
      if (o.dependeDe !== undefined) {
        if (!Array.isArray(o.dependeDe) || o.dependeDe.some((d: unknown) => typeof d !== 'string')) return { erro: `${o.id}: "dependeDe" é a lista das tarefas que ela espera.`, status: 400 };
        dependencias[o.id] = [...new Set(o.dependeDe as string[])];
      }
    }
    const errDep = validarDependencias(dependencias);
    if (errDep) return { erro: errDep, status: 400 };
    // Já tem: as tarefas que a rodada já aprovou (abertas ou esperando a vez), ou, rodada antiga, as anotadas no porão.
    const salva = await lerRodada(path.join(this.rodadasDir, rodada));
    const repetida = (tarefas as string[]).find((t) => salva?.tarefas[t]);
    if (repetida) return { erro: `${repetida} já está na rodada ${rodada}: uma sessão por tarefa.`, status: 409 };
    const jaTem = salva ? Object.keys(salva.tarefas).length : Object.values(reg.tarefas).filter((t) => t.rodada === rodada).length;
    const pedidas = this.pedidosAbertos().filter((p) => p.rodada === rodada && !p.roteiro).reduce((n, p) => n + p.tarefas.length, 0);
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
      dependencias,
      ...(typeof est === 'number' ? { estimativaSessaoUnicaMin: est } : {}),
      criadoEm: Date.now(),
      estado: 'aguardando',
      sessoes: {},
      simultaneas: this.simultaneas,
    };
    this.pedidos.set(pedido.id, pedido);
    return pedido;
  }

  /**
   * Fim da rodada que mexeu em tela (05/11/2026): o maestro pede a sessão que monta o roteiro de testes. Só o maestro
   * anotado pede, com o relatório já gravado em `docs-dev/maestro/`; um pedido por rodada (o recusado libera outro).
   * Não conta no teto: a sessão nasce na casa, não no porão.
   */
  async pedirRoteiro(entrada: { maestro: unknown; rodada: unknown; relatorio: unknown }, pasta: string): Promise<PedidoPorao | { erro: string; status: number }> {
    const { maestro, rodada, relatorio } = entrada;
    const reg = await this.ler();
    if (typeof maestro !== 'string' || !reg.maestros[maestro]) return { erro: 'Só o maestro aberto no porão pede sessões.', status: 403 };
    if (typeof rodada !== 'string' || !NOME_RE.test(rodada)) return { erro: 'Rodada inválida.', status: 400 };
    if (typeof relatorio !== 'string' || !RELATORIO_RE.test(relatorio)) {
      return { erro: 'Relatório inválido: o caminho relativo ao projeto, docs-dev/maestro/<arquivo>.md.', status: 400 };
    }
    if (!path.isAbsolute(pasta)) return { erro: 'Pasta do projeto inválida.', status: 400 };
    try {
      await fs.access(path.join(pasta, relatorio));
    } catch {
      return { erro: `O relatório ${relatorio} não existe: escreva o relatório antes de pedir o roteiro.`, status: 400 };
    }
    if ([...this.pedidos.values()].some((p) => p.roteiro && p.rodada === rodada && p.estado !== 'recusado')) {
      return { erro: `A rodada ${rodada} já tem o pedido do roteiro.`, status: 409 };
    }
    const pedido: PedidoPorao = {
      id: randomUUID(),
      projectId: reg.maestros[maestro]!.projeto,
      pasta,
      maestro,
      rodada,
      tarefas: [TAREFA_ROTEIRO],
      permissoes: {},
      dependencias: {},
      roteiro: relatorio,
      criadoEm: Date.now(),
      estado: 'aguardando',
      sessoes: {},
    };
    this.pedidos.set(pedido.id, pedido);
    return pedido;
  }

  /**
   * Clique em "Abrir" no cartão. Pedido de tarefas (maestro v2): grava o `rodada.json` com todas as tarefas do pedido e
   * abre as que não dependem de ninguém; as outras abrem sozinhas quando as donas ficarem prontas (`avancar`), porque o
   * cartão já as listou e o clique aprovou a rodada inteira (D2, 11/11/2026). O pedido do roteiro abre uma sessão comum,
   * sem anotação nem regra: ela nasce na casa.
   */
  async aprovar(id: string, abrir: AbrirSessao, leitura: string[] = []): Promise<PedidoPorao | null> {
    const pedido = this.pedidos.get(id);
    if (!pedido || pedido.estado !== 'aguardando') return null;
    pedido.estado = 'aprovado';
    // Mesma trava da volta automática: as duas juntas abriam cada tarefa livre duas vezes (11/11/2026).
    return this.comTrava(() => this.aprovarComTrava(pedido, abrir, leitura));
  }

  private async aprovarComTrava(pedido: PedidoPorao, abrir: AbrirSessao, leitura: string[]): Promise<PedidoPorao> {
    if (pedido.roteiro) {
      const sessionId = randomUUID();
      // Só o modelo: a sessão do roteiro nasce na casa, sem hooks nem regra da rodada.
      const erro = await abrir(sessionId, promptDoRoteiro(pedido.roteiro), [], JSON.stringify({ model: MODELO_DAS_SESSOES }));
      pedido.sessoes[TAREFA_ROTEIRO] = erro ? { erro } : { sessionId };
      return pedido;
    }
    const dir = path.join(this.rodadasDir, pedido.rodada);
    const rodada: Rodada = (await lerRodada(dir)) ?? {
      versao: 2,
      rodada: pedido.rodada,
      projectId: pedido.projectId,
      pasta: pedido.pasta,
      aprovadaEm: Date.now(),
      tarefas: {},
    };
    const novas = pedido.tarefas.filter((t) => !rodada.tarefas[t]);
    for (const t of novas) {
      const perm = pedido.permissoes[t];
      rodada.tarefas[t] = { arquivos: perm?.arquivos ?? [], testes: perm?.testes ?? [], dependeDe: pedido.dependencias?.[t] ?? [], estado: 'esperando' };
    }
    if (pedido.estimativaSessaoUnicaMin !== undefined) rodada.estimativaSessaoUnicaMin ??= pedido.estimativaSessaoUnicaMin;
    // Gate (maestro v3): os comandos de teste do cartão. Primeiro pedido com comandos = linha de base antes de abrir;
    // pedido seguinte na mesma rodada só soma comandos (esses ficam sem linha de base).
    const comandos = comandosDoGate([rodada.gate?.comandos ?? [], ...novas.map((t) => rodada.tarefas[t]!.testes)]);
    if (comandos.length && !rodada.gate) rodada.gate = { comandos, linhaDeBase: { inicio: Date.now() } };
    else if (rodada.gate) rodada.gate.comandos = comandos;
    await gravarRodada(dir, rodada);
    await gravarScriptDeTestes(rodada, dir);
    // Conferindo a linha de base: o clique responde já, e as tarefas livres abrem na volta em que ela terminar.
    if (estadoDoGate(rodada.gate) === 'linha-de-base') {
      this.lancarGate(dir, rodada, 'antes');
      return pedido;
    }
    for (const t of novas) {
      if (rodada.tarefas[t]!.dependeDe.length) continue;
      if (!this.temVaga(rodada)) break; // a próxima onda abre na volta automática
      pedido.sessoes[t] = await this.abrirTarefa(rodada, t, abrir, leitura);
    }
    return pedido;
  }

  /**
   * Uma coisa por vez entre o clique em "Abrir" e a volta automática: as duas leem e gravam o `rodada.json` e abrem
   * terminais, e juntas abriam a mesma tarefa duas vezes (rodada de 11/11/2026: 5 tarefas viraram mais de 5 sessões).
   */
  private async comTrava<T>(fn: () => Promise<T>): Promise<T> {
    const antes = this.trava;
    let soltar!: () => void;
    this.trava = new Promise<void>((r) => (soltar = r));
    await antes;
    this.ocupada = true;
    try {
      return await fn();
    } finally {
      this.ocupada = false;
      soltar();
    }
  }

  /** Menos de `simultaneas` sessões abertas ou abrindo na rodada (P3). */
  private temVaga(r: Rodada): boolean {
    return Object.values(r.tarefas).filter((t) => t.estado === 'aberta' || t.estado === 'abrindo').length < this.simultaneas;
  }

  /**
   * Abre a sessão de uma tarefa da rodada: anotada no `porao.json` **antes** do terminal (para nunca aparecer na casa),
   * com as regras e os hooks dela, e o estado gravado no `rodada.json`. A que não abre sai do registro, para a vaga não
   * ficar presa no teto.
   */
  private async abrirTarefa(rodada: Rodada, tarefa: string, abrir: AbrirSessao, leitura: string[]): Promise<{ sessionId: string } | { erro: string }> {
    const dir = path.join(this.rodadasDir, rodada.rodada);
    const t = rodada.tarefas[tarefa]!;
    // Uma sessão por tarefa: só abre quem ainda espera. Reservada (`abrindo`) e gravada antes do terminal subir.
    if (t.estado !== 'esperando') return { erro: `${tarefa} já está ${t.estado}.` };
    const sessionId = randomUUID();
    Object.assign(t, { estado: 'abrindo', sessionId });
    await gravarRodada(dir, rodada);
    const reg = await this.ler();
    reg.tarefas[sessionId] = { projeto: rodada.projectId, rodada: rodada.rodada, tarefa, criadoEm: new Date().toISOString() };
    await this.gravar(reg);
    const temPermissao = t.arquivos.length > 0;
    const permitir = temPermissao ? regrasDaTarefa(rodada.pasta, dir, { arquivos: t.arquivos, testes: t.testes }, leitura, tarefa) : [];
    const erro = await abrir(sessionId, promptDoBriefing(rodada.rodada, tarefa), permitir, settingsDaTarefa(dir, tarefa, this.hookScript));
    if (erro) {
      const depois = await this.ler();
      delete depois.tarefas[sessionId];
      await this.gravar(depois);
      Object.assign(t, { estado: 'erro', erro, sessionId: undefined });
    } else {
      Object.assign(t, { estado: 'aberta', sessionId, abertaEm: Date.now() });
    }
    await gravarRodada(dir, rodada);
    return erro ? { erro } : { sessionId };
  }

  /** Rodadas v2 ainda não encerradas pelo gongo, lidas do disco. */
  private async rodadasVivas(): Promise<{ dir: string; r: Rodada }[]> {
    let nomes: string[];
    try {
      nomes = await fs.readdir(this.rodadasDir);
    } catch {
      return [];
    }
    const out: { dir: string; r: Rodada }[] = [];
    for (const n of nomes) {
      const dir = path.join(this.rodadasDir, n);
      const r = await lerRodada(dir);
      if (r && !r.encerradaEm) out.push({ dir, r });
    }
    return out;
  }

  /**
   * A vila conduz a rodada (maestro v2), a cada volta do `refreshWorld`:
   * 1. tarefa aberta com a devolutiva gravada e a sessão parada (ou fechada) = pronta;
   * 2. tarefa esperando com todas as donas prontas = abre;
   * 3. nada mais aberto nem para abrir = relatório montado pela vila e, se alguma mexeu em tela, o cartão do roteiro.
   * Devolve true se mudou algo. Uma volta por vez: duas juntas abririam a mesma tarefa duas vezes.
   */
  async avancar(sessoes: SessaoAgora[], abrirNo: (projectId: string) => AbrirSessao, leitura: string[] = []): Promise<boolean> {
    // Ocupada (clique abrindo ou outra volta): esta volta fica para a próxima, sem empilhar.
    if (this.ocupada) return false;
    return this.comTrava(() => this.avancarUmaVez(sessoes, abrirNo, leitura));
  }

  private async avancarUmaVez(sessoes: SessaoAgora[], abrirNo: (projectId: string) => AbrirSessao, leitura: string[]): Promise<boolean> {
    const porId = new Map(sessoes.map((s) => [s.id, s]));
    const parada = (id: string | undefined) => {
      const s = id ? porId.get(id) : undefined;
      return !s || !s.live || s.status === 'idle';
    };
    let mudou = false;
    const noMundo: RodadaNoMundo[] = [];
    for (const { dir, r } of await this.rodadasVivas()) {
      let gravar = false;
      const devolutivas: Record<string, Devolutiva | null> = {};
      for (const [id, t] of Object.entries(r.tarefas)) {
        // Sob a trava ninguém está abrindo: `abrindo` aqui é resto de uma vila que caiu no meio. Com sessão, segue
        // aberta (o terminal pode ter subido); sem, volta a esperar. Nunca abre de novo por cima.
        if (t.estado === 'abrindo') {
          Object.assign(t, t.sessionId ? { estado: 'aberta', abertaEm: t.abertaEm ?? Date.now() } : { estado: 'esperando' });
          gravar = true;
        }
        devolutivas[id] = await lerDevolutiva(devolutivaDe(dir, id));
        if (t.estado === 'aberta' && devolutivas[id] && parada(t.sessionId)) {
          // Medição (maestro v3): os tokens da conversa, só números, lidos do `.jsonl` uma vez, ao ficar pronta.
          const arquivo = t.sessionId ? porId.get(t.sessionId)?.file : null;
          const tokens = arquivo ? await tokensDaConversa(arquivo) : null;
          Object.assign(t, { estado: 'pronta', prontaEm: Date.now() }, tokens ? { tokens } : {});
          gravar = true;
        }
      }
      if (gravar) await gravarRodada(dir, r);
      const linhaDeBase = estadoDoGate(r.gate) === 'linha-de-base';
      // Linha de base rodando (ou interrompida por uma vila que caiu): nenhuma tarefa abre antes de ela terminar.
      if (linhaDeBase) this.lancarGate(dir, r, 'antes');
      for (const [id, t] of Object.entries(r.tarefas)) {
        if (linhaDeBase) break;
        if (t.estado !== 'esperando' || !t.dependeDe.every((d) => r.tarefas[d]?.estado === 'pronta')) continue;
        if (!this.temVaga(r)) break; // ondas (P3): espera a próxima volta, como quem espera dependência
        await this.abrirTarefa(r, id, abrirNo(r.projectId), leitura);
        gravar = true;
      }
      const tarefas = Object.values(r.tarefas);
      const podeAbrir = (t: (typeof tarefas)[number]) => t.estado === 'esperando' && t.dependeDe.every((d) => r.tarefas[d]?.estado === 'pronta');
      if (!r.relatorio && tarefas.some((t) => t.estado === 'pronta') && !tarefas.some((t) => t.estado === 'aberta' || podeAbrir(t))) {
        if (r.gate?.comandos.length && !r.gate.final?.fim) {
          // Todas prontas: antes do relatório, o gate final (fora da trava; o resultado volta numa volta seguinte).
          if (!r.gate.final) {
            r.gate.final = { inicio: Date.now() };
            await gravarRodada(dir, r);
            gravar = true;
          }
          this.lancarGate(dir, r, 'depois');
        } else {
          const rel = await caminhoDoRelatorio(r);
          const nomeDe = (id: string) => porId.get(id)?.name || id.slice(0, 8);
          await fs.mkdir(path.dirname(path.join(r.pasta, rel)), { recursive: true });
          await fs.writeFile(path.join(r.pasta, rel), montarRelatorio(r, devolutivas, nomeDe, comTil(dir)));
          r.relatorio = rel;
          await gravarRodada(dir, r);
          if (Object.keys(r.tarefas).some((t) => mexeuEmTela(devolutivas[t] ?? null))) this.pedirRoteiroDaVila(r, rel);
          gravar = true;
        }
      }
      const eg = estadoDoGate(r.gate);
      mudou ||= gravar;
      noMundo.push({
        projectId: r.projectId,
        rodada: r.rodada,
        aprovadaEm: r.aprovadaEm,
        relatorio: r.relatorio ?? null,
        tarefas: Object.entries(r.tarefas).map(([id, t]) => ({
          id,
          estado: t.estado,
          sessionId: t.sessionId ?? null,
          dependeDe: t.dependeDe,
          arquivos: t.arquivos,
          abertaEm: t.abertaEm ?? null,
          prontaEm: t.prontaEm ?? null,
          erro: t.erro ?? null,
          parouSemTerminar: t.estado === 'aberta' && !devolutivas[id] && !!t.sessionId && porId.has(t.sessionId) && parada(t.sessionId),
        })),
        gate:
          eg && r.gate
            ? { estado: eg, comandos: r.gate.comandos, quebrou: eg === 'reprovada' ? (resultadoDoGate(r.gate)?.linhas ?? []).filter((l) => l.veredito === 'quebrou').map((l) => l.comando) : [] }
            : null,
      });
    }
    noMundo.sort((a, b) => b.aprovadaEm - a.aprovadaEm);
    if (JSON.stringify(noMundo) !== JSON.stringify(this.noMundo)) mudou = true;
    this.noMundo = noMundo;
    return mudou;
  }

  /**
   * Roda a linha de base (`antes`) ou o gate final (`depois`) de uma rodada (maestro v3, item 4). Fora da trava: os
   * comandos podem levar minutos; só a gravação do resultado entra nela. Uma vez por rodada e momento: a volta seguinte,
   * com o gate ainda rodando, não dispara outro. Rodada encerrada pelo gongo no meio: para e descarta o resultado.
   */
  private lancarGate(dir: string, r: Rodada, momento: MomentoDoGate): void {
    const chave = `${dir}:${momento}`;
    if (this.gates.has(chave) || !r.gate) return;
    const comandos = [...r.gate.comandos];
    const pasta = r.pasta;
    const encerrada = async () => {
      const atual = await lerRodada(dir);
      return !atual || !!atual.encerradaEm;
    };
    const rodar = async () => {
      const resultados: ResultadoDoComando[] = [];
      for (const [i, c] of comandos.entries()) {
        if (await encerrada()) return;
        resultados.push(await this.executar(c, pasta, saidaDoGate(dir, momento, i), this.limiteDoGate, travaDosTestes(dir)).catch(() => ({ comando: c, codigo: null, duracaoMs: 0 })));
      }
      await this.comTrava(async () => {
        const atual = await lerRodada(dir);
        if (!atual?.gate || atual.encerradaEm) return; // o gongo encerrou a rodada: o resultado é descartado
        const etapa = momento === 'antes' ? atual.gate.linhaDeBase : atual.gate.final;
        if (!etapa || etapa.fim) return;
        Object.assign(etapa, { fim: Date.now(), resultados });
        await gravarRodada(dir, atual);
      });
    };
    const p = rodar()
      .catch((err) => console.error('[porão] falha no gate da rodada:', err))
      .finally(() => this.gates.delete(chave));
    this.gates.set(chave, p);
  }

  /** Espera os gates em curso terminarem (testes; a vila não espera: a volta seguinte vê o resultado). */
  async gatesEmCurso(): Promise<void> {
    while (this.gates.size) await Promise.all([...this.gates.values()]);
  }

  /** As rodadas em andamento como a vila as viu na última volta (quadro do porão). */
  rodadasNoMundo(): RodadaNoMundo[] {
    return this.noMundo;
  }

  /** A rodada mexeu em tela: o cartão do roteiro aparece na estante, como o que o maestro pedia (só um por rodada). */
  private pedirRoteiroDaVila(r: Rodada, relatorio: string): void {
    if ([...this.pedidos.values()].some((p) => p.roteiro && p.rodada === r.rodada && p.estado !== 'recusado')) return;
    const pedido: PedidoPorao = {
      id: randomUUID(),
      projectId: r.projectId,
      pasta: r.pasta,
      maestro: '',
      rodada: r.rodada,
      tarefas: [TAREFA_ROTEIRO],
      permissoes: {},
      dependencias: {},
      roteiro: relatorio,
      criadoEm: Date.now(),
      estado: 'aguardando',
      sessoes: {},
    };
    this.pedidos.set(pedido.id, pedido);
  }

  /**
   * Sessão de trabalho retomada (`--resume`, depois de a vila reiniciar; MA-3): volta com as mesmas regras e hooks com
   * que nasceu, lidos do `rodada.json`. Null = não é tarefa de rodada v2 (retoma como sessão comum).
   */
  async retomada(sessionId: string, leitura: string[] = []): Promise<{ permitir: string[]; settings: string } | null> {
    const anot = (await this.ler()).tarefas[sessionId];
    if (!anot) return null;
    const dir = path.join(this.rodadasDir, String(anot.rodada));
    const r = await lerRodada(dir);
    const t = r?.tarefas[String(anot.tarefa)];
    if (!r || !t) return null;
    const tarefa = String(anot.tarefa);
    return {
      permitir: t.arquivos.length ? regrasDaTarefa(r.pasta, dir, { arquivos: t.arquivos, testes: t.testes }, leitura, tarefa) : [],
      settings: settingsDaTarefa(dir, tarefa, this.hookScript),
    };
  }

  /**
   * "Encerrar rodada" (fase 4): depois que as conversas foram apagadas, tira os ids do registro e dá como recusado o
   * pedido do projeto que ainda esperava o cartão. O do roteiro fica: a sessão dele é da casa, e a rodada já acabou.
   */
  async esquecer(projectId: string, ids: string[]): Promise<void> {
    const reg = await this.ler();
    for (const id of ids) {
      delete reg.maestros[id];
      delete reg.tarefas[id];
      this.chamados.delete(id);
    }
    await this.gravar(reg);
    for (const p of this.pedidosAbertos()) if (p.projectId === projectId && !p.roteiro) p.estado = 'recusado';
    // A rodada sai do quadro e nada mais abre sozinho (o relatório, se já saiu, fica). Na trava: o gate que termina
    // agora relê o `rodada.json` nela e descarta o resultado da rodada encerrada (maestro v3).
    await this.comTrava(async () => {
      for (const { dir, r } of await this.rodadasVivas()) {
        if (r.projectId !== projectId) continue;
        r.encerradaEm = Date.now();
        await gravarRodada(dir, r);
      }
    });
    this.noMundo = this.noMundo.filter((x) => x.projectId !== projectId);
  }

  recusar(id: string): PedidoPorao | null {
    const pedido = this.pedidos.get(id);
    if (!pedido || pedido.estado !== 'aguardando') return null;
    pedido.estado = 'recusado';
    return pedido;
  }
}
