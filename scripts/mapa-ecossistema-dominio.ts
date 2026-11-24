// Tipos e funções puras do mapa do ecossistema de IA.
//
// Nada aqui toca o disco, o relógio ou o HOME: tudo entra por parâmetro. É o que permite
// testar com fixture em pasta temporária sem ler projeto de verdade (CLAUDE.md, regras de teste).

export type CamadaId = 'entrada' | 'contexto' | 'acao' | 'rastro' | 'aprendizado';
export type Origem = 'universal' | 'cnr' | 'projeto' | 'pessoal' | 'maquina';
export type Quando = 'sempre' | 'sob-demanda' | 'evento';
export type Cobranca = 'mod' | 'teste' | 'julgamento';
export type DonoPendencia = 'usuario' | 'codigo' | 'servidor';

export interface Peca {
  id: string;
  nome: string;
  papel: string;
  nota?: string;
  caminhos: string[];
  origem: Origem;
  quando: Quando;
  naVila?: string;
  linhas?: number;
  bytes?: number;
  modificadoEm?: string;
  itens?: string[];
  /** Preenchido na versão de apresentação quando a lista de itens foi omitida de propósito. */
  detalheOmitido?: boolean;
}

export interface Guardrail {
  codigo: string;
  titulo: string;
  cobranca: Cobranca;
  onde: string;
}

export interface Fluxo {
  id: string;
  titulo: string;
  passos: string[];
  pecas: string[];
}

export interface Metrica {
  id: string;
  rotulo: string;
  valor: number;
  unidade: string;
  detalhe?: string;
  alerta?: boolean;
}

export interface Sinal {
  id: string;
  rotulo: string;
  valor: string;
  detalhe: string;
  prova: string;
  alerta: boolean;
}

export interface Camada {
  id: CamadaId;
  titulo: string;
  pergunta: string;
  pecas: Peca[];
}

export interface VilaItem {
  peca: string;
  mecanismo: string;
  detalhe: string;
}

export interface Ecossistema {
  versao: 1;
  geradoEm: string;
  metricas: Metrica[];
  camadas: Camada[];
  guardrails: Guardrail[];
  fluxos: Fluxo[];
  sinais: Sinal[];
  vila: VilaItem[];
  avisos: string[];
}

// ---------------------------------------------------------------------------
// Leitura de texto

/** Conta linhas como `wc -l`: linha final sem quebra também conta. */
export function contarLinhas(texto: string): number {
  if (!texto) return 0;
  const partes = texto.split('\n');
  return texto.endsWith('\n') ? partes.length - 1 : partes.length;
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** ISO (com hora) para DD/MM/AAAA, sem depender de fuso. */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function dataHoraBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : dataBr(iso);
}

// ---------------------------------------------------------------------------
// Roteador global (CLAUDE.md)

export interface RoteadorLido {
  imports: string[];
  sobDemanda: { arquivo: string; quando: string }[];
}

export function lerRoteador(texto: string): RoteadorLido {
  const imports = [...texto.matchAll(/^@(.+)$/gm)].map((m) => m[1].trim());
  const sobDemanda: { arquivo: string; quando: string }[] = [];
  for (const linha of texto.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(linha);
    if (m) sobDemanda.push({ arquivo: m[1].trim(), quando: m[2].trim() });
  }
  return { imports, sobDemanda };
}

// ---------------------------------------------------------------------------
// Guardrails (guardrails-core.md)

const TITULO_GUARDRAIL = /^## (G\d+) — (.+)$/;

function classificarCobranca(corpo: string): Cobranca {
  if (/cobrado pelo mod|barrado pelo mod|o mod pergunta/i.test(corpo)) return 'mod';
  if (/\btestes?\b|\bsuíte\b|\bchecklist\b/i.test(corpo)) return 'teste';
  return 'julgamento';
}

export function lerGuardrails(texto: string): { guardrails: Guardrail[]; linhas: number } {
  const guardrails: Guardrail[] = [];
  let atual: { codigo: string; titulo: string; corpo: string[] } | null = null;
  const fechar = () => {
    if (!atual) return;
    const corpo = atual.corpo.join('\n');
    const detalhe = /\bguardrails-ia\/([a-z0-9-]+\.md)\b/i.exec(corpo)?.[1];
    guardrails.push({
      codigo: atual.codigo,
      titulo: atual.titulo,
      cobranca: classificarCobranca(corpo),
      onde: detalhe ? `guardrails-ia/${detalhe}` : 'guardrails-core.md',
    });
  };
  for (const linha of texto.split('\n')) {
    const m = TITULO_GUARDRAIL.exec(linha);
    if (m) {
      fechar();
      atual = { codigo: m[1], titulo: m[2].trim(), corpo: [] };
    } else if (atual) {
      atual.corpo.push(linha);
    }
  }
  fechar();
  return { guardrails, linhas: contarLinhas(texto) };
}

// ---------------------------------------------------------------------------
// Pendências (PENDENCIAS.md)

export interface Pendencia {
  id: string;
  dono: DonoPendencia;
  titulo: string;
  abertoEm: string;
}

export interface PendenciasLidas {
  total: number;
  porDono: Record<DonoPendencia, number>;
  itens: Pendencia[];
}

function limparMarkdown(texto: string): string {
  return texto
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function contarPendencias(texto: string): PendenciasLidas {
  const itens: Pendencia[] = [];
  for (const linha of texto.split('\n')) {
    const m = /^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/.exec(linha);
    if (!m) continue;
    const dono: DonoPendencia | null = m[2].includes('👤')
      ? 'usuario'
      : m[2].includes('💻')
        ? 'codigo'
        : m[2].includes('🖥')
          ? 'servidor'
          : null;
    if (!dono) continue;
    itens.push({ id: m[1], dono, titulo: limparMarkdown(m[3]), abertoEm: m[4] });
  }
  const porDono: Record<DonoPendencia, number> = { usuario: 0, codigo: 0, servidor: 0 };
  for (const item of itens) porDono[item.dono] += 1;
  return { total: itens.length, porDono, itens };
}

// ---------------------------------------------------------------------------
// Auditoria de regras

export function lerDataAuditoria(texto: string): string | null {
  return /\b(\d{4}-\d{2}-\d{2})\b/.exec(texto)?.[1] ?? null;
}

/** Compara só a data (AAAA-MM-DD); `agora` é ISO. Sem `data`, não há o que vencer. */
export function auditoriaVencida(data: string | null, agora: string): boolean {
  return data !== null && agora.slice(0, 10) > data;
}

export function diasAte(data: string, agora: string): number {
  const alvo = Date.parse(`${data}T00:00:00Z`);
  const hoje = Date.parse(`${agora.slice(0, 10)}T00:00:00Z`);
  return Math.round((alvo - hoje) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Máscara do modo apresentação

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rotularProjetos(nomes: string[]): Map<string, string> {
  const ordenados = [...new Set(nomes)].sort();
  return new Map(ordenados.map((nome, i) => [nome, `Casa ${i + 1}`]));
}

/**
 * Devolve uma função que troca caminho pessoal por `~`, o nome do usuário por "você" e
 * cada pasta de projeto por "Casa N". É a fronteira do arquivo de apresentação: o que
 * não passar por aqui não deve ser escrito nele.
 */
export function criarMascara(opcoes: { home: string; usuario: string; projetos: string[] }): (texto: string) => string {
  const trocas: { re: RegExp; valor: string }[] = [
    { re: new RegExp(`/home/${escaparRegex(opcoes.usuario)}(?=[/\\\\]|$)`, 'gi'), valor: '~' },
    { re: new RegExp(`\\\\\\\\wsl\\.localhost\\\\[^\\\\]+\\\\home\\\\${escaparRegex(opcoes.usuario)}(?=[\\\\]|$)`, 'gi'), valor: '~' },
    { re: new RegExp(`\\b${escaparRegex(opcoes.usuario)}\\b`, 'gi'), valor: 'você' },
  ];
  if (opcoes.home) trocas.unshift({ re: new RegExp(escaparRegex(opcoes.home), 'g'), valor: '~' });
  for (const [nome, rotulo] of rotularProjetos(opcoes.projetos)) {
    trocas.push({ re: new RegExp(escaparRegex(nome), 'g'), valor: rotulo });
  }
  return (texto: string) => trocas.reduce((saida, { re, valor }) => saida.replace(re, valor), texto);
}

/**
 * Versão de apresentação: todo texto passa pela máscara e as listas que só fazem sentido
 * na análise (nome de memória, título de pendência) são omitidas, não apenas escondidas.
 */
export function prepararParaApresentacao(eco: Ecossistema, mascara: (texto: string) => string): Ecossistema {
  const m = (texto: string | undefined): string | undefined => (texto === undefined ? undefined : mascara(texto));
  const sensivel = new Set(['pendencias', 'memoria', 'historico-sessoes']);
  return {
    ...eco,
    metricas: eco.metricas.map((x) => ({ ...x, rotulo: mascara(x.rotulo), detalhe: m(x.detalhe) })),
    camadas: eco.camadas.map((camada) => ({
      ...camada,
      titulo: mascara(camada.titulo),
      pergunta: mascara(camada.pergunta),
      pecas: camada.pecas.map((peca) => ({
        ...peca,
        nome: mascara(peca.nome),
        papel: mascara(peca.papel),
        nota: m(peca.nota),
        naVila: m(peca.naVila),
        caminhos: peca.caminhos.map(mascara),
        itens: sensivel.has(peca.id) ? undefined : peca.itens?.map(mascara),
        detalheOmitido: sensivel.has(peca.id) ? true : peca.detalheOmitido,
      })),
    })),
    guardrails: eco.guardrails.map((g) => ({ ...g, titulo: mascara(g.titulo), onde: mascara(g.onde) })),
    fluxos: eco.fluxos.map((f) => ({ ...f, titulo: mascara(f.titulo), passos: f.passos.map(mascara) })),
    sinais: eco.sinais.map((s) => ({
      ...s,
      rotulo: mascara(s.rotulo),
      valor: mascara(s.valor),
      detalhe: mascara(s.detalhe),
      prova: mascara(s.prova),
    })),
    vila: eco.vila.map((v) => ({
      ...v,
      peca: mascara(v.peca),
      mecanismo: mascara(v.mecanismo),
      detalhe: mascara(v.detalhe),
    })),
    avisos: eco.avisos.map(mascara),
  };
}
