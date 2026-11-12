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

## P4 — Baixo / melhoria

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| RV-1 | 💻 | Revisor do pombal ("🔍 Revisar" antes de enviar, agente da vila só leitura e de contexto limpo). **Só depois de commitar a entrega de 08/11**, para validar à parte. Plano em `docs-dev/a-codar/revisor-pombal.md`. | 2026-11-08 |
| MA-5 | 👤 | Maestro v2 e v3 codados em 11/11 (v2: devolutiva em arquivo com hook `Stop`, posse de arquivo por hook, dependências no cartão, relatório montado pela vila, quadro da rodada, resume com as regras; v3: linha de base e gate rodados pela vila, aceite na devolutiva, "Custo e ganho" no relatório). Ensaio isolado do v3 feito (c8, reprovado). Falta: reiniciar a vila e conferir numa rodada de verdade pequena, com uma tarefa que depende de outra e comando de teste. `docs-dev/context/maestro-v2.md`, `docs-dev/context/maestro-v3.md`. | 2026-11-11 |
| MA-4 | 👤 | Ideia, não decidida: uma worktree por sessão do porão, para tarefas no mesmo arquivo rodarem juntas. Só se as rodadas começarem a travar por conflito de arquivo (08/11: complexidade alta, conflito volta ao usuário). | 2026-11-08 |
| MA-7 | 👤 | Maestro v3, Etapa 3 (não codar agora): revisor de contexto limpo por risco (R8) e orçamento com critério de morte (R11). Só vira plano quando existirem os relatórios de 3 rodadas reais medidas (seção "Custo e ganho"). `docs-dev/context/maestro-v3.md`. | 2026-11-11 |
