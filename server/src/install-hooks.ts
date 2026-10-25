/**
 * Instala (ou remove, com --uninstall) os hooks do Dev Valley em ~/.claude/settings.json.
 * Só acrescenta entradas marcadas com MARKER — hooks que você já tem ficam intactos.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookCommand, MARKER, statusLineCommand } from './claude-commands.js';
import { CATALOG_PATH } from './catalog.js';
import { loadConfig, ROOT_DIR } from './config.js';

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Notification', 'Stop', 'SessionEnd'];
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

interface HookEntry {
  matcher?: string;
  hooks: { type: string; command: string; timeout?: number }[];
}

const isOurs = (entry: HookEntry) => entry.hooks?.some((h) => h.command?.includes(MARKER));

const uninstall = process.argv.includes('--uninstall');
const exists = fs.existsSync(SETTINGS);
const settings = exists ? JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) : {};
if (exists) fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-dev-valley`);

const hooks: Record<string, HookEntry[]> = settings.hooks ?? {};
for (const event of Object.keys(hooks)) {
  hooks[event] = hooks[event].filter((e) => !isOurs(e));
  if (!hooks[event].length) delete hooks[event];
}
if (!uninstall) {
  const cmd = hookCommand(loadConfig().port);
  for (const event of EVENTS) {
    const entry: HookEntry = { hooks: [{ type: 'command', command: cmd, timeout: 3 }] };
    if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PermissionRequest') entry.matcher = '*';
    (hooks[event] ??= []).push(entry);
  }
}
settings.hooks = hooks;
if (!Object.keys(hooks).length) delete settings.hooks;

const ourStatusLine = !!settings.statusLine?.command?.includes(MARKER);
let statusLineNote = '';
if (uninstall) {
  if (ourStatusLine) delete settings.statusLine;
} else if (!settings.statusLine || ourStatusLine) {
  settings.statusLine = { type: 'command', command: statusLineCommand(loadConfig().port), padding: 0 };
  statusLineNote = '\n   Status line instalado: contexto e uso do plano chegam à vila.';
} else {
  statusLineNote = '\n   ⚠ Você já tem um status line próprio — mantive o seu. Sem ele, a vila não recebe contexto exato nem uso do plano.';
}
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');

// ---- Agentes permanentes (NPCs especiais) ----
const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');
const AGENT_MARKER = '<!-- dev-valley:';
let agentNote = '';
for (const file of fs.readdirSync(path.join(ROOT_DIR, 'server', 'agents'))) {
  const target = path.join(AGENTS_DIR, file);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  // Um agente com o mesmo nome criado por você nunca é sobrescrito nem apagado.
  if (existing !== null && !existing.includes(AGENT_MARKER)) {
    agentNote += `\n   ⚠ ${target} já existe e não é do Dev Valley — mantive o seu.`;
    continue;
  }
  if (uninstall) {
    if (existing !== null) fs.rmSync(target);
    continue;
  }
  const content = fs.readFileSync(path.join(ROOT_DIR, 'server', 'agents', file), 'utf8').replaceAll('{{CATALOGO}}', CATALOG_PATH);
  fs.mkdirSync(AGENTS_DIR, { recursive: true });
  fs.writeFileSync(target, content);
  agentNote += `\n   Agente instalado: ${target}`;
}

console.log(
  uninstall
    ? `🧹 Hooks, status line e agentes do Dev Valley removidos.${agentNote}`
    : `🔔 Hooks do Dev Valley instalados em ${SETTINGS} (${EVENTS.length} eventos).${statusLineNote}${agentNote}\n   Backup: ${SETTINGS}.bak-dev-valley\n   Vale para sessões novas ou reabertas.`,
);
