import { api, type FileChange, type Project } from '../api';
import { button, escapeHtml, openPanel } from './panel';

type Monaco = typeof import('monaco-editor');
let monacoPromise: Promise<Monaco> | null = null;

/** O Monaco é pesado, então só carrega quando a caixa de envio é aberta pela primeira vez. */
function loadMonaco(): Promise<Monaco> {
  monacoPromise ??= (async () => {
    const [monaco, { default: EditorWorker }] = await Promise.all([
      import('monaco-editor'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
    ]);
    (self as any).MonacoEnvironment = { getWorker: () => new EditorWorker() };
    return monaco;
  })();
  return monacoPromise;
}

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

function languageFor(monaco: Monaco, file: string) {
  const ext = '.' + file.split('.').pop()!.toLowerCase();
  return monaco.languages.getLanguages().find((l) => l.extensions?.includes(ext))?.id ?? 'plaintext';
}

export function openCommit(project: Project) {
  let diffEditor: import('monaco-editor').editor.IStandaloneDiffEditor | null = null;
  const panel = openPanel({
    title: `Caixa de envio — ${project.name}`,
    subtitle: project.branch ? `branch ${project.branch}` : undefined,
    size: 'lg',
    onClose: () => {
      const model = diffEditor?.getModel();
      diffEditor?.dispose();
      model?.original.dispose();
      model?.modified.dispose();
    },
  });

  if (!project.changes.length) {
    panel.body.innerHTML = `<p class="empty">A caixa está vazia — nenhuma mudança sem commit em <b>${escapeHtml(project.name)}</b>.</p>`;
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
        <textarea placeholder="Mensagem do commit..." rows="2"></textarea>
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

  const send = button('Enviar 📦', async () => {
    const files = items.filter((i) => i.checkbox.checked).map((i) => i.change.path);
    const message = textarea.value.trim();
    if (!files.length) return void (result.textContent = 'Selecione ao menos um arquivo.');
    if (!message) return void (result.textContent = 'Escreva a mensagem do commit.');
    send.disabled = true;
    result.textContent = 'Enviando...';
    try {
      const allSelected = files.length === project.changes.length;
      const { output } = await api.commit(project.id, message, allSelected ? [] : files);
      result.textContent = `✔ ${output.split('\n')[0]}`;
      setTimeout(panel.close, 1200);
    } catch (err) {
      result.textContent = `✖ ${(err as Error).message}`;
      send.disabled = false;
    }
  }, 'primary');
  panel.body.querySelector('.commit-row')!.append(send);

  list.querySelector('li')?.dispatchEvent(new MouseEvent('click'));
  textarea.focus();
}
