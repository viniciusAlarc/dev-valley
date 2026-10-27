import type { PlanoAcao, Project } from '../api';
import { ui } from './actions';
import { faseTree } from './painel';
import { button, escapeHtml, openPanel } from './panel';

const planoUrl = (project: Project, i: number) => `/api/quadro?project=${encodeURIComponent(project.id)}&i=${i}`;

/**
 * Quadro negro da casa: o `docs-dev/painel.json` inteiro (decisão de 27/10/2026): plano, todas as fases, todas as
 * entregas e o JSON como está no arquivo. O `doc` do plano e de cada fase vira botão: HTML abre aqui, num iframe
 * isolado (`sandbox` sem `allow-same-origin`: o script do plano não alcança a vila); Markdown abre no leitor da biblioteca.
 */
export function openQuadro(project: Project) {
  const painel = project.painel;
  const plano = painel?.plano;
  const done = plano?.fases.filter((f) => f.estado === 'feito').length ?? 0;
  const panel = openPanel({
    title: `Quadro negro — ${plano?.nome || project.name}`,
    subtitle: `${plano ? `${done} de ${plano.fases.length} fase(s) feitas · ` : ''}docs-dev/painel.json`,
    size: 'lg',
    scroll: true,
  });
  if (!painel) {
    panel.body.innerHTML = '<p class="empty">O projeto não tem <code>docs-dev/painel.json</code> (ou ele não é um JSON válido).</p>';
    return;
  }

  const docs = project.quadro;
  const docCell = (doc: string | null) => {
    if (!doc) return '';
    const i = docs.findIndex((d) => d.doc === doc);
    return i < 0
      ? `<span class="muted" title="Documento não encontrado no projeto">${escapeHtml(doc)} (não encontrado)</span>`
      : `<button class="btn btn-normal" data-doc="${i}" title="${escapeHtml(doc)}">Abrir plano${docs[i].kind === 'md' ? ' (md)' : ''}</button>`;
  };
  const fases = plano?.fases.length ? faseTree(plano.fases, (f) => docCell(f.doc)) : '';
  const entregas = painel.entregas
    .map(
      (e) => `<li>
        <b class="pend-id">${escapeHtml(e.data)}</b>
        <span class="pend-item">${escapeHtml(e.o_que)}${e.como ? `<br><span class="muted">${escapeHtml(e.como)}</span>` : ''}</span>
      </li>`,
    )
    .join('');

  function showPainel() {
    panel.body.classList.add('panel-scroll');
    panel.body.innerHTML = `
      <h3>Plano</h3>
      ${
        plano
          ? `<ul class="session-list pend-list"><li><span class="pend-item"><b>${escapeHtml(plano.nome || '(sem nome)')}</b>${plano.doc ? `<br><span class="muted">${escapeHtml(plano.doc)}</span>` : ''}</span>${docCell(plano.doc)}</li></ul>`
          : '<p class="empty">Nenhum plano em andamento (<code>"plano": null</code>).</p>'
      }
      <h3>Fases</h3>
      ${fases || '<p class="empty">Nenhuma fase.</p>'}
      <h3>Entregas</h3>
      ${entregas ? `<ul class="session-list pend-list">${entregas}</ul>` : '<p class="empty">Nenhuma entrega registrada.</p>'}
      <details>
        <summary>JSON completo</summary>
        <pre class="quadro-json">${escapeHtml(painel!.json)}</pre>
      </details>`;
    for (const b of panel.body.querySelectorAll<HTMLButtonElement>('[data-doc]')) b.addEventListener('click', () => showDoc(Number(b.dataset.doc)));
  }

  function showDoc(i: number) {
    const p = docs[i];
    if (p.kind === 'md') return ui.openLibrary({ path: p.path });
    panel.body.classList.remove('panel-scroll');
    panel.body.innerHTML = `
      <div class="quadro-single">
        <section class="library-reader">
          <header class="reader-header">
            <div class="reader-title"><b>${escapeHtml(p.fase)}</b> <span class="muted">${escapeHtml(rel(project, p))}</span></div>
            <div class="reader-actions"></div>
          </header>
          <iframe class="quadro-frame" sandbox="allow-scripts" title="Plano de ação"></iframe>
        </section>
      </div>`;
    panel.body.querySelector('.reader-actions')!.append(
      button('← Voltar ao quadro', showPainel),
      button('Abrir em aba nova', () => window.open(planoUrl(project, i), '_blank', 'noopener')),
    );
    panel.body.querySelector<HTMLIFrameElement>('.quadro-frame')!.src = planoUrl(project, i);
  }

  showPainel();
}

function rel(project: Project, p: PlanoAcao) {
  return p.path.slice(project.path.length + 1);
}
