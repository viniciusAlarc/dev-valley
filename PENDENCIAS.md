# Dev Valley — Pendências

> Rastreador **único** (guardrail G6). Se está aberto, está aqui.
> Se não está aqui, não está aberto. Item resolvido sai da lista (o registro fica no PROGRESS.md).

**Dono:** 👤 decisão do usuário · 💻 código · 🖥️ servidor/infra

## P1 — Crítico (bloqueia uso ou expõe dado)

| ID | Dono | Item | Aberto em |
|---|---|---|---|

## P2 — Alto (retrabalho garantido se ignorado)

| ID | Dono | Item | Aberto em |
|---|---|---|---|

## P3 — Médio

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-10 | 💻 | Permitir/negar pelo balão do morador na vila, mantendo o terminal: o hook `PermissionRequest` responde `hookSpecificOutput.decision.behavior` (`allow`/`deny`), conferido na doc em 29/10/2026. A conferir no plano: se o diálogo do terminal aparece junto enquanto o hook espera, e o `timeout` do hook. Substitui a PD-5 (chat via Agent SDK), descartada pelo usuário em 29/10/2026 para não perder o Claude Code de verdade (slash commands, skills, mod) | 2026-10-29 |

## P4 — Baixo / melhoria

> Ordem decidida pelo usuário em 29/10/2026: PD-8 (testes) e depois PD-6 (tileset).

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-8 | 💻 | Suíte de testes automatizada. **Em andamento:** passos 1 e 2 feitos (`npm test`, 67 testes, as 37 rotas HTTP); próximo: pombal (passo 3), depois decidir o CI (passo 4), depois pombal (passo 3) e decidir o CI (passo 4). Plano em `docs-dev/a-codar/testes-automatizados.md` | 2026-10-25 |
| PD-6 | 💻 | Trocar a pixel art gerada em código por um tileset de verdade. Depois da PD-8 | 2026-10-24 |
