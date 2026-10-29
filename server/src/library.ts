import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeCatalog } from './catalog.js';
import { CLAUDE_PROJECTS_DIR, type Config } from './config.js';
import type { Project } from './world.js';

/**
 * A Biblioteca: tudo o que é conhecimento em markdown e HTML — instruções globais do Claude,
 * memórias automáticas, CLAUDE.md/AGENTS.md/docs de cada projeto e pastas extras (libraryRoots).
 */

// Livros da estante: markdown e, desde 29/10/2026 (pedido do usuário), HTML, que o leitor abre isolado.
const BOOK = /\.(md|mdx|html?)$/i;
const isHtml = (file: string) => /\.html?$/i.test(file);

export type SectionKind = 'global' | 'memory' | 'project' | 'root';

export interface LibraryFile {
  path: string;
  rel: string;
  size: number;
  mtime: number;
}

export interface Section {
  id: string;
  title: string;
  kind: SectionKind;
  base: string;
  projectId?: string;
  files: LibraryFile[];
  /** Projeto sem CLAUDE.md — a biblioteca oferece criar um. */
  missingClaudeMd?: boolean;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next', 'vendor', '.idea', '.venv', 'coverage', '.gradle', '.mvn']);
const MAX_FILES_PER_SECTION = 3000;
const MAX_DEPTH = 8;
const CACHE_MS = 10_000;

async function stat(file: string): Promise<LibraryFile | null> {
  try {
    const s = await fs.stat(file);
    return s.isFile() ? { path: file, rel: '', size: s.size, mtime: s.mtimeMs } : null;
  } catch {
    return null;
  }
}

async function walkBooks(base: string): Promise<LibraryFile[]> {
  const out: LibraryFile[] = [];
  async function walk(dir: string, depth: number) {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES_PER_SECTION) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES_PER_SECTION) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // .claude entra (CLAUDE.md, agentes, comandos); as demais pastas ocultas não.
        if (SKIP_DIRS.has(e.name) || (e.name.startsWith('.') && e.name !== '.claude')) continue;
        await walk(full, depth + 1);
      } else if (e.isFile() && BOOK.test(e.name)) {
        const f = await stat(full);
        if (f) out.push({ ...f, rel: path.relative(base, full) });
      }
    }
  }
  await walk(base, 0);
  // Os arquivos-guia primeiro, depois em ordem alfabética.
  const priority = (rel: string) => ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', 'README.md', 'MEMORY.md'].indexOf(rel);
  return out.sort((a, b) => {
    const pa = priority(a.rel);
    const pb = priority(b.rel);
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return a.rel.localeCompare(b.rel);
  });
}

/** Mesmo esquema de nomes que o Claude Code usa em ~/.claude/projects. */
function encodeProjectDir(p: string) {
  return p.replace(/[^a-zA-Z0-9-]/g, '-');
}

async function scan(config: Config, projects: Project[]): Promise<Section[]> {
  const sections: Section[] = [];
  const home = os.homedir();

  const globalMd = await stat(path.join(home, '.claude', 'CLAUDE.md'));
  sections.push({
    id: 'global',
    title: 'Suas instruções (global)',
    kind: 'global',
    base: path.join(home, '.claude'),
    files: globalMd ? [{ ...globalMd, rel: 'CLAUDE.md' }] : [],
  });

  let memoryDirs: string[] = [];
  try {
    memoryDirs = await fs.readdir(CLAUDE_PROJECTS_DIR);
  } catch {
    // sem sessões ainda
  }
  for (const dir of memoryDirs.sort()) {
    const base = path.join(CLAUDE_PROJECTS_DIR, dir, 'memory');
    const files = await walkBooks(base);
    if (!files.length) continue;
    const project = projects.find((p) => encodeProjectDir(p.path) === dir);
    const title = project
      ? `Memórias — ${project.name}`
      : dir === encodeProjectDir(home)
        ? 'Memórias — pasta pessoal (~)'
        : `Memórias — ${dir.replace(encodeProjectDir(home), '~').replace(/-/g, '/')}`;
    sections.push({ id: `memory:${dir}`, title, kind: 'memory', base, projectId: project?.id, files });
  }

  for (const p of projects) {
    const files = await walkBooks(p.path);
    const hasClaudeMd = files.some((f) => f.rel === 'CLAUDE.md' || f.rel === path.join('.claude', 'CLAUDE.md'));
    sections.push({ id: `project:${p.id}`, title: p.name, kind: 'project', base: p.path, projectId: p.id, files, missingClaudeMd: !hasClaudeMd });
  }

  for (const root of config.libraryRoots) {
    sections.push({ id: `root:${root}`, title: path.basename(root), kind: 'root', base: root, files: await walkBooks(root) });
  }
  return sections;
}

export class Library {
  private cache: { at: number; sections: Section[] } | null = null;

  constructor(
    private config: Config,
    private projects: () => Project[],
  ) {}

  private catalogSignature = '';

  async sections(force = false): Promise<Section[]> {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.sections;
    const sections = await scan(this.config, this.projects());
    this.cache = { at: Date.now(), sections };
    // O catálogo da bibliotecária só é reescrito quando algum livro mudou.
    const signature = JSON.stringify(sections.map((s) => [s.id, s.files.map((f) => [f.path, f.mtime])]));
    if (signature !== this.catalogSignature) {
      this.catalogSignature = signature;
      await writeCatalog(sections).catch((err) => console.error('[catálogo] falha ao gravar:', err));
    }
    return sections;
  }

  /** Só arquivos encontrados pela varredura podem ser lidos ou gravados. */
  private async find(file: unknown): Promise<LibraryFile | null> {
    if (typeof file !== 'string') return null;
    const lookup = (s: Section[]) => s.flatMap((x) => x.files).find((f) => f.path === file) ?? null;
    return lookup(await this.sections()) ?? lookup(await this.sections(true));
  }

  /** Caminho do HTML para abrir isolado no leitor; null fora da biblioteca ou quando não é HTML. */
  async htmlPath(file: unknown): Promise<string | null> {
    const f = await this.find(file);
    return f && isHtml(f.path) ? f.path : null;
  }

  async read(file: unknown) {
    const f = await this.find(file);
    if (!f) return null;
    const s = await fs.stat(f.path);
    return { path: f.path, content: await fs.readFile(f.path, 'utf8'), mtime: s.mtimeMs };
  }

  async write(file: unknown, content: unknown, mtime: unknown): Promise<{ mtime: number } | { conflict: true } | null> {
    const f = await this.find(file);
    if (!f || typeof content !== 'string') return null;
    const s = await fs.stat(f.path);
    // Alguém (ou o próprio Claude) mexeu no arquivo depois que ele foi aberto: não sobrescreve.
    if (Math.abs(s.mtimeMs - Number(mtime)) > 1) return { conflict: true };
    await fs.writeFile(f.path, content);
    this.cache = null;
    return { mtime: (await fs.stat(f.path)).mtimeMs };
  }

  async createClaudeMd(project: Project): Promise<string | null> {
    const file = path.join(project.path, 'CLAUDE.md');
    try {
      await fs.writeFile(file, claudeMdTemplate(project.name), { flag: 'wx' });
    } catch {
      return null; // já existe
    }
    this.cache = null;
    return file;
  }

  async search(query: string, limit = 100) {
    const q = query.toLowerCase();
    const results: { path: string; section: string; rel: string; line: number; text: string }[] = [];
    for (const section of await this.sections()) {
      for (const f of section.files) {
        if (results.length >= limit) return results;
        if (f.rel.toLowerCase().includes(q)) results.push({ path: f.path, section: section.title, rel: f.rel, line: 0, text: '' });
        if (f.size > 512 * 1024) continue;
        const lines = (await fs.readFile(f.path, 'utf8').catch(() => '')).split('\n');
        for (let i = 0; i < lines.length && results.length < limit; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            results.push({ path: f.path, section: section.title, rel: f.rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
            break; // um resultado por arquivo basta para achar o livro
          }
        }
      }
    }
    return results;
  }
}

function claudeMdTemplate(name: string) {
  return `# ${name}

<!-- Instruções para o Claude Code neste projeto. Mantenha curto e objetivo. -->

## Visão geral
O que é o projeto, para quem é, e o estado atual.

## Stack e estrutura
- Linguagens, frameworks e versões
- Onde fica o quê (pastas principais)

## Comandos
- Build:
- Testes:
- Rodar localmente:

## Convenções
- Padrões de código, nomes, commits

## Cuidados
- O que nunca fazer (ex.: rodar migrations em produção, apagar dados)
`;
}
