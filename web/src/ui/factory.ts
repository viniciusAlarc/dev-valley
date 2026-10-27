import { agents, getWorld, onWorld, type AgentFile, type AgentInput, type AgentSummary } from '../api';
import { button, escapeHtml, openPanel } from './panel';

/** Ferramentas que o formulário oferece em caixas; outras que o agente já tenha (ex.: MCP) aparecem junto, marcadas. */
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite', 'Agent'];
const MODELS: [string, string][] = [
  ['', 'O mesmo da sessão'],
  ['sonnet', 'Sonnet'],
  ['opus', 'Opus'],
  ['haiku', 'Haiku'],
];

/** Grupo da lista: os agentes da vila têm o seu, sempre por último. */
const VILLAGE = '__vila';
const where = (projectId: string | null) =>
  projectId === VILLAGE
    ? 'Agentes da vila (só leitura)'
    : projectId === null
      ? 'Globais (~/.claude/agents)'
      : (getWorld().projects.find((p) => p.id === projectId)?.name ?? projectId);
const groupOf = (a: AgentSummary) => (a.village ? VILLAGE : a.projectId);

/**
 * Fábrica de agentes (PD-4): lista os agentes globais e de cada projeto e cria, edita ou apaga pelo formulário.
 * Mesmo layout da biblioteca. Agente do Dev Valley (a bibliotecária) é só leitura.
 */
export async function openFactory(path?: string) {
  let selected = path;
  let agentsKey = '';
  // A lista acompanha o mundo: criar, apagar (aqui ou fora da vila) redesenha sozinho.
  const unsubscribe = onWorld((w) => {
    const key = JSON.stringify(w.agents);
    if (key !== agentsKey) drawList(selected);
  });
  const panel = openPanel({
    title: 'Fábrica de agentes',
    subtitle: 'Agentes do Claude Code: globais e de cada projeto',
    size: 'lg',
    onClose: unsubscribe,
  });
  panel.body.innerHTML = `
    <div class="library-layout">
      <aside class="library-nav">
        <div class="button-row factory-new"></div>
        <div class="library-tree"></div>
      </aside>
      <section class="library-reader">
        <header class="reader-header">
          <div class="reader-title"><b>Escolha um agente ou crie um novo</b></div>
          <div class="reader-actions"></div>
        </header>
        <div class="reader-body agent-form"></div>
        <p class="reader-status"></p>
      </section>
    </div>`;
  const tree = panel.body.querySelector<HTMLElement>('.library-tree')!;
  const title = panel.body.querySelector<HTMLElement>('.reader-title')!;
  const actions = panel.body.querySelector<HTMLElement>('.reader-actions')!;
  const form = panel.body.querySelector<HTMLElement>('.agent-form')!;
  const status = panel.body.querySelector<HTMLElement>('.reader-status')!;
  panel.body.querySelector('.factory-new')!.append(button('+ Novo agente', () => edit(null), 'primary'));

  const say = (text: string, isError = false) => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };

  function drawList(current?: string) {
    selected = current;
    agentsKey = JSON.stringify(getWorld().agents);
    const groups = new Map<string | null, AgentSummary[]>();
    for (const a of getWorld().agents) groups.set(groupOf(a), [...(groups.get(groupOf(a)) ?? []), a]);
    if (!groups.size) {
      tree.innerHTML = '<p class="empty">Nenhum agente ainda.</p>';
      return;
    }
    tree.innerHTML = [...groups]
      .sort(([a], [b]) => (a === b ? 0 : a === null || b === VILLAGE ? -1 : b === null || a === VILLAGE ? 1 : where(a).localeCompare(where(b))))
      .map(
        ([projectId, list]) => `
          <details class="shelf" open>
            <summary>${escapeHtml(where(projectId))}</summary>
            ${list
              .map(
                (a) =>
                  `<button class="book${a.path === current ? ' active' : ''}" data-path="${escapeHtml(a.path)}" title="${escapeHtml(a.description)}">✦ ${escapeHtml(a.name)}${a.managed && !a.village ? ' <span class="muted">(Dev Valley)</span>' : ''}</button>`,
              )
              .join('')}
          </details>`,
      )
      .join('');
    for (const b of tree.querySelectorAll<HTMLButtonElement>('.book')) b.addEventListener('click', () => void open(b.dataset.path!));
  }

  async function open(agentPath: string) {
    say('');
    try {
      edit(await agents.read(agentPath));
    } catch (err) {
      say(String((err as Error).message ?? err), true);
    }
  }

  /** Formulário de um agente; `agent` null = novo. */
  function edit(agent: AgentFile | null) {
    drawList(agent?.path);
    say('');
    const locked = !!agent?.managed;
    const tools = [...TOOLS, ...(agent?.tools ?? []).filter((t) => !TOOLS.includes(t))];
    const models = agent?.model && !MODELS.some(([v]) => v === agent.model) ? [...MODELS, [agent.model, agent.model] as [string, string]] : MODELS;
    title.innerHTML = agent
      ? `<b>✦ ${escapeHtml(agent.name)}</b> <span class="muted">· ${escapeHtml(where(groupOf(agent)))}</span>`
      : '<b>Novo agente</b>';
    form.innerHTML = `
      ${
        agent?.village
          ? '<p class="agent-note">Agente da vila: só leitura. O original fica em <code>server/agents/</code> no repo, e ele roda pela vila, com as permissões dela; converse com ele no lugar dele (a bibliotecária no balcão da biblioteca, o administrador na praça).</p>'
          : locked
            ? '<p class="agent-note">Agente do Dev Valley: só leitura aqui. O original fica em <code>server/agents/</code> no repo e o <code>npm run hooks:install</code> instala de novo.</p>'
            : ''
      }
      ${
        agent
          ? ''
          : `<label class="field"><span>Nome</span>
               <input name="name" placeholder="revisor-de-codigo" autocomplete="off" />
               <small class="muted">Letras minúsculas, números e hífen. É o nome do arquivo e não muda depois.</small></label>
             <label class="field"><span>Onde</span>
               <select name="where">
                 <option value="">Global (vale em todos os projetos)</option>
                 ${getWorld()
                   .projects.map((p) => `<option value="${escapeHtml(p.id)}">Só no projeto ${escapeHtml(p.name)}</option>`)
                   .join('')}
               </select></label>`
      }
      <label class="field"><span>Descrição</span>
        <textarea name="description" rows="3" placeholder="Quando usar este agente. O Claude decide chamá-lo lendo esta descrição.">${escapeHtml(agent?.description ?? '')}</textarea></label>
      <fieldset class="field"><legend>Ferramentas</legend>
        <div class="tool-grid">
          ${tools
            .map((t) => `<label><input type="checkbox" name="tool" value="${escapeHtml(t)}"${agent?.tools?.includes(t) ? ' checked' : ''} /> ${escapeHtml(t)}</label>`)
            .join('')}
        </div>
        <small class="muted">Nenhuma marcada = o agente usa todas as ferramentas da sessão.</small></fieldset>
      <label class="field"><span>Modelo</span>
        <select name="model">${models.map(([v, l]) => `<option value="${escapeHtml(v)}"${(agent?.model ?? '') === v ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('')}</select></label>
      <label class="field field-grow"><span>Instruções</span>
        <textarea name="instructions" rows="14" placeholder="Você é…">${escapeHtml(agent?.instructions ?? '')}</textarea></label>`;
    if (locked) for (const el of form.querySelectorAll<HTMLInputElement>('input, textarea, select')) el.disabled = true;

    actions.replaceChildren();
    if (locked) return;
    actions.append(button(agent ? 'Salvar' : 'Criar agente', () => void submit(agent), 'primary'));
    if (agent) actions.append(button('Apagar', () => confirmDelete(agent), 'danger'));
  }

  function readForm(): AgentInput {
    const value = (n: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${n}"]`)?.value ?? '';
    const tools = [...form.querySelectorAll<HTMLInputElement>('input[name="tool"]:checked')].map((i) => i.value);
    return { description: value('description').trim(), tools: tools.length ? tools : null, model: value('model') || null, instructions: value('instructions') };
  }

  async function submit(agent: AgentFile | null) {
    const input = readForm();
    if (!input.description) return say('Preencha a descrição: é por ela que o Claude decide chamar o agente.', true);
    try {
      if (agent) {
        const { mtime } = await agents.save(agent.path, agent.mtime, input);
        agent.mtime = mtime;
        Object.assign(agent, input);
        say('Salvo. Vale para sessões novas.');
      } else {
        const name = (form.querySelector<HTMLInputElement>('[name="name"]')?.value ?? '').trim();
        const projectId = form.querySelector<HTMLSelectElement>('[name="where"]')?.value || null;
        const { path: created } = await agents.create(projectId, name, input);
        await open(created);
        say(`Agente ${name} criado. Vale para sessões novas.`);
      }
    } catch (err) {
      say(String((err as Error).message ?? err), true);
    }
  }

  function confirmDelete(agent: AgentFile) {
    actions.replaceChildren();
    const q = document.createElement('span');
    q.className = 'agent-confirm';
    q.innerHTML = `Apagar <code>${escapeHtml(agent.path)}</code>?`;
    actions.append(
      q,
      button(
        'Sim, apagar',
        async () => {
          try {
            await agents.remove(agent.path);
            say(`Agente ${agent.name} apagado.`);
            title.innerHTML = '<b>Escolha um agente ou crie um novo</b>';
            form.replaceChildren();
            actions.replaceChildren();
            selected = undefined;
          } catch (err) {
            say(String((err as Error).message ?? err), true);
          }
        },
        'danger',
      ),
      button('Cancelar', () => edit(agent)),
    );
  }

  drawList(path);
  if (path) await open(path);
}
