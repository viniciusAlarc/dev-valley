# Porão no modo início de sprint: fila de testes, posse por sessão e até 3 sessões ao mesmo tempo

> Decidido pelo usuário em 25/11/2026, depois da análise `docs-dev/context/porao-vale-a-pena.md`: o porão deixa de ser
> fluxo geral e vira o **modo início de sprint** (a sprint inteira numa rodada no primeiro dia; o resto da sprint é
> revisão). Só entra o que esse modo precisa. Pendência MS-1. **Implementado em 25/11/2026** (veja "Diferenças do
> plano" no fim); falta a rodada real de início de sprint.

## Por quê

Na rodada de sprint de 19/11 o ganho foi real (a entrega inteira em horas), e os tropeços foram três, todos medidos:

| Tropeço | Onde se viu | Parte deste plano |
|---|---|---|
| Suítes rodando juntas: banco local lotado ("too many clients"), pasta de build sujada, centenas de erros falsos | devolutivas de 11, 19 e 20/11 | P2 fila de testes |
| A mesma tarefa aberta duas vezes passou pela posse, porque a posse olha o nome da tarefa e não a sessão | rodada de 11/11 (`RETRABALHO.md`) | P1 posse por sessão |
| 4 sessões ao mesmo tempo esgotaram o limite do plano juntas; a rodada virou duas | rodada de 19/11 | P3 até 3 ao mesmo tempo |

Fica **fora** (decidido na mesma análise): worktree (MA-4), tarefa de integração no fim, cartão de lacuna a partir do
`ficou_de_fora`.

## P1 — Posse por sessão

**Hoje:** `scripts/porao-hook.sh`, modo `posse`, confere se o arquivo é de outra **tarefa**; a reserva em
`<rodada>/posse/` guarda o nome da tarefa. Duas sessões com o mesmo nome de tarefa são a mesma dona.

**Muda:** no começo dos modos `posse` e `bash`, o hook lê o `session_id` da entrada (JSON do PreToolUse) e compara com o
`sessionId` da tarefa no `rodada.json`. Diferente: recusa com saída 2 e a mensagem "esta sessão não é a sessão
registrada da tarefa <t>; pare e avise o usuário". Sem `session_id` na entrada ou sem `sessionId` no cartão, segue como
hoje (não trava rodada antiga).

**Teste:** `server/tests/rodada.test.ts` (onde o hook já é testado): a sessão registrada edita; outra
sessão com o mesmo nome de tarefa é recusada nos dois modos; entrada sem `session_id` passa.

## P2 — Fila de testes da rodada

**Hoje:** cada sessão roda os "Testes liberados" do briefing quando quer; com 3 a 5 sessões, as suítes se sobrepõem e
disputam banco, porta e pasta de build.

**Muda:**
1. A vila grava, ao abrir a rodada, `<rodada>/testar.sh`: recebe o índice do comando (`testar.sh 1`), roda o comando
   correspondente de `testes` da tarefa com `flock -w 1800 <rodada>/testes.lock`, a partir da pasta do projeto. O
   `flock` solta a trava sozinho quando o processo termina (sem trava esquecida se a sessão cair).
2. O briefing (modelo no `~/Documents/IA/claude/agents/maestro.md`) passa a dizer, em "Testes liberados", para rodar
   `bash <rodada>/testar.sh <n>`; o comando cru continua listado, para a sessão saber o que roda.
3. O hook, modo `bash`, recusa o comando de teste cru da rodada (o mesmo texto de um item de `testes`) com a mensagem
   "rode pela fila: bash <rodada>/testar.sh <n>". Teste focado fora da lista (um arquivo só) continua livre: é rápido e
   é o que a sessão mais usa enquanto trabalha.
4. A linha de base e o gate da vila (`server/src/gate.ts`) usam a mesma trava, para o gate nunca rodar junto com uma
   sessão atrasada.

**Teste:** duas chamadas de `testar.sh` ao mesmo tempo rodam em sequência (a segunda começa depois do fim da primeira,
conferido por horário gravado); comando cru recusado pelo hook; teste focado passa.

## P3 — Até 3 sessões ao mesmo tempo

**Hoje:** `tetoSessoes` (padrão 5, `server/src/config.ts`) conta **todas** as tarefas da rodada; as tarefas livres abrem
todas juntas.

**Muda:** o teto total continua 5 (cabe uma sprint em 5 tarefas). Entra um segundo número, `porao.simultaneas` (padrão
3, máximo 5): a volta automática (`Porao.avancar`) só abre tarefa livre enquanto houver menos de 3 abertas ou abrindo;
a que sobra espera a próxima volta, como as que esperam dependência. O cartão mostra "abre em ondas de até 3" quando a
rodada tem mais de 3 tarefas livres.

**Teste:** no `server/tests/porao-propriedades.test.ts`, a propriedade "nunca mais de `simultaneas` sessões abertas ao
mesmo tempo", com clique e volta automática em qualquer ordem (mesmo gerador que já reencontra a corrida de 11/11).

## Ordem

P1 → P2 → P3. P1 é a menor e fecha um buraco que já causou perda de trabalho; P2 é a que mais aparece nas devolutivas;
P3 depende de mexer no `avancar`, que já tem teste por propriedade.

## Suposições e como conferi (25/11/2026)

- A entrada do hook PreToolUse traz `session_id`: **não conferida no código do Claude Code**; o mod `dev-valley` já usa
  o `session_id` dos eventos. Conferir no começo da P1 gravando a entrada de um hook numa rodada de ensaio.
- A retomada mantém o id da sessão: **conferida** (`argsDoTerminal` em `server/src/terminals.ts` usa
  `--resume <sessionId>`).
- O `rodada.json` guarda `sessionId` e `testes` por tarefa: **conferido** (rodadas de 19 e 20/11).
- `flock` existe na máquina: **conferido** (`/usr/bin/flock`, util-linux). Projeto em outra máquina sem `flock`: o
  `testar.sh` roda sem fila e avisa.
- O "teto de 5" conta o total de tarefas, não as simultâneas: **conferido** (`Porao.pedir`, `server/src/porao.ts`).

## Arquivos

- `scripts/porao-hook.sh` (P1, P2.3), `server/src/rodada.ts` (`testar.sh`, P2.1), `server/src/gate.ts` (P2.4),
  `server/src/porao.ts` e `server/src/config.ts` (P3), `web/src/ui/porao.ts` (aviso das ondas no cartão, P3).
- Testes em `server/tests/`.
- Junto, na mesma entrega (G16): regra 10 do `CLAUDE.md` e `.claude/rules/porao.md` (simultâneas), modelo de briefing
  do `~/Documents/IA/claude/agents/maestro.md` (testar.sh e "até 3 por vez"), `docs-dev/context/maestro-v3.md`.

## Diferenças do plano (implementação de 25/11/2026)

- **Suposição do `session_id`:** **conferida** no ensaio de 26/11/2026 (sessão `claude -p` real com `--session-id`: a
  entrada gravada do PreToolUse traz o id). Se um dia vier sem ele, o hook segue como antes: não trava nada.
- **De qual tarefa é o `testar.sh <n>`:** o script é um por rodada; a tarefa vem do `DEV_VALLEY_TAREFA`, que a vila
  põe no `env` do `--settings` de cada sessão de trabalho (vale também ao retomar), ou do segundo argumento
  (`testar.sh <n> <tarefa>`, para sessão aberta à mão). A regra `Bash(bash <rodada>/testar.sh:*)` entra nas permissões
  da tarefa que tem testes. **Conferido** no ensaio de 26/11/2026: `testar.sh 1`, sem a tarefa, rodou na sessão real.
- **Suíte crua no hook:** cada trecho do comando (entre `;`, `&&`, `||` e `|`), sem redirecionamento, comparado com os
  `testes`. A da própria tarefa é recusada apontando o número; a de outra tarefa também é recusada (as suítes dela
  cruzariam do mesmo jeito).
- **Gate na fila:** o `flock` espera a vez dentro do mesmo limite do comando (15 min); se a fila passar disso, o comando
  conta como estourado. Sem `flock` na máquina, gate e `testar.sh` rodam sem fila.
- **Ondas:** a conta é por rodada (abertas + abrindo < `simultaneas`) e vale também no clique do cartão; o cartão diz
  "abre em ondas de até N" e, depois do clique, "abre na próxima onda" para as que ficaram.

## Como medir a próxima sprint

Na próxima rodada de início de sprint, anotar no relatório: tokens da rodada (o moinho já soma por sessão), relógio até
a entrega, achados da `/revisar`, e o retrabalho nas semanas seguintes (`RETRABALHO.md` do projeto). Retrabalho no nível
das sessões diretas = o modo está pago.
