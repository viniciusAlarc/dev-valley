import { api, getWorld, type PedidoPorao, type Project } from '../api';
import { villagerName } from '../game/names';
import { ui } from './actions';
import { closePanel, escapeHtml, openPanel } from './panel';

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
    <p class="muted">O que foi feito continua no relatório (estante de partitura, ao lado do maestro), no PROGRESS.md e nos commits.</p>
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
  if (pedido.roteiro) return openPedidoRoteiro(pedido, project);
  const n = pedido.tarefas.length;
  const panel = openPanel({ title: `O maestro quer abrir ${n} ${n === 1 ? 'sessão' : 'sessões'}`, subtitle: `${project.name} · rodada ${pedido.rodada}` });
  panel.body.innerHTML = `
    <p>Uma sessão de trabalho por tarefa. Cada uma começa lendo o briefing dela e fica só no porão. Abrir libera, sem
    pedir de novo, o que está em cada tarefa:</p>
    <ul class="session-list">${pedido.tarefas
      .map((t) => {
        const perm = pedido.permissoes?.[t];
        const lista = (xs: string[]) => xs.map((x) => `<code>${escapeHtml(x)}</code>`).join(', ');
        const liberado = perm
          ? `<br><span class="muted">Editar:</span> ${lista(perm.arquivos)}<br><span class="muted">Rodar:</span> ${perm.testes.length ? lista(perm.testes) : 'nenhum comando'}`
          : '<br><span class="muted">Nada liberado: pede permissão para tudo.</span>';
        return `<li><b>${escapeHtml(t)}</b> <code>~/.claude/maestro/rodadas/${escapeHtml(pedido.rodada)}/briefings/${escapeHtml(t)}.md</code>${liberado}</li>`;
      })
      .join('')}</ul>
    <p class="muted">Fora disso elas pedem permissão como qualquer sessão: o ❗ aparece no morador do porão e no topo da tela.</p>
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

/**
 * Cartão do roteiro de testes (05/11/2026): a rodada mexeu em tela e o maestro pede a sessão que monta o roteiro. Ela
 * nasce na casa, como morador comum (fora do teto, o gongo não a apaga), e continua a triagem e o reteste com você.
 */
function openPedidoRoteiro(pedido: PedidoPorao, project: Project) {
  const panel = openPanel({ title: 'Roteiro de testes da rodada', subtitle: `${project.name} · rodada ${pedido.rodada}` });
  panel.body.innerHTML = `
    <p>A rodada mexeu no que você vê na tela. Abrir cria um morador na casa que começa com
    <code>/roteiro-testes ${escapeHtml(pedido.roteiro ?? '')}</code>: lê o relatório, o PROGRESS.md e a spec de cada tela,
    e te entrega o link do roteiro para executar.</p>
    <p class="muted">Depois, cole nele o resultado: ele separa cada falha, corrige o que for defeito e gera o reteste.
    É uma sessão comum: pede permissão como qualquer outra, e o gongo do porão não a apaga.</p>
    <p class="porao-acoes">
      <button class="btn btn-primary" data-acao="aprovar">Abrir a sessão do roteiro</button>
      <button class="btn btn-danger" data-acao="recusar">Agora não</button>
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
          resultado.innerHTML = '<p>Sem sessão do roteiro. Para montar depois, numa sessão da casa: <code>/roteiro-testes ' + escapeHtml(pedido.roteiro ?? '') + '</code></p>';
          return;
        }
        const r = await api.aprovarPedido(pedido.id);
        const s = r.sessoes.roteiro;
        resultado.innerHTML = s && 'sessionId' in s
          ? '<p>Aberta: o morador novo está na casa montando o roteiro. Quando ele te der o link, é só seguir.</p>'
          : `<p>Não abriu: ${escapeHtml(s && 'erro' in s ? s.erro : 'sem resposta')}</p>`;
      } catch (e) {
        resultado.innerHTML = `<p>${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
      }
    });
  }
}
