import { getWorld, onWorld, skills, type SkillFile, type SkillInput, type SkillSummary } from '../api';
import { button, escapeHtml, openPanel } from './panel';

const where = (projectId: string | null) =>
  projectId === null ? 'Globais (~/.claude/skills)' : (getWorld().projects.find((p) => p.id === projectId)?.name ?? projectId);

/**
 * Parede de ferramentas da Fábrica: as skills globais e de cada projeto (pasta com `SKILL.md`). Cria, edita o
 * `SKILL.md` e apaga a pasta inteira. Mesmo layout do painel de agentes. Skill instalada por link é só leitura.
 */
export async function openSkills(path?: string) {
  let selected = path;
  let skillsKey = '';
  const unsubscribe = onWorld((w) => {
    if (JSON.stringify(w.skills) !== skillsKey) drawList(selected);
  });
  const panel = openPanel({
    title: 'Parede de ferramentas',
    subtitle: 'Skills do Claude Code: globais e de cada projeto',
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
          <div class="reader-title"><b>Escolha uma skill ou crie uma nova</b></div>
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
  panel.body.querySelector('.factory-new')!.append(button('+ Nova skill', () => edit(null), 'primary'));

  const say = (text: string, isError = false) => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };

  function drawList(current?: string) {
    selected = current;
    skillsKey = JSON.stringify(getWorld().skills);
    const groups = new Map<string | null, SkillSummary[]>();
    for (const s of getWorld().skills) groups.set(s.projectId, [...(groups.get(s.projectId) ?? []), s]);
    if (!groups.size) {
      tree.innerHTML = '<p class="empty">Nenhuma skill ainda.</p>';
      return;
    }
    tree.innerHTML = [...groups]
      .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : where(a).localeCompare(where(b))))
      .map(
        ([projectId, list]) => `
          <details class="shelf" open>
            <summary>${escapeHtml(where(projectId))}</summary>
            ${list
              .map(
                (s) =>
                  `<button class="book${s.path === current ? ' active' : ''}" data-path="${escapeHtml(s.path)}" title="${escapeHtml(s.description)}">🔧 ${escapeHtml(s.name)}${s.linkedTo ? ' <span class="muted">(link)</span>' : ''}</button>`,
              )
              .join('')}
          </details>`,
      )
      .join('');
    for (const b of tree.querySelectorAll<HTMLButtonElement>('.book')) b.addEventListener('click', () => void open(b.dataset.path!));
  }

  async function open(skillPath: string) {
    say('');
    try {
      edit(await skills.read(skillPath));
    } catch (err) {
      say(String((err as Error).message ?? err), true);
    }
  }

  /** Formulário de uma skill; `skill` null = nova. */
  function edit(skill: SkillFile | null) {
    drawList(skill?.path);
    say('');
    const locked = !!skill?.linkedTo;
    title.innerHTML = skill
      ? `<b>🔧 ${escapeHtml(skill.name)}</b> <span class="muted">· ${escapeHtml(where(skill.projectId))}</span>`
      : '<b>Nova skill</b>';
    form.innerHTML = `
      ${locked ? `<p class="agent-note">Skill instalada por link: só leitura aqui. A fonte fica em <code>${escapeHtml(skill!.linkedTo!)}</code>; edite lá.</p>` : ''}
      ${
        skill
          ? ''
          : `<label class="field"><span>Nome</span>
               <input name="name" placeholder="revisar-migration" autocomplete="off" />
               <small class="muted">Letras minúsculas, números e hífen. É o nome da pasta e do comando (<code>/nome</code>) e não muda depois.</small></label>
             <label class="field"><span>Onde</span>
               <select name="where">
                 <option value="">Global (vale em todos os projetos)</option>
                 ${getWorld()
                   .projects.map((p) => `<option value="${escapeHtml(p.id)}">Só no projeto ${escapeHtml(p.name)}</option>`)
                   .join('')}
               </select></label>`
      }
      <label class="field"><span>Descrição</span>
        <textarea name="description" rows="3" placeholder="O que a skill faz e quando usar. O Claude decide carregá-la lendo esta descrição.">${escapeHtml(skill?.description ?? '')}</textarea></label>
      <label class="field field-grow"><span>Instruções (SKILL.md)</span>
        <textarea name="instructions" rows="14" placeholder="# Nome da skill&#10;&#10;Passos…">${escapeHtml(skill?.instructions ?? '')}</textarea></label>
      ${skill && skill.files.length > 1 ? `<p class="muted">Outros arquivos da pasta (não editados aqui): ${skill.files.filter((f) => f !== 'SKILL.md').map((f) => `<code>${escapeHtml(f)}</code>`).join(', ')}</p>` : ''}`;
    if (locked) for (const el of form.querySelectorAll<HTMLInputElement>('input, textarea, select')) el.disabled = true;

    actions.replaceChildren();
    if (locked) return;
    actions.append(button(skill ? 'Salvar' : 'Criar skill', () => void submit(skill), 'primary'));
    if (skill) actions.append(button('Apagar', () => confirmDelete(skill), 'danger'));
  }

  function readForm(): SkillInput {
    const value = (n: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${n}"]`)?.value ?? '';
    return { description: value('description').trim(), instructions: value('instructions') };
  }

  async function submit(skill: SkillFile | null) {
    const input = readForm();
    if (!input.description) return say('Preencha a descrição: é por ela que o Claude decide carregar a skill.', true);
    try {
      if (skill) {
        const { mtime } = await skills.save(skill.path, skill.mtime, input);
        skill.mtime = mtime;
        Object.assign(skill, input);
        say('Salvo. Vale para sessões novas.');
      } else {
        const name = (form.querySelector<HTMLInputElement>('[name="name"]')?.value ?? '').trim();
        const projectId = form.querySelector<HTMLSelectElement>('[name="where"]')?.value || null;
        const { path: created } = await skills.create(projectId, name, input);
        await open(created);
        say(`Skill ${name} criada. Vale para sessões novas.`);
      }
    } catch (err) {
      say(String((err as Error).message ?? err), true);
    }
  }

  /** Apagar remove a pasta inteira (decisão do usuário): a confirmação lista tudo o que vai junto. */
  function confirmDelete(skill: SkillFile) {
    actions.replaceChildren();
    const folder = skill.path.replace(/\/SKILL\.md$/, '');
    const q = document.createElement('span');
    q.className = 'agent-confirm';
    q.innerHTML = `Apagar a pasta <code>${escapeHtml(folder)}</code> com ${skill.files.length} arquivo(s): ${skill.files.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ')}?`;
    actions.append(
      q,
      button(
        'Sim, apagar',
        async () => {
          try {
            await skills.remove(skill.path);
            say(`Skill ${skill.name} apagada.`);
            title.innerHTML = '<b>Escolha uma skill ou crie uma nova</b>';
            form.replaceChildren();
            actions.replaceChildren();
            selected = undefined;
          } catch (err) {
            say(String((err as Error).message ?? err), true);
          }
        },
        'danger',
      ),
      button('Cancelar', () => edit(skill)),
    );
  }

  drawList(path);
  if (path) await open(path);
}
