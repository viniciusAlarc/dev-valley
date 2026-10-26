import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Estrutura de acompanhamento que os guardrails pedem em todo projeto (casa em obra, decisão de 26/10/2026):
 * os arquivos que o `/novo-projeto` cria e o auditor que o `instalar-projeto.sh` instala.
 */
export const ESTRUTURA = ['CLAUDE.md', 'PENDENCIAS.md', 'PROGRESS.md', 'docs-dev/painel.json', 'scripts/auditar-referencias.py'];

/** O que falta no projeto, na ordem de `ESTRUTURA`. Lista vazia = casa pronta. Só leitura. */
export async function missingStructure(dir: string): Promise<string[]> {
  const exists = await Promise.all(
    ESTRUTURA.map((f) =>
      fs.access(path.join(dir, f)).then(
        () => true,
        () => false,
      ),
    ),
  );
  return ESTRUTURA.filter((_, i) => !exists[i]);
}

/**
 * Placa de vistoria (decisão de 26/10/2026): data de vencimento da auditoria de julgamento das regras
 * (`.claude/auditoria-regras.txt`, gravada pelo `instalar-projeto.sh` e reagendada pela skill `/auditar-regras`).
 * Primeira linha `AAAA-MM-DD` do arquivo; null quando não há arquivo ou data.
 */
export async function readAuditoria(dir: string): Promise<string | null> {
  try {
    const text = await fs.readFile(path.join(dir, '.claude', 'auditoria-regras.txt'), 'utf8');
    return text.match(/^(\d{4}-\d{2}-\d{2})\s*$/m)?.[1] ?? null;
  } catch {
    return null;
  }
}
