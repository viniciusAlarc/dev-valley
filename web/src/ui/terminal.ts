import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { api, contaDaSessao, getWorld, horaDoBastao, onWorld, wsUrl, type Session } from '../api';
import { villagerName } from '../game/names';
import { abrirLinkDoChat } from './leitorArquivo';
import { openMedica } from './librarian';
import { button, openPanel } from './panel';

/**
 * Abre o chat de uma sessão: um terminal de verdade rodando `claude --resume <id>` no WSL.
 * Fechar o painel só desconecta — a sessão continua viva no servidor.
 */
/** `agent`: conversa com agente da Fábrica, com o cabeçalho dos agentes da vila ("✦ Nome" e o que ele faz), sem o nome de morador. */
export function openTerminal(opts: {
  sessionId: string;
  projectId?: string | null;
  title: string;
  agent?: { subtitle: string };
  /** Só para ver: o teclado não chega ao processo (o maestro regendo, 04/11/2026). */
  somenteLeitura?: boolean;
  /** Sessão comum: mostra "Passar o bastão" (BT-1, 08/11/2026). */
  bastao?: boolean;
  /** Conta da sessão (Claude, DeepSeek...), mostrada ao lado do id; a nova sessão já sabe, a retomada vem do mundo. */
  conta?: { nome: string };
}) {
  let paraDeOuvir: (() => void) | null = null;
  let ws: WebSocket | null = null;
  const term = new Terminal({
    fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "DejaVu Sans Mono", monospace',
    fontSize: 14,
    cursorBlink: !opts.somenteLeitura,
    disableStdin: !!opts.somenteLeitura,
    allowProposedApi: true,
    // Link OSC 8 (o Claude Code escreve `[texto](url)` assim): .md/.html da vila abrem no leitor, não no navegador.
    linkHandler: { activate: (_e, uri) => abrirLinkDoChat(uri), allowNonHttpProtocols: false },
    theme: {
      background: '#1f1a14',
      foreground: '#f1e4c8',
      cursor: '#f5d142',
      selectionBackground: '#6b4a2a',
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon((_e, uri) => abrirLinkDoChat(uri)));
  const resizeObserver = new ResizeObserver(() => {
    try {
      fit.fit();
    } catch {
      // painel ainda sem tamanho
    }
  });

  const panel = openPanel({
    title: opts.agent ? opts.title : `${villagerName(opts.sessionId)} — ${opts.title}`,
    subtitle: opts.agent ? opts.agent.subtitle : `sessão ${opts.sessionId.slice(0, 8)}${opts.conta ? ` · ${opts.conta.nome}` : ''}`,
    size: 'lg',
    onClose: () => {
      paraDeOuvir?.();
      resizeObserver.disconnect();
      ws?.close();
      term.dispose();
    },
  });
  const aviso = (texto: string) => {
    const q = document.createElement('span');
    q.className = 'agent-confirm';
    q.textContent = texto;
    return q;
  };
  // Os botões de baixo: só reagem ao mundo (contexto passando de 70%) enquanto nenhuma confirmação está aberta.
  let emRepouso = false;
  // Encerrar apaga a conversa de vez (não dá para retomar), então pede confirmação ali mesmo, como na Fábrica.
  const showEnd = () => {
    emRepouso = true;
    const s = getWorld().sessions.find((x) => x.id === opts.sessionId);
    const hora = !!s && horaDoBastao(s);
    panel.actions.replaceChildren(
      ...(opts.bastao && hora ? [aviso(`Contexto em ${s!.context!.percent}%: hora de passar o bastão.`)] : []),
      // Atalho da clínica (09/11/2026): a médica examina se ele está trabalhando ou travado.
      ...(opts.bastao && s ? [button('🩺 Chamar a médica', () => openMedica(s))] : []),
      ...(opts.bastao ? [button('Passar o bastão', confirmBastao, hora ? 'primary' : 'normal')] : []),
      ...(opts.agent ? [] : [button('✎ Renomear', showRename)]),
      button('Encerrar sessão', confirmEnd, 'danger'),
    );
  };
  // Renomear (16/11/2026): troca só o título, guardado na vila; o nome do morador fica. Vazio volta ao automático.
  const titulo = panel.root.querySelector('h2')!;
  const showRename = () => {
    emRepouso = false;
    const atual = getWorld().sessions.find((x) => x.id === opts.sessionId)?.title ?? opts.title;
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.maxLength = 80;
    input.value = atual;
    input.placeholder = 'Vazio volta ao título automático';
    const salvar = async () => {
      try {
        await api.renomearSessao(opts.sessionId, input.value);
        const novo = input.value.replace(/\s+/g, ' ').trim();
        if (novo) titulo.textContent = `${villagerName(opts.sessionId)} — ${novo}`;
        else {
          // O automático vem no próximo mundo.
          const pare = onWorld((w) => {
            const s = w.sessions.find((x) => x.id === opts.sessionId);
            if (s) titulo.textContent = `${villagerName(opts.sessionId)} — ${s.title}`;
            pare();
          });
        }
        showEnd();
      } catch (err) {
        term.write(`\r\n\x1b[31m[${(err as Error).message ?? err}]\x1b[0m\r\n`);
        showEnd();
      }
    };
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') void salvar();
      if (ev.key === 'Escape') showEnd();
    });
    panel.actions.replaceChildren(input, button('Salvar', salvar, 'primary'), button('Cancelar', showEnd));
    input.focus();
    input.select();
  };
  // Passagem de bastão (BT-1): a própria sessão escreve o resumo; quando termina, nasce o sucessor na mesma casa.
  const confirmBastao = () => {
    emRepouso = false;
    panel.actions.replaceChildren(
      aviso(`Pedir a ${villagerName(opts.sessionId)} o resumo para quem continua? Quando ele terminar, nasce um morador novo nesta casa, já lendo o resumo.`),
      button(
        'Sim, passar',
        async () => {
          try {
            await api.passarBastao(opts.sessionId);
            panel.actions.replaceChildren(aviso('Ele está escrevendo o resumo. Quando terminar, o novo morador aparece na casa.'));
          } catch (err) {
            term.write(`\r\n\x1b[31m[${(err as Error).message ?? err}]\x1b[0m\r\n`);
            showEnd();
          }
        },
        'primary',
      ),
      button('Cancelar', showEnd),
    );
  };
  if (opts.bastao) paraDeOuvir = onWorld(() => emRepouso && showEnd());
  const confirmEnd = () => {
    emRepouso = false;
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
  if (opts.somenteLeitura) {
    const aviso = document.createElement('span');
    aviso.className = 'agent-confirm';
    aviso.textContent = 'Só para ver: ele está regendo. Dúvidas, com o mirim.';
    panel.actions.replaceChildren(aviso);
  } else showEnd();

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
  if (!opts.somenteLeitura) term.onData((d) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'in', d })));
  term.onResize(({ cols, rows }) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'resize', cols, rows })));
  ws.onopen = () => ws?.send(JSON.stringify({ t: 'resize', cols: term.cols, rows: term.rows }));
  term.focus();
}

export function openSessionTerminal(session: Session) {
  openTerminal({ sessionId: session.id, projectId: session.projectId, title: session.title, bastao: !session.porao, conta: contaDaSessao(session) ?? undefined });
}
