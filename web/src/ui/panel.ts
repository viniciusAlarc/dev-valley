/** Janela no estilo dos menus de Stardew: moldura de madeira, fundo de pergaminho. */

export interface Panel {
  root: HTMLElement;
  body: HTMLElement;
  actions: HTMLElement;
  close: () => void;
}

let current: { panel: Panel; onClose?: () => void } | null = null;

export function isPanelOpen() {
  return current !== null;
}

export function closePanel() {
  if (!current) return;
  const { panel, onClose } = current;
  current = null;
  onClose?.();
  panel.root.remove();
}

export function openPanel(opts: { title: string; subtitle?: string; size?: 'sm' | 'lg'; onClose?: () => void }): Panel {
  closePanel();
  const root = document.createElement('div');
  root.className = 'overlay';
  root.innerHTML = `
    <div class="panel panel-${opts.size ?? 'sm'}" role="dialog" aria-label="${escapeHtml(opts.title)}">
      <header class="panel-header">
        <div>
          <h2>${escapeHtml(opts.title)}</h2>
          ${opts.subtitle ? `<p class="subtitle">${escapeHtml(opts.subtitle)}</p>` : ''}
        </div>
        <div class="panel-actions"></div>
        <button class="btn-close" title="Fechar (Esc)">✕</button>
      </header>
      <div class="panel-body"></div>
    </div>`;
  document.getElementById('panels')!.append(root);
  const panel: Panel = {
    root,
    body: root.querySelector('.panel-body')!,
    actions: root.querySelector('.panel-actions')!,
    close: closePanel,
  };
  root.querySelector('.btn-close')!.addEventListener('click', closePanel);
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) closePanel();
  });
  current = { panel, onClose: opts.onClose };
  return panel;
}

export function button(label: string, onClick: () => void, variant: 'primary' | 'normal' | 'danger' = 'normal') {
  const b = document.createElement('button');
  b.className = `btn btn-${variant}`;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function timeAgo(ts: number) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

document.addEventListener('keydown', (e) => {
  // O Esc também é usado pelo Claude Code, então dentro do terminal ele não fecha o painel.
  if (e.key === 'Escape' && current && !(e.target as HTMLElement).closest('.xterm')) {
    // Não deixa o mesmo Esc chegar ao Phaser (que escuta no window) e sair da casa.
    e.stopPropagation();
    closePanel();
  }
});
