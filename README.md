# 🌾 Dev Valley

Uma vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code.
Por baixo dos panos tudo continua igual: repositórios git no WSL e o `claude` de sempre.

| Na vila | Por baixo |
|---|---|
| Casa | Pasta em `projectRoots` (geralmente um repo git) |
| Caixa de envio ao lado da casa | `git status` — clique para ver o diff e commitar |
| Morador | Sessão do Claude Code (`~/.claude/projects/**/*.jsonl`) — clique para abrir o chat. Nome único na vila |
| Dentro da casa (clique nela) | Todas as sessões do projeto: as ativas trabalham nas mesas, as antigas descansam no sofá |
| Pombal: casinha de passarinho no quintal, à direita da caixa de envio (só nas casas configuradas) | Sincroniza a sua branch com a branch comum do time. Pombo no telhado com carta = commits novos na comum (pull de manhã); cartas no poleiro = commits seus que a comum não tem (push no fim do dia); pombo dormindo = em dia; "!" amarelo = casa em outra branch ou última viagem não completou. Conflito desfaz o merge e lista os arquivos |
| Placa embaixo da janela | Vencimento da auditoria das regras (`.claude/auditoria-regras.txt`); amarela quando vencida — rode `/auditar-regras` |
| Ervas à direita da casa | Uma por linha do `RETRABALHO.md` (G17) — clique para ver a tabela; três da mesma causa pedem `/nova-regra` |
| Quadro negro (parede da casa) | O `docs-dev/painel.json` inteiro: plano, todas as fases com o estado, todas as entregas e o JSON como está no arquivo. O `doc` do plano e de cada fase vira botão: HTML abre isolado no painel (iframe com `sandbox`, sem acesso à vila); `.md` abre no leitor. Sem o arquivo, o quadro fica limpo |
| Estante (dentro da casa) | O que já foi construído: `docs-dev/context/` (sem o `README.md`), um livro por documento. `.md` abre no leitor; HTML abre isolado, como no quadro negro. Fecha o ciclo do plano: semente → quadro negro → livro |
| Caixa de sementes (dentro da casa) | Planos em `docs-dev/a-codar/`: decididos e ainda não codados (G7) — clique para listar e abrir no leitor |
| Escrivaninha | Painel do projeto: branch, remoto, nova sessão, VS Code, caixa de envio |
| Balão "..." / "!" | Sessão trabalhando / pedindo sua permissão (via hooks) |
| Janela acesa | Alguma sessão do projeto está rodando |
| Andaime na fachada | Falta estrutura de acompanhamento (`CLAUDE.md`, `PENDENCIAS.md`, `PROGRESS.md`, `docs-dev/painel.json`, auditor) — clique para ver como resolver |
| Praça | Sessões abertas fora de qualquer projeto |
| Banco da praça | Clique para abrir uma sessão nova avulsa, na home (`~`) |
| Outdoor atrás da praça | Guardrails: se o plugin está ligado no `settings.json` e, no clique, a lista de regras (configurado no local) |
| Sino na praça | Entregas do `PROGRESS.md` que ainda dizem "Falta conferir na vila", e o reinício pendente do Dev Valley |
| Biblioteca | CLAUDE.md, memórias e docs de cada projeto, com leitor, edição e busca |
| ✦ Bibliotecária | Agente permanente (`~/.claude/agents/bibliotecaria.md`) que acha qualquer conhecimento documentado |
| ✦ Administrador da praça | Agente permanente ao lado do sino e do quadro: explica os itens e, quando você diz que conferiu, registra nos arquivos de acompanhamento do projeto (só neles) |
| Painel "Uso do Claude" | Limites do plano (5h e semanal), como no `/usage` — minimizável |
| Fábrica (clique para entrar) | Bancada: agentes do Claude Code (`~/.claude/agents` e `<projeto>/.claude/agents`) e, só leitura, os agentes da vila · Parede de ferramentas: skills (`~/.claude/skills` e `<projeto>/.claude/skills`; as instaladas por link são só leitura). Criar, editar e apagar por formulário |
| ✦ NPC no pátio da Fábrica | Um agente (todo agente veste terno preto, gravata e óculos escuros, para não se confundir com as sessões) — clique para conversar com ele (`claude --agent`; global na praça, de projeto na casa) |

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
npm run hooks:install     # instala o mod dev-valley, os hooks de permissão e os agentes em ~/.claude/agents
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

À vila vão apenas `session_id`, `cwd`, nome do evento e o tipo de notificação, mais contexto e limites do plano — nunca
conteúdo de arquivos ou prompts. Se a vila estiver fechada, o mod desiste em até 1s, em silêncio. Sessões abertas fora da
vila (ex.: VS Code) também aparecem, e a vila não deixa retomar uma sessão que já está rodando em outro terminal.

**Nomes dos moradores.** Cada sessão tem um nome único na vila, guardado em `~/.claude/dev-valley/nomes.json`. Ao abrir,
a sessão fica sabendo o próprio nome. Numa mensagem, cite outro morador como `@Nome` (ex.: "vê o que a @Lia fez"): o mod
acha o nome no mapa `~/.claude/dev-valley/moradores.json` (gravado pela vila) e entrega à sessão quem é, de que projeto e
onde está a conversa, sem busca. O texto da mensagem é lido só na sua máquina; à vila vai apenas o `session_id`.

## Configuração

`dev-valley.config.json` (ou `dev-valley.config.local.json`, ignorado pelo git, para sobrescrever):

- `projectRoots`: pastas cujas subpastas viram casas
- `extraProjects`: projetos avulsos fora dessas pastas
- `sessionMaxAgeDays`: por quantos dias uma sessão sem atividade continua morando na casa (no quintal só ficam as sessões rodando)
- `auditorAcervos` (só no local): globs de regras de fora do repo que `scripts/auditar-referencias.py` também confere,
  por tipo (`guardrail`, `perfil`)
- `guardrails` (só no local): `{ "plugin": "<nome@marketplace>", "core": "<arquivo com ## G<n> — título>" }` liga o
  outdoor dos guardrails atrás da praça (plugin ligado no `~/.claude/settings.json` e a lista de regras); sem ele, não há outdoor
- `pombal` (só no local): `{ "<pasta do projeto>": { "integracao": "<branch comum>", "minha": "<sua branch>", "remoto": "origin" } }`
  põe o pombal na casa; o remoto é buscado ao subir e a cada 5 minutos

## Estrutura

- `server/` — Node + TypeScript: lê projetos e sessões, roda git, mantém os terminais (`node-pty` + `claude --resume`)
- `web/` — Vite + Phaser 3 (vila), xterm.js (chat), Monaco (diff)

## Próximos passos

O que está aberto fica em [`PENDENCIAS.md`](PENDENCIAS.md); o histórico, em [`PROGRESS.md`](PROGRESS.md).
