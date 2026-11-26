---
paths:
  - "mod/**"
  - "server/src/hooks.ts"
  - "server/src/claude-commands.ts"
  - "server/src/install-hooks.ts"
  - "server/src/gasto.ts"
---

# Regra 3 do CLAUDE.md, por inteiro: o que o mod manda à vila

O mod (`mod/`) e os hooks de permissão mandam à vila **só**:

- `session_id`, `cwd`, nome do evento e tipo de notificação;
- a categoria da ferramenta em uso (`ler`, `editar`, `rodar`, `web`, `agente`): ela desenha o balão de quem trabalha e
  nunca leva o nome da ferramenta, o arquivo nem o comando (decisão do usuário, 08/11/2026);
- os ids das sessões citadas com `@Nome`, que servem aos NPCs conversando (decisão do usuário, 30/10/2026);
- e contexto/limites no `/api/statusline`.

Nunca conteúdo de arquivo ou prompt, nem o nome digitado: o prompt é lido **só localmente**, para achar `@Nome` no
mapa `~/.claude/dev-valley/moradores.json`. O teste `mod/tests/dev-valley.test.ts` confere isso.
