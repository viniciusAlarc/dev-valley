# 🌾 Dev Valley

Uma vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code.
Por baixo dos panos tudo continua igual: repositórios git no WSL e o `claude` de sempre.

| Na vila | Por baixo |
|---|---|
| Casa | Pasta em `projectRoots` (geralmente um repo git) |
| Caixa de envio ao lado da casa | `git status` — clique para ver o diff e commitar |
| Morador | Sessão do Claude Code (`~/.claude/projects/**/*.jsonl`) — clique para abrir o chat |
| Janela acesa / balão "..." | Sessão rodando agora dentro da vila |
| Praça | Sessões abertas fora de qualquer projeto |
| Biblioteca / Fábrica | Base de conhecimento / criação de agentes (em construção) |

## Rodando

```bash
npm install
npm start          # build do front + servidor em http://localhost:4777
npm run dev        # desenvolvimento: front com hot reload em http://localhost:5173
```

O servidor escuta só em `127.0.0.1` e recusa WebSockets de outras origens — os terminais rodam comandos de verdade.

## Configuração

`dev-valley.config.json` (ou `dev-valley.config.local.json`, ignorado pelo git, para sobrescrever):

- `projectRoots`: pastas cujas subpastas viram casas
- `extraProjects`: projetos avulsos fora dessas pastas
- `sessionsPerProject` / `sessionMaxAgeDays`: quantos moradores aparecem por casa

## Estrutura

- `server/` — Node + TypeScript: lê projetos e sessões, roda git, mantém os terminais (`node-pty` + `claude --resume`)
- `web/` — Vite + Phaser 3 (vila), xterm.js (chat), Monaco (diff)

## Próximos passos

1. Hooks do Claude Code para status ao vivo (trabalhando / esperando permissão / parado)
2. Biblioteca: CLAUDE.md, memórias e docs
3. Fábrica: criar e editar agentes em `.claude/agents`
4. Chat próprio via Claude Agent SDK, com pedidos de permissão em caixas de diálogo
5. Trocar a pixel art gerada em código por um tileset de verdade
