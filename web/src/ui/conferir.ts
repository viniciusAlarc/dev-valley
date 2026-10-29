import { api, onWorld, type World } from '../api';
import { button, escapeHtml, openPanel } from './panel';

/**
 * Sino da praça: entregas do `PROGRESS.md` de todos os projetos que ainda dizem "Falta conferir na vila", e o reinício
 * pendente do próprio Dev Valley. As caixinhas marcam a entrega como conferida no `PROGRESS.md` sem passar pelo
 * administrador (pedido do usuário, 29/10/2026); plano em `a-codar/` e pendência continuam com a sessão ou o administrador.
 */
export function openConferir(world: World) {
  const unsubscribe = onWorld(draw);
  const panel = openPanel({ title: 'Sino de conferência', subtitle: 'PROGRESS.md', size: 'lg', scroll: true, onClose: unsubscribe });
  const subtitle = panel.root.querySelector<HTMLElement>('.subtitle');
  const submit = button('Marcar como conferidas', () => void marcar(), 'primary');
  const status = document.createElement('span');
  status.className = 'muted';
  panel.actions.append(status, submit);
  let drawnKey = '';
  draw(world);

  // O mundo chega a cada evento de sessão: só redesenha quando o que o sino mostra mudou, e mantém o que está marcado.
  function draw(w: World) {
    const groups = w.projects
      .map((project) => ({ project, list: project.progress?.toCheck ?? [] }))
      .filter((g) => g.list.length)
      .sort((a, b) => a.project.name.localeCompare(b.project.name));
    const key = JSON.stringify([w.restart, groups.map((g) => [g.project.id, g.list, g.project.sementes?.filter((s) => s.toCheck)])]);
    if (key === drawnKey) return;
    drawnKey = key;
    const marked = new Set([...panel.body.querySelectorAll<HTMLInputElement>('.conferir-list input:checked')].map(checkKey));
    const total = groups.reduce((n, g) => n + g.list.length, 0);
    if (subtitle) subtitle.textContent = `${total} entrega(s) esperando você conferir · PROGRESS.md`;

    const restart = [
      w.restart.server && 'O servidor do Dev Valley mudou depois que a vila subiu.',
      w.restart.web && 'O front do Dev Valley mudou depois do último build.',
    ].filter(Boolean) as string[];
    const restartHtml = restart.length
      ? `<h3>Reinício pendente</h3>
         <p>${restart.map(escapeHtml).join(' ')} Rode <code>npm start</code> de novo quando as sessões da vila terminarem:
         o reinício encerra todos os terminais.</p>`
      : '';

    submit.hidden = !total;
    if (!total && !restartHtml) {
      panel.body.innerHTML = '<p class="empty">Nada esperando conferência na vila.</p>';
      return;
    }
    panel.body.innerHTML =
      restartHtml +
      groups
        .map(({ project, list }) => {
          const planos = (project.sementes ?? []).filter((s) => s.toCheck);
          const aviso = planos.length
            ? `<p class="muted">Plano em <code>docs-dev/a-codar/</code> ainda esperando conferência
               (${planos.map((s) => escapeHtml(s.title)).join(', ')}): a caixinha não mexe nele, peça ao administrador ou à sessão.</p>`
            : '';
          return `<h3>${escapeHtml(project.name)}</h3>
            <ul class="session-list pend-list conferir-list">${list
              .map(
                (e) => `<li><label><input type="checkbox" data-project="${escapeHtml(project.id)}"
                  data-date="${escapeHtml(e.date)}" data-title="${escapeHtml(e.title)}" />
                  <span class="muted">${escapeHtml(e.date)}</span> <span class="pend-item">${escapeHtml(e.title)}</span></label></li>`,
              )
              .join('')}</ul>${aviso}`;
        })
        .join('');
    panel.body.querySelectorAll<HTMLInputElement>('.conferir-list input').forEach((c) => (c.checked = marked.has(checkKey(c))));
  }

  function checkKey(c: HTMLInputElement) {
    return `${c.dataset.project}\n${c.dataset.date}\n${c.dataset.title}`;
  }

  async function marcar() {
    const checked = [...panel.body.querySelectorAll<HTMLInputElement>('.conferir-list input:checked')];
    if (!checked.length) {
      status.textContent = 'Marque ao menos uma entrega.';
      return;
    }
    const porProjeto = new Map<string, { date: string; title: string }[]>();
    for (const c of checked) {
      const list = porProjeto.get(c.dataset.project!) ?? [];
      list.push({ date: c.dataset.date!, title: c.dataset.title! });
      porProjeto.set(c.dataset.project!, list);
    }
    submit.disabled = true;
    status.textContent = 'Gravando…';
    try {
      let total = 0;
      for (const [project, items] of porProjeto) total += (await api.conferir(project, items)).marcadas;
      status.textContent = `${total} entrega(s) marcada(s) como conferida(s).`;
    } catch (err) {
      status.textContent = `Erro: ${(err as Error).message}`;
    } finally {
      submit.disabled = false;
    }
  }
}
