import fs from 'node:fs';
import path from 'node:path';

/**
 * Página servida pela própria máquina (regra 2 do CLAUDE.md): os terminais rodam comandos de verdade. Sem `Origin`
 * (curl, o próprio servidor) também passa; origem que não é URL é recusada.
 */
export function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Caminho real do arquivo que `/api/arquivo` pode entregar, ou null. Só arquivo de dentro da pasta de um projeto da
 * vila, pelo caminho real (link simbólico não escapa), e nada que comece com ponto (.env, .git, .claude) em qualquer
 * nível dentro do projeto: o sendFile não recusa sozinho quando recebe o caminho absoluto (testado em 29/10/2026,
 * entregou .git/config).
 */
export function arquivoPermitido(pedido: string, projetos: string[]): string | null {
  if (!path.isAbsolute(pedido)) return null;
  let real: string;
  try {
    real = fs.realpathSync(pedido);
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  const raiz = projetos
    .map((p) => {
      try {
        return fs.realpathSync(p);
      } catch {
        return null;
      }
    })
    .find((r) => r !== null && real.startsWith(r + path.sep));
  if (!raiz) return null;
  if (path.relative(raiz, real).split(path.sep).some((parte) => parte.startsWith('.'))) return null;
  return real;
}
