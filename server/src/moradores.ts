import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Project, WorldSession } from './world.js';

/**
 * Nomes dos moradores: únicos entre as sessões da vila e fixos enquanto a sessão existir (decisão de 26/10/2026).
 * O cadastro fica fora do repositório, em ~/.claude/dev-valley/:
 * - `nomes.json`: sessão → nome (persistente, para o nome não mudar ao reiniciar a vila);
 * - `moradores.json`: nome → sessão, projeto, título e conversa. É o mapa que o mod (`mod/hooks/register.ts`) lê
 *   quando o usuário cita `@Nome` numa sessão, sem precisar perguntar nada à vila.
 */
export const MORADORES_DIR = path.join(os.homedir(), '.claude', 'dev-valley');
const NAMES_FILE = path.join(MORADORES_DIR, 'nomes.json');
export const MAP_FILE = path.join(MORADORES_DIR, 'moradores.json');

// Os 24 primeiros são os nomes de antes, na mesma ordem: quem já tinha nome sem conflito continua com ele.
const LEGACY = [
  'Ana', 'Bento', 'Caio', 'Duda', 'Elis', 'Fábio', 'Gabi', 'Heitor', 'Íris', 'Joca', 'Kika', 'Lia',
  'Malu', 'Nico', 'Otto', 'Pietra', 'Rafa', 'Sofia', 'Theo', 'Vivi', 'Zeca', 'Bia', 'Davi', 'Nina',
];
const POOL = [
  ...LEGACY,
  'Alice', 'Breno', 'Cacau', 'Dante', 'Edu', 'Flora', 'Guto', 'Helena', 'Igor', 'Juju', 'Lara', 'Luca',
  'Mel', 'Noah', 'Olga', 'Pedro', 'Quico', 'Rosa', 'Samuel', 'Tati', 'Ulisses', 'Vera', 'Yara', 'Zoe',
  'Arthur', 'Bela', 'Cecília', 'Dora', 'Enzo', 'Fred', 'Gael', 'Hugo', 'Iara', 'Jade', 'Kauã', 'Leo',
  'Maya', 'Nara', 'Olívia', 'Paco', 'Rita', 'Salvador', 'Teca', 'Valentim', 'Wanda', 'Xande', 'Yuri', 'Zuza',
  'Amora', 'Benício', 'Clara', 'Dudu', 'Estela', 'Fernão', 'Gina', 'Ivo',
];

/** Mesmo hash do front (textures.ts) — mantém o nome antigo de cada sessão. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Sessão recém-aberta ainda pode não estar no mundo: o nome dela não é liberado logo de cara. */
const CLAIM_GRACE_MS = 2 * 60 * 1000;

const STATE_TEXT = { working: 'trabalhando', permission: 'pedindo permissão', idle: 'esperando o usuário' } as const;

export class Moradores {
  private names = new Map<string, string>();
  private claimedAt = new Map<string, number>();
  private loaded = false;
  private lastNames = '';
  private lastMap = '';

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const data = JSON.parse(await fs.readFile(NAMES_FILE, 'utf8'));
      for (const [id, name] of Object.entries(data)) if (typeof name === 'string') this.names.set(id, name);
    } catch {
      // primeira vez: sem cadastro
    }
  }

  private pick(id: string): string {
    const used = new Set(this.names.values());
    const legacy = LEGACY[hash(id) % LEGACY.length];
    if (!used.has(legacy)) return legacy;
    const start = hash(id) % POOL.length;
    for (let i = 0; i < POOL.length; i++) {
      const name = POOL[(start + i) % POOL.length];
      if (!used.has(name)) return name;
    }
    // Mais sessões que nomes: o mesmo nome com número, ainda único.
    for (let n = 2; ; n++) {
      const name = `${legacy}${n}`;
      if (!used.has(name)) return name;
    }
  }

  private nameOf(id: string): string {
    let name = this.names.get(id);
    if (!name) {
      name = this.pick(id);
      this.names.set(id, name);
    }
    return name;
  }

  /** Nome de uma sessão que acabou de abrir (hook SessionStart), antes de ela aparecer no mundo. */
  async claim(id: string): Promise<string> {
    await this.load();
    this.claimedAt.set(id, Date.now());
    const name = this.nameOf(id);
    await this.saveNames();
    return name;
  }

  /**
   * Dá nome a todas as sessões do mundo e regrava o mapa. Sem cadastro prévio, as sessões mais antigas escolhem
   * primeiro: num nome repetido de antes, o morador mais antigo fica com ele.
   */
  async sync(sessions: WorldSession[], projects: Project[]) {
    await this.load();
    const now = Date.now();
    const present = new Set(sessions.map((s) => s.id));
    for (const id of [...this.names.keys()]) {
      if (present.has(id) || now - (this.claimedAt.get(id) ?? 0) < CLAIM_GRACE_MS) continue;
      this.names.delete(id);
      this.claimedAt.delete(id);
    }
    for (const s of [...sessions].sort((a, b) => a.lastActivity - b.lastActivity)) s.name = this.nameOf(s.id);
    await this.saveNames();

    const byId = new Map(projects.map((p) => [p.id, p]));
    const moradores = Object.fromEntries(
      sessions.map((s) => [
        s.name,
        {
          sessao: s.id,
          projeto: s.projectId ? (byId.get(s.projectId)?.name ?? null) : null,
          pasta: s.cwd,
          titulo: s.title,
          estado: s.live ? STATE_TEXT[s.status ?? 'working'] : 'encerrada',
          conversa: s.file,
        },
      ]),
    );
    const map = JSON.stringify(moradores);
    if (map === this.lastMap) return;
    this.lastMap = map;
    await fs.mkdir(MORADORES_DIR, { recursive: true });
    await fs.writeFile(MAP_FILE, JSON.stringify({ atualizadoEm: new Date().toISOString(), moradores }, null, 2));
  }

  private async saveNames() {
    const json = JSON.stringify(Object.fromEntries(this.names), null, 2);
    if (json === this.lastNames) return;
    this.lastNames = json;
    await fs.mkdir(MORADORES_DIR, { recursive: true });
    await fs.writeFile(NAMES_FILE, json);
  }
}
