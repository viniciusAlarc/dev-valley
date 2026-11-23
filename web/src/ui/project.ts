import { activityOf, api, contaDaSessao, contaPadraoDaCasa, CONTEXT_CRITICAL, CONTEXT_WARN, getWorld, naSala, noQuarto, onWorld, type Project, type Session } from '../api';

const contextLevel = (pct: number) => (pct >= CONTEXT_CRITICAL ? 'critical' : pct >= CONTEXT_WARN ? 'warning' : 'normal');
import { villagerName } from '../game/names';
import { ui } from './actions';
import { button, escapeHtml, openPanel, timeAgo } from './panel';
import { openNovaSessao } from './novaSessao';

/**
 * Painel da escrivaninha. Quarto (21/11/2026): cada morador da sala tem uma caixa de marcar e as marcadas vão juntas
 * para o quarto (dormir: processo encerrado, conversa guardada) ou são encerradas (apagadas de vez), sem abrir uma por
 * uma. Quem trabalha ou pede permissão também pode, mas a confirmação avisa antes (decisão do usuário). `aviso` é o
 * resultado da operação anterior, mostrado no topo da lista.
 */
export function openProject(project: Project, aviso?: string) {
  const panel = openPanel({ title: project.name, subtitle: project.path });
  const world = getWorld();
  const sessions = world.sessions.filter((s) => s.projectId === project.id && naSala(s)).sort((a, b) => b.lastActivity - a.lastActivity);
  const dormindo = noQuarto(world, project.id).length;
  const padrao = contaPadraoDaCasa(project);

  panel.body.innerHTML = `
    <dl class="facts">
      <dt>Branch</dt><dd>${escapeHtml(project.branch ?? '—')}</dd>
      <dt>Remoto</dt><dd>${project.remote ? escapeHtml(project.remote) : '—'}</dd>
      <dt>Mudanças</dt><dd>${project.isGit ? project.changes.length : 'sem git'}</dd>
      <dt>Abre em</dt><dd><span class="conta-dot ${padrao.provedor}"></span> ${escapeHtml(padrao.nome)}</dd>
    </dl>
    <h3>Moradores (sessões)</h3>
    ${aviso ? `<p class="lote-aviso">${escapeHtml(aviso)}</p>` : ''}
    <div class="lote-barra" hidden>
      <label class="lote-todas"><input type="checkbox"> Marcar todas</label>
      <span class="muted lote-conta"></span>
      <span class="lote-botoes"></span>
    </div>
    <div class="lote-confirma" hidden></div>
    <ul class="session-list"></ul>
    ${dormindo ? `<p class="muted">💤 ${dormindo} dormindo no quarto (porta à direita da sala).</p>` : ''}
    <div class="button-row acoes-casa"></div>`;

  const list = panel.body.querySelector('.session-list')!;
  const barra = panel.body.querySelector<HTMLElement>('.lote-barra')!;
  const confirma = panel.body.querySelector<HTMLElement>('.lote-confirma')!;
  const todas = barra.querySelector<HTMLInputElement>('.lote-todas input')!;
  const conta = barra.querySelector('.lote-conta')!;
  const marcadas = new Set<string>();
  const caixas: HTMLInputElement[] = [];

  if (!sessions.length) list.innerHTML = '<li class="empty">Ninguém mora aqui ainda.</li>';
  const STATUS_TEXT = { permission: '❗ precisa de você', working: 'trabalhando', idle: 'esperando você' };
  for (const s of sessions) {
    const activity = activityOf(s);
    const contaS = contaDaSessao(s);
    // Aberta em outro terminal (VS Code): a vila não encerra o processo de lá, então não dá para marcar.
    const deFora = s.live && !s.inTown;
    const li = document.createElement('li');
    li.innerHTML = `
      <input type="checkbox" class="lote-caixa" ${deFora ? 'disabled title="Aberta em outro terminal: feche por lá primeiro"' : 'title="Marcar para dormir ou encerrar"'}>
      <span class="dot ${activity}"></span>
      <b>${escapeHtml(villagerName(s.id))}</b>
      ${contaS && contaS.nome !== padrao.nome ? `<span class="conta-pill"><span class="conta-dot ${contaS.provedor}"></span>${escapeHtml(contaS.nome)}</span>` : ''}
      <span class="session-title">${escapeHtml(s.title)}</span>
      ${s.context ? `<span class="ctx-pill ${contextLevel(s.context.percent)}" title="Janela de contexto usada">${s.context.estimated ? '~' : ''}${s.context.percent}%</span>` : ''}
      <span class="muted">${activity === 'offline' ? timeAgo(s.lastActivity) : STATUS_TEXT[activity]}</span>`;
    const caixa = li.querySelector<HTMLInputElement>('.lote-caixa')!;
    caixa.addEventListener('click', (e) => e.stopPropagation());
    caixa.addEventListener('change', () => {
      if (caixa.checked) marcadas.add(s.id);
      else marcadas.delete(s.id);
      li.classList.toggle('marcada', caixa.checked);
      atualizar();
    });
    if (!deFora) caixas.push(caixa);
    li.addEventListener('click', () => ui.openSession(s));
    list.append(li);
  }

  const escolhidas = () => sessions.filter((s) => marcadas.has(s.id));
  const botaoDormir = button('💤 Dormir', () => pedir('dormir'));
  const botaoEncerrar = button('Encerrar', () => pedir('encerrar'), 'danger');
  barra.querySelector('.lote-botoes')!.append(botaoDormir, botaoEncerrar);
  barra.hidden = !caixas.length;

  function atualizar() {
    const n = marcadas.size;
    conta.textContent = n ? `${n} marcada(s)` : '';
    botaoDormir.disabled = botaoEncerrar.disabled = !n;
    todas.checked = n > 0 && n === caixas.length;
    todas.indeterminate = n > 0 && n < caixas.length;
    confirma.hidden = true;
  }
  todas.addEventListener('change', () => {
    // O valor vem antes do laço: cada `change` disparado recalcula o "Marcar todas" (1 de N = desmarcado), e o laço que
    // comparava com ele parava na primeira caixa, marcando uma por clique (21/11/2026).
    const marcar = todas.checked;
    for (const c of caixas) {
      if (c.checked !== marcar) {
        c.checked = marcar;
        c.dispatchEvent(new Event('change'));
      }
    }
  });
  atualizar();

  // Confirmação dentro do painel, como o "Encerrar sessão" do chat: diz quem é, o que acontece e quem está trabalhando.
  function pedir(acao: 'dormir' | 'encerrar') {
    const lote = escolhidas();
    if (!lote.length) return;
    const ocupadas = lote.filter((s) => ['working', 'permission'].includes(activityOf(s)));
    const nomes = lote.map((s) => villagerName(s.id)).join(', ');
    const efeito =
      acao === 'dormir'
        ? `Mandar para o quarto: ${nomes}. O processo é encerrado e a conversa fica guardada; para voltar, abra no quarto.`
        : `Encerrar de vez: ${nomes}. A conversa é apagada e não dá para retomar.`;
    const ocupacao = ocupadas.length
      ? `<p class="lote-alerta">❗ ${escapeHtml(ocupadas.map((s) => `${villagerName(s.id)} está ${activityOf(s) === 'working' ? 'trabalhando' : 'pedindo sua permissão'}`).join('; '))}: o que está fazendo agora se perde.</p>`
      : '';
    confirma.innerHTML = `<p>${escapeHtml(efeito)}</p>${ocupacao}<div class="button-row"></div>`;
    confirma.querySelector('.button-row')!.append(
      button(acao === 'dormir' ? `💤 Dormir (${lote.length})` : `Encerrar (${lote.length})`, () => void executar(acao, lote), acao === 'dormir' ? 'primary' : 'danger'),
      button('Cancelar', () => (confirma.hidden = true)),
    );
    confirma.hidden = false;
  }

  async function executar(acao: 'dormir' | 'encerrar', lote: Session[]) {
    confirma.innerHTML = `<p class="muted">${acao === 'dormir' ? 'Mandando para o quarto' : 'Encerrando'}… (cada processo tem até 5 s para fechar)</p>`;
    const falhas: string[] = [];
    let feitas = 0;
    try {
      if (acao === 'dormir') {
        const r = await api.dormir(lote.map((s) => s.id));
        feitas = r.dormindo;
        for (const x of r.recusadas) falhas.push(`${villagerName(x.id)}: ${x.motivo}`);
      } else {
        // Uma por vez pela rota de sempre: erro numa não impede as outras.
        for (const s of lote) {
          try {
            await api.deleteSession(s.id);
            feitas++;
          } catch (err) {
            falhas.push(`${villagerName(s.id)}: ${(err as Error).message}`);
          }
        }
      }
    } catch (err) {
      falhas.push((err as Error).message);
    }
    const resumo = `${feitas} ${acao === 'dormir' ? 'foi(ram) dormir' : 'encerrada(s)'}.${falhas.length ? ` Não deu: ${falhas.join(' · ')}` : ''}`;
    // A rota já atualizou o mundo; o painel redesenha com ele assim que chega (ou em 1,5 s, se nada mudou).
    let feito = false;
    const reabrir = () => {
      if (feito) return;
      feito = true;
      pare();
      // Fechou o painel enquanto isso: não reabre por cima do que o usuário estiver fazendo.
      if (!panel.root.isConnected) return;
      openProject(getWorld().projects.find((p) => p.id === project.id) ?? project, resumo);
    };
    const pare = onWorld(reabrir);
    setTimeout(reabrir, 1500);
  }

  // Sessão nova: um botão só; a tela seguinte escolhe a conta (Claude, DeepSeek pessoal ou DeepSeek trabalho).
  panel.body.querySelector('.acoes-casa')!.append(
    button('Nova sessão', () => openNovaSessao({ project, voltar: () => openProject(project) }), 'primary'),
    button('Abrir no VS Code', () => api.openVsCode(project.id)),
    button('📚 Documentação', () => ui.openLibrary({ sectionId: `project:${project.id}` })),
    ...(project.pombal ? [button(`🕊️ Pombal (${project.pombal.locais} local)`, () => ui.openPombal(project))] : []),
  );
}
