# dev-valley — Instruções

**Stack:** TypeScript · Node (Express, ws, node-pty) · Vite + Phaser 3 · sem banco

> Os guardrails universais e as convenções de trabalho vêm do `~/.claude/CLAUDE.md`.
> Aqui ficam **só** as regras que dependem deste projeto. Em conflito, este arquivo vence.

---

## O que este sistema é

Vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code no WSL.
Uso pessoal, roda local. Casa = projeto (pasta em `projectRoots`), morador = sessão do Claude Code,
caixa de envio = `git status`/commit, biblioteca = CLAUDE.md, memórias e docs, NPC com ✦ = agente permanente.
Mapa completo "na vila → por baixo" no `README.md`.

## Estado atual

Vila, interior das casas, status ao vivo, biblioteca, bibliotecária e painel de uso prontos.
O que está aberto e o próximo passo: `PENDENCIAS.md`. Fases do plano: `docs-dev/painel.json`.

## Documentos de referência — consultar antes de implementar

| Documento | Quando consultar |
|---|---|
| `PENDENCIAS.md` | **Antes de codar qualquer coisa** — rastreador único do que está aberto (G6) |
| `PROGRESS.md` | Memória oficial: o que foi feito e quando (G5) |
| `docs-dev/painel.json` | Plano em andamento e fases (G14) |
| `docs-dev/guias/OPERACAO.md` | Subir, reiniciar, e o que derruba os terminais da vila |
| `README.md` | Mapa "na vila → por baixo" e integração com o Claude Code |

---

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
- Testes: não há suíte automatizada ainda (PD-8). Validar com typecheck + build e na vila.
- Auditor de referências: `python3 scripts/auditar-referencias.py . --tudo`
- Hooks/status line/agentes: `npm run hooks:install` / `npm run hooks:uninstall`

## Regras técnicas deste projeto — invioláveis

1. **Repositório público.** Os projetos que aparecem na vila são privados: nunca escrever aqui nome, caminho,
   trecho ou dado deles (nem em exemplo, teste, commit ou print). Caminho pessoal vai no
   `dev-valley.config.local.json`.
2. **O servidor escuta só em `127.0.0.1` e recusa WebSocket de outra origem:** os terminais rodam comandos de
   verdade. Nunca afrouxar isso.
3. **Hooks mandam à vila só `session_id`, `cwd`, nome do evento e tipo de notificação.** Nunca conteúdo de
   arquivo ou prompt.
4. **`hooks:install` mexe em `~/.claude/settings.json` (global, com backup):** só instala status line se não
   houver um, nunca sobrescreve agente do usuário com o mesmo nome, e o uninstall remove só o que é do Dev Valley.
5. **Consultas da bibliotecária usam `claude -p --no-session-persistence`** para não virarem moradores.
6. **Este repositório costuma ser editado de dentro da própria vila.** Reiniciar o servidor (`npm start` de novo,
   `npm run dev`, que reinicia sozinho ao salvar em `server/`) encerra todos os terminais da vila, inclusive a
   sessão que está editando. Nunca reiniciar nem rodar `npm run dev` por conta própria: avisar o usuário e ele
   reinicia quando as sessões terminarem (G21).
7. **Pixel art é gerada em código** (`web/src/game/textures.ts`, `interiorTextures.ts`); prévia em `web/sprites.html`.

## Regras de processo deste projeto

- Mensagens de commit em português, uma linha descrevendo a entrega (ver `git log`).
- **Ao final de cada entrega:** `PROGRESS.md` na mesma resposta (G5); `PENDENCIAS.md` se algo abriu ou fechou;
  `docs-dev/painel.json` só quando uma fase avança ou fecha (G14); `OPERACAO.md` se mudou o jeito de subir.
- **Gate de fechamento:** `npm run typecheck -w server` + `npm run build` sem erro, auditor sem achado, e a
  mudança conferida na vila pelo usuário (o reinício é dele, regra 6).
