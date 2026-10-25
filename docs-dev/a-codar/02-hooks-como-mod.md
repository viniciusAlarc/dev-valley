# Hooks e status line como mod do Claude Code

> Decisão do usuário em 25/10/2026 (fecha a PD-1; G7). Ao implementar: registrar no `PROGRESS.md`,
> fechar a PD-11 e tirar este arquivo do índice.

## Decisão (25/10/2026)

Os hooks e a status line do Dev Valley saem do `~/.claude/settings.json` e passam a ser um mod do Claude Code,
pelo mesmo caminho do mod guardrails.

## Ainda não decidido (perguntar antes de codar, G2)

- O que acontece com o `npm run hooks:install` / `hooks:uninstall` (somem, ou passam a instalar o mod).
- Como a status line do Dev Valley convive com a do mod guardrails (o `guardrails ✓` tem que continuar visível; PD-2
  conferiu que hoje aparece).
- Se o agente da bibliotecária continua instalado em `~/.claude/agents` ou vai junto no mod.

As regras 3 e 4 do `CLAUDE.md` (o que os hooks mandam à vila, e o que o install pode tocar) continuam valendo.
