import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { library } from '../api';
import { ui } from './actions';
import { button, escapeHtml, openPanel } from './panel';

interface Exchange {
  question: string;
  answer: string;
  steps: string[];
  error?: boolean;
  meta?: string;
}

/** A conversa fica guardada enquanto a vila está aberta — fechar o painel não apaga. */
const conversation: Exchange[] = [];
let pending: AbortController | null = null;

async function ask(question: string, onUpdate: () => void) {
  const exchange: Exchange = { question, answer: '', steps: [] };
  conversation.push(exchange);
  onUpdate();
  pending = new AbortController();
  try {
    const res = await fetch('/api/librarian/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        history: conversation.slice(0, -1).filter((e) => !e.error).map(({ question, answer }) => ({ question, answer })),
      }),
      signal: pending.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const event = JSON.parse(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (event.type === 'step') exchange.steps.push(event.text);
        if (event.type === 'answer') {
          exchange.answer = event.text;
          if (event.durationMs) exchange.meta = `respondido em ${Math.round(event.durationMs / 1000)}s`;
        }
        if (event.type === 'error') {
          exchange.answer = event.text;
          exchange.error = true;
        }
        onUpdate();
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      exchange.answer = `Não consegui falar com a bibliotecária: ${(err as Error).message}`;
      exchange.error = true;
    }
  } finally {
    pending = null;
    onUpdate();
  }
}

/** Caminhos de arquivo na resposta viram links que abrem o livro na biblioteca. */
async function linkifyPaths(container: HTMLElement) {
  const files = new Set((await library.sections()).flatMap((s) => s.files.map((f) => f.path)));
  for (const code of container.querySelectorAll('code')) {
    const m = code.textContent?.match(/^(\/[^\s:]+\.mdx?)(?::(\d+))?/);
    if (!m || !files.has(m[1])) continue;
    code.classList.add('book-link');
    code.title = 'Abrir na biblioteca';
    code.addEventListener('click', () => ui.openLibrary({ path: m[1] }));
  }
}

export function openLibrarian() {
  const panel = openPanel({
    title: '✦ Bibliotecária',
    subtitle: 'Agente permanente: consulta o catálogo de toda a biblioteca a cada pergunta',
    size: 'lg',
  });
  panel.actions.append(
    button('Nova conversa', () => {
      pending?.abort();
      conversation.length = 0;
      render();
    }),
  );
  panel.body.innerHTML = `
    <div class="librarian">
      <div class="librarian-log"></div>
      <form class="librarian-form">
        <input type="text" placeholder="Pergunte onde está algo documentado… ex.: como funciona o multi-tenant no erp_b2b?" />
        <button class="btn btn-primary" type="submit">Perguntar</button>
      </form>
    </div>`;
  const log = panel.body.querySelector<HTMLElement>('.librarian-log')!;
  const form = panel.body.querySelector('form')!;
  const input = form.querySelector('input')!;
  const submit = form.querySelector('button')!;

  function render() {
    if (!log.isConnected) return;
    if (!conversation.length) {
      log.innerHTML = `
        <div class="librarian-hello">
          <p><b>Olá!</b> Eu sei onde está cada documento da biblioteca: instruções globais, memórias, docs dos projetos e o acervo IA.</p>
          <p class="muted">Cada pergunta é uma consulta nova ao catálogo (que se atualiza sozinho), então eu nunca fico "cheia". As sessões do Claude também podem me chamar sozinhas quando precisarem de algo documentado.</p>
        </div>`;
    } else {
      log.innerHTML = conversation
        .map(
          (e) => `
          <div class="msg msg-user">${escapeHtml(e.question)}</div>
          <div class="msg msg-librarian ${e.error ? 'msg-error' : ''}">
            ${e.steps.length ? `<div class="librarian-steps">${e.steps.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}</div>` : ''}
            ${e.answer ? `<div class="markdown">${DOMPurify.sanitize(marked.parse(e.answer, { async: false }) as string)}</div>` : '<div class="muted">Procurando nas estantes…</div>'}
            ${e.meta ? `<div class="librarian-meta">${escapeHtml(e.meta)}</div>` : ''}
          </div>`,
        )
        .join('');
      void linkifyPaths(log);
    }
    log.scrollTop = log.scrollHeight;
    submit.disabled = !!pending;
    input.disabled = !!pending;
    if (!pending) input.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || pending) return;
    input.value = '';
    void ask(question, render);
  });
  render();
}
