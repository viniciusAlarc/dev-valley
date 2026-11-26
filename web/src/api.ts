import type { LimiteRitmo } from './ui/gasto-texto';

export interface FileChange {
  path: string;
  status: string;
}

/** Provedor da API: decide a roupa do morador (quente no Claude, fria no DeepSeek). */
export type Provedor = 'claude' | 'deepseek';
/** Finalidade da conta: casa pessoal só abre contas pessoais; casa de trabalho, contas de trabalho. */
export type Finalidade = 'pessoal' | 'trabalho';

/** Conta do Claude Code, sem o caminho de configuração (espelha `ContaResumo` em server/src/world.ts). */
export interface ContaResumo {
  nome: string;
  provedor: Provedor;
  finalidade: Finalidade;
}

/**
 * Compatibilidade até o reinício da vila (19/11/2026): o front novo já está em `web/dist` e o servidor antigo continua
 * servindo o mundo com `perfil`/`perfis` até o usuário reiniciar. Onde o campo novo falta, o legado é traduzido.
 */
export const contaDeLegado = (perfil: 'pessoal' | 'profissional' | undefined): ContaResumo =>
  perfil === 'pessoal'
    ? { nome: 'DeepSeek', provedor: 'deepseek', finalidade: 'pessoal' }
    : { nome: 'Claude', provedor: 'claude', finalidade: 'trabalho' };

export interface Project {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  /** Conta que abre a casa por padrão (pela raiz; sem raiz, o Claude). Opcional só na janela do servidor antigo. */
  contaPadrao?: ContaResumo;
  /** Contas que a casa oferece na sessão nova (as da mesma finalidade da padrão; a pessoal, também as DeepSeek de trabalho). Opcional na janela do servidor antigo. */
  contas?: ContaResumo[];
  /** @deprecated Servidor antigo, até o reinício: `contaPadrao`/`contas` passam a valer no lugar. */
  perfil?: 'pessoal' | 'profissional';
  branch: string | null;
  remote: string | null;
  changes: FileChange[];
  /** Linhas abertas do `PENDENCIAS.md`; null = o projeto não tem o arquivo. */
  pendencias: Pendencia[] | null;
  /** `docs-dev/painel.json` (plano e fases); null = o projeto não tem o arquivo. */
  painel: Painel | null;
  /** Documentos citados no `painel.json` (`doc` do plano e das fases) que o quadro negro abre. */
  quadro: PlanoAcao[];
  /** Resumo do `PROGRESS.md` (as entregas vêm por `api.progress`); null = o projeto não tem o arquivo. */
  progress: { entries: number; lastDate: string; toCheck: { date: string; title: string }[] } | null;
  /** Arquivos de acompanhamento que faltam (casa em obra); vazio = estrutura completa. */
  missingStructure: string[];
  /** Planos em `docs-dev/a-codar/` (caixa de sementes); null = o projeto não tem a pasta. `toCheck`: algum passo ainda
   * diz "falta conferir na vila". */
  sementes: { path: string; title: string; toCheck: boolean }[] | null;
  /** Relatórios das rodadas do maestro em `docs-dev/maestro/` (estante de partitura do porão), o mais novo primeiro; `lido` = já
   * aberto pela vila; null = sem a pasta. */
  relatorios: { path: string; title: string; data: string | null; lido: boolean }[] | null;
  /** `docs-dev/context/` (estante): `html` abre isolado, `md` no leitor; null = o projeto não tem a pasta. */
  estante: { path: string; title: string; kind: 'html' | 'md' }[] | null;
  /** `RETRABALHO.md` (lixeira da casa): cabeçalho e linhas como estão no arquivo; null = sem o arquivo. */
  retrabalho: { header: string[]; rows: string[][] } | null;
  /** Vencimento da auditoria das regras, `AAAA-MM-DD` (placa de vistoria); null = sem o arquivo. */
  auditoria: string | null;
  /** Pombal (pull e push da branch com o upstream dela); null = sem git ou branch sem upstream. */
  pombal: Pombal | null;
  /** Tabela "Subir" do `OPERACAO.md` com o estado das portas (lareira); null = sem lado com comando. */
  lareira: { lados: Lado[] } | null;
}

/** Pombal no quintal, em dois estágios: local (cartas no chão) e enviado (o time já tem). */
export interface Pombal {
  branch: string;
  /** `origin/desenv`, `origin/main`...; null = branch sem upstream (só guarda o commit aqui). */
  upstream: string | null;
  /** Arquivos que só você tem, com e sem commit: uma carta no chão para cada. */
  locais: number;
  /** Commits do upstream que a branch ainda não tem (pombo com carta no telhado). */
  aReceber: number;
  buscadoEm: number | null;
  /** Falha do fetch automático: só no texto, sem "!". */
  falhaBusca: string | null;
  /** Falha da última viagem disparada: acende o "!". */
  erro: string | null;
}

export interface Carta {
  hash: string;
  autor: string;
  data: string;
  assunto: string;
}

/** Resultado de uma viagem do pombo; `error` = não completou (o repositório ficou como estava). */
export interface Voo {
  passos: string[];
  error?: string;
  conflitos?: string[];
}

export interface ProgressEntry {
  date: string;
  title: string;
  /** Markdown da entrega, sem o título. */
  body: string;
}

export type PhaseState = 'feito' | 'andamento' | 'a fazer';

/** Subfase (`etapas` da fase ou de outra etapa), em quantos níveis o `painel.json` tiver. */
export interface Etapa {
  nome: string;
  estado: PhaseState;
  etapas: Etapa[];
}

export interface Painel {
  plano: { nome: string; doc: string | null; fases: { nome: string; estado: PhaseState; doc: string | null; etapas: Etapa[] }[] } | null;
  entregas: { data: string; o_que: string; como: string }[];
  /** O arquivo inteiro como está, campos fora do formato inclusive (quadro negro). */
  json: string;
}

/** Documento citado no `painel.json` (`doc` do plano ou de uma fase): `html` abre isolado no quadro, `md` no leitor. */
export interface PlanoAcao {
  fase: string;
  /** O `doc` como está no `painel.json`. */
  doc: string;
  path: string;
  kind: 'html' | 'md';
}

/** Um lado da tabela "Subir" (back, front…): `comando` null = a vila não liga; `problema` = não dá para ligar. */
export interface Lado {
  lado: string;
  pasta: string;
  cwd: string | null;
  comando: string | null;
  porta: number | null;
  ocupada: boolean;
  pid: number | null;
  problema: string | null;
  /** O que a vila ligou: `rodando` ou `saiu` (com o código); null = a vila não ligou este lado. */
  vila: { estado: 'rodando'; pid: number } | { estado: 'saiu'; codigo: number } | null;
}

export type EstadoLareira = 'apagada' | 'acendendo' | 'acesa' | 'erro';

/**
 * Estado da lareira (tabela do plano `lareira-subir-sistema.md`), contando só os lados que podem ser ligados (com
 * comando e sem problema). Erro = algum lado ligado pela vila saiu com código diferente de 0. Acesa = todas as portas
 * ocupadas (pela vila ou por fora dela). Acendendo = parte rodando ou ocupada. Apagada = nada.
 */
export function estadoLareira(lareira: { lados: Lado[] }): EstadoLareira {
  const lados = lareira.lados.filter((l) => l.comando && !l.problema);
  if (lados.some((l) => l.vila?.estado === 'saiu' && l.vila.codigo !== 0)) return 'erro';
  if (lados.length && lados.every((l) => l.ocupada)) return 'acesa';
  if (lados.some((l) => l.ocupada || l.vila?.estado === 'rodando')) return 'acendendo';
  return 'apagada';
}

export interface Pendencia {
  id: string;
  /** 1 (crítico) a 4 (baixo). */
  priority: number;
  owner: 'user' | 'code' | 'infra' | null;
  item: string;
  openedAt: string;
}

/** Pendências P1 (crítico) abertas: só elas acendem o sinal na fachada da casa (decisão de 25/10/2026). */
export function urgentPendencias(project: Project): Pendencia[] {
  return (project.pendencias ?? []).filter((p) => p.priority === 1);
}

/** Conta padrão da casa, com o `perfil` do servidor antigo como fallback. */
export const contaPadraoDaCasa = (p: Project): ContaResumo => p.contaPadrao ?? contaDeLegado(p.perfil);

/** Contas oferecidas pela casa; no servidor antigo, só a padrão (os extras não são traduzíveis). */
export const contasDaCasa = (p: Project): ContaResumo[] => (p.contas?.length ? p.contas : [contaPadraoDaCasa(p)]);

/** Conta da sessão, com o `perfil` do servidor antigo como fallback; null = sessão sem conta conhecida. */
export const contaDaSessao = (s: Session): ContaResumo | null => s.conta ?? (s.perfil ? contaDeLegado(s.perfil) : null);

/** Provedor da sessão, para a paleta; sem conta, Claude (o padrão de sempre). */
export const provedorDaSessao = (s: Session): Provedor => contaDaSessao(s)?.provedor ?? 'claude';

/**
 * Pendência que espera o usuário conferir (sino, 22/11/2026): aberta, dona 👤 e dizendo "falta … conferir" ("falta
 * conferir na tela", "Falta: reiniciar a vila e conferir"). É como os outros repositórios marcam o que espera validação;
 * no `PROGRESS.md` deles a redação é livre e quase sempre aponta para uma pendência destas.
 */
const FALTA_CONFERIR = /\bfalta\b[^.|]{0,60}?\bconfer(?:ir|ência|encia)\b/i;
export function pendenciasAConferir(project: Project): Pendencia[] {
  return (project.pendencias ?? []).filter((p) => p.owner === 'user' && FALTA_CONFERIR.test(p.item));
}

/**
 * Sino da praça: entregas do `PROGRESS.md` esperando conferência e pendências a conferir, de todas as casas, mais o
 * reinício pendente do próprio Dev Valley.
 */
export function bellCount(world: World): number {
  const entries = world.projects.reduce((n, p) => n + (p.progress?.toCheck.length ?? 0) + pendenciasAConferir(p).length, 0);
  return entries + (world.restart.server || world.restart.web ? 1 : 0);
}

export interface Session {
  id: string;
  /** Nome do morador, único na vila (dado pelo servidor, server/src/moradores.ts). */
  name: string;
  /** Marca do nome (`f`, `m` ou neutro): a aparência combina com ela. */
  genero: 'f' | 'm' | null;
  /** Conta exata da sessão; `provedor` decide a roupa (fria no DeepSeek). Opcional na janela do servidor antigo. */
  conta?: ContaResumo;
  /** @deprecated Servidor antigo, até o reinício: `conta` passa a valer no lugar. */
  perfil?: 'pessoal' | 'profissional';
  cwd: string;
  title: string;
  gitBranch: string | null;
  lastActivity: number;
  projectId: string | null;
  /** Terminal aberto pela própria vila. */
  inTown: boolean;
  /** Processo do Claude rodando (na vila ou fora, visto pelos hooks). */
  live: boolean;
  /** Estado vindo dos hooks; null quando não há hooks para a sessão. */
  status: SessionStatus | null;
  /** O que está fazendo agora (categoria da ferramenta em uso); null = sem categoria ou parada. */
  atividade: Atividade | null;
  /** Janela de contexto usada; `estimated` quando calculada sem o status line. */
  context: { percent: number; tokens: number; window: number; estimated: boolean } | null;
  model: string | null;
  /** Mora no porão da casa (maestro ou tarefa de uma rodada, MA-1); null = sessão comum. */
  porao: { papel: 'maestro' } | { papel: 'tarefa'; rodada: string; tarefa: string } | null;
  /** Dorme no quarto da casa: processo encerrado, conversa guardada. Opcional na janela do servidor antigo. */
  dormindo?: boolean;
}

/**
 * Quem aparece na casa e no mapa: as sessões do porão ficam só lá embaixo (decisão do usuário, 03/11/2026). O HUD e o
 * pombal continuam contando todas, para o aviso de permissão e o de sessão viva antes do push não sumirem.
 */
export const daCasa = (s: Session) => !s.porao;

/** Quem aparece na sala, na escrivaninha e no mapa: as da casa que não estão dormindo no quarto (21/11/2026). */
export const naSala = (s: Session) => daCasa(s) && !s.dormindo;

/** Quem dorme no quarto da casa, quem dormiu por último primeiro. */
export const noQuarto = (world: World, projectId: string) =>
  world.sessions.filter((s) => s.projectId === projectId && daCasa(s) && s.dormindo).sort((a, b) => b.lastActivity - a.lastActivity);

/** Rodada em andamento no porão do projeto: a conversa do maestro ou alguma sessão de tarefa ainda aberta. */
export function rodadaEmAndamento(world: World, projectId: string): boolean {
  return world.sessions.some((s) => s.projectId === projectId && s.porao && s.live);
}

/** O porão do projeto precisa de você: alguém de lá pede permissão, ou o cartão do maestro espera a sua decisão. */
export function poraoPrecisaDeVoce(world: World, projectId: string): boolean {
  return (
    world.pedidosPorao.some((p) => p.projectId === projectId) ||
    world.sessions.some((s) => s.projectId === projectId && s.porao && s.live && (s.status === 'permission' || (s.porao.papel === 'maestro' && s.id in world.maestroChamando)))
  );
}

/**
 * O maestro está regendo (04/11/2026): alguma sessão de tarefa do projeto está viva e não parou. Enquanto isso, o clique
 * nele abre o mirim, a não ser que ele precise de você (chamado ou permissão).
 */
export function rodadaConduzindo(world: World, projectId: string): boolean {
  return world.sessions.some((s) => s.projectId === projectId && s.porao?.papel === 'tarefa' && s.live && s.status !== 'idle');
}

/** A partir daqui vale começar uma sessão nova (o Claude compacta perto do fim da janela). */
/** A partir daqui o morador mostra o bastão e o painel sugere passá-lo (BT-1, decisão do usuário: 70%, nunca automático). */
export const CONTEXT_WARN = 70;
export const CONTEXT_CRITICAL = 85;

/** Sessão comum aberta pela vila (não do porão) com o contexto a partir de 70%: hora de passar o bastão. */
export function horaDoBastao(s: Session): boolean {
  return s.inTown && !s.porao && !!s.context && s.context.percent >= CONTEXT_WARN;
}

export function contextText(s: Session): string | null {
  if (!s.context) return null;
  const pct = `${s.context.estimated ? '~' : ''}${s.context.percent}%`;
  const filled = Math.round(Math.min(100, s.context.percent) / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  const hint = s.context.percent >= CONTEXT_CRITICAL ? ' — passe o bastão!' : s.context.percent >= CONTEXT_WARN ? ' — hora de passar o bastão' : '';
  return `contexto ${bar} ${pct}${hint}`;
}

export interface UsageRow {
  kind: string;
  group: string;
  label: string;
  percent: number;
  resetsAt: string | null;
  severity: string;
}

export type SessionStatus = 'working' | 'permission' | 'idle';

/** Categoria da ferramenta em uso: o desenho dentro do balão de quem trabalha. */
export type Atividade = 'ler' | 'editar' | 'rodar' | 'web' | 'agente';

/** Estado efetivo para desenhar: sem hooks, sessão viva conta como trabalhando. */
export function activityOf(s: Session): SessionStatus | 'offline' {
  if (s.status) return s.status;
  return s.live ? 'working' : 'offline';
}

/** O maestro pediu sessões para tarefas de uma rodada; só abrem quando o usuário aprova no cartão do porão. */
export interface PedidoPorao {
  id: string;
  projectId: string;
  maestro: string;
  rodada: string;
  tarefas: string[];
  /** Liberado sem pedir permissão, por tarefa: editar só estes arquivos e rodar só estes testes (04/11/2026). */
  permissoes: Record<string, { arquivos: string[]; testes: string[] }>;
  /** Tarefa → as que precisam ficar prontas antes de ela abrir; o clique aprova a ordem junto (maestro v2, 11/11/2026). */
  dependencias?: Record<string, string[]>;
  /** Pedido da sessão do roteiro de testes (05/11/2026): o relatório da rodada. A sessão nasce na casa. */
  roteiro?: string;
  /** Rodada de sprint (SP-1, 26/11/2026): o id da pasta da sprint. */
  sprint?: string;
  /** Pedido de fechar a sprint (SP-1): relatório e pasta da sprint. A sessão nasce na casa, como a do roteiro. */
  fecharSprint?: { relatorio: string; pasta: string };
  criadoEm: number;
  estado: 'aguardando' | 'aprovado' | 'recusado';
  sessoes: Record<string, { sessionId: string } | { erro: string }>;
  /** Segunda opinião do crítico do cartão (21/11/2026): só os apontamentos confirmados; nunca bloqueia o clique. */
  critica?: CriticaDoCartao;
  /** Sessões da rodada abertas ao mesmo tempo (P3, 25/11/2026): passou disso, abre em ondas. */
  simultaneas?: number;
}

export interface CriticaDoCartao {
  estado: 'conferindo' | 'pronta' | 'falhou';
  apontamentos: { item: string; tarefa: string | null; problema: string; evidencia: string }[];
  levantados: number;
  refutados: number;
  incertos: number;
  foraDoTeto: number;
  erro?: string;
}

export interface World {
  projects: Project[];
  sessions: Session[];
  /** Agentes globais e dos projetos (Fábrica, PD-4). */
  agents: AgentSummary[];
  /** Skills globais e dos projetos (Fábrica, parede de ferramentas). */
  skills: SkillSummary[];
  /** Limites do plano, vindos do status line; null até a primeira sessão reportar. */
  usage: { rows: UsageRow[]; updatedAt: number } | null;
  /** Código do Dev Valley mudou depois que a vila subiu: falta o reinício do usuário (sino da praça). */
  restart: { server: boolean; web: boolean };
  /** Outdoor dos guardrails; null = não configurado no config local. */
  guardrails: { enabled: boolean; plugin: string; core: string; items: { id: string; title: string }[] } | null;
  /** NPCs conversando: `de` citou `para` com `@Nome` na mensagem em curso. */
  conversas: { de: string; para: string }[];
  /** Pedidos do maestro para abrir sessões, esperando o cartão do porão (MA-1, fase 3). */
  pedidosPorao: PedidoPorao[];
  /** Maestros que chamaram você no meio da rodada: id → motivo (❗ no maestro, 04/11/2026). */
  maestroChamando: Record<string, string>;
  /** Rodadas do maestro em andamento, conduzidas pela vila (maestro v2): o quadro da estante de partitura. */
  rodadasPorao: RodadaPorao[];
  /** Contas configuradas, Claude primeiro: o seletor da sessão avulsa (banco da praça). Opcional na janela do servidor antigo. */
  contas?: ContaResumo[];
  /** @deprecated Servidor antigo, até o reinício; o front novo usa `contas`. */
  perfisExtras?: { nome: string; configDir: string }[];
}

/** Uma tarefa da rodada como a vila a conduz (servidor: `rodada.ts`). */
export interface TarefaPorao {
  id: string;
  estado: 'esperando' | 'abrindo' | 'aberta' | 'pronta' | 'erro';
  sessionId: string | null;
  dependeDe: string[];
  arquivos: string[];
  abertaEm: number | null;
  prontaEm: number | null;
  erro: string | null;
  /** Aberta, parada sem pedir permissão e sem a devolutiva. */
  parouSemTerminar: boolean;
}

export interface RodadaPorao {
  projectId: string;
  rodada: string;
  aprovadaEm: number;
  relatorio: string | null;
  tarefas: TarefaPorao[];
  /**
   * Gate da rodada (maestro v3): a vila roda os comandos de teste do cartão antes de abrir as sessões (linha de base) e
   * com todas prontas. null = rodada sem comando de teste. `quebrou` = comandos que passavam e falham.
   */
  gate: { estado: 'linha-de-base' | 'trabalhando' | 'conferindo' | 'aprovada' | 'reprovada'; comandos: string[]; quebrou: string[] } | null;
  /** Rodada de sprint (SP-1): as 7 etapas do fluxo; null (ou ausente, servidor antigo) = rodada comum. */
  sprint?: SprintPorao | null;
}

/** Etapa do fluxo da sprint (servidor: `etapasDaSprint` em `rodada.ts`); `arquivo` = documento já gravado. */
export interface EtapaDaSprint {
  id: 'plano' | 'codigo' | 'testes' | 'revisao' | 'roteiro' | 'estudo' | 'guia';
  nome: string;
  feita: boolean;
  arquivo: string | null;
  alerta: boolean;
}

export interface SprintPorao {
  id: string;
  pasta: string;
  etapas: EtapaDaSprint[];
}

/** Link para abrir um arquivo do projeto pela vila (o terminal e os painéis rodam no navegador: nunca `file://`). */
export const linkDoArquivo = (abs: string) => `/api/arquivo?path=${encodeURIComponent(abs)}`;

/** Comandos de teste do pedido, na ordem, sem repetição: o que a vila roda antes e depois (maestro v3). */
export function comandosDoPedido(pedido: PedidoPorao): string[] {
  const out: string[] = [];
  for (const t of pedido.tarefas) for (const c of pedido.permissoes?.[t]?.testes ?? []) if (!out.includes(c)) out.push(c);
  return out;
}

/** Coluna do quadro do porão: o estado gravado pela vila mais o estado ao vivo da sessão. */
export type ColunaDoQuadro = 'esperando' | 'trabalhando' | 'precisa' | 'pronta';

export function colunaDa(t: TarefaPorao, world: World): ColunaDoQuadro {
  if (t.estado === 'pronta') return 'pronta';
  if (t.estado === 'esperando') return 'esperando';
  if (t.estado === 'erro' || t.parouSemTerminar) return 'precisa';
  const s = world.sessions.find((x) => x.id === t.sessionId);
  return s?.status === 'permission' ? 'precisa' : 'trabalhando';
}

/** A rodada em andamento no porão do projeto (a mais nova), ou undefined. */
export function rodadaDoPorao(world: World, projectId: string): RodadaPorao | undefined {
  return (world.rodadasPorao ?? []).find((r) => r.projectId === projectId);
}

/** Avulsas encerradas que continuam soltas na praça (elas não têm casa para onde ir). */
const PLAZA_OFFLINE_LIMIT = 4;

/**
 * Quem aparece no quintal: só sessões vivas (quem precisa de você, quem trabalha, depois os mais recentes).
 * Sessão encerrada fica dentro de casa até ser retomada ou passar de `sessionMaxAgeDays`.
 * Na praça (avulsas, `projectId` null) ficam todas as vivas mais as encerradas mais recentes.
 */
export function yardResidents(world: World, projectId: string | null): Session[] {
  const rank = { permission: 0, working: 1, idle: 2, offline: 3 };
  const sorted = world.sessions
    .filter((s) => s.projectId === projectId && naSala(s))
    .sort((a, b) => rank[activityOf(a)] - rank[activityOf(b)] || b.lastActivity - a.lastActivity);
  if (projectId !== null) return sorted.filter((s) => s.live);
  const live = sorted.filter((s) => s.live).length;
  return sorted.slice(0, Math.max(PLAZA_OFFLINE_LIMIT, live));
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export interface AgentSummary {
  path: string;
  name: string;
  description: string;
  /** null = global; senão o projeto onde o agente mora. */
  projectId: string | null;
  /** Gerado pelo Dev Valley (ex.: a bibliotecária): só leitura. */
  managed: boolean;
  /** Agente da vila (`server/agents/` no repo): só leitura, sem NPC no pátio e sem conversa por `--agent`. */
  village: boolean;
  /** Conta que responde por ele, nos agentes da vila; null nos demais (seguem a conta da sessão). */
  conta: { nome: string; provedor: Provedor } | null;
}

export interface AgentFile extends AgentSummary {
  /** null = herda todas as ferramentas da sessão. */
  tools: string[] | null;
  /** null = o mesmo modelo da sessão. */
  model: string | null;
  instructions: string;
  mtime: number;
}

export interface AgentInput {
  description: string;
  tools: string[] | null;
  model: string | null;
  instructions: string;
}

export const agents = {
  read: (path: string) => request<AgentFile>('GET', `/api/agents/file?path=${encodeURIComponent(path)}`),
  create: (projectId: string | null, name: string, input: AgentInput) => request<{ path: string }>('POST', '/api/agents', { projectId, name, ...input }),
  save: (path: string, mtime: number, input: AgentInput) => request<{ mtime: number }>('PUT', '/api/agents', { path, mtime, ...input }),
  remove: (path: string) => request('DELETE', `/api/agents?path=${encodeURIComponent(path)}`),
  /** Conversa nova com o agente (o servidor escolhe a pasta: o projeto dele, ou a praça se for global). */
  talk: (path: string) => request<{ sessionId: string; projectId: string | null; name: string }>('POST', '/api/agents/session', { path }),
};

export interface SkillSummary {
  /** Caminho do `SKILL.md`. */
  path: string;
  name: string;
  description: string;
  /** null = global; senão o projeto onde a skill mora. */
  projectId: string | null;
  /** Destino do link quando a skill foi instalada por link (só leitura: edita-se na fonte). */
  linkedTo: string | null;
}

export interface SkillFile extends SkillSummary {
  instructions: string;
  /** Arquivos da pasta (a confirmação de apagar mostra o que vai junto). */
  files: string[];
  mtime: number;
}

export interface SkillInput {
  description: string;
  instructions: string;
}

export const skills = {
  read: (path: string) => request<SkillFile>('GET', `/api/skills/file?path=${encodeURIComponent(path)}`),
  create: (projectId: string | null, name: string, input: SkillInput) => request<{ path: string }>('POST', '/api/skills', { projectId, name, ...input }),
  save: (path: string, mtime: number, input: SkillInput) => request<{ mtime: number }>('PUT', '/api/skills', { path, mtime, ...input }),
  remove: (path: string) => request('DELETE', `/api/skills?path=${encodeURIComponent(path)}`),
};

/** Nota do quadro de avisos da praça (21/11/2026). Espelha `server/src/notas.ts`. */
export interface Nota {
  id: string;
  texto: string;
  criadaEm: string;
}

export const notas = {
  list: () => request<{ notas: Nota[] }>('GET', '/api/notas').then((r) => r.notas),
  criar: (texto: string) => request<Nota>('POST', '/api/notas', { texto }),
  excluir: (id: string) => request('DELETE', `/api/notas/${encodeURIComponent(id)}`),
};

/** Plugins e servidores MCP de cada conta (Fábrica, quadro de força; só leitura). Espelha `server/src/plugins.ts`. */
export interface PluginInfo {
  id: string;
  name: string;
  marketplace: string;
  version: string;
  description: string;
  enabled: boolean;
  conta?: ContaResumo;
  /** @deprecated Servidor antigo, até o reinício: `conta` passa a valer no lugar. */
  perfil?: 'pessoal' | 'profissional';
  scope: string;
  installedAt: string | null;
  traz: { skills: number; comandos: number; agentes: number; hooks: boolean; mcp: string[] };
}

export interface McpInfo {
  name: string;
  type: string;
  /** Conta dona da configuração (o `.mcp.json` do repositório aparece na conta padrão da casa). */
  conta?: ContaResumo;
  /** @deprecated Servidor antigo, até o reinício. */
  perfil?: 'pessoal' | 'profissional';
  onde: string;
}

/** Conta de um item da Fábrica, com o legado do servidor antigo. */
export const contaDoItem = (x: { conta?: ContaResumo; perfil?: 'pessoal' | 'profissional' }): ContaResumo => x.conta ?? contaDeLegado(x.perfil);

export const plugins = {
  list: () => request<{ plugins: PluginInfo[]; mcp: McpInfo[] }>('GET', '/api/plugins'),
};

/** Uma conta no moinho. */
export interface GastoConta {
  conta: ContaResumo;
  total: number;
  anterior: number;
  projetos: { projectId: string | null; nome: string; peso: number; sessoes: { id: string; peso: number }[] }[];
}

/** Gasto por projeto na semana do plano (moinho). Espelha `server/src/gasto.ts`. */
export interface GastoView {
  janela: { inicio: number; fim: number; fonte: 'plano' | '7dias' };
  /** Opcional só na janela do servidor antigo; use `contasDoGasto`. */
  contas?: GastoConta[];
  /** @deprecated Servidor antigo, até o reinício: `contas` passa a valer no lugar. */
  perfis?: { perfil: 'pessoal' | 'profissional'; total: number; anterior: number; projetos: GastoConta['projetos'] }[];
  /** Previsão de cada limite do plano (sessão de 5h e semana), pelos números dos limites (os da clínica); vazio até a primeira leitura. */
  limites: LimiteRitmo[];
}

/** As contas do moinho, traduzindo o `perfis` do servidor antigo enquanto ele não reinicia. */
export function contasDoGasto(v: GastoView): GastoConta[] {
  if (v.contas?.length) return v.contas;
  return (v.perfis ?? []).map(({ perfil, ...p }) => ({ conta: contaDeLegado(perfil), ...p }));
}

export const gasto = {
  resumo: () => request<GastoView>('GET', '/api/gasto'),
};

/** Banca de jornal: a edição do dia. Espelha `server/src/jornal.ts`. */
export interface Edicao {
  data: string;
  geradaEm: number;
  desde: number;
  manchete: string;
  /** `titulo` falta nas edições impressas antes da Gazeta do Vale (02/11/2026). */
  noticias: { nome: string; titulo?: string; voce: string; time: string }[];
  semNovidade: string[];
  parados: { nome: string; dias: number }[];
  /** Edição extra, pedida na conversa com o jornaleiro. */
  extra?: boolean;
}

export interface JornalView {
  edicao: Edicao | null;
  extra: Edicao | null;
  gerando: boolean;
  erro: string | null;
}

export const jornal = {
  ver: () => request<JornalView>('GET', '/api/jornal'),
  imprimir: () => request<JornalView>('POST', '/api/jornal/imprimir', {}),
  lido: () => request('POST', '/api/jornal/lido', {}),
  extra: (desde: number, projectId?: string) => request<JornalView>('POST', '/api/jornal/extra', { desde, projectId }),
};

export type SectionKind = 'global' | 'memory' | 'project' | 'root';

export interface LibraryFile {
  path: string;
  rel: string;
  size: number;
  mtime: number;
}

export interface LibrarySection {
  id: string;
  title: string;
  kind: SectionKind;
  base: string;
  projectId?: string;
  files: LibraryFile[];
  missingClaudeMd?: boolean;
}

export interface SearchHit {
  path: string;
  section: string;
  rel: string;
  line: number;
  text: string;
}

export const library = {
  sections: () => request<LibrarySection[]>('GET', '/api/library'),
  read: (path: string) => request<{ path: string; content: string; mtime: number }>('GET', `/api/library/file?path=${encodeURIComponent(path)}`),
  write: (path: string, content: string, mtime: number) => request<{ mtime: number }>('PUT', '/api/library/file', { path, content, mtime }),
  createClaudeMd: (project: string) => request<{ path: string }>('POST', '/api/library/claude-md', { project }),
  search: (q: string, section?: string) =>
    request<SearchHit[]>('GET', `/api/library/search?q=${encodeURIComponent(q)}${section ? `&section=${encodeURIComponent(section)}` : ''}`),
  openVsCode: (path: string) => request('POST', '/api/library/open-vscode', { path }),
};

/** Clínica (09/11/2026): o que `/api/clinica` devolve (ver `server/src/clinica.ts`). */
export interface ComandoRodando {
  pid: number;
  comando: string;
  idadeS: number;
  cpu: number;
  estado: string;
  daSessao: boolean;
}
export interface Paciente {
  id: string;
  name: string;
  projectId: string | null;
  status: SessionStatus | null;
  live: boolean;
  inTown: boolean;
  atividade: Atividade | null;
  contexto: number | null;
  trabalhandoDesde: number;
  ultimoEvento: number;
  processo: { pid: number; cpu: number } | null;
  comandos: ComandoRodando[];
  servidores: ComandoRodando[];
}
export interface Vitais {
  memoria: { totalMb: number; usadaMb: number } | null;
  swap: { totalMb: number; usadaMb: number } | null;
  carga: { umMinuto: number; cpus: number } | null;
  disco: { totalGb: number; livreGb: number } | null;
}
/** Armário da clínica (CL-1): o que roda fora da vila e pode ter sido esquecido. */
export interface Esquecido {
  pid: number;
  comando: string;
  idadeS: number;
  memMb: number;
  pasta: string | null;
  portas: number[];
  morador: string | null;
}
export interface Container {
  nome: string;
  imagem: string;
  status: string;
  portas: string;
  compose: string | null;
}
export interface Armario {
  claudes: Esquecido[];
  servidores: Esquecido[];
  containers: Container[] | null;
  dockerErro: string | null;
}
export interface Triagem {
  vitais: Vitais;
  pacientes: Paciente[];
}

export const api = {
  diff: (project: string, file: string) =>
    request<{ original: string; modified: string }>(
      'GET',
      `/api/diff?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`,
    ),
  openVsCode: (project: string, file?: string) => request('POST', '/api/open-vscode', { project, file }),
  /** Sem `project`: sessão avulsa (nasce na home e mora na praça). */
  /** Rodada nova no porão: sessão com o agente maestro na pasta do projeto. */
  /** Cartão do porão: o clique do usuário decide o pedido (a rota só aceita vindo da página). */
  aprovarPedido: (id: string) => request<{ estado: string; sessoes: PedidoPorao['sessoes'] }>('POST', `/api/porao/pedidos/${encodeURIComponent(id)}/aprovar`),
  /** Apaga as conversas do porão do projeto (maestro e tarefas); só pela página. */
  relatorioLido: (projectId: string, path: string) => request<{ ok: boolean }>('POST', '/api/relatorios/lido', { projectId, path }),
  atenderChamado: (maestro: string) => request<{ ok: boolean }>('POST', '/api/porao/chamar/atendido', { maestro }),
  encerrarRodada: (projectId: string) => request<{ apagadas: number }>('POST', '/api/porao/encerrar', { projectId }),
  /** A crítica do cartão enquanto ele está aberto (ela termina depois de o cartão aparecer). */
  pedidoPorao: (id: string) => request<{ estado: string; critica: CriticaDoCartao | null }>('GET', `/api/porao/pedidos/${encodeURIComponent(id)}`),
  recusarPedido: (id: string) => request<{ estado: string }>('POST', `/api/porao/pedidos/${encodeURIComponent(id)}/recusar`),
  novoMaestro: (projectId: string) => request<{ sessionId: string; projectId: string }>('POST', '/api/porao/maestro', { projectId }),
  /** `conta`: nome da conta escolhida na tela (Claude, DeepSeek pessoal, DeepSeek trabalho); sem ela, a padrão da casa. */
  newSession: (project?: string, conta?: string) => request<{ sessionId: string; cwd: string }>('POST', '/api/sessions', { project, conta }),
  /** Encerra e apaga a conversa de vez. */
  deleteSession: (id: string) => request('DELETE', `/api/sessions/${id}`),
  /** Manda para o quarto: encerra o processo e guarda a conversa; `recusadas` traz o motivo de cada uma que não foi. */
  dormir: (ids: string[]) => request<{ dormindo: number; recusadas: { id: string; motivo: string }[] }>('POST', '/api/sessions/dormir', { ids }),
  /** Título dado pelo usuário, só na vila; vazio volta ao automático. */
  renomearSessao: (id: string, titulo: string) => request<{ ok: boolean }>('PUT', `/api/sessions/${id}/titulo`, { titulo }),
  /** Passagem de bastão: a sessão escreve o resumo e, quando termina, nasce o sucessor na mesma casa (BT-1). */
  /** Clínica: pacientes vivos e sinais vitais (leva ~1 s: a CPU sai de duas leituras do `/proc`). */
  clinica: () => request<Triagem>('GET', '/api/clinica'),
  armario: () => request<Armario>('GET', '/api/clinica/armario'),
  vitais: () => request<Vitais>('GET', '/api/clinica/vitais'),
  passarBastao: (sessionId: string) => request<{ arquivo: string }>('POST', '/api/bastao', { sessionId }),
  progress: (project: string) => request<ProgressEntry[]>('GET', `/api/progress?project=${encodeURIComponent(project)}`),
  /** Sino: troca "Falta conferir na vila" por "Conferido na vila…" nas entregas escolhidas. */
  conferir: (project: string, items: { date: string; title: string }[]) =>
    request<{ marcadas: number }>('POST', '/api/progress/conferir', { project, items }),
  /** Busca o remoto e lista as cartas dos dois sentidos. */
  acenderLareira: (project: string) => request<{ ligados: string[] }>('POST', '/api/lareira/acender', { project }),
  apagarLareira: (project: string) => request<{ ok: boolean }>('POST', '/api/lareira/apagar', { project }),
  cartas: (project: string) => request<{ receber: Carta[]; enviar: Carta[]; arquivos: string[] }>('GET', `/api/pombal?project=${encodeURIComponent(project)}`),
  /** O escrevente sugere a mensagem de commit dos arquivos escolhidos (vazio = todos). */
  sugerirMensagem: (project: string, arquivos: string[]) => request<{ texto: string }>('POST', '/api/pombal/sugerir', { project, arquivos }),
  /** Não lança no 409: o painel mostra o erro junto com os conflitos e os passos que deram certo. */
  voar: async (project: string, acao: 'receber' | 'enviar', opts: { mensagem?: string; arquivos?: string[] } = {}): Promise<Voo> => {
    const res = await fetch('/api/pombal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project, acao, ...opts }) });
    const data = await res.json();
    if (!res.ok && res.status !== 409) throw new Error(data.error ?? `HTTP ${res.status}`);
    if (acao === 'enviar' && !data.error) enviosFeitos.set(project, Date.now());
    return data as Voo;
  },
};

/** Envios que deram certo pela vila, por projeto (hora): o pombo só leva as cartas num push feito por aqui. */
const enviosFeitos = new Map<string, number>();

/** Consome a marca do último envio do projeto; vale por 2 minutos, para um descarte depois não virar voo. */
export function tomarEnvio(project: string): boolean {
  const t = enviosFeitos.get(project);
  enviosFeitos.delete(project);
  return t !== undefined && Date.now() - t < 120_000;
}

export function wsUrl(path: string): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
}

// ---- Estado do mundo (atualizado pelo servidor via WebSocket) ----

let world: World = { projects: [], sessions: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null, conversas: [], pedidosPorao: [], maestroChamando: {}, rodadasPorao: [], contas: [] };
const listeners = new Set<(w: World) => void>();

export function getWorld(): World {
  return world;
}

export function onWorld(fn: (w: World) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setWorld(w: World) {
  world = w;
  for (const fn of listeners) fn(world);
}

export function connectWorld() {
  void request<World>('GET', '/api/world').then(setWorld, () => {});
  const ws = new WebSocket(wsUrl('/ws/events'));
  ws.onmessage = (ev) => setWorld(JSON.parse(ev.data));
  ws.onclose = () => setTimeout(connectWorld, 2000);
}
