# Maestro: trabalho paralelo de sessões no porão da casa

> Plano decidido em conversa com o usuário em 03/11/2026 e implementado no mesmo dia (fases 1 a 4). Conferido pelo
> usuário numa rodada de verdade pela vila em 03/11/2026 (`docs-dev/maestro/2026-11-03-teste-rapido.md`); MA-1 fechado.
> **Como funciona hoje:** valem a "Simplificação depois da segunda rodada" e a "Correção das mensagens" (seção 6). O
> que vem antes delas (seções 1 a 3, decisões C e D) descreve o desenho original e vale só no que não contradiz isso.
> Agente: `~/Documents/IA/claude/agents/maestro.md`; contrato das sessões: "Sob o maestro" em
> `~/Documents/IA/guardrails-ia/convivencia.md`. Código: `server/src/porao.ts`, `server/src/relatorios.ts`,
> `web/src/ui/porao.ts`, `PoraoScene`.

## 1. O que é

Um agente, o **maestro**, que coordena até 5 sessões do Claude Code trabalhando ao mesmo tempo no mesmo projeto.
Ele **não escreve código**: divide o pedido em tarefas, reserva os arquivos de cada uma, cria as sessões, recebe as
devolutivas, roda o gate, escreve os documentos de controle, faz o commit e entrega um relatório didático da rodada.

Na vila, tudo isso acontece no **porão da casa**, um ambiente separado: as sessões do maestro não aparecem dentro da
casa nem no mapa principal.

## 2. Decisões fechadas (03/11/2026)

| # | Decisão |
|---|---|
| A | Mensagem do maestro manda em **coordenação** (esperar, sair de um arquivo, entregar relatório), **nunca em escopo novo**. A sessão de trabalho sabe disso pelo briefing com que nasce. A G21 ganha essa exceção por escrito. |
| B | Todas as sessões na **mesma pasta**, com reserva de arquivo. Worktree fica como possibilidade futura, por tarefa. |
| C | **Só o maestro faz commit**, um por tarefa, depois do gate, com `git add` pelo nome. |
| D | Reservas e status da rodada ficam **fora do git** (`~/.claude/`). |
| E | O maestro **cria as sessões pela vila** (caminho 3), com **teto de 5** por rodada. Subagente só para levantamento de leitura; `claude -p` em segundo plano não é usado (permissão teria de ser liberada antes, fere o G3). |
| F | O agente é **universal** (`~/Documents/IA`, instalado pelo `instalar.sh`). O porão e o visual são do dev-valley. Fora da vila, o maestro funciona no modo manual: o usuário abre as sessões e cola o briefing. |
| G | A escotilha fica **dentro da casa**, como alçapão no chão. |
| H | **Um maestro por rodada** (contexto limpo a cada pedido). Rodadas antigas ficam no porão como histórico. |
| I | O relatório é **versionado** no projeto, em `docs-dev/maestro/AAAA-MM-DD-<assunto>.md`. |
| J | Ao fechar a rodada, as sessões **ficam no porão até o usuário encerrar**, por um botão "Encerrar rodada" com confirmação, que fecha os terminais e **apaga as conversas** do porão (decisão do usuário, 03/11/2026). |

**Rodada** = um pedido ao maestro: pedido → divisão → sessões → devolutivas → gate → relatório → commit.

## 3. Como o maestro atua

```
1. Usuário desce ao porão e faz o pedido ao maestro
2. Maestro lê PENDENCIAS, painel e só o código necessário (subagente de leitura se precisar mapear)
3. Maestro propõe a divisão: tarefas, área de arquivos de cada uma, quantas sessões (≤ 5)
4. Usuário aprova                                   ← nada é criado antes disso
5. Maestro anota a linha de base dos testes (G4) e pede as sessões à vila
6. Cada sessão nasce no porão já com o briefing e trabalha só na sua área
7. Precisa sair da área → pede ao maestro; terminou → manda a devolutiva (SendMessage)
8. Maestro roda o gate, escreve PROGRESS/PENDENCIAS/painel, faz os commits e o relatório
9. Usuário lê o relatório, confere, e abre a sessão que quiser para ver detalhes
```

### Regras do maestro

1. **Não coda.** Se precisar de código, é uma tarefa de uma sessão.
2. **Divide por arquivo, não por assunto.** Duas tarefas só rodam juntas se as áreas não se cruzam. Mudança comum
   (tipo, contrato de API) vira **tarefa 0**, feita sozinha antes das outras.
3. **Pontos quentes têm um dono por vez:** arquivos em que todo mundo esbarra (no dev-valley: `server/src/app.ts`,
   `server/src/index.ts`, tipos compartilhados, `package.json`). O briefing do projeto pode listar os dele.
4. **Reserva em disco**, no arquivo da rodada (seção 5), nunca só na memória dele.
5. **Único escritor dos documentos de controle:** `PROGRESS.md`, `PENDENCIAS.md`, `docs-dev/painel.json` e o
   relatório. As sessões de trabalho não mexem neles (exceção ao G5 para quem trabalha sob o maestro).
6. **Recursos que não rodam em paralelo são dele, um de cada vez e com o ok do usuário:** build servido, reinício de
   servidor, migration, banco, commit, push, instalação de mod. No dev-valley, reinício continua sendo do usuário
   (regra 6 do `CLAUDE.md`).
7. **Teste vermelho tem dono:** compara com a linha de base e diz de qual área é a falha.
8. **Sessão que sumiu** (fora da `ListAgents`) com reserva aberta: avisa o usuário e só libera com o ok dele.
9. **Não aumenta o escopo:** achado de sessão vira linha no `PENDENCIAS.md`, não tarefa nova sem aprovação.
10. **Olha o custo antes de propor:** paralelizar não compensa em tarefa pequena ou com áreas que se cruzam; se o limite
    de uso já estiver alto (a vila mostra no `/api/statusline`), propõe menos sessões e diz por quê.

### Briefing de cada sessão de trabalho

O maestro monta e a vila entrega como primeira mensagem:

- quem é o maestro (nome para o `SendMessage`) e que ela trabalha **sob ele** (decisão A);
- a tarefa, a área de arquivos reservada e o que está fora dela;
- a linha de base dos testes;
- o que não fazer: commit, `PROGRESS.md`/`PENDENCIAS.md`/painel, build servido, reinício, banco, criar sessão;
- o formato da devolutiva (abaixo).

### Devolutiva de cada sessão

O que fez (2 ou 3 linhas) · arquivos tocados · testes antes → depois · o que ficou de fora e por quê · dúvidas abertas.

## 4. Relatório da rodada

Um documento por rodada, para todas as sessões, escrito pelo maestro depois de todas as devolutivas, em
`docs-dev/maestro/AAAA-MM-DD-<assunto>.md`. Linguagem simples, passos numerados, sem parágrafo longo.

```
# Rodada: <o que foi pedido>        (data · N sessões · status)

## Em uma frase
O que mudou no sistema, para quem usa.

## Como o trabalho foi dividido
Tarefa 0 (base comum) → tarefas 1, 2, 3 em paralelo.

## O que cada sessão fez            (uma seção por sessão)
- Nome do morador · o que fez, em 2 ou 3 linhas sem jargão
- Arquivos tocados
- Testes: antes → depois
- Ficou de fora / dúvida aberta
- Para ver em detalhe: abrir a sessão <Nome> no porão

## Como conferir
Passos numerados do que olhar.

## Pendências que nasceram
(também vão para o PENDENCIAS.md)
```

O `PROGRESS.md` ganha uma entrada por rodada com link para o relatório.

## 5. Arquivos de controle (fora do git)

| Arquivo | Quem escreve | O que guarda |
|---|---|---|
| `~/.claude/maestro/rodadas/<id>/rodada.json` | maestro | projeto, pedido, tarefas, área reservada e sessão de cada uma, status, linha de base dos testes, eventos |
| `~/.claude/maestro/rodadas/<id>/briefings/<tarefa>.md` | maestro | o briefing com que a sessão nasce |
| `~/.claude/maestro/rodadas/<id>/devolutivas/<tarefa>.md` | a sessão da tarefa | a devolutiva (vale pelo arquivo; a mensagem só avisa) |
| `~/.claude/dev-valley/porao.json` | servidor da vila | ids das sessões do porão → projeto, rodada, papel (maestro ou tarefa) |

Cada arquivo tem um único escritor. O da rodada funciona também fora da vila (modo manual).

## 6. Fases

### Fase 1: o agente e a regra (universal, sem código da vila)

- [x] `~/Documents/IA/claude/agents/maestro.md`: etapas fixas da rodada (abrir, dividir com matriz de conflito, propor,
      linha de base, criar, acompanhar, revisar cada entrega, revisar a integração e gate, fechar), retomada, protocolo de
      mensagens, modelos de briefing e relatório (03/11/2026).
- [x] `instalar.sh` linka `claude/agents/*.md` em `~/.claude/agents/`, sem sobrescrever agente alheio (03/11/2026).
- [x] Seção "Sob o maestro" em `guardrails-ia/convivencia.md` (contrato da sessão de trabalho, devolutiva, exceção às
      regras 3 e 4 e ao G5) e uma frase na G21 do `guardrails-core.md` (03/11/2026).
- [ ] Usuário roda `~/Documents/IA/instalar.sh` e faz a primeira rodada no modo manual: `claude --agent maestro` num
      projeto, sessões abertas com o comando que o maestro der.
- [x] Até a fase 2, o maestro aparecia na Fábrica como agente global; resolvido na fase 2.

### Fase 2: o porão na vila

- [x] Alçapão no chão da `InteriorScene` (canto de baixo à esquerda); clique desce para a `PoraoScene`, escada ou Esc
      volta para a casa (03/11/2026).
- [x] Maestro ✦ no porão com o traje de agente (regra 8), combinação reservada em `villagerArt.ts`. Clique abre uma
      rodada nova: `POST /api/porao/maestro` anota no `porao.json` e o terminal abre com `--agent maestro` na pasta do
      projeto; sem o agente instalado, 409 (03/11/2026).
- [x] Mapa, interior e escrivaninha deixam de fora quem é do porão (marca `porao` no mundo); HUD e pombal continuam
      contando. **Além do previsto:** as sessões de trabalho abertas à mão já entram no porão, pelo primeiro prompt (a
      frase fixa do briefing), sem esperar a fase 3 (03/11/2026).
- [x] O maestro global sai da Fábrica e da praça (03/11/2026).
- [x] Rodadas antigas: as sessões encerradas do porão ficam nos dois bancos (até 6), para reabrir (03/11/2026).
- [x] Conferido na vila pelo usuário, depois de corrigir o nome de textura repetido do banco (03/11/2026).

### Fase 3: o maestro cria as sessões

- [x] **Aprovação por cartão no porão, com botão, como o push do pombal** (decisão do usuário, 03/11/2026).
- [x] `POST /api/porao/pedidos` { maestro, rodada, tarefas }: o maestro pede (curl local, sem `Origin`); só a sessão de
      maestro anotada no porão e viva, briefing de cada tarefa já escrito, nomes válidos. O pedido fica na memória e
      aparece como ❗ na estante de partitura. `GET /api/porao/pedidos/:id` devolve o estado (03/11/2026).
- [x] `POST /api/porao/pedidos/:id/aprovar` e `/recusar`: **só com `Origin` local presente** (a página), para o maestro
      nunca se aprovar. Aprovar anota cada sessão no `porao.json` antes e abre o terminal sem tela
      (`TerminalManager.start`) com a frase do briefing como primeira mensagem; a que não abre sai do registro (03/11/2026).
- [x] A sessão do maestro recebe `DEV_VALLEY_URL` e `DEV_VALLEY_SESSION`; sem elas, o maestro cai no modo manual. A
      etapa 5 do agente (`~/Documents/IA/claude/agents/maestro.md`) diz como pedir e proíbe aprovar (03/11/2026).
- [x] Teto: 5 sessões por rodada (`porao.tetoSessoes` no config só baixa), contando as abertas e as pedidas (03/11/2026).
- [x] Testes do pedido e das rotas (sucesso, teto, quem não é maestro, maestro encerrado, briefing faltando, origem) em
      `server/tests/porao.test.ts` (03/11/2026).
- [x] Conferido pelo usuário numa rodada de verdade pela vila (03/11/2026, rodada `20261103-1500-biblioteca-carta`).

### Ajuste depois da primeira rodada (decisão do usuário, 03/11/2026)

A conversa do maestro aparecia como mais um morador sentado numa mesa, com o rótulo "maestro", ao lado do ✦: dois
maestros na tela, e uma mesa a menos para as tarefas. Decidido:

- [x] A sessão do maestro **nunca vira morador**: ela mora no ✦, que mostra o estado da conversa (balão trabalhando, ❗
      permissão). Ela continua sendo uma sessão de verdade por baixo (precisa durar a rodada inteira, receber as mensagens
      das sessões e fazer os commits), diferente da bibliotecária, que responde uma pergunta por vez.
- [x] Clique no ✦: com rodada em andamento (a conversa do maestro aberta), continua essa conversa; sem, começa uma nova.
      Conversas de rodadas antigas do maestro não aparecem no porão; o registro fica no relatório.
- [x] **Cinco mesas fixas, só das tarefas** (o teto), vazias até o cartão ser aprovado. O maestro nunca contou no teto.

### Simplificação depois da segunda rodada (decisão do usuário, 03/11/2026)

A rodada de teste "organizar os commits" levou ~50 min, mais do que fazer sem paralelo: o maestro inventou uma auditoria
que ninguém pediu (t2, 22 min), e o processo tinha ~26 min de custo fixo (planejar, linha de base, briefings, três
aprovações, commits). Decidido: **simplificar ao máximo.**

- [x] **O usuário divide as tarefas**; o maestro só confere conflito por arquivo e distribui (✔ paralelo / ⏸ espera).
- [x] **Uma aprovação só:** o clique em "Abrir" no cartão do porão.
- [x] Sai do maestro: planejar, linha de base, revisão por entrega e de integração, gate, `rodada.json`, arquivos de
      devolutiva, "cheguei"; mensagens ficam em `PEDIDO`, `LIBERADO`/`ESPERE`/`PARE` e `PRONTA`.
- [x] **Cada sessão anota o próprio rastro** (`PROGRESS.md`, `PENDENCIAS.md`, somando) e **não commita**: o usuário
      commita pelo pombal.
- [x] **O relatório fica, leve:** montado só com os `PRONTA`, sem reler código (o usuário quer ver se não pesa).
- [x] Hora dos registros pelo `date` (o maestro tinha escrito horários inventados).
- Agente reescrito (`~/Documents/IA/claude/agents/maestro.md`, de 305 para ~90 linhas) e seção "Sob o maestro" do
  `convivencia.md` enxuta. As decisões A, C e D e as regras do maestro acima ficam valendo só no que não contradiz isto.

### Correção das mensagens depois da terceira rodada (03/11/2026)

As sessões terminavam mas escreviam o `PRONTA` na própria tela, e o maestro não cobrava. Corrigido no agente e no
contrato:

- [x] A sessão manda `COMECEI` primeiro e `PRONTA` no fim **pela ferramenta `SendMessage`** (carregada com `ToolSearch`
      se preciso), conferindo `"success":true`; texto na tela não chega.
- [x] O maestro, no `COMECEI`, assina o aviso de parada (`notify_when_idle`) e cobra na hora quem parar sem `PRONTA`.
- [x] Fala sempre pelo endereço `from` (`uds:…`), nunca pelo nome: nomes de sessão se repetem e mudam ao reiniciar.
- [x] Conferido numa rodada de verdade pela vila (`docs-dev/maestro/2026-11-03-teste-rapido.md`).

### Relatórios na estante de partitura do porão (decisões do usuário, 03 e 04/11/2026)

O relatório só aparecia no quadro de cortiça do porão, sem aviso de rodada nova, e o usuário achou o quadro inútil. Em
03/11 foi para uma estante de partitura no portão da casa; em 04/11 o usuário achou que poluía o mapa e ela saiu.
Ficou assim:

- [x] **A estante de partitura ao lado do maestro**, no porão: com pedido esperando, abre o cartão (como antes); sem
      pedido, abre a lista dos relatórios, o mais novo primeiro, no leitor da biblioteca. Nada novo no mapa.
- [x] **Novo até abrir:** um ♪ flutua sobre a estante enquanto houver relatório não aberto (e nenhum pedido); selo
      "novo" na lista. Abrir um relatório o marca como lido (`POST /api/relatorios/lido`, só pela página, só relatório
      listado no mundo daquele projeto; outro caminho = 404). Os lidos ficam fora do git, em `relatorios-lidos.json`,
      em `~/.claude/dev-valley/`.
- [x] O quadro de cortiça saiu do porão (a textura `corkBoard` continua, é a do quadro de pendências da casa).
- [ ] Usuário: reinício e conferir na vila.

### Permissão só no que a tarefa precisa, e o tempo de cada sessão (decisões do usuário, 04/11/2026)

As sessões paravam pedindo permissão e o usuário não via. Decidido: o pedido do maestro leva, por tarefa, os
**arquivos** (relativos ao projeto) e os **testes** (até 5 comandos); o cartão mostra isso e o clique em "Abrir" aprova
junto. A vila abre cada sessão com `--allowedTools`: `Read` da pasta da rodada e do `porao.leitura` do config (o
contrato "Sob o maestro"), `Edit` só dos arquivos (cobre o `Write`), `Bash(<teste>:*)` só dos testes. O resto pede
permissão como sempre.

- [x] Recusado no pedido (400, com o motivo): arquivo fora do projeto, absoluto, com curinga, em `.git/`, `.claude/`
      (daria mais permissão à sessão) ou `.env*`; comando com o que o shell interpreta (`;`, `|`, `&`, `$`, aspas,
      curinga) ou que começa por `rm`, `git`, `curl`, `sudo`, `bash` e afins (`NUNCA` em `porao.ts`).
- [x] `--allowedTools` vai **depois** da primeira mensagem (`argsDoTerminal`): a opção aceita vários valores e engoliria
      a mensagem.
- [x] A regra do teste casa pelo começo do comando: a sessão roda o teste **exatamente** como o briefing escreve (sem
      `cd`/`--prefix` na frente; `| tail` e argumento no fim passam). Visto num teste sem tela: um modelo rodou
      `npm --prefix <pasta> run checar` e foi negado. Briefing e contrato dizem isso.
- [x] Tempo: o maestro anota a hora (`date`) a cada `COMECEI` e `PRONTA`, na mesma resposta da ação que já faria; o
      relatório ganha a coluna Tempo e a duração total. Custo: uma ferramenta a mais em paralelo, sem volta extra.
- Limite conhecido: sessão retomada (`--resume`, depois de a vila reiniciar) volta sem as regras e pede permissão.
- [ ] Usuário: reinício e conferir numa rodada de verdade.

### Maestro mirim e a regência (decisões do usuário, 04/11/2026)

Com 5 sessões, toda dúvida do usuário entrava no contexto do maestro e disputava a atenção dele (o `PRONTA` perdido de
03/11 foi isso). Decidido, com as três recomendações da proposta:

- [x] **O maestro rege:** enquanto alguma tarefa da rodada está viva e não parou (`rodadaConduzindo`), a batuta gira e o
      corpo balança, e o clique nele abre o **mirim**, com um botão para ver o terminal do maestro **só para ler**
      (`somenteLeitura`: o teclado não chega ao processo).
- [x] **O ❗ libera a conversa:** quando precisa do usuário, o maestro chama (`POST /api/porao/chamar`, pelo `curl`, só o
      maestro vivo do porão); o ❗ aparece nele e no telhado, e o clique abre a conversa e dá o chamado por atendido
      (`/api/porao/chamar/atendido`, só pela página). Permissão pedida pelo maestro também abre a conversa.
- [x] **O mirim só lê** (`server/agents/maestro-mirim.md`, `server/src/mirim.ts`): Read, Grep, Glob e
      `git -C <projeto> status/diff/log/show`, em modo estrito (`--permission-mode default`: o resto é negado mesmo com o
      `auto` do usuário). Não fala com o maestro nem com as sessões.
- [x] **Uma consulta por pergunta**, como a bibliotecária (`claude -p --no-session-persistence`, as últimas trocas no
      prompt): ninguém o atualiza; a vila monta na hora o estado da rodada (cada sessão do porão com estado, conversa e
      os últimos 8 passos, lidos do fim do `.jsonl`).
- [x] Visual: agente menor (escala 0,75) à esquerda do maestro, no traje de agente e com a combinação própria de pele e
      cabelo (`mirim-dev-valley`); batuta gerada em código (`batuta`).
- [ ] Usuário: reinício e conferir na vila.

### Fase 4: avisos, relatório e encerramento

- [x] Alçapão aceso (luz pelas frestas) com rodada em andamento, e ❗ quando alguém do porão pede permissão ou o cartão
      do maestro espera; o ❗ sobe ao telhado da casa no mapa (03/11/2026).
- [x] ~~Quadro de cortiça na parede do porão~~ (trocado pela estante de partitura, ver "Relatórios na estante de partitura do porão" acima), um bilhete por relatório de `docs-dev/maestro/` (`server/src/relatorios.ts`);
      o clique lista e abre no leitor (03/11/2026).
- [x] "Encerrar rodada" no gongo do porão: **apaga as conversas** do porão do projeto, maestro e tarefas, como o encerrar
      de sempre (decisão do usuário, 03/11/2026), com confirmação que lista cada uma; antes, fecha o terminal das que
      estão abertas na vila. `POST /api/porao/encerrar` só pela
      página; recusa se alguma estiver aberta em outro terminal; tira os ids do `porao.json` e recusa o pedido aberto.
- [x] Usuário: reinício e conferir na vila (03/11/2026). Plano movido para `docs-dev/context/` e MA-1 fora do índice.

### Ao implementar (G16)

`CLAUDE.md` do dev-valley ganha a regra do porão e da rota que cria sessão; `README.md` ganha "porão / maestro" no mapa
"na vila → por baixo"; `OPERACAO.md` se algo mudar no jeito de subir.

## 7. Fora do escopo (por ora)

- Worktree por tarefa (decisão B).
- Reservas de arquivo desenhadas na vila.
- Sessão de trabalho criando outra sessão: nunca.
