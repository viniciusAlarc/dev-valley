import fs from 'node:fs/promises';
import path from 'node:path';
import { askAgent } from './consulta.js';
import { git } from './git.js';
import { readProgress } from './progress.js';

/**
 * Escrevente do pombal (decisão de 28/10/2026): o botão "Sugerir texto" da tela de enviar. Mesma base dos agentes da
 * vila (`consulta.ts`, `claude -p --no-session-persistence`, regra 5), só com `Read`: a vila monta o contexto e o agente
 * devolve uma linha, que vai direto para a caixa de texto.
 */

/** Teto do diff no prompt: o bastante para entender a mudança sem mandar um arquivo gerado inteiro. */
const MAX_DIFF = 60_000;
const MAX_NOVO = 60;

function stepFor(tool: string, input: any): string {
  return tool === 'Read' ? `📖 Lendo ${path.basename(String(input?.file_path ?? ''))}` : `🔧 ${tool}`;
}

/** Diff dos arquivos escolhidos (vazio = todos): os rastreados contra o HEAD, e o começo de cada arquivo novo. */
async function diffEscolhido(dir: string, arquivos: string[]): Promise<string> {
  const filtro = arquivos.length ? ['--', ...arquivos] : [];
  const rastreados = await git(dir, ['diff', 'HEAD', ...filtro]).catch(() => git(dir, ['diff', '--cached', ...filtro]).catch(() => ''));
  const novos = (await git(dir, ['ls-files', '--others', '--exclude-standard', ...filtro]).catch(() => '')).split('\n').filter(Boolean);
  const blocos = await Promise.all(
    novos.map(async (f) => {
      const texto = await fs.readFile(path.join(dir, f), 'utf8').catch(() => '(binário ou ilegível)');
      return `--- arquivo novo: ${f}\n${texto.split('\n').slice(0, MAX_NOVO).join('\n')}`;
    }),
  );
  const diff = [rastreados, ...blocos].filter(Boolean).join('\n\n');
  return diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n\n(diff cortado em ${MAX_DIFF} caracteres)` : diff;
}

async function contexto(dir: string, arquivos: string[]): Promise<string> {
  const [claudeMd, log, progress, diff] = await Promise.all([
    fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8').catch(() => ''),
    git(dir, ['log', '--format=%s', '-15']).catch(() => ''),
    readProgress(dir).catch(() => null),
    diffEscolhido(dir, arquivos),
  ]);
  const regra = claudeMd.split('\n').filter((l) => /commit/i.test(l)).slice(0, 6).join('\n');
  return [
    `## Pasta do projeto\n\n${dir}`,
    regra && `## Regra de commit do projeto (linhas do CLAUDE.md)\n\n${regra}`,
    log.trim() && `## Últimas mensagens do git log\n\n${log.trim()}`,
    progress?.length && `## Títulos recentes do PROGRESS.md\n\n${progress.slice(0, 5).map((e) => `- ${e.date} — ${e.title}`).join('\n')}`,
    `## Diff das alterações que vão\n\n${diff || '(vazio)'}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Pede a mensagem ao escrevente; resolve com uma linha só. */
export async function sugerirMensagem(dir: string, arquivos: string[], hooksToIgnore: Set<string>): Promise<string> {
  const preamble = await contexto(dir, arquivos);
  return new Promise((resolve, reject) => {
    askAgent(
      { name: 'escrevente', who: 'O escrevente', preamble, stepFor },
      'Escreva a mensagem de commit destas alterações.',
      [],
      (e) => {
        if (e.type === 'answer') resolve(e.text.trim().split('\n').find((l) => l.trim())?.replace(/^["'`]+|["'`]+$/g, '').trim() ?? '');
        else if (e.type === 'error') reject(new Error(e.text));
      },
      hooksToIgnore,
    );
  });
}
