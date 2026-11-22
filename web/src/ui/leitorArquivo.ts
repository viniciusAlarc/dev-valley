import { renderMarkdown } from './library';
import { button, escapeHtml, openPanel } from './panel';

/**
 * Leitor de arquivo citado no chat (21/11/2026): a sessão manda o link `/api/arquivo?path=...` (regra do link
 * clicável) e o clique em `.md` ou `.html` abre aqui, no leitor da vila, em vez de uma aba com o markdown cru.
 * A rota `/api/arquivo` continua sendo a única trava (só arquivo de dentro de um projeto da vila).
 */

const LEGIVEL = /\.(md|html?)$/i;

/** O caminho do arquivo, se o link é da rota `/api/arquivo` da própria vila e aponta para `.md`/`.html`; senão `null`. */
export function arquivoDoLink(uri: string): string | null {
  let url: URL;
  try {
    url = new URL(uri, location.origin);
  } catch {
    return null;
  }
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/api/arquivo') return null;
  const caminho = url.searchParams.get('path') ?? '';
  return LEGIVEL.test(caminho) ? caminho : null;
}

/** Clique num link do terminal: arquivo legível abre no leitor; o resto segue para o navegador, como antes. */
export function abrirLinkDoChat(uri: string) {
  const caminho = arquivoDoLink(uri);
  if (caminho) openLeitorArquivo(caminho);
  else window.open(uri, '_blank', 'noopener');
}

export function openLeitorArquivo(caminho: string) {
  const src = `/api/arquivo?path=${encodeURIComponent(caminho)}`;
  const barra = caminho.lastIndexOf('/');
  const panel = openPanel({ title: caminho.slice(barra + 1), subtitle: caminho.slice(0, barra), size: 'lg' });
  const html = /\.html?$/i.test(caminho);
  panel.body.innerHTML = `
    <div class="quadro-single">
      <section class="library-reader">
        <header class="reader-header">
          <div class="reader-title"><b>${escapeHtml(caminho)}</b></div>
          <div class="reader-actions"></div>
        </header>
        ${
          html
            ? // HTML de projeto tem script: iframe sandbox sem allow-same-origin, igual à estante (a rota já isola).
              `<iframe class="quadro-frame" sandbox="allow-scripts" title="${escapeHtml(caminho)}"></iframe>`
            : '<div class="reader-body markdown"><p class="muted">Carregando...</p></div>'
        }
      </section>
    </div>`;
  panel.body.querySelector('.reader-actions')!.append(button('Abrir em aba nova', () => window.open(src, '_blank', 'noopener')));
  if (html) {
    panel.body.querySelector<HTMLIFrameElement>('.quadro-frame')!.src = src;
    return;
  }
  const corpo = panel.body.querySelector<HTMLElement>('.reader-body')!;
  fetch(src, { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(r.status === 404 ? 'Arquivo não encontrado (ou fora das pastas dos projetos da vila).' : `Erro ${r.status}`);
      corpo.innerHTML = renderMarkdown(await r.text());
    })
    .catch((err: Error) => {
      corpo.innerHTML = `<p class="muted">✖ ${escapeHtml(err.message)}</p>`;
    });
}
