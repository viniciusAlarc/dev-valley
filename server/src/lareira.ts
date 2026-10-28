import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Uma linha da tabela "Subir" do `docs-dev/guias/OPERACAO.md` (formato do G14), com o estado da porta. */
export interface Lado {
  lado: string;
  /** Pasta como está na tabela (`.` = raiz do projeto). */
  pasta: string;
  /** Pasta absoluta, sempre dentro do projeto; null quando a da tabela não serve. */
  cwd: string | null;
  /** null = célula vazia: a vila não liga este lado (decisão 5 do plano da lareira). */
  comando: string | null;
  porta: number | null;
  /** Alguém escuta na porta (a vila ou um processo de fora). */
  ocupada: boolean;
  /** Processo na porta, quando o `ss` mostra (só os do próprio usuário). */
  pid: number | null;
  /** Por que este lado não pode ser ligado (pasta fora do projeto, inexistente, porta inválida); null = pode. */
  problema: string | null;
}

/** Lareira da casa (PD-7): os lados da tabela "Subir". */
export interface Lareira {
  lados: Lado[];
}

const OPERACAO = path.join('docs-dev', 'guias', 'OPERACAO.md');

/** Divide uma linha de tabela Markdown pelos `|` que não estão escapados (`\|` é pipe dentro do comando). */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|').replace(/^`(.*)`$/, '$1').trim());
}

/**
 * Lê a tabela "Subir" (primeira tabela depois do título `## Subir`). Só leitura. Retorna null quando o projeto não
 * tem o arquivo, a tabela, ou nenhum lado com comando: nesses casos a casa não ganha lareira.
 */
export async function readLareira(dir: string, portas: Map<number, number | null>): Promise<Lareira | null> {
  let text: string;
  try {
    text = await fs.readFile(path.join(dir, OPERACAO), 'utf8');
  } catch {
    return null;
  }
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^##\s+Subir\b/i.test(l));
  if (start < 0) return null;
  const rows: string[][] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    if (line.trim().startsWith('|')) rows.push(cells(line));
    else if (rows.length) break;
  }
  if (rows.length < 3) return null;
  const header = rows[0].map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const [iLado, iPasta, iComando, iPorta] = ['lado', 'pasta', 'comando', 'porta'].map(col);
  if ([iLado, iPasta, iComando, iPorta].some((i) => i < 0)) return null;

  const base = path.resolve(dir);
  const lados = await Promise.all(
    rows.slice(2).map(async (r): Promise<Lado> => {
      const pasta = r[iPasta] ?? '';
      const comando = r[iComando] || null;
      const portaText = r[iPorta] ?? '';
      const porta = /^\d{1,5}$/.test(portaText) ? Number(portaText) : null;
      const full = path.resolve(base, pasta || '.');
      const dentro = full === base || full.startsWith(base + path.sep);
      const existe = dentro && (await fs.stat(full).catch(() => null))?.isDirectory();
      const problema = !comando
        ? null
        : !dentro
          ? 'pasta fora do projeto'
          : !existe
            ? 'pasta não existe'
            : portaText && porta === null
              ? 'porta inválida'
              : null;
      return {
        lado: r[iLado] ?? '',
        pasta,
        cwd: existe ? full : null,
        comando,
        porta,
        ocupada: porta !== null && portas.has(porta),
        pid: porta !== null ? (portas.get(porta) ?? null) : null,
        problema,
      };
    }),
  );
  return lados.some((l) => l.comando) ? { lados } : null;
}

/** Portas TCP escutando na máquina (`ss -ltnpH`), com o PID quando o processo é do usuário. Falhou = nenhuma. */
export function portasOcupadas(): Promise<Map<number, number | null>> {
  return new Promise((resolve) => {
    execFile('ss', ['-ltnpH'], { timeout: 5000 }, (err, stdout) => {
      const portas = new Map<number, number | null>();
      if (err) return resolve(portas);
      for (const line of stdout.split('\n')) {
        const local = line.trim().split(/\s+/)[3];
        const porta = Number(local?.slice(local.lastIndexOf(':') + 1));
        if (!porta) continue;
        const pid = line.match(/pid=(\d+)/)?.[1];
        if (!portas.has(porta) || pid) portas.set(porta, pid ? Number(pid) : null);
      }
      resolve(portas);
    });
  });
}
