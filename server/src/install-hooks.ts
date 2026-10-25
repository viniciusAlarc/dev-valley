/**
 * Instala (ou remove, com --uninstall) os hooks do Dev Valley em ~/.claude/settings.json.
 * Só acrescenta entradas marcadas com MARKER — hooks que você já tem ficam intactos.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookCommand, MARKER, statusLineCommand } from './claude-commands.js';
import { loadConfig } from './config.js';

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

console.log(
  uninstall
    ? '🧹 Hooks e status line do Dev Valley removidos.'
    : `🔔 Hooks do Dev Valley instalados em ${SETTINGS} (${EVENTS.length} eventos).${statusLineNote}\n   Backup: ${SETTINGS}.bak-dev-valley\n   Vale para sessões novas ou reabertas.`,
);
