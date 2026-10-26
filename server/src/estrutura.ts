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
