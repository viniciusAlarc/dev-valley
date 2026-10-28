import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { api, wsUrl, type Session } from '../api';
import { villagerName } from '../game/names';
import { button, openPanel } from './panel';

/**
 * Abre o chat de uma sessão: um terminal de verdade rodando `claude --resume <id>` no WSL.
 * Fechar o painel só desconecta — a sessão continua viva no servidor.
 */
/** `agent`: conversa com agente da Fábrica, com o cabeçalho dos agentes da vila ("✦ Nome" e o que ele faz), sem o nome de morador. */
export function openTerminal(opts: { sessionId: string; projectId?: string | null; title: string; agent?: { subtitle: string } }) {
  let ws: WebSocket | null = null;
  const term = new Terminal({
    fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "DejaVu Sans Mono", monospace',
    fontSize: 14,
    cursorBlink: true,
    allowProposedApi: true,
    theme: {
      background: '#1f1a14',
      foreground: '#f1e4c8',
      cursor: '#f5d142',
      selectionBackground: '#6b4a2a',
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  const resizeObserver = new ResizeObserver(() => {
    try {
      fit.fit();
    } catch {
      // painel ainda sem tamanho
    }
  });

  const panel = openPanel({
    title: opts.agent ? opts.title : `${villagerName(opts.sessionId)} — ${opts.title}`,
    subtitle: opts.agent ? opts.agent.subtitle : `sessão ${opts.sessionId.slice(0, 8)}`,
    size: 'lg',
    onClose: () => {
      resizeObserver.disconnect();
      ws?.close();
      term.dispose();
    },
  });
  // Encerrar apaga a conversa de vez (não dá para retomar), então pede confirmação ali mesmo, como na Fábrica.
  const showEnd = () => panel.actions.replaceChildren(button('Encerrar sessão', confirmEnd, 'danger'));
  const confirmEnd = () => {
    const q = document.createElement('span');
    q.className = 'agent-confirm';
    q.textContent = 'Apagar esta conversa de vez? Não dá para retomar depois.';
    panel.actions.replaceChildren(
      q,
      button(
        'Sim, encerrar',
        async () => {
          try {
            await api.deleteSession(opts.sessionId);
            panel.close();
          } catch (err) {
            term.write(`\r\n\x1b[31m[${(err as Error).message ?? err}]\x1b[0m\r\n`);
            showEnd();
          }
        },
        'danger',
      ),
      button('Cancelar', showEnd),
    );
  };
  showEnd();

  const host = document.createElement('div');
  host.className = 'terminal-host';
  panel.body.append(host);
  term.open(host);
  fit.fit();
  resizeObserver.observe(host);

  const params = new URLSearchParams({ session: opts.sessionId, cols: String(term.cols), rows: String(term.rows) });
  if (opts.projectId) params.set('project', opts.projectId);
  ws = new WebSocket(wsUrl(`/ws/terminal?${params}`));
  ws.onmessage = (ev) => term.write(ev.data);
  ws.onclose = (ev) => {
    if (ev.reason) term.write(`\r\n\x1b[31m[${ev.reason}]\x1b[0m\r\n`);
  };
  term.onData((d) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'in', d })));
  term.onResize(({ cols, rows }) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'resize', cols, rows })));
  ws.onopen = () => ws?.send(JSON.stringify({ t: 'resize', cols: term.cols, rows: term.rows }));
  term.focus();
}

export function openSessionTerminal(session: Session) {
  openTerminal({ sessionId: session.id, projectId: session.projectId, title: session.title });
}
