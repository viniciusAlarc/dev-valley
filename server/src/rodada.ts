import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './config.js';
import { resultadoDoGate, saidaDoGate, type GateDaRodada } from './gate.js';
import type { Tokens } from './gasto.js';

/**
 * Estado de uma rodada do maestro, conduzido pela vila (maestro v2, `docs-dev/a-codar/maestro-v2.md`, 11/11/2026).
 *
 * A rodada andava por recado entre modelos (`COMECEI`, `PRONTA` pelo `SendMessage`) e o recado se perdia. Agora:
 * 1. o clique no cartão grava o `rodada.json` (único escritor: a vila) com as tarefas, os arquivos e as dependências;
 * 2. cada sessão de trabalho termina gravando a **devolutiva** em `devolutivas/<tarefa>.md`; o hook `Stop` lembra quem
 *    tenta parar sem ela, e o `PreToolUse` não deixa editar arquivo de outra tarefa que ainda trabalha;
 * 3. a vila marca a tarefa pronta (devolutiva gravada e sessão parada), abre a que dependia dela e, com todas prontas,
 *    monta o relatório sem modelo nenhum (D3).
 */

/** `abrindo` = a vila já reservou a tarefa e está subindo o terminal: ninguém mais a abre (corrida de 11/11/2026). */
export type EstadoDaTarefa = 'esperando' | 'abrindo' | 'aberta' | 'pronta' | 'erro';

export interface TarefaDaRodada {
  arquivos: string[];
  testes: string[];
  /** Só abre quando todas estas estiverem prontas (fase 3). */
  dependeDe: string[];
  estado: EstadoDaTarefa;
  sessionId?: string;
  abertaEm?: number;
  prontaEm?: number;
  /** Por que não abriu (ex.: perfil pessoal sem configuração). */
  erro?: string;
  /** Tokens da conversa, lidos do `.jsonl` quando ficou pronta (maestro v3, medição). Só números. */
  tokens?: Tokens;
}

export interface Rodada {
  versao: 2;
  rodada: string;
  projectId: string;
  /** Pasta do projeto: base dos arquivos das tarefas e do relatório. */
  pasta: string;
  aprovadaEm: number;
  tarefas: Record<string, TarefaDaRodada>;
  /** Relatório montado pela vila, relativo à pasta do projeto. */
  relatorio?: string;
  /** O gongo apagou as conversas: a rodada sai do quadro e nada mais abre. */
  encerradaEm?: number;
  /** Comandos de teste do cartão rodados pela vila antes e depois (maestro v3); ausente = rodada sem `testes`. */
  gate?: GateDaRodada;
  /** Quanto o maestro estimou, antes da rodada, para fazer tudo numa sessão só (minutos). */
  estimativaSessaoUnicaMin?: number;
}

/**
 * Onde a rodada está no gate (maestro v3), para o quadro e o ❗: null = sem `testes`, sem gate.
 * `linha-de-base` = a vila roda os testes antes de abrir as sessões; `conferindo` = o gate final roda.
 */
export type EstadoDoGate = 'linha-de-base' | 'trabalhando' | 'conferindo' | 'aprovada' | 'reprovada';

export function estadoDoGate(g: GateDaRodada | undefined): EstadoDoGate | null {
  if (!g?.comandos.length) return null;
  if (g.linhaDeBase && !g.linhaDeBase.fim) return 'linha-de-base';
  const res = resultadoDoGate(g);
  if (res) return res.aprovada ? 'aprovada' : 'reprovada';
  return g.final ? 'conferindo' : 'trabalhando';
}

/** O que o quadro do porão mostra de cada tarefa (o estado ao vivo, trabalhando ou pedindo permissão, vem da sessão). */
export interface TarefaNoMundo {
  id: string;
  estado: EstadoDaTarefa;
  sessionId: string | null;
  dependeDe: string[];
  arquivos: string[];
  abertaEm: number | null;
  prontaEm: number | null;
  erro: string | null;
  /** Aberta, parada sem pedir permissão e sem a devolutiva: precisa do usuário (❗ na estante). */
  parouSemTerminar: boolean;
}

export interface RodadaNoMundo {
  projectId: string;
  rodada: string;
  aprovadaEm: number;
  relatorio: string | null;
  tarefas: TarefaNoMundo[];
  /** Gate da rodada (maestro v3); null = sem comandos de teste. `quebrou` = comandos que passavam e falham. */
  gate: { estado: EstadoDoGate; comandos: string[]; quebrou: string[] } | null;
}

/** Arquivos de rastro que todas as tarefas somam: não têm dona (contrato "Sob o maestro"). */
export const RASTRO = ['PROGRESS.md', 'PENDENCIAS.md'];
/** Script dos hooks das sessões de trabalho (`--settings` no spawn, D1). */
export const HOOK_SCRIPT = path.join(ROOT_DIR, 'scripts', 'porao-hook.sh');

export const arquivoDaRodada = (dir: string) => path.join(dir, 'rodada.json');
export const devolutivaDe = (dir: string, tarefa: string) => path.join(dir, 'devolutivas', `${tarefa}.md`);

export async function lerRodada(dir: string): Promise<Rodada | null> {
  try {
    const r = JSON.parse(await fs.readFile(arquivoDaRodada(dir), 'utf8'));
    return r?.versao === 2 && r.tarefas && typeof r.tarefas === 'object' ? (r as Rodada) : null;
  } catch {
    return null;
  }
}

export async function gravarRodada(dir: string, r: Rodada): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const file = arquivoDaRodada(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(r, null, 2) + '\n');
  await fs.rename(tmp, file);
}

/**
 * Confere as dependências do pedido: só tarefas do mesmo pedido, nenhuma de si mesma, sem ciclo. Devolve o motivo da
 * recusa, ou null.
 */
export function validarDependencias(deps: Record<string, string[]>): string | null {
  const nomes = new Set(Object.keys(deps));
  for (const [t, ds] of Object.entries(deps)) {
    for (const d of ds) {
      if (d === t) return `${t} não pode depender de si mesma.`;
      if (!nomes.has(d)) return `${t} depende de ${d}, que não está no pedido.`;
    }
  }
  // Ciclo: busca em profundidade com as três cores de sempre (0 = não visto, 1 = no caminho, 2 = resolvido).
  const cor = new Map<string, number>();
  const visita = (t: string): string | null => {
    cor.set(t, 1);
    for (const d of deps[t] ?? []) {
      if (cor.get(d) === 1) return `Dependência em ciclo entre ${t} e ${d}.`;
      if (!cor.get(d)) {
        const e = visita(d);
        if (e) return e;
      }
    }
    cor.set(t, 2);
    return null;
  };
  for (const t of nomes) {
    if (!cor.get(t)) {
      const e = visita(t);
      if (e) return e;
    }
  }
  return null;
}

/**
 * `--settings` da sessão de trabalho (D1): os dois hooks só dela, sem mexer no mod nem no `settings.json` global.
 * Rodada e tarefa já passaram pelo `NOME_RE` do porão (letras, números, ponto, hífen): seguras na linha de comando.
 */
export function settingsDaTarefa(rodadaDir: string, tarefa: string, script = HOOK_SCRIPT): string {
  if (/'/.test(rodadaDir + script)) throw new Error('caminho com aspas simples');
  const cmd = (modo: string) => `bash '${script}' ${modo} '${rodadaDir}' ${tarefa}`;
  return JSON.stringify({
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: cmd('parar') }] }],
      PreToolUse: [
        { matcher: 'Edit|Write|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: cmd('posse') }] },
        // Edição pelo Bash passava por fora da posse (ensaio de 11/11/2026): só Edit/Write escrevem arquivo.
        { matcher: 'Bash', hooks: [{ type: 'command', command: cmd('bash') }] },
      ],
    },
  });
}

export interface Devolutiva {
  campos: Record<string, string>;
  /** O que a sessão fez, em 2 ou 3 linhas. */
  corpo: string;
}

/**
 * Devolutiva gravada pela sessão: cabeçalho `chave: valor` entre `---` e o corpo. Sem cabeçalho, o texto todo vale como
 * corpo (o relatório sai com menos colunas, mas sai). Arquivo vazio ou ausente = null.
 */
export async function lerDevolutiva(file: string): Promise<Devolutiva | null> {
  let texto: string;
  try {
    texto = (await fs.readFile(file, 'utf8')).trim();
  } catch {
    return null;
  }
  if (!texto) return null;
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto);
  if (!m) return { campos: {}, corpo: texto };
  const campos: Record<string, string> = {};
  for (const linha of m[1]!.split('\n')) {
    const i = linha.indexOf(':');
    if (i > 0) campos[linha.slice(0, i).trim().toLowerCase()] = linha.slice(i + 1).trim();
  }
  return { campos, corpo: m[2]!.trim() };
}

/**
 * Campo `aceite` da devolutiva (maestro v3): "sim" ou "não", e como conferiu. Devolutiva antiga, sem o campo, continua
 * sendo lida: null.
 */
export function aceiteDe(d: Devolutiva | null): { ok: boolean; como: string } | null {
  const v = d?.campos.aceite?.trim();
  if (!v) return null;
  const m = /^(sim|s|yes|true|não|nao|n|no|false)\b[\s:,;.—–-]*(.*)$/i.exec(v);
  if (!m) return null;
  return { ok: /^(sim|s|yes|true)$/i.test(m[1]!), como: m[2]!.trim() };
}

/** "sim" (ou "true") em `mexeu_em_tela`: a rodada pede o roteiro de testes. */
export const mexeuEmTela = (d: Devolutiva | null) => /^(sim|s|true|yes)$/i.test(d?.campos.mexeu_em_tela ?? '');

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const hora = (ms: number) => {
  const d = new Date(ms);
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};
export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ${s % 60} s`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
/** Célula de tabela markdown: sem quebra de linha nem barra vertical solta. */
const celula = (s: string) => s.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim() || '-';

/** Assunto da rodada pelo id (`AAAAMMDD-HHMM-<assunto>`); id fora do padrão vale inteiro. */
export function assuntoDe(rodada: string): string {
  const m = /^\d{8}-\d{4}-(.+)$/.exec(rodada);
  return m ? m[1]! : rodada;
}

/** Caminho do relatório, relativo ao projeto: `docs-dev/maestro/AAAA-MM-DD-<assunto>.md`, sem sobrescrever outro. */
export async function caminhoDoRelatorio(r: Rodada): Promise<string> {
  const d = new Date(r.aprovadaEm);
  const base = `docs-dev/maestro/${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}-${assuntoDe(r.rodada)}`;
  for (let i = 1; ; i++) {
    const rel = `${base}${i === 1 ? '' : `-${i}`}.md`;
    try {
      await fs.access(path.join(r.pasta, rel));
    } catch {
      return rel;
    }
  }
}

/** Número com ponto de milhar (fixo, sem depender do idioma da máquina). */
const milhar = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Fim da rodada no relatório: o fim do gate final; sem gate, a última tarefa pronta. */
function fimDaRodada(r: Rodada): number {
  return r.gate?.final?.fim ?? Math.max(r.aprovadaEm, ...Object.values(r.tarefas).map((t) => t.prontaEm ?? r.aprovadaEm));
}

/** Linha do topo do relatório: aprovada, reprovada (com o que quebrou) ou sem verificação automática. */
function vereditoDoTopo(r: Rodada, pastaDaRodada: string): string {
  const res = r.gate?.comandos.length ? resultadoDoGate(r.gate) : null;
  if (!r.gate?.comandos.length) return '**Sem verificação automática:** nenhuma tarefa trouxe comando de teste.';
  if (!res) return '**Gate não terminou:** o relatório saiu sem o resultado dos testes.';
  if (res.aprovada) return '**Aprovada:** nenhum comando de teste quebrou (gate rodado pela vila antes e depois).';
  const quebrou = res.linhas.filter((l) => l.veredito === 'quebrou');
  return `**Reprovada:** a rodada quebrou ${quebrou
    .map((l) => `\`${l.comando}\` (saída em \`${saidaDoGate(pastaDaRodada, 'depois', l.i)}\`)`)
    .join(', ')}. Nenhuma sessão foi reaberta: a decisão é sua.`;
}

/** Seção do gate: cada comando antes → depois, com o veredito. */
function secaoDoGate(r: Rodada, pastaDaRodada: string): string[] {
  const res = r.gate?.comandos.length ? resultadoDoGate(r.gate) : null;
  if (!res) return [];
  const como = (x: { codigo: number | null; duracaoMs: number; estourou?: boolean } | undefined) =>
    !x ? 'não rodou' : `${x.codigo === 0 ? 'passou' : x.estourou ? 'estourou o tempo' : `falhou (código ${x.codigo ?? '-'})`}, ${duracao(x.duracaoMs)}`;
  return [
    '## Verificação',
    '',
    '| Comando | Antes | Depois | Resultado |',
    '|---|---|---|---|',
    ...res.linhas.map((l) => `| \`${celula(l.comando)}\` | ${como(l.antes)} | ${como(l.depois)} | ${l.veredito} |`),
    '',
    `Antes = linha de base, rodada pela vila antes de abrir as sessões; depois = com todas as tarefas prontas. Saída de cada comando em \`${path.join(pastaDaRodada, 'gate')}/\`.`,
    '',
  ];
}

/** Seção "Custo e ganho" (maestro v3, item 5): só os números; a conclusão é do usuário. */
function secaoDeCusto(r: Rodada): string[] {
  const ids = Object.keys(r.tarefas);
  const parede = fimDaRodada(r) - r.aprovadaEm;
  const etapa = (e: { inicio: number; fim?: number } | undefined) => (e?.fim ? duracao(e.fim - e.inicio) : '-');
  const soma = ids.reduce((n, t) => {
    const x = r.tarefas[t]!;
    return n + (x.abertaEm && x.prontaEm ? x.prontaEm - x.abertaEm : 0);
  }, 0);
  const est = r.estimativaSessaoUnicaMin;
  let estimativa = 'não declarada';
  if (est) {
    const dif = Math.round(est - parede / 60_000);
    estimativa = `${est} min · diferença: ${dif === 0 ? 'a rodada levou o mesmo que a estimativa' : `a rodada levou ${Math.abs(dif)} min a ${dif > 0 ? 'menos' : 'mais'} que a estimativa`}`;
  }
  const comTokens = ids.filter((t) => r.tarefas[t]!.tokens);
  const total = comTokens.reduce(
    (acc, t) => {
      const k = r.tarefas[t]!.tokens!;
      return { entrada: acc.entrada + k.entrada, saida: acc.saida + k.saida, cacheCriado: acc.cacheCriado + k.cacheCriado, cacheLido: acc.cacheLido + k.cacheLido };
    },
    { entrada: 0, saida: 0, cacheCriado: 0, cacheLido: 0 },
  );
  const linha = (nome: string, k: Tokens | undefined) => (k ? `| ${nome} | ${milhar(k.entrada)} | ${milhar(k.saida)} | ${milhar(k.cacheCriado)} | ${milhar(k.cacheLido)} |` : `| ${nome} | - | - | - | - |`);
  return [
    '## Custo e ganho',
    '',
    `- Tempo de parede (clique → ${r.gate?.final?.fim ? 'fim do gate' : 'última tarefa pronta'}): ${duracao(parede)}`,
    `- Linha de base: ${r.gate?.comandos.length ? etapa(r.gate.linhaDeBase) : 'sem gate'} · gate final: ${r.gate?.comandos.length ? etapa(r.gate.final) : 'sem gate'}`,
    `- Soma dos tempos das tarefas: ${duracao(soma)}`,
    `- Estimativa em sessão única: ${estimativa}`,
    '',
    '| Tarefa | Entrada | Saída | Cache criado | Cache lido |',
    '|---|---|---|---|---|',
    ...ids.map((t) => linha(celula(t), r.tarefas[t]!.tokens)),
    linha('**Total**', comTokens.length ? total : undefined),
    '',
    'A estimativa foi declarada antes da rodada; não é medição.',
    '',
  ];
}

/**
 * Relatório da rodada (D3): montado só com as devolutivas e os horários que a vila anotou, sem reler código e sem
 * modelo. Maestro v3: veredito do gate no topo, coluna do aceite, seções "Verificação" e "Custo e ganho".
 * `pastaDaRodada` = onde ficam as devolutivas e a saída do gate (`~/.claude/maestro/rodadas/<id>`).
 */
export function montarRelatorio(r: Rodada, devolutivas: Record<string, Devolutiva | null>, nomeDe: (sessionId: string) => string, pastaDaRodada = `~/.claude/maestro/rodadas/${r.rodada}`): string {
  const ids = Object.keys(r.tarefas);
  const fim = fimDaRodada(r);
  const d = new Date(r.aprovadaEm);
  const linhas = ids.map((t) => {
    const tarefa = r.tarefas[t]!;
    const dev = devolutivas[t] ?? null;
    const tempo = tarefa.abertaEm && tarefa.prontaEm ? duracao(tarefa.prontaEm - tarefa.abertaEm) : '-';
    const arquivos = dev?.campos.arquivos || tarefa.arquivos.join(', ');
    const arqs = arquivos
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => `\`${a.replace(/`/g, '')}\``)
      .join(', ');
    const sessao = tarefa.sessionId ? nomeDe(tarefa.sessionId) : '-';
    const aceite = aceiteDe(dev);
    const ac = aceite ? `${aceite.ok ? 'sim' : 'não'}${aceite.como ? `: ${aceite.como}` : ''}` : '';
    return `| ${celula(t)} | ${celula(sessao)} | ${tempo} | ${celula(dev?.corpo ?? 'sem devolutiva')} | ${celula(arqs)} | ${celula(dev?.campos.testes ?? '')} | ${celula(ac)} |`;
  });
  const fora = ids
    .map((t) => [t, devolutivas[t]?.campos.ficou_de_fora ?? ''] as const)
    .filter(([, f]) => f && !/^(nada|nenhum|nenhuma|-)\.?$/i.test(f));
  const tela = ids.some((t) => mexeuEmTela(devolutivas[t] ?? null));
  return [
    `# Rodada: ${assuntoDe(r.rodada).replace(/-/g, ' ')}`,
    '',
    vereditoDoTopo(r, pastaDaRodada),
    '',
    `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} · ${ids.length} ${ids.length === 1 ? 'sessão' : 'sessões'} · ${hora(r.aprovadaEm)} → ${hora(fim)} · ${duracao(fim - r.aprovadaEm)}`,
    '',
    '| Tarefa | Sessão | Tempo | O que fez | Arquivos | Testes | Aceite |',
    '|---|---|---|---|---|---|---|',
    ...linhas,
    '',
    `Tempo = da sessão aberta pela vila até a devolutiva; início = o clique no cartão, fim = ${r.gate?.final?.fim ? 'o fim do gate' : 'a última tarefa pronta'}.`,
    '',
    `**Ficou de fora / pendências:** ${fora.length ? fora.map(([t, f]) => `${t}: ${f}`).join(' · ') : 'nada'}`,
    `**Roteiro de testes:** ${tela ? 'a fazer (o cartão está na estante de partitura do porão)' : 'não se aplica: nenhuma tarefa mexeu em tela'}`,
    '**Commits:** pelo pombal, a fazer.',
    '',
    ...secaoDoGate(r, pastaDaRodada),
    ...secaoDeCusto(r),
    `Montado pela vila com as devolutivas das sessões (\`${pastaDaRodada}/devolutivas/\`).`,
    '',
  ].join('\n');
}
