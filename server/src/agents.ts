import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT_DIR } from './config.js';
import type { Project } from './world.js';

/**
 * Fábrica de agentes (PD-4): os `.md` de ~/.claude/agents (globais) e de <projeto>/.claude/agents.
 * Só lê e grava dentro dessas pastas; agente gerado pelo Dev Valley (marca abaixo) é só leitura.
 */
export const GLOBAL_AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');
/** Agentes da vila (bibliotecária, administrador): o original no repo, só leitura na Fábrica (decisão de 26/10/2026). */
const VILLAGE_AGENTS_DIR = path.join(ROOT_DIR, 'server', 'agents');
const MANAGED_MARKER = '<!-- dev-valley:';
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;
const KNOWN = ['name', 'description', 'tools', 'model'];

export interface AgentSummary {
  path: string;
  name: string;
  description: string;
  /** null = global; senão o projeto onde o agente mora. */
  projectId: string | null;
  /** Gerado pelo Dev Valley (ex.: a bibliotecária): só leitura. */
  managed: boolean;
  /** Agente da vila, lido de `server/agents/` no repo: só leitura, sem NPC e sem conversa por `--agent`. */
  village: boolean;
}

export interface AgentFile extends AgentSummary {
  /** null = herda todas as ferramentas da sessão. */
  tools: string[] | null;
  /** null = o mesmo modelo da sessão. */
  model: string | null;
  instructions: string;
  /** Linhas do cabeçalho que o formulário não conhece, preservadas ao salvar. */
  extra: string[];
  mtime: number;
}

export interface AgentInput {
  description: string;
  tools: string[] | null;
  model: string | null;
  instructions: string;
}

const projectDir = (p: Project) => path.join(p.path, '.claude', 'agents');

export function unquote(v: string) {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t.slice(1, -1);
    }
  }
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replaceAll("''", "'");
  return t;
}

/** Cabeçalho simples (`chave: valor`, continuação indentada); o que não é dos campos conhecidos vai em `extra`. */
export function parseFrontmatter(raw: string, known: string[]) {
  const fields: Record<string, string> = {};
  const extra: string[] = [];
  let body = raw;
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    body = raw.slice(m[0].length);
    let lastKnown: string | null = null;
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
      if (kv && known.includes(kv[1])) {
        lastKnown = kv[1];
        fields[kv[1]] = kv[2];
      } else if (kv) {
        lastKnown = null;
        extra.push(line);
      } else if (lastKnown && /^\s+\S/.test(line)) {
        fields[lastKnown] += ' ' + line.trim();
      } else {
        extra.push(line);
      }
    }
  }
  return { fields, extra, body };
}

/** Valor YAML seguro numa linha: entre aspas quando tem `:`, `#` ou começa com caractere especial. */
export function yamlValue(v: string) {
  const one = v.replace(/\s*\n\s*/g, ' ').trim();
  return /[:#]|^[\s"'\[\]{}>|*&!%@`,-]/.test(one) ? JSON.stringify(one) : one;
}

function render(name: string, input: AgentInput, extra: string[]) {
  const head = [`name: ${name}`, `description: ${yamlValue(input.description)}`];
  if (input.tools?.length) head.push(`tools: ${input.tools.join(', ')}`);
  if (input.model) head.push(`model: ${input.model}`);
  head.push(...extra.filter((l) => l.trim()));
  return `---\n${head.join('\n')}\n---\n\n${input.instructions.trim()}\n`;
}

export class Agents {
  constructor(private projects: () => Project[]) {}

  /** As pastas onde a Fábrica pode mexer: a global e a de cada projeto da vila. */
  private dirs(projects = this.projects()): { dir: string; projectId: string | null }[] {
    return [{ dir: GLOBAL_AGENTS_DIR, projectId: null }, ...projects.map((p) => ({ dir: projectDir(p), projectId: p.id }))];
  }

  /** O arquivo, se estiver numa pasta conhecida (ou na dos agentes da vila) e tiver nome de agente; senão null. */
  private locate(file: unknown): { file: string; projectId: string | null; village: boolean } | null {
    if (typeof file !== 'string') return null;
    const resolved = path.resolve(file);
    if (!NAME_RE.test(path.basename(resolved, '.md')) || !resolved.endsWith('.md')) return null;
    if (path.dirname(resolved) === VILLAGE_AGENTS_DIR) return { file: resolved, projectId: null, village: true };
    const owner = this.dirs().find((d) => path.dirname(resolved) === d.dir);
    return owner ? { file: resolved, projectId: owner.projectId, village: false } : null;
  }

  /** `projects`: os do mundo que está sendo montado (o mundo atual ainda não os tem). */
  async list(projects?: Project[]): Promise<AgentSummary[]> {
    const out: AgentSummary[] = [];
    const sources = [...this.dirs(projects).map((d) => ({ ...d, village: false })), { dir: VILLAGE_AGENTS_DIR, projectId: null, village: true }];
    for (const { dir, projectId, village } of sources) {
      let files: string[];
      try {
        files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md')).sort();
      } catch {
        continue;
      }
      for (const f of files) {
        const file = path.join(dir, f);
        try {
          const raw = await fs.readFile(file, 'utf8');
          const managed = raw.includes(MANAGED_MARKER);
          // A cópia instalada de um agente da vila (ex.: a bibliotecária em ~/.claude/agents) aparece só pelo original.
          if (managed && !village) continue;
          const { fields } = parseFrontmatter(raw, KNOWN);
          out.push({
            path: file,
            name: unquote(fields.name ?? '') || f.replace(/\.md$/, ''),
            description: unquote(fields.description ?? ''),
            projectId,
            managed: managed || village,
            village,
          });
        } catch {
          // arquivo sumiu entre o readdir e a leitura
        }
      }
    }
    return out;
  }

  async read(file: unknown): Promise<AgentFile | null> {
    const loc = this.locate(file);
    if (!loc) return null;
    let raw: string;
    try {
      raw = await fs.readFile(loc.file, 'utf8');
    } catch {
      return null;
    }
    const { fields, extra, body } = parseFrontmatter(raw, KNOWN);
    const tools = unquote(fields.tools ?? '');
    const model = unquote(fields.model ?? '');
    return {
      path: loc.file,
      name: unquote(fields.name ?? '') || path.basename(loc.file, '.md'),
      description: unquote(fields.description ?? ''),
      projectId: loc.projectId,
      managed: raw.includes(MANAGED_MARKER) || loc.village,
      village: loc.village,
      tools: tools ? tools.split(',').map((t) => t.trim()).filter(Boolean) : null,
      model: model && model !== 'inherit' ? model : null,
      instructions: body.trim(),
      extra,
      mtime: (await fs.stat(loc.file)).mtimeMs,
    };
  }

  /** Nome com que o Claude Code chama o agente (`--agent`): o do cabeçalho, ou o do arquivo se aquele for estranho. */
  static cliName(agent: AgentSummary) {
    return NAME_RE.test(agent.name) ? agent.name : path.basename(agent.path, '.md');
  }

  async create(target: unknown, name: unknown, input: AgentInput): Promise<{ path: string } | { error: string }> {
    if (typeof name !== 'string' || !NAME_RE.test(name)) return { error: 'Nome inválido: use letras minúsculas, números e hífen.' };
    const dir = target === null ? GLOBAL_AGENTS_DIR : this.dirs().find((d) => d.projectId === target)?.dir;
    if (!dir) return { error: 'Lugar inválido.' };
    const file = path.join(dir, `${name}.md`);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.writeFile(file, render(name, input, []), { flag: 'wx' });
    } catch {
      return { error: `Já existe um agente ${name} nesse lugar.` };
    }
    return { path: file };
  }

  async save(file: unknown, mtime: unknown, input: AgentInput): Promise<{ mtime: number } | { error: string; status: number }> {
    const current = await this.read(file);
    if (!current) return { error: 'Agente não encontrado.', status: 404 };
    if (current.managed) return { error: 'Agente do Dev Valley: edite o modelo em server/agents/ no repo.', status: 403 };
    if (Math.abs(current.mtime - Number(mtime)) > 1) return { error: 'O arquivo mudou no disco desde que foi aberto. Recarregue antes de salvar.', status: 409 };
    await fs.writeFile(current.path, render(current.name, input, current.extra));
    return { mtime: (await fs.stat(current.path)).mtimeMs };
  }

  async remove(file: unknown): Promise<{ ok: true } | { error: string; status: number }> {
    const current = await this.read(file);
    if (!current) return { error: 'Agente não encontrado.', status: 404 };
    if (current.managed) return { error: 'Agente do Dev Valley não é apagado pela Fábrica (use npm run hooks:uninstall).', status: 403 };
    await fs.rm(current.path);
    return { ok: true };
  }
}

/** Valida o corpo de criar/salvar vindo do front. */
export function agentInput(body: any): AgentInput | null {
  if (typeof body?.description !== 'string' || !body.description.trim()) return null;
  if (typeof body?.instructions !== 'string') return null;
  const tools = Array.isArray(body.tools) ? body.tools.filter((t: unknown): t is string => typeof t === 'string' && /^[\w*().:-]+$/.test(t)) : null;
  const model = typeof body.model === 'string' && /^[\w.-]+$/.test(body.model) ? body.model : null;
  return { description: body.description, tools: tools?.length ? tools : null, model, instructions: body.instructions };
}
