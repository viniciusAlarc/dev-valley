# O porão entrega valor? (análise de 25/11/2026)

> Pedido do usuário: antes de investir em melhorias do porão (worktree, fila de testes, tarefa de integração), saber
> se ele economiza tempo, quanto custa a mais em tokens, se é consistente e se perde o que o usuário pediu no caminho
> do pedido ao briefing. Comparado com a alternativa: uma sessão só, que paraleliza sozinha o que julgar seguro.
> Estudo de fundo: `docs-dev/context/execucao-paralela-estudo.md`.

## 1. Histórico das rodadas reais

Dados: `rodada.json`, briefings e devolutivas de todas as rodadas; tokens só das rodadas de 19 e 20/11 (as conversas
de antes de 12/11 e as de 17/11 não estão mais no disco). Tokens em "equivalente de entrada" (pesos de preço do Opus:
leitura de cache 0,1, escrita de cache 1,25, saída 5), incluindo os subagentes de cada sessão.

| Rodada | Tarefas | Relógio | Soma das sessões | Fator | Tokens (equiv.) |
|---|---|---|---|---|---|
| 11/11 (a) | 3 de 5 prontas | 15 min | 42 min | 2,7× | conversa apagada |
| 17/11 | 4 | 87 min | 233 min | 2,7× | conversa apagada |
| 19/11 | 5 | 102 min | 265 min | 2,6× | 31,6 M |
| 20/11 | 3 | 61 min | 174 min | 2,9× | 12,8 M |

- **Tempo:** o relógio da máquina foi ~2,7× mais curto que a soma das sessões. Não entram nessa conta o tempo do
  usuário (aprovar o cartão, destravar sessões, aplicar à mão o que foi recusado) nem a rodada seguinte que terminou o
  trabalho.
- **Tokens:** as duas rodadas medidas somam 44 M, ~37% de tudo o que as sessões pesadas daquele projeto gastaram no
  período. Cada sessão carrega o projeto do zero e abre os próprios subagentes (até 22 arquivos de subagente numa
  sessão). Em 19/11 as 4 sessões em Opus **esgotaram o limite do plano juntas**: uma estourou o contexto, as outras
  receberam "feche com a menor entrega que funcione", a quinta tarefa ficou para depois, uma tarefa saiu sem `/revisar`,
  e foi preciso a rodada de 20/11 para terminar.
- **Fidelidade:** das 14 restrições explícitas do pedido de 19/11, as que se aplicavam chegaram aos briefings (só
  faltaram, na tarefa do esqueleto, itens que não se aplicavam a ela). Os briefings apontam a spec em vez de resumi-la.
  Os 11 achados da revisão de 20/11 eram requisitos que estavam na spec apontada: erro de implementação, o mesmo tipo
  que aparece no `RETRABALHO.md` das sessões diretas, e não perda no briefing.
- **Atrito recorrente:** banco local lotado pelas sessões juntas ("too many clients"), suítes quebradas pelo código pela
  metade de outra tarefa, build quebrado por arquivo que outra sessão ainda escrevia, arquivos de ponto de encontro
  (painel, índice do a-codar) recusados e devolvidos como "texto para aplicar à mão".

## 2. Teste próprio (25/11/2026)

Projeto de mentira (Node, sem dependências, com registro de rotas e menu como pontos de encontro), pedido com
restrições sutis espalhadas (mensagens exatas, ordem do menu, formato da multa, prazo que não pode mudar com o fuso,
CPF mascarado, uma feature que altera outra) e testes de aceite escondidos das sessões, validados antes por uma solução
de referência. Sessões isoladas da vila (`claude -p --setting-sources project`). Custo = equivalente de API informado
pelo próprio Claude Code.

- **A:** uma sessão recebe o pedido inteiro e decide sozinha se paraleliza.
- **B (porão):** maestro (Opus) lê o pedido e escreve cartão e briefings com o modelo do maestro real; sessões (Sonnet)
  leem só o briefing e rodam em paralelo na mesma pasta, respeitando o `dependeDe`.

| Tamanho | Braço | Relógio | Custo | Aceite |
|---|---|---|---|---|
| 3 features | A Sonnet (×2) | 77 e 103 s | US$ 0,28 e 0,25 | 19/19 |
| | A Opus | 114 s | US$ 0,56 | 19/19 |
| | B (×2) | 135 e 131 s | US$ 0,86 e 0,87 | 19/19 |
| 6 features | A Sonnet (×2) | 135 e 133 s | US$ 0,46 e 0,43 | 33/33 |
| | A Opus | 180 s | US$ 0,86 | 33/33 |
| | B (×2) | 203 e 212 s | US$ 1,32 e 1,39 | 33/33 |

- **Ninguém perdeu requisito**, nem a armadilha do fuso nem a feature cruzada (o maestro pôs empréstimos e reservas
  na mesma tarefa, e fez dos pontos de encontro uma tarefa 0).
- **O porão foi mais lento nos dois tamanhos.** O que é serial (maestro ~72 a 109 s + tarefa 0) come o ganho da fase
  paralela, que foi real (a maior sessão paralela levou 33 a 69 s contra 133 s da sessão única).
- **Custo ~3× o da sessão única em Sonnet** e ~1,6× o da sessão única em Opus; o maestro sozinho é ~40% do custo do porão.
- **A sessão única nunca abriu subagente** (0 em 6 execuções): o paralelismo nativo, na prática, não paraleliza escrita.

Limites: o teste é pequeno (tarefas de segundos, não de uma hora), 2 repetições por braço, um tipo de projeto. Ele mede
bem o custo fixo e a fidelidade, e mal o ganho de relógio em lote grande, que o histórico mede melhor.

## 3. Conclusão

1. **O ganho de tempo existe e só aparece em lote grande:** 3 a 5 tarefas independentes de ~1 h cada dão ~2,7× no
   relógio. Abaixo de ~30 min por tarefa, o custo fixo (maestro, tarefa 0, cada sessão relendo o projeto) faz o porão
   perder até no relógio.
2. **O preço é alto e concentrado:** 1,6× a 3× os tokens da sessão única, gastos ao mesmo tempo. No plano por
   assinatura isso vira o pior modo de falha: o limite acaba no meio da rodada e o ganho de tempo vira trabalho parado
   e rodada extra.
3. **Fidelidade não é o problema:** nem no histórico nem no teste o briefing perdeu requisito. O cuidado que funciona
   é o briefing apontar a fonte em vez de resumi-la.
4. **Os problemas reais são de ambiente e coordenação** (banco, build, código pela metade de outra tarefa, pontos de
   encontro, tempo do usuário destravando sessões), e cada um pede mecanismo novo para ser resolvido.
5. **A alternativa "sessão única que paraleliza sozinha" é, na prática, sessão sequencial**, com subagentes para
   leitura e revisão. Ela custa menos, não disputa ambiente e o usuário conversa com uma sessão só; perde no relógio
   apenas quando há várias horas de trabalho independente.

**Recomendação (revisada no mesmo dia, com o usuário):** o porão vira o **modo início de sprint** e só isso. O
usuário mostrou o caso em que ele ganhou de verdade: pedir a sprint inteira no primeiro dia, receber uma entrega
gigante em horas e usar o resto da sprint para estudar e revisar. Faz sentido porque:

- o ganho é **antecipar a entrega**, não economizar máquina; o gargalo é a revisão humana, e ela ganha a sprint inteira;
- no plano por assinatura o token custa **limite**, e no começo da sprint o limite está cheio e nada mais disputa;
- o pré-requisito existia: specs prontas e pedido detalhado (por isso o briefing não perdeu nada).

O que esse modo cobra e como se paga:

- limite esgotado no meio → sessões em Sonnet e no máximo 3 ao mesmo tempo (ondas);
- ambiente disputado → fila de testes da rodada;
- tarefa duplicada → posse por sessão;
- entrega grande difícil de revisar → revisar por tarefa (commit, `/revisar` e roteiro de cada uma), começando pela
  tarefa 0 e pelas de base, e integrar cedo o que já foi revisado.

Plano das três correções em `docs-dev/context/porao-modo-sprint.md` (MS-1). Fora do modo sprint, o padrão é a sessão
única. Worktree, tarefa de integração e cartão de lacuna continuam fora.
