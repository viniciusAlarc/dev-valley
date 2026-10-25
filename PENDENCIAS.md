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
| PD-2 | 👤 | Conferir numa sessão nova no WSL se a status line ainda mostra `guardrails ✓` junto com a do Dev Valley. Se sumiu, o canário do mod guardrails ficou escondido | 2026-10-25 |
| PD-3 | 👤 | Rodar `npm run hooks:install` de novo no WSL para instalar a bibliotecária com a descrição nova (não proativa) | 2026-10-25 |

## P3 — Médio

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-1 | 👤 | Decidir se hooks e status line saem do `~/.claude/settings.json` e viram um mod do Claude Code (mesmo caminho do mod guardrails) | 2026-10-25 |
| PD-4 | 💻 | Fábrica: criar e editar agentes em `.claude/agents` | 2026-10-24 |
| PD-5 | 💻 | Chat próprio via Claude Agent SDK, com pedidos de permissão em caixas de diálogo | 2026-10-24 |
| PD-10 | 💻 | Representações visuais, passo 4: diário do progresso (`docs-dev/a-codar/01-representacoes-visuais.md`) | 2026-10-25 |

## P4 — Baixo / melhoria

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| PD-6 | 💻 | Trocar a pixel art gerada em código por um tileset de verdade | 2026-10-24 |
| PD-7 | 👤 | Ligar o sistema da casa pela tabela "Subir" do `docs-dev/guias/OPERACAO.md` (formatos do G14, que todo projeto já tem) | 2026-10-25 |
| PD-8 | 💻 | Suíte de testes automatizada (hoje só typecheck + build + validação na vila) | 2026-10-25 |
| PD-9 | 🖥️ | CI no GitHub rodando `python3 scripts/auditar-referencias.py . --tudo` (o repo ainda não tem CI) | 2026-10-25 |
