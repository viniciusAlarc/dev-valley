import pty, { type IPty } from 'node-pty';
import type { WebSocket } from 'ws';
import type { LiveSession } from './world.js';

const SCROLLBACK_LIMIT = 256 * 1024;

interface Terminal extends LiveSession {
  pty: IPty;
  buffer: string;
  clients: Set<WebSocket>;
}

/**
 * Mantém um processo `claude` por sessão. Fechar o painel na cidade não mata a sessão:
 * o processo continua vivo e o próximo cliente recebe o scrollback acumulado.
 */
export class TerminalManager {
  private terminals = new Map<string, Terminal>();

  constructor(private onChange: () => void) {}

  live(): LiveSession[] {
    return [...this.terminals.values()].map(({ id, cwd, startedAt }) => ({ id, cwd, startedAt }));
  }

  attach(ws: WebSocket, opts: { sessionId: string; cwd: string; mode: 'resume' | 'new'; agent?: string; cols: number; rows: number }) {
    let term = this.terminals.get(opts.sessionId);
    if (!term) {
      term = this.spawn(opts);
    } else if (term.buffer) {
      ws.send(term.buffer);
    }
    const t = term;
    t.clients.add(ws);

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.t === 'in' && typeof msg.d === 'string') t.pty.write(msg.d);
      if (msg.t === 'resize' && msg.cols > 0 && msg.rows > 0) t.pty.resize(msg.cols, msg.rows);
    });
    ws.on('close', () => t.clients.delete(ws));
  }

  /**
   * Encerra o processo e só resolve quando ele saiu de vez: quem apaga a conversa depois disso não corre o risco
   * de o `claude` gravar o `.jsonl` de novo ao fechar. Sem resposta ao SIGHUP em 5s, vai SIGKILL.
   */
  kill(sessionId: string): Promise<void> {
    const t = this.terminals.get(sessionId);
    if (!t) return Promise.resolve();
    return new Promise((resolve) => {
      const force = setTimeout(() => t.pty.kill('SIGKILL'), 5000);
      t.pty.onExit(() => {
        clearTimeout(force);
        resolve();
      });
      t.pty.kill();
    });
  }

  killAll() {
    for (const t of this.terminals.values()) t.pty.kill();
  }

  private spawn(opts: { sessionId: string; cwd: string; mode: 'resume' | 'new'; agent?: string; cols: number; rows: number }): Terminal {
    const args = opts.mode === 'resume' ? ['--resume', opts.sessionId] : ['--session-id', opts.sessionId];
    // Conversa com um agente da Fábrica: o próprio agente é quem responde na sessão.
    if (opts.mode === 'new' && opts.agent) args.push('--agent', opts.agent);
    const proc = pty.spawn('claude', args, {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>,
    });
    const term: Terminal = {
      id: opts.sessionId,
      cwd: opts.cwd,
      startedAt: Date.now(),
      pty: proc,
      buffer: '',
      clients: new Set(),
    };
    proc.onData((data) => {
      term.buffer = (term.buffer + data).slice(-SCROLLBACK_LIMIT);
      for (const c of term.clients) c.send(data);
    });
    proc.onExit(({ exitCode }) => {
      const note = `\r\n\x1b[33m[sessão encerrada — código ${exitCode}]\x1b[0m\r\n`;
      for (const c of term.clients) {
        c.send(note);
        c.close();
      }
      this.terminals.delete(opts.sessionId);
      this.onChange();
    });
    this.terminals.set(opts.sessionId, term);
    this.onChange();
    return term;
  }
}
