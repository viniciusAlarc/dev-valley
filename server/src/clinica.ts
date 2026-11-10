import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { askAgent, type AgentEvent, type Exchange } from './consulta.js';
import type { HookState } from './hooks.js';
import { curto, descreverFerramenta, eventosDoFim, hora, ultimosPassos } from './mirim.js';
import type { World, WorldSession } from './world.js';

/**
 * Clínica (decisão do usuário, 09/11/2026), no lote da antiga torre do relógio. A médica examina um morador que está
 * demorando e diz se o usuário deve intervir. Ela recebe a ficha montada aqui (hooks, fim da conversa, processos do
 * terminal e a máquina) e só lê: Read, Grep e Glob em modo estrito. Não fala com a sessão, não roda nem encerra nada.
 * Os sinais vitais e a maca de triagem da clínica usam as mesmas leituras.
 */

/** Ticks de CPU por segundo no `/proc` (`CLK_TCK`): 100 no Linux comum, inclusive no WSL. */
const TICKS = 100;
/** Intervalo entre as duas leituras de CPU. */
const AMOSTRA_MS = 1000;
/** Filho que nasceu até tanto depois da sessão é quase sempre um servidor MCP ou de plugin, que vive com ela. */
const JUNTO_DA_SESSAO_S = 30;
/** Quantos passos recentes entram na ficha (o resto ela lê no `.jsonl`, se precisar). */
const PASSOS = 15;

export interface Processo {
  pid: number;
  ppid: number;
  /** Estado do `/proc/<pid>/stat`: R rodando, S dormindo (esperando algo), D esperando disco, Z zumbi, T parado. */
  estado: string;
  /** Tempo de CPU acumulado, em ticks. */
  ticks: number;
  /** Quando nasceu, em segundos desde o boot. */
  inicio: number;
  comando: string;
  /** Memória residente, em MB (`/proc/<pid>/statm`). */
  memMb: number;
}

/** Uma linha de `/proc/<pid>/stat`. O nome pode ter espaço e parêntese: os campos vêm depois do último `)`. */
export function lerStat(linha: string): Omit<Processo, 'comando' | 'memMb'> | null {
  const fecha = linha.lastIndexOf(')');
  const pid = Number.parseInt(linha, 10);
  if (fecha < 0 || !Number.isFinite(pid)) return null;
  const f = linha.slice(fecha + 2).trim().split(/\s+/);
  const ppid = Number(f[1]);
  const ticks = Number(f[11]) + Number(f[12]);
  const inicio = Number(f[19]) / TICKS;
  if (![ppid, ticks, inicio].every(Number.isFinite)) return null;
  return { pid, ppid, estado: f[0], ticks, inicio };
}

/** Todos os processos visíveis em `procDir`. Processo que some no meio da leitura é pulado. */
export async function lerProcessos(procDir = '/proc'): Promise<Map<number, Processo>> {
  const lista = new Map<number, Processo>();
  for (const nome of await fs.readdir(procDir).catch(() => [] as string[])) {
    if (!/^\d+$/.test(nome)) continue;
    try {
      const stat = lerStat(await fs.readFile(path.join(procDir, nome, 'stat'), 'utf8'));
      if (!stat) continue;
      const cmd = (await fs.readFile(path.join(procDir, nome, 'cmdline'), 'utf8').catch(() => '')).split('\0').filter(Boolean).join(' ');
      const paginas = Number((await fs.readFile(path.join(procDir, nome, 'statm'), 'utf8').catch(() => '')).split(' ')[1]);
      lista.set(stat.pid, { ...stat, comando: cmd, memMb: Number.isFinite(paginas) ? Math.round((paginas * 4096) / 1024 ** 2) : 0 });
    } catch {
      // saiu entre o readdir e a leitura
    }
  }
  return lista;
}

/** Os descendentes de `raiz` (filhos, netos…), sem ela, na ordem em que nasceram. */
export function descendentes(raiz: number, procs: Map<number, Processo>): Processo[] {
  const filhos = new Map<number, Processo[]>();
  for (const p of procs.values()) filhos.set(p.ppid, [...(filhos.get(p.ppid) ?? []), p]);
  const saida: Processo[] = [];
  const fila = [...(filhos.get(raiz) ?? [])];
  while (fila.length) {
    const p = fila.shift()!;
    saida.push(p);
    fila.push(...(filhos.get(p.pid) ?? []));
  }
  return saida.sort((a, b) => a.inicio - b.inicio);
}

/** Processo `claude` de uma sessão aberta fora da vila: o que tem o id dela na linha de comando (`--resume <id>`). */
export function processoPeloId(sessionId: string, procs: Map<number, Processo>): number | null {
  for (const p of procs.values()) if (/claude/.test(p.comando) && p.comando.includes(sessionId)) return p.pid;
  return null;
}

// ---------------- sinais vitais da máquina ----------------

export interface Vitais {
  memoria: { totalMb: number; usadaMb: number } | null;
  swap: { totalMb: number; usadaMb: number } | null;
  /** Carga média do último minuto e quantas CPUs a máquina tem. */
  carga: { umMinuto: number; cpus: number } | null;
  /** Disco da home. */
  disco: { totalGb: number; livreGb: number } | null;
}

/** `/proc/meminfo` → memória e swap em MB. Usada = total − disponível (o que o kernel pode liberar não conta). */
export function lerMeminfo(texto: string): Pick<Vitais, 'memoria' | 'swap'> {
  const kb = (campo: string) => {
    const m = texto.match(new RegExp(`^${campo}:\\s+(\\d+)`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const [total, disp, swapTotal, swapLivre] = [kb('MemTotal'), kb('MemAvailable'), kb('SwapTotal'), kb('SwapFree')];
  const mb = (n: number) => Math.round(n / 1024);
  return {
    memoria: total !== null && disp !== null ? { totalMb: mb(total), usadaMb: mb(total - disp) } : null,
    swap: swapTotal !== null && swapLivre !== null ? { totalMb: mb(swapTotal), usadaMb: mb(swapTotal - swapLivre) } : null,
  };
}

export async function lerVitais(procDir = '/proc', discoDe = os.homedir()): Promise<Vitais> {
  const mem = lerMeminfo(await fs.readFile(path.join(procDir, 'meminfo'), 'utf8').catch(() => ''));
  const load = Number.parseFloat(await fs.readFile(path.join(procDir, 'loadavg'), 'utf8').catch(() => ''));
  const disco = await fs.statfs(discoDe).catch(() => null);
  const gb = (blocos: number, tam: number) => Math.round(((blocos * tam) / 1024 ** 3) * 10) / 10;
  return {
    ...mem,
    carga: Number.isFinite(load) ? { umMinuto: load, cpus: os.cpus().length } : null,
    disco: disco ? { totalGb: gb(disco.blocks, disco.bsize), livreGb: gb(disco.bavail, disco.bsize) } : null,
  };
}

export function textoDosVitais(v: Vitais): string {
  const gb = (mb: number) => (mb / 1024).toFixed(1).replace('.', ',');
  const partes = [
    v.memoria && `memória ${gb(v.memoria.usadaMb)} de ${gb(v.memoria.totalMb)} GB em uso (${Math.round((v.memoria.usadaMb / v.memoria.totalMb) * 100)}%)`,
    v.swap && v.swap.totalMb > 0 && `swap ${gb(v.swap.usadaMb)} de ${gb(v.swap.totalMb)} GB`,
    v.carga && `carga ${v.carga.umMinuto.toFixed(1).replace('.', ',')} em ${v.carga.cpus} CPUs`,
    v.disco && `disco da home com ${String(v.disco.livreGb).replace('.', ',')} de ${String(v.disco.totalGb).replace('.', ',')} GB livres`,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'sem leitura';
}

// ---------------- o paciente ----------------

export interface ComandoRodando {
  pid: number;
  comando: string;
  /** Há quantos segundos está rodando. */
  idadeS: number;
  /** % de uma CPU no último segundo. */
  cpu: number;
  estado: string;
  /** Nasceu junto com a sessão: quase sempre um servidor MCP ou de plugin. */
  daSessao: boolean;
}

export interface Paciente {
  id: string;
  name: string;
  projectId: string | null;
  status: WorldSession['status'];
  live: boolean;
  inTown: boolean;
  atividade: WorldSession['atividade'];
  contexto: number | null;
  /** Desde quando está trabalhando sem parar (ms); 0 = parado. */
  trabalhandoDesde: number;
  /** Último evento dos hooks (ms); 0 = sem hooks. */
  ultimoEvento: number;
  /** O processo do Claude da sessão foi achado (terminal da vila ou id na linha de comando). */
  processo: { pid: number; cpu: number } | null;
  /** Comandos que a sessão roda agora, sem os que nasceram com ela. */
  comandos: ComandoRodando[];
  /** Filhos que nasceram com a sessão (MCP, plugins). */
  servidores: ComandoRodando[];
}

/** Segundos desde o boot (`/proc/uptime`), para a idade dos processos. */
async function uptime(procDir: string): Promise<number> {
  return Number.parseFloat(await fs.readFile(path.join(procDir, 'uptime'), 'utf8').catch(() => '0')) || 0;
}

/**
 * Monta os pacientes (sessões vivas) a partir de duas leituras do `/proc` com `AMOSTRA_MS` entre elas: a diferença de
 * ticks é a CPU de cada processo. Puro o bastante para testar com duas leituras feitas à mão.
 */
export function montarPacientes(
  sessoes: WorldSession[],
  hooks: Map<string, HookState>,
  pidDe: (id: string) => number | null,
  antes: Map<number, Processo>,
  depois: Map<number, Processo>,
  agoraBoot: number,
  intervaloS = AMOSTRA_MS / 1000,
): Paciente[] {
  const cpu = (p: Processo) => {
    const a = antes.get(p.pid);
    return a ? Math.round(((p.ticks - a.ticks) / TICKS / intervaloS) * 100) : 0;
  };
  return sessoes
    .filter((s) => s.live)
    .map((s) => {
      const h = hooks.get(s.id);
      const pid = pidDe(s.id) ?? processoPeloId(s.id, depois);
      const raiz = pid !== null ? depois.get(pid) : undefined;
      const filhos = raiz
        ? descendentes(raiz.pid, depois).map((p) => ({
            pid: p.pid,
            comando: curto(p.comando || '(sem linha de comando)', 160),
            idadeS: Math.max(0, Math.round(agoraBoot - p.inicio)),
            cpu: cpu(p),
            estado: p.estado,
            daSessao: p.inicio - raiz.inicio <= JUNTO_DA_SESSAO_S,
          }))
        : [];
      return {
        id: s.id,
        name: s.name,
        projectId: s.projectId,
        status: s.status,
        live: s.live,
        inTown: s.inTown,
        atividade: s.atividade,
        contexto: s.context?.percent ?? null,
        trabalhandoDesde: h?.trabalhandoDesde ?? 0,
        ultimoEvento: h?.updatedAt ?? 0,
        processo: raiz ? { pid: raiz.pid, cpu: cpu(raiz) } : null,
        comandos: filhos.filter((f) => !f.daSessao),
        servidores: filhos.filter((f) => f.daSessao),
      };
    });
}

/** "há 12 min", "há 1 h 05 min", "há 40 s". */
export function haQuanto(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `há ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

const ESTADO_PROC: Record<string, string> = { R: 'rodando', S: 'dormindo (esperando algo)', D: 'esperando disco', Z: 'zumbi', T: 'parado', I: 'ocioso' };

/**
 * A ferramenta que a conversa chamou e cujo resultado ainda não voltou (o que a sessão está esperando agora), e os
 * erros de ferramenta recentes. Lido do fim do `.jsonl`.
 */
export async function pendenteEErros(file: string): Promise<{ pendente: string | null; erros: string[] }> {
  const usos = new Map<string, string>();
  const erros: string[] = [];
  for (const e of await eventosDoFim(file)) {
    if (e.isSidechain || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) {
      if (b.type === 'tool_use') usos.set(b.id, `${descreverFerramenta(b.name, b.input)} (chamada às ${hora(e.timestamp)})`);
      if (b.type === 'tool_result') {
        usos.delete(b.tool_use_id);
        if (b.is_error) {
          const texto = typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((c: any) => c.text ?? '').join(' ') : '';
          erros.push(`[${hora(e.timestamp)}] ${curto(texto, 200)}`);
        }
      }
    }
  }
  return { pendente: [...usos.values()].pop() ?? null, erros: erros.slice(-5) };
}

const ESTADO_HOOK: Record<string, string> = { working: 'trabalhando', permission: 'ESPERANDO PERMISSÃO do usuário', idle: 'parada (terminou a vez dela)' };

/** A ficha que a médica recebe antes da pergunta. */
export async function fichaDoPaciente(p: Paciente, s: WorldSession, projeto: string, vitais: Vitais, agora = Date.now()): Promise<string> {
  const seg = (ms: number) => (agora - ms) / 1000;
  const estado = p.status ? ESTADO_HOOK[p.status] ?? p.status : 'sem hooks (estado desconhecido)';
  const linhas = [
    `Agora: ${new Date(agora).toLocaleDateString('pt-BR')} ${hora(new Date(agora).toISOString())}.`,
    `Paciente: ${p.name} — sessão ${p.id}`,
    `Onde mora: ${projeto} (${s.cwd})`,
    `Aberta ${p.inTown ? 'num terminal da vila' : 'fora da vila (VS Code ou outro terminal)'}.`,
    `Estado pelos hooks: ${estado}` +
      (p.trabalhandoDesde ? `, trabalhando sem parar ${haQuanto(seg(p.trabalhandoDesde))} (desde ${hora(new Date(p.trabalhandoDesde).toISOString())})` : '') +
      (p.ultimoEvento ? `; último evento ${haQuanto(seg(p.ultimoEvento))}` : '') +
      (p.atividade ? `; ferramenta em uso agora: categoria "${p.atividade}"` : '') +
      '.',
    `Contexto: ${p.contexto === null ? 'sem leitura' : `${p.contexto}%`}.`,
    `Conversa: ${s.file ?? '(ainda sem arquivo)'}`,
  ];
  if (p.processo) {
    linhas.push(`Processo do Claude: pid ${p.processo.pid}, CPU ${p.processo.cpu}% no último segundo.`);
    linhas.push(
      p.comandos.length
        ? ['Comandos rodando agora (filhos do Claude):', ...p.comandos.map((c) => `- pid ${c.pid}, ${haQuanto(c.idadeS)}, CPU ${c.cpu}%, ${ESTADO_PROC[c.estado] ?? c.estado}: ${c.comando}`)].join('\n')
        : 'Comandos rodando agora: nenhum.',
    );
    if (p.servidores.length)
      linhas.push(['Nasceram com a sessão (servidores MCP/plugins, vivem com ela; não são o comando demorado):', ...p.servidores.map((c) => `- pid ${c.pid}, CPU ${c.cpu}%: ${c.comando}`)].join('\n'));
  } else {
    linhas.push('Processo do Claude: não achado (sessão fora da vila sem o id na linha de comando, ou o processo já saiu). Sem a lista de comandos.');
  }
  linhas.push(`Máquina (WSL): ${textoDosVitais(vitais)}.`);
  if (s.file) {
    const { pendente, erros } = await pendenteEErros(s.file);
    linhas.push(`Esperando o resultado de: ${pendente ?? 'nada (nenhuma ferramenta em aberto)'}.`);
    if (erros.length) linhas.push(['Erros de ferramenta recentes:', ...erros.map((e) => `- ${e}`)].join('\n'));
    const passos = await ultimosPassos(s.file, PASSOS);
    linhas.push(passos.length ? ['Últimos passos:', ...passos.map((x) => `- ${x}`)].join('\n') : 'Últimos passos: nenhum ainda.');
  }
  return linhas.join('\n');
}


// ---------------- armário: pacientes esquecidos (etapa 2, CL-1) ----------------

/** O executável é o `claude` (não basta aparecer "claude" num caminho de argumento). */
export const ehClaude = (p: Pick<Processo, 'comando'>) => /^(\S*\/)?claude(\s|$)/.test(p.comando);

/**
 * O próprio VS Code (o servidor remoto dele no WSL e as extensões) escuta portas enquanto ele está conectado: é
 * infraestrutura, não servidor esquecido. Um servidor subido no terminal do VS Code tem a linha de comando dele e aparece.
 */
const doVsCode = (p: Pick<Processo, 'comando'>) => p.comando.includes('/.vscode-server/');

/** Portas em escuta (`LISTEN`, estado `0A`) de `/proc/net/tcp` e `tcp6`: inode do socket → porta. */
export function lerPortas(texto: string): Map<number, number> {
  const portas = new Map<number, number>();
  for (const linha of texto.split('\n').slice(1)) {
    const f = linha.trim().split(/\s+/);
    if (f.length < 10 || f[3] !== '0A') continue;
    const porta = Number.parseInt(f[1]!.split(':').pop()!, 16);
    const inode = Number(f[9]);
    if (Number.isFinite(porta) && inode > 0) portas.set(inode, porta);
  }
  return portas;
}

export interface Esquecido {
  pid: number;
  comando: string;
  idadeS: number;
  memMb: number;
  /** Pasta onde roda (link `/proc/<pid>/cwd`); null = sem permissão de ler. */
  pasta: string | null;
  /** Portas em escuta; vazio no `claude`. */
  portas: number[];
  /** Morador vivo fora da vila na mesma pasta (o `claude` aberto no VS Code, por exemplo): provavelmente é ele. */
  morador: string | null;
}

export interface Container {
  nome: string;
  imagem: string;
  status: string;
  portas: string;
  /** Projeto do `docker compose`, quando houver. */
  compose: string | null;
}

export interface Armario {
  claudes: Esquecido[];
  servidores: Esquecido[];
  /** null = Docker não instalado ou não respondeu (o motivo vai em `dockerErro`). */
  containers: Container[] | null;
  dockerErro: string | null;
}

/** Saída de `docker ps --format '{{json .}}'`: uma linha JSON por container. */
export function lerContainers(saida: string): Container[] {
  const lista: Container[] = [];
  for (const linha of saida.split('\n')) {
    let c: any;
    try {
      c = JSON.parse(linha);
    } catch {
      continue;
    }
    const compose = String(c.Labels ?? '').match(/com\.docker\.compose\.project=([^,]+)/)?.[1] ?? null;
    lista.push({ nome: String(c.Names ?? ''), imagem: String(c.Image ?? ''), status: String(c.Status ?? ''), portas: String(c.Ports ?? ''), compose });
  }
  return lista;
}

/** `docker ps` de verdade, só leitura, com prazo curto. */
export function dockerPs(): Promise<string> {
  return new Promise((ok, falha) =>
    execFile('docker', ['ps', '--format', '{{json .}}'], { timeout: 4000 }, (err, stdout) => (err ? falha(err) : ok(stdout))),
  );
}

/**
 * O que roda na máquina fora da vila e pode ter sido esquecido: processos `claude` (os de cima, não os filhos de outro
 * `claude`) e servidores escutando porta. Fica de fora tudo o que descende do servidor da vila (terminais dos moradores,
 * lareiras e as consultas dos agentes). Só aponta: quem encerra é o usuário (decisão do usuário, 09/11/2026).
 */
export async function procurarEsquecidos(procDir: string, raizDaVila: number, sessoes: WorldSession[]): Promise<Pick<Armario, 'claudes' | 'servidores'>> {
  const procs = await lerProcessos(procDir);
  const agoraBoot = await uptime(procDir);
  const daVila = new Set([raizDaVila, ...descendentes(raizDaVila, procs).map((p) => p.pid)]);
  const pasta = (pid: number) => fs.readlink(path.join(procDir, String(pid), 'cwd')).catch(() => null);
  const foraDaVila = sessoes.filter((s) => s.live && !s.inTown);
  const esquecido = async (p: Processo, portas: number[]): Promise<Esquecido> => {
    const cwd = await pasta(p.pid);
    return {
      pid: p.pid,
      comando: curto(p.comando || '(sem linha de comando)', 160),
      idadeS: Math.max(0, Math.round(agoraBoot - p.inicio)),
      memMb: p.memMb,
      pasta: cwd,
      portas,
      morador: (cwd && ehClaude(p) && foraDaVila.find((s) => s.cwd === cwd)?.name) || null,
    };
  };

  const claudes: Esquecido[] = [];
  for (const p of procs.values()) {
    if (daVila.has(p.pid) || !ehClaude(p)) continue;
    const pai = procs.get(p.ppid);
    if (pai && ehClaude(pai)) continue; // filho de outro claude: aparece com ele
    claudes.push(await esquecido(p, []));
  }

  const texto = (await Promise.all(['tcp', 'tcp6'].map((f) => fs.readFile(path.join(procDir, 'net', f), 'utf8').catch(() => '')))).join('\n');
  const portas = lerPortas(texto);
  const servidores: Esquecido[] = [];
  if (portas.size) {
    for (const p of procs.values()) {
      if (daVila.has(p.pid) || doVsCode(p)) continue;
      const fds = await fs.readdir(path.join(procDir, String(p.pid), 'fd')).catch(() => [] as string[]);
      const minhas = new Set<number>();
      for (const fd of fds) {
        const alvo = await fs.readlink(path.join(procDir, String(p.pid), 'fd', fd)).catch(() => '');
        const inode = Number(alvo.match(/^socket:\[(\d+)\]$/)?.[1]);
        const porta = portas.get(inode);
        if (porta !== undefined) minhas.add(porta);
      }
      if (minhas.size) servidores.push(await esquecido(p, [...minhas].sort((a, b) => a - b)));
    }
  }
  const porIdade = (a: Esquecido, b: Esquecido) => b.idadeS - a.idadeS;
  return { claudes: claudes.sort(porIdade), servidores: servidores.sort(porIdade) };
}

// ---------------- o serviço ----------------

export interface Triagem {
  vitais: Vitais;
  pacientes: Paciente[];
}

/** Junta mundo, hooks e terminais da vila; `procDir` trocável para teste. */
export class Clinica {
  constructor(
    private world: () => World,
    private hooks: () => HookState[],
    private pidDe: (id: string) => number | null,
    private procDir = '/proc',
    private raizDaVila = process.pid,
    private docker: () => Promise<string> = dockerPs,
  ) {}

  /** Armário (etapa 2): o que roda fora da vila e pode ter sido esquecido. */
  async armario(): Promise<Armario> {
    const [achados, docker] = await Promise.all([
      procurarEsquecidos(this.procDir, this.raizDaVila, this.world().sessions),
      this.docker().then(
        (saida) => ({ containers: lerContainers(saida), dockerErro: null }),
        (err: NodeJS.ErrnoException) => ({
          containers: null,
          dockerErro: err.code === 'ENOENT' ? 'Docker não está instalado.' : 'O Docker não respondeu (serviço parado?).',
        }),
      ),
    ]);
    return { ...achados, ...docker };
  }

  /** Só os sinais da máquina, sem varrer processos: o canto da tela lê isto a cada meio minuto (09/11/2026). */
  vitais(): Promise<Vitais> {
    return lerVitais(this.procDir);
  }

  async triagem(): Promise<Triagem> {
    const antes = await lerProcessos(this.procDir);
    await new Promise((ok) => setTimeout(ok, AMOSTRA_MS));
    const [depois, agoraBoot, vitais] = await Promise.all([lerProcessos(this.procDir), uptime(this.procDir), lerVitais(this.procDir)]);
    const hooks = new Map(this.hooks().map((h) => [h.id, h]));
    return { vitais, pacientes: montarPacientes(this.world().sessions, hooks, this.pidDe, antes, depois, agoraBoot) };
  }

  /** A ficha de uma sessão viva; null = não é morador vivo. */
  async ficha(sessionId: string): Promise<string | null> {
    const w = this.world();
    const s = w.sessions.find((x) => x.id === sessionId);
    if (!s?.live) return null;
    const { vitais, pacientes } = await this.triagem();
    const p = pacientes.find((x) => x.id === sessionId);
    if (!p) return null;
    const projeto = w.projects.find((x) => x.id === s.projectId)?.name ?? 'praça (fora de projeto)';
    return fichaDoPaciente(p, s, projeto, vitais);
  }
}

function stepFor(tool: string, input: any): string {
  if (tool === 'Read') return `📖 Lendo ${path.basename(String(input?.file_path ?? ''))}`;
  if (tool === 'Grep') return `🔎 Procurando "${String(input?.pattern ?? '').slice(0, 40)}"`;
  if (tool === 'Glob') return `🗂️ Olhando ${String(input?.pattern ?? '').slice(0, 40)}`;
  return `🩺 ${tool}`;
}

export async function askMedica(
  question: string,
  history: Exchange[],
  ficha: string,
  onEvent: (e: AgentEvent) => void,
  hooksToIgnore: Set<string>,
): Promise<() => void> {
  return askAgent({ name: 'medica', who: 'A médica', preamble: ficha, estrito: true, stepFor }, question, history, onEvent, hooksToIgnore);
}
