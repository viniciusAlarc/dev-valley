import { api, colunaDa, comandosDoPedido, getWorld, onWorld, rodadaDoPorao, type ColunaDoQuadro, type CriticaDoCartao, type PedidoPorao, type Project, type RodadaPorao, type World } from '../api';
import { villagerName } from '../game/names';
import { ui } from './actions';
import { button, closePanel, escapeHtml, openPanel } from './panel';

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
  const depois = pedido.tarefas.filter((t) => pedido.dependencias?.[t]?.length).length;
  // Maestro v3: com comando de teste, a vila roda a linha de base antes de abrir qualquer sessão.
  const comandos = comandosDoPedido(pedido);
  const agora = comandos.length ? 'abrem quando a linha de base terminar' : 'abrem agora';
  // Ondas (P3, 25/11/2026): passou de `simultaneas` tarefas livres, a vila abre as primeiras e as outras conforme vagam.
  const max = pedido.simultaneas ?? n;
  const ondas = n - depois > max;
  const panel = openPanel({ title: `O maestro quer abrir ${n} ${n === 1 ? 'sessão' : 'sessões'}`, subtitle: `${project.name} · rodada ${pedido.rodada}` });
  const lista = (xs: string[]) => xs.map((x) => `<code>${escapeHtml(x)}</code>`).join(', ');
  panel.body.innerHTML = `
    <p>Uma sessão de trabalho por tarefa. Cada uma começa lendo o briefing dela e fica só no porão.${
      depois ? ` ${n - depois} ${agora}; ${depois === 1 ? 'a outra abre sozinha' : `as outras ${depois} abrem sozinhas`} quando a tarefa de que depende ficar pronta.` : ''
    }${ondas ? ` A rodada abre em ondas de até ${max}: as outras entram sozinhas quando uma ficar pronta, para não esgotar o limite do plano.` : ''} Abrir libera, sem pedir de novo, o que está em cada tarefa:</p>
    <ul class="session-list">${pedido.tarefas
      .map((t) => {
        const perm = pedido.permissoes?.[t];
        const liberado = perm
          ? `<br><span class="muted">Editar:</span> ${lista(perm.arquivos)}<br><span class="muted">Rodar:</span> ${perm.testes.length ? lista(perm.testes) : 'nenhum comando'}`
          : '<br><span class="muted">Nada liberado: pede permissão para tudo.</span>';
        const deps = pedido.dependencias?.[t] ?? [];
        const quando = deps.length ? `<br><span class="muted">Abre quando ${deps.map(escapeHtml).join(' e ')} ${deps.length === 1 ? 'ficar pronta' : 'ficarem prontas'}.</span>` : '';
        return `<li><b>${escapeHtml(t)}</b> <code>~/.claude/maestro/rodadas/${escapeHtml(pedido.rodada)}/briefings/${escapeHtml(t)}.md</code>${quando}${liberado}</li>`;
      })
      .join('')}</ul>
    <p class="muted">Fora disso elas pedem permissão como qualquer sessão: o ❗ aparece no morador do porão e no topo da tela.</p>
    ${
      comandos.length
        ? `<p>A vila roda ${lista(comandos)} antes de abrir as sessões (linha de base) e de novo quando todas ficarem prontas: o relatório separa o que já estava vermelho do que a rodada quebrou.</p>`
        : '<p class="muted">Nenhuma tarefa trouxe comando de teste: a rodada sai sem verificação automática.</p>'
    }
    <div class="porao-critica"></div>
    <p class="porao-acoes">
      <button class="btn btn-primary" data-acao="aprovar">${depois || comandos.length ? 'Aprovar a rodada' : `Abrir ${n} ${n === 1 ? 'sessão' : 'sessões'}`}</button>
      <button class="btn btn-danger" data-acao="recusar">Recusar</button>
    </p>
    <div class="porao-resultado"></div>`;
  acompanharCritica(panel.body.querySelector<HTMLElement>('.porao-critica')!, pedido);
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
            if (!s && pedido.dependencias?.[t]?.length) return `<li><b>${escapeHtml(t)}</b> espera ${pedido.dependencias[t]!.map(escapeHtml).join(' e ')}</li>`;
            if (!s && ondas && !comandos.length) return `<li><b>${escapeHtml(t)}</b> abre na próxima onda, quando uma sessão ficar pronta</li>`;
            if (!s && comandos.length) return `<li><b>${escapeHtml(t)}</b> abre quando a linha de base terminar (o quadro na estante mostra)</li>`;
            return `<li><b>${escapeHtml(t)}</b> ${s && 'sessionId' in s ? 'aberta, já está numa mesa do porão' : `não abriu: ${escapeHtml(s && 'erro' in s ? s.erro : 'sem resposta')}`}</li>`;
          })
          .join('')}</ul>`;
      } catch (e) {
        resultado.innerHTML = `<p>${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
      }
    });
  }
}

/** A segunda opinião no cartão (21/11/2026): só os apontamentos confirmados, como aviso; o clique nunca espera por ela. */
function htmlDaCritica(c: CriticaDoCartao | null | undefined): string {
  if (!c) return '';
  if (c.estado === 'conferindo') return '<p class="muted">Segunda opinião (DeepSeek, conferida pelo Haiku): conferindo o cartão… Você não precisa esperar.</p>';
  if (c.estado === 'falhou') return `<p class="muted">Segunda opinião não rodou: ${escapeHtml(c.erro ?? 'sem resposta')}.</p>`;
  const descartados = c.refutados + c.incertos;
  const resto = [descartados ? `${descartados} descartado(s) pelo verificador` : '', c.foraDoTeto ? `${c.foraDoTeto} além do teto` : ''].filter(Boolean).join(' · ');
  if (!c.apontamentos.length) return `<p class="muted">Segunda opinião (DeepSeek, conferida pelo Haiku): nada a apontar no checklist.${resto ? ` (${resto})` : ''}</p>`;
  return `<p><b>Segunda opinião</b> <span class="muted">(DeepSeek, cada item conferido pelo Haiku; só avisa, a decisão é sua)</span></p>
    <ul class="pombal-avisos">${c.apontamentos
      .map((a) => `<li>⚠️ <b>${escapeHtml(a.item)}${a.tarefa ? ` · ${escapeHtml(a.tarefa)}` : ''}</b>: ${escapeHtml(a.problema)}<br><span class="muted">${escapeHtml(a.evidencia)}</span></li>`)
      .join('')}</ul>${resto ? `<p class="muted">${resto}</p>` : ''}`;
}

/** Mostra a crítica e, enquanto ela confere, lê de novo a cada 3 s até terminar ou o cartão fechar. */
function acompanharCritica(el: HTMLElement, pedido: PedidoPorao) {
  el.innerHTML = htmlDaCritica(pedido.critica);
  if (pedido.critica?.estado !== 'conferindo') return;
  const timer = window.setInterval(async () => {
    if (!el.isConnected) return window.clearInterval(timer);
    try {
      const { critica } = await api.pedidoPorao(pedido.id);
      el.innerHTML = htmlDaCritica(critica);
      if (critica?.estado !== 'conferindo') window.clearInterval(timer);
    } catch {
      window.clearInterval(timer);
    }
  }, 3000);
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

const COLUNAS: { id: ColunaDoQuadro; titulo: string; dot: string }[] = [
  { id: 'esperando', titulo: 'Esperando', dot: '' },
  { id: 'trabalhando', titulo: 'Trabalhando', dot: 'working' },
  { id: 'precisa', titulo: 'Precisa de você', dot: 'permission' },
  { id: 'pronta', titulo: 'Pronta', dot: 'idle' },
];

/** Onde a rodada está no gate (maestro v3), numa linha acima do quadro; vazio = rodada sem comando de teste. */
function textoDoGate(g: RodadaPorao['gate']): string {
  if (!g) return '<p class="muted">Sem verificação automática: nenhuma tarefa trouxe comando de teste.</p>';
  const cmds = g.comandos.map((c) => `<code>${escapeHtml(c)}</code>`).join(', ');
  switch (g.estado) {
    case 'linha-de-base':
      return `<p>Conferindo a linha de base: a vila roda ${cmds} antes de abrir as sessões. As tarefas abrem quando terminar.</p>`;
    case 'trabalhando':
      return `<p class="muted">Linha de base feita. Quando todas ficarem prontas, a vila roda ${cmds} de novo, antes do relatório.</p>`;
    case 'conferindo':
      return `<p>Conferindo o gate: a vila roda ${cmds} com todas as tarefas prontas. O relatório sai quando terminar.</p>`;
    case 'aprovada':
      return '<p>Gate aprovado: nenhum comando de teste quebrou.</p>';
    case 'reprovada':
      return `<p>❗ <b>Reprovada:</b> a rodada quebrou ${g.quebrou.map((c) => `<code>${escapeHtml(c)}</code>`).join(', ')}. Nenhuma sessão foi reaberta; o relatório diz onde está a saída. A decisão é sua.</p>`;
  }
}

const minutos = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};

/**
 * Quadro da rodada (maestro v2, fase 4): o que a vila sabe de cada tarefa, uma coluna por estado. Abre na estante de
 * partitura enquanto a rodada anda (D4) e se redesenha a cada mudança do mundo. Clique na tarefa abre a sessão dela.
 */
export function openQuadroRodada(project: Project) {
  const unsubscribe = onWorld(draw);
  const panel = openPanel({ title: 'Quadro da rodada', subtitle: `${project.name} · porão`, size: 'lg', scroll: true, onClose: unsubscribe });
  let chave = '';
  draw(getWorld());

  function draw(w: World) {
    const r = rodadaDoPorao(w, project.id);
    const vivas = (r?.tarefas ?? []).map((t) => ({ t, coluna: colunaDa(t, w), s: w.sessions.find((x) => x.id === t.sessionId) }));
    const k = JSON.stringify([r, vivas.map((v) => [v.coluna, v.s?.name])]);
    if (k === chave) return;
    chave = k;
    if (!r) {
      panel.body.innerHTML = '<p class="empty">Nenhuma rodada em andamento neste porão.</p>';
      return;
    }
    const agora = Date.now();
    const motivo = (v: (typeof vivas)[number]) => {
      const t = v.t;
      if (t.estado === 'esperando') return `depois de ${t.dependeDe.map(escapeHtml).join(' e ')}`;
      if (t.estado === 'erro') return `não abriu: ${escapeHtml(t.erro ?? '')}`;
      if (t.estado === 'pronta') return t.abertaEm && t.prontaEm ? `em ${minutos(t.prontaEm - t.abertaEm)}` : 'pronta';
      if (t.parouSemTerminar) return 'parou sem a devolutiva: abra para ver o que ela pergunta';
      if (v.coluna === 'precisa') return '❗ pedindo permissão';
      return t.abertaEm ? `há ${minutos(agora - t.abertaEm)}` : 'abrindo';
    };
    const colunas = COLUNAS.map((c) => {
      const itens = vivas.filter((v) => v.coluna === c.id);
      const lis = itens.length
        ? itens
            .map(
              (v) => `<li data-tarefa="${escapeHtml(v.t.id)}"${v.s ? '' : ' class="empty"'}>
                <b>${escapeHtml(v.t.id)}</b>${v.s ? ` <span>${escapeHtml(v.s.name || villagerName(v.s.id))}</span>` : ''}
                <br><span class="muted">${motivo(v)}</span></li>`,
            )
            .join('')
        : '<li class="empty muted">—</li>';
      return `<section class="quadro-coluna"><h3><span class="dot ${c.dot}"></span>${c.titulo} <span class="muted">${itens.length}</span></h3>
        <ul class="session-list">${lis}</ul></section>`;
    }).join('');
    const prontas = r.tarefas.filter((t) => t.estado === 'pronta').length;
    panel.body.innerHTML = `
      <p>Rodada <code>${escapeHtml(r.rodada)}</code> · ${prontas} de ${r.tarefas.length} pronta(s). A vila marca a tarefa
      pronta quando a sessão grava a devolutiva, e abre sozinha a que esperava por ela.</p>
      ${textoDoGate(r.gate)}
      <div class="quadro-rodada">${colunas}</div>
      ${
        r.relatorio
          ? `<p>Relatório montado: <code>${escapeHtml(r.relatorio)}</code>. Commite pelo pombal; o gongo encerra a rodada.</p>`
          : '<p class="muted">Quando todas ficarem prontas, o relatório aparece aqui e na estante.</p>'
      }
      <p class="porao-acoes"></p>`;
    for (const li of panel.body.querySelectorAll<HTMLElement>('li[data-tarefa]')) {
      const v = vivas.find((x) => x.t.id === li.dataset.tarefa);
      if (v?.s) li.addEventListener('click', () => ui.openSession(v.s!));
    }
    if (r.relatorio) panel.body.querySelector('.porao-acoes')!.append(button('Ver os relatórios', () => ui.openRelatorios(project)));
  }
}
