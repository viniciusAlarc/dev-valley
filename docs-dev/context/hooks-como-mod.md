# Hooks e status line como mod do Claude Code

> Decisão do usuário em 25/10/2026 (fecha a PD-1); implementado em 26/10/2026 (PD-11). Saiu de `docs-dev/a-codar/`
> ao fechar (G7) e fica aqui como registro das decisões.

## Decisão (25/10/2026)

Os hooks e a status line do Dev Valley saem do `~/.claude/settings.json` e passam a ser um mod do Claude Code,
pelo mesmo caminho do mod guardrails.

## Decisões de 26/10/2026 (fecham as perguntas abertas)

- **`npm run hooks:install` / `hooks:uninstall` passam a instalar e remover o mod** (mesmo comando de sempre): tiram os
  hooks de shell e a status line antigos do `settings.json` e rodam `claude plugin marketplace add` + `claude plugin
  install`, como o `instalar.sh` do `~/Documents/IA` faz com o guardrails.
- **Status line:** cada mod tem a própria entrada no rodapé (`$.ui.status`), então a do Dev Valley e o
  `guardrails ✓` aparecem lado a lado; o `statusLine` do `settings.json` deixa de ser usado pela vila.
- **A bibliotecária fica em `~/.claude/agents`**, como hoje: ela roda via `claude -p` e não é escopo desta pendência.

## Descoberta e decisão (26/10/2026): híbrido

Na primeira instalação o mod usava os eventos `classic.*` (os mesmos dos hooks de shell). Numa sessão real, todos foram
pulados: um plugin de segurança do Claude Code (`cc-plugin-sec-default`) roda acima dos mods de usuário e passa esses
eventos adiante por cima deles. Só o rodapé (`session.measure`, nativo) funcionou. Os eventos nativos não são pulados
(o mod guardrails usa só nativos). Mas nenhum evento nativo diz quando o **diálogo de permissão** abre (o `tool.call`
envolve a ferramenta inteira, diálogo incluído). Decisão do usuário: **híbrido**: o mod faz tudo com eventos nativos, e
só `PermissionRequest` e `Notification` continuam como hook de shell (`jq` + `curl`) no `settings.json`.

| Hoje | Onde |
|---|---|
| Abriu | mod, `session.start` |
| "Você é o morador X" | mod, `prompt.submit` (campo `context` da primeira mensagem; o `prompt.compose` também é pulado) |
| Mensagem + `@Nome` | mod, `prompt.submit` (campo `context`); pede o nome se a sessão ainda não tem (depois de `/clear`) |
| Ferramenta (antes/depois) | mod, `tool.call` |
| Esperando o usuário | mod, `turn.complete` da conversa principal |
| Encerrou | mod, `session.end` |
| Pedindo permissão | hook de shell `PermissionRequest` / `Notification` |
| Status line | mod, `session.measure` + `$.ui.status` |

As regras 3 e 4 do `CLAUDE.md` (o que os hooks mandam à vila, e o que o install pode tocar) continuam valendo.
