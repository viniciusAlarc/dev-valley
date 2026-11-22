#!/usr/bin/env bash
# Hooks das sessões de trabalho do porão (maestro v2, docs-dev/context/maestro-v2.md, 11/11/2026). Chegam só a elas,
# pelo `--settings` que a vila passa no spawn (server/src/rodada.ts, settingsDaTarefa): nada no mod nem no global.
#
#   porao-hook.sh parar <pasta da rodada> <tarefa>   (Stop)
#     Sem a devolutiva, ou com ela sem os campos de lastro (lastro, fora_da_spec, revisao, 21/11/2026), sai com 2: o
#     Claude Code devolve o aviso à sessão, que grava antes de terminar. É lembrete,
#     não prisão: na segunda volta do mesmo fim de turno (stop_hook_active) passa direto, para a sessão poder parar e
#     perguntar algo ao usuário.
#
#   porao-hook.sh posse <pasta da rodada> <tarefa>   (PreToolUse em Edit/Write/MultiEdit/NotebookEdit)
#     Um arquivo do projeto tem uma dona por vez:
#     1. listado por outra tarefa que ainda trabalha ("aberta" ou "abrindo" no rodada.json): recusado;
#     2. senão, a primeira tarefa que o edita fica dona dele (reserva atômica em <rodada>/posse/) até ficar pronta:
#        cobre o arquivo que ninguém declarou (com o modo `auto`, edição fora da lista não pede permissão).
#     PROGRESS.md e PENDENCIAS.md não têm dona: todas somam.
#
#   porao-hook.sh bash <pasta da rodada> <tarefa>    (PreToolUse em Bash)
#     Recusa escrever arquivo pelo Bash (sed -i, > e >> para arquivo, tee, cp, mv, rm...) e o git que mexe no
#     repositório: a edição tem que passar pelo Edit/Write, onde a posse é conferida (rodada de 11/11/2026: as sessões
#     editavam com printf >> e sed -i, por fora do hook). Ler e rodar teste pelo Bash continua livre.

set -u
modo=${1:-}
dir=${2:-}
tarefa=${3:-}
entrada=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ -n "$dir" ] && [ -n "$tarefa" ] || exit 0

aberta() { # a tarefa $1 ainda trabalha?
  [ "$(jq -r --arg t "$1" '.tarefas[$t].estado // ""' "$dir/rodada.json" 2>/dev/null)" = aberta ] ||
    [ "$(jq -r --arg t "$1" '.tarefas[$t].estado // ""' "$dir/rodada.json" 2>/dev/null)" = abrindo ]
}

case "$modo" in
  parar)
    [ "$(jq -r '.stop_hook_active // false' <<<"$entrada")" = true ] && exit 0
    dev="$dir/devolutivas/$tarefa.md"
    if [ -s "$dev" ]; then
      # Lastro na spec (21/11/2026): a devolutiva diz de onde a entrega saiu, o que ficou fora da spec e a revisão.
      falta=''
      for campo in lastro fora_da_spec revisao; do
        grep -Eqi "^${campo}[[:space:]]*:" "$dev" || falta="$falta $campo"
      done
      [ -z "$falta" ] && exit 0
      {
        echo "Porão (Dev Valley): a devolutiva da $tarefa está sem:$falta."
        echo "Acrescente no cabeçalho de $dev (formato no contrato \"Sob o maestro\"; sem spec no projeto, \"não se aplica: <por quê>\")."
        echo "Se parou para perguntar algo ao usuário, só termine a resposta de novo."
      } >&2
      exit 2
    fi
    {
      echo "Porão (Dev Valley): a tarefa $tarefa ainda não tem a devolutiva."
      echo "Se terminou, grave $dir/devolutivas/$tarefa.md no formato do briefing (é ela que avisa a vila que você acabou)."
      echo "Se parou para perguntar algo ao usuário, só termine a resposta de novo."
    } >&2
    exit 2
    ;;
  posse)
    arq=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$entrada")
    [ -n "$arq" ] && [ -f "$dir/rodada.json" ] || exit 0
    arq=$(realpath -m -- "$arq")
    pasta=$(jq -r '.pasta // empty' "$dir/rodada.json" 2>/dev/null)
    pasta=${pasta%/}
    [ -n "$pasta" ] && [ "${arq#"$pasta"/}" != "$arq" ] || exit 0
    rel=${arq#"$pasta"/}
    case "$rel" in PROGRESS.md | PENDENCIAS.md) exit 0 ;; esac
    recusar() {
      echo "Porão (Dev Valley): $rel é da tarefa $1, que ainda está trabalhando. Não edite agora: siga com o resto e, se só faltar isso, diga na devolutiva (ficou_de_fora) o que ficou esperando $1." >&2
      exit 2
    }
    dona=$(jq -r --arg rel "$rel" --arg eu "$tarefa" '
      .tarefas | to_entries[]
      | select(.key != $eu and (.value.estado == "aberta" or .value.estado == "abrindo") and ((.value.arquivos // []) | any(.[]; . == $rel)))
      | .key' "$dir/rodada.json" 2>/dev/null | head -1)
    [ -n "$dona" ] && recusar "$dona"
    # Reserva: um arquivo por caminho, criado com noclobber (atômico: duas sessões ao mesmo tempo, só uma cria).
    mkdir -p "$dir/posse"
    reserva="$dir/posse/$(printf '%s' "$rel" | sed 's|/|__|g')"
    if ! (set -o noclobber; printf '%s\n' "$tarefa" >"$reserva") 2>/dev/null; then
      dono=$(head -1 "$reserva" 2>/dev/null)
      if [ -n "$dono" ] && [ "$dono" != "$tarefa" ]; then
        aberta "$dono" && recusar "$dono"
        printf '%s\n' "$tarefa" >"$reserva" # a dona anterior já terminou: passa para esta
      fi
    fi
    exit 0
    ;;
  bash)
    cmd=$(jq -r '.tool_input.command // empty' <<<"$entrada")
    [ -n "$cmd" ] || exit 0
    # Sem o que está entre aspas (texto de grep/echo com < ou >), sem 2>&1 e sem redirecionar para /dev/null.
    limpo=$(printf '%s' "$cmd" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g; s/[0-9]*>&[0-9-]+//g; s/&>>?[[:space:]]*\/dev\/null//g; s/[0-9]*>>?[[:space:]]*\/dev\/null//g")
    motivo=''
    if printf '%s' "$limpo" | grep -Eq '(^|[;&|(]|[[:space:]])(sed|perl)[[:space:]]([^;&|]*[[:space:]])?-(-in-place|[a-zA-Z]*i)'; then
      motivo='edição pelo sed/perl -i'
    elif printf '%s' "$limpo" | grep -Eq '>'; then
      motivo='escrita em arquivo com > ou >>'
    elif printf '%s' "$limpo" | grep -Eq '(^|[;&|(]|[[:space:]])(tee|cp|mv|rm|rmdir|truncate|install|ln|dd|touch|mkdir)([[:space:]]|$)'; then
      motivo='comando que cria, copia, move ou apaga arquivo'
    elif printf '%s' "$limpo" | grep -Eq '(^|[;&|(]|[[:space:]])git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(add|commit|stash|reset|checkout|switch|restore|clean|rebase|merge|push|pull|cherry-pick|revert|apply|am|rm|mv|tag|branch)([[:space:]]|$)'; then
      motivo='git que mexe no repositório (commit e cia. são do usuário, pelo pombal)'
    fi
    [ -z "$motivo" ] && exit 0
    echo "Porão (Dev Valley): recusado ($motivo). Aqui arquivo se edita só com as ferramentas Edit/Write, onde a vila confere de quem é cada arquivo (a devolutiva também: Write). Ler e rodar teste pelo Bash continua livre." >&2
    exit 2
    ;;
esac
exit 0
