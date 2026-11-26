# Execução paralela de agentes de código: isolamento, integração e arquivos de ponto de encontro

> Pesquisa de 25/11/2026. Complementa `docs-dev/context/sessoes-paralelas-fundamentos.md` (11/11/2026, regras R1 a R14)
> e `docs-dev/context/maestro-v3.md`. **Não repete** o que está lá: aprofunda o problema que apareceu na rodada real
> (duas sessões nos mesmos arquivos compartilhados, uma tarefa que deixou parte de fora), corrige o que envelheceu e
> traz o que faltava. Não é decisão: é base para decidir.
>
> Convenção de evidência usada em todo o texto:
> **[M]** medição (benchmark, estudo com dados, número de produção) ·
> **[D]** documentação oficial do fabricante (diz o que a ferramenta faz e o que o fabricante recomenda) ·
> **[O]** opinião/relato de praticante (experiência, sem experimento) ·
> **[A]** anedota de comunidade (um caso, um post).
> Todas as páginas citadas foram abertas nesta pesquisa, salvo onde está escrito "não consegui abrir".

---

## 1. Resumo de uma tela

1. **Ninguém resolveu escrita paralela no mesmo ponto; todo mundo contorna.** Os fabricantes isolam (worktree,
   container, VM) e empurram o encontro para o merge (PR). Os estudos que medem coordenação mostram que dois agentes
   fazendo duas tarefas que se tocam rendem **menos** que um agente fazendo as duas: −30% em média no CooperBench
   [M]; 62% → 16% em tarefas contraditórias no ParallACT, com Claude Code [M]. Canal de conversa entre eles não
   resolve: no CooperBench os canais ficam "cheios de mensagens vagas, fora de hora e imprecisas" [O; o resumo não mede
   o ganho da comunicação].
2. **Worktree não elimina o conflito: troca de lugar e de tipo.** Na mesma pasta o conflito é *ao vivo* (sobrescrita,
   leitura de estado pela metade). Em worktree ele vira *conflito de merge* (textual) e *conflito semântico* (merge
   limpo, comportamento quebrado). Em PRs reais de agentes, 19,8% dos pares concorrentes do mesmo agente dão conflito
   textual ao reaplicar o merge, 41,7% entre agentes diferentes [M]; e 47,3% dos conflitos acontecem **mesmo com
   conjuntos de arquivos disjuntos**, por causa de bases diferentes [M].
3. **A Anthropic mudou o padrão dela.** Sessões despachadas em background (agent view) agora entram num worktree
   **antes de editar**, por padrão; `/batch` divide uma mudança grande em 5 a 30 unidades, cada uma em worktree, cada
   uma com PR [D]. Isso não contradiz o estudo anterior: o padrão do fabricante é para tarefas independentes que viram
   PRs separados revisados por humano, que não é o caso de uma feature dividida em 3 a 5 partes que precisam compor.
4. **Quem roda trabalho longo de verdade serializa a escrita.** Factory (Missions): "execução serial com
   paralelização pontual funcionou melhor que paralelismo amplo"; paraleliza leitura, validação e dentro da feature
   [D/O]. Cognition (abr/2026): "escritas ficam single-threaded" [O]. Anthropic (harness para agentes longos):
   "uma feature por vez" [O]. É o mesmo recado do estudo anterior (R1), agora com mais fontes independentes.
5. **Os poucos resultados a favor da pasta compartilhada exigem coordenação no momento da escrita.** STORM (+18,7
   pontos sobre worktree no Commit0-Lite) e AgentRoom (NeurIPS 2026) mantêm todos no mesmo espaço, mas com detecção de
   conflito na escrita e "claims" de arquivo [M]. Os autores do AgentRoom concluem que o que importa é a
   **coordenação**, não o paralelismo. O maestro já está nessa família (mesma pasta + posse por hook); o que falta é o
   que fazer quando a posse recusa.
6. **Arquivo de ponto de encontro é problema de arquitetura, não de orquestração.** A engenharia humana resolveu o
   mesmo problema há anos mudando a forma do arquivo: um arquivo por entrada em vez de uma lista central (changelog
   do GitLab, 2018), timestamp em vez de número sequencial (migrations do Rails 2.1, 2008), registro por descoberta
   (component scan, glob), merge driver de união para listas append-only, e fila de merge que testa a combinação
   (GitHub merge queue; SubmitQueue da Uber) [D/M]. Para agentes, a OpenAI chega ao mesmo lugar: arquitetura em
   camadas com dependência só para frente, cobrada por linter, para que muitos agentes mexam sem pisar [O].
7. **A rodada real (11/11) não foi conflito entre tarefas** (diagnóstico conferido nos registros, seção 8): foi a
   mesma tarefa aberta duas vezes por uma corrida da orquestração, já corrigida e coberta por teste. O problema medido
   nas devolutivas é o **ambiente compartilhado** (pasta de build sujada por duas suítes ao mesmo tempo, dependência
   faltando, banco fora do ar, árvore misturada no commit). Fica aberto, como risco e não como causa, o mecanismo da
   posse: a recusa vira `ficou_de_fora` e nada transforma a lacuna em trabalho novo (a Factory transforma) [D].
8. **Direção que a evidência sustenta** (para discutir, não decidida): manter a mesma pasta com posse para os arquivos
   da feature; tirar os arquivos de ponto de encontro da posse disputada com uma de três saídas, em ordem de
   preferência: (a) mudar a forma do arquivo no projeto (um arquivo por feature + descoberta), (b) uma **tarefa de
   integração serial no fim**, dona única desses arquivos, que aplica os "pedidos de registro" que cada tarefa deixa na
   devolutiva, (c) contrato/esqueleto feito antes (tarefa 0, já prevista em R2). Worktree por sessão só compensa
   quando o ambiente sobe barato em cada cópia e o merge é feito por fila que roda o gate na combinação.

---

## 2. O que dizem os grandes

### 2.1 Anthropic

**Docs do Claude Code: worktrees** (`code.claude.com/docs/en/worktrees`, consultada 25/11/2026) [D]

- `claude --worktree <nome>` cria `.claude/worktrees/<nome>/` numa branch `worktree-<nome>`. A base padrão é a branch
  default **do remoto** (`worktree.baseRef: "fresh"`); `"head"` parte do HEAD local, "use isto quando isolar subagentes
  que precisam operar sobre trabalho em andamento". Para o maestro isso importa: com `fresh`, uma sessão não vê o que
  não foi commitado/pushado.
- "A worktree is a fresh checkout": dependências não vêm, `.env` não vem. `.worktreeinclude` copia arquivos ignorados
  pelo git; a página de best practices manda **não** pôr `node_modules` ali (copia, não liga) e aponta o setting
  `worktree.symlinkDirectories` para diretórios grandes.
- Isolamento é cobrado por quatro checagens (edição no checkout principal, diretório do comando, git redirecionado,
  forma do comando). A própria doc admite o limite: as checagens "não rastreiam quais arquivos um comando de shell
  escreve", então `cp` ou `>` para o checkout principal não são recusados por elas.
- **Hooks não seguem o worktree:** `${CLAUDE_PROJECT_DIR}` continua apontando para onde a sessão começou; o caminho do
  worktree chega no campo `cwd` da entrada do hook. Relevante se os hooks do porão um dia rodarem dentro de worktree.
- O que é compartilhado entre worktrees: o `.git`, plugins, **aprovações de permissão** ("don't ask again" grava no
  `settings.local.json` do checkout principal) e skills/agentes não versionados.
- Integração de volta: a página não descreve merge. Fala de manter, retomar e limpar worktree.

**Docs: agent view / sessões em background** (`code.claude.com/docs/en/agent-view`) [D]

- "Before editing files, Claude moves the session into an isolated git worktree under `.claude/worktrees/`, so
  parallel sessions can read the same checkout but each writes to its own." É o padrão; desliga com
  `worktree.bgIsolation: "none"`.
- Resultado volta como branch: "Claude commits without asking, and pushes the branch"; abre draft PR "quando a tarefa
  pede"; **nunca** push em `main`, force-push nem merge. Se o `CLAUDE.md` diz que o usuário cuida do git, Claude deixa
  o git com ele.
- Fora de repositório git: "avoid dispatching parallel sessions that edit the same files".
- *Não li* os últimos ~46 mil caracteres da página (a ferramenta cortou); o trecho sobre isolamento foi lido inteiro.

**Docs: run agents in parallel** (`code.claude.com/docs/en/agents`) [D]

- A pergunta de decisão oficial é literal: "Do the tasks touch the same files? Isolate the work with worktrees. [...]
  Agent teams don't isolate teammates in worktrees, so partition the work so each teammate owns a different set of
  files."
- `/batch`: "split one large change into 5 to 30 worktree-isolated subagents". Pela página de best practices, mostra o
  plano, espera aprovação, e cada unidade "gets its own worktree and opens a PR or reports what happened".

**Docs: agent teams** (`code.claude.com/docs/en/agent-teams`) [D]

- Continua experimental e desligado por padrão. Recomendações que se mantêm: 3 a 5 teammates; "Three focused
  teammates often outperform five scattered ones"; "5-6 tasks per teammate"; "Two teammates editing the same file leads
  to overwrites. Break the work so each teammate owns a different set of files."
- Novidade útil para o maestro: hooks `TaskCreated`, `TaskCompleted` e `TeammateIdle` com código 2 para **impedir**
  conclusão sem o critério (o mesmo que o hook `Stop` do porão faz com a devolutiva). A reivindicação de tarefa usa
  trava de arquivo ("file locking to prevent race conditions").
- "Start with research and review [...] without the coordination challenges that come with parallel implementation."

**Docs: best practices** [D]

- "When you have separate pieces of work going at once, give each its own checkout so the edits can't collide."
- Segunda sessão como revisor independente: "One session writes the rate limiter, another reviews [...] without having
  watched it being written". E um alerta novo: "A reviewer that's asked to find problems will always find
  *something*" (pedir para pular estilo).

**Engenharia: "Effective harnesses for long-running agents"** (26/11/2025) [O, com caso real]

- Padrão inicializador + agente de código; lista de features em **JSON** com campo `passes` (o modelo "é menos
  propenso" a reescrever JSON indevidamente que Markdown); arquivo de progresso; commit a cada passo.
- Falhas nomeadas: "tentar fazer demais de uma vez" (acaba o contexto no meio e deixa feature pela metade) e "declarar
  vitória cedo". Remédio: **uma feature por vez**. O texto não trata paralelismo; deixa como questão aberta se agentes
  especializados (teste, QA, limpeza) ajudam.

**Engenharia: compilador C com Claudes em paralelo** (fev/2026) [M, caso único]

O estudo anterior já cobre. Dois detalhes que faltavam e importam aqui:
- "Merge conflicts are frequent, but Claude is smart enough to figure that out." Cada agente, ao terminar, "pulls from
  upstream, merges changes from other agents, pushes its changes" e solta a trava.
- O caso que **quebrou** o paralelismo foi uma tarefa monolítica (compilar o kernel): os agentes "would hit the same
  bug, fix that bug, and then overwrite each other's changes". A solução não foi coordenação: foi **mudar a forma do
  problema** (GCC como oráculo compilando a maior parte, para cada agente pegar arquivos diferentes). É o mesmo
  princípio da seção 5.

**"Building effective agents"** (19/12/2024) [O]: paralelização em dois sabores, *sectioning* (subtarefas
independentes) e *voting* (mesma tarefa várias vezes); "encontrar a solução mais simples possível e só aumentar a
complexidade quando necessário".

### 2.2 OpenAI

- **Codex cloud** [D]: cada tarefa roda num container próprio com o repositório (`developers.openai.com/codex/cloud/environments`);
  cache de estado do container por até 12 h; internet do agente desligada por padrão. *Best-of-N* (várias respostas
  para a mesma tarefa) aparece só em anúncio repassado no fórum da comunidade; **não achei a página oficial** que
  descreva como as tentativas são isoladas.
- **Codex app: worktrees** (`learn.chatgpt.com/docs/environments/git-worktrees`, sem data) [D]: "Worktrees let Codex
  run multiple independent chats in the same project without interfering with each other"; worktree em HEAD
  destacado; também usa `.worktreeinclude`; "Hand off" move o trabalho entre o worktree e o checkout local, "Codex
  handles the Git operations". Não descreve tratamento de conflito.
- **"Harness engineering"** (11/02/2026) [O, caso real com números]: produto interno escrito só por Codex, ~1 milhão
  de linhas, ~1.500 PRs, 3 a 7 engenheiros, ~3,5 PRs por engenheiro por dia. O que importa para nós: **o app sobe por
  worktree**, com stack de observabilidade efêmera por mudança; arquitetura em camadas fixas com dependência só para
  frente e preocupações transversais entrando por **uma interface única** ("Providers"), cobrada por **linters e
  testes estruturais**; `AGENTS.md` de ~100 linhas como mapa; gates de merge mínimos e PRs curtos ("corrections are
  cheap, and waiting is expensive"). Antes da limpeza automática, ~20% da semana ia para limpar desvio gerado por
  agente. Não diz quantos agentes rodavam juntos.
- **Agents SDK** (doc multi-agente) [D]: orquestrar por código é "more deterministic and predictable, in terms of speed,
  cost and performance"; paralelo com `asyncio.gather` "when you have multiple tasks that don't depend on each other".
- *Não consegui ler* "A practical guide to building agents" (PDF veio como binário ilegível).

### 2.3 Google

- **ADK, ParallelAgent** (`adk.dev/agents/workflow-agents/parallel-agents/`) [D]: cada sub-agente roda num ramo
  próprio, sem compartilhar histórico durante a execução, mas **o estado da sessão é compartilhado**: "do not rely on
  one branch reading a key another branch is still writing". Padrão recomendado: cada ramo grava numa chave própria
  (`output_key`) e um agente **seguinte, sequencial**, junta. Para estado compartilhado de verdade, "use an external
  database, message queue, or other mechanism". Tradução para o maestro: escrita paralela em chaves disjuntas +
  integração serial no fim é o desenho oficial do framework.
- **Gemini CLI** (anúncio de subagentes, 15/04/2026, via busca) [D]: permite subagentes paralelos, e o próprio Google
  avisa contra usá-los em tarefas de edição pesada, citando "conflicting code changes" (reportado pela InfoQ). Não abri
  a doc completa.
- **Jules** [D/imprensa]: cada tarefa numa VM própria na nuvem, com o repositório clonado; integração por PR. Não
  achei nada oficial sobre tarefas que se tocam.

### 2.4 Cognition (Devin)

- **"Multi-Agents: What's Actually Working"** (22/04/2026) [O + um número de produto]: "setups where multiple agents
  contribute intelligence to a task while writes stay single-threaded"; enxames não estruturados são "mostly a
  distraction"; revisor funciona melhor quando "coding and review agents do not share any context beforehand". Sobre
  merge conflict, só diz que é caso em que o agente primário deve chamar o modelo mais forte.
- **"Devin can now manage Devins"** (19/03/2026) [D]: o coordenador "scopes the work, assigns each piece to a managed
  Devin, monitors progress, resolves any conflicts, and compiles the results"; cada filho numa VM própria. Os exemplos
  recomendados são todos de unidades homogêneas e independentes: QA por página, migração, auditoria por pacote,
  refatoração em lotes. **Não descreve** como resolve conflito.

### 2.5 Cursor, GitHub, Factory, Amp

- **Cursor** (`cursor.com/docs/configuration/worktrees`) [D]: "Each task gets its own files, dependencies, and changes
  while your main checkout stays untouched"; setup por `.cursor/worktrees.json`; **não recomenda** symlink de
  dependências ("can cause issues in the main worktree"), recomenda gerenciador rápido (pnpm, bun, uv); teto padrão de
  25 worktrees por máquina; `/best-of-n` "compares runs only. It does not merge changes back". A página não fala de
  conflito. No fórum, relatos de "Apply" que deixou arquivos de fora, aplicou na branch errada ou sumiu depois de usado
  [A].
- **GitHub Copilot (cloud/coding agent)** (`docs.github.com/.../about-cloud-agent`) [D]: ambiente efêmero do GitHub
  Actions, limite de 59 min por sessão, "can only work on one branch at a time and can open one pull request per task".
  Integração = PR revisado por humano.
- **Factory, "Missions"** (26/02/2026) [D/O + telemetria própria]: "Serial execution with targeted parallelization has
  worked better than broad parallelism"; "Missions parallelizes within features and during validation"; "Every
  milestone ends with a validation phase" e, quando a validação acha problema, "the orchestrator creates follow-up
  work to fix them before moving on"; "Git is the source of truth". Números de uso próprios: missão mediana ~2 h, a mais
  longa 16 dias; uma missão mediana usa **12× os tokens** de uma sessão normal. Na palestra (resumo da ZenML) o mesmo
  time diz que agentes em paralelo "conflict, overwrite each other's changes, duplicate work, and make inconsistent
  architectural decisions" [O].
- **Amp**: subagentes paralelos e um "oracle" (modelo mais forte, consultado sob pedido) [D]; não achei nada sobre
  isolamento de escrita nem worktree.

### 2.6 Leitura conjunta dos fabricantes

| Quem | Isolamento padrão para escrita | Como integra | O que faz com tarefas que se tocam |
|---|---|---|---|
| Claude Code (agent view, `/batch`) | worktree por sessão/unidade | branch + draft PR; nunca merge | particionar; teams sem worktree exigem arquivos disjuntos |
| Codex (cloud / app) | container por tarefa / worktree por chat | PR / "hand off" ao checkout local | não documentado |
| Cursor | worktree por agente | "Apply" / PR | não documentado |
| Copilot | VM do Actions por tarefa | um PR por tarefa | não documentado |
| Jules | VM por tarefa | PR | não documentado |
| Devin (managed) | VM por filho | coordenador "resolve conflitos" | não documentado; exemplos só com unidades independentes |
| Factory Missions | local ou container; serial | git; validação por marco | serializa a escrita |
| Google ADK | estado compartilhado, chave por ramo | agente sequencial depois | junção serial |

O padrão é claro: **isolar e devolver PR**, e deixar o encontro para o humano. Nenhum fabricante documenta uma solução
para duas tarefas paralelas que precisam do mesmo arquivo. Quem enfrenta isso de frente (Factory, Cognition, ADK)
serializa a escrita ou a junção.

---

## 3. Ferramentas da comunidade

| Ferramenta | Isolamento | Integração no fim | Status (25/11/2026) |
|---|---|---|---|
| claude-squad | tmux + worktree por sessão | commit/push da branch; diff no app | ativa |
| Conductor | "workspace, branch, files, terminal, diff" por tarefa | diff → PR → merge → arquiva | ativa (a página de docs não detalha worktree, portas nem conflito) |
| Crystal | worktree por sessão | não documentado | **descontinuado** (fev/2026), substituído por Nimbalyst |
| vibe-kanban | branch, terminal e dev server por workspace (worktree, pelo que a config sugere) | PR no GitHub | **em encerramento** ("sunsetting") |
| container-use (Dagger) | container novo **e** branch git por agente | `git checkout <branch>` para revisar | experimental |
| ccmanager | worktree por sessão, PTY próprio | criar/mesclar/apagar worktree no app; hook pós-criação; `.worktreeinclude` | ativa |
| MCP Agent Mail | **mesma pasta** ou worktrees, com "reservas" de arquivo (leases com TTL, por glob) | git normal; guarda opcional no pre-commit | ativa |
| clash / git-parsec / Grove | worktrees | **prevê** conflito entre worktrees antes do merge (`git merge-tree`, overlap de arquivo/hunk/símbolo) | iniciais |
| GitButler ("virtual branches") | **mesma pasta**, várias branches aplicadas ao mesmo tempo | commit de arquivos específicos em branches específicas | ativa |

Observações:
- A maioria converge em worktree + PR. Duas ficaram de fora do mainstream e são interessantes para o caso do maestro:
  **reserva de arquivo na mesma pasta** (Agent Mail, que é o que o porão já faz com o hook de posse) e **várias
  branches numa pasta só** (GitButler).
- Duas das ferramentas de worktree mais citadas em 2025 já morreram ou estão morrendo (Crystal, vibe-kanban). Sinal
  fraco, mas sinal: a orquestração de sessões está sendo absorvida pelas ferramentas oficiais (agent view, Codex app,
  Cursor Agents Window).

### 3.1 Relatos de uso (o que dá errado na prática) [O/A]

- **Worktree resolve arquivo, não ambiente.** Portas (dois dev servers na 3000), banco compartilhado (a migration de
  um agente quebra o outro), `.env`, serviços duplicados por cópia. Caso mais citado: o fundador de uma empresa de
  infraestrutura abandonou worktrees num monorepo TypeScript com PostgreSQL, Redis e ClickHouse porque "we spent more
  time on setup than shipping code"; foi para GitButler na mesma pasta (post de abr/2026, dev.to; anedota, e o texto
  promove o produto adotado).
- **Disco e instalação:** 200 a 500 MB de dependências por worktree num projeto Node típico; um usuário do Cursor
  relatou 9,82 GB para dois worktrees de um código de ~2 GB [A]; worktrees esquecidos acumulando gigabytes.
- **O conflito só muda de hora:** "isolation just moves the collision from mid-write to merge time"; arquivos de
  manifesto (`package.json`, `Cargo.toml`) conflitam no merge de qualquer jeito.
- **Conflito semântico:** dois agentes "consertaram" o mesmo bug em direções opostas; refatoraram a mesma função
  utilitária de jeitos diferentes. Worktree esconde isso até o fim.
- **Remédios recorrentes:** dividir posse por módulo antes de abrir (o que mais reduz conflito, segundo os relatos);
  merge em ordem fixa, um por vez, com rebase logo antes; rodar previsão de conflito (`git merge-tree`) durante o
  trabalho, não só no fim.
- **Simon Willison** (05/10/2025) [O]: roda vários agentes em diretórios/checkouts separados, sem worktree; o gargalo
  "is how fast I can review the results"; "I can only focus on reviewing and landing one significant change at a
  time", e paraleliza pesquisa, explicação de código, manutenção pequena e trabalho com spec já escrita.

Não encontrei discussões do Hacker News pela busca; os relatos acima vêm de blogs.

---

## 4. Academia e estudos

### 4.1 Novos desde o estudo anterior (todos abertos no arXiv, só o resumo)

| Estudo | O que mediu | Resultado | Leitura |
|---|---|---|---|
| **CooperBench** (jan/2026, arXiv 2601.13295) | 600+ tarefas, 12 bibliotecas, 4 linguagens; dois agentes, duas features que podem conflitar | "curse of coordination": **30% menos sucesso** trabalhando juntos do que fazendo as duas sozinho. Falhas: comunicação (mensagens vagas, fora de hora), compromisso (desviam do combinado), expectativa (supõem errado o plano do outro) | [M] Forte: benchmark grande, tarefas reais |
| **ParallACT** (out/2026, 2611.00314) | tarefas complementares (precisam compor numa interface) e contraditórias; oráculo = um agente com as duas | Paralelo fica bem pior; em contraditórias, **62% → 16%** com Claude Code + Opus 4.8. Saber que há outro agente "não ajuda significativamente"; canal de comunicação recupera "uma pequena parte" e custa tokens. Juntar as soluções depois "typically satisfies only one of the two specifications" | [M] Direto no ponto: é o caso dos arquivos de ponto de encontro |
| **AI Agent PRs on GitHub** (jul/2026, 2607.04697) | 33.596 PRs de agentes, 2.807 repositórios; merge reaplicado em 747 pares concorrentes | Conflito textual em **19,8%** dos pares do mesmo agente e **41,7%** entre agentes; 84,4% dos arquivos em conflito são código-fonte (não manifesto); ~42% dos conflitos são estruturais (modify/delete, add/add) | [M] Mundo real; mede PRs, não sessões de uma rodada |
| **AgenticFlict** (abr/2026, 2604.03551) | 142 mil PRs de agentes, 107 mil simulados | **27,67%** com conflito de merge; variação grande entre agentes | [M] Dataset; não separa tipo de arquivo no resumo |
| **MERGEGYM** (out/2026, 2610.04779) | 715 pares de PR, 167 conflitos | **47,3% dos conflitos com arquivos disjuntos** (bases diferentes); `git merge-tree` custa ~0,02 s, então "when exact replay is cheap, verify everything"; um gate de agendamento que desfaz sobreposição de escopo infla o tempo total em 65% | [M] Mostra que "posse disjunta" não basta quando as bases divergem |
| **STORM** (mai/2026, 2605.20563) | espaço de trabalho compartilhado com conflito detectado **na escrita**, contra baseline de worktree | **+18,7** no Commit0-Lite, **+1,4** no PaperBench; custo "comparável ou melhor" (sem número) | [M] Argumento explícito: worktree "defers conflict resolution to a post-hoc merge step where recovery is expensive" |
| **AgentRoom** (ago/2026, NeurIPS 2026, 2608.23740) | sistema de arquivos CRDT + claim/status/broadcast de arquivo como ferramentas MCP | 2 agentes abandonam menos tarefas que 1 (que "abandons up to half of hard tasks with a one-file stub-and-exit"); conclusão dos autores: coordenação, não paralelismo, é a escolha que importa | [M] Resumo sem números absolutos; escopo estreito (4 tarefas de backend) |

### 4.2 Conferência dos papers do estudo anterior

O `maestro-v3.md` registrou que as fontes da pesquisa anterior **não tinham sido conferidas**. Conferi os resumos de
quatro: os números batem, com uma correção.

- **Co-Coder** (2606.00953): os números são **"até"** 14,0% de aprovação, **"até"** 2,10× e **"até"** 35% de custo,
  em 28 tarefas. O estudo anterior os citou sem o "até": são máximos, não típicos. O resumo confirma que o método
  "isolates structural hub files".
- **SquidAgent** (2610.08647): confirmado 2,2× de throughput e 2,6× de tempo de parede contra o Claude Code; fork da
  sessão do orquestrador; bloco de convenções gerado antes. Aceito na NeurIPS 2026.
- **Concorrência dinâmica** (2610.10263): confirmados 354 tarefas, 2.124 execuções, 13 modos de falha específicos de
  concorrência. O resumo não lista quais são.
- **Modos de coordenação** (2607.27877): confirmados 10 topologias, 10 projetos, "over 30 points", tempo dobra;
  "structured pipelines converge fastest with the highest quality"; supervisão gerencial pesada degrada. São 100
  execuções no total (amostra pequena).
- Não conferi MAST, Cohere, METR nem DORA nesta rodada.

### 4.3 O que a academia diz, em conjunto

- **Consenso medido:** dividir tarefas que se tocam entre agentes que não compartilham contexto **piora** o resultado
  em relação a um agente com as duas tarefas (CooperBench, ParallACT). Conversa entre eles não resolve (CooperBench
  descreve os canais como cheios de mensagens vagas; não mede o ganho).
- **Divergência real:** onde coordenar. STORM e AgentRoom dizem "na escrita, mesmo espaço"; a indústria diz "isola e
  resolve no merge". Os dois resultados a favor do espaço compartilhado vêm de sistemas com coordenação explícita
  (claims, detecção na escrita), não de "mesma pasta sem regra".
- **Conflito disjunto:** quase metade dos conflitos em PRs aparece com arquivos disjuntos por causa de base diferente
  (MERGEGYM). Na mesma pasta isso não existe (todo mundo tem a mesma base o tempo todo); em worktree, existe.
- **Limite de toda essa evidência:** benchmarks de pares de tarefas (2 agentes), resumos de arXiv (li só o abstract),
  e quase nada com 3 a 5 sessões numa feature de CRUD com interface. A direção é consistente; os números não
  transferem.

---

## 5. O que a engenharia humana já sabe (e vale para agentes)

O problema "muita gente mexendo no mesmo arquivo central" é antigo. As soluções que sobreviveram mudam a **forma** do
arquivo ou a **ordem** das escritas, não a disciplina das pessoas.

| Prática humana | O que resolve | Evidência |
|---|---|---|
| **Um arquivo por entrada + compilação no fim** (changelog do GitLab: um YAML por merge request em `changelogs/unreleased/`, juntado na release, jul/2018) | lista central que todo mundo edita no mesmo ponto | [D/O] caso público; depois o GitLab trocou por changelog gerado de trailers de commit, que é o mesmo princípio levado ao extremo |
| **Espalhar o ponto de inserção** (GitLab, 2015: 100 linhas vazias no topo do changelog) | conflito por todos anexarem no fim | [O] o "90%" do título não tem medição no texto |
| **Merge driver de união** (`arquivo merge=union` no `.gitattributes`) | listas append-only (changelog, notas) | [D] funciona no git local; GitHub/Bitbucket historicamente não aplicam no botão de merge; pode duplicar ou desordenar linhas |
| **Timestamp em vez de número sequencial** (Rails 2.1, 2008) | duas migrations com o mesmo número | [O] motivação explícita: "avoid merge conflicts"; contra-argumento da época: o conflito servia para obrigar a conferir compatibilidade |
| **Detecção de "duas pontas"** (Django: "Conflicting migrations detected", `makemigrations --merge`) | duas migrations paralelas com o mesmo pai | [D] detecta, não resolve sozinho bem; casos em que o `--merge` falha |
| **Fila de merge que testa a combinação** (GitHub merge queue: branch temporária `main/pr-1`, `main/pr-2` com as anteriores; tira quem falha e reconstrói) | "passou sozinho, quebra junto" (conflito semântico) | [D] |
| **SubmitQueue** (Uber, EuroSys 2019) | mainline verde com milhares de mudanças | [M] ~40% de chance de conflito com só 16 mudanças concorrentes; iOS verde 52% do tempo numa semana antes; depois, sempre verde; duas mudanças são independentes se tocam **alvos de build disjuntos** |
| **Dono por caminho** (CODEOWNERS e afins) | decisão no arquivo central | prática corrente; serializa a revisão, não a escrita |
| **Registro por descoberta** (component scan do Spring, plugins por glob, rotas por pasta em frameworks com roteamento por arquivo) | arquivo de registro central (rotas, DI, menu) | conhecimento de engenharia; **não achei medição** |
| **Arquitetura em camadas cobrada por linter** (OpenAI, harness engineering) | agentes criando dependência cruzada | [O] caso real em escala, sem experimento controlado |

O princípio comum: **se toda feature precisa escrever no mesmo lugar, o lugar está mal desenhado para trabalho
paralelo**, seja de gente, seja de agente. A Uber formaliza a regra de independência (alvos disjuntos); o GitLab e o
Rails mudam a forma do arquivo; a fila testa a combinação porque merge limpo não prova nada.

---

## 6. Tabela comparativa dos modelos de isolamento

Escala: ✅ bom · ⚠️ depende · ❌ ruim. "Ponto de encontro" = rotas, menu, registro de permissão/DI, enums, índices,
migrations numeradas, lockfile.

| Critério | **Mesma pasta + dono por arquivo** (maestro hoje) | **Worktree por sessão** | **Container / sandbox por sessão** | **Branch por tarefa, em sequência** (uma pasta, uma tarefa por vez) |
|---|---|---|---|---|
| **Conflito ao vivo** (sobrescrita, ler estado pela metade) | ⚠️ evitado só no que o hook vê (Edit/Write); teste de uma tarefa vê o trabalho inacabado da outra (ensaio c3) | ✅ nenhum | ✅ nenhum | ✅ nenhum |
| **Conflito semântico** (cada parte certa, junto quebra) | ✅ aparece cedo: todos compilam e testam sobre o mesmo código | ❌ escondido até o merge; base diferente gera conflito até com arquivos disjuntos (47% no MERGEGYM) | ❌ igual ao worktree | ✅ não existe (cada tarefa parte da anterior) |
| **Custo de integração** | ✅ zero de merge; ❌ mas o arquivo disputado vira fila implícita ou trabalho deixado de fora | ❌ merge de N branches + resolver conflito + rodar gate na combinação | ❌ igual ao worktree, mais extrair o resultado | ✅ zero |
| **Custo de setup** (dependências, banco, portas) | ✅ zero: um ambiente | ⚠️ dependências por cópia (ou symlink, que o Cursor desaconselha); `.env` por `.worktreeinclude`; **portas e banco continuam compartilhados** se nada for feito | ❌ maior: imagem, serviços, banco por container; ✅ mas resolve portas e banco de vez | ✅ zero |
| **Visibilidade para o humano** | ✅ uma pasta, um diff, a vila vê tudo | ⚠️ N diffs em N lugares; precisa de ferramenta (agent view, Conductor) | ❌ fica dentro do container até extrair | ✅ um diff por vez |
| **Adequação a ponto de encontro** | ❌ hoje: o primeiro que edita fica dono até terminar; o segundo espera ou desiste | ⚠️ cada um edita sua cópia; conflito garantido no merge, quase sempre textual e fácil (listas), às vezes semântico | ⚠️ igual ao worktree | ✅ natural |
| **Ganho de tempo de parede** | ✅ real se as partes forem disjuntas | ✅ real, menos o tempo de merge | ✅ real, menos setup e merge | ❌ nenhum |
| **Cabe no Dev Valley hoje** | ✅ é o que existe | ⚠️ spawn, hooks (`CLAUDE_PROJECT_DIR` não segue), gate e relatório teriam que conhecer N pastas; pombal faria merge | ❌ fora do escopo (regra "WSL limpo") | ✅ trivial (é a sessão única) |

Leitura: nenhuma linha ganha em tudo. A mesma pasta perde **só** na linha do ponto de encontro e no "teste vê trabalho
inacabado"; o worktree resolve a primeira à custa de mover o conflito para o fim e esconder o semântico. Como o
problema concreto é **um punhado de arquivos conhecidos**, tratar esses arquivos custa menos do que trocar o modelo
inteiro.

---

## 7. Técnicas para os arquivos de ponto de encontro

Ordenadas da que mais remove o problema para a que mais o administra.

### T1. Mudar a forma do arquivo: um arquivo por feature + descoberta automática

Cada feature cria **seu** arquivo de rotas, de menu, de permissões; o central só importa/descobre por convenção
(scan de componentes, glob, roteamento por pasta, lazy loading por feature).

- **Prós:** elimina o conflito na origem, para agentes e humanos; cada tarefa fica dona só de arquivos novos (a posse
  atual já funciona); é a solução que o GitLab e a OpenAI adotaram em seus contextos.
- **Contras:** é mudança de arquitetura no projeto-alvo, não no maestro; depende do que a stack permite (descoberta
  por glob depende do bundler; em Java/Spring o scan já faz isso para beans, mas enum central de permissão não se
  divide sozinho); ordem do menu e prioridade de rota passam a vir de um campo, não da posição no arquivo. Decisão de
  arquitetura: pede aprovação do usuário por projeto.

### T2. Tarefa de integração serial no fim (dona única dos arquivos de encontro)

As tarefas de feature **não tocam** os arquivos de encontro. Cada uma escreve na devolutiva um bloco "pedidos de
registro" (a rota, o item de menu, a permissão que precisa, com o texto exato). Quando todas ficam prontas, uma tarefa
de integração (ou a própria vila, se o formato for mecânico) aplica os pedidos e roda o gate.

- **Prós:** é o padrão do ADK (chave por ramo + agente sequencial que junta) e do "map-reduce-and-manage"; usa
  infraestrutura que o maestro já tem (`dependeDe`, devolutiva, gate); os arquivos de encontro ficam com um dono
  declarado, então o hook de posse deixa de ser corrida; a lacuna vira trabalho explícito em vez de `ficou_de_fora`.
- **Contras:** o teste de cada feature roda **sem** o registro (a rota não existe até a integração), então o aceite
  por tarefa fica mais fraco e o peso vai para o gate final; uma sessão a mais no caminho crítico (pequena); o pedido
  de registro precisa de formato fixo, ou a integração reinterpreta e inventa.

### T3. Contrato/esqueleto antes (tarefa 0)

Antes das features, uma tarefa cria no arquivo de encontro **todos** os pontos de entrada (rotas apontando para
componentes vazios, itens de menu, permissões), e as features só preenchem os próprios arquivos.

- **Prós:** já está previsto (R2 e item 3 do v3); dá às features um alvo que compila e um teste que já passa; é o
  "bloco de convenções gerado antes" do SquidAgent.
- **Contras:** exige saber antes o nome e o formato de tudo (se a feature descobre no meio que precisa de outra rota,
  volta ao problema); é mais uma sessão com custo fixo; se a tarefa 0 for pequena demais, R3 diz que não vale sessão
  (pode ser feita pela sessão do maestro ou pelo usuário antes do clique).

### T4. Merge driver de união / formato append-only

Para arquivos que são de fato listas sem ordem relevante (changelog, notas, certas listas de registro), `merge=union`
ou um arquivo com uma entrada por linha.

- **Prós:** custo quase zero; resolve o conflito textual no git.
- **Contras:** só vale em modelo com merge (worktree/branch); na mesma pasta não há merge; não serve para código
  estruturado (vírgula, colchete, ordem); pode duplicar entradas; GitHub não aplica no merge pela interface.

### T5. Geração de código

O arquivo de encontro é **gerado** de uma fonte (pasta de features, anotações, um manifesto por feature) por um
script que a vila ou o gate rodam.

- **Prós:** igual à T1 em efeito, sem depender de recurso de descoberta do framework; o gerado não é editado por
  ninguém, então não tem dono a disputar.
- **Contras:** mais uma peça para manter; o agente precisa saber que não edita o gerado (regra + hook); diferença
  entre gerado e versionado vira fonte de confusão se o script não roda no gate.

### T6. Trava de arquivo com fila (em vez de "primeiro fica dono até terminar")

Trava de curta duração por **edição** (lease com TTL, como o Agent Mail), não por tarefa inteira: a segunda sessão
espera alguns segundos e edita depois, sobre a versão já atualizada.

- **Prós:** mantém a mesma pasta; resolve a sobrescrita; o `Edit` do Claude Code já falha se o arquivo mudou desde a
  leitura, o que ajuda.
- **Contras:** **não resolve o conflito de decisão** (duas sessões reordenando o mesmo menu de jeitos diferentes); o
  teste de uma vê a meia-edição da outra; exige que a sessão saiba esperar e reler (o agente tende a desistir ou a
  contornar). É a técnica que os estudos dizem ser insuficiente sem coordenação de intenção.

### T7. Worktree só para os arquivos de encontro? (não existe)

Vale registrar: não há meio-termo limpo. Ou a sessão inteira está numa cópia, ou não está. Um worktree "só para a
rota" é, na prática, a T2.

### T8. Fila de merge e rebase contínuo (se um dia houver worktree)

Merge um por vez, rebase logo antes, gate rodando sobre a combinação (como `main/pr-1`, `main/pr-2`); previsão de
conflito com `git merge-tree` durante a rodada (custa ~0,02 s por par).

- **Prós:** é o que a engenharia em escala usa e o que pega o conflito semântico; barato de rodar.
- **Contras:** só faz sentido com worktree/branch; resolver o conflito ainda exige alguém (o usuário ou uma sessão de
  integração); com 3 a 5 branches de uma mesma feature, o conflito nos arquivos de encontro é **certo**, então a fila
  só organiza um trabalho que a T1/T2 eliminaria.

### T9. Stacked PRs / tarefas empilhadas

Cada tarefa parte da anterior (B parte de A), e o merge é em pilha.

- **Prós:** sem conflito entre as camadas; revisão por camada.
- **Contras:** é serialização disfarçada; o paralelismo só existe se B puder começar antes de A terminar, e aí volta o
  problema da base. Para o maestro, equivale a `dependeDe` com sessões em sequência.

### Resumo das técnicas

| Técnica | Remove o conflito? | Custa | Onde mora a mudança |
|---|---|---|---|
| T1 Um arquivo por feature + descoberta | sim | refatorar o projeto uma vez | projeto-alvo |
| T5 Geração | sim | script + gate | projeto-alvo |
| T2 Integração serial no fim | sim, para a rodada | uma sessão curta no fim; aceite por tarefa mais fraco | maestro (briefing, devolutiva, `dependeDe`) |
| T3 Esqueleto antes | sim, se o esqueleto acerta | uma tarefa antes | maestro |
| T4 Union merge | só textual, só com merge | quase zero | projeto-alvo |
| T6 Lease curto | só a sobrescrita | hook | vila |
| T8 Fila de merge | não; organiza | infraestrutura de merge | vila/pombal |
| T9 Empilhar | sim, sem paralelismo | perde o ganho | maestro |

---

## 8. A rodada real à luz disto (diagnóstico conferido em 25/11/2026)

A primeira versão desta seção era hipótese (só o hook de posse tinha sido lido). Conferido no cartão, nas devolutivas e
no `RETRABALHO.md`:

1. **O cartão estava certo.** Nenhuma tarefa que rodava junto declarava arquivo de outra; os arquivos de ponto de
   encontro (rotas, menu, registro de área) estavam listados por **uma** tarefa só. As únicas repetidas eram de duas
   tarefas em que uma dependia da outra.
2. **A causa foi a orquestração, não a divisão.** O clique em "Abrir" e a volta automática corriam juntos e abriam
   cada tarefa livre **duas vezes**; as duas cópias tinham o mesmo nome de tarefa, e o hook de posse (que compara a
   tarefa, não a sessão) as tratou como a mesma dona. Uma cópia regravou os arquivos da outra. Corrigido no mesmo dia
   (trava única) e coberto por teste por propriedade; nenhuma das 5 rodadas seguintes registra choque de escrita.
3. **O que as devolutivas mostram de recorrente é o ambiente:** duas suítes ao mesmo tempo sujando a mesma pasta de
   build (centenas de erros falsos, verdes na segunda vez), dependência não instalada e banco fora do ar derrubando
   testes, e arquivos de outras sessões misturados na hora do commit.
4. **Riscos latentes que o estudo aponta e a rodada não exercitou:** (a) arquivo de ponto de encontro não listado vira
   de quem editar primeiro; (b) a recusa vira `ficou_de_fora` sem virar tarefa; (c) a posse é por nome de tarefa, não
   por sessão (foi o que deixou a cópia duplicada passar).

---

## 9. O que muda ou se confirma nas regras R1–R14

| Regra | Veredito | O que esta pesquisa acrescenta |
|---|---|---|
| **R1** Paralelize leitura, serialize escrita | **Confirmada e reforçada** | CooperBench (−30%), ParallACT (62% → 16%), Factory ("serial com paralelização pontual"), Cognition 2026 ("writes stay single-threaded"). Ajuste: "serializar escrita" vale **por ponto de escrita**, não pela rodada inteira; paralelizar os arquivos da feature e serializar os de encontro é compatível com R1. |
| **R2** Um dono por arquivo e por decisão; hubs viram tarefa 0 | **Confirmada, incompleta** | Co-Coder isola "hub files" (confirmado no resumo). Falta o par da tarefa 0: a **tarefa de integração no fim** (T2), para o caso em que o esqueleto não dá para prever. E falta dizer o que acontece quando a posse recusa (seção 8). |
| **R3** Tarefa pequena não vira sessão | Confirmada | Factory: sessão normal mediana ~8 min, missão ~2 h, missão usa 12× os tokens; reforça que o custo fixo é real. Corolário: a tarefa de integração da T2 pode ser feita pela vila (mecânica) ou pelo usuário, sem sessão. |
| **R4** Contrato antes do spawn | **Confirmada, com campo novo** | ParallACT: falha é de interface entre partes. SquidAgent: bloco de convenções antes. Campo novo no contrato: **"pontos de encontro que esta tarefa precisa e quem os aplica"**. |
| **R5** DAG e caminho crítico | Confirmada | MERGEGYM: um gate que desfaz sobreposição de escopo custa ~65% de tempo total; quem serializa paga, então o DAG deve serializar só o necessário (os arquivos de encontro, não a tarefa inteira). |
| **R6** Padrão 3, teto 5 | Confirmada | Doc oficial mantém 3–5 e "three focused often outperform five scattered". Sem medição nova. |
| **R7** Verificação é o gargalo | **Confirmada e afinada** | Gate na **combinação** é o que pega o conflito semântico (merge queue, SubmitQueue). O v3 já faz isso no fim; com T2, o gate final passa a ser **o** aceite que importa. Hooks `TaskCompleted` (exit 2) do agent teams são a mesma ideia do `Stop` do porão. |
| **R8** Revisor de contexto limpo | Confirmada | Cognition 2026 reafirma; a doc de best practices acrescenta: pedir para ignorar estilo, ou o revisor sempre acha algo. |
| **R9** Estado em arquivo | Confirmada | Harness da Anthropic: lista de features em JSON (o modelo mexe menos indevidamente que em Markdown). Ponto a considerar para os "pedidos de registro" da T2: formato estruturado, não prosa. |
| **R10** Contexto cirúrgico | Confirmada | OpenAI: `AGENTS.md` de ~100 linhas como mapa. |
| **R11** Orçamento e critério de morte | Confirmada, sem dado novo | Factory: 12× tokens por missão mediana. |
| **R12** Medir contra sessão única | **Reforçada** | Os dois benchmarks novos usam exatamente isso (oráculo de agente único) e o paralelo perde. É a comparação que decide. |
| **R13** Isolamento proporcional ao risco; worktree opt-in | **Mantida, com correção de contexto** | O estudo anterior disse "worktree por padrão: não copiar". A Anthropic adotou worktree **por padrão** para sessões em background e `/batch`. As duas coisas são compatíveis: o padrão oficial serve tarefas independentes que viram PRs separados; o maestro divide uma feature que precisa compor. Novos custos conhecidos do worktree: base `fresh` não vê trabalho local não commitado; hooks com `CLAUDE_PROJECT_DIR` não seguem; aprovações "don't ask again" vazam para o checkout principal; portas e banco continuam compartilhados. |
| **R14** Gate humano só onde importa | Confirmada | Devin managed: por padrão abre filhos sem perguntar; o porão continua mais conservador (um clique por rodada), e a evidência não pede mudar. |

**Correção factual ao estudo anterior:**
- Co-Coder: os números são máximos ("up to"), não médias.
- Seção 3 do estudo anterior: "Agent view / background — Worktree próprio antes de editar" está certo; vale
  acrescentar que é o **padrão** e que desliga com `worktree.bgIsolation: "none"`; e que `/batch` (5 a 30 unidades em
  worktree, cada uma com PR) não aparecia.
- As quatro referências de arXiv conferidas (Co-Coder, SquidAgent, concorrência dinâmica, modos de coordenação)
  existem e dizem o que o estudo atribuiu a elas.

**Regra candidata nova (R15), para discutir:** *Arquivo de ponto de encontro não entra em disputa de posse.* Antes do
spawn, o maestro lista os arquivos que mais de uma tarefa precisa tocar e escolhe, por rodada, uma saída: esqueleto
antes (T3), integração no fim (T2) ou, se o projeto já tem, descoberta (T1). Uma recusa de posse em arquivo de
encontro é erro de plano, não algo para a sessão contornar.

---

## 10. Consensos, divergências e qualidade da evidência

**Consensos (várias fontes independentes, tipos diferentes):**
- Escrita paralela no mesmo ponto rende menos que uma sessão (CooperBench, ParallACT [M]; Factory, Cognition [O];
  docs Anthropic e Google [D]).
- Particionar por arquivo/módulo antes de abrir é o que mais reduz conflito (docs Claude Code [D]; relatos [O];
  Co-Coder [M]; Uber [M], com "alvos de build disjuntos").
- Worktree isola arquivo, não ambiente; o conflito vai para o merge (docs [D]; relatos [O]; STORM [M]).
- Merge limpo não prova composição; precisa de teste na combinação (GitHub merge queue [D], SubmitQueue [M], relatos).
- Revisão humana é o limite prático de quantas frentes de escrita valem a pena (Willison, Osmani [O]).

**Divergências:**
- **Onde coordenar:** isolar e resolver no merge (todos os fabricantes) × coordenar na escrita, mesmo espaço (STORM,
  AgentRoom, GitButler, Agent Mail). A evidência medida a favor do espaço compartilhado é recente, de benchmark, e
  depende de coordenação explícita.
- **Paralelizar escrita ou não:** Anthropic e Cursor vendem paralelismo de escrita com worktree; Factory e Cognition
  dizem que, para trabalho que compõe, serial ganha. A diferença some quando se olha o tipo de tarefa: independentes
  (PRs separados) × partes de uma coisa só.
- **Quantos:** doc oficial 3–5 por time; `/batch` 5–30 unidades (mecânicas); Devin exemplos com 10. Não há medição que
  compare esses números para tarefas que compõem.

**Qualidade:**
- O melhor dado novo é acadêmico e de 2026, lido **só pelo resumo**. Benchmarks de 2 agentes; não há estudo com 3 a 5
  sessões numa feature com rotas/menu/permissão.
- Os números de fabricante (Factory, OpenAI, Devin) são de produção, sem grupo de controle.
- Os relatos de comunidade são consistentes entre si, mas vêm de blogs, vários com produto a vender.

---

## 11. Perguntas que ficam para o usuário

1. Nos projetos onde o maestro roda, dá para fazer a **T1** (um arquivo por feature + descoberta) para rotas, menu e
   permissões? É decisão de arquitetura, por projeto.
2. Se não, prefere **T2** (integração no fim, com "pedidos de registro" na devolutiva) ou **T3** (esqueleto antes)?
   A T2 aguenta descoberta no meio do caminho; a T3 dá teste por tarefa mais forte.
3. A integração da T2 é mecânica o bastante para a vila aplicar sem modelo, ou precisa de uma sessão?
4. A recusa de posse deve continuar mandando "deixe de fora", ou deve virar sinal para a vila criar trabalho de
   continuação (que pela regra 10 precisaria de aprovação no cartão)?
5. Worktree fica onde está (MA-4, opt-in por gatilho)? Esta pesquisa não dá motivo para adotá-lo como padrão do
   maestro, e dá motivos novos de custo (portas, banco, hooks, aprovações).

---

## 12. Fontes

Data entre parênteses quando a página traz; "consultada" = página sem data, lida em 25/11/2026.

### Anthropic
1. Claude Code, Run parallel sessions with worktrees (consultada): https://code.claude.com/docs/en/worktrees [D]
2. Claude Code, Agent view, "How file edits are isolated" (consultada; ~1/3 final da página não lido): https://code.claude.com/docs/en/agent-view [D]
3. Claude Code, Run agents in parallel (consultada): https://code.claude.com/docs/en/agents [D]
4. Claude Code, Agent teams (consultada): https://code.claude.com/docs/en/agent-teams [D]
5. Claude Code, Best practices (consultada): https://code.claude.com/docs/en/best-practices [D]
6. Effective harnesses for long-running agents (26/11/2025): https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents [O]
7. Building a C compiler with a team of parallel Claudes (fev/2026): https://www.anthropic.com/engineering/building-c-compiler [M, caso]
8. Building effective agents (19/12/2024): https://www.anthropic.com/engineering/building-effective-agents [O]

### OpenAI
9. Harness engineering: leveraging Codex in an agent-first world (11/02/2026): https://openai.com/index/harness-engineering/ [O, caso]
10. Codex app, Git worktrees (sem data): https://learn.chatgpt.com/docs/environments/git-worktrees [D]
11. Codex cloud environments (via busca): https://developers.openai.com/codex/cloud/environments [D]
12. Agents SDK, Multi-agent orchestration: https://openai.github.io/openai-agents-python/multi_agent/ [D]
13. Fórum: Codex generates multiple responses simultaneously (best-of-N; anúncio repassado): https://community.openai.com/t/codex-generates-multiple-responses-simultaneously/1287639 [A]
14. **Não consegui ler:** A practical guide to building agents (PDF binário): https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf

### Google
15. ADK, Parallel agents: https://adk.dev/agents/workflow-agents/parallel-agents/ [D]
16. Subagents have arrived in Gemini CLI (15/04/2026; lido via busca/InfoQ, não aberto): https://developers.googleblog.com/en/subagents-have-arrived-in-gemini-cli/ [D]
17. Jules (anúncio; lido via busca): https://blog.google/technology/google-labs/jules/ [D]

### Cognition, Cursor, GitHub, Factory, Amp
18. Cognition, Multi-Agents: What's Actually Working (22/04/2026): https://cognition.com/blog/multi-agents-working [O]
19. Cognition, Devin can now manage Devins (19/03/2026): https://cognition.com/blog/devin-can-now-manage-devins [D]
20. Cursor, Worktrees: https://cursor.com/docs/configuration/worktrees [D]
21. Fórum do Cursor, relatos sobre "Apply" de worktree (fim de 2025 a início de 2026): https://forum.cursor.com/t/agent-on-worktree-not-applying-all-changed-files-to-main-branch/143231 [A]
22. GitHub, About Copilot cloud agent: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent [D]
23. Factory, Missions (26/02/2026): https://factory.com/news/missions [D/O]
24. ZenML LLMOps Database, resumo da palestra da Factory sobre Missions (2026): https://zenml.io/llmops-database/multi-agent-software-development-system-with-extended-autonomous-execution [O, secundário]
25. Amp, Oracle: https://ampcode.com/news/oracle [D] (nada achado sobre isolamento de escrita)

### Ferramentas da comunidade
26. claude-squad: https://github.com/smtg-ai/claude-squad
27. Conductor docs: https://www.conductor.build/docs/
28. Crystal (descontinuado, fev/2026): https://github.com/stravu/crystal
29. vibe-kanban (em encerramento): https://github.com/BloopAI/vibe-kanban
30. container-use (Dagger): https://github.com/dagger/container-use
31. ccmanager: https://github.com/kbwo/ccmanager
32. MCP Agent Mail (reservas de arquivo): https://github.com/Dicklesworthstone/mcp_agent_mail (lido via busca)
33. clash e ferramentas de previsão de conflito (via busca): https://github.com/clash-sh/clash

### Relatos de praticantes
34. Simon Willison, Embracing the parallel coding agent lifestyle (05/10/2025): https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ [O]
35. We ditched worktrees for Claude Code (abr/2026, dev.to): https://dev.to/maverickdotdev/we-ditched-worktrees-for-claude-code-heres-what-we-use-instead-5b22 [A]
36. Git worktrees: from running multiple agents to real multi-agent development (mar/2026, dev.to): https://dev.to/vibehackers/git-worktrees-from-running-multiple-agents-to-real-multi-agent-development-7dh [O]
37. Parallel worktrees + clash-style conflict prediction (14/05/2026): https://codeongrass.com/blog/parallel-worktrees-conflict-prediction/ [O]
38. Demais relatos de dev.to/MindStudio citados na seção 3.1 foram lidos só pelo resumo da busca (portas, banco, disco).

### Academia
39. CooperBench: Why Coding Agents Cannot be Your Teammates Yet (jan/2026): https://arxiv.org/abs/2601.13295 [M]
40. Decentralized Multi-Agent Coordination and Communication in Shared Codebases / ParallACT (out/2026): https://arxiv.org/abs/2611.00314 [M]
41. AI Agent Pull Requests on GitHub: Frequency, Structure, and Merge Conflict Rates (jul/2026): https://arxiv.org/abs/2607.04697 [M]
42. AgenticFlict (abr/2026, AIware 2026): https://arxiv.org/abs/2604.03551 [M]
43. Asymmetric Repository Lineage Modeling and Verifier-Guided Coordination in Concurrent AI Coding Agents / MERGEGYM (out/2026): https://arxiv.org/abs/2610.04779 [M]
44. Multi-agent Collaboration with State Management / STORM (mai/2026): https://arxiv.org/abs/2605.20563 [M]
45. AgentRoom: Concurrent Multi-Agent Coding in a CRDT-Backed Shared Workspace (ago/2026, NeurIPS 2026): https://arxiv.org/abs/2608.23740 [M]
46. Conferidos do estudo anterior: Co-Coder https://arxiv.org/abs/2606.00953 · SquidAgent https://arxiv.org/abs/2610.08647 · Dynamic concurrency https://arxiv.org/abs/2610.10263 · Coordination mode https://arxiv.org/abs/2607.27877

### Engenharia de software humana
47. Uber, Keeping master green at scale (EuroSys 2019), resumo de Adrian Colyer: https://blog.acolyer.org/2019/04/18/keeping-master-green-at-scale/ · página da Uber: https://www.uber.com/blog/research/keeping-master-green-at-scale [M]
48. GitHub, Managing a merge queue: https://docs.github.com/en/enterprise-server@3.17/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue [D]
49. GitLab, Solving GitLab's changelog conflict crisis (03/07/2018; lido via busca): https://about.gitlab.com/blog/solving-gitlabs-changelog-conflict-crisis/ [O]
50. GitLab, placeholders no changelog (10/02/2015): https://about.gitlab.com/blog/gitlab-reduced-merge-conflicts-by-90-percent-with-changelog-placeholders/ [O; "90%" sem medição no texto]
51. Rails, discussão de timestamped migrations (2008; lido via busca): https://discuss.rubyonrails.org/t/timestamped-migrations/31715 [O]
52. Django, ticket sobre "Conflicting migrations detected" (lido via busca): https://code.djangoproject.com/ticket/25047 [D]
53. `merge=union` (RuboCop PR, lido via busca): https://github.com/rubocop-hq/rubocop/pull/3594 [A]

---

**Como envelhece:** os resultados de 2026 estão no resumo dos papers; ler o texto completo de ParallACT e CooperBench
antes de citar número em decisão. O que deve durar: o conflito de escrita é de decisão, não de arquivo; isolar só muda
quando ele aparece; e arquivo que toda feature precisa tocar se resolve mudando o arquivo ou a ordem, não a disciplina
de quem escreve.
