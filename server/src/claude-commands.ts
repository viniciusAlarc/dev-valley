/** Comandos de shell que o Claude Code executa para conversar com a vila (hooks e status line). */

export const MARKER = '# dev-valley';

export function hookCommand(port: number) {
  // Manda só os campos de que a vila precisa; se ela estiver fechada, falha em silêncio.
  return (
    `jq -c '{session_id, cwd, hook_event_name, notification_type, message}' | ` +
    `curl -s -m 1 -X POST -H 'Content-Type: application/json' --data-binary @- http://127.0.0.1:${port}/api/hooks ` +
    `>/dev/null 2>&1; exit 0 ${MARKER}`
  );
}

/**
 * Hook de nomes dos moradores (SessionStart e UserPromptSubmit): roda `server/hooks/morador.mjs` com o node que
 * rodou o install (o PATH do hook pode não ter o node do fnm). Trocou a versão do node: rodar o install de novo.
 */
export function moradorCommand(port: number, node: string, script: string) {
  return `'${node}' '${script}' ${port} 2>/dev/null; exit 0 ${MARKER}`;
}

/** Linha mostrada no rodapé de cada sessão do Claude Code: contexto e limites do plano. */
const STATUS_FORMAT = String.raw`["🌾 ctx \((.context_window.used_percentage // 0) | floor)%"] + (if .rate_limits.limits then [.rate_limits.limits[] | select(.kind == "session" or .kind == "weekly_all") | "\(if .kind == "session" then "5h" else "7d" end) \(.percent | floor)%"] else [(.rate_limits.five_hour // empty | "5h \(.used_percentage | floor)%"), (.rate_limits.seven_day // empty | "7d \(.used_percentage | floor)%")] end) | join(" · ")`;

export function statusLineCommand(port: number) {
  // Manda para a vila só contexto e limites (em segundo plano) e imprime a linha de status.
  return (
    `input=$(cat); ` +
    `printf '%s' "$input" | jq -c '{session_id, model: .model.id, context_window, rate_limits}' | ` +
    `curl -s -m 1 -X POST -H 'Content-Type: application/json' --data-binary @- http://127.0.0.1:${port}/api/statusline >/dev/null 2>&1 & ` +
    `printf '%s' "$input" | jq -r '${STATUS_FORMAT}' 2>/dev/null; exit 0 ${MARKER}`
  );
}
