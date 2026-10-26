import type { PhaseState, Project } from '../api';
import { escapeHtml, openPanel } from './panel';

const PHASE = { feito: ['🌻', 'feito'], andamento: ['🌱', 'em andamento'], 'a fazer': ['🟫', 'a fazer'] } as const satisfies Record<PhaseState, readonly [string, string]>;

/** Horta do quintal: o `docs-dev/painel.json` do projeto (fases do plano e últimas entregas), só leitura. */
export function openPainel(project: Project) {
  const painel = project.painel;
  const plano = painel?.plano;
  const done = plano?.fases.filter((f) => f.estado === 'feito').length ?? 0;
  const panel = openPanel({
    title: `Horta — ${plano?.nome || project.name}`,
    subtitle: `${plano ? `${done} de ${plano.fases.length} fase(s) feitas · ` : ''}docs-dev/painel.json${plano?.doc ? ` · plano em ${plano.doc}` : ''}`,
    size: 'lg',
    scroll: true,
  });
  const fases = (plano?.fases ?? [])
    .map(({ nome, estado }) => {
      const [icon, text] = PHASE[estado];
      return `<li><span class="pend-owner">${icon}</span><span class="pend-item">${escapeHtml(nome)}</span><span class="muted">${text}</span></li>`;
    })
    .join('');
  const entregas = (painel?.entregas ?? [])
    .map(
      (e) => `<li>
        <b class="pend-id">${escapeHtml(e.data)}</b>
        <span class="pend-item">${escapeHtml(e.o_que)}${e.como ? `<br><span class="muted">${escapeHtml(e.como)}</span>` : ''}</span>
      </li>`,
    )
    .join('');
  panel.body.innerHTML = `
    <h3>Fases</h3>
    ${fases ? `<ul class="session-list pend-list">${fases}</ul>` : '<p class="empty">Nenhum plano em andamento.</p>'}
    <h3>Últimas entregas</h3>
    ${entregas ? `<ul class="session-list pend-list">${entregas}</ul>` : '<p class="empty">Nenhuma entrega registrada.</p>'}`;
}
