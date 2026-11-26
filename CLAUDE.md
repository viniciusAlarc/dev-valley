# dev-valley — Instruções

**Stack:** TypeScript · Node (Express, ws, node-pty) · Vite + Phaser 3 · sem banco

> Os guardrails universais e as convenções de trabalho vêm do `~/.claude/CLAUDE.md`.
> Aqui ficam **só** as regras que dependem deste projeto. Em conflito, este arquivo vence.
> O detalhe das regras 3, 4, 5, 7, 8, 9 e 10 mora em `.claude/rules/`, carregado quando a sessão abre os arquivos daquele
> assunto; mexendo no assunto sem ter aberto esses arquivos, ler a regra de lá antes.

---

## O que este sistema é

Vila em pixel art (inspirada em Stardew Valley) para organizar projetos e sessões do Claude Code no WSL.
Uso pessoal, roda local. Casa = projeto (pasta em `projectRoots`), morador = sessão do Claude Code,
pombal = git (o que é só seu × o que o time já tem), biblioteca = CLAUDE.md, memórias e docs, NPC com ✦ = agente permanente.
Mapa completo "na vila → por baixo" no `README.md`.

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

- Monorepo npm com workspaces `server` (Node + Express + `ws` + `node-pty`, rodado com `tsx`), `web` (Vite + Phaser 3,
  xterm.js, Monaco, marked + DOMPurify) e o mod do Claude Code em `mod/` (marketplace local em `.claude-plugin/`).
- **Fronteira das rotas:** `server/src/app.ts` monta as rotas em `criarApp(ctx)`; o que age fora da pasta do projeto
  chega pelo `Contexto`, nunca importado direto na rota (cobrado por `server/tests/arquitetura.test.ts`).
- Agentes usados pela vila em `server/agents/`; cenas Phaser em `web/src/game/`, painéis HTML em `web/src/ui/`. Qual
  arquivo faz o quê: pelo nome (cada peça da vila tem o seu, ex.: `pombal.ts`, `quarto.ts`) e pelo mapa do `README.md`.
- Config: `dev-valley.config.json` (versionado) sobrescrito por `dev-valley.config.local.json` (ignorado pelo git).

## Comandos

- Instalar: `npm install`
- Rodar: `npm start` (build do front + servidor em http://localhost:4777)
- Desenvolvimento: `npm run dev` (front com hot reload em http://localhost:5173)
- Build: `npm run build` (front: `tsc && vite build`)
- Checagem de tipos do servidor: `npm run typecheck -w server`
- Testes: `npm test` (`node:test` + `tsx`, em `server/tests/` e `web/tests/`, com o `HOME` numa pasta temporária por
  `scripts/isolar-home.mjs`). Projeto de mentira por `projeto()` de `server/tests/util.ts`, nunca projeto de verdade;
  rotas por `subir()` de `server/tests/servidor.ts`; git em remoto e clones de mentira, como `pombal.test.ts`.
  WebSockets e front: typecheck + build e conferência na vila. O CI (`.github/workflows/auditor.yml`) roda typecheck,
  `npm test` e build a cada push; o hook `Stop` (`scripts/conferir-ao-parar.sh`) não deixa terminar a resposta com
  `.ts` editado e tipos quebrados.
- Mod: `claude plugin validate mod` e `claude plugin test mod`.
- Prévia dos moradores em PNG, sem navegador: `npx tsx scripts/previa-moradores.ts <saida.png> [quantos|catalogo]`.
- Auditor de referências: `python3 scripts/auditar-referencias.py . --tudo` (o CI do GitHub roda o mesmo com
  `--sem-home`, em `.github/workflows/auditor.yml`)
- Mod e agentes: `npm run hooks:install` / `npm run hooks:uninstall`

## Regras técnicas deste projeto — invioláveis

1. **Repositório público.** Os projetos que aparecem na vila são privados: nunca escrever aqui nome, caminho,
   trecho ou dado deles (nem em exemplo, teste, commit ou print). Caminho pessoal vai no
   `dev-valley.config.local.json`. Cobrado pelos hooks do git `pre-commit` e `commit-msg` (`.githooks/`,
   `scripts/conferir-publico.mts`, ligados pelo `npm install`); `node scripts/conferir-publico.mts --tudo` varre tudo.
2. **O servidor escuta só em `127.0.0.1` e recusa WebSocket de outra origem:** os terminais rodam comandos de
   verdade. Nunca afrouxar isso.
3. **O mod e os hooks de permissão mandam à vila só ids, evento e categoria da ferramenta; nunca conteúdo de arquivo
   ou prompt** (o prompt é lido só localmente, para achar `@Nome`). Cobrado por `mod/tests/dev-valley.test.ts`; lista
   completa em `.claude/rules/mod-so-ids.md`.
4. **`hooks:install` só mexe no que é do Dev Valley** (no `settings.json` global, com backup, e nos agentes): nunca
   sobrescreve o que é do usuário. Detalhe em `.claude/rules/instalador.md`.
5. **Agentes da vila** (consultas por `claude -p --no-session-persistence`, base em `server/src/consulta.ts`): os que
   só leem respondem na conta DeepSeek de `agentes.conta`; o administrador, único que edita, fica no Claude e só edita
   os arquivos de rastro. Conta e ferramentas de cada um em `.claude/rules/agentes-da-vila.md`.
6. **Este repositório costuma ser editado de dentro da própria vila.** Reiniciar o servidor (`npm start` de novo,
   `npm run dev`, que reinicia sozinho ao salvar em `server/`) encerra todos os terminais da vila, inclusive a
   sessão que está editando. Nunca reiniciar nem rodar `npm run dev` por conta própria: avisar o usuário e ele
   reinicia quando as sessões terminarem (G21). O `.claude/settings.json` do repositório nega `npm start` e `npm run dev` às sessões
   (regra dura, 08/11/2026): o usuário reinicia pelo próprio terminal.
7. **Pixel art é gerada em código**, e a aparência do morador segue a marca do nome e o provedor da conta.
   Detalhe em `.claude/rules/pixel-art.md`.
8. **Todo agente (NPC ✦) veste o traje de agente secreto** (`villagerTexture(scene, id, true)`); a única exceção é a
   médica da clínica. Detalhe em `.claude/rules/pixel-art.md`.
9. **O pombal faz push numa branch que outras pessoas usam:** só por clique confirmado de página local, nunca
   `--force`, e conflito no rebase termina em `rebase --abort`. Detalhe em `.claude/rules/pombal.md`.
10. **Sessão de trabalho do porão só nasce de uma tarefa que o usuário aprovou no cartão** (aprovar exige `Origin`
   local presente; teto de 5 sessões por rodada, até 3 abertas ao mesmo tempo; a vila é a única que escreve o
   `rodada.json`). Detalhe em `.claude/rules/porao.md`.

## Regras de processo deste projeto

- Mensagens de commit em português, uma linha descrevendo a entrega (ver `git log`).
- **Ao final de cada entrega:** `PROGRESS.md` na mesma resposta (G5); `PENDENCIAS.md` se algo abriu ou fechou;
  `docs-dev/painel.json` só quando uma fase avança ou fecha (G14); `OPERACAO.md` se mudou o jeito de subir.
- **Gate de fechamento:** `npm test`, `npm run typecheck -w server` e `npm run build` sem erro, auditor sem achado, e a
  mudança conferida na vila pelo usuário (o reinício é dele, regra 6).
