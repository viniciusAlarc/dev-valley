---
paths:
  - "server/src/install-hooks.ts"
  - "server/src/claude-commands.ts"
  - "server/agents/**"
---

# Regra 4 do CLAUDE.md, por inteiro: o que o `hooks:install` pode tocar

- `npm run hooks:install` instala o mod (`claude plugin install`) e mexe em `~/.claude/settings.json` de cada conta
  (global, **com backup**) **só nas entradas do Dev Valley**: os hooks de shell de `PermissionRequest` e
  `Notification`, porque o mod não vê quando o diálogo de permissão abre.
- Nunca sobrescreve agente do usuário com o mesmo nome (agente sem a marca `<!-- dev-valley:` fica intocado).
- Dos agentes da vila, só a bibliotecária vai para `<conta>/agents`; os outros rodam pela vila (24/11/2026).
- O uninstall remove só o que é do Dev Valley.
