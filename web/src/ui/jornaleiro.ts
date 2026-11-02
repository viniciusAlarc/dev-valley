import { getWorld, jornal } from '../api';
import { ui } from './actions';
import { button, escapeHtml, type Panel } from './panel';

const DIA = 24 * 3600_000;

/** `AAAA-MM-DD` local, para o campo de data. */
const iso = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Atalhos da conversa com o jornaleiro (02/11/2026): "A semana de um projeto" e "Desde uma data" imprimem uma edição
 * extra da Gazeta. Só um painel fica aberto por vez, então o formulário aparece no lugar dos botões, no topo da conversa;
 * ao imprimir, a Gazeta extra abre no lugar da conversa (que continua guardada).
 */
export function atalhosDoJornaleiro(panel: Panel) {
  const area = document.createElement('span');
  area.className = 'button-row';
  panel.actions.prepend(area);

  const imprimir = async (desde: number, projectId?: string) => {
    area.replaceChildren(Object.assign(document.createElement('span'), { className: 'muted', textContent: 'Pedindo a edição extra…' }));
    try {
      await jornal.extra(desde, projectId);
      ui.openJornal(undefined, 'extra');
    } catch (err) {
      area.replaceChildren(Object.assign(document.createElement('span'), { className: 'error', textContent: String(err) }));
      setTimeout(botoes, 4000);
    }
  };

  const formulario = (campo: HTMLElement, aoImprimir: () => void) => {
    area.replaceChildren(campo, button('Imprimir extra', aoImprimir, 'primary'), button('Cancelar', botoes));
    campo.focus();
  };

  function botoes() {
    area.replaceChildren(
      button('A semana de um projeto', () => {
        const select = document.createElement('select');
        select.innerHTML = getWorld()
          .projects.filter((p) => p.isGit)
          .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
          .join('');
        formulario(select, () => select.value && void imprimir(Date.now() - 7 * DIA, select.value));
      }),
      button('Desde uma data', () => {
        const data = document.createElement('input');
        data.type = 'date';
        data.min = iso(Date.now() - 30 * DIA);
        data.max = iso(Date.now());
        data.value = iso(Date.now() - 3 * DIA);
        formulario(data, () => {
          const [a, m, d] = data.value.split('-').map(Number);
          if (a && m && d) void imprimir(new Date(a, m - 1, d).getTime());
        });
      }),
    );
  }
  botoes();
}
