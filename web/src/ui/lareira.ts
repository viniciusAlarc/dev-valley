import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { api, estadoLareira, onWorld, wsUrl, type Lado, type Project } from '../api';
import { button, escapeHtml, openPanel } from './panel';

/** Situação de um lado, do ponto de vista de quem vai apertar Acender ou Apagar. */
function situacao(l: Lado): [string, string] {
  if (!l.comando) return ['·', 'sem comando: a vila não liga este lado'];
  if (l.problema) return ['⚠️', `não dá para ligar: ${l.problema}`];
  if (l.vila?.estado === 'rodando') return l.ocupada || l.porta === null ? ['🔥', `aceso pela vila (PID ${l.vila.pid})`] : ['✨', 'acendendo…'];
  if (l.ocupada) return ['🔥', `ligado fora da vila${l.pid ? ` (PID ${l.pid})` : ''}: a vila não apaga`];
  if (l.vila?.estado === 'saiu' && l.vila.codigo !== 0) return ['⚠️', `parou com erro (código ${l.vila.codigo})`];
  return ['🪵', 'apagado'];
}

const ligavel = (l: Lado) => !!l.comando && !l.problema && !l.ocupada && l.vila?.estado !== 'rodando';

/**
 * Painel da lareira (PD-7, decisões 6 a 8): cada lado da tabela "Subir" com pasta, comando, porta e situação, os
 * botões Acender e Apagar, e o log de cada lado numa aba (um xterm por lado, só leitura). Atualiza com o mundo.
 */
export function openLareira(project: Project) {
  const tabs = new Map<string, { term: Terminal; fit: FitAddon; ws: WebSocket; host: HTMLElement }>();
  const resizeObserver = new ResizeObserver(() => {
    for (const t of tabs.values()) if (t.host.style.display !== 'none') t.fit.fit();
  });
  let unsubscribe = () => {};
  const panel = openPanel({
    title: `Lareira — ${project.name}`,
    subtitle: 'docs-dev/guias/OPERACAO.md · tabela "Subir"',
    size: 'lg',
    onClose: () => {
      unsubscribe();
      resizeObserver.disconnect();
      for (const t of tabs.values()) {
        t.ws.close();
        t.term.dispose();
      }
    },
  });

  panel.body.innerHTML = `
    <ul class="session-list pend-list lareira-lados"></ul>
    <p class="reader-status lareira-status"></p>
    <div class="reader-header lareira-tabs"></div>`;
  const list = panel.body.querySelector<HTMLElement>('.lareira-lados')!;
  const status = panel.body.querySelector<HTMLElement>('.lareira-status')!;
  const tabBar = panel.body.querySelector<HTMLElement>('.lareira-tabs')!;
  const acender = button('Acender', () => void agir('acender'), 'primary');
  const apagar = button('Apagar', () => void agir('apagar'), 'danger');
  panel.actions.append(acender, apagar);

  let atual = project;
  async function agir(acao: 'acender' | 'apagar') {
    acender.disabled = apagar.disabled = true;
    status.classList.remove('error');
    status.textContent = acao === 'acender' ? 'Acendendo…' : 'Apagando…';
    try {
      if (acao === 'acender') {
        const { ligados } = await api.acenderLareira(atual.id);
        status.textContent = ligados.length ? `Ligado: ${ligados.join(', ')}.` : 'Nada para ligar.';
        if (ligados[0]) mostrar(ligados[0]);
      } else {
        await api.apagarLareira(atual.id);
        status.textContent = 'Apagado.';
      }
    } catch (err) {
      status.classList.add('error');
      status.textContent = (err as Error).message ?? String(err);
    }
    render(atual);
  }

  function render(p: Project) {
    atual = p;
    const lados = p.lareira?.lados ?? [];
    list.innerHTML = lados
      .map((l) => {
        const [icon, text] = situacao(l);
        return `<li>
          <span class="pend-owner">${icon}</span>
          <span class="pend-item"><b>${escapeHtml(l.lado)}</b> <span class="muted">${escapeHtml(l.pasta || '.')}${l.porta ? ` · porta ${l.porta}` : ''}</span>
            ${l.comando ? `<br><code>${escapeHtml(l.comando)}</code>` : ''}</span>
          <span class="muted">${escapeHtml(text)}</span>
        </li>`;
      })
      .join('');
    acender.disabled = !lados.some(ligavel);
    apagar.disabled = !lados.some((l) => l.vila?.estado === 'rodando');
    acender.title = acender.disabled ? 'Nenhum lado para ligar: já no ar, ligado fora da vila ou sem comando' : 'Roda os comandos acima';
    apagar.title = apagar.disabled ? 'A vila só apaga o que ela mesma ligou' : 'Encerra os processos que a vila ligou';
    panel.root.querySelector('.subtitle')!.textContent = `docs-dev/guias/OPERACAO.md · tabela "Subir" · lareira ${p.lareira ? estadoLareira(p.lareira) : 'sem tabela'}`;
  }

  // uma aba por lado com comando; o terminal do log só nasce quando a aba abre
  const comComando = (project.lareira?.lados ?? []).filter((l) => l.comando);
  const tabButtons = comComando.map((l) => {
    const b = button(`Log: ${l.lado}`, () => mostrar(l.lado));
    b.dataset.lado = l.lado;
    tabBar.append(b);
    return b;
  });

  function mostrar(lado: string) {
    for (const b of tabButtons) b.className = `btn btn-${b.dataset.lado === lado ? 'primary' : 'normal'}`;
    for (const [k, t] of tabs) t.host.style.display = k === lado ? '' : 'none';
    let tab = tabs.get(lado);
    if (!tab) {
      const host = document.createElement('div');
      host.className = 'terminal-host';
      panel.body.append(host);
      const term = new Terminal({
        fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "DejaVu Sans Mono", monospace',
        fontSize: 13,
        disableStdin: true,
        theme: { background: '#1f1a14', foreground: '#f1e4c8', selectionBackground: '#6b4a2a' },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      fit.fit();
      resizeObserver.observe(host);
      const ws = new WebSocket(wsUrl(`/ws/lareira?${new URLSearchParams({ project: project.id, lado })}`));
      ws.onmessage = (ev) => term.write(ev.data);
      ws.onclose = (ev) => ev.reason && term.write(`\r\n\x1b[31m[${ev.reason}]\x1b[0m\r\n`);
      term.onResize(({ cols, rows }) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'resize', cols, rows })));
      tab = { term, fit, ws, host };
      tabs.set(lado, tab);
    }
    tab.fit.fit();
  }

  render(project);
  if (comComando[0]) mostrar(comComando[0].lado);
  unsubscribe = onWorld((w) => {
    const p = w.projects.find((x) => x.id === project.id);
    if (p) render(p);
  });
}
