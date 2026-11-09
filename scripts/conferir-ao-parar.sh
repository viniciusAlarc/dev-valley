#!/usr/bin/env bash
# Hook `Stop` do Dev Valley (.claude/settings.json): antes de a sessão entregar a resposta, confere os tipos do
# servidor e do front. Com erro, sai com 2 e o Claude Code devolve o erro à sessão, que corrige antes de parar
# (guardrail G4 cobrado pelo harness, não pela lembrança; decisão do usuário, 08/11/2026).
#
# Só roda para a sessão que editou .ts deste repositório (consulta de agente da vila e sessão que só leu passam
# direto) e só quando o código mudou desde a última conferência que passou (a marca fica em .git/).

set -u
entrada=$(cat)
raiz=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd) || exit 0

# Segunda volta do mesmo fim de turno: não prende a sessão num laço.
[ "$(jq -r '.stop_hook_active // false' <<<"$entrada")" = true ] && exit 0

conversa=$(jq -r '.transcript_path // empty' <<<"$entrada")
[ -n "$conversa" ] && [ -f "$conversa" ] || exit 0
grep -E '"name":"(Edit|Write|MultiEdit)"' "$conversa" | grep -qE "\"file_path\":\"$raiz/(server|web|mod)/[^\"]*\\.tsx?\"" || exit 0

# Impressão do código como está: diff dos .ts rastreados + .ts novos ainda sem git.
marca="$raiz/.git/dev-valley-conferido"
impressao=$({
  git -C "$raiz" diff HEAD -- '*.ts' '*.tsx'
  git -C "$raiz" ls-files -o --exclude-standard -- '*.ts' '*.tsx' | while read -r f; do cat "$raiz/$f"; done
} | sha1sum | cut -d' ' -f1)
[ -f "$marca" ] && [ "$(cat "$marca")" = "$impressao" ] && exit 0

if ! saida=$( (cd "$raiz" && npm run typecheck -w server) 2>&1 && (cd "$raiz/web" && npx tsc --noEmit) 2>&1); then
  {
    echo "Conferência ao parar (Dev Valley): a checagem de tipos falhou. Corrija antes de encerrar a resposta."
    grep -E 'error TS' <<<"$saida" | head -20
  } >&2
  exit 2
fi
echo "$impressao" >"$marca"
exit 0
