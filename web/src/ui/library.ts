import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { library, type LibraryFile, type LibrarySection } from '../api';
import { ui } from './actions';
import { loadMonaco } from './monaco';
import { button, escapeHtml, openPanel, timeAgo } from './panel';

const KIND_ICON = { global: '📜', memory: '🧠', project: '🏠', root: '📚' };

interface OpenFile {
  path: string;
  rel: string;
  section: string;
  content: string;
  mtime: number;
}

function splitFrontmatter(md: string): { meta: string | null; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { meta: m[1], body: md.slice(m[0].length) } : { meta: null, body: md };
}

/** Markdown vem de repositórios clonados: sempre sanitizado — a vila tem terminal. */
function renderMarkdown(md: string): string {
  const { meta, body } = splitFrontmatter(md);
  const html = DOMPurify.sanitize(marked.parse(body, { async: false }) as string);
  return (meta ? `<pre class="frontmatter">${escapeHtml(meta)}</pre>` : '') + html;
}

const isHtml = (path: string) => /\.html?$/i.test(path);

/**
 * HTML de repositório tem script: abre num iframe `sandbox` sem `allow-same-origin`, igual à estante, e nunca vai para o
 * DOM da vila. O `mtime` na URL faz o iframe recarregar depois de salvar.
 */
function renderHtml(file: { path: string; mtime: number }): string {
  const src = `/api/library/html?path=${encodeURIComponent(file.path)}&v=${file.mtime}`;
  return `<iframe class="quadro-frame reader-html" sandbox="allow-scripts" src="${escapeHtml(src)}"></iframe>`;
}

/** Arquivos gerados por script (ex.: o CLAUDE.md global vindo de IA/instalar.sh) não devem ser editados à mão. */
function generatedNotice(md: string): string | null {
  const head = md.slice(0, 800);
  if (!/(gerado|generated|n[ãa]o edit|do not edit|auto-?generated)/i.test(head)) return null;
  const line = head.split('\n').find((l) => /(gerado|generated|n[ãa]o edit|do not edit)/i.test(l)) ?? '';
  return line.replace(/^[>#\s*⚠️]+/, '').replace(/\*\*/g, '').trim();
}

function dirname(p: string) {
  return p.slice(0, p.lastIndexOf('/'));
}

/** Resolve "../x.md" relativo ao arquivo atual. */
function resolvePath(from: string, href: string) {
  const parts = (dirname(from) + '/' + href.split('#')[0]).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return '/' + out.join('/');
}

export async function openLibrary(opts: { sectionId?: string; search?: boolean; path?: string } = {}) {
  let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
  let current: OpenFile | null = null;
  let editing = false;

  const panel = openPanel({
    title: 'Biblioteca',
    subtitle: 'Instruções, memórias e documentação dos seus projetos',
    size: 'lg',
    onClose: () => editor?.dispose(),
  });
  panel.actions.append(button('✦ Perguntar à bibliotecária', () => ui.openLibrarian(), 'primary'));
  panel.body.innerHTML = `
    <div class="library-layout">
      <aside class="library-nav">
        <input class="library-search" type="search" placeholder="🔎 Buscar em todos os livros..." />
        <div class="library-tree"><p class="muted">Carregando estantes...</p></div>
        <div class="library-results" hidden></div>
      </aside>
      <section class="library-reader">
        <header class="reader-header">
          <div class="reader-title"><b>Escolha um livro</b></div>
          <div class="reader-actions"></div>
        </header>
        <div class="reader-body markdown"></div>
        <div class="reader-editor" hidden></div>
        <p class="reader-status"></p>
      </section>
    </div>`;

  const $ = <T extends Element>(sel: string) => panel.body.querySelector<T>(sel)!;
  const tree = $<HTMLElement>('.library-tree');
  const results = $<HTMLElement>('.library-results');
  const search = $<HTMLInputElement>('.library-search');
  const title = $<HTMLElement>('.reader-title');
  const actions = $<HTMLElement>('.reader-actions');
  const body = $<HTMLElement>('.reader-body');
  const editorHost = $<HTMLElement>('.reader-editor');
  const status = $<HTMLElement>('.reader-status');

  let sections: LibrarySection[] = [];
  const allFiles = () => sections.flatMap((s) => s.files.map((f) => ({ ...f, section: s.title })));

  // ---------------- leitura e edição ----------------

  function isDirty() {
    return editing && !!editor && !!current && editor.getValue() !== current.content;
  }

  function renderActions() {
    actions.replaceChildren();
    if (!current) return;
    if (editing) {
      actions.append(
        button('Salvar', save, 'primary'),
        button('Cancelar', () => {
          if (isDirty() && !confirm('Descartar as alterações?')) return;
          setEditing(false);
        }),
      );
    } else {
      actions.append(button('Editar', () => setEditing(true)), button('VS Code', () => library.openVsCode(current!.path)));
    }
  }

  async function setEditing(on: boolean) {
    editing = on;
    body.hidden = on;
    editorHost.hidden = !on;
    status.textContent = '';
    renderActions();
    if (!on || !current) {
      if (current) {
        const notice = generatedNotice(current.content);
        const html = isHtml(current.path);
        body.classList.toggle('markdown', !html);
        body.classList.toggle('reader-body-html', html);
        body.innerHTML =
          (notice ? `<div class="generated-warning">⚠️ Arquivo gerado — edições aqui podem ser sobrescritas.<br><small>${escapeHtml(notice)}</small></div>` : '') +
          (html ? renderHtml(current) : renderMarkdown(current.content));
      }
      return;
    }
    if (generatedNotice(current.content) && !confirm('Este arquivo é gerado por um script e pode ser sobrescrito. Editar mesmo assim?')) {
      editing = false;
      body.hidden = false;
      editorHost.hidden = true;
      renderActions();
      return;
    }
    const monaco = await loadMonaco();
    if (!editor) {
      editor = monaco.editor.create(editorHost, {
        theme: 'vs-dark',
        language: 'markdown',
        automaticLayout: true,
        wordWrap: 'on',
        minimap: { enabled: false },
        fontSize: 14,
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);
    }
    monaco.editor.setModelLanguage(editor.getModel()!, isHtml(current.path) ? 'html' : 'markdown');
    editor.setValue(current.content);
    editor.focus();
  }

  async function save() {
    if (!current || !editor) return;
    const content = editor.getValue();
    status.textContent = 'Salvando...';
    try {
      const { mtime } = await library.write(current.path, content, current.mtime);
      current = { ...current, content, mtime };
      status.textContent = `✔ Salvo ${new Date().toLocaleTimeString('pt-BR')}`;
      setEditing(false);
    } catch (err) {
      status.textContent = `✖ ${(err as Error).message}`;
    }
  }

  async function openFile(path: string, highlight?: string) {
    if (isDirty() && !confirm('Há alterações não salvas. Descartar?')) return;
    const meta = allFiles().find((f) => f.path === path);
    try {
      const file = await library.read(path);
      current = { ...file, rel: meta?.rel ?? path, section: meta?.section ?? '' };
    } catch (err) {
      status.textContent = `✖ ${(err as Error).message}`;
      return;
    }
    tree.querySelectorAll('.book.active').forEach((el) => el.classList.remove('active'));
    tree.querySelector(`.book[data-path="${CSS.escape(path)}"]`)?.classList.add('active');
    title.innerHTML = `<b>${escapeHtml(current.rel)}</b><span class="muted"> · ${escapeHtml(current.section)} · editado ${timeAgo(current.mtime)}</span>`;
    await setEditing(false);
    body.scrollTop = 0;
    if (highlight) {
      const q = highlight.toLowerCase();
      const hit = [...body.querySelectorAll('p, li, h1, h2, h3, h4, td, pre, code')].find((el) => el.textContent?.toLowerCase().includes(q));
      hit?.classList.add('search-hit');
      hit?.scrollIntoView({ block: 'center' });
    }
  }

  // Links entre documentos abrem dentro da própria biblioteca.
  body.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || !current) return;
    const href = a.getAttribute('href') ?? '';
    e.preventDefault();
    if (/^https?:/i.test(href)) return void window.open(href, '_blank', 'noopener');
    if (href.startsWith('#')) return void body.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)?.scrollIntoView();
    const target = resolvePath(current.path, href);
    if (allFiles().some((f) => f.path === target)) void openFile(target);
    else status.textContent = `Link fora da biblioteca: ${href}`;
  });

  // ---------------- estantes ----------------

  function folderTree(files: LibraryFile[]) {
    interface Node {
      dirs: Map<string, Node>;
      files: LibraryFile[];
    }
    const root: Node = { dirs: new Map(), files: [] };
    for (const f of files) {
      const parts = f.rel.split('/');
      let node = root;
      for (const dir of parts.slice(0, -1)) {
        if (!node.dirs.has(dir)) node.dirs.set(dir, { dirs: new Map(), files: [] });
        node = node.dirs.get(dir)!;
      }
      node.files.push(f);
    }
    const render = (node: Node): string =>
      [...node.dirs.entries()]
        .map(([name, child]) => `<details class="folder"><summary>📁 ${escapeHtml(name)}</summary>${render(child)}</details>`)
        .join('') +
      node.files
        .map((f) => `<button class="book" data-path="${escapeHtml(f.path)}" title="${escapeHtml(f.rel)}">${isHtml(f.path) ? '🌐' : '📖'} ${escapeHtml(f.rel.split('/').pop()!)}</button>`)
        .join('');
    return render(root);
  }

  function renderTree() {
    tree.innerHTML = sections
      .map(
        (s) => `
        <details class="shelf" data-id="${escapeHtml(s.id)}">
          <summary>${KIND_ICON[s.kind]} ${escapeHtml(s.title)} <span class="muted">(${s.files.length})</span></summary>
          ${s.missingClaudeMd ? `<button class="create-claude" data-project="${escapeHtml(s.projectId!)}">✚ Criar CLAUDE.md</button>` : ''}
          ${s.files.length ? folderTree(s.files) : '<p class="muted empty-shelf">Estante vazia</p>'}
        </details>`,
      )
      .join('');
  }

  tree.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const book = el.closest<HTMLElement>('.book');
    if (book) return void openFile(book.dataset.path!);
    const create = el.closest<HTMLElement>('.create-claude');
    if (create) {
      try {
        const { path } = await library.createClaudeMd(create.dataset.project!);
        await reload();
        tree.querySelector<HTMLDetailsElement>(`.shelf[data-id="project:${CSS.escape(create.dataset.project!)}"]`)!.open = true;
        await openFile(path);
        void setEditing(true);
      } catch (err) {
        status.textContent = `✖ ${(err as Error).message}`;
      }
    }
  });

  async function reload() {
    sections = await library.sections();
    renderTree();
  }

  // ---------------- busca ----------------

  let searchTimer: number | undefined;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = search.value.trim();
    if (q.length < 2) {
      results.hidden = true;
      tree.hidden = false;
      return;
    }
    searchTimer = window.setTimeout(async () => {
      const hits = await library.search(q);
      tree.hidden = true;
      results.hidden = false;
      results.innerHTML = hits.length
        ? hits
            .map(
              (h) => `
            <button class="hit" data-path="${escapeHtml(h.path)}">
              <b>${escapeHtml(h.rel)}</b> <span class="muted">${escapeHtml(h.section)}${h.line ? ` · linha ${h.line}` : ''}</span>
              ${h.text ? `<span class="hit-text">${escapeHtml(h.text)}</span>` : ''}
            </button>`,
            )
            .join('')
        : '<p class="muted">Nenhum livro fala disso.</p>';
    }, 300);
  });
  results.addEventListener('click', (e) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('.hit');
    if (hit) void openFile(hit.dataset.path!, search.value.trim());
  });

  // ---------------- início ----------------

  await reload();
  if (opts.search) search.focus();
  const start =
    sections.find((s) => opts.path && s.files.some((f) => f.path === opts.path)) ??
    sections.find((s) => s.id === opts.sectionId) ??
    sections.find((s) => s.kind === 'global');
  if (start) {
    const shelf = tree.querySelector<HTMLDetailsElement>(`.shelf[data-id="${CSS.escape(start.id)}"]`)!;
    shelf.open = true;
    const target = (opts.path && start.files.find((f) => f.path === opts.path)) || start.files[0];
    if (target) {
      // abre as pastas até o livro escolhido
      let folder = tree.querySelector(`.book[data-path="${CSS.escape(target.path)}"]`)?.parentElement?.closest('details');
      while (folder) {
        folder.open = true;
        folder = folder.parentElement?.closest('details');
      }
      await openFile(target.path);
    }
  }
}
