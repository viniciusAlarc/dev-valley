import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/400-italic.css';
import '@fontsource/old-standard-tt/700.css';
import '@fontsource/unifrakturmaguntia/400.css';
import { jornal, type Edicao, type JornalView } from '../api';
import { button, escapeHtml, openPanel, type Panel } from './panel';

const porExtenso = (data: string) => {
  const [a, m, d] = data.split('-').map(Number);
  const t = new Date(a!, m! - 1, d!).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const desdeTexto = (t: number) =>
  new Date(t).toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');

function edicaoHtml(e: Edicao) {
  const noticias = e.noticias
    .map(
      (n) => `
      <article class="gz-noticia">
        <h3>${escapeHtml(n.titulo || n.nome)}</h3>
        <p class="gz-projeto">${escapeHtml(n.nome)}</p>
        ${n.voce ? `<p><b>Você</b> — ${escapeHtml(n.voce)}</p>` : ''}
        ${n.time ? `<p><b>O time</b> — ${escapeHtml(n.time)}</p>` : ''}
      </article>`,
    )
    .join('');
  const achados = e.parados.length
    ? `<aside class="gz-achados">
        <h4>Achados e perdidos</h4>
        ${e.parados.map((p) => `<p>Procura-se movimento em <b>${escapeHtml(p.nome)}</b>, parado há ${p.dias} dias.</p>`).join('')}
      </aside>`
    : '';
  const nota = e.semNovidade.length && e.noticias.length ? `<p class="gz-nota">Sem novidade em: ${e.semNovidade.map(escapeHtml).join(', ')}.</p>` : '';
  return `
    <header class="gz-cabecalho">
      <h1>Gazeta do Vale</h1>
      <p class="gz-linha-data"><span>${e.extra ? '<b>Edição extra</b> · ' : ''}${escapeHtml(porExtenso(e.data))}</span><span>O que mudou desde ${escapeHtml(desdeTexto(e.desde))}</span></p>
    </header>
    <h2 class="gz-manchete">${escapeHtml(e.manchete)}</h2>
    <div class="gz-colunas">${noticias}${achados}</div>
    ${nota}`;
}

/**
 * Jornal da banca (02/11/2026): a edição do dia em linguagem de gente. Abrir uma edição marca o jornal como lido: a
 * próxima começa daqui (piso de 24h). "Imprimir" pede uma edição nova ao jornaleiro, que leva alguns segundos.
 */
export async function openJornal(onChange?: (v: JornalView) => void, modo: 'dia' | 'extra' = 'dia') {
  const panel = openPanel({ title: 'Gazeta do Vale', subtitle: 'O que mudou nos projetos, contado pelo jornaleiro', size: 'lg', scroll: true });
  // A moldura de madeira vira folha de jornal (CSS `.gazeta` em style.css).
  panel.root.querySelector('.panel')!.classList.add('gazeta');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const root = panel.root;

  const imprimir = async () => {
    try {
      draw(await jornal.imprimir());
    } catch (err) {
      panel.body.innerHTML = `<p class="empty error">${escapeHtml(String(err))}</p>`;
    }
  };

  const draw = (v: JornalView) => {
    onChange?.(v);
    clearTimeout(timer);
    if (modo === 'dia') actions(panel, v, imprimir);
    if (v.gerando) {
      panel.body.innerHTML = '<p class="empty">O jornaleiro está escrevendo a edição…</p>';
      // Pergunta de novo até a edição sair (enquanto o painel estiver aberto).
      timer = setTimeout(() => root.isConnected && void jornal.ver().then(draw), 3000);
      return;
    }
    const erro = v.erro ? `<p class="empty error">${escapeHtml(v.erro)}</p>` : '';
    // Edição extra (pedida na conversa com o jornaleiro): só mostra; não marca o jornal como lido.
    if (modo === 'extra') {
      panel.body.innerHTML = erro + (v.extra ? edicaoHtml(v.extra) : '<p class="empty">Nenhuma edição extra ainda.</p>');
      return;
    }
    if (!v.edicao) {
      panel.body.innerHTML = `${erro}<p class="empty">A edição de hoje ainda não saiu. Ela sai sozinha depois das 6h, com a vila aberta, ou agora em "Imprimir a edição".</p>`;
      return;
    }
    panel.body.innerHTML = erro + edicaoHtml(v.edicao);
    void jornal.lido().catch(() => {});
  };

  panel.body.innerHTML = '<p class="muted">Pegando o jornal…</p>';
  try {
    draw(await jornal.ver());
  } catch (err) {
    panel.body.innerHTML = `<p class="empty error">${escapeHtml(String(err))}</p>`;
  }
}

function actions(panel: Panel, v: JornalView, imprimir: () => void) {
  panel.actions.replaceChildren();
  if (v.gerando) return;
  panel.actions.append(button(v.edicao ? 'Imprimir de novo' : 'Imprimir a edição', imprimir, v.edicao ? 'normal' : 'primary'));
}
