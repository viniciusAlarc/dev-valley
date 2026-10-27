import { api, getWorld, type Carta, type Project, type Voo } from '../api';
import { ui } from './actions';
import { button, escapeHtml, openPanel, timeAgo } from './panel';

/**
 * Pombal da casa (decisão de 27/10/2026): de manhã o pombo traz as cartas da branch comum do time (pull), no fim
 * do dia leva as suas (push). Abrir busca o remoto na hora. Enviar pede confirmação com a lista do que vai,
 * porque é push numa branch que outra pessoa usa.
 */
export function openPombal(project: Project) {
  const cfg = project.pombal!;
  const panel = openPanel({
    title: `Pombal — ${project.name}`,
    subtitle: `${cfg.minha} ⇄ ${cfg.integracao} (${cfg.remoto})`,
    size: 'lg',
    scroll: true,
  });
  panel.body.innerHTML = '<p class="empty">O pombo está indo ver se chegou carta (buscando o remoto)...</p>';
  let ultimoVoo: Voo | null = null;
  void carregar();

  async function carregar() {
    try {
      render(await api.cartas(project.id));
    } catch (err) {
      panel.body.innerHTML = `<p class="empty error">${escapeHtml(String((err as Error).message ?? err))}</p>`;
    }
  }

  function render({ receber, enviar }: { receber: Carta[]; enviar: Carta[] }) {
    const cur = getWorld().projects.find((p) => p.id === project.id) ?? project;
    const pombal = cur.pombal ?? cfg;
    const semCommit = cur.changes.filter((c) => c.status !== '??').length;
    const moradores = getWorld().sessions.filter((s) => s.projectId === project.id && s.live).length;

    const avisos = [
      pombal.branchErrada && `A casa está em outra branch (${escapeHtml(cur.branch ?? '?')}). O pombo só sai da <b>${escapeHtml(pombal.minha)}</b>.`,
      semCommit && `${semCommit} mudança(s) sem commit. Passe pela caixa de envio antes de mandar o pombo.`,
      moradores && `${moradores} morador(es) trabalhando nesta casa. Trazer cartas muda arquivos debaixo deles.`,
      pombal.erro && `Última tentativa: ${escapeHtml(pombal.erro)}`,
    ].filter(Boolean);
    const bloqueado = pombal.branchErrada || semCommit > 0;

    panel.body.innerHTML = `
      ${avisos.length ? `<ul class="pombal-avisos">${avisos.map((a) => `<li>⚠️ ${a}</li>`).join('')}</ul>` : ''}
      ${pombal.buscadoEm ? `<p class="muted">Remoto buscado ${timeAgo(pombal.buscadoEm)}.</p>` : ''}
      <h3>🌅 Chegando da ${escapeHtml(pombal.integracao)} (${receber.length})</h3>
      ${lista(receber, `Nada novo. A ${escapeHtml(pombal.minha)} já tem tudo da ${escapeHtml(pombal.integracao)}.`)}
      <div class="pombal-acao" data-acao="receber"></div>
      <h3>🌇 Suas cartas para a ${escapeHtml(pombal.integracao)} (${enviar.length})</h3>
      ${lista(enviar, `Nenhuma. A ${escapeHtml(pombal.integracao)} já tem tudo o que você fez.`)}
      <div class="pombal-acao" data-acao="enviar"></div>
      <div class="pombal-resultado"></div>`;

    const receberBox = panel.body.querySelector<HTMLElement>('[data-acao="receber"]')!;
    const enviarBox = panel.body.querySelector<HTMLElement>('[data-acao="enviar"]')!;
    const resultado = panel.body.querySelector<HTMLElement>('.pombal-resultado')!;
    if (ultimoVoo) mostrarVoo(resultado, ultimoVoo);

    if (semCommit) receberBox.append(button('Abrir a caixa de envio', () => ui.openCommit(cur)));
    const btnReceber = button('Trazer as cartas (pull)', () => void voar('receber'), 'primary');
    btnReceber.disabled = bloqueado;
    receberBox.append(btnReceber);

    const btnEnviar = button(`Mandar o pombo à ${pombal.integracao} (push)`, confirmarEnvio, 'primary');
    btnEnviar.disabled = bloqueado || !enviar.length;
    enviarBox.append(btnEnviar);

    function confirmarEnvio() {
      enviarBox.replaceChildren();
      const q = document.createElement('span');
      q.className = 'agent-confirm';
      q.innerHTML = `Vão para a <b>${escapeHtml(pombal.integracao)}</b> ${enviar.length} commit(s)${
        receber.length ? `, depois de trazer as ${receber.length} carta(s) que chegaram` : ''
      }. Quem trabalha na ${escapeHtml(pombal.integracao)} recebe isso no próximo pull. Enviar?`;
      enviarBox.append(q, button('Sim, enviar', () => void voar('enviar'), 'primary'), button('Cancelar', () => render({ receber, enviar })));
    }

    async function voar(acao: 'receber' | 'enviar') {
      for (const b of panel.body.querySelectorAll<HTMLButtonElement>('.pombal-acao button')) b.disabled = true;
      resultado.innerHTML = `<p class="muted">${acao === 'receber' ? 'O pombo foi buscar as cartas...' : 'O pombo está levando as cartas...'}</p>`;
      try {
        ultimoVoo = await api.voar(project.id, acao);
      } catch (err) {
        ultimoVoo = { passos: [], error: String((err as Error).message ?? err) };
      }
      await carregar();
    }
  }
}

function lista(cartas: Carta[], vazio: string) {
  if (!cartas.length) return `<p class="empty">${vazio}</p>`;
  const items = cartas
    .map(
      (c) => `<li>
        <b class="pend-id">${escapeHtml(c.data)}</b>
        <span class="pend-item">${escapeHtml(c.assunto)}<br><span class="muted">${escapeHtml(c.autor)} · ${escapeHtml(c.hash)}</span></span>
      </li>`,
    )
    .join('');
  return `<ul class="session-list pend-list">${items}</ul>`;
}

function mostrarVoo(el: HTMLElement, voo: Voo) {
  const passos = voo.passos.map((p) => `<li>✔ ${escapeHtml(p)}</li>`).join('');
  const conflitos = voo.conflitos?.length ? `<p>Arquivos em conflito:</p><ul>${voo.conflitos.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('')}</ul>` : '';
  el.innerHTML = `
    <h3>${voo.error ? '✖ O pombo voltou sem completar' : '✔ O pombo voltou'}</h3>
    ${passos ? `<ul class="pombal-passos">${passos}</ul>` : ''}
    ${voo.error ? `<p class="error">${escapeHtml(voo.error)}</p>${conflitos}` : ''}`;
}
