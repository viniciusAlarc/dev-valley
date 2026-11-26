---
paths:
  - "server/src/porao.ts"
  - "server/src/rodada.ts"
  - "server/src/gate.ts"
  - "server/src/relatorios.ts"
  - "server/src/critico.ts"
  - "server/src/mirim.ts"
  - "scripts/porao-hook.sh"
  - "web/src/game/PoraoScene.ts"
  - "web/src/ui/porao.ts"
  - "docs-dev/context/maestro*.md"
---

# Regra 10 do CLAUDE.md, por inteiro: o porão (maestro)

Sessão de trabalho do porão (`server/src/porao.ts`) só nasce de uma tarefa que o usuário aprovou no cartão.

- O maestro pede pela rota (`curl` local), mas aprovar e recusar exigem `Origin` local presente (a página), nunca só a
  ausência dele.
- O clique aprova a rodada inteira: a tarefa com `dependeDe`, listada no cartão, a vila abre sozinha quando as donas
  ficam prontas; nenhuma tarefa fora do cartão abre (decisão do usuário, 11/11/2026).
- Teto de 5 sessões por rodada (o config só baixa; conta também as que esperam a vez; o padrão de 3 é só do agente, a
  rota aceita até 5), e cada sessão é anotada no `porao.json` antes de o terminal abrir (decisão do usuário,
  03/11/2026).
- **Modo início de sprint (decisão do usuário, 25/11/2026, `docs-dev/context/porao-modo-sprint.md`):** no máximo
  `porao.simultaneas` sessões da rodada abertas ou abrindo ao mesmo tempo (padrão 3, até 5; o resto abre em ondas, na
  volta automática); a suíte de teste roda só pela fila da rodada (`<rodada>/testar.sh <n>`, `flock` em
  `<rodada>/testes.lock`, a mesma trava do gate), e o hook recusa a suíte crua; a posse confere a **sessão** registrada
  da tarefa, não só o nome.
- A vila conduz a rodada pelo `rodada.json` (`server/src/rodada.ts`, único escritor: a vila) e passa às sessões de
  trabalho, só a elas e por `--settings`, os hooks de `scripts/porao-hook.sh` (devolutiva ao parar, posse de arquivo)
  e o `DEV_VALLEY_TAREFA` que o `testar.sh` lê.
- **Gate (maestro v3, `server/src/gate.ts`):** a vila roda os comandos de teste do cartão (os que passaram por
  `validarPermissoes`), sem shell, antes de abrir as sessões (linha de base) e com todas prontas, antes do relatório;
  saída só em arquivo da pasta da rodada, nunca no `rodada.json`. Gate vermelho só avisa (relatório "Reprovada" e ❗ na
  estante): nenhuma sessão é reaberta (decisão do usuário, 11/11/2026).
- A sessão do roteiro de testes (uma por rodada, pedida pela vila quando uma devolutiva diz `mexeu_em_tela: sim`)
  também só nasce do clique, mas na **casa**: não é anotada, não conta no teto e o gongo não a apaga (decisão do
  usuário, 05/11/2026).
