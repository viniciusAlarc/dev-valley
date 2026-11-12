import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Gate da rodada (maestro v3, `docs-dev/context/maestro-v3.md`, item 4): a vila roda os comandos de teste do cartão
 * **antes** de abrir as sessões (linha de base) e **depois** que todas ficam prontas, para o relatório separar o que já
 * estava vermelho do que a rodada quebrou.
 *
 * Os comandos já passaram por `validarPermissoes` (só palavras, sem nada que o shell interprete) e apareceram no cartão
 * que o usuário aprovou. Rodam **sem shell**, um por vez, com limite de tempo; a saída vai para um arquivo da pasta da
 * rodada, nunca para o `rodada.json` (lá fica só comando, código de saída e duração).
 */

/** Limite de cada comando do gate: estourou, conta como falha. */
export const GATE_LIMITE_MS = 15 * 60_000;

export type MomentoDoGate = 'antes' | 'depois';

export interface ResultadoDoComando {
  comando: string;
  /** Código de saída; null = não terminou sozinho (estourou o tempo ou não rodou). */
  codigo: number | null;
  duracaoMs: number;
  estourou?: boolean;
}

export interface EtapaDoGate {
  inicio: number;
  /** Sem `fim`: está rodando (ou a vila caiu no meio e a próxima volta roda de novo). */
  fim?: number;
  resultados?: ResultadoDoComando[];
}

export interface GateDaRodada {
  /** A união dos `testes` das tarefas, sem repetição, na ordem em que aparecem. */
  comandos: string[];
  linhaDeBase?: EtapaDoGate;
  final?: EtapaDoGate;
}

export type Veredito = 'passou' | 'já estava vermelho' | 'quebrou' | 'consertou';

/** Roda um comando; a saída (stdout e stderr) vai para `saida`. */
export type ExecutarComando = (comando: string, cwd: string, saida: string, limiteMs: number) => Promise<ResultadoDoComando>;

/** Comandos do gate: os `testes` das tarefas, na ordem do pedido, cada um uma vez. */
export function comandosDoGate(testesPorTarefa: string[][]): string[] {
  const out: string[] = [];
  for (const ts of testesPorTarefa) for (const t of ts) if (!out.includes(t)) out.push(t);
  return out;
}

/** Arquivo da saída de um comando: `<rodada>/gate/<antes|depois>-<n>.txt` (n = posição na lista, a partir de 1). */
export const saidaDoGate = (rodadaDir: string, momento: MomentoDoGate, i: number) => path.join(rodadaDir, 'gate', `${momento}-${i + 1}.txt`);

/**
 * Roda sem shell: o comando partido em palavras vira programa + argumentos (`spawn` com `shell: false`, o mesmo que o
 * `execFile`, mas com a saída indo direto para o arquivo, sem limite de buffer). No estouro, mata o grupo inteiro
 * (o `npm test` abre outros processos).
 */
export const executarComando: ExecutarComando = async (comando, cwd, saida, limiteMs) => {
  const [prog, ...args] = comando.split(' ');
  await fs.mkdir(path.dirname(saida), { recursive: true });
  const fh = await fs.open(saida, 'w');
  const inicio = Date.now();
  try {
    return await new Promise<ResultadoDoComando>((resolve) => {
      let estourou = false;
      const filho = spawn(prog!, args, { cwd, shell: false, detached: true, stdio: ['ignore', fh.fd, fh.fd] });
      const timer = setTimeout(() => {
        estourou = true;
        try {
          process.kill(-filho.pid!, 'SIGKILL');
        } catch {
          filho.kill('SIGKILL');
        }
      }, limiteMs);
      let feito = false;
      const fim = (codigo: number | null) => {
        if (feito) return; // 'error' e 'close' podem vir os dois
        feito = true;
        clearTimeout(timer);
        resolve({ comando, codigo: estourou ? null : codigo, duracaoMs: Date.now() - inicio, ...(estourou ? { estourou: true } : {}) });
      };
      let falhou = false;
      filho.on('error', (err) => {
        if (feito) return;
        falhou = true;
        void fh.write(`Não rodou: ${err.message}\n`).catch(() => {}).finally(() => fim(null));
      });
      filho.on('close', (codigo) => falhou || fim(codigo));
    });
  } finally {
    await fh.close();
  }
};

/**
 * Antes → depois de um comando. Sem resultado da linha de base (comando que entrou num pedido depois do clique), o
 * depois decide sozinho: passou ou quebrou.
 */
export function veredito(antes: ResultadoDoComando | undefined, depois: ResultadoDoComando): Veredito {
  const ok = (r: ResultadoDoComando | undefined) => r?.codigo === 0;
  if (ok(depois)) return antes && !ok(antes) ? 'consertou' : 'passou';
  return antes && !ok(antes) ? 'já estava vermelho' : 'quebrou';
}

/** Cada comando do gate final com o veredito; aprovada = nenhum `quebrou`. Null = o gate final ainda não terminou. */
export function resultadoDoGate(g: GateDaRodada): { aprovada: boolean; linhas: { comando: string; antes?: ResultadoDoComando; depois: ResultadoDoComando; veredito: Veredito; i: number }[] } | null {
  if (!g.final?.fim || !g.final.resultados) return null;
  const linhas = g.final.resultados.map((depois, i) => {
    const antes = g.linhaDeBase?.resultados?.find((r) => r.comando === depois.comando);
    return { comando: depois.comando, antes, depois, veredito: veredito(antes, depois), i };
  });
  return { aprovada: !linhas.some((l) => l.veredito === 'quebrou'), linhas };
}
