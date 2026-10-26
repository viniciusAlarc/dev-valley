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
const TO_CHECK = /(?<!["“'`])falta conferir na vila/i;
const CHECKED = /(?<!["“'`])conferid[oa] na vila/i;

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
  const entries: ProgressEntry[] = [];
  let current: { date: string; title: string; lines: string[] } | null = null;
  const close = () => current && entries.push({ date: current.date, title: current.title, body: current.lines.join('\n').trim() });
  for (const line of text.split('\n')) {
    const m = line.match(HEADING);
    if (m) {
      close();
      current = { date: m[1] ?? '', title: m[2].trim(), lines: [] };
    } else current?.lines.push(line);
  }
  close();
  return entries;
}

export async function summarizeProgress(dir: string): Promise<ProgressSummary | null> {
  const entries = await readProgress(dir);
  if (!entries) return null;
  // A sessão marca a conferência trocando o texto da entrega; a vila só lê.
  const toCheck = entries.filter((e) => TO_CHECK.test(e.body) && !CHECKED.test(e.body)).map(({ date, title }) => ({ date, title }));
  return { entries: entries.length, lastDate: entries.find((e) => e.date)?.date ?? '', toCheck };
}
