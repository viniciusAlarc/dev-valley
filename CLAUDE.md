# dev-valley — Instruções

**Stack:** TypeScript · Node (Express, ws, node-pty) · Vite + Phaser 3 · sem banco

> Os guardrails universais e as convenções de trabalho vêm do `~/.claude/CLAUDE.md`.
> Aqui ficam **só** as regras que dependem deste projeto. Em conflito, este arquivo vence.

---

## O que este sistema é

Vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code no WSL.
Uso pessoal, roda local. Casa = projeto (pasta em `projectRoots`), morador = sessão do Claude Code,
pombal = git (o que é só seu × o que o time já tem), biblioteca = CLAUDE.md, memórias e docs, NPC com ✦ = agente permanente.
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
  - `src/index.ts` (entrada: serviços de verdade, WebSockets e `listen`), `app.ts` (rotas HTTP em `criarApp(ctx)`: o que
    age fora da pasta do projeto chega pelo `Contexto`, nunca importado direto na rota), `seguranca.ts` (origem local e o que `/api/arquivo` pode entregar), `world.ts`, `sessions.ts`, `git.ts`, `terminals.ts`, `hooks.ts`, `statusline.ts`,
    `library.ts`/`catalog.ts`/`librarian.ts` (biblioteca e bibliotecária), `consulta.ts` (base dos agentes da vila),
    `administrador.ts` (administrador da praça), `agents.ts`/`skills.ts` (Fábrica: agentes e skills), `reinicio.ts` (sino:
    reinício pendente), `estrutura.ts` (casa em obra e
    placa de vistoria), `sementes.ts` (caixa
    de sementes), `retrabalho.ts` (ervas do quintal), `quadro.ts` (quadro negro), `estante.ts` (estante), `lareira.ts` (lareira: tabela "Subir" e portas), `pombal.ts` (pombal: commit, pull e push), `escrevente.ts` (pombal: sugerir texto do commit), `guardrails.ts`
    (outdoor), `install-hooks.ts`.
  - `agents/bibliotecaria.md`: agente instalado em `~/.claude/agents`; `agents/administrador.md` e `agents/escrevente.md`: usados só pela vila.
- `mod/` — mod do Claude Code (`mod/hooks/register.ts`, lógica em `mod/hooks/moradores.ts`, testes em `mod/tests/`): eventos de
  sessão, rodapé com contexto e uso, nomes dos moradores e `@Nome`. Marketplace local em `.claude-plugin/`.
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
- Testes: `npm test` (`node:test` + `tsx`, em `server/tests/` e `web/tests/`; projeto de mentira em pasta temporária
  por `projeto()` de `server/tests/util.ts`, nunca projeto de verdade; rotas por `subir()` de `server/tests/servidor.ts`,
  com imitações). Cobre leitores, estado da lareira, travas de segurança e 15 das 37 rotas; o resto segue validado com
  typecheck + build e na vila (PD-8). Nada vermelho em 29/10/2026 (52/52).
- Mod: `claude plugin validate mod` e `claude plugin test mod`.
- Auditor de referências: `python3 scripts/auditar-referencias.py . --tudo` (o CI do GitHub roda o mesmo com
  `--sem-home`, em `.github/workflows/auditor.yml`)
- Mod e agentes: `npm run hooks:install` / `npm run hooks:uninstall`

## Regras técnicas deste projeto — invioláveis

1. **Repositório público.** Os projetos que aparecem na vila são privados: nunca escrever aqui nome, caminho,
   trecho ou dado deles (nem em exemplo, teste, commit ou print). Caminho pessoal vai no
   `dev-valley.config.local.json`.
2. **O servidor escuta só em `127.0.0.1` e recusa WebSocket de outra origem:** os terminais rodam comandos de
   verdade. Nunca afrouxar isso.
3. **O mod (`mod/`) e os hooks de permissão mandam à vila só `session_id`, `cwd`, nome do evento e tipo de
   notificação** (e contexto/limites no `/api/statusline`). Nunca conteúdo de arquivo ou prompt: o prompt é lido **só localmente**, para achar `@Nome` no
   mapa `~/.claude/dev-valley/moradores.json`. O teste `mod/tests/dev-valley.test.ts` confere isso.
4. **`hooks:install` instala o mod (`claude plugin install`) e mexe em `~/.claude/settings.json` (global, com
   backup) só nas entradas do Dev Valley (os hooks de shell de `PermissionRequest` e `Notification`; o mod não vê
   quando o diálogo de permissão abre):** nunca sobrescreve agente do usuário com o mesmo nome, e o
   uninstall remove só o que é do Dev Valley.
5. **Consultas da bibliotecária, do administrador da praça e do escrevente do pombal usam `claude -p --no-session-persistence`** para não
   virarem moradores (base comum em `server/src/consulta.ts`). **O administrador só edita `PROGRESS.md`,
   `PENDENCIAS.md`, `docs-dev/painel.json` e `docs-dev/a-codar/` dos projetos da vila**, por regra `Edit(//caminho)`
   passada na chamada; nunca liberar `Edit` inteiro nem outra ferramenta de escrita para ele.
6. **Este repositório costuma ser editado de dentro da própria vila.** Reiniciar o servidor (`npm start` de novo,
   `npm run dev`, que reinicia sozinho ao salvar em `server/`) encerra todos os terminais da vila, inclusive a
   sessão que está editando. Nunca reiniciar nem rodar `npm run dev` por conta própria: avisar o usuário e ele
   reinicia quando as sessões terminarem (G21).
7. **Pixel art é gerada em código** (`web/src/game/textures.ts`, `interiorTextures.ts`); prévia em `web/sprites.html`.
8. **Todo agente (NPC ✦) veste o traje de agente secreto**, estilo "homens de preto": paletó e calça pretos, camisa
   branca, gravata e óculos escuros; só pele e cor do cabelo variam. É o que separa agente de sessão à primeira vista
   (decisão do usuário, 27/10/2026). Vale para os da Fábrica (automático na `AgentNpc`) e para qualquer agente da
   vila novo: desenhe com `villagerTexture(scene, id, true)`, nunca com a aparência sorteada dos moradores. Agente da vila
   novo entra na lista que reserva a combinação de pele × cabelo em `villager.ts`, para nenhum agente sair igual a ele.
9. **O pombal (`server/src/pombal.ts`) faz push numa branch que outras pessoas podem usar.** Push só por clique
   confirmado no painel e só de página local, nunca `--force` (o git só aceita fast-forward). Conflito no rebase sempre
   termina em `rebase --abort` (o repositório fica como estava).

## Regras de processo deste projeto

- Mensagens de commit em português, uma linha descrevendo a entrega (ver `git log`).
- **Ao final de cada entrega:** `PROGRESS.md` na mesma resposta (G5); `PENDENCIAS.md` se algo abriu ou fechou;
  `docs-dev/painel.json` só quando uma fase avança ou fecha (G14); `OPERACAO.md` se mudou o jeito de subir.
- **Gate de fechamento:** `npm test`, `npm run typecheck -w server` e `npm run build` sem erro, auditor sem achado, e a
  mudança conferida na vila pelo usuário (o reinício é dele, regra 6).
