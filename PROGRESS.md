# Dev Valley — Progresso

> Memória oficial do projeto (guardrail G5). Toda mudança de código entra aqui,
> na mesma resposta que a produziu. Mais recente no topo.

## 2026-10-26 — Status line e hooks viram o mod dev-valley, com permissão no shell (PD-11)

**O que mudou:** decisões do usuário (26/10/2026): o `hooks:install`/`uninstall` passa a instalar e remover o mod; a
bibliotecária fica em `~/.claude/agents`. O mod mora em `mod/` (marketplace local em `.claude-plugin/marketplace.json`,
mesmo caminho do mod guardrails). A primeira versão usava os eventos `classic.*` (os mesmos dos hooks de shell) e, numa
sessão real, **todos foram pulados**: o plugin de segurança `cc-plugin-sec-default` roda acima dos mods de usuário e passa
esses eventos por cima deles; só o rodapé funcionou, e a vila mostrava "trabalhando" por padrão (status vazio).
Reescrito com eventos nativos: `session.start` (abriu + nome), `prompt.submit` (trabalhando; "você é o morador X"
junto da primeira mensagem e `@Nome`, ambos pelo campo `context`; pede o nome se a sessão ainda não tem, como depois
de `/clear`; o `prompt.compose` foi tentado e também é pulado pelo plugin de segurança), `tool.call` (antes e depois da ferramenta), `turn.complete` da conversa
principal (esperando), `session.end`, `session.measure` + `$.ui.status` (rodapé `🌾 ctx 45% · 5h 30% · 7d 12%`, ao lado do
`guardrails ✓`). Nenhum evento nativo diz quando o diálogo de permissão abre, então, por decisão do usuário (híbrido),
`PermissionRequest` e `Notification` continuam como hook de shell (`jq` + `curl`) no `settings.json`. O corpo enviado à
vila é o mesmo de antes: o servidor não mudou. Cada aviso é esperado dentro do hook com limite de 1s (como o
`curl -m 1`). Saem o caminho absoluto do node e o `server/hooks/morador.mjs`; a porta vai ao mod por
`~/.claude/dev-valley/vila.json`, gravado pelo install.
**Arquivos:** `mod/` (novo: `mod/.claude-plugin/plugin.json`, `mod/hooks/hooks.json`, `mod/hooks/register.ts`,
`mod/hooks/moradores.ts`, `mod/tests/dev-valley.test.ts`), `.claude-plugin/marketplace.json` (novo),
`server/src/install-hooks.ts`, `server/src/claude-commands.ts` (`SHELL_EVENTS`), `server/hooks/morador.mjs` (removido),
comentários em `server/src/index.ts` e `moradores.ts`, `CLAUDE.md` (estrutura, comandos, regras 3 e 4), `README.md`,
`docs-dev/guias/OPERACAO.md`, `docs-dev/context/hooks-como-mod.md` (plano, movido de `a-codar/`), `RETRABALHO.md` (novo).
**Testes:** `claude plugin validate mod` ok; `claude plugin test mod` 8/8 com os eventos nativos (citação, rodapé,
corpo da status line, nome ao abrir via `prompt.compose`, vila fechada, porta do `vila.json`, fim de turno = Stop, e a
regra 3: o corpo enviado tem só `session_id`, `cwd` e evento, nunca o texto da mensagem); `tsc` do mod;
`npm run typecheck -w server`; auditor sem achado. Front sem mudança. Conferido pelo usuário numa sessão nova (status ao
vivo, permissão, `@Nome`); depois disso o "você é o morador X" passou do `prompt.compose` (pulado) para a primeira
mensagem, testado no `claude plugin test` e a conferir na próxima sessão nova (PD-14). PD-11 e PD-13 fechadas; o plano
foi para `docs-dev/context/hooks-como-mod.md`.

## 2026-10-26 — Nomes únicos dos moradores e citação @Nome entre sessões

**O que mudou:** decisões do usuário (26/10/2026): (1) nenhum nome repetido entre moradores; (2) uma sessão sabe a
que outra o usuário se refere ao citar `@Nome`, sem busca; (3) cada sessão sabe o próprio nome. Antes o nome saía de
um hash do id sobre 24 nomes, e repetia a partir de umas 6 sessões. Agora o servidor dá os nomes (`moradores.ts`):
cadastro persistente sessão → nome em `~/.claude/dev-valley/nomes.json`, únicos entre as sessões da vila, lista com 80
nomes; quem já tinha nome sem conflito manteve (nos repetidos, a sessão mais antiga ficou com ele). A cada atualização
a vila grava o mapa `~/.claude/dev-valley/moradores.json` (nome → sessão, projeto, pasta, título, estado, `.jsonl`).
Hook novo `server/hooks/morador.mjs` em SessionStart (pergunta o nome à vila por `POST /api/moradores/nome`, mandando
só o `session_id`, e conta à sessão quem ela é) e UserPromptSubmit (acha `@Nome` no prompt localmente e junta o
morador do mapa; e-mail e `@pacote` não contam). Regra 3 do CLAUDE.md, README e OPERACAO atualizados.
**Arquivos:** `server/src/moradores.ts` (novo), `server/hooks/morador.mjs` (novo), `server/src/world.ts`,
`server/src/sessions.ts` (`file`), `server/src/index.ts`, `server/src/claude-commands.ts`, `server/src/install-hooks.ts`,
`web/src/api.ts`, `web/src/game/names.ts`, `CLAUDE.md`, `README.md`, `docs-dev/guias/OPERACAO.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário). Auditor acusa só
`~/.claude/dev-valley/nomes.json` e `moradores.json`, que a vila cria na primeira atualização depois do reinício. Nomes
testados com as 11 sessões reais gravando num HOME de teste: 11 nomes únicos, 8 mantiveram o nome antigo, estáveis após
reinício. Hook testado com citação (morador achado, nome desconhecido avisado, e-mail e `@types/node` ignorados), sem
citação (saída vazia) e com a vila fechada (silêncio, exit 0). Depois do reinício e do `hooks:install` (26/10/2026): auditor limpo, mapa com 11
moradores e 11 nomes únicos, e o SessionStart com a vila no ar devolveu o nome certo. Conferido pelo usuário numa sessão nova: ela sabe o próprio nome e `@Vera` trouxe quem é (PD-12 fechada).

## 2026-10-25 — Diário do progresso no atril da casa

**O que mudou:** passo 4 (último) do plano de representações visuais. Dentro da casa, entre a estante e o quadro de
pendências, um atril com o livro aberto quando o projeto tem `PROGRESS.md`. O tooltip diz quantas entregas há e a data
da última; o clique abre o diário, uma entrega por página (a mais recente primeiro), com botões para folhear e um
sumário na lateral com todas as entregas agrupadas por data, para pular direto para qualquer página (pedido do usuário,
25/10/2026: projeto longo não dá para folhear uma a uma; mesmo layout e classes da biblioteca). O mundo
leva só o resumo (contagem e última data); as páginas vêm sob demanda por `GET /api/progress`, para o `PROGRESS.md`
inteiro não ir à vila a cada atualização. Markdown sanitizado como na biblioteca.
**Arquivos:** `server/src/progress.ts` (novo), `server/src/world.ts` (`Project.progress`), `server/src/index.ts`
(`/api/progress`), `web/src/api.ts`, `web/src/game/interiorTextures.ts` (`lectern`), `web/src/game/InteriorScene.ts`,
`web/src/ui/diario.ts` (novo), `web/src/ui/actions.ts`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` do front (diretório temporário), auditor sem achado;
leitor testado contra o `PROGRESS.md` deste repo (15 entregas, todas com data); atril conferido num render fora do
navegador; conferido na vila pelo usuário. Com isso o plano fechou: saiu de `docs-dev/a-codar/` para
`docs-dev/context/representacoes-visuais.md`, a PD-10 foi fechada e a fase "Representações visuais" virou `feito`.

## 2026-10-25 — Pendências PD-1, PD-2 e PD-3 fechadas

**O que mudou:** só acompanhamento, sem código. PD-2: o usuário conferiu numa sessão nova que `guardrails ✓` continua
na status line junto com a do Dev Valley. PD-3: o usuário rodou `npm run hooks:install` de novo (bibliotecária com a
descrição não proativa). PD-1: decisão do usuário, hooks e status line vão virar um mod do Claude Code; ainda não
feito, então entrou como PD-11 com o plano em `docs-dev/context/hooks-como-mod.md`.
**Arquivos:** `PENDENCIAS.md`, `docs-dev/context/hooks-como-mod.md` (novo).

## 2026-10-25 — Horta das fases no quintal

**O que mudou:** passo 3 do plano de representações visuais. O servidor lê o `docs-dev/painel.json` de cada projeto
(só leitura; sem o arquivo ou com `plano: null`, sem horta). À esquerda de cada casa, um canteiro por fase do plano
(até 9, grade 3x3, na ordem do JSON): terra arada = a fazer, broto = em andamento, planta madura = feito. O tooltip diz
a fase e o estado; o clique abre o painel com as fases e as últimas entregas. A horta cabe na faixa que já era
reservada ao lado da casa, então árvores e flores da vila não mudam de lugar.
**Arquivos:** `server/src/painel.ts` (novo), `server/src/world.ts` (`Project.painel`), `web/src/api.ts`,
`web/src/game/textures.ts` (`crop-todo`, `crop-growing`, `crop-done`), `web/src/game/TownScene.ts` (`plantGarden`),
`web/src/ui/painel.ts` (novo), `web/src/ui/actions.ts`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` do front (diretório temporário), auditor sem achado;
leitor testado contra o `painel.json` deste repo; canteiros conferidos num render fora do navegador (mesmas funções de
desenho, script no scratchpad). Falta conferir na vila (reinício do usuário).

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

**O que mudou:** passo 1 do plano de representações visuais (`docs-dev/context/representacoes-visuais.md`,
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
