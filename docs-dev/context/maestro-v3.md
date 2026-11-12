# Maestro v3: recusar a rodada que não compensa, provar que passou, medir se valeu

> Plano de 11/11/2026. **Decidido pelo usuário e codado em 11/11/2026** (Etapas 0 e 1; da Etapa 2 falta o ensaio, que
> espera o ok do usuário, e a rodada real, MA-5). Código: `server/src/gate.ts`, `server/src/rodada.ts`,
> `server/src/porao.ts`, `server/src/gasto.ts` (`tokensDaConversa`), `web/src/ui/porao.ts`; testes em
> `server/tests/gate.test.ts`. Base: a pesquisa
> `docs-dev/context/sessoes-paralelas-fundamentos.md` (as fontes dela **não foram conferidas**: o plano se apoia nos
> princípios e no que os ensaios do v2 mostraram, não nos percentuais dos papers) e o v2 em
> `docs-dev/context/maestro-v2.md`. A espinha do v2 não muda: estado em arquivo, a vila como única escritora, dependências
> no cartão, um clique por rodada, relatório sem modelo, hooks de devolutiva e de posse.

## Decisões do usuário (11/11/2026)

| # | Decisão |
|---|---|
| V1 | **Padrão 3, teto 5.** O maestro propõe até 3 tarefas por rodada; 4 ou 5 quando as tarefas são independentes de verdade, dizendo o porquê na conversa. **Sem exigência na rota:** o pedido com 4 ou 5 tarefas é aceito como hoje (decisão do usuário, 11/11/2026). |
| V2 | **Agora:** itens 1 a 5 abaixo. **Depois de 3 rodadas reais medidas:** revisor de contexto limpo por risco (R8 da pesquisa) e orçamento com critério de morte (R11). Uma variável por vez. |
| V3 | **Linha de base do gate:** a vila roda os comandos de teste **antes** de abrir as sessões, para o relatório separar o que já estava vermelho do que a rodada quebrou. Custo aceito: a rodada começa com o atraso de uma execução. |
| V4 | **Gate vermelho só avisa.** Relatório "reprovada" + ❗ na estante; a vila não reabre sessão sozinha (regra 10: sessão só nasce do clique). O usuário decide. |
| V5 | **Fora do plano:** worktree por sessão (segue como ideia na MA-4), roteamento de modelo, agent teams. |

## Etapa 0: fechar o v2 (antes de qualquer código novo)

O v2 está codado e sem commit; a suíte completa não rodou depois da última mudança em `scripts/porao-hook.sh`.

- [x] `npm test`, `npm run typecheck -w server`, `npm run build` e o auditor: anotar o resultado como linha de base (G4).
      Resultado: 279/279, typecheck e build sem erro, auditor limpo (com `--tudo`, 5 caminhos antigos do `PROGRESS.md`).
      Falha que aparecer aqui é do v2: corrigir antes de seguir.
- [x] Rastro que ficou por fazer: `PROGRESS.md` (correção da corrida `aprovar` × `avancar` com `comTrava` e o estado
      `abrindo`; hook `bash`; reserva atômica de posse; ensaios c1 a c6), `docs-dev/context/maestro-v2.md` (seção
      "Diferenças do plano": `abrindo`, hook `bash`, reserva em `<rodada>/posse/`, e o limite conhecido: teste por tarefa
      na pasta compartilhada reprova pelo trabalho da outra), contagem de testes no `CLAUDE.md`.

## Etapa 1: os cinco itens

### 1. Padrão 3, teto 5 (V1)

- `TETO_PADRAO` continua 5 (`server/src/config.ts`): é o máximo duro, e conta todas as tarefas da rodada, como hoje.
- **Nada muda na rota nem no cartão:** o pedido com 4 ou 5 tarefas é aceito como hoje, sem campo novo.
- Só o agente muda: "até 3 por padrão; 4 ou 5 só se as tarefas forem independentes de verdade, com arquivos disjuntos,
  e dizendo por quê ao usuário, no bloco de resposta". A descrição do agente (frontmatter) troca "até 5 sessões" por
  "3 por padrão, até 5".

### 2. Viabilidade com números (agente)

A seção "Antes: vale paralelizar?" do agente vira checklist. Se **um** item falhar, o maestro recomenda sessão única,
diz qual item falhou e pergunta se o usuário segue mesmo assim:

1. Pelo menos 2 tarefas rodam juntas (sem arquivo, interface ou decisão em comum).
2. Cada tarefa vale cerca de 30 min ou mais de uma sessão. Menor que isso: agrupar numa tarefa ou fazer numa sessão só.
3. Existe comando de verificação automática no projeto (teste, typecheck ou build).
4. Cada tarefa tem critério de aceite que o maestro consegue escrever sem inventar.
5. A parte em fila não domina: se a maior cadeia de `dependeDe` concentra mais de ~70% do trabalho estimado, é sessão
   única.

O bloco de resposta do maestro ganha a estimativa por tarefa (minutos) e a **estimativa em sessão única** (soma). É
estimativa declarada antes, para comparar depois: não é medição.

### 3. Contrato no briefing (agente + `convivencia.md`)

O modelo do briefing ganha:

- **Pronto quando:** critério de aceite verificável (o que tem que ser verdade; qual teste prova). Se o maestro não
  consegue escrever, a tarefa não está pronta para rodada: ele pergunta ao usuário, não inventa (G1).
- **Leia primeiro:** os arquivos e trechos que a tarefa precisa (levantados por `grep`). **Não precisa ler:** o que
  parece relacionado e não é.
- **Pode usar, não pode alterar:** funções, rotas, tipos e formatos de outra tarefa ou compartilhados.
- **Arquivo hub** (entrada do servidor, registro de rotas, tipos compartilhados, `package.json`/lock, CSS global) que
  mais de uma tarefa precisa mudar: vira uma **tarefa 0**, sozinha, e as outras dependem dela.

A devolutiva ganha o campo `aceite` (`sim` ou `não`, e como conferiu). Atualizar o formato na seção "Sob o maestro" de
`~/Documents/IA/guardrails-ia/convivencia.md`, o leitor em `server/src/rodada.ts` (`lerDevolutiva`) e a coluna no
relatório. Devolutiva antiga sem o campo continua sendo lida.

### 4. Gate de verificação no fim da rodada, rodado pela vila (V3, V4)

**Por que no fim e não por tarefa:** no ensaio c3 o teste de uma tarefa reprovou pelo trabalho inacabado da outra na
mesma pasta. O teste da própria sessão continua (ela roda e registra antes → depois); o gate é a prova da integração.

- **Comandos:** a união dos `testes` das tarefas do pedido, sem repetição, na ordem em que aparecem. Nenhum campo novo:
  são os comandos que já passam por `validarPermissoes` e que o cartão já mostra. O cartão passa a dizer que a vila os
  roda antes e depois.
- **Como roda:** sem shell (`execFile` com o comando partido em palavras), na pasta do projeto, um por vez, com limite
  de tempo por comando; a saída vai para `~/.claude/maestro/rodadas/<id>/gate/` (um arquivo por comando e por momento).
  Nunca conteúdo de saída no `rodada.json`: só comando, código de saída e duração.
- **Linha de base (V3):** depois do clique e **antes** de abrir qualquer tarefa. O clique responde na hora; a rodada
  fica num estado próprio ("conferindo a linha de base", visível no quadro) e as tarefas sem dependência abrem quando a
  linha de base termina. Falha ou estouro de tempo na linha de base **não bloqueia** a rodada: fica registrado.
- **Gate final:** quando todas as tarefas estão prontas, antes de montar o relatório. Resultado por comando:
  `passou` · `já estava vermelho` (falhou antes e depois) · `quebrou` (passava e falha) · `consertou`.
  Rodada **aprovada** se nenhum comando `quebrou`; senão **reprovada**.
- **Reprovada (V4):** o relatório sai do mesmo jeito, com "Reprovada" no topo, o comando que quebrou e o caminho da
  saída; ❗ na estante. Nenhuma sessão é reaberta. O cartão do roteiro de testes continua sendo oferecido como hoje.
- **Trava:** linha de base e gate rodam fora de `comTrava` (podem levar minutos); só a gravação do resultado entra na
  trava. Reexecutar `avancar` enquanto o gate roda não dispara outro (idempotente, mesmo cuidado do estado `abrindo`).
- **Gongo durante o gate:** encerra a rodada; o resultado que chegar depois é descartado.
- **Rodada sem `testes`** (pedido só com nomes): sem gate; o relatório diz "sem verificação automática".

### 5. Medição (V2)

- O pedido aceita `estimativaSessaoUnicaMin` (número, opcional na rota; o agente sempre manda). Vai para o
  `rodada.json`.
- Tokens por tarefa: lidos do `.jsonl` da sessão de trabalho quando ela fica pronta, reaproveitando a leitura de uso
  que já existe em `server/src/gasto.ts`. Só números (entrada, saída, cache), nunca conteúdo.
- O relatório ganha a seção **Custo e ganho**: tempo de parede da rodada (clique → fim do gate), tempo da linha de base
  e do gate, soma dos tempos das tarefas, estimativa em sessão única e a diferença, tokens por tarefa e total. Com a
  frase fixa: "A estimativa foi declarada antes da rodada; não é medição."
- Sem afirmar ganho: o relatório mostra os números, a conclusão é do usuário.

## Etapa 2: conferir

- [x] Gate do projeto: `npm test`, `npm run typecheck -w server`, `npm run build`, auditor
      (`python3 scripts/auditar-referencias.py . --tudo`), tudo sem erro. Resultado: 296/296 (279 + 17 do
      `gate.test.ts`), typecheck e build sem erro, auditor igual à linha de base.
- [x] Ensaio isolado (script do v2, fora de `~/.claude/maestro/rodadas`). Com o ok do usuário, só o mínimo: c8, 1 sessão
      que quebra um teste que passava. Linha de base passou (antes de a sessão abrir), a sessão abriu em 3 s, gate final
      falhou, relatório "Reprovada" com aceite e "Custo e ganho", nenhuma sessão reaberta. Aprovado ficou com os testes
      unitários. Tokens saíram vazios porque o script do ensaio não repassa o `.jsonl` da sessão (o v2 não precisava);
      `tokensDaConversa` conferido à parte na conversa real do ensaio.
- [ ] 👤 O usuário reinicia a vila (regra 6) e faz uma rodada real pequena. Fecha a MA-5 junto.

## Diferenças do plano, decididas ao codar (11/11/2026)

- **`spawn` sem shell em vez de `execFile`:** mesmo efeito (programa + argumentos, nada interpretado), com a saída indo
  direto para o arquivo, sem limite de buffer. No estouro do tempo, o grupo de processos inteiro morre (o `npm test`
  abre filhos).
- **Limite por comando: 15 min** (`GATE_LIMITE_MS` em `gate.ts`), sem campo no config. Estourou = conta como falha.
- **Saída do gate:** `<rodada>/gate/antes-<n>.txt` e `depois-<n>.txt` (n = posição do comando na lista).
- **Linha de base:** as tarefas livres abrem na primeira volta do `avancar` depois de ela terminar (até 3 s), pelo
  mesmo caminho das dependentes. Vila que caiu no meio da linha de base ou do gate: a volta seguinte roda de novo.
- **Comando que entra num pedido seguinte da mesma rodada** (o agente manda um pedido só, mas a rota aceita outro) fica
  sem linha de base: o depois decide sozinho (`passou` ou `quebrou`).
- **Gongo:** a gravação do `encerradaEm` passou a entrar na trava, para o gate que termina junto reler e descartar.
  Entre um comando e outro, o gate confere se a rodada foi encerrada e para.
- **Quadro:** uma linha acima das colunas diz onde a rodada está no gate (linha de base, trabalhando, conferindo,
  aprovada, reprovada). Sem CSS novo: texto nos elementos que já existiam.
- **Cartão:** diz os comandos que a vila roda antes e depois, ou "sem verificação automática". As tarefas sem dependência
  aparecem como "abrem quando a linha de base terminar".
- **Skill `roteiro-testes`:** não mudou. A linha "Roteiro de testes" que ela troca no relatório continua igual; as
  colunas e seções novas vêm depois dela.

## Etapa 3: depois de 3 rodadas reais medidas (não codar agora)

Revisor de contexto limpo por risco (R8) e orçamento com critério de morte (R11). Entram como pendência nova no
`PENDENCIAS.md`, com dono 👤, e só viram plano quando os relatórios das 3 rodadas existirem.

## Ao implementar (G16)

Na mesma entrega: `CLAUDE.md` (regra 10: a vila roda os comandos de teste do cartão antes e depois; teto e contagem de
testes), `README.md` (porão), `server/agents/maestro-mirim.md` (estados novos do `rodada.json`),
`~/Documents/IA/claude/agents/maestro.md`, `~/Documents/IA/guardrails-ia/convivencia.md`,
`~/Documents/IA/claude/skills/roteiro-testes/SKILL.md` (se o formato do relatório que ela lê mudar), `web/src/ui/porao.ts`
(cartão e quadro: G19 antes de qualquer CSS novo). Ao terminar: este arquivo vai para `docs-dev/context/`,
`docs-dev/painel.json` ganha a fase, `PROGRESS.md` e `PENDENCIAS.md` (MA-6 fecha; MA-5 continua até a rodada real).
