import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MORADORES_DIR } from './moradores.js';

/**
 * Porão da casa (MA-1, `docs-dev/a-codar/maestro.md`): onde o maestro coordena até 5 sessões em paralelo no projeto.
 * Quem mora no porão não aparece no mapa nem dentro da casa, só lá embaixo (decisão do usuário, 03/11/2026).
 *
 * Dois jeitos de uma sessão ser do porão:
 * - **maestro**: aberto pelo clique no maestro ✦ do porão; a vila anota o id em `porao.json` (único escritor: a vila);
 * - **tarefa**: sessão que nasceu do briefing de uma rodada. O primeiro prompt é a frase fixa que o maestro manda
 *   rodar (`~/Documents/IA/claude/agents/maestro.md`, etapa 5); ela é lida do `.jsonl`, aqui na máquina, como o título.
 */

/** Nome do agente (`--agent`), instalado pelo `instalar.sh` do repositório de regras. */
export const MAESTRO = 'maestro';
export const PORAO_FILE = path.join(MORADORES_DIR, 'porao.json');
export const MAESTRO_AGENT_FILE = path.join(os.homedir(), '.claude', 'agents', `${MAESTRO}.md`);

export type PapelNoPorao = { papel: 'maestro' } | { papel: 'tarefa'; rodada: string; tarefa: string };

// "Você trabalha sob o maestro. Leia e siga: ~/.claude/maestro/rodadas/<id>/briefings/<tarefa>.md"
const BRIEFING_RE = /^Você trabalha sob o maestro\. Leia e siga: \S*?\.claude\/maestro\/rodadas\/([\w.-]+)\/briefings\/([\w.-]+)\.md/;

/** Rodada e tarefa de uma sessão de trabalho, pelo primeiro prompt; null = não nasceu de briefing do maestro. */
export function briefingDe(primeiroPrompt: string | null): { rodada: string; tarefa: string } | null {
  const m = primeiroPrompt ? BRIEFING_RE.exec(primeiroPrompt.trim()) : null;
  return m ? { rodada: m[1]!, tarefa: m[2]! } : null;
}

interface Registro {
  maestros: Record<string, { projeto: string; criadoEm: string }>;
}

export class Porao {
  constructor(
    private file = PORAO_FILE,
    private agentFile = MAESTRO_AGENT_FILE,
  ) {}

  private async ler(): Promise<Registro> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      return { maestros: raw && typeof raw.maestros === 'object' && raw.maestros ? raw.maestros : {} };
    } catch {
      return { maestros: {} };
    }
  }

  /** Ids das sessões de maestro abertas pela vila. */
  async maestros(): Promise<Set<string>> {
    return new Set(Object.keys((await this.ler()).maestros));
  }

  async registrarMaestro(sessionId: string, projeto: string): Promise<void> {
    const reg = await this.ler();
    reg.maestros[sessionId] = { projeto, criadoEm: new Date().toISOString() };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(reg, null, 2) + '\n');
    await fs.rename(tmp, this.file);
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
}
