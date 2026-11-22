import fs from 'node:fs/promises';
import path from 'node:path';
import { MORADORES_DIR } from './moradores.js';

/**
 * Quarto da casa (21/11/2026): sessões que o usuário mandou dormir. Dormir = o processo `claude` é encerrado (memória e
 * CPU voltam a zero) e a conversa fica intacta no disco; abrir de novo na vila acorda (`claude --resume`) e a sessão
 * volta à sala (decisão do usuário). O quarto não tem prazo: quem dorme aparece mesmo depois do `sessionMaxAgeDays`.
 * Só a vila escreve aqui; o arquivo da conversa do Claude Code nunca é tocado.
 */
export const QUARTO_FILE = path.join(MORADORES_DIR, 'dormindo.json');

export class Quarto {
  /** sessão → quando dormiu (ms). */
  private dormindo: Map<string, number> | null = null;

  constructor(private file = QUARTO_FILE) {}

  private async load(): Promise<Map<string, number>> {
    if (this.dormindo) return this.dormindo;
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8')) as Record<string, unknown>;
      this.dormindo = new Map(Object.entries(raw).filter((e): e is [string, number] => typeof e[1] === 'number'));
    } catch {
      this.dormindo = new Map();
    }
    return this.dormindo;
  }

  private async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(Object.fromEntries(this.dormindo ?? []), null, 2));
  }

  async ids(): Promise<Set<string>> {
    return new Set((await this.load()).keys());
  }

  async dormir(ids: string[]) {
    const m = await this.load();
    const agora = Date.now();
    for (const id of ids) if (!m.has(id)) m.set(id, agora);
    await this.save();
  }

  /** Tira do quarto; devolve se alguma estava lá (só grava quando muda). */
  async acordar(ids: string[]): Promise<boolean> {
    const m = await this.load();
    const mudou = ids.filter((id) => m.delete(id)).length > 0;
    if (mudou) await this.save();
    return mudou;
  }

  /** Esquece quem não existe mais (conversa apagada na vila ou pela limpeza do Claude Code). */
  async manter(existentes: Set<string>) {
    const m = await this.load();
    await this.acordar([...m.keys()].filter((id) => !existentes.has(id)));
  }
}
