# dev-valley

## Visão geral
Vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code no WSL.
Uso pessoal, roda local. Casa = projeto (pasta em `projectRoots`), morador = sessão do Claude Code,
caixa de envio = `git status`/commit, biblioteca = CLAUDE.md, memórias e docs, NPC com ✦ = agente permanente.
Mapa completo "na vila → por baixo" e roadmap no `README.md`.

Estado (25/10/2026): vila, interior das casas, status ao vivo via hooks, biblioteca, bibliotecária e painel de
uso do plano prontos. Próximo: Fábrica de agentes (em construção), depois chat próprio via Claude Agent SDK.

## Stack e estrutura
- Monorepo npm com workspaces `server` e `web`, tudo em TypeScript.
- `server/` — Node + Express + `ws` + `node-pty`, rodado com `tsx`. Lê projetos e sessões
  (`~/.claude/projects/**/*.jsonl`), roda git, mantém os terminais (`claude --resume`).
  - `src/index.ts` (entrada), `world.ts`, `sessions.ts`, `git.ts`, `terminals.ts`, `hooks.ts`, `statusline.ts`,
    `library.ts`/`catalog.ts`/`librarian.ts` (biblioteca e bibliotecária), `install-hooks.ts`.
  - `agents/bibliotecaria.md`: agente instalado em `~/.claude/agents`.
- `web/` — Vite + Phaser 3 (vila), xterm.js (chat), Monaco (diff), marked + DOMPurify (leitor de docs).
  - `src/game/` cenas Phaser (`TownScene`, `InteriorScene`, `LibraryScene`) e pixel art gerada em código.
  - `src/ui/` painéis HTML sobre o jogo (terminal, commit, biblioteca, uso…).
- Config: `dev-valley.config.json` (versionado) sobrescrito por `dev-valley.config.local.json` (ignorado pelo git).

## Comandos
- Instalar: `npm install`
- Rodar: `npm start` (build do front + servidor em http://localhost:4777)
- Desenvolvimento: `npm run dev` (front com hot reload em http://localhost:5173)
- Build: `npm run build` (front: `tsc && vite build`)
- Checagem de tipos do servidor: `npm run typecheck -w server`
- Testes: não há suíte automatizada ainda. Validar com typecheck + build e na vila.
- Hooks/status line/agentes: `npm run hooks:install` / `npm run hooks:uninstall`

## Convenções
- Textos de interface e mensagens de commit em português, só a primeira letra maiúscula.
- Commits: uma linha descrevendo a entrega (ver `git log`).
- Pixel art é gerada em código (`web/src/game/textures.ts`, `interiorTextures.ts`); prévia em `web/sprites.html`.

## Cuidados
- O servidor escuta só em `127.0.0.1` e recusa WebSocket de outra origem: os terminais rodam comandos de verdade.
  Nunca afrouxar isso.
- Hooks mandam à vila só `session_id`, `cwd`, nome do evento e tipo de notificação. Nunca conteúdo de arquivo ou prompt.
- `hooks:install` mexe em `~/.claude/settings.json` (global, com backup): só instala status line se não houver um,
  nunca sobrescreve agente do usuário com o mesmo nome, e o uninstall remove só o que é do Dev Valley.
- Consultas da bibliotecária usam `claude -p --no-session-persistence` para não virarem moradores.
