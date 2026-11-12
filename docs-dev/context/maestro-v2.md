# Maestro v2: a vila conduz a rodada, o maestro só distribui

> Plano de 11/11/2026, a partir da pesquisa de como a Anthropic e a comunidade conduzem sessões paralelas
> (fontes no fim). O usuário escolheu os itens 1 a 5 da proposta e, no mesmo dia, as recomendações nas cinco decisões.
> **Codado em 11/11/2026** (fases 1 a 4, com a MA-3 junto); falta o usuário reiniciar a vila e conferir numa rodada de
> verdade (MA-5 no `PENDENCIAS.md`). Este documento passa a valer por cima de `docs-dev/context/maestro.md` no que o
> contradiz. Código: `server/src/rodada.ts`, `server/src/porao.ts`, `scripts/porao-hook.sh`, `web/src/ui/porao.ts`.

## Como ficou, em uma lista

1. O maestro mapeia arquivos, diz se vale paralelizar, escreve **todos** os briefings e manda **um** pedido com
   `arquivos`, `testes` e `dependeDe` por tarefa. Acabou o papel dele na rodada.
2. O clique no cartão grava `~/.claude/maestro/rodadas/<id>/rodada.json` (a vila é a única escritora) e abre as tarefas
   sem dependência, cada uma com `--settings` trazendo os dois hooks de `scripts/porao-hook.sh`.
3. A cada volta do `refreshWorld` (3 s), `Porao.avancar`: devolutiva gravada + sessão parada = pronta; dependente com
   todas as donas prontas = abre; nada mais aberto nem para abrir = relatório em `docs-dev/maestro/` e, se alguma
   devolutiva disse `mexeu_em_tela: sim`, o cartão do roteiro na estante.
4. O quadro da rodada abre na estante enquanto houver rodada não encerrada; ❗ na estante quando uma tarefa parou sem a
   devolutiva ou não abriu. O gongo marca a rodada como encerrada (`encerradaEm`): sai do quadro e nada mais abre.

**Diferenças do plano, decididas ao codar:**
- O `rodada.json` é escrito só pela vila (o plano dizia "inicial pelo maestro" na fase 2): as informações vêm no pedido.
- `PARE` saiu também: sem `COMECEI`, o maestro não tem o endereço das sessões; parar é pelo gongo ou abrindo a sessão.
- O quadro junta "pedindo permissão", "parou sem a devolutiva" e "não abriu" numa coluna só, **Precisa de você**: é a
  mesma ação para o usuário (abrir e ver).
- Arquivo de outra tarefa que ainda trabalha: o hook recusa e a sessão segue com o resto, registrando em
  `ficou_de_fora` (ela não tem como esperar). Tarefa que **espera** a vez não é dona de nada ainda.
- As rotas `/api/porao/chamar` e `/api/porao/roteiro` continuam (o agente novo não as usa); o mirim continua.
- Estado `abrindo` (corrida da 1ª rodada real, 11/11/2026): clique e volta automática passam pela mesma trava
  (`comTrava`); a tarefa é reservada como `abrindo` e gravada **antes** de o terminal subir. `abrindo` que sobrou de uma
  vila que caiu vira `aberta` (com sessão) ou volta a `esperando` (sem); nunca abre por cima. Pedido que repete tarefa
  da rodada: 409.
- Hook `bash` (terceiro modo do `porao-hook.sh`): recusa escrita em arquivo pelo Bash (`sed -i`, `>`/`>>`, `tee`, `cp`,
  `mv`, `rm`...) e o git que mexe no repositório. Nos ensaios as sessões editavam por ali, por fora da posse, e o modo
  `auto` do usuário não pede permissão.
- Reserva de posse em `<rodada>/posse/`: o arquivo que nenhuma tarefa listou fica da primeira que o edita (criação
  atômica com `noclobber`) até ela ficar pronta.
- **Limite conhecido:** o teste de uma tarefa roda na pasta compartilhada e pode reprovar pelo trabalho inacabado de
  outra (ensaio c3). A prova da integração passa a ser o gate no fim da rodada (maestro v3).

## 1. O problema, em uma linha por item

Hoje a rodada anda por **recado entre modelos** (`COMECEI`, `PEDIDO`, `LIBERADO`, `PRONTA` pelo `SendMessage`), e o
maestro precisa ficar vivo e atento a rodada inteira. Foi daí que vieram as falhas e o custo:

- `PRONTA` escrito na tela em vez de mandado: a rodada parou 8 min (`RETRABALHO.md`, 03/11/2026).
- Cobrança, assinatura de aviso de parada e hora pelo `date`: tudo regra para compensar o recado que se perde.
- Tarefa que espera outra (⏸) exige que o maestro escreva o briefing novo e peça outro cartão no meio da rodada.
- Custo fixo alto: ~26 min na segunda rodada, antes de qualquer código.

O que a pesquisa diz (seção 6): o agent teams oficial usa **lista de tarefas com estado e dependências**, e o aviso de
parada chega **sozinho**; a Anthropic registra que modelos coordenam mal em tempo real e que cada trabalhador deve
**gravar o resultado em arquivo**, não mandar recado.

## 2. Como fica o fluxo

```
Hoje:     usuário → maestro mapeia e escreve briefings → cartão → sessões ⇄ maestro (recados) → maestro escreve relatório
Proposta: usuário → maestro mapeia e escreve briefings → cartão → a VILA conduz → a VILA monta o relatório
```

1. O usuário passa as tarefas ao maestro (igual hoje).
2. O maestro confere conflito de arquivo, **diz se vale paralelizar** (item 5) e escreve os briefings e o
   `rodada.json` com arquivos, testes e dependências de cada tarefa.
3. Um pedido só ao porão. O clique em "Abrir" aprova a rodada (item 3, ver D2).
4. **A partir daqui o maestro não participa.** A vila sabe quem começou e quem parou pelos hooks; cada sessão termina
   gravando a devolutiva em arquivo; a posse de arquivo é conferida por hook antes de cada edição.
5. Tarefa que dependia de outra abre sozinha quando a outra fica pronta.
6. Todas prontas → a vila monta o relatório com as devolutivas e oferece o cartão do roteiro de testes, se alguma
   tarefa mexeu em tela.

## 3. Decisões (as cinco recomendações, aceitas pelo usuário em 11/11/2026)

| # | Pergunta | Recomendação |
|---|---|---|
| D1 | Como os hooks chegam só às sessões do porão | `--settings '<json>'` no spawn da sessão de trabalho (`argsDoTerminal`), com um `Stop` e um `PreToolUse`. Não mexe no mod nem no `settings.json` global e não afeta nenhuma outra sessão. Conferido em 11/11: o `claude --help` aceita `--settings <arquivo-ou-json>`. |
| D2 | Regra 10 ("sessão só nasce do clique"): a tarefa que depende de outra pode abrir sozinha? | Sim, **se o cartão listou essa tarefa** ("t3 abre quando t1 ficar pronta") e o clique aprovou. O clique continua sendo o único jeito de uma sessão nascer; ele só passa a valer para a rodada inteira. Reescrever a regra 10 do `CLAUDE.md`. |
| D3 | Quem monta o relatório | A **vila, sem modelo**: tabela montada das devolutivas (formato fixo) e dos horários dos hooks. Zero token e sem hora inventada. Alternativa: `claude -p` pela `consulta.ts` lendo as devolutivas, se o usuário quiser o "Em uma frase". |
| D4 | Onde o quadro de status abre (item 4) | No clique da estante de partitura durante a rodada (ela já abre o cartão antes e os relatórios depois). Nada novo no mapa; o quadro de cortiça já saiu por ter sido achado inútil. |
| D5 | A sessão do maestro depois do pedido | Fica aberta e ociosa (o usuário ainda pode conversar com ela); nada mais chega a ela. O gongo apaga como hoje. O mirim continua respondendo dúvidas da rodada. |

## 4. Fases

### Fase 1 — Devolutiva em arquivo e estado pela vila (item 1)

O ponto mais frágil hoje. A tarefa passa a terminar gravando um arquivo; o hook não deixa esquecer.

- [x] Formato fixo da devolutiva em `~/.claude/maestro/rodadas/<id>/devolutivas/<tN>.md`: cabeçalho com `tarefa`,
      `arquivos`, `testes` (antes → depois), `ficou_de_fora`, `mexeu_em_tela` (sim/não); corpo de 2 ou 3 linhas sem
      jargão. A sessão recebe `Write` só nesse arquivo (`regrasDaTarefa`).
- [x] Hook `Stop` da sessão de trabalho (D1): sem a devolutiva, sai com 2 e devolve "grave a devolutiva em <caminho>
      antes de terminar". **É lembrete, não prisão:** com `stop_hook_active` passa direto, como o
      `scripts/conferir-ao-parar.sh`, para a sessão poder parar e perguntar algo ao usuário.
- [x] `rodada.json` escrito pela **vila** (único escritor): tarefas, estado (`esperando` · `trabalhando` ·
      `parou pedindo permissão` · `pronta`), início e fim de cada uma pelos eventos `SessionStart`/`Stop`/`Notification`
      que o `hooks.ts` já recebe. `pronta` = parou **e** a devolutiva existe.
- [x] Sessão que parou sem devolutiva e sem pedir permissão: ❗ no porão para o usuário ("t2 parou sem terminar").
- [x] Relatório montado pela vila (D3) quando todas ficam prontas, em `docs-dev/maestro/AAAA-MM-DD-<assunto>.md`, e o
      cartão do roteiro oferecido se alguma devolutiva disse `mexeu_em_tela: sim`.
- [x] **Depende do MA-3:** o resume perde as regras de permissão e perderia também os hooks. Guardar regras e
      `--settings` no `porao.json` e repassar no resume, junto desta fase.
- [x] Testes: devolutiva faltando/presente, estado a partir dos eventos, relatório montado, resume com as regras.

### Fase 2 — Posse de arquivo pelo harness e maestro só no começo (itens 2 e 5)

- [x] Hook `PreToolUse` em `Edit`/`Write` da sessão de trabalho (D1): arquivo de outra tarefa **ainda não pronta** →
      nega com "espere t1 (dona de <arquivo>)"; arquivo livre → segue o fluxo normal (fora da lista, o diálogo de
      permissão aparece ao usuário, com o ❗ que já existe). Lê o `rodada.json`, sem rede. `PROGRESS.md` e
      `PENDENCIAS.md` continuam somando, não são posse de ninguém.
- [x] Sai do protocolo: `COMECEI`, `PEDIDO`/`LIBERADO`/`ESPERE`, `PRONTA`, a assinatura `notify_when_idle`, a cobrança
      e a hora pelo `date`. Fica `PARE` só se o usuário pedir (D5).
- [x] **Item 5 no agente:** antes de pedir as sessões, o maestro diz quando **não vale** paralelizar: menos de 2
      tarefas independentes, tarefas pequenas (o custo fixo da rodada passa o ganho) ou arquivos em comum que viram
      fila. Nesse caso recomenda uma sessão só e pergunta. Sugere 3 a 5 sessões, não "até 5 sempre".
- [x] Reescrever `~/Documents/IA/claude/agents/maestro.md` (fica: mapear arquivos, matriz de conflito, briefings,
      `rodada.json` inicial, um pedido) e a seção "Sob o maestro" do `convivencia.md` (fica: só seus arquivos, testes
      exatamente como escritos, devolutiva no arquivo).
- [x] Modo manual (fora da vila) continua: sem hooks, a sessão grava a devolutiva do mesmo jeito e o maestro confere os
      arquivos quando o usuário perguntar.
- [x] Testes do hook de posse (dona viva nega, dona pronta libera, arquivo de rastro passa).

### Fase 3 — Dependências declaradas (item 3, depende de D2)

- [x] O pedido ao porão aceita `dependeDe: ["t1"]` por tarefa; recusa ciclo e dependência que não existe.
- [x] O cartão mostra a ordem ("t3 abre quando t1 ficar pronta") e o teto conta todas as tarefas da rodada.
- [x] A vila abre a dependente quando a dona fica pronta (fase 1), anotando no `porao.json` antes do terminal, como hoje.
- [x] Se a dona parar sem terminar, a dependente não abre e o ❗ diz por quê.
- [x] Regra 10 do `CLAUDE.md` reescrita conforme D2; testes da ordem, do ciclo e do teto.

### Fase 4 — Quadro de status no porão (item 4)

- [x] Painel com uma coluna por estado (Esperando · Trabalhando · Parou pedindo permissão · Pronta), um cartão por
      tarefa com nome do morador, arquivos e tempo; clique no cartão abre o terminal da sessão. Lido do `rodada.json`.
- [x] Abre onde D4 decidir. **Antes da primeira linha de CSS:** anti-patterns de design (G19), nada de faixa colorida
      na aresta; a cor vive no ponto do rótulo do estado.
- [ ] Conferido na vila pelo usuário numa rodada de verdade (MA-5).

## 5. Ao implementar (G16)

Junto da fase que muda cada coisa: `CLAUDE.md` (regra 10, e menção aos hooks do porão), `README.md` (mapa do porão),
`docs-dev/context/maestro.md` (nova seção "Maestro v2" no topo do "como funciona hoje"), agente do maestro,
`convivencia.md`, skill `roteiro-testes` (se o relatório mudar de formato) e `server/agents/maestro-mirim.md` (o estado
da rodada passa a vir do `rodada.json`). Feito em 11/11/2026; o arquivo já está em `docs-dev/context/`.

## 6. Fora deste plano

- Adotar o agent teams oficial: experimental, sessões em painéis do tmux, sem resume e sem permissão por sessão; não
  encaixa nos terminais da vila. Este plano copia as ideias dele (lista com estado, dependências, aviso automático).
- Worktree por sessão: segue como ideia no MA-4.

## Fontes (pesquisa de 11/11/2026)

- Agent teams: https://code.claude.com/docs/en/agent-teams
- Sessões paralelas: https://code.claude.com/docs/en/agents e https://code.claude.com/docs/en/common-workflows
- Sistema de pesquisa multi-agente da Anthropic: https://www.anthropic.com/engineering/multi-agent-research-system
- Comunidade: https://addyosmani.com/blog/claude-code-agent-teams/ ·
  https://botmonster.com/ai/code-agent-orchestra-patterns-multiple-ai-developers-parallel/ ·
  https://madewithlove.com/blog/conductor-running-multiple-ai-coding-agents-in-parallel/
