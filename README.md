# 🌾 Dev Valley

Uma vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code.
Por baixo dos panos tudo continua igual: repositórios git no WSL e o `claude` de sempre.

| Na vila | Por baixo |
|---|---|
| Casa | Pasta em `projectRoots` (geralmente um repo git) |
| Morador | Sessão do Claude Code (`~/.claude/projects/**/*.jsonl`) — clique para abrir o chat. Nome único na vila |
| Dentro da casa (clique nela) | Todas as sessões do projeto: as ativas trabalham nas mesas, as antigas descansam no sofá |
| Pombal: casinha de passarinho no quintal, colada à direita da casa (toda casa com git) | A única peça de git, em dois estágios. **Local**: uma carta espalhada no chão para cada arquivo que só você tem (com ou sem commit), pombo acordado. **Enviado**: chão limpo, pombo dormindo; num envio feito pela vila, o pombo recolhe as cartas que foram e voa para a direita. "Enviar para o time" mostra o diff, pede a mensagem ("✨ Sugerir texto" pede ao escrevente, um agente da vila, a mensagem no estilo do `git log` do projeto) e faz commit, pull com rebase e push de uma vez; "Trazer" é o pull da manhã. Pombo com carta no telhado = chegou coisa do time (ele chega voando da direita quando a busca descobre); "!" amarelo = a última viagem que você disparou não completou (conflito desfaz o rebase e lista os arquivos). Branch sem upstream: só guarda o commit aqui |
| Placa fincada no quintal da frente | Vencimento da auditoria das regras (`.claude/auditoria-regras.txt`); amarela quando vencida — rode `/auditar-regras` |
| Quadro negro (parede da casa) | O `docs-dev/painel.json` inteiro: plano, todas as fases com o estado, todas as entregas e o JSON como está no arquivo. O `doc` do plano e de cada fase vira botão: HTML abre isolado no painel (iframe com `sandbox`, sem acesso à vila); `.md` abre no leitor. Sem o arquivo, o quadro fica limpo |
| Lareira (sala da casa) | Liga e apaga o sistema do projeto pela tabela "Subir" do `docs-dev/guias/OPERACAO.md` (back e front juntos). O painel mostra pasta, comando e porta de cada lado antes de acender, e o log de cada lado numa aba. Fogo = no ar; fogo pequeno = subindo; brasa e fumaça escura = um lado parou com erro. Sistema subido fora da vila aparece aceso, mas a vila não o apaga. Na vila, a chaminé da casa solta fumaça: fina = subindo, contínua = no ar, escura = erro. Reiniciar a vila derruba o que ela ligou |
| Estante (dentro da casa) | O mesmo leitor da biblioteca, só com a estante do projeto (CLAUDE.md e docs `.md`/`.html`, com edição e busca restrita a ele). Os livros desenhados nela contam `docs-dev/context/`, o que já foi construído: semente → quadro negro → livro |
| Lixeira (canto da sala, perto da porta) | Uma bolinha de papel por linha do `RETRABALHO.md` (G17); passou de cinco, transborda no chão — clique para ver a tabela; três da mesma causa pedem `/nova-regra` |
| Alçapão (no chão da casa) e porão | Trabalho paralelo de sessões: você traz as tarefas já divididas e o maestro ✦ (agente `maestro`, de `~/Documents/IA`) diz se vale paralelizar (uma checklist de cinco itens) e as distribui entre 3 sessões por padrão (até 5, abertas em ondas de até 3 ao mesmo tempo: modo início de sprint), sem duas mexerem no mesmo arquivo ao mesmo tempo (a que mexe no arquivo de outra espera por ela; a posse confere a sessão, não só o nome da tarefa). As suítes de teste rodam numa fila da rodada (`testar.sh` com `flock`, a mesma trava do gate): uma por vez. Depois do seu clique, quem conduz é a vila (`rodada.ts`): cada sessão termina gravando a devolutiva em arquivo (um hook lembra quem tenta parar sem ela, e outro recusa editar arquivo de outra tarefa que ainda trabalha), a vila marca a tarefa pronta, abre sozinha a que esperava e, com todas prontas, monta o relatório. Os comandos de teste do cartão a vila roda duas vezes (`gate.ts`): antes de abrir as sessões (a linha de base, "conferindo a linha de base" no quadro) e com todas prontas; o relatório diz no topo se a rodada foi aprovada ou **reprovada** (um comando que passava e agora falha; ❗ na estante, nenhuma sessão é reaberta), traz o aceite de cada tarefa e a seção "Custo e ganho" (tempos, estimativa em sessão única declarada pelo maestro e tokens por tarefa). Durante a rodada a estante de partitura abre o **quadro da rodada**: Esperando, Trabalhando, Precisa de você e Pronta, com ❗ na estante quando uma tarefa parou sem terminar. Os commits são seus, pelo pombal. Clique nele = rodada nova (`claude --agent maestro` na pasta do projeto). Quando ele pede as sessões da rodada, aparece um ❗ na estante de partitura ao lado dele: o cartão mostra as tarefas, com os arquivos que cada uma pode editar e os testes que pode rodar, e só com o seu clique em "Abrir" as sessões nascem, já lendo o briefing e liberadas para isso (o resto pede permissão). No cartão aparece também a **segunda opinião**: um crítico de outra família (DeepSeek Flash, `critico.ts`) confere as tarefas por um checklist fechado (arquivo que não existe, duas tarefas no mesmo arquivo, teste que não existe, aceite vago, briefing sem a spec ou pedindo além dela, ação irreversível sem esperar você, dependência errada) e cada apontamento é conferido pelo Haiku; só o confirmado aparece, como aviso, e o clique nunca espera por ele. Sem pedido, a mesma estante abre os relatórios das rodadas (`docs-dev/maestro/`), com selo "novo" nos que você ainda não abriu e um ♪ em cima quando há algum (os abertos ficam em `relatorios-lidos.json`, em `~/.claude/dev-valley/`). A conversa do maestro mora no ✦ (balão de trabalhando ou ❗; clique continua a rodada em andamento ou começa uma nova). As sessões das tarefas moram só no porão (nas 5 mesas, as vivas; nos bancos, as encerradas) e não aparecem na casa nem no mapa. Com rodada em andamento o alçapão acende; ❗ nele e no telhado = alguém do porão pede permissão ou o cartão espera. Enquanto alguma tarefa trabalha, o maestro **rege** (batuta girando) e não é interrompido: o clique nele abre o ✦ **maestro mirim**, o assistente menor ao lado dele, que responde suas dúvidas da rodada só lendo (as conversas das sessões e o `git` do projeto, na hora da pergunta; não fala com ninguém), com um botão para ver o maestro só para ler. Quando o maestro precisa de você, ele chama (`/api/porao/chamar`): o ❗ aparece nele e o clique abre a conversa. Gongo: "Encerrar rodada", que apaga as conversas do porão depois de confirmar. Rodada que mexeu em tela termina com outro cartão na estante: "Roteiro de testes"; o seu clique abre um morador **na casa** (não no porão: o gongo não o apaga) que começa com `/roteiro-testes <relatório>`, te entrega o roteiro para executar e continua a triagem e o reteste com você. Plano em `docs-dev/context/maestro.md` |
| Caixa de sementes (dentro da casa) | Planos em `docs-dev/a-codar/`: decididos e ainda não codados (G7) — clique para listar e abrir no leitor |
| Escrivaninha | Painel do projeto: branch, remoto, em que conta a casa abre, **Nova sessão** (a tela seguinte escolhe a conta: Claude, DeepSeek pessoal ou DeepSeek trabalho), VS Code, pombal. Caixa de marcar em cada morador da sala: as marcadas vão juntas para o quarto (**💤 Dormir**) ou são apagadas de vez (**Encerrar**), com confirmação que avisa quem está trabalhando |
| Porta na parede direita e quarto | Sessões dormindo: o processo `claude` foi encerrado (não gasta memória nem CPU) e a conversa fica guardada. Somem da sala e do mapa. Clicar na cama abre o chat, a sessão acorda (`claude --resume`) e volta à sala. O quarto não tem prazo: quem dorme aparece mesmo depois dos `sessionMaxAgeDays`. Quem dorme fica em `dormindo.json`, em `~/.claude/dev-valley/`. Atenção: o próprio Claude Code apaga conversas mais velhas que `cleanupPeriodDays` (30 dias por padrão; ajuste no `settings.json` de cada conta) |
| Bastão vermelho ao lado da cabeça | O contexto da sessão passou de 70%: hora de passar o bastão. No painel do morador, "Passar o bastão" (sempre lá; em destaque a partir de 70%) pede à própria sessão um resumo (objetivo, feito, aberto, arquivos, próximo passo, cuidados) na pasta `bastao` de `~/.claude/dev-valley/`; quando ela termina, nasce um morador novo na mesma casa, já lendo o resumo. Nunca automático |
| Balão "..." / "!" | Sessão trabalhando / pedindo sua permissão (via hooks). Trabalhando, o balão mostra a ferramenta enquanto ela roda: lupa = lendo ou buscando, lápis = editando, terminal = rodando comando, globo = na web, ✦ roxo = com um agente; "..." = pensando (entre uma ferramenta e outra) ou ferramenta sem categoria. Vai à vila só a categoria, nunca o arquivo nem o comando |
| Janela acesa | Alguma sessão do projeto está rodando |
| Andaime na fachada | Falta estrutura de acompanhamento (`CLAUDE.md`, `PENDENCIAS.md`, `PROGRESS.md`, `docs-dev/painel.json`, auditor) — clique para ver como resolver |
| Praça | Sessões abertas fora de qualquer projeto |
| Banco da praça | Clique para criar uma sessão avulsa, na home (`~`), e escolher a conta (Claude, DeepSeek pessoal ou DeepSeek trabalho) |
| Outdoor atrás da praça | Guardrails: se o plugin está ligado no `settings.json` e, no clique, a lista de regras (configurado no local) |
| Sino na praça | De todas as casas: entregas do `PROGRESS.md` que ainda dizem "Falta conferir na vila" e pendências abertas do `PENDENCIAS.md`, com dono 👤, que dizem "falta … conferir"; mais o reinício pendente do Dev Valley. As caixinhas marcam a entrega como conferida no `PROGRESS.md`; a pendência fecha pela sessão ou pelo administrador |
| Biblioteca | CLAUDE.md, memórias e docs (`.md` e `.html`) de cada projeto, com leitor, edição e busca; HTML abre isolado, como na estante |
| ✦ Bibliotecária | Agente permanente (`~/.claude/agents/bibliotecaria.md`) que acha qualquer conhecimento documentado |
| Quadro de avisos (praça) | Suas notas soltas: o clique abre o quadro de perto, com cada nota inteira, "Nova nota" e ✕ para excluir. Ficam em `notas.json`, em `~/.claude/dev-valley/`, fora do repositório. As pendências 👤 aparecem só dentro de cada casa |
| ✦ Administrador da praça | Agente permanente ao lado do sino: explica os itens e, quando você diz que conferiu, registra nos arquivos de acompanhamento do projeto (só neles) |
| Banca de jornal e ✦ jornaleiro (ao lado da praça) | Clique no jornaleiro para conversar: ele conta o que mudou em qualquer projeto nos últimos 30 dias (só pelas mensagens de commit, sem ferramenta e sem código) e, pelos atalhos "A semana de um projeto" e "Desde uma data", imprime uma edição extra da Gazeta. Clique na banca para a *Gazeta do Vale*: o clique abre uma folha de jornal (cabeçalho, manchete, notícias com título em colunas e "Achados e perdidos" com os projetos parados). O que mudou nos projetos desde a última vez que você leu o jornal (pelo menos as últimas 24h, no máximo 7 dias), em linguagem de gente: "Você" e "o time" separados, uma manchete, os projetos sem novidade e os parados há 14 dias ou mais. Uma edição por dia, que sai sozinha depois das 6h com a vila aberta (ou no botão "Imprimir"); pilha de jornais no balcão = a de hoje já saiu. O jornaleiro é um agente da vila que recebe só as mensagens de commit e os nomes dos arquivos, nunca o diff; sem commit no período, ele nem é chamado. Usa o que o pombal já buscou, sem rede própria |
| Moinho (entre a praça e a Fábrica) | Com o que a vila gastou na semana do plano (a mesma dos limites do canto da tela): as pás giram no ritmo da semana comparado com o da passada (paradas sem gasto). No clique, cada projeto com a fatia dele ("ficou com 45% do gasto") e, ao abrir, os moradores que mais gastaram. Cada conta (Claude, DeepSeek pessoal e DeepSeek trabalho) em lista separada. Peso = entrada + saída + criação de cache + leitura de cache ÷ 10, lido dos `.jsonl` das conversas (subagente conta na sessão dele). No topo, "Limites do plano: até quando dá": os limites da clínica com a previsão (sessão de 5h pelo ritmo da última hora, semana pelo ritmo médio dela): "chega a 100% às 15h40, antes de renovar às 18h" ou "chega a uns 70% quando renovar" |
| Clínica (entre a biblioteca e a praça, no lugar da antiga torre do relógio) | Onde se examina quem está demorando. A cruz da placa tem a cor do pior limite do plano do Claude (o detalhe, com memória, swap, processador e disco do WSL, fica no canto inferior esquerdo da tela, minimizável) (verde, amarela a partir de 75%, vermelha piscando a partir de 90%) e o mouse mostra "5h: 30%, volta às 14h · Semana: 12%". Dentro, a triagem à esquerda e o consultório à direita: a **maca de triagem** (os moradores vivos, com estado, há quanto tempo trabalham, contexto e o comando que rodam agora, com idade e CPU) e a **✦ Dra. Lia**, a médica: ela recebe a ficha do morador (hooks, fim da conversa, ferramenta sem resposta, erros, processos filhos do terminal e a máquina), só lê, e responde com 🟢 trabalhando, 🟡 lento mas vivo, 🟠 esperando algo, 🔴 em loop ou ⚫ sem sinal, as evidências e, se for intervir, o texto pronto para colar. Também pelo "🩺 Chamar a médica" do painel do morador. Ela nunca fala com a sessão nem encerra nada. E o **armário** dos pacientes esquecidos: `claude` rodando fora da vila (com "provavelmente Fulano" quando há um morador vivo na mesma pasta), servidores escutando porta fora da lareira (o VS Code não entra) e containers Docker de pé, cada um com idade, memória e a linha para você encerrar (`kill`, `docker stop`); a vila só aponta |
| Fábrica (clique para entrar) | Bancada: agentes do Claude Code (`~/.claude/agents` e `<projeto>/.claude/agents`) e, só leitura, os agentes da vila (cada um mostra a conta que responde por ele) · Parede de ferramentas: skills (`~/.claude/skills` e `<projeto>/.claude/skills`; as instaladas por link são só leitura). Criar, editar e apagar por formulário · Quadro de força (só leitura): plugins e servidores MCP de cada conta, uma alavanca por plugin (verde para cima = ligado); no clique, o que cada plugin traz. Do MCP só nome, tipo e onde está configurado; conectores do claude.ai não ficam em arquivo e não aparecem |
| ✦ NPC no pátio da Fábrica ou sentado na sala de uma casa | Um agente (todo agente veste terno preto, gravata e óculos escuros, para não se confundir com as sessões, e nenhum repete a pele e o cabelo de outro; o de projeto fica sentado numa mesinha na sala da casa dele) — clique para conversar com ele (`claude --agent`; global na praça, de projeto na casa) |

### NPCs especiais: agentes permanentes

Moradores comuns são sessões e acabam quando a janela de contexto enche. Os NPCs com ✦ são **agentes**:
cada pergunta é uma consulta nova e curta, e a memória deles fica em disco, então nunca enchem.

A bibliotecária usa o **catálogo** (`~/.cache/dev-valley/catalogo.md`): um índice de todos os livros com título,
descrição e seções. A vila o regenera sem IA sempre que um documento muda. Qualquer sessão do Claude Code pode
chamá-la como subagente, e na vila você conversa com ela clicando no balcão da biblioteca. As consultas pela vila usam
`claude -p --no-session-persistence`, então não viram moradores.

## Rodando

```bash
npm install
npm start          # build do front + servidor em http://localhost:4777
npm run dev        # desenvolvimento: front com hot reload em http://localhost:5173
```

O servidor escuta só em `127.0.0.1` e recusa WebSockets de outras origens — os terminais rodam comandos de verdade.

Link direto para dentro de uma casa: `http://localhost:4777/?casa=<nome-do-projeto>`.

### Integração com o Claude Code (mod e agentes)

```bash
npm run hooks:install     # instala o mod dev-valley, os hooks de permissão e a bibliotecária em ~/.claude/agents
npm run hooks:uninstall   # remove só o que é do Dev Valley
```

A integração é um mod do Claude Code, na pasta `mod/` (marketplace local em `.claude-plugin/marketplace.json`). Ele
avisa a vila dos eventos de cada sessão (abriu, trabalhando, esperando, encerrou) e mostra no rodapé da sessão o
contexto e os limites do plano (`🌾 ctx 45% · 5h 30% · 7d 12%`), ao lado da entrada de outros mods.
O mod é lido direto da pasta do repo: editar lá vale na próxima sessão (numa aberta, `/reload-plugins`).
"Pedindo permissão" é a exceção: nenhum evento de mod diz quando o diálogo de permissão abre, e os eventos de hook
clássicos de um mod de usuário são pulados por um plugin de segurança do Claude Code. Por isso `PermissionRequest` e
`Notification` continuam como hooks de shell (`jq` + `curl`) no `~/.claude/settings.json`, marcados com `# dev-valley`.
O install tira e repõe só essas entradas (com backup). Um agente com o mesmo nome criado por você nunca é sobrescrito.

À vila vão apenas `session_id`, `cwd`, nome do evento, o tipo de notificação e os ids das sessões citadas com `@Nome`,
mais contexto e limites do plano — nunca conteúdo de arquivos ou prompts. Se a vila estiver fechada, o mod desiste em até 1s, em silêncio. Sessões abertas fora da
vila (ex.: VS Code) também aparecem, e a vila não deixa retomar uma sessão que já está rodando em outro terminal.

**Nomes dos moradores.** Cada sessão tem um nome único na vila, guardado em `~/.claude/dev-valley/nomes.json`. Ao abrir,
a sessão fica sabendo o próprio nome. Numa mensagem, cite outro morador como `@Nome` (ex.: "vê o que a @Lia fez"): o mod
acha o nome no mapa `~/.claude/dev-valley/moradores.json` (gravado pela vila) e entrega à sessão quem é, de que projeto e
onde está a conversa, sem busca. O texto da mensagem é lido só na sua máquina; à vila vão apenas o `session_id` e os ids
das sessões citadas. Com eles, na vila, quem citou anda até o citado e os dois conversam (balão de conversa) até a
resposta terminar; dentro da casa, só quando os dois moram nela.

## Configuração

`dev-valley.config.json` (ou `dev-valley.config.local.json`, ignorado pelo git, para sobrescrever):

- `projectRoots`: pastas cujas subpastas viram casas
- `extraProjects`: projetos avulsos fora dessas pastas
- `sessionMaxAgeDays`: por quantos dias uma sessão sem atividade continua morando na casa (no quintal só ficam as sessões rodando)
- `auditorAcervos` (só no local): globs de regras de fora do repo que `scripts/auditar-referencias.py` também confere,
  por tipo (`guardrail`, `perfil`)
- `guardrails` (só no local): `{ "plugin": "<nome@marketplace>", "core": "<arquivo com ## G<n> — título>" }` liga o
  outdoor dos guardrails atrás da praça (plugin ligado no `~/.claude/settings.json` e a lista de regras); sem ele, não há outdoor

## Estrutura

- `server/` — Node + TypeScript: lê projetos e sessões, roda git, mantém os terminais (`node-pty` + `claude --resume`)
- `web/` — Vite + Phaser 3 (vila), xterm.js (chat), Monaco (diff)
- `mod/` — mod do Claude Code: eventos de sessão, rodapé com contexto e uso, nomes dos moradores e `@Nome`
- `scripts/` — auditor de referências e prévia dos moradores em PNG, sem navegador

## Próximos passos

O que está aberto fica em [`PENDENCIAS.md`](PENDENCIAS.md); o histórico, em [`PROGRESS.md`](PROGRESS.md).
