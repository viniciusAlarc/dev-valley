import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import pty, { type IPty } from 'node-pty';
import type { WebSocket } from 'ws';

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
  /** O que a vila ligou: `rodando` (processo vivo) ou `saiu` (com o código de saída); null = a vila não ligou. */
  vila: { estado: 'rodando'; pid: number } | { estado: 'saiu'; codigo: number } | null;
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
        vila: null,
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

const SCROLLBACK_LIMIT = 256 * 1024;

interface Fogo {
  pty: IPty | null;
  /** Código de saída da última vez; null enquanto roda. */
  codigo: number | null;
  /** A vila mandou apagar: a saída que vier (sinal ou 143 do SIGTERM) não é erro. */
  apagando: boolean;
  buffer: string;
  clients: Set<WebSocket>;
}

/**
 * Os lados que a vila ligou (passo 2 do plano da lareira): um processo por lado, em pseudo-terminal, filho do
 * servidor. O comando roda em `bash -c` na pasta da tabela. O processo do pty é líder do próprio grupo, então apagar
 * manda o sinal para o **grupo inteiro** (o `java` ou o `vite` que o `npm` abre por baixo vão junto).
 * A vila nunca mexe em processo que não criou: porta ocupada por outro só aparece como "ligado fora da vila".
 */
export class Lareiras {
  private fogos = new Map<string, Fogo>();

  constructor(private onChange: () => void) {}

  private key(projectId: string, lado: string) {
    return `${projectId}\0${lado}`;
  }

  /** Junta ao que o `readLareira` leu o estado dos lados que a vila ligou. */
  merge(projectId: string, lareira: Lareira | null): Lareira | null {
    if (!lareira) return null;
    return {
      lados: lareira.lados.map((l) => {
        const f = this.fogos.get(this.key(projectId, l.lado));
        // registro só do log (aba aberta antes de acender): a vila ainda não ligou este lado
        if (!f || (!f.pty && f.codigo === null)) return l;
        return { ...l, vila: f.pty ? { estado: 'rodando', pid: f.pty.pid } : { estado: 'saiu', codigo: f.codigo ?? 0 } };
      }),
    };
  }

  /**
   * Liga os lados que têm comando, não têm problema, não estão rodando pela vila e cuja porta está livre.
   * Retorna os lados ligados agora.
   */
  acender(projectId: string, lareira: Lareira): string[] {
    const ligados: string[] = [];
    for (const l of lareira.lados) {
      if (!l.comando || l.problema || !l.cwd || l.ocupada) continue;
      const k = this.key(projectId, l.lado);
      if (this.fogos.get(k)?.pty) continue;
      const proc = pty.spawn('bash', ['-c', l.comando], {
        name: 'xterm-256color',
        cols: 120,
        rows: 32,
        cwd: l.cwd,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>,
      });
      const old = this.fogos.get(k);
      const fogo: Fogo = { pty: proc, codigo: null, apagando: false, buffer: '', clients: old?.clients ?? new Set() };
      const banner = `\x1b[90m$ ${l.comando}\x1b[0m\r\n`;
      fogo.buffer = banner;
      for (const c of fogo.clients) c.send('\x1bc' + banner);
      proc.onData((data) => {
        fogo.buffer = (fogo.buffer + data).slice(-SCROLLBACK_LIMIT);
        for (const c of fogo.clients) c.send(data);
      });
      proc.onExit(({ exitCode, signal }) => {
        fogo.pty = null;
        // Apagado pela vila não é erro, venha como sinal ou como código 143 (o bash sai assim quando o filho leva
        // SIGTERM); saiu sozinho com código diferente de 0 é.
        fogo.codigo = fogo.apagando ? 0 : exitCode;
        const note = `\r\n\x1b[33m[${l.lado} parou — código ${exitCode}${signal ? `, sinal ${signal}` : ''}]\x1b[0m\r\n`;
        fogo.buffer = (fogo.buffer + note).slice(-SCROLLBACK_LIMIT);
        for (const c of fogo.clients) c.send(note);
        this.onChange();
      });
      this.fogos.set(k, fogo);
      ligados.push(l.lado);
    }
    if (ligados.length) this.onChange();
    return ligados;
  }

  /** Apaga os lados deste projeto que a vila ligou; resolve quando todos saíram (SIGKILL no grupo depois de 5s). */
  apagar(projectId: string): Promise<void> {
    const vivos = [...this.fogos.entries()].filter(([k, f]) => k.startsWith(projectId + '\0') && f.pty).map(([, f]) => f);
    return Promise.all(vivos.map((f) => this.matar(f))).then(() => undefined);
  }

  private matar(f: Fogo): Promise<void> {
    const proc = f.pty!;
    f.apagando = true;
    return new Promise((resolve) => {
      const sinal = (s: NodeJS.Signals) => {
        try {
          process.kill(-proc.pid, s);
        } catch {
          // grupo já saiu
        }
      };
      const force = setTimeout(() => sinal('SIGKILL'), 5000);
      proc.onExit(() => {
        clearTimeout(force);
        resolve();
      });
      sinal('SIGTERM');
    });
  }

  /**
   * Log de um lado no painel da lareira: recebe o histórico e depois ao vivo. Aceita teclado (28/10/2026): sistema que
   * pergunta algo ao subir (o `ng serve` pergunta do autocompletar na primeira vez) esperava para sempre.
   */
  attach(ws: WebSocket, projectId: string, lado: string) {
    const k = this.key(projectId, lado);
    let f = this.fogos.get(k);
    if (!f) {
      f = { pty: null, codigo: null, apagando: false, buffer: '', clients: new Set() };
      this.fogos.set(k, f);
    }
    const fogo = f;
    if (fogo.buffer) ws.send(fogo.buffer);
    fogo.clients.add(ws);
    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.t === 'in' && typeof msg.d === 'string') fogo.pty?.write(msg.d);
      if (msg.t === 'resize' && msg.cols > 0 && msg.rows > 0) fogo.pty?.resize(msg.cols, msg.rows);
    });
    ws.on('close', () => fogo.clients.delete(ws));
  }

  /** Servidor saindo: apaga tudo o que a vila ligou (decisão 1: o sistema cai junto com a vila). */
  killAll() {
    for (const f of this.fogos.values()) {
      if (!f.pty) continue;
      try {
        process.kill(-f.pty.pid, 'SIGTERM');
      } catch {
        // grupo já saiu
      }
    }
  }
}
