import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MORADORES_DIR } from './moradores.js';

/**
 * Notas do quadro de avisos da praça (21/11/2026): recados soltos do usuário, sem projeto, só criar e excluir
 * (decisão do usuário). Moram fora do repositório, em `~/.claude/dev-valley/notas.json`: nota costuma citar projeto
 * privado, e este repositório é público (regra 1). Só a vila escreve aqui.
 */
export const NOTAS_FILE = path.join(MORADORES_DIR, 'notas.json');

/** Tamanho máximo do texto de uma nota: cabe num papel do quadro com folga. */
export const NOTA_MAX = 2000;

export interface Nota {
  id: string;
  texto: string;
  /** ISO, gravado pela vila na criação. */
  criadaEm: string;
}

export class Notas {
  constructor(private file = NOTAS_FILE) {}

  /** Na ordem em que foram presas no quadro (a mais antiga primeiro). Arquivo ausente ou estragado = quadro vazio. */
  async list(): Promise<Nota[]> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8')) as unknown;
      if (!Array.isArray(raw)) return [];
      return raw.filter(
        (n): n is Nota => !!n && typeof n.id === 'string' && typeof n.texto === 'string' && typeof n.criadaEm === 'string',
      );
    } catch {
      return [];
    }
  }

  private async save(notas: Nota[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(notas, null, 2));
  }

  /** O texto já chega validado pela rota (não vazio, até `NOTA_MAX`). */
  async criar(texto: string): Promise<Nota> {
    const nota: Nota = { id: randomUUID(), texto, criadaEm: new Date().toISOString() };
    await this.save([...(await this.list()), nota]);
    return nota;
  }

  /** Devolve se a nota existia (só grava quando muda). */
  async excluir(id: string): Promise<boolean> {
    const notas = await this.list();
    const resto = notas.filter((n) => n.id !== id);
    if (resto.length === notas.length) return false;
    await this.save(resto);
    return true;
  }
}
