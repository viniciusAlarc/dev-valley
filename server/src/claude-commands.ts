/**
 * Marca das entradas do Dev Valley no ~/.claude/settings.json: o `hooks:install` só tira ou repõe o que a leva.
 * Desde 26/10/2026 quase tudo é o mod em `mod/` (PD-11); ficam aqui só os hooks de shell que um mod de usuário não
 * consegue fazer (os eventos `classic.*` dele são pulados pelo plugin de segurança que roda acima).
 */
export const MARKER = '# dev-valley';

/** Eventos que continuam como hook de shell: o pedido de permissão (nenhum evento nativo de mod diz quando o diálogo abre). */
export const SHELL_EVENTS = ['PermissionRequest', 'Notification'];

export function hookCommand(port: number) {
  // Manda só os campos de que a vila precisa; se ela estiver fechada, falha em silêncio.
  return (
    `jq -c '{session_id, cwd, hook_event_name, notification_type, message}' | ` +
    `curl -s -m 1 -X POST -H 'Content-Type: application/json' --data-binary @- http://127.0.0.1:${port}/api/hooks ` +
    `>/dev/null 2>&1; exit 0 ${MARKER}`
  );
}
