import fs from 'node:fs/promises';
import path from 'node:path';
import type { Conta } from './config.js';
import { askAgent } from './consulta.js';
import type { PedidoPorao } from './porao.js';

/**
 * Crítica do cartão (decisão do usuário, 21/11/2026; plano em `docs-dev/context/critica-do-cartao.md`). Antes do clique
 * no cartão do porão, uma segunda opinião de outra família de modelo: o crítico (conta de `agentes.conta`, DeepSeek
 * Flash) confere as tarefas contra um checklist fechado, e o verificador (Haiku, conta Claude) confere cada apontamento
 * no arquivo citado. No cartão só entra o confirmado, como aviso: **nunca bloqueia o clique** nem mexe no briefing.
 * Os dois só leem (Read, Grep, Glob, modo estrito). Cada crítica fica em `critica-<pedido>.json` na pasta da rodada,
 * com a decisão do usuário, para medir se o crítico fica (regra 7 do plano).
 */

export const ITENS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'R1'] as const;
export const TETO_DE_APONTAMENTOS = 5;
const MAX_TEXTO = 500;

export interface Apontamento {
  item: string;
  /** null = da rodada (R1). */
  tarefa: string | null;
  problema: string;
  evidencia: string;
}

export interface CriticaDoCartao {
  estado: 'conferindo' | 'pronta' | 'falhou';
  /** Só os confirmados pelo verificador: é o que o cartão mostra. */
  apontamentos: Apontamento[];
  /** O que o crítico levantou (com evidência) e o que o verificador fez com isso. */
  levantados: number;
  refutados: number;
  incertos: number;
  /** O crítico disse que havia mais que o teto. */
  foraDoTeto: number;
  erro?: string;
  inicio: string;
  fim?: string;
}

export type AgenteDaCritica = 'critico-do-cartao' | 'verificador-do-cartao';
/** Uma consulta de uma resposta: o texto final do agente. Os testes trocam por uma imitação. */
export type Perguntar = (agente: AgenteDaCritica, preamble: string, pergunta: string) => Promise<string>;

const curto = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO);

/** O primeiro objeto JSON da resposta (com ou sem cerca de código); null = não veio JSON. */
export function lerJson(texto: string): Record<string, unknown> | null {
  const cerca = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const corpo = cerca ? cerca[1]! : texto;
  const ini = corpo.indexOf('{');
  const fim = corpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    const o = JSON.parse(corpo.slice(ini, fim + 1));
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Os apontamentos do crítico que valem: item do checklist, tarefa do cartão (ou null no R1) e **evidência** (regra 4:
 * sem trecho citado, o item passa). O que passar do teto conta em `foraDoTeto`.
 */
export function apontamentosValidos(resposta: Record<string, unknown> | null, tarefas: string[]): { apontamentos: Apontamento[]; foraDoTeto: number } | null {
  if (!resposta || !Array.isArray(resposta.apontamentos)) return null;
  const validos: Apontamento[] = [];
  for (const a of resposta.apontamentos as unknown[]) {
    const o = a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
    const item = String(o.item ?? '').toUpperCase();
    const tarefa = typeof o.tarefa === 'string' && tarefas.includes(o.tarefa) ? o.tarefa : null;
    const problema = curto(o.problema);
    const evidencia = curto(o.evidencia);
    if (!(ITENS as readonly string[]).includes(item) || !problema || !evidencia) continue;
    if (item !== 'R1' && !tarefa) continue;
    validos.push({ item, tarefa, problema, evidencia });
  }
  const declarado = Number(resposta.foraDoTeto);
  const fora = Math.max(0, validos.length - TETO_DE_APONTAMENTOS) + (Number.isFinite(declarado) && declarado > 0 ? Math.floor(declarado) : 0);
  return { apontamentos: validos.slice(0, TETO_DE_APONTAMENTOS), foraDoTeto: fora };
}

/** O cartão como o crítico lê: sem dizer quem o escreveu nem com qual modelo (regra 2). */
export function cartaoParaCritica(pedido: PedidoPorao, rodadasDir: string): string {
  const briefings = path.join(rodadasDir, pedido.rodada, 'briefings');
  const tarefas = pedido.tarefas.map((t) => {
    const p = pedido.permissoes[t];
    const deps = pedido.dependencias[t] ?? [];
    return [
      `### Tarefa ${t}`,
      `Briefing: ${path.join(briefings, `${t}.md`)}`,
      `Editar: ${p ? p.arquivos.join(', ') || '(nenhum)' : '(nada liberado: pede permissão para tudo)'}`,
      `Testes: ${p?.testes.length ? p.testes.join(' | ') : '(nenhum comando)'}`,
      `dependeDe: ${deps.length ? deps.join(', ') : '(nenhuma)'}`,
    ].join('\n');
  });
  return [`Projeto: ${pedido.pasta}`, `Rodada: ${pedido.rodada}`, `Os arquivos de "Editar" são relativos à pasta do projeto.`, ...tarefas].join('\n\n');
}

function paraVerificar(apontamentos: Apontamento[], pedido: PedidoPorao, rodadasDir: string): string {
  return [
    `Projeto: ${pedido.pasta}`,
    `Briefings: ${path.join(rodadasDir, pedido.rodada, 'briefings')}`,
    ...apontamentos.map((a, i) => `${i + 1}. [${a.item}${a.tarefa ? ` · tarefa ${a.tarefa}` : ''}] ${a.problema}\n   Evidência: ${a.evidencia}`),
  ].join('\n\n');
}

/** Os vereditos do verificador por número; o que ele não respondeu fica incerto. */
export function vereditos(resposta: Record<string, unknown> | null, n: number): ('confirmado' | 'refutado' | 'incerto')[] {
  const out = Array.from({ length: n }, () => 'incerto' as 'confirmado' | 'refutado' | 'incerto');
  const lista = resposta && Array.isArray(resposta.veredictos) ? (resposta.veredictos as unknown[]) : [];
  for (const v of lista) {
    const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    const i = Number(o.n) - 1;
    const veredito = String(o.veredito ?? '').toLowerCase();
    if (Number.isInteger(i) && i >= 0 && i < n && (veredito === 'confirmado' || veredito === 'refutado')) out[i] = veredito;
  }
  return out;
}

/** Roda crítico e verificador; nunca lança (falha vira `estado: 'falhou'`, e o cartão segue sem aviso). */
export async function criticar(pedido: PedidoPorao, perguntar: Perguntar, rodadasDir: string, agora = () => new Date()): Promise<CriticaDoCartao> {
  const base = { apontamentos: [], levantados: 0, refutados: 0, incertos: 0, foraDoTeto: 0, inicio: agora().toISOString() };
  try {
    const resposta = await perguntar('critico-do-cartao', cartaoParaCritica(pedido, rodadasDir), 'Confira o cartão pelo checklist.');
    const lidos = apontamentosValidos(lerJson(resposta), pedido.tarefas);
    if (!lidos) return { ...base, estado: 'falhou', erro: 'O crítico respondeu fora do formato.', fim: agora().toISOString() };
    const { apontamentos, foraDoTeto } = lidos;
    if (!apontamentos.length) return { ...base, foraDoTeto, estado: 'pronta', fim: agora().toISOString() };
    const v = vereditos(lerJson(await perguntar('verificador-do-cartao', paraVerificar(apontamentos, pedido, rodadasDir), 'Confira cada apontamento.')), apontamentos.length);
    return {
      ...base,
      estado: 'pronta',
      apontamentos: apontamentos.filter((_, i) => v[i] === 'confirmado'),
      levantados: apontamentos.length,
      refutados: v.filter((x) => x === 'refutado').length,
      incertos: v.filter((x) => x === 'incerto').length,
      foraDoTeto,
      fim: agora().toISOString(),
    };
  } catch (e) {
    return { ...base, estado: 'falhou', erro: curto(e instanceof Error ? e.message : e), fim: agora().toISOString() };
  }
}

/** Registro para a medição: a crítica e o que o usuário decidiu no cartão (aguardando, aprovado ou recusado). */
export async function gravarCritica(pedido: PedidoPorao, rodadasDir: string): Promise<void> {
  if (!pedido.critica) return;
  const pasta = path.join(rodadasDir, pedido.rodada);
  const arquivo = path.join(pasta, `critica-${pedido.id}.json`);
  const tmp = `${arquivo}.${process.pid}.tmp`;
  await fs.mkdir(pasta, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify({ pedido: pedido.id, rodada: pedido.rodada, tarefas: pedido.tarefas, decisao: pedido.estado, critica: pedido.critica }, null, 2) + '\n');
  await fs.rename(tmp, arquivo);
}

/** A consulta de verdade: `claude -p` pela base de `consulta.ts`, só leitura e em modo estrito. */
export function perguntarDeVerdade(contaDoCritico: Conta, contaDoVerificador: Conta, hooksToIgnore: Set<string>): Perguntar {
  return (agente, preamble, pergunta) =>
    new Promise((resolve, reject) => {
      askAgent(
        {
          name: agente,
          who: agente === 'critico-do-cartao' ? 'O crítico do cartão' : 'O verificador do cartão',
          preamble,
          estrito: true,
          conta: agente === 'critico-do-cartao' ? contaDoCritico : contaDoVerificador,
          stepFor: (tool) => tool,
        },
        pergunta,
        [],
        (e) => {
          if (e.type === 'answer') resolve(e.text);
          else if (e.type === 'error') reject(new Error(e.text));
        },
        hooksToIgnore,
      );
    });
}

/**
 * Liga a crítica a um pedido: marca "conferindo", roda em segundo plano, grava e avisa o mundo. Pedido do roteiro de
 * testes não passa pela crítica (não tem tarefas nem briefings).
 */
export function criticaDoPorao(perguntar: Perguntar, rodadasDir: string, aoMudar: () => void) {
  return {
    iniciar(pedido: PedidoPorao): void {
      if (pedido.roteiro || pedido.fecharSprint || pedido.critica) return;
      pedido.critica = { estado: 'conferindo', apontamentos: [], levantados: 0, refutados: 0, incertos: 0, foraDoTeto: 0, inicio: new Date().toISOString() };
      void criticar(pedido, perguntar, rodadasDir).then(async (c) => {
        pedido.critica = c;
        await gravarCritica(pedido, rodadasDir).catch(() => {});
        aoMudar();
      });
    },
    /** Depois do clique: anota a decisão no registro da crítica (sem crítica, nada). */
    async anotarDecisao(pedido: PedidoPorao): Promise<void> {
      await gravarCritica(pedido, rodadasDir).catch(() => {});
    },
  };
}
