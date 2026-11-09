import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Passagem de bastão (BT-1, decisão do usuário de 08/11/2026): com o contexto enchendo, o clique em "Passar o bastão"
 * pede à própria sessão um resumo para quem continua; quando o arquivo aparece, a vila abre um morador novo na mesma
 * pasta, já lendo o resumo. Nunca automático: só o clique começa (o aviso aos 70% é só aviso, no front).
 */

/** Sem o resumo em tanto tempo, o pedido caduca (a sessão pode ter sido interrompida). */
const VALIDADE_MS = 15 * 60_000;

/** O que a vila escreve no terminal da sessão: uma linha só, para o Enter mandar. */
export function pedidoDoBastao(arquivo: string): string {
  return (
    `Passe o bastão: escreva em ${arquivo} um resumo para quem continua este trabalho numa sessão nova, em português ` +
    'e curto, com as seções Objetivo, O que foi feito, O que ficou aberto, Arquivos tocados, Próximo passo e Cuidados ' +
    '(decisões tomadas e armadilhas). Só o resumo: não mude mais nada. Depois responda apenas "bastão passado".'
  );
}

/** A primeira mensagem do morador novo. */
export function promptDoSucessor(nome: string, arquivo: string): string {
  return `Você continua o trabalho do morador ${nome}. Antes de tudo, leia o bastão em ${arquivo} e responda em até 3 linhas onde ele parou e qual é o próximo passo. Depois espere.`;
}

interface Pedido {
  de: string;
  nome: string;
  cwd: string;
  arquivo: string;
  em: number;
}

export type AbrirSessao = (o: { sessionId: string; cwd: string; prompt: string; permitir: string[] }) => Promise<string | null>;

export class Bastao {
  private pedidos = new Map<string, Pedido>();

  constructor(
    private dir = path.join(os.homedir(), '.claude', 'dev-valley', 'bastao'),
    private agora = () => Date.now(),
  ) {}

  arquivoDe(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.md`);
  }

  /** Esperando o resumo desta sessão. */
  pendente(sessionId: string): boolean {
    return this.pedidos.has(sessionId);
  }

  /** Anota o pedido e devolve o texto a escrever no terminal. A pasta é criada aqui, para a sessão só escrever o arquivo. */
  async pedir(de: string, nome: string, cwd: string): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true });
    const arquivo = this.arquivoDe(de);
    this.pedidos.set(de, { de, nome, cwd, arquivo, em: this.agora() });
    return pedidoDoBastao(arquivo);
  }

  /**
   * Para cada pedido cujo resumo já foi escrito (arquivo mais novo que o pedido), abre o sucessor. Devolve os que
   * abriram. O sucessor só tem leitura liberada no arquivo do bastão; o resto pede permissão como sempre.
   */
  async conferir(abrir: AbrirSessao): Promise<{ de: string; sucessor: string }[]> {
    const abertos: { de: string; sucessor: string }[] = [];
    for (const p of [...this.pedidos.values()]) {
      if (this.agora() - p.em > VALIDADE_MS) {
        this.pedidos.delete(p.de);
        continue;
      }
      const st = await fs.stat(p.arquivo).catch(() => null);
      // 1 s de folga: o relógio do arquivo e o do servidor podem diferir um pouco.
      if (!st || st.size === 0 || st.mtimeMs < p.em - 1000) continue;
      this.pedidos.delete(p.de);
      const sucessor = randomUUID();
      const erro = await abrir({ sessionId: sucessor, cwd: p.cwd, prompt: promptDoSucessor(p.nome, p.arquivo), permitir: [`Read(/${p.arquivo})`] });
      if (!erro) abertos.push({ de: p.de, sucessor });
    }
    return abertos;
  }
}
