import type { Pendencia, Project } from '../api';
import { escapeHtml, openPanel } from './panel';

const PRIORITY_TITLE = ['', 'P1 — Crítico', 'P2 — Alto', 'P3 — Médio', 'P4 — Baixo / melhoria', 'P5', 'P6'];
const OWNER = { user: ['👤', 'decisão sua'], code: ['💻', 'código'], infra: ['🖥️', 'servidor/infra'] } as const;

/** Texto da célula com o markdown simples renderizado: `código`, **negrito** e ~~riscado~~. */
function itemHtml(item: string) {
  return escapeHtml(item)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>');
}

/** Começo do item, sem markdown: até o primeiro ponto final ou 120 caracteres. */
function shortText(item: string) {
  const plain = item.replace(/\*\*|~~|`/g, '').replace(/\s+/g, ' ').trim();
  const dot = plain.search(/[.:]\s/);
  const cut = dot > 0 && dot < 120 ? dot + 1 : 120;
  return plain.length > cut ? `${plain.slice(0, cut).trimEnd()}${dot > 0 && dot < 120 ? '' : '…'}` : plain;
}

function row(p: Pendencia, lead: string) {
  return `
    <li>
      ${lead}
      <b class="pend-id">${escapeHtml(p.id)}</b>
      <span class="pend-item">${itemHtml(p.item)}</span>
      <span class="muted">${escapeHtml(p.openedAt)}</span>
    </li>`;
}

/** Quadro de bilhetes da casa: o `PENDENCIAS.md` do projeto, só leitura, agrupado por prioridade. */
export function openPendencias(project: Project) {
  const list = project.pendencias ?? [];
  const panel = openPanel({ title: `Pendências — ${project.name}`, subtitle: `${list.length} aberta(s) · PENDENCIAS.md`, size: 'lg', scroll: true });
  if (!list.length) {
    panel.body.innerHTML = '<p class="empty">Nenhuma pendência aberta. O quadro está limpo.</p>';
    return;
  }
  const byPriority = new Map<number, Pendencia[]>();
  for (const p of list) byPriority.set(p.priority, [...(byPriority.get(p.priority) ?? []), p]);
  // Uma seção recolhível por prioridade (só a mais grave abre); cada item é uma linha curta que expande no clique.
  panel.body.innerHTML = [...byPriority.keys()]
    .sort()
    .map((prio, i) => {
      const items = byPriority.get(prio)!;
      const rows = items.map((p) => {
        const [icon, who] = p.owner ? OWNER[p.owner] : ['·', 'sem dono'];
        return `
          <li class="pend-row"><details>
            <summary>
              <span class="pend-owner" title="${who}">${icon}</span>
              <b class="pend-id">${escapeHtml(p.id)}</b>
              <span class="pend-short">${escapeHtml(shortText(p.item))}</span>
            </summary>
            <div class="pend-full">${itemHtml(p.item)}${p.openedAt ? `<p class="muted">${itemHtml(p.openedAt)}</p>` : ''}</div>
          </details></li>`;
      });
      return `<details class="pend-group"${i === 0 ? ' open' : ''}>
        <summary><span class="pend-prio p${prio}">${escapeHtml(PRIORITY_TITLE[prio] ?? `P${prio}`)}</span><span class="muted">(${items.length})</span></summary>
        <ul class="session-list pend-list">${rows.join('')}</ul>
      </details>`;
    })
    .join('');
}

/** Quadro de avisos da praça: só as pendências 👤 (decisão do usuário) de todos os projetos (decisão de 25/10/2026). */
export function openUserPendencias(projects: Project[]) {
  const groups = projects
    .map((project) => ({ project, list: (project.pendencias ?? []).filter((p) => p.owner === 'user').sort((a, b) => a.priority - b.priority) }))
    .filter((g) => g.list.length)
    .sort((a, b) => a.list[0].priority - b.list[0].priority || a.project.name.localeCompare(b.project.name));
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  const panel = openPanel({ title: 'Quadro de avisos', subtitle: `${total} decisão(ões) esperando você · 👤 nos PENDENCIAS.md`, size: 'lg', scroll: true });
  if (!total) {
    panel.body.innerHTML = '<p class="empty">Nenhuma decisão esperando você em nenhum projeto.</p>';
    return;
  }
  panel.body.innerHTML = groups
    .map(
      ({ project, list }) => `<h3>${escapeHtml(project.name)}</h3>
        <ul class="session-list pend-list">${list.map((p) => row(p, `<span class="pend-prio p${p.priority}">P${p.priority}</span>`)).join('')}</ul>`,
    )
    .join('');
}
