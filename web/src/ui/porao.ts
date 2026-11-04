import { api, getWorld, type PedidoPorao, type Project } from '../api';
import { villagerName } from '../game/names';
import { ui } from './actions';
import { closePanel, escapeHtml, openPanel } from './panel';

/** Quadro do porão: os relatórios das rodadas do maestro (`docs-dev/maestro/`), o mais novo primeiro. */
export function openRelatorios(project: Project) {
  const list = project.relatorios ?? [];
  const panel = openPanel({ title: `Relatórios do maestro — ${project.name}`, subtitle: `${list.length} rodada(s) · docs-dev/maestro/`, size: 'lg', scroll: true });
  if (!list.length) {
    panel.body.innerHTML = '<p class="empty">Nenhuma rodada fechada ainda. O maestro escreve o relatório ao fechar cada uma.</p>';
    return;
  }
  panel.body.innerHTML = `<ul class="session-list pend-list">${list
    .map(
      (r, i) => `<li>
        <span class="pend-item">${escapeHtml(r.title)}</span>
        <code class="book-link" data-i="${i}" title="Abrir na biblioteca">${escapeHtml(r.data ?? r.path.split('/').pop() ?? '')}</code>
      </li>`,
    )
    .join('')}</ul>`;
  for (const el of panel.body.querySelectorAll<HTMLElement>('[data-i]'))
    el.addEventListener('click', () => ui.openLibrary({ path: list[Number(el.dataset.i)].path }));
}

/**
 * Gongo do porão: "Encerrar rodada" apaga as conversas do porão do projeto, maestro e tarefas, como o encerrar de
 * sempre da vila (decisão do usuário, 03/11/2026). A confirmação lista cada uma antes.
 */
export function openEncerrarRodada(project: Project) {
  const sessoes = getWorld().sessions.filter((s) => s.projectId === project.id && s.porao);
  const panel = openPanel({ title: 'Encerrar a rodada', subtitle: `${project.name} · porão` });
  if (!sessoes.length) {
    panel.body.innerHTML = '<p class="empty">O porão está vazio: nada para encerrar.</p>';
    return;
  }
  const vivas = sessoes.filter((s) => s.live).length;
  panel.body.innerHTML = `
    <p>Apaga de vez estas ${sessoes.length} conversa(s) do porão${vivas ? `, parando as ${vivas} que ainda estão abertas` : ''}:</p>
    <ul class="session-list">${sessoes
      .map((s) => {
        const papel = s.porao?.papel === 'maestro' ? '✦ maestro' : `tarefa ${s.porao?.papel === 'tarefa' ? escapeHtml(s.porao.tarefa) : ''}`;
        return `<li><b>${escapeHtml(s.name || villagerName(s.id))}</b> · ${papel}${s.live ? ' · aberta' : ''}<br><span class="muted">${escapeHtml(s.title)}</span></li>`;
      })
      .join('')}</ul>
    <p class="muted">O que foi feito continua no relatório (quadro do porão), no PROGRESS.md e nos commits.</p>
    <p class="porao-acoes">
      <button class="btn btn-danger" data-acao="encerrar">Apagar e encerrar</button>
      <button class="btn" data-acao="cancelar">Cancelar</button>
    </p>
    <div class="porao-resultado"></div>`;
  const resultado = panel.body.querySelector<HTMLElement>('.porao-resultado')!;
  panel.body.querySelector('[data-acao="cancelar"]')!.addEventListener('click', () => closePanel());
  const botao = panel.body.querySelector<HTMLButtonElement>('[data-acao="encerrar"]')!;
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    try {
      const r = await api.encerrarRodada(project.id);
      resultado.innerHTML = `<p>Rodada encerrada: ${r.apagadas} conversa(s) apagada(s). O porão está pronto para a próxima.</p>`;
    } catch (e) {
      botao.disabled = false;
      resultado.innerHTML = `<p>${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
    }
  });
}

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
