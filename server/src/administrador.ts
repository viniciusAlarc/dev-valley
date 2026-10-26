import path from 'node:path';
import { askAgent, type AgentEvent, type Exchange } from './consulta.js';
import type { Project } from './world.js';

/**
 * Administrador da praça (decisão do usuário em 26/10/2026): mesma base da bibliotecária (`consulta.ts`), mas pode
 * editar os arquivos de acompanhamento dos projetos da vila para registrar a conferência — e só eles.
 */

/** Os únicos arquivos que o administrador edita, por projeto (regra de permissão do Claude Code; `//` = absoluto). */
const EDITABLE = ['PROGRESS.md', 'PENDENCIAS.md', 'docs-dev/painel.json', 'docs-dev/a-codar/**'];

function stepFor(tool: string, input: any): string {
  const where = (p: unknown) => (typeof p === 'string' ? `${path.basename(path.dirname(p))}/${path.basename(p)}` : '');
  if (tool === 'Read') return `📖 Lendo ${where(input?.file_path)}`;
  if (tool === 'Edit') return `✏️ Registrando em ${where(input?.file_path)}`;
  if (tool === 'Grep') return `🔎 Procurando "${String(input?.pattern ?? '').slice(0, 40)}"`;
  if (tool === 'Glob') return `🗂️ Olhando ${String(input?.pattern ?? '').slice(0, 40)}`;
  return `🔧 ${tool}`;
}

/** O que está no sino e no quadro agora, com o caminho de cada projeto. */
function preamble(projects: Project[]) {
  const today = new Date();
  const date = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const blocks = projects
    .map((p) => {
      const toCheck = p.progress?.toCheck ?? [];
      const decisions = (p.pendencias ?? []).filter((d) => d.owner === 'user');
      if (!toCheck.length && !decisions.length) return '';
      return [
        `### ${p.name} — ${p.path}`,
        ...toCheck.map((e) => `- Sino (a conferir): ${e.date} — ${e.title}`),
        ...decisions.map((d) => `- Quadro (decisão 👤, P${d.priority}): ${d.id} — ${d.item}`),
      ].join('\n');
    })
    .filter(Boolean);
  return [
    `Hoje é ${date}.`,
    blocks.length ? `## Na praça agora\n\n${blocks.join('\n\n')}` : '## Na praça agora\n\nNada no sino nem no quadro de avisos.',
  ].join('\n\n');
}

export function askAdministrador(
  question: string,
  history: Exchange[],
  projects: Project[],
  onEvent: (e: AgentEvent) => void,
  hooksToIgnore: Set<string>,
): () => void {
  const allow = projects.flatMap((p) => EDITABLE.map((f) => `Edit(/${path.join(p.path, f)})`));
  return askAgent(
    { name: 'administrador', who: 'O administrador', preamble: preamble(projects), allow, stepFor },
    question,
    history,
    onEvent,
    hooksToIgnore,
  );
}
