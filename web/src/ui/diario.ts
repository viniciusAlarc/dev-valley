import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { api, type ProgressEntry, type Project } from '../api';
import { button, escapeHtml, openPanel } from './panel';

/**
 * Diário do atril: o `PROGRESS.md` do projeto, uma entrega por página, a mais recente primeiro. Só leitura.
 * Sumário na lateral (entregas agrupadas por data) para pular direto para qualquer página; mesmo layout da biblioteca.
 */
export async function openDiary(project: Project) {
  const panel = openPanel({ title: `Diário — ${project.name}`, subtitle: 'PROGRESS.md', size: 'lg' });
  panel.body.innerHTML = '<p class="muted">Abrindo o diário…</p>';
  let entries: ProgressEntry[];
  try {
    entries = await api.progress(project.id);
  } catch (err) {
    panel.body.innerHTML = `<p class="empty">Não foi possível ler o diário: ${escapeHtml(String(err))}</p>`;
    return;
  }
  if (!entries.length) {
    panel.body.innerHTML = '<p class="empty">Nenhuma entrega registrada ainda.</p>';
    return;
  }

  const byDate = new Map<string, number[]>();
  entries.forEach((e, i) => byDate.set(e.date, [...(byDate.get(e.date) ?? []), i]));
  const index = [...byDate]
    .map(
      ([date, pages]) => `
        <details class="shelf" open>
          <summary>${escapeHtml(date || 'Sem data')} <span class="muted">(${pages.length})</span></summary>
          ${pages.map((i) => `<button class="book" data-page="${i}" title="${escapeHtml(entries[i].title)}">${escapeHtml(entries[i].title)}</button>`).join('')}
        </details>`,
    )
    .join('');

  panel.body.innerHTML = `
    <div class="library-layout">
      <aside class="library-nav">
        <div class="library-tree">${index}</div>
      </aside>
      <section class="library-reader">
        <header class="reader-header">
          <div class="reader-title"></div>
          <div class="reader-actions"></div>
        </header>
        <div class="reader-body markdown"></div>
      </section>
    </div>`;
  const title = panel.body.querySelector<HTMLElement>('.reader-title')!;
  const body = panel.body.querySelector<HTMLElement>('.reader-body')!;
  const books = [...panel.body.querySelectorAll<HTMLButtonElement>('.book')];
  for (const b of books) b.addEventListener('click', () => show(Number(b.dataset.page)));

  let page = 0;
  const newer = button('← Mais recente', () => show(page - 1));
  const older = button('Mais antiga →', () => show(page + 1));
  const counter = document.createElement('span');
  counter.className = 'muted';
  panel.body.querySelector('.reader-actions')!.append(newer, counter, older);

  function show(i: number) {
    page = Math.max(0, Math.min(entries.length - 1, i));
    const e = entries[page];
    newer.disabled = page === 0;
    older.disabled = page === entries.length - 1;
    counter.textContent = `${page + 1} de ${entries.length}`;
    title.innerHTML = `<b>${escapeHtml(e.date ? `${e.date} — ${e.title}` : e.title)}</b>`;
    // Markdown vem de repositórios: sempre sanitizado, a vila tem terminal.
    body.innerHTML = DOMPurify.sanitize(marked.parse(e.body, { async: false }) as string);
    body.scrollTop = 0;
    for (const b of books) b.classList.toggle('active', Number(b.dataset.page) === page);
    books.find((b) => Number(b.dataset.page) === page)?.scrollIntoView({ block: 'nearest' });
  }
  show(0);
}
