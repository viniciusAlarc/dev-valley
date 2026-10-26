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

/** Um agente permanente com quem se conversa por painel (bibliotecária, administrador da praça). */
interface ChatAgent {
  endpoint: string;
  title: string;
  subtitle: string;
  placeholder: string;
  hello: string;
  working: string;
  /** Nome na mensagem de erro de conexão ("a bibliotecária"). */
  who: string;
  /** A conversa fica guardada enquanto a vila está aberta — fechar o painel não apaga. */
  conversation: Exchange[];
  pending: AbortController | null;
}

const LIBRARIAN: ChatAgent = {
  endpoint: '/api/librarian/ask',
  title: '✦ Bibliotecária',
  subtitle: 'Agente permanente: consulta o catálogo de toda a biblioteca a cada pergunta',
  placeholder: 'Pergunte onde está algo documentado… ex.: onde está a regra de commit?',
  hello: `
    <p><b>Olá!</b> Eu sei onde está cada documento da biblioteca: instruções globais, memórias, docs dos projetos e o acervo IA.</p>
    <p class="muted">Cada pergunta é uma consulta nova ao catálogo (que se atualiza sozinho), então eu nunca fico "cheia". As sessões do Claude também podem me chamar sozinhas quando precisarem de algo documentado.</p>`,
  working: 'Procurando nas estantes…',
  who: 'a bibliotecária',
  conversation: [],
  pending: null,
};

const ADMINISTRADOR: ChatAgent = {
  endpoint: '/api/administrador/ask',
  title: '✦ Administrador da praça',
  subtitle: 'Agente permanente: explica o sino e o quadro de avisos, e registra o que você conferiu',
  placeholder: 'ex.: o que é para conferir na horta? · conferi o sino, está ok',
  hello: `
    <p><b>Olá!</b> Eu cuido do sino de conferência e do quadro de avisos da praça.</p>
    <p>Pergunte o que um item quer dizer e o que conferir. Quando tiver conferido, me avise: eu registro nos arquivos do
    projeto como a sessão faria (<code>PROGRESS.md</code>, plano em <code>a-codar/</code>, <code>PENDENCIAS.md</code>).</p>
    <p class="muted">Só edito esses arquivos de acompanhamento; código e o resto são das sessões. Se você relatar um problema, não marco nada.</p>`,
  working: 'Olhando os arquivos…',
  who: 'o administrador',
  conversation: [],
  pending: null,
};

async function ask(agent: ChatAgent, question: string, onUpdate: () => void) {
  const { conversation } = agent;
  const exchange: Exchange = { question, answer: '', steps: [] };
  conversation.push(exchange);
  onUpdate();
  const pending = (agent.pending = new AbortController());
  try {
    const res = await fetch(agent.endpoint, {
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
      exchange.answer = `Não consegui falar com ${agent.who}: ${(err as Error).message}`;
      exchange.error = true;
    }
  } finally {
    agent.pending = null;
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
  openChat(LIBRARIAN);
}

export function openAdministrador() {
  openChat(ADMINISTRADOR);
}

function openChat(agent: ChatAgent) {
  const { conversation } = agent;
  const panel = openPanel({ title: agent.title, subtitle: agent.subtitle, size: 'lg' });
  panel.actions.append(
    button('Nova conversa', () => {
      agent.pending?.abort();
      conversation.length = 0;
      render();
    }),
  );
  panel.body.innerHTML = `
    <div class="librarian">
      <div class="librarian-log"></div>
      <form class="librarian-form">
        <input type="text" placeholder="${escapeHtml(agent.placeholder)}" />
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
      log.innerHTML = `<div class="librarian-hello">${agent.hello}</div>`;
    } else {
      log.innerHTML = conversation
        .map(
          (e) => `
          <div class="msg msg-user">${escapeHtml(e.question)}</div>
          <div class="msg msg-librarian ${e.error ? 'msg-error' : ''}">
            ${e.steps.length ? `<div class="librarian-steps">${e.steps.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}</div>` : ''}
            ${e.answer ? `<div class="markdown">${DOMPurify.sanitize(marked.parse(e.answer, { async: false }) as string)}</div>` : `<div class="muted">${agent.working}</div>`}
            ${e.meta ? `<div class="librarian-meta">${escapeHtml(e.meta)}</div>` : ''}
          </div>`,
        )
        .join('');
      void linkifyPaths(log);
    }
    log.scrollTop = log.scrollHeight;
    submit.disabled = !!agent.pending;
    input.disabled = !!agent.pending;
    if (!agent.pending) input.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || agent.pending) return;
    input.value = '';
    void ask(agent, question, render);
  });
  render();
}
