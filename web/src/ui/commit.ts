import { api, type FileChange, type Project } from '../api';
import { languageFor, loadMonaco } from './monaco';
import { button, escapeHtml, openPanel } from './panel';

const STATUS_LABEL: Record<string, string> = {
  M: 'modificado',
  A: 'novo',
  D: 'removido',
  R: 'renomeado',
  '?': 'novo',
  U: 'conflito',
};

function statusOf(change: FileChange) {
  const code = change.status.trim()[0] ?? 'M';
  return { code: code === '?' ? 'N' : code, label: STATUS_LABEL[code] ?? change.status };
}

/**
 * Enviar para o time, aberto pelo pombal: os arquivos alterados com o diff e a mensagem. O botão faz commit, pull com
 * rebase e push de uma vez (dois estágios só: local e enviado; decisão de 28/10/2026). Sem upstream, só o commit.
 */
export function openEnviar(project: Project, onDone: () => void) {
  let diffEditor: import('monaco-editor').editor.IStandaloneDiffEditor | null = null;
  const panel = openPanel({
    title: `Pombal — enviar para o time — ${project.name}`,
    subtitle: project.pombal?.upstream ? `${project.branch} → ${project.pombal.upstream}` : `${project.branch ?? ''} (sem upstream: só guarda aqui)`,
    size: 'lg',
    onClose: () => {
      const model = diffEditor?.getModel();
      diffEditor?.dispose();
      model?.original.dispose();
      model?.modified.dispose();
    },
  });

  if (!project.changes.length) {
    panel.body.innerHTML = `<p class="empty">Nenhuma alteração por enviar em <b>${escapeHtml(project.name)}</b>.</p>`;
    return;
  }

  panel.actions.append(button('Abrir no VS Code', () => api.openVsCode(project.id, selected ?? undefined)));

  panel.body.innerHTML = `
    <div class="commit-layout">
      <aside class="file-list">
        <label class="select-all"><input type="checkbox" checked /> Todos (${project.changes.length})</label>
        <ul></ul>
      </aside>
      <section class="diff-host"><p class="empty">Escolha um arquivo para ver o diff.</p></section>
      <footer class="commit-form">
        <textarea placeholder="O que mudou? (mensagem do commit)" rows="2"></textarea>
        <div class="commit-row">
          <span class="commit-result"></span>
        </div>
      </footer>
    </div>`;

  const list = panel.body.querySelector('ul')!;
  const diffHost = panel.body.querySelector<HTMLElement>('.diff-host')!;
  const selectAll = panel.body.querySelector<HTMLInputElement>('.select-all input')!;
  const textarea = panel.body.querySelector('textarea')!;
  const result = panel.body.querySelector<HTMLElement>('.commit-result')!;
  let selected: string | null = null;

  const items = project.changes.map((change) => {
    const { code, label } = statusOf(change);
    const li = document.createElement('li');
    li.innerHTML = `
      <input type="checkbox" checked />
      <span class="status status-${code}" title="${label}">${code}</span>
      <span class="file-name" title="${escapeHtml(change.path)}">${escapeHtml(change.path)}</span>`;
    const checkbox = li.querySelector('input')!;
    li.addEventListener('click', (e) => {
      if (e.target === checkbox) return;
      list.querySelectorAll('li').forEach((el) => el.classList.remove('active'));
      li.classList.add('active');
      selected = change.path;
      void showDiff(change.path);
    });
    checkbox.addEventListener('change', () => {
      selectAll.checked = items.every((i) => i.checkbox.checked);
    });
    list.append(li);
    return { change, checkbox };
  });
  selectAll.addEventListener('change', () => items.forEach((i) => (i.checkbox.checked = selectAll.checked)));

  async function showDiff(file: string) {
    const [monaco, diff] = await Promise.all([loadMonaco(), api.diff(project.id, file)]);
    if (!diffEditor) {
      diffHost.innerHTML = '';
      diffEditor = monaco.editor.createDiffEditor(diffHost, {
        theme: 'vs-dark',
        readOnly: true,
        automaticLayout: true,
        renderSideBySide: diffHost.clientWidth > 900,
        minimap: { enabled: false },
        fontSize: 13,
      });
    }
    const old = diffEditor.getModel();
    const lang = languageFor(monaco, file);
    diffEditor.setModel({
      original: monaco.editor.createModel(diff.original, lang),
      modified: monaco.editor.createModel(diff.modified, lang),
    });
    old?.original.dispose();
    old?.modified.dispose();
  }

  const send = button(project.pombal?.upstream ? 'Enviar para o time 🕊️' : 'Guardar aqui 🕊️', async () => {
    const files = items.filter((i) => i.checkbox.checked).map((i) => i.change.path);
    const message = textarea.value.trim();
    if (!files.length) return void (result.textContent = 'Selecione ao menos um arquivo.');
    if (!message) return void (result.textContent = 'Escreva o que mudou.');
    send.disabled = true;
    result.textContent = 'O pombo está levando...';
    try {
      const allSelected = files.length === project.changes.length;
      const voo = await api.voar(project.id, 'enviar', { mensagem: message, arquivos: allSelected ? [] : files });
      if (voo.error) {
        result.textContent = `✖ ${voo.error}${voo.conflitos?.length ? ` (${voo.conflitos.join(', ')})` : ''}`;
        send.disabled = false;
        return;
      }
      result.textContent = `✔ ${voo.passos.at(-1) ?? 'Enviado'}`;
      setTimeout(() => {
        panel.close();
        onDone();
      }, 1200);
    } catch (err) {
      result.textContent = `✖ ${(err as Error).message}`;
      send.disabled = false;
    }
  }, 'primary');
  // Sugerir texto: o escrevente (claude -p, regra 5) lê o diff do que está marcado e escreve como eu escreveria.
  const sugerir = button('✨ Sugerir texto', async () => {
    const files = items.filter((i) => i.checkbox.checked).map((i) => i.change.path);
    if (!files.length) return void (result.textContent = 'Selecione ao menos um arquivo.');
    sugerir.disabled = true;
    result.textContent = 'O escrevente está lendo as alterações...';
    try {
      const { texto } = await api.sugerirMensagem(project.id, files.length === project.changes.length ? [] : files);
      textarea.value = texto;
      result.textContent = texto ? '✔ Sugestão pronta: revise e edite à vontade.' : 'O escrevente não sugeriu nada.';
      textarea.focus();
    } catch (err) {
      result.textContent = `✖ ${(err as Error).message}`;
    } finally {
      sugerir.disabled = false;
    }
  });
  panel.body.querySelector('.commit-row')!.append(sugerir, send);

  list.querySelector('li')?.dispatchEvent(new MouseEvent('click'));
  textarea.focus();
}
