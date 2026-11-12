# Sessões paralelas no Claude Code: o que a evidência diz

> Pesquisa de 11/11/2026, feita para reformular o maestro do Dev Valley.
> **Isto não é um plano nem uma decisão fechada.** É a base de evidência: o que funciona, o que
> não funciona, com que confiança, e o que isso implica para o maestro. Onde a evidência é fraca,
> está dito. Fontes no fim, com tipo e data.
>
> Documento irmão: `docs-dev/context/maestro-v2.md` (o que está codado hoje) e
> `docs-dev/context/maestro.md` (histórico do desenho).

## 1. A resposta curta

1. **Paralelizar não multiplica a velocidade por N.** Você troca tempo de execução por tempo de
   coordenação, revisão e integração. O ganho depende de quanto do trabalho é realmente
   independente.
2. **O gargalo muda de lugar.** Com uma sessão, o gargalo é escrever. Com várias, o gargalo é
   verificar, integrar e revisar. Sem capacidade de revisão, paralelizar só produz mais código
   não conferido.
3. **A evidência mais forte é para leitura, revisão e planejamento.** Pesquisa paralela, revisão
   com contextos independentes e planejamento distribuído são os casos em que o ganho aparece de
   forma consistente.
4. **Escrita paralela funciona com condição.** Só quando as tarefas são independentes, grandes o
   bastante, com spec clara, testes automáticos e arquivos disjuntos.
5. **Funciona mal em arquitetura e em tarefa pequena.** Decisão de arquitetura e tarefa de
   minutos não pagam o custo fixo da rodada.
6. **Os números convergem:** 3 a 5 sessões é o ponto de equilíbrio; 3 a 7 vezes mais tokens em
   times de código; ganhos de 2 vezes são possíveis, mas condicionais; e desenvolvedor experiente
   em repositório maduro pode ficar **19% mais lento** com IA, mesmo achando que ficou 20% mais
   rápido (METR).
7. **O maestro v2 já acertou a espinha dorsal:** estado em arquivo, um único escritor, dependências,
   uma aprovação, sem recado entre sessões. O v3 não precisa recomeçar; precisa endurecer
   contrato, verificação, orçamento e métrica.
8. **A recomendação central:** tratar o maestro como um **escalonador de contratos independentes
   com gate de verificação e limite de WIP**, não como um enxame.

## 2. Como ler esta pesquisa (qualidade da evidência)

Nem toda fonte vale o mesmo. Esta tabela é parte do resultado, não rodapé.

| Tipo de fonte | Exemplos | O que dá para concluir | Limite |
|---|---|---|---|
| **Documentação oficial** | Claude Code: agent teams, subagentes, worktrees, custos, workflows | O que a ferramenta faz, limites conhecidos, recomendação do fabricante | É o fabricante; não é medição independente |
| **Engenharia da Anthropic** | Sistema multi-agente de pesquisa, compilador C, context engineering | Arquitetura e números de casos reais | Casos escolhidos; não são RCTs |
| **Papers** | MAST, Agentless, Co-Coder, SquidAgent, Cohere, estudos de coordenação | Comparações controladas, taxonomias, efeitos medidos | Benchmarks estreitos; nem todo arXiv é revisado |
| **Estudos independentes** | METR (RCT), DORA (survey) | Efeito no mundo real, com incerteza | Amostra, contexto e data limitam a generalização |
| **Praticantes** | Cognition, Addy Osmani, HumanLayer, Boris Cherny | Padrões que funcionam e falhas observadas | Experiência, não experimento controlado |
| **Relatos de comunidade** | Issues do GitHub, benchmarks de blog | Modos de falha concretos | Anedótico; não generalizar |

**Regra de leitura:** não somar números de fontes diferentes. “7× de tokens” de agent teams,
“15×” de pesquisa multi-agente e “3–7×” de times de código medem coisas diferentes. Cada número
vale no contexto em que foi medido.

## 3. O mapa das opções no Claude Code

O Claude Code tem hoje cinco formas de trabalho paralelo, além do isolamento por worktree e da
mensageria entre sessões. Elas não são intercambiáveis.

| Abordagem | Quem coordena | Isolamento | Comunicação | Custo | Quando usar |
|---|---|---|---|---|---|
| **Subagentes** | A sessão principal, turno a turno | Contexto próprio; volta um resumo | Resultado volta ao chamador | Menor que time; cada subagente gasta tokens | Pesquisa, leitura, revisão, tarefa lateral que sujaria o contexto |
| **Agent view / background** | Você, por uma tela de triagem | Worktree próprio antes de editar | Só com você | Uma sessão por tarefa | Várias tarefas independentes que você despacha e revisa depois |
| **Agent teams** | Um lead + lista de tarefas compartilhada | Contexto próprio; **sem worktree automático** | Mensagem direta entre pares | ~7× uma sessão em plan mode (doc oficial); 3–7× em relatos | Pesquisa, revisão, hipóteses concorrentes, módulos independentes. Experimental |
| **Sessões manuais + worktrees** | Você | Um checkout e branch por sessão | Você copia ou usa mensageria | Uma sessão por worktree | Você quer controle total e isolamento de arquivo |
| **Cross-session messaging** | As próprias sessões | Não isola arquivo | Texto entre sessões | Cada mensagem recebida conta como um turno | Avisar uma sessão do que a outra mudou; não é estado |
| **Dynamic workflows** | Um script | Subagentes; pode isolar por worktree | Resultados em variáveis do script | Muitos agentes; roda em background | Tarefa grande, repetitiva ou verificável em massa (auditoria, migração) |
| **Projects / cloud** | Claude, no cloud | Sessões na nuvem | Threads | Conforme plano | Trabalho de dias, que continua com a máquina desligada |

**O que o maestro usa hoje:** sessões de terminal na vila, com briefing em arquivo, devolutiva em
arquivo, hooks de posse e dependências. É uma variante de **sessões manuais coordenadas por uma
vila**, não de agent teams. Essa escolha está alinhada com a evidência (seção 7).

**Agent teams não é o caminho para a vila.** A documentação oficial lista limitações que batem de
frente com o desenho do Dev Valley: sem retomada de sessão com teammates in-process, status de
tarefa que atrasa e bloqueia dependentes, um time por sessão, sem times aninhados, lead fixo, sem
modo de permissão por teammate no spawn, e conflito de arquivo se dois teammates editam o mesmo
arquivo. O v2 já decidiu copiar as ideias (lista com estado, dependências, aviso automático) sem
adotar o recurso. A pesquisa confirma a decisão.

## 4. O que a evidência mostra de ganho

### 4.1 Pesquisa e leitura paralela: o caso mais forte

O sistema de pesquisa multi-agente da Anthropic é o experimento mais citado:

- **15× mais tokens** que um chat; **4×** para um agente sozinho.
- **90,2%** de melhora sobre um único agente Opus 4 em avaliação interna de pesquisa.
- **Até 90%** de redução de tempo em consultas complexas.
- O gasto de tokens, sozinho, explica **80% da variância** de desempenho: o ganho vem muito mais
  de “pensar com mais tokens” do que de a arquitetura ser magicamente melhor.

O próprio texto diz onde isso **não** se aplica: “a maioria das tarefas de código tem menos partes
verdadeiramente paralelizáveis do que pesquisa”, e “agentes LLM ainda não são ótimos em coordenar
e delegar para outros agentes em tempo real”. Ou seja: o caso de maior sucesso da Anthropic é
**leitura e síntese**, não escrita de código.

**Para o maestro:** pesquisa de biblioteca, levantamento de arquivos, revisão de código e
comparação de hipóteses são os usos com melhor retorno. Tarefa de escrita deve seguir outro
regime.

### 4.2 Revisão com contexto limpo: o segundo caso mais forte

A Cognition, que em 2025 escreveu “não construa multi-agentes”, revisou a posição em 2026:

- **Vários agentes podem contribuir com inteligência; a escrita continua single-threaded.**
- O padrão que funciona é **gerador-verificador**: um revisor começa com contexto completamente
  limpo, lê o diff e reconstruói o entendimento, em vez de herdar as suposições do autor.
- O Devin Review encontra **cerca de 2 bugs por PR, 58% deles graves** (lógica, edge case,
  segurança).
- O argumento é o “context rot”: sessões longas tomam decisões piores; o contexto curto do revisor
  o deixa mais afiado.

**Para o maestro:** um revisor de contexto limpo é a adição de maior valor por token. Não precisa
revisar tudo: priorize tarefas que mexem em dinheiro, dado, autenticação, migração ou interface
compartilhada.

### 4.3 Módulos independentes e planejamento

**Compilador C da Anthropic (fev/2026).** 16 agentes Opus 4.6, cada um em seu container Docker,
com um repositório git compartilhado, **sem orquestrador central**. Coordenação por arquivos de
lock em `current_tasks/` e pelo próprio git; agentes resolviam seus merge conflicts. Em duas
semanas: quase **2.000 sessões**, **2 bilhões de tokens de entrada**, 140 milhões de saída,
**menos de US$ 20 mil**, ~100 mil linhas de compilador em Rust, Linux 6.9 bootável em x86, ARM e
RISC-V, ~99% de aprovação nas suítes de teste.

O que fez funcionar, segundo o autor:

- **Testes excelentes** como especificação. “O agente otimiza exatamente para o que o teste mede.”
- **Decomposição por falha independente**: primeiro testes separados, depois projetos open-source
  separados, depois debugging diferencial contra o GCC.
- **Sessões curtas** e arquivos de estado (README, progresso) porque cada container novo não tem
  contexto.
- **Lock files** para possuir tarefa, e merge conflict como parte do fluxo.

O que isso **não** prova: que 5 sessões numa feature de CRUD vão render 2×. O compilador é o
**teto** de um problema monolítico decomposto com testes excepcionais, não o caso rotineiro. O
próprio autor lista limitações: sem codegen 16-bit nativo, assembler e linker incompletos, código
gerado mais lento que GCC sem otimização, Rust abaixo de nível especialista.

**Cohere (out/2026).** Times de agentes de código superam o agente solo, mas custam **3–7×**.
O achado mais útil é sobre **onde** colocar o paralelismo:

- Delegar **só o planejamento** para workers, com o lead implementando e verificando, iguala a
  delegação completa por **metade do custo**.
- Um lead forte com planejadores baratos captura **47,5%** do ganho de qualidade de um time todo
  forte por **13,9%** do custo adicional.
- Implementadores baratos reduzem qualidade.
- Implementadores e verificadores **platôam depois de 4**; mais planejadores continuam ajudando.
- Um time heterogêneo de 17 agentes chegou a **1,4 ponto** de um time uniforme de 5 agentes fortes
  custando **70% menos**.

**Co-Coder (2026).** Trata a orquestração como **partição de grafo**: nós são unidades de trabalho,
arestas são dependências. O conflito central é **comunicação versus computação**: dividir encurta o
caminho crítico, mas dependências que cruzam fronteiras custam contexto e latência. Com grafo de
dependência por análise estática, isolamento de “arquivos hub” e scheduler por dependência:
**+14% de aprovação, 2,10× de speedup, 35% menos custo de API** em 28 tarefas. Os ganhos foram
maiores nos projetos **mais densos em dependência**, desde que a partição fosse feita com coesão.

**SquidAgent (2026).** Decide paralelizar **por camada de dependência**, não globalmente. Só
paraleliza se o custo do caminho crítico mais o overhead de reexploração e alinhamento for menor
que o caminho serial. Resultado: **2,2× de throughput** e **2,6× de wall-time** contra o Claude
Code. Duas ideias práticas: workers nascem de um **fork da sessão do orquestrador** (herdam
decisões e evitam reexploração) e um **bloco de convenções compartilhado** é gerado antes da
execução, transformando alinhamento em custo upfront limitado.

**Estudo de modos de coordenação (2026).** Dez topologias, dez projetos full-stack. Mudar a
topologia, com as mesmas tarefas e modelos, move a nota em **mais de 30 pontos** e pode **dobrar o
tempo**. “Pipelines estruturados convergem mais rápido e com melhor qualidade”; “supervisão
gerencial pesada degrada o desempenho”. Coordenação é variável de primeira ordem, não detalhe de
implementação.

### 4.4 O teto teórico: por que não é só “contratar mais agentes”

Três resultados clássicos explicam o que os papers medem:

- **Lei de Amdahl:** o speedup é limitado pela fração serial. Se 30% do trabalho é serial
  (especificar, integrar, revisar), o máximo é ~3,3×, mesmo com infinitos agentes.
- **Lei de Brooks:** comunicação cresce com \(n(n-1)/2\). “Adicionar pessoas a um projeto atrasado
  o deixa mais atrasado.” Vale para agentes: cada par a mais é um canal a mais.
- **Universal Scalability Law (Gunther):** \(C(N) = N / (1 + \sigma(N-1) + \kappa N(N-1))\). O
  termo \(\kappa\) é o custo de coerência (coordenação). Com \(\kappa > 0\), a curva **sobe, faz
  pico e cai**: passou de um ponto, adicionar workers deixa o sistema mais lento.

**Para o maestro:** o teto de 5 não é timidez; é a região onde a curva ainda pode subir. Para um
único humano revisando, o pico prático é menor (seção 6).

### 4.5 O que isso significa

Paralelismo é **multiplicador de um processo bom**, não conserto de um processo ruim. Se a spec é
vaga, o teste é fraco e a revisão é gargalo, mais sessões só multiplicam o retrabalho.

## 5. O que a evidência mostra de custo e falha

### 5.1 Tokens: o custo não é só o trabalho, é o contexto recarregado

- **Agent teams:** ~**7×** os tokens de uma sessão padrão quando os teammates rodam em plan mode
  (doc oficial de custos). Relatos independentes falam em **3–4×** para times menores e **3–7×**
  em times de código.
- **Pesquisa multi-agente:** **15×** um chat.
- **Custo por desenvolvedor:** média empresarial de ~**US$ 13 por dia ativo** e **US$ 150–250 por
  mês**; 90% abaixo de **US$ 30 por dia ativo**. Rodar múltiplas instâncias e automação sobe isso.
- **Por que caro:** cada sessão carrega CLAUDE.md, ferramentas, skills e os arquivos que precisa
  ler. O cache de prompt ajuda, mas não elimina a reconstrução de contexto. O compilador C chama
  isso de “containers novos sem contexto”: cada sessão precisa de README e arquivo de progresso
  para não reexplorar.
- **Custo fixo da rodada:** briefings, mapeamento, aprovação, leitura inicial de cada sessão e
  relatório. Foi o que fez a primeira rodada do maestro levar ~26 min antes de qualquer código.

### 5.2 O gargalo humano: verificação, não geração

- **Addy Osmani:** “a geração não é mais o gargalo; a verificação é.” A capacidade de revisão é o
  limite prático: **WIP de 3–5**, um revisor para cada **3–4** construtores. “Não rode mais
  agentes do que você consegue revisar de forma significativa.”
- **DORA 2025** (~5.000 respondentes): adoção de IA tem relação **positiva** com throughput e
  **negativa** com estabilidade de entrega. “IA não conserta um time; ela amplifica o que já
  existe.” 90% usam IA; ~30% têm pouca ou nenhuma confiança no código gerado.
- **METR (jul/2025):** 16 desenvolvedores experientes, 246 tarefas reais em repositórios maduros.
  Com IA, levaram **19% mais tempo** (IC +2% a +39%). Antes, previram **24% mais rápido**; depois,
  acreditavam ter sido **20% mais rápido**. A percepção errou nos dois sentidos.
- **METR (fev/2026, replicação):** a direção inverteu: **−18%** para os desenvolvedores originais
  (IC −38% a +9%) e **−4%** para novos (IC −15% a +9%). Os dois intervalos incluem zero. Os
  próprios autores chamam de **evidência muito fraca**, por seleção (quem não trabalha sem IA não
  aceita o grupo de controle), pagamento menor e **30–50% dos desenvolvedores admitindo guardar
  tarefas em que a IA iria bem**. Além disso, rodar vários agentes ao mesmo tempo quebrou a
  medição de tempo por tarefa.
- **Lição:** não é “IA deixa mais lento”; é **percepção não é medida**. Quem paraleliza precisa
  medir wall-clock, retrabalho e revisão, não sensação de velocidade.

### 5.3 Falhas de coordenação: o problema é projeto, não modelo

**MAST — “Why Do Multi-Agent LLM Systems Fail?” (NeurIPS 2025 Spotlight).** Mais de 1.600 traces,
7 frameworks, 14 modos de falha em 3 categorias:

1. **Especificação / desenho do sistema:** desobedecer spec, desobedecer papel, repetir passo,
   perder histórico, não saber quando terminar.
2. **Desalinhamento entre agentes:** reset de conversa, não pedir esclarecimento, desvio de tarefa,
   retenção de informação, ignorar o outro, raciocínio-ação inconsistente.
3. **Verificação:** terminar cedo, não verificar, verificar errado.

O estudo relata que **melhorar a spec de papel** deu **+9,4%** de sucesso e **adicionar verificação**
deu **+15,6%**, com o mesmo modelo. A conclusão é que a falha vem principalmente de **desenho e
coordenação**, não de capacidade bruta do modelo.

**Cognition — “Don't Build Multi-Agents” (2025).** Dois princípios:

- Compartilhe o **histórico completo**, não mensagens isoladas.
- **Ações carregam decisões implícitas**; decisões conflitantes produzem resultados ruins.

O exemplo do Flappy Bird: um agente faz o cenário no estilo Super Mario, outro faz o pássaro
incompatível; o resultado não compõe. Reenviar a tarefa original não resolve, porque o problema é
a suposição conflitante, não a instrução vaga. A recomendação é **single-threaded linear** por
padrão; no máximo, compressão de contexto por um modelo dedicado.

**Limitações oficiais dos agent teams:** sem retomada com teammates in-process, status de tarefa
atrasado, shutdown lento, um time por sessão, sem times aninhados, lead fixo, sem modo de permissão
por teammate no spawn, prompts de permissão sobem para o lead, e conflito de arquivo se dois
editam o mesmo arquivo. Relatos de comunidade documentam custos de coordenação concretos: lead
girando em notificações de idle e **13–22% dos tokens de entrada em acks inúteis** (issue
#47930), teammate duplicado dobrando tokens sem aparecer (issue #32996), e lead perdendo os
próprios teammates depois de compactação.

**Estudo de concorrência dinâmica (2026).** 354 tarefas, 2.124 execuções, Codex/Claude Code/Kimi
Code. Concorrência ajuda tarefas de horizonte longo, mas é **instável** e pode **reduzir** o
sucesso em tarefas curtas. Foram catalogados **13 modos de falha específicos de concorrência** e
28 padrões observáveis.

### 5.4 Contexto e qualidade: cada sessão é uma nova chance de esquecer

- **HumanLayer (12-Factor Agents, fator 10):** agentes pequenos e focados, **3–10, no máximo ~20
  passos**. Quanto maior a tarefa, mais passos e mais contexto; “conforme o contexto cresce, o LLM
  se perde ou perde foco”.
- **Anthropic (context engineering):** contexto é recurso finito com retorno marginal
  decrescente; cada token novo consome orçamento de atenção. Subagentes existem para isolar
  trabalho e devolver **um resumo de 1.000–2.000 tokens**, não o histórico bruto. Compactação
  agressiva demais perde contexto sutil.
- **Consequência para o maestro:** o briefing e a devolutiva são o mecanismo de handoff. Se eles
  não carregam decisões, interfaces e critérios de aceite, a sessão seguinte reexplora ou decide
  diferente.

### 5.5 Simplicidade vence mais vezes do que parece

**Agentless (FSE 2025).** Contra a moda de agentes autônomos complexos, um pipeline fixo de três
fases (localizar, reparar, validar patch) alcançou **32,00%** no SWE-bench Lite a **US$ 0,70 por
issue**, melhor que vários agentes open-source bem mais elaborados. A conclusão: pipeline simples
e interpretável tem potencial subestimado; complexidade autônoma não é pré-requisito.

**Para o maestro:** antes de adicionar uma camada de coordenação, pergunte se um pipeline fixo
(contrato → executar → testar → revisar) resolve. Na maioria das rodadas pequenas, resolve.

## 6. Quando paralelizar vale a pena: o modelo de decisão

### 6.1 Os cinco pré-requisitos (se um falhar, não paralelize)

1. **Independência real.** As tarefas não compartilham arquivo, interface ou decisão de
   arquitetura. Conflito de arquivo não é “resolvível com merge”; é decisão conflitante.
2. **Tamanho mínimo.** Cada tarefa vale **45–60 min** de uma sessão. Abaixo de ~30 min, o custo
   fixo (briefing, leitura, revisão) come o ganho. A doc oficial diz “tarefa pequena: overhead de
   coordenação excede o benefício”; a comunidade converge para “só compensa acima de ~30 min”.
3. **Spec e critério de aceite.** Objetivo, entradas, saídas, arquivos, interfaces, testes de
   aceite e definição de pronto. Spec vaga se propaga por todas as sessões (MAST; Osmani: “sua spec
   é a alavanca”).
4. **Verificação automática.** Teste, typecheck, lint ou script que diga “passou” ou “falhou” sem
   opinião. Sem isso, o agente otimiza para o que você olhar, não para o que importa.
5. **Capacidade de revisão.** Você consegue revisar os N resultados em tempo menor que o ganho.
   Para um único humano, **2–3 sessões de escrita** já é bastante; 5 só para leitura/revisão ou
   tarefas mecânicas muito independentes.

### 6.2 O cálculo de break-even

```
Custo da rodada =
  N × (leitura de contexto + trabalho)
  + briefings + coordenação + integração + revisão + retrabalho

Ganho =
  (tempo sequencial estimado)
  − (caminho crítico + coordenação)
  − (tempo de revisão)
  − (retrabalho esperado)
```

Exemplo ilustrativo, com números redondos:

- 4 tarefas de 30 min, uma sessão cada, sem dependências.
- Sequencial: 120 min.
- Rodada: 4 × 10 min de leitura inicial = 40 min; trabalho em paralelo ~30 min; revisão 4 × 10 min
  = 40 min. Total ~110 min. Ganho de 10 min, dentro do ruído.
- Se cada tarefa for de 15 min: sequencial 60 min; rodada ~40 min de leitura + 15 min de trabalho
  + 40 min de revisão = 95 min. **Pior que fazer sozinho.**

A conta muda com:
- **Assinatura versus API.** Em assinatura, o custo marginal não é dólar, é cota e rate limit. Em
  API, é dólar. O break-even econômico é diferente; o break-even de **atenção** é o mesmo.
- **Cache de prompt.** Sessões que compartilham prefixo ficam mais baratas; sessões que leem
  arquivos diferentes, não.
- **Modelo.** Planejamento barato, implementação forte, verificação forte (Cohere). Implementador
  barato reduz qualidade.

### 6.3 O que paralelizar e o que não

| Situação | Paralelizar? | Por quê |
|---|---|---|
| Pesquisa, leitura, comparação de fontes | **Sim, forte** | Ganho consistente; pouco conflito de escrita |
| Revisão de PR por lentes independentes (segurança, performance, testes) | **Sim, forte** | Contextos separados reduzem ancoragem; evidência de bugs encontrados |
| Módulos/features com arquivos disjuntos e interface acordada | **Sim, condicional** | Ganho real, mas exige contrato e teste |
| Planejamento de uma tarefa grande | **Sim, com modelo barato** | Cohere: é o melhor uso do paralelismo; lead implementa |
| Hipóteses concorrentes de bug | **Sim** | Investigação read-only; debate reduz ancoragem |
| Refatoração mecânica em muitos arquivos | **Sim, via workflow/batch** | Muitas unidades homogêneas; não é o caso do maestro |
| Decisão de arquitetura, contrato de API, modelo de dado | **Não** | Decisão precisa de um dono; paralelizar dispersa |
| Duas tarefas no mesmo arquivo | **Não** (ou worktree + merge) | Escrita concorrente gera perda ou conflito |
| Tarefa de minutos | **Não** | Custo fixo maior que o ganho |
| Spec vaga, sem teste | **Não** | Ambiguidade multiplicada; verificação impossível |
| Quando você é o único revisor e já está sobrecarregado | **Não** | Mais código não revisado não é throughput |

### 6.4 Quantas sessões

- **Padrão: 3.** É o ponto onde a curva de coordenação ainda sobe para a maioria dos times e para
  um humano revisando.
- **Teto: 5.** Só com independência real, arquivos disjuntos e capacidade de revisão. A doc oficial
  recomenda 3–5; para um único usuário, 5 é exceção, não meta.
- **Leitura/revisão: até 5.** Como não há escrita concorrente, o risco é menor; o custo de revisão
  ainda existe.
- **Workflow/batch: dezenas.** Para tarefas homogêneas e verificáveis em massa, o padrão certo é
  script (dynamic workflow, `/batch`), não o maestro.

## 7. Arquiteturas que funcionam (e o que copiar)

| Padrão | Como funciona | Evidência | Melhor para | Risco |
|---|---|---|---|---|
| **Orchestrator-worker** | Lead planeja, workers pesquisam, lead sintetiza | Anthropic research: 90,2%, 15× tokens | Pesquisa, leitura, síntese | Caro; lead não steering em tempo real; trabalho dependente |
| **Single writer + readers/reviewers** | Vários leem/revisam; um escreve | Cognition: 2 bugs/PR; “writes stay single-threaded” | Código, revisão, consultoria | Writer vira gargalo; revisão precisa de contexto limpo |
| **Blackboard / estado em arquivo** | Repositório + arquivos de estado + locks; sem orquestrador onisciente | Compilador C: 16 agentes, 2.000 sessões, US$ 20 mil | Trabalho longo, decomponível, com testes | Merge conflict; exige disciplina de estado |
| **DAG + scheduler por camada** | Grafo de dependência; paraleliza só onde compensa | Co-Coder: 2,10×; SquidAgent: 2,2× | Projetos com dependências densas | Precisa de análise de dependência; erra se o grafo erra |
| **Worktree por tarefa** | Checkout e branch isolados; merge depois | Claude Code worktrees; Conductor/Claude Squad | Sessões independentes, experimentos | Merge/integração; ambiente duplicado; não é fronteira de segurança |
| **Generator-verifier** | Autor e revisor com contextos separados | Cognition; `/code-review` oficial | Qualidade, segurança, dados | Custo extra; revisor pode não ter contexto suficiente |
| **Scripted workflow** | Script segura o plano; agentes executam | Dynamic workflows | Auditoria, migração, muitos itens | Sem input no meio; exige script bem escrito |
| **Map-reduce-and-manage** | Gerente divide, filhos executam, gerente sintetiza | Cognition (2026) | Escopo maior | Gerente superprescreve; estado compartilhado é ilusório |

### 7.1 O que copiar para o maestro

**Recomendação:** blackboard (já é o v2) + DAG com caminho crítico + single writer + gate de
verificação + revisor de contexto limpo. Worktree como exceção, não padrão.

Por quê:
- O v2 já tem o blackboard (devolutiva, `rodada.json`, hooks) e o single writer (a vila). Isso é
  mais próximo do padrão que funcionou no compilador C do que dos agent teams.
- O que falta é **contrato**, **grafo com caminho crítico**, **gate de verificação**, **orçamento**
  e **métrica**.
- Worktree é útil quando duas tarefas **precisam** do mesmo arquivo ou quando o experimento pode
  ser descartado; o custo de merge e de ambiente duplicado não se paga no caso comum.
- Revisor de contexto limpo é a adição de maior retorno por token, desde que usado por risco, não
  em toda tarefa.

### 7.2 O que não copiar

- **Enxame completo** (muitos agentes, muitos recados): coordination study mostra que supervisão
  gerencial pesada degrada; MAST mostra falhas de coordenação; USL mostra retrogression.
- **Recado entre sessões como estado:** o v2 já removeu; a mensageria custa turno e perde
  informação. Arquivo é a verdade.
- **Worktree por padrão:** isola, mas não elimina o custo de integração; no projeto pequeno,
  ordenar é mais barato.
- **Mais de 5 sessões de escrita:** o gargalo humano chega antes.
- **Agente-revisor sem contexto:** revisor que não vê o diff e o critério de aceite só palpite.

## 8. Fundamentos e regras propostos para o maestro v3

Estas são **propostas para discussão**, não decisões fechadas. Cada regra traz o porquê e a
evidência.

### R1. Paralelize leitura; serialize escrita

**Regra:** tarefas read-only (pesquisa, revisão, exploração, comparação) podem rodar em paralelo.
Tarefas de escrita no mesmo arquivo ou na mesma decisão rodam em série, ou em worktree com merge
explícito.

**Por quê:** ações carregam decisões implícitas; dois escritores no mesmo ponto produzem escolhas
incompatíveis (Cognition). A doc oficial alerta para conflito de arquivo; o compilador C usa lock
files; Co-Coder e SquidAgent só paralelizam camadas independentes.

**Como aplicar:** o contrato da tarefa declara “arquivos que escreve” e “interfaces/decisões que
toca”. Se dois contratos tocam o mesmo arquivo ou a mesma interface, o segundo vira dependente do
primeiro.

### R2. Um dono por arquivo e por decisão

**Regra:** cada arquivo tem um dono por vez. Arquivos “hub” (entrada do servidor, rotas, tipos
compartilhados, `package.json`, CSS global) são uma **tarefa 0** feita sozinha antes das demais.
`PROGRESS.md` e `PENDENCIAS.md` são logs append-only compartilhados, não posse.

**Por quê:** conflito de arquivo é a falha mais citada nos agent teams; conceptual integrity
(Brooks) exige uma autoridade de desenho; Co-Coder isola hubs justamente porque são os pontos de
acoplamento.

**Como aplicar:** o maestro monta a matriz de conflito e o DAG; a vila nega edição de arquivo de
outra tarefa viva (já faz); o briefing lista as interfaces que a tarefa pode consumir, mas não
alterar sem tarefa 0.

### R3. Tarefa pequena não vira sessão

**Regra:** cada tarefa de escrita deve valer **45–60 min** de uma sessão. Abaixo de ~30 min,
agrupe em uma sessão ou faça na sessão principal. Acima de ~2 h, divida por arquivo ou interface.

**Por quê:** custo fixo por sessão (briefing, leitura, revisão, contexto); doc oficial diz que
tarefa pequena tem overhead maior que benefício; a primeira rodada do maestro teve ~26 min de
custo fixo antes de código.

**Como aplicar:** o maestro estima o tamanho no intake; se a tarefa é pequena, propõe agrupar. O
relatório registra o tamanho real para calibrar a estimativa.

### R4. Contrato antes do spawn

**Regra:** nenhuma sessão nasce sem contrato escrito com: objetivo, entradas, saídas, arquivos que
escreve, interfaces que consome/altera, testes de aceite, dependências, risco, orçamento, modelo e
definição de pronto.

**Por quê:** MAST mostra que falha de especificação e de papel domina; Anthropic diz que delegação
precisa de “objetivo, formato de saída, orientação de ferramentas e limites claros”; Osmani chama a
spec de alavanca.

**Como aplicar:** o briefing atual ganha os campos que faltam. Se o maestro não consegue preencher
o contrato, a tarefa não está pronta: ele pergunta ao usuário em vez de inventar.

### R5. DAG e caminho crítico, não lista

**Regra:** o maestro monta um grafo de dependências, identifica o caminho crítico e paraleliza
apenas o que está **fora** dele. Se o caminho crítico concentra >70% do trabalho, recomenda sessão
única.

**Por quê:** Amdahl; Co-Coder (partição por grafo, 2,10×); SquidAgent (paraleliza por camada e
serializa o acoplado); agent teams já usam lista com dependências.

**Como aplicar:** o cartão mostra a ordem e o caminho crítico; a vila abre dependentes
automaticamente (já faz). O relatório mostra o tempo de parede e quanto foi ganho de verdade.

### R6. Padrão 3, teto 5, WIP limit

**Regra:** **3 sessões de escrita** por padrão; **5** só com independência real, arquivos disjuntos
e capacidade de revisão. Uma sessão de revisão para cada 3–4 de escrita, quando houver revisor.
Não abrir nova sessão enquanto uma estiver esperando decisão do usuário.

**Por quê:** doc oficial 3–5; Osmani WIP 3–5 e um revisor por 3–4; USL mostra retrogression; para
um único humano, 3 já é bastante.

**Como aplicar:** o pedido ao porão tem teto configurável; o maestro justifica se pedir 4–5. A vila
mostra o WIP e o que está esperando.

### R7. Verificação é o gargalo

**Regra:** nenhuma tarefa é “pronta” sem o comando de verificação do contrato sair 0 (teste,
typecheck, lint ou script). A devolutiva registra antes → depois. Teste vermelho = tarefa falha,
não “quase pronta”. O humano revisa a integração, não cada linha.

**Por quê:** Osmani: “a geração não é mais o gargalo; a verificação é”; MAST: verificação +15,6%;
DORA: throughput sobe, estabilidade cai; o compilador C mostra que o agente otimiza para o teste,
então o teste é a spec.

**Como aplicar:** o hook `Stop` atual só cobra a devolutiva; o v3 acrescenta o gate de teste. A
vila pode rodar o comando do contrato antes de marcar pronta, ou exigir o output no arquivo. Se
falhar, a tarefa fica “falhou” e o usuário decide.

### R8. Revisor de contexto limpo

**Regra:** para tarefa de risco médio/alto (dinheiro, dado, autenticação, migração, interface
compartilhada), um revisor read-only recebe o diff, o contrato e os critérios de aceite, sem o
raciocínio do autor. Achados voltam ao autor ou ao usuário; o revisor não commita.

**Por quê:** Cognition: gerador-verificador com contexto limpo, ~2 bugs/PR, 58% graves; doc oficial
`/code-review` usa subagente fresco; context rot.

**Como aplicar:** o revisor é uma sessão ou subagente com ferramentas de leitura; entra no
orçamento como custo extra; o relatório registra quantos achados e quantos viraram correção.

### R9. Estado em arquivo, não em recado

**Regra:** o estado da rodada vive em `rodada.json` e nas devolutivas. A vila é a única escritora.
Mensagem entre sessões serve para “preciso de decisão” e “terminei”, nunca para estado. Transições
idempotentes: reexecutar não duplica.

**Por quê:** o v2 já aprendeu isso (PRONTA perdido); Anthropic diz que coordenação em tempo real é
fraca; compilador C usa blackboard e locks; mensageria custa turno; MAST inclui retenção de
informação.

**Como aplicar:** manter o desenho do v2. Se houver mensagem, o arquivo continua sendo a verdade.
O relatório é montado dos arquivos, não de memória.

### R10. Contexto cirúrgico, não dump do repo

**Regra:** o briefing aponta os arquivos, interfaces e decisões relevantes; a sessão lê o que
precisa, não o projeto inteiro. `CLAUDE.md`/`AGENTS.md` e `PROGRESS.md` são memória compartilhada;
o resto é sob demanda. Sessões curtas são melhores que sessões longas.

**Por quê:** context engineering (Anthropic): contexto finito, retorno decrescente; HumanLayer:
3–10, no máximo ~20 passos; cada sessão recarrega contexto; subagentes devolvem resumo de
1.000–2.000 tokens.

**Como aplicar:** o briefing ganha uma seção “leia primeiro” e “não precisa ler”. O maestro evita
mandar “leia o projeto”; mapeia por grep/Explore.

### R11. Orçamento e critério de morte

**Regra:** cada tarefa tem orçamento de tempo/tokens e a rodada tem teto. Em 85% do orçamento,
pausa e avisa. Três tentativas sem progresso ou três voltas no mesmo erro = matar e reatribuir.
Modelo: planejamento pode ser barato; implementação e verificação, fortes.

**Por quê:** 7× de tokens em agent teams; Osmani MAX_ITERATIONS=8 e “3+ travado, mate”; Cohere:
planejador barato, implementador forte; Cohere: implementador barato reduz qualidade.

**Como aplicar:** a vila lê tokens/tempo do transcript ou do status; o relatório mostra custo por
tarefa e por entrega aceita. O maestro declara o orçamento no contrato.

### R12. Medir contra a sessão única

**Regra:** toda rodada tem linha de base: quanto tempo a mesma lista levaria em uma sessão (estimativa
declarada antes) e, quando possível, uma tarefa de controle feita em sessão única. Medir wall-clock,
tokens, primeiro passe sem retrabalho, retrabalho, conflitos, tempo de revisão e defeitos escapados.
Sem medida, não afirmar ganho.

**Por quê:** METR: percepção errou por 39 pontos percentuais; DORA: throughput sobe e estabilidade
cai; G4 do projeto já exige antes/depois; a primeira rodada do maestro mostrou que o custo fixo
pode comer o ganho.

**Como aplicar:** `rodada.json` ganha tempos e tokens; o relatório ganha uma seção “custo e ganho”;
a cada 3 rodadas, uma retrospectiva compara com a sessão única.

### Duas regras de corolário

**R13. Isolamento proporcional ao risco.** Mesma árvore com posse de arquivo é o padrão. Worktree
entra quando: (a) duas tarefas precisam do mesmo arquivo e ambas são urgentes; (b) o experimento
pode ser descartado; (c) a tarefa é longa e bloquearia as outras. Quem integra é uma tarefa de
merge, com teste de integração. Worktree não é fronteira de segurança.

**R14. Gate humano só onde importa.** O usuário aprova a rodada, ação irreversível, integração/merge
e spec ambígua. Não aprova cada passo. Decisões são em lote; o humano é o gargalo, então o processo
deve minimizar interrupções, não multiplicá-las.

## 9. O que o maestro v2 já acerta

| Decisão do v2 | Evidência | Veredito |
|---|---|---|
| Devolutiva em arquivo, hook `Stop` | Blackboard do compilador C; Anthropic context engineering; PRONTA perdido no v1 | **Manter** |
| Vila como única escritora do estado | Um escritor evita corrida; compilador C usa locks | **Manter** |
| Dependências no cartão | Agent teams e Co-Coder; Amdahl | **Manter e reforçar com caminho crítico** |
| Uma aprovação por rodada | Gate humano em lote; MAST (spec) | **Manter** |
| Sem `COMECEI`/`PRONTA`/recados | Cognition; coordenação em tempo real é fraca | **Manter** |
| Relatório montado pela vila, sem modelo | Custo zero; evita hora inventada | **Manter** |
| Usuário divide as tarefas | Spec é alavanca; MAST | **Manter** |
| Hooks de posse de arquivo | Conflito de arquivo é a falha nº 1 | **Manter** |
| Teto 5 | Doc oficial 3–5; para um humano, 5 é exceção | **Ajustar para 3 padrão** |
| “Não vale paralelizar” | Custo fixo; tarefa pequena | **Dar dentes (checklist)** |

## 10. O que muda no v3 (proposta)

| Mudança | Por quê | Efeito esperado |
|---|---|---|
| **Padrão 3, teto 5** | WIP humano; USL; doc oficial | Menos coordenação, mais revisão útil |
| **Contrato de tarefa** | MAST; Anthropic; Osmani | Menos desvio e retrabalho |
| **Teste de aceite + gate** | Verificação é o gargalo | “Pronta” com prova, não com auto-relato |
| **Revisor de contexto limpo por risco** | Cognition; `/code-review` | Menos bug escapado em área crítica |
| **DAG + caminho crítico** | Co-Coder; SquidAgent; Amdahl | Paralelizar o que rende, não o que é fácil |
| **Orçamento + critério de morte** | 7× tokens; loops | Menos rodada que não termina |
| **Métrica + retrospectiva** | METR; DORA; G4 | Decisão por evidência, não por sensação |
| **Worktree opt-in com tarefa de merge** | Worktrees; MA-4 | Desbloqueia conflito real sem virar padrão |
| **Context pack no briefing** | Context engineering; HumanLayer | Menos custo fixo e menos reexploração |
| **Roteamento de modelo** | Cohere | Planejamento barato, implementação forte |
| **Checklist de viabilidade** | Custo fixo; tarefa pequena | Menos rodada que não deveria existir |

## 11. O que não mudar

- O usuário divide as tarefas. O maestro não inventa escopo (G1).
- A devolutiva é arquivo; a vila é a única escritora do estado.
- Uma aprovação por rodada; o clique abre a rodada inteira.
- Sem recado entre sessões para estado; arquivo é a verdade.
- Sessão não commita; o usuário commita pelo pombal.
- Relatório sem modelo; tabela montada das devolutivas.
- Hooks de posse de arquivo e de devolutiva.
- `PROGRESS.md`/`PENDENCIAS.md` são logs compartilhados, não posse de tarefa.

## 12. Decisões que continuam sendo do usuário

1. **3 ou 5 como padrão?** A recomendação é 3; 5 vira exceção justificada.
2. **Revisor em quais riscos?** A recomendação é dinheiro/dado/auth/migração/interface; o resto
   fica no teste.
3. **Worktree: adotar agora ou só quando travar?** A recomendação é opt-in por gatilho, como está
   na MA-4.
4. **Orçamento: cota de assinatura ou dólar de API?** O número e a unidade mudam o break-even.
5. **Roteamento de modelo:** a evidência é majoritariamente Claude; usar DeepSeek em implementação
   precisa de medição própria.
6. **Gate de verificação:** só teste, ou teste + revisor? A recomendação é teste sempre, revisor
   por risco.
7. **Maestro ou workflow:** para tarefa homogênea em massa, o padrão certo é `/batch`/workflow, não
   o maestro.

## 13. Como validar sem enganar a si mesmo

1. **Linha de base:** escolha 3 tarefas parecidas e faça em sessão única; meça wall-clock, tokens
   e retrabalho.
2. **Piloto:** 3 rodadas de 3 tarefas, 3 sessões. Meça:
   - tempo de parede da rodada;
   - tokens totais e por tarefa;
   - primeiro passe sem retrabalho (%);
   - retrabalho (arquivos mexidos de novo em 7 dias);
   - conflitos de arquivo e repairs de merge;
   - tempo de revisão humana;
   - defeitos escapados (achados depois).
3. **Comparação:** mesmo conjunto de tarefas, uma rodada paralela e uma sequencial, em ordem
   alternada para reduzir aprendizado. Se não der para comparar, pelo menos declare a estimativa
   antes.
4. **Critérios de parada:** primeiro passe <70%, retrabalho >20%, custo >2× sem ganho de tempo,
   ou conflito de arquivo recorrente → voltar para sessão única e revisar o desenho.
5. **Retrospectiva:** uma variável por rodada. Não mude teto, contrato e revisor ao mesmo tempo;
   você não vai saber o que funcionou.
6. **Não confie na sensação.** A METR mostra que a percepção pode errar por dezenas de pontos.

## 14. Riscos, limites e perguntas abertas

- **A evidência é majoritariamente de fornecedor ou de benchmark.** O compilador C é um caso
  extremo; os papers usam tarefas estreitas. Seu projeto é pequeno, pessoal e com dois usuários.
  Trate os números como ordens de grandeza, não como promessa.
- **Assinatura versus API.** Em assinatura, o custo é cota e rate limit; em API, é dólar. O
  break-even muda. Meça a cota consumida, não só o tempo.
- **Projeto pequeno.** O custo de leitura inicial é menor, mas o custo fixo de briefing, aprovação
  e revisão continua. A tarefa mínima pode ser maior que 45 min na prática.
- **Dois usuários, um revisor.** A capacidade de revisão é o limite real. Se a segunda pessoa não
  revisa código, o WIP de escrita é 2–3, não 5.
- **Dev Valley.** O TerminalManager, os hooks e o `--settings` já resolvem posse e devolutiva;
  worktree e gate de teste exigem mudanças no spawn e no estado. O v3 não é só regra; é código.
- **Dívida de qualidade.** DORA mostra throughput subindo e estabilidade caindo. Teste fraco e
  revisão superficial podem aumentar a velocidade aparente e piorar a manutenção.
- **O teste vira a spec.** Se o teste é fraco, o agente otimiza para o teste fraco. O compilador C
  é explícito: “o agente otimiza para o que o teste mede”.
- **Mudança de modelo.** A evidência é datada (2025–2026). Reavalie a cada geração; o número de
  hoje pode não valer em três meses.
- **METR não é “IA deixa lento”.** É um RCT limitado, em repositórios maduros, com replicação
  fraca. A lição é medir, não generalizar.
- **Agent teams é experimental.** Não adote na vila; copie as ideias. A doc oficial lista
  limitações que conflitam com o desenho atual.
- **Worktree não é bala de prata.** Isola arquivo, mas cria merge, ambiente duplicado e a
  tentação de rodar mais sessões do que você revisa.

## 15. Fontes

### Documentação oficial do Claude Code

1. Agent teams: https://code.claude.com/docs/en/agent-teams
2. Run agents in parallel: https://code.claude.com/docs/en/agents
3. Subagents: https://code.claude.com/docs/en/sub-agents
4. Worktrees: https://code.claude.com/docs/en/worktrees
5. Costs: https://code.claude.com/docs/en/costs
6. Cross-session messaging: https://code.claude.com/docs/en/cross-session-messaging
7. Agent view: https://code.claude.com/docs/en/agent-view
8. Dynamic workflows: https://code.claude.com/docs/en/workflows
9. Best practices: https://code.claude.com/docs/en/best-practices

### Engenharia da Anthropic

10. How we built our multi-agent research system (jun/2025): https://www.anthropic.com/engineering/multi-agent-research-system
11. Building a C compiler with a team of parallel Claudes (fev/2026): https://www.anthropic.com/engineering/building-c-compiler
12. Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### Papers e estudos

13. Why Do Multi-Agent LLM Systems Fail? (MAST, NeurIPS 2025): https://arxiv.org/abs/2503.13657
14. Agentless (FSE 2025): https://arxiv.org/abs/2407.01489
15. When Parallelism Pays Off: Cohesion-Aware Task Partitioning (2026): https://arxiv.org/abs/2606.00953
16. SquidAgent: Parallelize Wisely, Coordinate Efficiently (2026): https://arxiv.org/abs/2610.08647
17. An Empirical Study of Coordination Mode in Multi-Agent Coding (2026): https://arxiv.org/abs/2607.27877
18. Paired study of dynamic concurrency (2026): https://arxiv.org/abs/2610.10263
19. Cohere: Scaling Inference-Time Compute with Teams of Coding Agents (out/2026): https://cohere.com/research/papers/scaling-inference-time-compute-with-teams-of-coding-agents-2026-10-12
20. METR: Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity (jul/2025): https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
21. METR: We are Changing our Developer Productivity Experiment Design (fev/2026): https://metr.org/blog/2026-02-24-uplift-update/
22. DORA 2025: State of AI-assisted Software Development: https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report

### Praticantes

23. Cognition: Don't Build Multi-Agents (2025): https://cognition.com/blog/dont-build-multi-agents
24. Cognition: Multi-Agents: What's Actually Working (2026): https://cognition.com/blog/multi-agents-working
25. Addy Osmani: The Code Agent Orchestra: https://addyosmani.com/blog/code-agent-orchestra/
26. HumanLayer: 12-Factor Agents, fator 10: https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-10-small-focused-agents.md
27. InfoQ: Inside the Development Workflow of Claude Code's Creator (jan/2026): https://www.infoq.com/news/2026/01/claude-code-creator-workflow/
28. Builder.io: You Probably Don't Need Claude Agent Teams: https://www.builder.io/blog/claude-agent-teams-explained-what-it-is-and-how-to-actually-use-it

### Clássicos e fundamentos

29. Brooks, *The Mythical Man-Month* (1975): lei de Brooks e integridade conceitual.
30. Amdahl, *Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities* (1967): lei de Amdahl.
31. Gunther, *Guerrilla Capacity Planning* (2007): Universal Scalability Law.
32. Goldratt, *The Goal* (1984): Teoria das Restrições.
33. Graham, *Maker's Schedule, Manager's Schedule* (2009): http://www.paulgraham.com/makersschedule.html
34. Anderson, *Kanban* (2010): limite de WIP e Little's Law.

### Relatos de comunidade (usar como ilustração, não como prova)

35. Issue #47930: https://github.com/anthropics/claude-code/issues/47930
36. Issue #32996: https://github.com/anthropics/claude-code/issues/32996
37. Issue #78811: https://github.com/anthropics/claude-code/issues/78811

---

**Como este documento deve envelhecer:** é uma foto de 11/11/2026. A cada geração de modelo, e a
cada rodada real do maestro, os números mudam. O que deve durar são os princípios: leitura
paralela, escrita serial, um dono por decisão, verificação como gargalo, WIP limitado e medição
contra a sessão única.
