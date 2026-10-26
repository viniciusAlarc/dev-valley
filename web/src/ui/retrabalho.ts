import type { Project } from '../api';
import { escapeHtml, openPanel } from './panel';

/** Texto da célula com os `trechos de código` do markdown destacados. */
function cellHtml(cell: string) {
  return escapeHtml(cell).replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Ervas do quintal: o `RETRABALHO.md` do projeto (G17), na ordem e com as colunas do arquivo. Só leitura; agrupar
 * por causa e levar ao `/nova-regra` fica com o usuário (decisão de 26/10/2026).
 */
export function openRetrabalho(project: Project) {
  const r = project.retrabalho;
  const rows = r?.rows ?? [];
  const panel = openPanel({ title: `Retrabalho — ${project.name}`, subtitle: `${rows.length} registro(s) · RETRABALHO.md`, size: 'lg', scroll: true });
  if (!r || !rows.length) {
    panel.body.innerHTML = '<p class="empty">Nenhum retrabalho registrado. O quintal está limpo.</p>';
    return;
  }
  panel.body.innerHTML = `
    <p class="muted">Três linhas com a mesma causa pedem um guardrail novo: numa sessão, use <code>/nova-regra</code>.</p>
    <div class="markdown"><table>
      <thead><tr>${r.header.map((h) => `<th>${cellHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${cellHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}
