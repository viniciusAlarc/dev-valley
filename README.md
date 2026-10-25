# 🌾 Dev Valley

Uma vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code.
Por baixo dos panos tudo continua igual: repositórios git no WSL e o `claude` de sempre.

| Na vila | Por baixo |
|---|---|
| Casa | Pasta em `projectRoots` (geralmente um repo git) |
| Caixa de envio ao lado da casa | `git status` — clique para ver o diff e commitar |
| Morador | Sessão do Claude Code (`~/.claude/projects/**/*.jsonl`) — clique para abrir o chat |
| Dentro da casa (clique nela) | Todas as sessões do projeto: as ativas trabalham nas mesas, as antigas descansam no sofá |
| Escrivaninha | Painel do projeto: branch, remoto, nova sessão, VS Code, caixa de envio |
| Balão "..." / "!" | Sessão trabalhando / pedindo sua permissão (via hooks) |
| Janela acesa | Alguma sessão do projeto está rodando |
| Praça | Sessões abertas fora de qualquer projeto |
| Biblioteca | CLAUDE.md, memórias e docs de cada projeto, com leitor, edição e busca |
| ✦ Bibliotecária | Agente permanente (`~/.claude/agents/bibliotecaria.md`) que acha qualquer conhecimento documentado |
| Painel "Uso do Claude" | Limites do plano (5h e semanal), como no `/usage` — minimizável |
| Fábrica | Criação de agentes (em construção) |

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

### Integração com o Claude Code (hooks, status line e agentes)

```bash
npm run hooks:install     # hooks + status line em ~/.claude/settings.json (com backup) e agentes em ~/.claude/agents
npm run hooks:uninstall   # remove só o que é do Dev Valley
```

O status line só é instalado se você não tiver um próprio, e um agente com o mesmo nome criado por você nunca é sobrescrito.
O status line manda à vila só a janela de contexto e os limites do plano; o Claude Code preenche os limites a partir da
primeira resposta da API em cada sessão.

Os hooks mandam para a vila apenas `session_id`, `cwd`, nome do evento e o tipo de notificação — nunca conteúdo de arquivos ou prompts.
Se a vila estiver fechada, o hook falha em silêncio em até 1s. Sessões abertas fora da vila (ex.: VS Code) também aparecem,
e a vila não deixa retomar uma sessão que já está rodando em outro terminal.

## Configuração

`dev-valley.config.json` (ou `dev-valley.config.local.json`, ignorado pelo git, para sobrescrever):

- `projectRoots`: pastas cujas subpastas viram casas
- `extraProjects`: projetos avulsos fora dessas pastas
- `sessionsPerProject` / `sessionMaxAgeDays`: quantos moradores aparecem por casa

## Estrutura

- `server/` — Node + TypeScript: lê projetos e sessões, roda git, mantém os terminais (`node-pty` + `claude --resume`)
- `web/` — Vite + Phaser 3 (vila), xterm.js (chat), Monaco (diff)

## Próximos passos

1. ~~Hooks do Claude Code para status ao vivo~~ ✔ e ~~interior das casas~~ ✔
2. ~~Biblioteca~~ ✔ e ~~bibliotecária~~ ✔
3. Fábrica: criar e editar agentes em `.claude/agents`
4. Chat próprio via Claude Agent SDK, com pedidos de permissão em caixas de diálogo
5. Trocar a pixel art gerada em código por um tileset de verdade
