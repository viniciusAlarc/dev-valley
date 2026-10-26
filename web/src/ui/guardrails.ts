import type { World } from '../api';
import { ui } from './actions';
import { button, escapeHtml, openPanel } from './panel';

type Guardrails = NonNullable<World['guardrails']>;

/** Outdoor dos guardrails: estado do plugin e a lista (títulos `## G<n>` do arquivo), em ordem numérica. Só leitura. */
export function openGuardrails(g: Guardrails) {
  const panel = openPanel({
    title: 'Guardrails',
    subtitle: `${g.items.length} regra(s) · plugin ${g.plugin} ${g.enabled ? 'ligado' : 'desligado'} no settings.json`,
    size: 'lg',
    scroll: true,
  });
  panel.actions.append(button('Abrir na biblioteca', () => ui.openLibrary({ path: g.core })));
  const items = [...g.items].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const off = g.enabled
    ? ''
    : `<p>O plugin está desligado no <code>~/.claude/settings.json</code>: as sessões não recebem os avisos e guardas dele.</p>`;
  panel.body.innerHTML = `${off}
    <p class="muted">"Ligado" é o que o settings.json diz; se a status line de uma sessão não mostra <code>guardrails ✓</code>, o mod não carregou nela.</p>
    <ul class="session-list pend-list">${items
      .map((i) => `<li><b class="pend-id">${escapeHtml(i.id)}</b><span class="pend-item">${escapeHtml(i.title)}</span></li>`)
      .join('')}</ul>`;
}
