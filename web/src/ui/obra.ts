import type { Project } from '../api';
import { escapeHtml, openPanel } from './panel';

/** O que cada peça da estrutura é, e quem a cria (skill `/novo-projeto` ou `instalar-projeto.sh`). */
const PIECES: Record<string, { what: string; by: 'skill' | 'script' }> = {
  'CLAUDE.md': { what: 'Instruções do projeto: stack, comandos e regras que só valem aqui', by: 'skill' },
  'PENDENCIAS.md': { what: 'Rastreador único do que está aberto, com dono (G6)', by: 'skill' },
  'PROGRESS.md': { what: 'Memória do que foi feito e quando, atualizada a cada entrega (G5)', by: 'skill' },
  'docs-dev/painel.json': { what: 'Plano em andamento e fases: vira a horta da casa (G14)', by: 'skill' },
  'scripts/auditar-referencias.py': { what: 'Auditor de referência morta no que instrui (G12/G16)', by: 'script' },
};

/** Casa em obra: o que falta da estrutura de acompanhamento e como resolver. Só leitura (decisão de 26/10/2026). */
export function openObra(project: Project) {
  const missing = project.missingStructure;
  const panel = openPanel({ title: `Em obra — ${project.name}`, subtitle: `${missing.length} peça(s) da estrutura faltando`, size: 'lg' });
  if (!missing.length) {
    panel.body.innerHTML = '<p class="empty">A estrutura de acompanhamento está completa.</p>';
    return;
  }
  const bySkill = missing.filter((f) => PIECES[f]?.by === 'skill');
  const byScript = missing.filter((f) => PIECES[f]?.by === 'script');
  const steps: string[] = [];
  if (bySkill.length)
    steps.push(
      `Abra uma sessão nesta casa e rode <code>/novo-projeto</code>. Ela lê o código antes, pergunta o que não souber e cria
       ${bySkill.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ')}.`,
    );
  if (byScript.length)
    steps.push(
      `Instale o auditor (e a data de auditoria) com <code>~/Documents/IA/instalar-projeto.sh ${escapeHtml(project.path)}</code>.
       Numa sessão, dá para rodar com <code>!</code> na frente.`,
    );
  panel.body.innerHTML = `
    <h3>O que falta</h3>
    <ul class="session-list pend-list">${missing
      .map((f) => `<li><code>${escapeHtml(f)}</code> <span class="pend-item">${escapeHtml(PIECES[f]?.what ?? '')}</span></li>`)
      .join('')}</ul>
    <h3>Como resolver</h3>
    <ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
}
