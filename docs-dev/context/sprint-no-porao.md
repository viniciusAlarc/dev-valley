# Sprint no porão: do plano aos três documentos, com o fluxo visível na estante

> Decidido pelo usuário em 26/11/2026 (opção "direto na vila", em vez de só skills). Continua o MS-1
> (`docs-dev/context/porao-modo-sprint.md`), que deixou o porão no modo início de sprint; o MS-1 ainda não rodou numa
> sprint real, e a primeira sprint confere os dois juntos. Pendência SP-1 no `PENDENCIAS.md`.

**Status:** codado em 26/11/2026 (ver "Diferenças do plano" no fim); falta reiniciar a vila e conferir numa sprint real.

## O fluxo

```
1 Plano → 2 Código → 3 Testes → 4 Revisão → 5 Roteiro → 6 Estudo → 7 Guia
```

1. **Plano** (usuário + agente de sprint do projeto): `<pastaSprints>/<sprint>/plano.md`, um item por entrega, cada um
   com spec, "Pronto quando" e decisões fechadas. Item com decisão em aberto fica fora da sprint.
2. **Código:** o maestro lê o plano, agrupa em até 5 tarefas e pede a rodada com `sprint: "<id>"`. Cada sessão roda a
   `/revisar` na própria tarefa, como hoje. Em rodada de sprint, o roteiro por rodada não é pedido.
3. **Testes:** linha de base e gate da vila, como hoje.
4. **Revisão:** no fim da rodada de sprint, a vila põe na estante o cartão **"Fechar a sprint"** (no lugar do cartão
   do roteiro). O clique abre uma sessão na casa com `/fechar-sprint <relatório>`: revisão do código da sprint inteira
   (diferença desde o `commitInicial` da rodada) só com as lentes que atravessam tarefas (**conjunto, tenant-seguranca,
   tela**; spec e testes já rodaram por tarefa; decisão do usuário, 26/11/2026) e correção do que for confirmado.
5. a 7. **Documentos**, todos no mesmo molde visual: roteiro de testes no modo sprint (só navegação e visual, sem caso
   de erro: a revisão cobre; decisão do usuário, 26/11/2026), documento de estudo e guia da reunião.

## Contrato entre a vila e a sessão: arquivos na pasta da sprint

A vila **não** recebe recado da sessão de fechamento: sabe a etapa pelo que existe em `<pastaSprints>/<sprint>/`.

| Etapa | Pronta quando existe |
|---|---|
| Plano | `plano.md` |
| Código | todas as tarefas da rodada `pronta` |
| Testes | gate final terminado (verde ou vermelho, como no relatório) |
| Revisão | `revisao.md` |
| Roteiro | `roteiro.html` |
| Estudo | `estudo.html` |
| Guia | `guia.html` |

`pastaSprints` = `porao.pastaSprints` do config (padrão `docs-dev/sprints`), relativo ao projeto.

## O que muda na vila

- `POST /api/porao/pedidos` aceita `sprint` (mesmo formato do nome da rodada). Vai para o `rodada.json` junto com o
  `commitInicial` (HEAD do projeto no clique; sem git, fica sem).
- Fim de rodada com `sprint`: cartão "Fechar a sprint" (pedido de casa, como o do roteiro: fora do teto, sobrevive ao
  gongo, um por rodada). Primeira mensagem: `/fechar-sprint <relatório>`.
- Quadro da rodada na estante: rodada de sprint mostra as 7 etapas (✔ / ⏳) e o link de cada documento pronto.

## Fora da vila (repositório de regras e projeto)

- Molde visual dos três documentos (CSS único + montador), que o roteiro passa a usar.
- Skill `/fechar-sprint`; modo sprint no `/roteiro-testes` e no `/revisar`.
- Maestro: rodada de sprint a partir do `plano.md`. Agente de sprint do projeto: escreve plano, estudo e guia.

## Suposições e como conferi (26/11/2026)

- O fim da rodada tem um ponto só onde nasce o cartão do roteiro: **conferida** (`avancarUmaVez` → `pedirRoteiroDaVila`).
- O `rodada.json` não guarda o commit inicial: **conferida** (`server/src/rodada.ts`).
- As skills chegam à máquina por link para o repositório de regras: **conferida** (`~/.claude/skills/*`).
- A `/revisar` aguenta a diferença de uma sprint inteira: **conferida** na revisão de 20/11/2026 de uma sprint
  (`diff.patch` de 408 KB), que rodou as 6 lentes até o fim.

## Diferenças do plano (implementação de 26/11/2026)

- **Onde:** `etapasDaSprint` em `server/src/rodada.ts` (as 7 etapas, lidas a cada volta do `avancar`);
  `Porao.pedirFechamentoDaVila`, `TAREFA_FECHAR`, `promptDoFechamento` e `lerHead` em `server/src/porao.ts`;
  `porao.pastaSprints` em `server/src/config.ts` (`pastaSprintsValida`: relativo, sem `..`; o resto vira o padrão).
  Front: `openPedidoFecharSprint`, `htmlDaSprint` e `avisoDaSprintNoGongo` em `web/src/ui/porao.ts`; textos da estante
  e do cartão em `web/src/game/PoraoScene.ts`.
- **`commitInicial` só na rodada de sprint:** rodada comum não roda `git`; sem git (ou erro), a rodada segue sem base.
- **Gongo:** o quadro mostra só rodada não encerrada (como sempre). Rodada de sprint com etapa por fazer: o painel do
  gongo avisa que o quadro sai da estante; a sessão de fechamento é da casa e continua, e os documentos ficam na pasta.
- **Testes sem gate:** sem comando de teste no cartão, a etapa Testes fecha junto com o relatório. Gate reprovado
  fecha a etapa com ❗.
- **Molde e skills** (fora deste repositório): molde visual em `~/Documents/IA/claude/molde/`, skill `/fechar-sprint`,
  modo sprint em `/roteiro-testes` e `/revisar`, seção "Rodada de sprint" no agente `maestro`.
