import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseFrontmatter, unquote, yamlValue } from './agents.js';
import type { Project } from './world.js';

/**
 * Skills na Fábrica (decisão de 26/10/2026): pastas com `SKILL.md` em ~/.claude/skills (globais) e em
 * <projeto>/.claude/skills. Ler, criar, editar (só o `SKILL.md`) e apagar (a pasta inteira). Skill que é link
 * (instalada de um repositório de regras, como as do `instalar.sh`) é só leitura: a fonte é o repositório.
 */
export const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KNOWN = ['name', 'description'];

export interface SkillSummary {
  /** Caminho do `SKILL.md` (pela pasta de skills, não pelo destino do link). */
  path: string;
  name: string;
  description: string;
  /** null = global; senão o projeto onde a skill mora. */
  projectId: string | null;
  /** Destino do link quando a pasta da skill é um link; só leitura. */
  linkedTo: string | null;
}

export interface SkillFile extends SkillSummary {
  instructions: string;
  /** Linhas do cabeçalho que o formulário não conhece (ex.: `allowed-tools`), preservadas ao salvar. */
  extra: string[];
  /** Arquivos da pasta, relativos a ela (a confirmação de apagar mostra o que vai junto). */
  files: string[];
  mtime: number;
}

export interface SkillInput {
  description: string;
  instructions: string;
}

const projectDir = (p: Project) => path.join(p.path, '.claude', 'skills');

function render(name: string, input: SkillInput, extra: string[]) {
  const head = [`name: ${name}`, `description: ${yamlValue(input.description)}`, ...extra.filter((l) => l.trim())];
  return `---\n${head.join('\n')}\n---\n\n${input.instructions.trim()}\n`;
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full, base)));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

export class Skills {
  constructor(private projects: () => Project[]) {}

  private dirs(projects = this.projects()): { dir: string; projectId: string | null }[] {
    return [{ dir: GLOBAL_SKILLS_DIR, projectId: null }, ...projects.map((p) => ({ dir: projectDir(p), projectId: p.id }))];
  }

  /** `<pasta de skills>/<nome>/SKILL.md` de uma pasta conhecida; senão null. */
  private locate(file: unknown): { file: string; folder: string; projectId: string | null } | null {
    if (typeof file !== 'string') return null;
    const resolved = path.resolve(file);
    const folder = path.dirname(resolved);
    if (path.basename(resolved) !== 'SKILL.md' || !NAME_RE.test(path.basename(folder))) return null;
    const owner = this.dirs().find((d) => path.dirname(folder) === d.dir);
    return owner ? { file: resolved, folder, projectId: owner.projectId } : null;
  }

  private async linkOf(folder: string): Promise<string | null> {
    const st = await fs.lstat(folder).catch(() => null);
    return st?.isSymbolicLink() ? await fs.realpath(folder).catch(() => null) : null;
  }

  async list(projects?: Project[]): Promise<SkillSummary[]> {
    const out: SkillSummary[] = [];
    for (const { dir, projectId } of this.dirs(projects)) {
      const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => NAME_RE.test(n)).sort();
      for (const n of names) {
        const file = path.join(dir, n, 'SKILL.md');
        const raw = await fs.readFile(file, 'utf8').catch(() => null);
        if (raw === null) continue; // pasta sem SKILL.md (ex.: as que o próprio Claude Code sincroniza) não é skill daqui
        const { fields } = parseFrontmatter(raw, KNOWN);
        out.push({
          path: file,
          name: unquote(fields.name ?? '') || n,
          description: unquote(fields.description ?? ''),
          projectId,
          linkedTo: await this.linkOf(path.join(dir, n)),
        });
      }
    }
    return out;
  }

  async read(file: unknown): Promise<SkillFile | null> {
    const loc = this.locate(file);
    if (!loc) return null;
    const raw = await fs.readFile(loc.file, 'utf8').catch(() => null);
    if (raw === null) return null;
    const { fields, extra, body } = parseFrontmatter(raw, KNOWN);
    return {
      path: loc.file,
      name: unquote(fields.name ?? '') || path.basename(loc.folder),
      description: unquote(fields.description ?? ''),
      projectId: loc.projectId,
      linkedTo: await this.linkOf(loc.folder),
      instructions: body.trim(),
      extra,
      files: await listFiles(loc.folder),
      mtime: (await fs.stat(loc.file)).mtimeMs,
    };
  }

  async create(target: unknown, name: unknown, input: SkillInput): Promise<{ path: string } | { error: string }> {
    if (typeof name !== 'string' || !NAME_RE.test(name)) return { error: 'Nome inválido: use letras minúsculas, números e hífen.' };
    const dir = target === null ? GLOBAL_SKILLS_DIR : this.dirs().find((d) => d.projectId === target)?.dir;
    if (!dir) return { error: 'Lugar inválido.' };
    const folder = path.join(dir, name);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.mkdir(folder);
    } catch {
      return { error: `Já existe uma skill ${name} nesse lugar.` };
    }
    const file = path.join(folder, 'SKILL.md');
    await fs.writeFile(file, render(name, input, []), { flag: 'wx' });
    return { path: file };
  }

  async save(file: unknown, mtime: unknown, input: SkillInput): Promise<{ mtime: number } | { error: string; status: number }> {
    const current = await this.read(file);
    if (!current) return { error: 'Skill não encontrada.', status: 404 };
    if (current.linkedTo) return { error: `Skill instalada por link: edite na fonte (${current.linkedTo}).`, status: 403 };
    if (Math.abs(current.mtime - Number(mtime)) > 1) return { error: 'O arquivo mudou no disco desde que foi aberto. Recarregue antes de salvar.', status: 409 };
    await fs.writeFile(current.path, render(current.name, input, current.extra));
    return { mtime: (await fs.stat(current.path)).mtimeMs };
  }

  /** Apaga a pasta inteira da skill (decisão do usuário); nunca um link nem algo fora das pastas de skills. */
  async remove(file: unknown): Promise<{ ok: true } | { error: string; status: number }> {
    const loc = this.locate(file);
    if (!loc || !(await this.read(file))) return { error: 'Skill não encontrada.', status: 404 };
    if (await this.linkOf(loc.folder)) return { error: 'Skill instalada por link não é apagada pela Fábrica: desinstale na fonte.', status: 403 };
    await fs.rm(loc.folder, { recursive: true });
    return { ok: true };
  }
}

/** Valida o corpo de criar/salvar vindo do front. */
export function skillInput(body: any): SkillInput | null {
  if (typeof body?.description !== 'string' || !body.description.trim()) return null;
  if (typeof body?.instructions !== 'string') return null;
  return { description: body.description, instructions: body.instructions };
}
