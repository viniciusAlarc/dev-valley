# Dev Valley — Progresso

> Memória oficial do projeto (guardrail G5). Toda mudança de código entra aqui,
> na mesma resposta que a produziu. Mais recente no topo.

## 2026-10-25 — Quadro de avisos da praça e sinal só para P1

**O que mudou:** passo 2 do plano de representações visuais. O quadro de avisos da praça (antes só enfeite) agora
abre um painel com as pendências 👤 (decisão do usuário) de todos os projetos, agrupadas por projeto e com a
prioridade de cada uma; o tooltip diz quantas são. Decisão do usuário (25/10/2026): o "!" da fachada aparece **só com P1**
aberta (P2 não acende mais, para não alertar o tempo todo).
**Arquivos:** `web/src/ui/pendencias.ts` (`openUserPendencias`), `web/src/ui/actions.ts`, `web/src/game/TownScene.ts`
(quadro clicável, sinal só P1), `web/src/api.ts` (`urgentPendencias`).
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` do front (diretório temporário), auditor sem achado.
Falta conferir na vila (reinício do usuário).

## 2026-10-25 — Quadro de pendências na casa e sinal na fachada

**O que mudou:** passo 1 do plano de representações visuais (`docs-dev/a-codar/01-representacoes-visuais.md`,
decisões do usuário em 25/10/2026). O servidor lê o `PENDENCIAS.md` de cada projeto (só leitura; sem o arquivo,
sem quadro). Dentro da casa, um quadro de cortiça na parede ganha um bilhete por pendência (até 15), com a cor da
prioridade (P1 vermelho, P2 laranja, P3 amarelo, P4 papel); clicar abre o painel com a lista agrupada por prioridade e o
dono (👤💻🖥️). Na vila, a casa com P1/P2 aberta mostra um "!" sobre o telhado (vermelho com P1, laranja só com P2), e o
tooltip da casa diz quantas são.
**Arquivos:** `server/src/pendencias.ts` (novo), `server/src/world.ts` (`Project.pendencias`), `web/src/api.ts`,
`web/src/ui/pendencias.ts` (novo), `web/src/ui/actions.ts`, `web/src/game/interiorTextures.ts` (`corkBoard`, `note1..4`),
`web/src/game/InteriorScene.ts` (`pinNotes`), `web/src/game/TownScene.ts` (sinal), `web/src/style.css`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` do front (num diretório temporário, para não trocar o
front servido enquanto há sessões na vila), auditor sem achado; leitor testado contra o `PENDENCIAS.md` deste repo.
Falta conferir na vila (reinício do usuário).

## 2026-10-25 — Praça mais completa

**O que mudou:** o poço virou um chafariz (com gotas animadas) e a praça ganhou árvores nos cantos de cima, quadro de
avisos (só decorativo), um banco comprido à esquerda e dois arbustos juntos à direita (pedido do usuário: nada
espelhado), canteiro, calçamento circular em volta do chafariz, postes nos cantos de
baixo e meio-fio (aberto onde a estrada central entra). A faixa onde os moradores avulsos andam continua livre e ficou
mais estreita para não passar pelos postes. Pixel art nova no mesmo estilo (contorno de 1px, paletas existentes).
O campo `well` do layout passou a se chamar `fountain`; a textura do poço saiu.
**Arquivos:** `web/src/game/textures.ts` (`fountain`, `noticeBoard`, `bench`, `lamppost`, `planter`, `plazaRing`),
`web/src/game/TownScene.ts` (`buildPlaza`, faixa de passeio), `web/src/game/layout.ts`.
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado; composição da praça conferida num render
fora do navegador (mesmas funções de desenho). Falta conferir na vila.

## 2026-10-25 — Avulsas encerradas voltam à praça

**O que mudou:** com o quintal só de vivas, as sessões avulsas encerradas ficaram sem lugar (a praça não tem
"dentro de casa"). Decisão do usuário (25/10/2026): na praça ficam todas as avulsas vivas e, se houver vaga, as encerradas
mais recentes, até 4 no total (regra antiga, agora fixa no código em `PLAZA_OFFLINE_LIMIT`). Os quintais das casas continuam só com vivas.
**Arquivos:** `web/src/api.ts` (`yardResidents`).
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Falta conferir na vila.

## 2026-10-25 — Quintal só com sessões vivas

**O que mudou:** o botão "Encerrar sessão" já matava o processo (conferido: SIGHUP encerra o `claude` e o `SessionEnd`
chega à vila), mas o NPC continuava no quintal porque ele mostrava as 4 sessões mais recentes, vivas ou não.
Decisão do usuário (25/10/2026): o quintal mostra **só sessões vivas**, valendo para qualquer sessão que termina (botão
da vila ou terminal fechado no VS Code). Encerrada, ela fica dentro de casa até ser retomada ou passar de
`sessionMaxAgeDays` (14 dias). Apagar o `.jsonl` foi descartado: é irreversível e quebra o `claude --resume`.
A config `sessionsPerProject` perdeu o uso e saiu.
**Arquivos:** `web/src/api.ts` (`yardResidents`), `server/src/config.ts`, `server/src/world.ts`, `server/src/index.ts`,
`web/src/game/TownScene.ts`, `dev-valley.config.json`, `README.md` (seção Configuração).
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Falta conferir na vila (reinício do usuário).

## 2026-10-25 — Revisão para repositório público

**O que mudou:** o exemplo da caixa de busca da bibliotecária citava um projeto privado; virou um exemplo genérico
(o commit antigo continua no histórico, decisão do usuário: não reescrever). O auditor deixou de ter fixos os caminhos
das regras pessoais: os globs saem de `auditorAcervos` no `dev-valley.config.local.json`, e a docstring ficou genérica.
**Arquivos:** `web/src/ui/librarian.ts`, `scripts/auditar-referencias.py`, `README.md` (seção Configuração).
**Testes:** auditor sem achado (10 arquivos externos conferidos, igual a antes), `npm run typecheck -w server`, `npm run build`.

## 2026-10-25 — Projeto padronizado com as regras de trabalho (G5, G6, G14)

**O que mudou:** criados `PROGRESS.md`, `PENDENCIAS.md`, `docs-dev/painel.json` e `docs-dev/guias/OPERACAO.md`
(via `instalar-projeto.sh`) e o auditor de referências, ajustado à estrutura do repo. O estado e o roadmap saíram
do `CLAUDE.md` e do `README.md` e passaram a morar só no `PENDENCIAS.md`. A bibliotecária deixou de ser chamada
proativamente: o roteador do `~/.claude/CLAUDE.md` tem precedência e ela começa por ele.
**Arquivos:** `CLAUDE.md` (formato do template, cuidado com reinício do servidor), `README.md` (roadmap → `PENDENCIAS.md`),
`server/agents/bibliotecaria.md` (descrição e ordem de consulta), `scripts/auditar-referencias.py` (ALVOS/RAIZES),
`.claude/auditoria-regras.txt`.
**Testes:** `python3 scripts/auditar-referencias.py . --tudo` e `npm run typecheck -w server`.
**Aberto:** PD-1 (hooks como mod), PD-2 (canário), PD-3 (reinstalar a bibliotecária).

## 2026-10-25 — CLAUDE.md do projeto (a164220)

**O que mudou:** visão geral, stack, comandos e cuidados do projeto.
**Arquivos:** `CLAUDE.md`.

## 2026-10-25 — Bibliotecária e painel de uso minimizável (3618d87)

**O que mudou:** agente permanente que acha conhecimento documentado a partir de um catálogo gerado sem IA;
chat no balcão da biblioteca via `claude -p --no-session-persistence`.
**Arquivos:** `server/agents/bibliotecaria.md`, `server/src/catalog.ts`, `server/src/librarian.ts`, `server/src/install-hooks.ts`.
**Testes:** validado na vila (sem suíte automatizada, PD-8).

## 2026-10-25 — Contexto por sessão e uso do plano (ff17fad, 1c6a03b)

**O que mudou:** a status line manda à vila a janela de contexto e os limites do plano (5h e semanal); uso
persistido e explicação quando o painel está vazio.
**Arquivos:** `server/src/statusline.ts`, `server/src/claude-commands.ts`, `web/src/ui/`.

## 2026-10-25 — Biblioteca (ffb203d)

**O que mudou:** estantes com CLAUDE.md, memórias e docs de cada projeto, com leitor, edição e busca.
**Arquivos:** `server/src/library.ts`, `web/src/game/LibraryScene.ts`, `web/src/ui/`.

## 2026-10-24 — Moradores, interior das casas e status ao vivo (1d66f0a)

**O que mudou:** sprites 16x32 estilo Stardew, interior das casas com as sessões do projeto, hooks do Claude Code
avisando a vila (trabalhando / pedindo permissão).
**Arquivos:** `web/src/game/villager.ts`, `web/src/game/InteriorScene.ts`, `server/src/hooks.ts`, `server/src/install-hooks.ts`.

## 2026-10-24 — MVP da vila (54fd081)

**O que mudou:** vila em Phaser com casa por projeto, caixa de envio (diff Monaco + commit), morador por sessão
com terminal embutido (`claude --resume` via node-pty).
**Arquivos:** `server/src/`, `web/src/`.
