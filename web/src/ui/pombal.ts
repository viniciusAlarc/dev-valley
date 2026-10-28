import { api, getWorld, type Carta, type Project, type Voo } from '../api';
import { openEnviar } from './commit';
import { button, escapeHtml, openPanel, timeAgo } from './panel';

type Cartas = { receber: Carta[]; enviar: Carta[]; arquivos: string[] };

/**
 * Pombal da casa, a única peça de git (decisões de 27 e 28/10/2026), em dois estágios: o que é só seu (local) e o que
 * o time já tem (enviado). "Trazer" é o pull da manhã (rebase); "Enviar para o time" faz commit, rebase e push de uma
 * vez. Abrir busca o remoto na hora. Sem upstream, enviar só guarda o commit aqui.
 */
export function openPombal(project: Project) {
  const panel = openPanel({
    title: `Pombal — ${project.name}`,
    subtitle: project.pombal?.upstream ? `${project.branch} ⇄ ${project.pombal.upstream}` : `${project.branch ?? ''} (sem upstream)`,
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

  function render(c: Cartas) {
    const cur = getWorld().projects.find((p) => p.id === project.id) ?? project;
    const pombal = cur.pombal;
    if (!pombal) {
      panel.body.innerHTML = '<p class="empty">Esta casa não tem git.</p>';
      return;
    }
    const time = pombal.upstream ? escapeHtml(pombal.upstream) : '';
    const moradores = getWorld().sessions.filter((s) => s.projectId === project.id && s.live).length;
    const avisos = [
      !pombal.upstream && 'A branch não tem upstream: dá para guardar (commit) aqui, mas não há time para onde enviar.',
      moradores && c.receber.length && `${moradores} morador(es) trabalhando nesta casa. Trazer muda arquivos debaixo deles.`,
      pombal.erro && `Última tentativa: ${escapeHtml(pombal.erro)}`,
      pombal.falhaBusca && `Busca automática: ${escapeHtml(pombal.falhaBusca)}`,
    ].filter(Boolean);

    panel.body.innerHTML = `
      ${avisos.length ? `<ul class="pombal-avisos">${avisos.map((a) => `<li>⚠️ ${a}</li>`).join('')}</ul>` : ''}
      ${pombal.buscadoEm ? `<p class="muted">Remoto buscado ${timeAgo(pombal.buscadoEm)}.</p>` : ''}
      ${
        pombal.upstream
          ? `<h3>🌅 Chegando do time (${c.receber.length})</h3>
             ${lista(c.receber, `Nada novo. Você já tem tudo de ${time}.`)}
             <div class="pombal-acao" data-acao="receber"></div>`
          : ''
      }
      <h3>✉️ Suas alterações locais (${c.arquivos.length} arquivo(s))</h3>
      ${
        c.arquivos.length
          ? `<ul class="pombal-arquivos">${c.arquivos.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('')}</ul>`
          : `<p class="empty">Nenhuma. ${pombal.upstream ? 'O time já tem tudo o que você fez.' : 'Tudo guardado.'}</p>`
      }
      <div class="pombal-acao" data-acao="enviar"></div>
      <div class="pombal-resultado"></div>`;

    const receberBox = panel.body.querySelector<HTMLElement>('[data-acao="receber"]');
    const enviarBox = panel.body.querySelector<HTMLElement>('[data-acao="enviar"]')!;
    const resultado = panel.body.querySelector<HTMLElement>('.pombal-resultado')!;
    if (ultimoVoo) mostrarVoo(resultado, ultimoVoo);

    receberBox?.append(button('Trazer (pull)', () => void voar('receber'), 'primary'));

    // Com alteração sem commit, a tela de enviar pede a mensagem e mostra o diff; só commits prontos, confirma aqui.
    const btnEnviar = button(pombal.upstream ? 'Enviar para o time 🕊️' : 'Guardar aqui 🕊️', () => {
      if (cur.changes.length) return openEnviar(cur, () => openPombal(getWorld().projects.find((p) => p.id === project.id) ?? cur));
      confirmarEnvio();
    }, 'primary');
    btnEnviar.disabled = !cur.changes.length && !c.enviar.length;
    enviarBox.append(btnEnviar);

    function confirmarEnvio() {
      enviarBox.replaceChildren();
      const q = document.createElement('span');
      q.className = 'agent-confirm';
      q.innerHTML = `Vão para <b>${time}</b> ${c.enviar.length} commit(s) já guardado(s): ${c.enviar
        .slice(0, 3)
        .map((e) => `"${escapeHtml(e.assunto)}"`)
        .join(', ')}${c.enviar.length > 3 ? '...' : ''}. Enviar?`;
      enviarBox.append(q, button('Sim, enviar', () => void voar('enviar'), 'primary'), button('Cancelar', () => render(c)));
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
