# Maestro: trabalho paralelo de sessões no porão da casa

> Plano decidido em conversa com o usuário em 03/11/2026 (G7). Ainda não codado.
> Ao implementar cada fase: marcar aqui, registrar no `PROGRESS.md` e, com tudo feito, tirar do índice
> (`PENDENCIAS.md`, item MA-1) e mover o que virou arquitetura para `docs-dev/context/`.

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
| J | Ao fechar a rodada, as sessões **ficam no porão até o usuário encerrar**, por um botão "Encerrar rodada" com confirmação. |

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

- [ ] Rota local `POST /api/porao/sessoes` { rodada, tarefa, briefing }: reserva o id, grava no `porao.json`, e o
      terminal abre sozinho com o briefing como primeira mensagem (`claude --session-id <id> "<briefing>"`).
- [ ] O servidor passa a URL da vila à sessão do maestro por variável de ambiente; sem ela, o maestro cai no modo manual.
- [ ] Travas: teto de 5 sessões de trabalho por rodada (`porao.tetoSessoes` no `dev-valley.config.json`, padrão 5);
      só a sessão maestro da rodada cria (recusa para qualquer outro id); nada sem aprovação do usuário. O jeito da
      aprovação (por exemplo, um cartão "Maestro quer abrir 3 sessões" com botão no porão, como o push do pombal) se
      decide ao abrir a fase.
- [ ] Testes de rota (sucesso, teto, id que não é maestro, entrada inválida) em `server/tests/`.

### Fase 4: avisos, relatório e encerramento

- [ ] Alçapão aceso com rodada em andamento e com ❗ quando alguma sessão do porão pede algo; o ❗ sobe ao telhado da
      casa no mapa.
- [ ] Quadro na parede do porão com os relatórios de `docs-dev/maestro/`, abrindo no leitor de docs.
- [ ] Botão "Encerrar rodada": com confirmação, fecha as sessões da rodada (`terminals.kill`) e tira do porão.

### Ao implementar (G16)

`CLAUDE.md` do dev-valley ganha a regra do porão e da rota que cria sessão; `README.md` ganha "porão / maestro" no mapa
"na vila → por baixo"; `OPERACAO.md` se algo mudar no jeito de subir.

## 7. Fora do escopo (por ora)

- Worktree por tarefa (decisão B).
- Reservas de arquivo desenhadas na vila.
- Sessão de trabalho criando outra sessão: nunca.
