/**
 * Instala (ou remove, com --uninstall) a integração do Dev Valley com o Claude Code:
 * - o mod `dev-valley` (pasta `mod/`, marketplace local na raiz do repo): eventos de sessão, rodapé, nomes e `@Nome`
 *   (decisão de 26/10/2026, PD-11);
 * - os hooks de shell que o mod não consegue fazer (SHELL_EVENTS: o pedido de permissão), no ~/.claude/settings.json;
 * - os agentes permanentes em ~/.claude/agents.
 * No settings.json só mexe no que é do Dev Valley (entradas marcadas com MARKER): hooks e status line que você já tem
 * ficam intactos.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookCommand, MARKER, SHELL_EVENTS } from './claude-commands.js';
import { CATALOG_PATH } from './catalog.js';
import { loadConfig, ROOT_DIR } from './config.js';
import { MORADORES_DIR } from './moradores.js';

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const MARKETPLACE = 'dev-valley';
const PLUGIN = `dev-valley@${MARKETPLACE}`;
/** Porta da vila para o mod (ele não lê o dev-valley.config.json, que mora no repo). */
const VILA_FILE = path.join(MORADORES_DIR, 'vila.json');

interface HookEntry {
  matcher?: string;
  hooks: { type: string; command: string; timeout?: number }[];
}

const isOurs = (entry: HookEntry) => entry.hooks?.some((h) => h.command?.includes(MARKER));
const claude = (...args: string[]) => execFileSync('claude', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const uninstall = process.argv.includes('--uninstall');
const notes: string[] = [];

// ---- settings.json: tira tudo o que é do Dev Valley e repõe só os hooks de permissão ----
if (fs.existsSync(SETTINGS)) {
  const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const before = JSON.stringify(settings);
  const hooks: Record<string, HookEntry[]> = settings.hooks ?? {};
  for (const event of Object.keys(hooks)) {
    hooks[event] = hooks[event].filter((e) => !isOurs(e));
    if (!hooks[event].length) delete hooks[event];
  }
  settings.hooks = hooks;
  if (!Object.keys(hooks).length) delete settings.hooks;
  if (settings.statusLine?.command?.includes(MARKER)) delete settings.statusLine;
  if (!uninstall) {
    const command = hookCommand(loadConfig().port);
    for (const event of SHELL_EVENTS) {
      const entry: HookEntry = { hooks: [{ type: 'command', command, timeout: 3 }] };
      if (event === 'PermissionRequest') entry.matcher = '*';
      (hooks[event] ??= []).push(entry);
    }
    settings.hooks = hooks;
  }
  if (JSON.stringify(settings) !== before) {
    fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-dev-valley`);
    fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
    const what = uninstall ? 'entradas do Dev Valley tiradas' : `só ${SHELL_EVENTS.join(' e ')} ficam como hook de shell`;
    notes.push(`${SETTINGS} atualizado: ${what} (backup: ${SETTINGS}.bak-dev-valley).`);
  }
}

// ---- o mod ----
const hasMarketplace = () => claude('plugin', 'marketplace', 'list').includes(`❯ ${MARKETPLACE}\n`);
const hasPlugin = () => claude('plugin', 'list').includes(`❯ ${PLUGIN}\n`);
if (uninstall) {
  if (hasPlugin()) claude('plugin', 'uninstall', PLUGIN, '--scope', 'user');
  if (hasMarketplace()) claude('plugin', 'marketplace', 'remove', MARKETPLACE);
  fs.rmSync(VILA_FILE, { force: true });
  notes.push('Mod dev-valley removido.');
} else {
  fs.mkdirSync(MORADORES_DIR, { recursive: true });
  fs.writeFileSync(VILA_FILE, JSON.stringify({ port: loadConfig().port }, null, 2) + '\n');
  if (!hasMarketplace()) claude('plugin', 'marketplace', 'add', ROOT_DIR);
  if (!hasPlugin()) claude('plugin', 'install', PLUGIN, '--scope', 'user');
  notes.push(`Mod ${PLUGIN} instalado (lido direto de ${path.join(ROOT_DIR, 'mod')}: editar lá vale na próxima sessão).`);
}

// ---- Agentes permanentes (NPCs especiais) ----
const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');
const AGENT_MARKER = '<!-- dev-valley:';
for (const file of fs.readdirSync(path.join(ROOT_DIR, 'server', 'agents'))) {
  const target = path.join(AGENTS_DIR, file);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  // Um agente com o mesmo nome criado por você nunca é sobrescrito nem apagado.
  if (existing !== null && !existing.includes(AGENT_MARKER)) {
    notes.push(`⚠ ${target} já existe e não é do Dev Valley — mantive o seu.`);
    continue;
  }
  if (uninstall) {
    if (existing !== null) fs.rmSync(target);
    continue;
  }
  const content = fs.readFileSync(path.join(ROOT_DIR, 'server', 'agents', file), 'utf8').replaceAll('{{CATALOGO}}', CATALOG_PATH);
  fs.mkdirSync(AGENTS_DIR, { recursive: true });
  fs.writeFileSync(target, content);
  notes.push(`Agente instalado: ${target}`);
}

console.log(
  `${uninstall ? '🧹 Integração do Dev Valley removida.' : '🔔 Integração do Dev Valley instalada.'}\n   ${notes.join('\n   ')}` +
    (uninstall ? '' : '\n   Vale para sessões novas ou reabertas (numa aberta: /reload-plugins).'),
);
