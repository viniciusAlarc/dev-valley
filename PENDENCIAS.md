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
| DS-1 | 👤 | Conta **DeepSeek pessoal** sem saldo: a chamada de teste de 24/11 respondeu `402 Insufficient Balance`. Até recarregar, casa pessoal aberta nela abre (a chave está preenchida) mas não responde. | 2026-11-24 |

## P3 — Médio

| ID | Dono | Item | Aberto em |
|---|---|---|---|

## P4 — Baixo / melhoria

| ID | Dono | Item | Aberto em |
|---|---|---|---|
| MS-1 | 👤 | Porão no modo início de sprint (decisão do usuário, 25/11/2026): P1 posse por sessão, P2 fila de testes da rodada (`testar.sh` com `flock`), P3 até 3 sessões ao mesmo tempo. **Codado em 25/11/2026**; falta reiniciar a vila e conferir numa rodada de início de sprint (anotar tokens, relógio, achados e retrabalho, como em `docs-dev/context/porao-modo-sprint.md`). | 2026-11-25 |
| EC-1 | 👤 | Limpeza do ecossistema de IA (24/11/2026). Feitos os Blocos 1 e 2 e os itens 11, 12 e 13 do Bloco 3; tudo espera a revisão do usuário. Decidir: o futuro do porão ficou decidido em 25/11 (modo início de sprint, MS-1; `docs-dev/context/porao-vale-a-pena.md`); worktree (MA-4) fica fora, item 14 (sessões curtas: aviso de contexto pelo mod?). Recomendação de cada um em `docs-dev/context/limpeza-do-ecossistema.md`. | 2026-11-24 |
| EC-3 | 👤 | Bloco 4: o que pode ir para a DeepSeek. Hoje os agentes da vila que só leem (escrevente, jornaleiros, maestro mirim, crítico, bibliotecária, médica) mandam material da empresa ao provedor também nas casas de trabalho. Recomendação: conta dos agentes pela finalidade da casa (trabalho no Claude Haiku, pessoal na DeepSeek). `docs-dev/context/limpeza-do-ecossistema.md`. | 2026-11-25 |
| EC-4 | 🖥️ | Em ~02/12/2026, ler `~/.claude/guardrails-disparos.json`: avaliações bem abaixo das chamadas = guarda do `guardrails` sendo pulado (a sessão de 24/11 recebeu avisos de hooks pulados por `cc-plugin-sec-default`); guarda sem disparo no mês vai para o `/auditar-regras`. | 2026-11-25 |
| MC-1 | 👤 | Consolidador de memória: agente da vila que só lê `RETRABALHO.md`, memórias e `PENDENCIAS.md` e propõe numa caixa de entrada (retrabalho repetido, memória que contradiz regra, pendência velha); nunca aplica. Decidir onde mora, gatilho e o que o "aprovar" faz. `docs-dev/a-codar/consolidador-de-memoria.md`. | 2026-11-24 |
| AD-1 | 👤 | Reformular o ✦ administrador da praça: o usuário o acha pouco útil (21/11/2026). Desde a mesma data ele cuida só do sino (o quadro de avisos virou as notas do usuário). Conversar antes de qualquer código. | 2026-11-21 |
| RV-1 | 💻 | Revisor do pombal ("🔍 Revisar" antes de enviar, agente da vila só leitura e de contexto limpo). **Só depois de commitar a entrega de 08/11**, para validar à parte. Plano em `docs-dev/a-codar/revisor-pombal.md`. | 2026-11-08 |
| MA-5 | 👤 | Maestro v2 e v3 codados em 11/11 (v2: devolutiva em arquivo com hook `Stop`, posse de arquivo por hook, dependências no cartão, relatório montado pela vila, quadro da rodada, resume com as regras; v3: linha de base e gate rodados pela vila, aceite na devolutiva, "Custo e ganho" no relatório). Ensaio isolado do v3 feito (c8, reprovado). Falta: reiniciar a vila e conferir numa rodada de verdade pequena, com uma tarefa que depende de outra e comando de teste. `docs-dev/context/maestro-v2.md`, `docs-dev/context/maestro-v3.md`. | 2026-11-11 |
| CC-1 | 👤 | Crítica do cartão codada em 21/11 (DeepSeek Flash confere o cartão pelo checklist, Haiku verifica, só avisa). Falta: reiniciar a vila e conferir numa rodada de verdade; depois de ~5 rodadas, decidir se fica pelo `critica-<pedido>.json` de cada rodada. `docs-dev/context/critica-do-cartao.md`. | 2026-11-21 |
| QT-1 | 👤 | Quarto da casa codado em 21/11 (dormir/encerrar várias pela escrivaninha, quarto com camas, acorda ao abrir). Falta: reiniciar a vila e conferir (porta na sala, dormir uma sessão aberta e ver o processo sumir, acordar pela cama, encerrar em lote). Junto, o "Marcar todas" do sino | 2026-11-21 |
| CC-2 | 💻 | Conta por tarefa no cartão do porão (Sonnet ou Flash, critério no doc). Só depois de ~5 revisões medidas com o revisor DeepSeek da `/revisar` (`+ds` no METRICAS). `docs-dev/a-codar/conta-por-tarefa-no-porao.md`. | 2026-11-21 |
| MA-7 | 👤 | Maestro v3, Etapa 3 (não codar agora): revisor de contexto limpo por risco (R8) e orçamento com critério de morte (R11). Só vira plano quando existirem os relatórios de 3 rodadas reais medidas (seção "Custo e ganho"). `docs-dev/context/maestro-v3.md`. | 2026-11-11 |
| PP-6 | 💻 | Limites do plano (canto da tela, clínica e moinho) guardam um único `usage`; se uma sessão DeepSeek reportar `rate_limits`, ela sobrescreve os números do Claude. Separar por conta/provedor só se aparecer (a API do DeepSeek normalmente não manda esse campo). `docs-dev/context/torre-do-relogio.md`. | 2026-11-19 |
| AG-1 | 👤 | Conferir na vila as respostas dos agentes na conta DeepSeek trabalho (formato de uma linha do escrevente, citações da bibliotecária, tom do jornaleiro) e as etiquetas de conta na Fábrica; decidir se o maestro do porão também muda de conta. `docs-dev/context/perfil-pessoal.md` (D15). | 2026-11-19 |
