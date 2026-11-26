import fs from 'node:fs/promises';
import path from 'node:path';

export interface ProgressEntry {
  date: string;
  title: string;
  /** Markdown da entrega, sem o título. */
  body: string;
}

/** Resumo que vai no mundo (o arquivo inteiro só vem quando o diário é aberto). */
export interface ProgressSummary {
  entries: number;
  lastDate: string;
  /** Entregas que ainda dizem "Falta conferir na vila" (sino da praça). */
  toCheck: { date: string; title: string }[];
}

// Só as frases-padrão, e não quando aparecem citadas (entre aspas ou crases) no texto da entrega.
export const TO_CHECK = /(?<!["“'`])falta conferir na vila/i;
const CHECKED = /(?<!["“'`])conferid[oa] na vila/i;
// A frase com o que vem junto, como "(reinício do usuário)", mesmo quebrado em duas linhas.
const TO_CHECK_FULL = /(?<!["“'`])falta conferir na vila(?:\s*\([^)]*\))?/i;

const HEADING = /^##\s+(?:(\d{4}-\d{2}-\d{2})\s*[—–-]\s*)?(.+)$/;

/**
 * Lê o `PROGRESS.md` do projeto (formato do G5: uma seção `## data — título` por entrega, mais recente no topo).
 * Só leitura. Retorna null quando o projeto não tem o arquivo.
 */
export async function readProgress(dir: string): Promise<ProgressEntry[] | null> {
  let text: string;
  try {
    text = await fs.readFile(path.join(dir, 'PROGRESS.md'), 'utf8');
  } catch {
    return null;
  }
  return parseEntries(text);
}

/** Pasta do arquivo do `PROGRESS.md`: um `AAAA-MM.md` por mês, só com entregas já conferidas (24/11/2026). */
export const ARQUIVO_DIR = path.join('docs-dev', 'progresso');

/**
 * Diário do atril: o `PROGRESS.md` e, depois dele, os meses arquivados (o mais recente primeiro). O sino não usa isto:
 * o que está arquivado já foi conferido. Null só quando não há nem o `PROGRESS.md` nem arquivo.
 */
export async function readProgressComArquivo(dir: string): Promise<ProgressEntry[] | null> {
  const atual = await readProgress(dir);
  let meses: string[] = [];
  try {
    meses = (await fs.readdir(path.join(dir, ARQUIVO_DIR))).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort().reverse();
  } catch {
    // Sem arquivo: só o PROGRESS.md.
  }
  if (!atual && !meses.length) return null;
  const arquivadas = await Promise.all(meses.map(async (f) => parseEntries(await fs.readFile(path.join(dir, ARQUIVO_DIR, f), 'utf8'))));
  return [...(atual ?? []), ...arquivadas.flat()];
}

function parseEntries(text: string): ProgressEntry[] {
  return sections(text).flatMap((s) =>
    s.heading ? [{ ...s.heading, body: s.lines.slice(1).join('\n').trim() }] : [],
  );
}

/** Corta o texto em seções: a primeira (cabeçalho do arquivo) sem título; cada outra vai de um `## ` até o próximo. */
function sections(text: string): { heading: { date: string; title: string } | null; lines: string[] }[] {
  const out: { heading: { date: string; title: string } | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  for (const line of text.split('\n')) {
    const m = line.match(HEADING);
    if (m) out.push({ heading: { date: m[1] ?? '', title: m[2].trim() }, lines: [line] });
    else out[out.length - 1].lines.push(line);
  }
  return out;
}

/**
 * Separa o que sai do `PROGRESS.md` para o arquivo: entrega com data de mês anterior a `mesAtual` (`AAAA-MM`) e que não
 * espera conferência. Entrega sem data, do mês corrente ou com "Falta conferir na vila" fica (senão o sino a perde).
 * Pura: quem grava é `scripts/arquivar-progress.ts`.
 */
export function separarParaArquivo(text: string, mesAtual: string): { fica: string; porMes: Map<string, string[]> } {
  const fica: string[] = [];
  const porMes = new Map<string, string[]>();
  for (const s of sections(text)) {
    const mes = s.heading?.date.slice(0, 7);
    const body = s.lines.slice(1).join('\n');
    if (!s.heading || !mes || mes >= mesAtual || isToCheck({ ...s.heading, body })) {
      fica.push(...s.lines);
      continue;
    }
    // Sem as linhas em branco do fim; quem grava junta as seções com uma linha em branco.
    const bloco = s.lines.join('\n').trimEnd();
    porMes.set(mes, [...(porMes.get(mes) ?? []), bloco]);
  }
  return { fica: fica.join('\n'), porMes };
}

export async function summarizeProgress(dir: string): Promise<ProgressSummary | null> {
  const entries = await readProgress(dir);
  if (!entries) return null;
  // A conferência é a troca do texto da entrega: pela sessão, pelo administrador ou pelo sino (`markChecked`).
  const toCheck = entries.filter(isToCheck).map(({ date, title }) => ({ date, title }));
  return { entries: entries.length, lastDate: entries.find((e) => e.date)?.date ?? '', toCheck };
}

function isToCheck(e: ProgressEntry): boolean {
  return TO_CHECK.test(e.body) && !CHECKED.test(e.body);
}

/**
 * Sino da praça (pedido do usuário, 29/10/2026): marca entregas como conferidas sem passar pelo administrador. Faz só o
 * passo mecânico, o mesmo do administrador no `PROGRESS.md`: troca "Falta conferir na vila" (e o parêntese que vem
 * junto) por "Conferido na vila pelo usuário em DD/MM/AAAA". Plano em `a-codar/` e pendência ficam com a sessão ou o
 * administrador. Só mexe em entrega que o sino lista; retorna quantas trocou.
 */
export async function markChecked(dir: string, items: { date: string; title: string }[]): Promise<number> {
  const file = path.join(dir, 'PROGRESS.md');
  const text = await fs.readFile(file, 'utf8');
  const wanted = new Set(items.map((i) => `${i.date}\n${i.title}`));
  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  // Mesmo corte do `readProgress`: cada seção vai do título até o próximo `## `.
  const secoes = sections(text);
  let changed = 0;
  for (const s of secoes) {
    if (!s.heading || !wanted.has(`${s.heading.date}\n${s.heading.title}`)) continue;
    const [head, ...rest] = s.lines;
    const body = rest.join('\n');
    if (!isToCheck({ ...s.heading, body })) continue;
    s.lines = [head, ...body.replace(TO_CHECK_FULL, `Conferido na vila pelo usuário em ${today}`).split('\n')];
    changed++;
  }
  if (changed) await fs.writeFile(file, secoes.flatMap((s) => s.lines).join('\n'));
  return changed;
}
