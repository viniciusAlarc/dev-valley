import type { Etapa, PhaseState, Project } from '../api';
import { escapeHtml, openPanel } from './panel';

export const PHASE = { feito: ['🌻', 'feito'], andamento: ['🌱', 'em andamento'], 'a fazer': ['🟫', 'a fazer'] } as const satisfies Record<PhaseState, readonly [string, string]>;

type No = { nome: string; estado: PhaseState; etapas: Etapa[] };

/** Etapas diretas feitas e total, como no painel da Fábrica (a fase conta as subfases; a subfase, os itens dela). */
function contagem(n: No): { feitos: number; total: number } {
  return { feitos: n.etapas.filter((e) => e.estado === 'feito').length, total: n.etapas.length };
}

/**
 * Fases do `painel.json` com as subfases (`etapas`, em qualquer nível), no formato do painel da Fábrica: "X de Y" em
 * cada nível que tem etapas e barra de progresso na fase. Em andamento abre aberto; o resto fica recolhido.
 * `extra` acrescenta algo à linha da fase (o botão do documento, no quadro negro).
 */
export function faseTree<F extends No>(fases: F[], extra: (f: F) => string = () => ''): string {
  const no = (n: No, fase: boolean, tail: string): string => {
    const [icon, text] = PHASE[n.estado];
    const nome = `<span class="pend-owner">${icon}</span><span class="pend-item">${escapeHtml(n.nome)}</span>`;
    if (!n.etapas.length) return `<li class="fase-leaf">${nome}<span class="muted">${text}</span>${tail}</li>`;
    const { feitos, total } = contagem(n);
    const pct = Math.round((feitos / total) * 100);
    return `<li class="fase-node"><details${n.estado === 'andamento' ? ' open' : ''}>
      <summary>${nome}<span class="muted">${feitos} de ${total}</span>${tail}</summary>
      ${fase ? `<div class="fase-progress"><div class="usage-bar"><div class="usage-fill" style="width:${pct}%"></div></div><b>${feitos} de ${total} · ${pct}%</b></div>` : ''}
      <ul class="fase-tree">${n.etapas.map((e) => no(e, false, '')).join('')}</ul>
    </details></li>`;
  };
  return `<ul class="fase-tree">${fases.map((f) => no(f, true, extra(f))).join('')}</ul>`;
}

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
  const fases = plano?.fases.length ? faseTree(plano.fases) : '';
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
    ${fases || '<p class="empty">Nenhum plano em andamento.</p>'}
    <h3>Últimas entregas</h3>
    ${entregas ? `<ul class="session-list pend-list">${entregas}</ul>` : '<p class="empty">Nenhuma entrega registrada.</p>'}`;
}
