import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Section } from './library.js';

/**
 * O catálogo é a "memória" da bibliotecária: um índice em markdown de todos os livros
 * (caminho, título, descrição e seções). Gerado sem IA, sempre que algo muda na biblioteca,
 * então nunca fica desatualizado nem custa tokens para manter.
 */
export const CATALOG_PATH = path.join(os.homedir(), '.cache', 'dev-valley', 'catalogo.md');

const MAX_READ = 256 * 1024;
const MAX_HEADINGS = 12;

interface BookMeta {
  title: string | null;
  description: string | null;
  headings: string[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

async function describe(file: string): Promise<BookMeta> {
  let text = '';
  try {
    const handle = await fs.open(file);
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(MAX_READ), 0, MAX_READ, 0);
    await handle.close();
    text = buffer.subarray(0, bytesRead).toString('utf8');
  } catch {
    return { title: null, description: null, headings: [] };
  }
  let description: string | null = null;
  let title: string | null = null;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    description = fm[1].match(/^description:\s*(.+)$/m)?.[1].trim() ?? null;
    title = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim() ?? null;
  }
  const headings: string[] = [];
  let inCode = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) inCode = !inCode;
    if (inCode) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    if (m[1] === '#' && !title) title = m[2];
    else if (m[1] !== '#' && headings.length < MAX_HEADINGS) headings.push(clip(m[2], 60));
  }
  return { title: title && clip(title, 90), description: description && clip(description, 160), headings };
}

const KIND_LABEL = { global: 'instruções globais', memory: 'memórias automáticas', project: 'projeto', root: 'acervo' };

export async function writeCatalog(sections: Section[]) {
  const total = sections.reduce((n, s) => n + s.files.length, 0);
  const out: string[] = [
    '# Catálogo da Biblioteca do Dev Valley',
    '',
    `Gerado automaticamente em ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${total} livros em ${sections.length} estantes.`,
    'Caminhos são relativos à pasta da estante (indicada no título). Datas = última edição.',
    '',
  ];
  for (const s of sections) {
    out.push(`## ${s.title} (${KIND_LABEL[s.kind]}) — \`${s.base}\``);
    if (s.missingClaudeMd) out.push('_Sem CLAUDE.md._');
    if (!s.files.length) out.push('_Estante vazia._');
    for (const f of s.files) {
      const meta = await describe(f.path);
      const date = new Date(f.mtime).toISOString().slice(0, 10);
      let line = `- \`${f.rel}\` (${date})`;
      if (meta.title) line += ` — **${meta.title}**`;
      if (meta.description) line += ` — ${meta.description}`;
      if (meta.headings.length) line += ` · seções: ${meta.headings.join('; ')}`;
      out.push(line);
    }
    out.push('');
  }
  await fs.mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  await fs.writeFile(CATALOG_PATH, out.join('\n'));
}
