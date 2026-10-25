/**
 * Instala (ou remove, com --uninstall) os hooks do Dev Valley em ~/.claude/settings.json.
 * Só acrescenta entradas marcadas com MARKER — hooks que você já tem ficam intactos.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.js';

const MARKER = '# dev-valley';
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Notification', 'Stop', 'SessionEnd'];
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

interface HookEntry {
  matcher?: string;
  hooks: { type: string; command: string; timeout?: number }[];
}

const isOurs = (entry: HookEntry) => entry.hooks?.some((h) => h.command?.includes(MARKER));

function command(port: number) {
  // Manda só os campos de que a vila precisa; se ela estiver fechada, falha em silêncio.
  return (
    `jq -c '{session_id, cwd, hook_event_name, notification_type, message}' | ` +
    `curl -s -m 1 -X POST -H 'Content-Type: application/json' --data-binary @- http://127.0.0.1:${port}/api/hooks ` +
    `>/dev/null 2>&1; exit 0 ${MARKER}`
  );
}

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
  const cmd = command(loadConfig().port);
  for (const event of EVENTS) {
    const entry: HookEntry = { hooks: [{ type: 'command', command: cmd, timeout: 3 }] };
    if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PermissionRequest') entry.matcher = '*';
    (hooks[event] ??= []).push(entry);
  }
}
settings.hooks = hooks;
if (!Object.keys(hooks).length) delete settings.hooks;
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');

console.log(
  uninstall
    ? '🧹 Hooks do Dev Valley removidos.'
    : `🔔 Hooks do Dev Valley instalados em ${SETTINGS} (${EVENTS.length} eventos).\n   Backup: ${SETTINGS}.bak-dev-valley\n   Vale para sessões novas ou reabertas.`,
);
