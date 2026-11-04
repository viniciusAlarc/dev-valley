import { api, type PedidoPorao, type Project } from '../api';
import { escapeHtml, openPanel } from './panel';

/**
 * Cartão do porão (MA-1, fase 3, decisão do usuário de 03/11/2026): o maestro pediu sessões para as tarefas de uma
 * rodada e elas só abrem com este clique, como o push do pombal. A rota de aprovar só aceita vinda da página.
 */
export function openPedidoPorao(pedido: PedidoPorao, project: Project) {
  const n = pedido.tarefas.length;
  const panel = openPanel({ title: `O maestro quer abrir ${n} ${n === 1 ? 'sessão' : 'sessões'}`, subtitle: `${project.name} · rodada ${pedido.rodada}` });
  panel.body.innerHTML = `
    <p>Uma sessão de trabalho por tarefa. Cada uma começa lendo o briefing dela e fica só no porão:</p>
    <ul class="session-list">${pedido.tarefas
      .map((t) => `<li><b>${escapeHtml(t)}</b> <code>~/.claude/maestro/rodadas/${escapeHtml(pedido.rodada)}/briefings/${escapeHtml(t)}.md</code></li>`)
      .join('')}</ul>
    <p class="muted">Elas pedem permissão como qualquer sessão: o ❗ aparece no morador do porão e no topo da tela.</p>
    <p class="porao-acoes">
      <button class="btn btn-primary" data-acao="aprovar">Abrir ${n} ${n === 1 ? 'sessão' : 'sessões'}</button>
      <button class="btn btn-danger" data-acao="recusar">Recusar</button>
    </p>
    <div class="porao-resultado"></div>`;
  const botoes = [...panel.body.querySelectorAll<HTMLButtonElement>('[data-acao]')];
  const resultado = panel.body.querySelector<HTMLElement>('.porao-resultado')!;
  for (const b of botoes) {
    b.addEventListener('click', async () => {
      for (const x of botoes) x.disabled = true;
      try {
        if (b.dataset.acao === 'recusar') {
          await api.recusarPedido(pedido.id);
          resultado.innerHTML = '<p>Recusado. Diga ao maestro, no terminal dele, o que mudar na divisão.</p>';
          return;
        }
        const r = await api.aprovarPedido(pedido.id);
        resultado.innerHTML = `<ul class="session-list">${pedido.tarefas
          .map((t) => {
            const s = r.sessoes[t];
            return `<li><b>${escapeHtml(t)}</b> ${s && 'sessionId' in s ? 'aberta, já está numa mesa do porão' : `não abriu: ${escapeHtml(s && 'erro' in s ? s.erro : 'sem resposta')}`}</li>`;
          })
          .join('')}</ul>`;
      } catch (e) {
        resultado.innerHTML = `<p>${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
      }
    });
  }
}
