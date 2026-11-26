# Dev Valley — Progresso

> Memória oficial do projeto (guardrail G5). Toda mudança de código entra aqui,
> na mesma resposta que a produziu. Mais recente no topo.

## 2026-11-26 — Sprint no porão: cartão "Fechar a sprint" e as 7 etapas no quadro da estante (SP-1)

**Falta conferir na vila** (reiniciar a vila; o reinício é do usuário, regra 6).

**Por quê:** o usuário passou a fazer a sprint inteira numa rodada do porão (decisão de 26/11/2026, opção "direto na
vila") e quer ver o fluxo de ponta a ponta: plano → código → testes → revisão → roteiro → estudo → guia. Plano e
decisões em `docs-dev/context/sprint-no-porao.md`.

**O que mudou:**
1. **Pedido com `sprint`** (`POST /api/porao/pedidos`, mesmo formato do nome da rodada): vai para o `rodada.json`
   com o `commitInicial` (HEAD do projeto no clique, `lerHead`), que é a base da revisão do conjunto.
2. **Fim da rodada de sprint:** a vila põe na estante o cartão **"Fechar a sprint"** no lugar do roteiro
   (`pedirFechamentoDaVila`). O clique abre um morador na casa com `/fechar-sprint <relatório> <pasta da sprint>`
   (fora do teto; o gongo não recusa o pedido nem apaga a sessão).
3. **Quadro da estante:** as 7 etapas (`etapasDaSprint`, `rodada.ts`), ✔ conforme o arquivo aparece na pasta da
   sprint (`plano.md`, `revisao.md`, `roteiro.html`, `estudo.html`, `guia.html`), código e testes pelo `rodada.json`,
   ❗ no gate reprovado, link de cada documento pronto. Tooltip da estante diz a etapa da vez; o gongo avisa se a
   sprint ainda tem etapa por fazer.
4. **Config:** `porao.pastaSprints` (padrão `docs-dev/sprints`; relativo e sem `..`, senão o padrão).

**Testes:** 5 novos em `server/tests/rodada.test.ts` (sprint inválido recusado e rodada comum sem `git`; sprint e HEAD
gravados; cartão de fechar no lugar do roteiro, um só, fora do teto, sobrevive ao gongo e abre o comando certo; as 7
etapas pelos arquivos, com ❗ no gate reprovado; `pastaSprintsValida`). Suíte: 365 → 370, 0 falhas. Typecheck,
build e auditor ok; `conferir-publico --tudo` limpo.

**Fora deste repositório (mesma entrega, G16):** molde visual comum em `~/Documents/IA/claude/molde/`, skill
`/fechar-sprint`, modo sprint em `/roteiro-testes` e `/revisar`, seção "Rodada de sprint" no agente `maestro`.

## 2026-11-25 — Porão no modo início de sprint: posse por sessão, fila de testes e ondas de até 3 (MS-1)

**O que mudou** (plano `docs-dev/context/porao-modo-sprint.md`, decidido pelo usuário em 25/11/2026):
1. **P1, posse por sessão:** `scripts/porao-hook.sh`, modos `posse` e `bash`, recusa a sessão cujo `session_id` não é o
   `sessionId` da tarefa no `rodada.json` ("pare e avise o usuário"). Sem um dos dois, segue como antes.
2. **P2, fila de testes:** a vila grava `<rodada>/testar.sh` a cada pedido aprovado (`scriptDeTestes`, `rodada.ts`):
   `testar.sh <n>` roda o n-ésimo teste da tarefa (do `DEV_VALLEY_TAREFA`, posto no `env` do `--settings`) na pasta do
   projeto, com `flock` em `<rodada>/testes.lock`. O hook recusa a suíte crua (de qualquer tarefa) e aponta o número;
   teste focado continua livre. Linha de base e gate final esperam na mesma trava (`executarComando`, `gate.ts`).
3. **P3, ondas:** `porao.simultaneas` no config (padrão 3, até 5); o clique e a volta automática só abrem tarefa livre
   com menos de 3 abertas ou abrindo na rodada. O cartão avisa "abre em ondas de até 3".
4. **Junto (G16):** regra 10 do `CLAUDE.md`, `.claude/rules/porao.md`, `README.md`, `maestro-v3.md` e o briefing do
   `~/Documents/IA/claude/agents/maestro.md` (branch `vinicius`, commit `07a9f44`): "Testes liberados" numerados e pela fila,
   até 3 por vez.
**Testes:** `npm test` 365/365 (antes 361; novos: sessão no hook, suíte crua recusada, duas `testar.sh` em sequência
conferidas por horário, `env` no `--settings`; a propriedade do porão ganhou "nunca mais de `simultaneas` abertas",
que falha com a trava desligada). `npm run typecheck -w server` e `npm run build` ok. Auditor: achados só em
`PROGRESS.md:1106-1109`, da reorganização do PROGRESS de outra sessão.
**Ensaio em 26/11/2026** (pedido do usuário; sessões `claude -p` reais, projeto e rodada de mentira no scratchpad, regras,
hooks e `testar.sh` gerados pelo código da vila): o `session_id` chega ao PreToolUse; o `DEV_VALLEY_TAREFA` do
`--settings` chega ao Bash (`testar.sh 1` sem a tarefa rodou); `npm test` cru recusado e a suíte rodou uma vez, pela
fila; a sessão registrada escreveu, outra sessão na mesma tarefa foi recusada, parou e avisou; o gate real
(`executarComando` com a trava) só começou depois do fim do `testar.sh` de uma sessão. A vila reiniciada serve o bundle
com o aviso das ondas.
Falta conferir na vila (numa rodada real com mais de 3 tarefas livres: o cartão mostra "ondas de até 3" e abrem só 3).

## 2026-11-25 — Bloco 3 da limpeza: suposições no plano, mod mede disparos e avisa da própria saúde (EC-1)

**O que mudou** (pedido do usuário de 25/11/2026: seguir com os próximos passos e revisar tudo depois):
1. **Item 13, alertas de saúde:** o mod `guardrails` 0.3.0 (`~/Documents/IA/mods/guardrails/hooks/saude.ts`) avisa no
   início da sessão quando a cópia carregada difere da fonte (o problema de 22/10 a 24/11) ou quando o núcleo passa do teto.
2. **Item 12, medir disparos:** o mesmo mod conta chamadas, avaliações e disparos de cada guarda e grava uma vez por
   turno em `~/.claude/guardrails-disparos.json` (só nomes e números). A primeira leitura ficou como EC-4.
3. **Item 11, suposições:** seção "Suposições e como conferi" no G2 do núcleo (70 linhas, dentro do teto) e campo
   "Suposições a conferir" no briefing do maestro.
4. **Itens 10 e 14 e Bloco 4:** não codados; recomendação de cada um em `docs-dev/context/limpeza-do-ecossistema.md`
   (EC-1 e EC-3).
Commits no `~/Documents/IA` (branch `vinicius`): `f0b01aa` e `9a860b3`; mod atualizado nas 3 contas (cópia igual à fonte).
**Testes:** `claude plugin test` do mod 44/44 (+8 de `saude.test.ts`), `claude plugin validate` ok, tipos do mod contra a
API do engine ok, `conferir-publico --tudo` limpo.
Falta conferir na vila (numa sessão nova: nenhum aviso de saúde aparece; depois de um turno, o arquivo de disparos existe).

## 2026-11-25 — Bloco 2 fechado: teto do núcleo, regras 3, 4 e 9 em rules e sobre-mim enxuto (EC-1)

**O que mudou** (aprovado pelo usuário em 25/11/2026, "3 passos juntos"):
1. **Commit no `~/Documents/IA`** (branch `vinicius`): núcleo enxuto, rules, histórico e mod 0.2.0; e, em seguida, o teto.
2. **Teto do núcleo** de ~120 linhas e ~20 guardrails para **~75 linhas e ~14 blocos** (`TRIAGEM.md`, `/auditar-regras`
   e o `README.md` do IA). Conta-se bloco, porque os 21 números continuam e regras parecidas dividem bloco. O mapa do
   ecossistema mede igual (`PESO_TETO_BLOCOS`, `scripts/mapa-ecossistema.ts`); sem isso, os 21 números já acusariam estouro.
3. **Regras 3, 4 e 9 deste `CLAUDE.md`** por inteiro em `.claude/rules/` (`mod-so-ids.md`, `instalador.md`,
   `pombal.md`), com uma linha de resumo cada no `CLAUDE.md` (104 → 97 linhas). A rule do instalador já diz que só a
   bibliotecária vai para as contas.
4. **`sobre-mim.md`** (fora do git) de 60 para 51 linhas: "WSL limpo", a branch do IA e o link de arquivo sem as
   histórias, com a norma inteira. Cópia de antes em `sobre-mim.md.bak-20261125`, ao lado.
**Testes:** `npm test` 361/361, `npm run typecheck -w server`, auditor sem achado novo, `conferir-publico --tudo` limpo.
Falta conferir na vila (o usuário revisa as mudanças; numa sessão nova, abrir `server/src/pombal.ts` e ver a regra 9 carregar).

## 2026-11-25 — Casa pessoal oferece também o DeepSeek trabalho

**O que mudou** (pedido do usuário): a tela "Nova sessão" de uma casa pessoal passa a listar, além das contas
pessoais, as contas DeepSeek de trabalho. O Claude continua fora da casa pessoal (licença do trabalho); casa de
trabalho segue igual. Regra em `contasDaCasa` (`server/src/perfil.ts`); a rota `POST /api/sessions` já valida contra
essa lista, então aceita a conta nova sem mudança.
**Testes:** `npm test` 361/361 (teste de `perfil.test.ts` atualizado), typecheck do servidor e do front sem erro.
Falta conferir na vila (depois do reinício: casa pessoal → Nova sessão mostra "DeepSeek pessoal" e "DeepSeek trabalho").

## 2026-11-25 — Núcleo dos guardrails enxuto (EC-1, Bloco 2) e o mapa do ecossistema lendo os blocos juntados

**O que mudou** (aprovado pelo usuário, por grupo, em 24/11/2026; tudo em `~/Documents/IA`, branch `vinicius`, sem commit):
1. `guardrails-core.md` de 129 para 68 linhas (9,9 para 4,8 KB), **sem renumerar** (cada número é citado em 5 a 20
   arquivos): G3+G20, G4+G11 e G6+G7+G12 no mesmo bloco; regras cobradas pelo mod (G5, G13, G14, G18) com 1 a 2 linhas;
   G15, G16 e G17 em 3 linhas.
2. G9, G10 e G19 por inteiro em `~/Documents/IA/claude/rules/` com `paths:` (carregam ao abrir controller/rota/SQL, serviço/entidade,
   CSS/HTML/componente); o `instalar.sh` linka em `~/.claude/rules/` (passo 2c), e `rules/` das contas DeepSeek é link
   para lá (D16).
3. As histórias de incidente com data foram para `~/Documents/IA/guardrails-ia/historico.md`; `/nova-regra`, o `TRIAGEM.md` e o índice
   do `README.md` passaram a mandar o porquê para lá, e o `/auditar-regras` lê também as rules.
4. Dev Valley: `lerGuardrails` (`scripts/mapa-ecossistema-dominio.ts`) entende bloco com vários códigos (`## G3 e G20 —`),
   o "(mod)" no título e a cobrança por item (`- **G9**`); lê as 21 regras do núcleo novo.
**Testes:** `npm test` 361/361 (+1 do leitor de blocos), `npm run typecheck -w server`, auditor sem achado novo;
`instalar.sh` rodado (3 rules linkadas).
Falta conferir na vila (numa sessão nova: abrir um `.css` e ver a G19 carregar; o mapa do ecossistema regenerado mostra 21 regras e 68 linhas).

## 2026-11-24 — Mod guardrails atualizado nas 3 contas (EC-2)

**O que mudou:** o mod `guardrails` carregado nas 3 contas era a cópia em cache de 22/10: os guardas de 23/11 (G3 no
`git push` e no volume do Docker, G5 ao parar, G13 no CPF, G14, G18, G19, G20 e a opção WSL limpo) não rodavam em
nenhuma sessão. A causa: o mod mudou sem subir a versão do `plugin.json`, e o `claude plugin update` só copia de novo
quando a versão muda. Subi para 0.2.0 em `~/Documents/IA/mods/guardrails` (branch `vinicius`, sem commit) e atualizei
nas 3 contas; a cópia carregada agora é igual à fonte nas três (conferido por `diff`).
**Testes:** `claude plugin test` do mod 36/36, `claude plugin validate` ok.
Falta conferir na vila (vale em sessão nova: a status line mostra `guardrails ✓`, e um `cd <pasta> && <escrita>` é barrado).

## 2026-11-24 — Esforço padrão do DeepSeek na vila passa de `max` para `high`

**O que mudou:** pedido do usuário: o esforço padrão das contas DeepSeek na vila é `high`. Saiu o
`env.CLAUDE_CODE_EFFORT_LEVEL: "max"` dos `settings.json` de `~/.claude-deepseek` (DeepSeek trabalho) e
`~/.claude-pessoal` (DeepSeek pessoal): era ele que forçava toda sessão e impedia o `/effort` de mudar. O padrão agora
vem de `modelSettings.deepseek-flash.effortLevel: "high"`, que já existia na conta de trabalho e foi posto na pessoal.
**Por que assim:** o `env` da conta é lido por todo processo `claude` novo (terminal da vila e `claude -p` dos agentes,
com o servidor da vila sem a variável no ambiente), então não precisou de código na vila; sem o override, o `/effort`
volta a poder mudar o esforço por sessão.
**Conferido:** JSON válido nas duas contas (`jq`); uma sessão curta em cada conta, com a variável herdada removida,
gravou `"effort":"high"` no `.jsonl` (a pessoal parou em 402 sem saldo, mas gravou `high` antes da chamada). Os
arquivos de teste foram apagados. A sessão já aberta mantém o esforço com que nasceu.
Falta conferir na vila (abrir uma sessão DeepSeek nova e ver o `/effort` em high).

## 2026-11-24 — Limpeza do ecossistema, Bloco 1: agentes da vila fora das contas, contas iguais por link e PROGRESS.md arquivado por mês

**O que mudou** (Bloco 1 da análise do ecossistema, EC-1; decisões do usuário de 24/11/2026):
1. **Agentes da vila só na vila.** `npm run hooks:install` (`server/src/install-hooks.ts`) copia para as contas só a
   bibliotecária (a única que as sessões usam); os outros rodam pela vila com `--agents` (`consulta.ts`) e as cópias
   antigas são apagadas na próxima instalação. Já apaguei as cópias nas 3 contas (só as com a marca do Dev Valley). O
   card "Agentes da vila instalados" do mapa do ecossistema passou a conferir isso (falta a bibliotecária ou sobra cópia).
2. **Contas iguais por link.** `CLAUDE.md`, `skills/` e `agents/` de `~/.claude-pessoal` e `~/.claude-deepseek` viraram
   links para os do `~/.claude` (o antigo ficou em `backups/antes-dos-links-*` de cada conta); a conta pessoal ganhou
   `/revisar`, `/roteiro-testes`, revisor, verificador e o roteador novo, e o mod dev-valley foi de 0.2.0 para 0.3.0.
   O registro dos mods em escopo projeto da DeepSeek trabalho (em `/home/vinicius`, cujo settings é o da conta Claude)
   saiu do `installed_plugins.json` dela, com backup. Fecha a PP-5 (`perfil-pessoal.md`, D16).
3. **PROGRESS.md arquivado por mês.** `scripts/arquivar-progress.ts` leva as entregas conferidas de meses fechados para
   `docs-dev/progresso/` (um arquivo por mês, `2026-10.md`); o que espera conferência, o sem data e o mês corrente ficam. O diário do atril lê o
   arquivo também (`readProgressComArquivo`); o sino só o `PROGRESS.md`. Primeira rodada: 71 entregas de outubro
   arquivadas, 2.184 → 1.072 linhas; o sino lista as mesmas 8 entregas de antes e o diário as mesmas 141.
**Achado (EC-2):** o mod `guardrails` carregado nas 3 contas é a cópia em cache de antes de 23/11.
**Testes:** `npm test` 360/360 (356 de antes + 4 do arquivo; o teste de arquitetura trocou `readProgress` por
`readProgressComArquivo` na lista do que o `app.ts` importa), `npm run typecheck -w server`, `npm run build`, auditor
sem achado novo (só as referências históricas).
Falta conferir na vila (reinício do usuário: o diário da casa mostra outubro depois de novembro; e numa sessão nova da
conta DeepSeek, `/revisar` aparece e os agentes da vila não aparecem como subagentes).

## 2026-11-24 — Casas da vila sempre em duas linhas

**O que mudou:** pedido do usuário: a vila às vezes punha todas as casas numa linha só e às vezes dividia em duas.
A causa era `chooseCols` (`web/src/game/layout.ts`) escolher o número de colunas pelo melhor preenchimento da tela,
que muda com o tamanho da janela no momento em que a cena monta. Agora a divisão não depende da tela: metade das casas
na linha de cima e metade embaixo (ímpar: a de cima fica com uma a mais; uma casa só continua numa linha). O zoom e a
floresta em volta continuam se ajustando à tela.
**Testes:** `npm test` 356/356 (o teste de "5 casas numa linha em tela larga" virou "sempre duas linhas, em tela larga
e estreita"), `npm run typecheck -w server`, `npm run build`, auditor sem achado novo (só as referências históricas).
Falta conferir na vila.

## 2026-11-24 — Mapa do ecossistema de IA: análise e apresentação geradas dos arquivos reais

**O que mudou:** pedido do usuário: uma visualização clara do que é dito à IA, do que ela guarda e do que ela
aprende, para apresentar e para analisar. Um gerador local (`scripts/mapa-ecossistema.ts`, com o domínio em
`mapa-ecossistema-dominio.ts` e a página em `mapa-ecossistema-pagina.ts`) varre as regras em `~/Documents/IA`, as
configs de `~/.claude` e `~/.claude-deepseek` e os rastros do repositório, e escreve **duas páginas** em
`docs-dev/ecossistema/` (pasta agora ignorada pelo git): a de **análise**, com caminho absoluto e nomes, e a de
**apresentação**, com caminho pessoal mascarado para `~`, projeto como "Casa N" e listas de memória/pendência
omitidas. A separação é a fronteira de privacidade; um botão que só esconde texto não bastaria. A página tem cinco
camadas (Entrada, Contexto, Ação, Rastro e Aprendizado) com 38 cards clicáveis, quatro fluxos, a tabela G1-G21 lida do
núcleo real e um bloco de saúde calculado. Sinais que ela já mostra: núcleo com 21 guardrails em 129 linhas (acima do
teto de ~20/120), mods instalados de commits diferentes nas duas contas, 2 agentes do cartão ainda não instalados
(7 de 9 nas duas) e os dois roteadores gerados divergindo na linha 30. Nada disso foi alterado por esta entrega: a
página só mostra. A memória automática aparece como a menor camada (10 arquivos), com a ressalva de que o núcleo é
regra versionada + rastro. Doc de decisão em `docs-dev/context/mapa-do-ecossistema.md`. A linguagem visual é
editorial e sóbria (fundo claro, tipografia de sistema, bordas finas, uma cor de acento): a identidade em
pergaminho/pixel da vila atrapalhava a leitura de uma página densa, correção apontada pelo usuário na mesma data.
**Testes:** `npm test` 356/356 (10 novos em `server/tests/mapa-ecossistema.test.ts`, com home e projeto de mentira),
`npm run typecheck -w server`, `npm run build`, auditor sem achado novo (as 5 referências históricas do PROGRESS
continuam) e `conferir-publico --tudo` limpo. As duas páginas saem sem URL externa e sem filete novo (G19).
Falta conferir na vila.

## 2026-11-24 — Memória entre sessões: auto-dream desligado, consolidador planejado e auditoria de regras

**O que mudou:** pesquisa sobre memória entre sessões (fontes da Anthropic, concorrentes e comunidade). O auto-dream
nativo do Claude Code (2.1.331, sem doc oficial: achado no executável, roda com 24 h e 5 sessões desde a última vez e
mexe só na pasta `memory/`) ficou `autoDreamEnabled: false` nas três contas, por decisão do usuário. O agente que
consolida propondo, sem aplicar, virou plano em `docs-dev/a-codar/consolidador-de-memoria.md` (MC-1). Auditoria de
regras rodada: 5 referências mortas, só em entradas antigas deste arquivo (histórico, ficam); núcleo dos guardrails em
133 linhas e 21 guardrails (acima do orçamento de 120/20). Cortes aplicados com o ok do usuário: `CLAUDE.md` daqui de
15 KB para 7,7 KB (lista de arquivos do `server/src`, status dos testes e "Estado atual" saíram; o detalhe das regras 5,
7, 8 e 10 foi para `.claude/rules/` com `paths:`, e o número e uma linha de cada ficaram); o auditor de referências
passou a ler `.claude/rules/*.md`. No `~/Documents/IA`: G14, G19 e G20 encurtados (o detalhe já estava nos arquivos
de cada um), "O que se cobra" do `como-trabalhamos.md` virou ponteiro, e o `sobre-mim.md` registra que a branch
`vinicius` não sincroniza mais com o `main` do Matheus.
**Testes:** `npm test` 346/346, auditor sem achado novo (só as 5 referências históricas), `conferir-publico --tudo`
limpo. Nada de código de produção mudou. Dispensa conferência na vila.

## 2026-11-23 — GR-1 fechada: os filetes antigos do style.css ficam como estão

**O que mudou:** decisão do usuário: os 7 filetes que já existiam no `web/src/style.css` (seis sublinhados de cabeçalho
em `--parchment-dark` e o `border-left` da citação em `--wood-light`) ficam como estão; o mod `guardrails` (G19) só
barra filete novo. Pendência GR-1 saiu do `PENDENCIAS.md`. Na mesma conversa, no `~/Documents/IA`: G5 virou trava ao
parar, `git push` passou a perguntar sempre, a opção pessoal `wslLimpo` do mod foi ligada, o "manter as 10 últimas"
do painel foi tirado e o núcleo dos guardrails foi enxugado (166 → 133 linhas).
**Testes:** nada de código mudou aqui. Dispensa conferência na vila.

## 2026-11-23 — Regras em prosa viram checagem: HOME isolado, fronteira do app.ts, repositório público e porão por propriedade

**O que mudou:** pedido do usuário, depois de analisarmos a palestra *All code is slop (except mine)* (Lauren Tan):
correção vira checagem que roda sempre, não mais uma linha de regra. Quatro regras daqui deixaram de depender de serem
lidas:
- **HOME isolado nos testes:** o `npm test` carrega `scripts/isolar-home.mjs` (`--import`), que troca o `HOME` por uma
  pasta temporária antes de qualquer teste. O erro das linhas de 29/10 e 08/11 do `RETRABALHO.md` (teste gravando no
  `~` de verdade) deixou de ser possível. `server/tests/isolamento.test.ts` falha se rodar sem o preload.
- **Fronteira das rotas:** `server/tests/arquitetura.test.ts` lê os imports do `server/src/app.ts`: `import type` passa,
  import de valor só da lista `PERMITIDOS` (o que existe hoje). Import novo falha com a mensagem dizendo como injetar
  pelo `Contexto`; a lista também falha se tiver item sobrando (só encolhe). Decisão do usuário: teste, não ESLint.
- **Repositório público (regra 1):** hooks do git `pre-commit` e `commit-msg` em `.githooks/` rodam
  `scripts/conferir-publico.mts` (Node puro): nome com cara de identificador das pastas de `projectRoots`/`extraProjects`
  (inclusive do config local) e caminho `/home/<usuário>` barram o commit. Palavra comum ("infra") fica de fora para não
  dar falso positivo. Ligado pelo script `prepare` (`git config core.hooksPath .githooks`, roda no `npm install`); o
  pombal mostra a recusa no painel (stderr do git). `--tudo` varre o repositório: limpo em 23/11/2026.
- **Porão por propriedade:** `server/tests/porao-propriedades.test.ts` (fast-check, dependência de desenvolvimento) sorteia
  a rodada (tarefas, dependências, terminal que não abre) e a ordem de clique, voltas automáticas, terminais subindo e
  devolutivas, e confere: uma sessão por tarefa, nenhuma abre antes das donas devolverem, registro do porão limpo e
  nada travado. Conferido que tem dente: sem a trava do `aprovar`, ele reencontra a corrida de 11/11 sozinho (3 tarefas
  livres). Todos os escritores do `rodada.json` passam pela trava: nenhum bug novo.
No `~/Documents/IA` (branch `vinicius`), na mesma entrega: triagem com a escada "checagem antes de prosa" e o mod
`guardrails` barrando filete colorido (G19), `cd X && escrita` (G18) e `painel.json` fora do formato (G14).
**Testes:** 346/346 (+9); typecheck do servidor e build ok; auditor só com os 5 achados informativos antigos do
`PROGRESS.md`. Dispensa conferência na vila: nada mudou na tela nem no servidor que roda.

## 2026-11-22 — Sino mostra o que espera conferência em todas as casas, inclusive pelo PENDENCIAS.md

**O que mudou:** pedido do usuário: o sino deve mostrar o que está pendente de verificação em qualquer repositório. Ele
já lia o `PROGRESS.md` de todas as casas, mas os outros repositórios não usam a frase "Falta conferir na vila": marcam o
que espera validação como pendência aberta, dona 👤, com "falta conferir na tela" e parecidos. Agora o sino lista também
essas pendências (`pendenciasAConferir` em `web/src/api.ts`: aberta, dona 👤 e "falta … conferir" na mesma frase), por
casa, sem caixinha: fechar pendência é da sessão ou do administrador (G6). Entram na conta e no balanço do sino.
Conferido contra os repositórios reais pela rota `/api/world`: aparecem as 3 do Dev Valley e as do ERP, nenhuma fora do
assunto. Painel em `web/src/ui/conferir.ts`; README atualizado.
**Testes:** 337/337 (+3 em `web/tests/sino.test.ts`); build ok. Falta conferir na vila (recarregar a página basta: só front).

## 2026-11-21 — "Marcar todas" da escrivaninha marca todas de uma vez

**O que mudou:** o usuário viu na vila que o "Marcar todas" da escrivaninha marcava uma sessão por clique (no sino
funcionava). Causa: o laço comparava cada caixa com o próprio "Marcar todas", que o `change` da primeira caixa
recalculava para desmarcado. Agora o valor é lido antes do laço (`web/src/ui/project.ts`). Linha no `RETRABALHO.md`.
**Testes:** build do front ok (só front). Falta conferir na vila (o front já buildado vale ao recarregar a página).

## 2026-11-21 — Jornal ignora worktrees

**O que mudou:** pedido do usuário. A banca noticiava duas vezes o mesmo trabalho: o repositório principal e a worktree
dele, que aparece na vila como outra casa e tem os mesmos commits. Agora worktree ligada fica de fora do jornal inteiro
(notícias, "sem novidade", parados, edição extra e conversa com o jornaleiro); só o repositório principal é noticiado.
**Como:** `isWorktree` em `server/src/git.ts` (`git rev-parse --git-dir` diferente de `--git-common-dir`; submódulo e
repositório principal não contam) e `projetosDoJornal()` em `server/src/jornal.ts`, usado por `montar` e
`pautaDaConversa`. A casa da worktree continua na vila; só o jornal deixa de olhar para ela.
**Testes:** caso novo em `server/tests/jornal.test.ts` (worktree de verdade criada com `git worktree add`). `npm test`
334/334, typecheck ok. Falta conferir na vila (reinício do usuário).

## 2026-11-21 — Quadro de avisos da praça vira as notas do usuário

**O que mudou:** pedido do usuário. O quadro de avisos da praça deixa de listar as pendências 👤 de todos os projetos
(elas continuam dentro de cada casa) e passa a guardar **notas soltas**: o clique abre o quadro de perto (cortiça com
os papéis presos, texto inteiro e data), com **Nova nota** no cabeçalho (Ctrl+Enter salva) e ✕ em cada nota, que
pergunta antes de excluir. Decisões do usuário (21/11/2026): notas sem projeto, só criar e excluir (sem editar), as
pendências 👤 só nas casas e o ✦ administrador cuida só do sino e não vê as notas (a reformulação dele ficou na AD-1).
**Como:** `server/src/notas.ts` (`Notas`: `notas.json` em `~/.claude/dev-valley/`, fora do repositório público;
arquivo estragado = quadro vazio); rotas `GET /api/notas`, `POST /api/notas` (texto limpo, até 2000 caracteres) e
`DELETE /api/notas/:id` (404 se não existe), gravar e apagar só com `Origin` local presente; front em
`web/src/ui/notas.ts` (painel e contagem do tooltip) e CSS `.quadro-cortica`/`.nota` (contorno inteiro, sem faixa nem
gradiente, cores do sprite `noticeboard`). Saíram `openUserPendencias` e o bloco "Quadro" do preâmbulo do
administrador; agente, saudação dele, README e `representacoes-visuais.md` acompanham.
**Testes:** `server/tests/notas.test.ts` (classe e rotas: sucesso, entrada inválida, origem de fora). `npm test`
333/333, typecheck e build ok, auditor sem achado novo. Falta conferir na vila (reinício do usuário).

## 2026-11-21 — Sino com "Marcar todas" e frase padrão de validação em todos os projetos

**O que mudou:** pedido do usuário. O sino ganha o "Marcar todas" da escrivaninha (mesma barra `.lote-barra`, com a
contagem de marcadas), em `web/src/ui/conferir.ts`. O sino já lia o `PROGRESS.md` de todas as casas, mas só a frase
"Falta conferir na vila", que os outros repositórios não usavam (cada um escrevia "a validar", "falta testar"…).
Decisão do usuário (21/11/2026): a frase vira regra universal, sem o sino aceitar variações; o G5 do `~/Documents/IA`
(branch `vinicius`) e o template do `PROGRESS.md` passam a exigi-la em toda entrega que espera validação. Vale daqui
para frente: entregas antigas dos outros projetos não aparecem. As contas DeepSeek também ganharam
`cleanupPeriodDays: 90` (fecha a parte da QT-1).
**Testes:** build do front ok (só front). Falta conferir na vila (reinício do usuário).

## 2026-11-21 — Quarto da casa: sessões dormindo, e dormir ou encerrar várias pela escrivaninha

**O que mudou:** pedido do usuário. Cada casa ganha um **quarto** (porta na parede direita da sala): quem dorme lá teve
o processo `claude` encerrado (memória e CPU voltam a zero) e a conversa guardada; some da sala, da escrivaninha e do
mapa. Clicar na cama abre o chat, a sessão acorda (`claude --resume`) e volta à sala. Na **escrivaninha**, cada morador
tem uma caixa de marcar (com "Marcar todas"): as marcadas vão juntas para o quarto (**💤 Dormir**) ou são apagadas de
vez (**Encerrar**, o mesmo apagar do chat), sem abrir uma por uma. Decisões do usuário (21/11/2026): Encerrar = apagar
de vez; abrir quem dorme acorda e volta à sala; o quarto não tem prazo (`sessionMaxAgeDays` não vale para quem dorme) e
`cleanupPeriodDays: 90` no `~/.claude/settings.json` (o Claude Code apagava conversas com mais de 30 dias); sessão
trabalhando ou pedindo permissão também pode dormir ou ser encerrada, mas a confirmação avisa.
**Como:** `server/src/quarto.ts` (`Quarto`: `dormindo.json` em `~/.claude/dev-valley/`, esquece quem não existe mais);
`listSessions` aceita `sempre` (quem dorme entra fora do prazo); `buildWorld` marca `dormindo` (nunca com processo
rodando); rota `POST /api/sessions/dormir` (várias de uma vez; encerra o processo antes de anotar; recusa porão, praça
e sessão aberta em outro terminal com o motivo; só com `Origin` local presente, como o cartão do porão); o terminal da
vila acorda a sessão ao abrir (`index.ts`). Front: `naSala`/`noQuarto` em `api.ts`, escrivaninha em
`web/src/ui/project.ts`, `web/src/game/QuartoScene.ts` (camas, cabeça no travesseiro de olhos fechados, colcha, "z"),
peças em `interiorTextures.ts` (`generateQuartoTextures`) e a porta em `InteriorScene.ts`. CSS sem faixa na borda (G19).
**Testes:** 329/329 (+5: `server/tests/quarto.test.ts` e a rota em `rotas.test.ts`); typecheck do servidor e build ok;
auditor só com as 5 referências antigas do PROGRESS (`torre.ts`, `estante.ts`), de antes. Falta o reinício da vila
(regra 6) e conferir na vila.

## 2026-11-21 — Segunda opinião no cartão do porão (crítico DeepSeek, verificador Haiku)

**O que mudou:** decisão do usuário (CC-1): antes do clique no cartão, um crítico de outra família confere as tarefas
por um checklist fechado (C1 a C7 por tarefa, R1 da rodada) e cada apontamento é conferido por um verificador. No cartão
só aparece o confirmado, como aviso; o clique nunca espera por ele. Regras contra bajulação e contra crítica inventada
aprovadas pelo usuário: checklist fechado, sem saber quem escreveu, sem elogio nem nota, só reprova com trecho citado,
na dúvida passa, teto de 5. Verificador no Haiku (conta Claude) e só aviso, sem NPC.
**Como:** `server/src/critico.ts` (`criticaDoPorao`, `criticar`, `perguntarDeVerdade`), agentes
`server/agents/critico-do-cartao.md` (conta de `agentes.conta`, entra em `AGENTES_NA_CONTA`) e
`server/agents/verificador-do-cartao.md` (Haiku), os dois só leitura em modo estrito. A rota `POST /api/porao/pedidos`
inicia a crítica em segundo plano (`ctx.criticaDoCartao`); `GET /api/porao/pedidos/:id` devolve `critica`; aprovar e
recusar anotam a decisão em `critica-<pedido>.json` na pasta da rodada (medição para decidir se fica). Cartão em
`web/src/ui/porao.ts`, com a caixa de aviso que já existia (`.pombal-avisos`), sem CSS novo. Plano movido para
`docs-dev/context/critica-do-cartao.md`; regra 5 do CLAUDE.md e README atualizados.
**Ensaio real** (cartão de mentira em pasta temporária, dois erros plantados): o crítico na conta DeepSeek trabalho
achou os dois (duas tarefas no mesmo arquivo sem `dependeDe`; arquivo dito existente que não existe) e mais dois reais
(a spec citada não existia na pasta); nenhum inventado; o Haiku confirmou os quatro; 84 s.
**Testes:** 324/324 (+12 em `server/tests/critico.test.ts`); typecheck do servidor e build ok. Falta o reinício da vila
(regra 6) e conferir numa rodada de verdade.

## 2026-11-21 — Arquivo .md/.html citado no chat abre no leitor da vila

**O que mudou:** pedido do usuário. Clicar num link `/api/arquivo?path=...` que termina em `.md` ou `.html` no terminal
da sessão abre um painel de leitura da vila (`web/src/ui/leitorArquivo.ts`) em vez de uma aba do navegador: markdown
renderizado com o mesmo `renderMarkdown` da biblioteca (agora exportado de `library.ts`, sanitizado), HTML num iframe
`sandbox` como o quadro negro, e o botão "Abrir em aba nova" para o jeito antigo. Vale para link puro (WebLinksAddon) e
para link OSC 8 (`linkHandler` do xterm). Qualquer outro link segue para o navegador. Nenhuma rota nova: a trava continua
sendo a `/api/arquivo` (só arquivo de dentro de um projeto da vila). Gate: `npm test` 312/312, `npm run build` ok;
falta conferir na vila depois do reinício.

## 2026-11-21 — Lastro na spec nas rodadas do maestro

**O que mudou:** pedido do usuário (todo código do ERP tem lastro na spec). A devolutiva das sessões do porão
ganha três campos obrigatórios: `lastro` (regras da spec cumpridas e as de fase futura, com a spec de origem),
`fora_da_spec` (o que fez sem estar na spec, ou "nada") e `revisao` (resultado do `/revisar`). O relatório da rodada
ganha a seção "Lastro na spec", com aviso em destaque para "fora da spec" e para lastro não informado; o hook de parar
lembra uma vez a sessão cuja devolutiva vier sem os campos.
**Como:** `lastroDe` e `secaoDoLastro` em `server/src/rodada.ts` (rodada antiga, sem os campos, sai sem a seção);
modo `parar` de `scripts/porao-hook.sh`; testes em `server/tests/rodada.test.ts`. Fora deste repositório
(`~/Documents/IA`, branch `vinicius`): formato da devolutiva em `~/Documents/IA/guardrails-ia/convivencia.md`; briefing do maestro com
as linhas "Spec" e "Revisão" (quando o projeto tem rubrica); `/revisar` com o "Pedido" copiado do briefing sob o
maestro, e a lente spec abrindo a seção citada para achar regra esquecida no Pedido. A conferência dos briefings antes
do clique segue com o plano da crítica do cartão (CC-1).

## 2026-11-21 — Claude + DeepSeek no fluxo: revisor de outra família e dois planos

**O que mudou:** pesquisa sobre combinar as famílias Claude e DeepSeek (revisão cruzada arXiv 2610.01471, Anthropic
multi-agent, Cognition, MAST, skill `council` do T3 Code; DeepSeek Pro × Flash: o Pro fica sem papel, mas segue
disponível pelo apelido `opus` das contas DeepSeek). Decisões do usuário: (b) a `/revisar` ganha as lentes spec e
conjunto também no DeepSeek Flash, somando às do Claude, feito fora deste repositório (`~/Documents/IA`, branch
`vinicius`, commit `ff10607`, script `~/Documents/IA/claude/skills/revisar/revisor-deepseek.sh`); (c) crítica do cartão pelo Flash
só com regras anti-bajulação aprovadas antes; (d) conta por tarefa no porão depois das métricas de (b).
**Como:** nenhum código da vila mudou. Planos em `docs-dev/context/critica-do-cartao.md` (codado depois, no mesmo dia) e
`docs-dev/a-codar/conta-por-tarefa-no-porao.md`; pendências CC-1 e CC-2.
**Ensaio de (b):** lente spec numa cópia de uma revisão antiga: o Flash levantou um achado importante que a lente do
Claude não tinha, ainda não verificado; 11 min com esforço `max`.

## 2026-11-20 — Maestro sempre no Claude, mesmo na casa pessoal

**O que mudou:** pedido do usuário: o maestro abre na conta **Claude** em qualquer casa, inclusive nas pessoais (que
abrem no DeepSeek pessoal). As sessões de tarefa e do roteiro continuam na conta padrão da casa (no Sonnet; no DeepSeek,
o Flash).
**Como:** a rota `POST /api/porao/maestro` (`server/src/app.ts`) grava `CONTA_CLAUDE` em `escolhasDeConta`, a mesma
tabela da tela de sessão nova; o terminal abre sem `CLAUDE_CONFIG_DIR` e a conversa fica em `~/.claude`, que manda ao
retomar. O maestro passa por cima da regra "a casa oferece só as contas da mesma finalidade", de propósito.
**Testes:** 311/311 (o teste da rota do maestro em `porao.test.ts` confere a conta); typecheck do servidor ok.

## 2026-11-20 — Sessões geradas pelo maestro vão no Sonnet

**O que mudou:** pedido do usuário, para gastar menos token sem perder muito no resultado: as sessões que nascem de um
pedido do maestro (as tarefas da rodada e a sessão do roteiro de testes) abrem no **Sonnet**. O maestro continua abrindo
no modelo padrão do usuário (hoje `opus` no `settings.json` global) e pode ser trocado na hora com `/model`.
**Como:** `MODELO_DAS_SESSOES = 'sonnet'` em `server/src/rodada.ts`, posto no JSON de `settingsDaTarefa` (o `--settings`
da tarefa, que já vale também ao retomar, MA-3) e no `--settings` da sessão do roteiro (`porao.ts`, só o modelo, sem os
hooks da rodada). O `--settings` vence o `model` do `settings.json` global. Nas contas DeepSeek o apelido `sonnet` vira o
`ANTHROPIC_DEFAULT_SONNET_MODEL` delas (DeepSeek Flash, que já era o padrão lá): nada quebra.
**Limite:** a sessão do roteiro, retomada depois, volta ao modelo padrão (ela nasce na casa como sessão comum, sem as
regras guardadas no porão).
**Testes:** 311/311 (+1 em `rodada.test.ts`; o teste do roteiro em `porao.test.ts` confere o `--settings` só com o modelo);
typecheck do servidor ok.

## 2026-11-19 — Agentes de leitura respondem na conta DeepSeek trabalho

**O que mudou:** pedido do usuário: quando o Claude chega ao limite, ele continua o trabalho no DeepSeek, mas perdia
todos os agentes da vila porque as consultas usavam a licença do Claude. Agora as consultas dos agentes que **só leem**
(bibliotecária, jornaleiro, jornaleiro da conversa, escrevente, médica e maestro mirim) rodam com o
`CLAUDE_CONFIG_DIR` da conta escolhida em `agentes.conta` do config local, com a mesma trava de chave do terminal: sem
base URL/chave, o painel mostra o erro e a consulta **não** cai na licença do trabalho. O **administrador**, único que
edita arquivos, continua no Claude; o **maestro** (sessão do porão) fica como está. A **Fábrica de agentes** passou a
mostrar a conta fixa de cada agente da vila: pílula com o ponto do provedor na lista (`DeepSeek` ou `Claude`) e o nome
da conta no cabeçalho do detalhe.
**Decisões (usuário, 19/11/2026):** a conta dos agentes é a **DeepSeek trabalho** (`~/.claude-deepseek`), a mesma que
assume quando o Claude está no limite; a DeepSeek pessoal continua só dos projetos pessoais. O critério é "agente que
não escreve" (o administrador fica de fora). A troca é fixa, não um fallback: enquanto a conta estiver configurada, os
agentes não dependem do limite do Claude.
**Como:** `AgentQuery.conta` em `server/src/consulta.ts`; `ambienteDaConsulta` põe o `CLAUDE_CONFIG_DIR` (e tira o
herdado na conta do Claude); a trava síncrona `problemaDaContaSync` em `perfil.ts` é a mesma regra da conta do
terminal. `index.ts` resolve a conta do config e a repassa aos seis serviços; `config.ts` ganhou `agentes.conta`. A
lista de quem usa a conta é `AGENTES_NA_CONTA`; `agents.ts` carimba `conta` nos agentes da vila (o administrador no
Claude) e a Fábrica desenha a pílula (`.conta-pill`, a mesma da sessão).
**Arquivos:** `server/src/{consulta,agents,config,perfil,index,librarian,mirim,clinica,escrevente,jornal}.ts`;
`web/src/api.ts`, `web/src/ui/factory.ts`; `server/tests/{consulta,jornal,rotas-fabrica-biblioteca}.test.ts`;
`dev-valley.config.local.json`; `CLAUDE.md`, `README.md`, `docs-dev/context/perfil-pessoal.md` e `PENDENCIAS.md`.
**Testes:** antes 305/305; depois 310/310 (5 novos: ambiente da conta, remoção do `CLAUDE_CONFIG_DIR` herdado, trava
sem base URL/chave, erro sem chamar o `claude` e a conta fixa dos agentes da vila na Fábrica), `npm run typecheck -w server`
e `npm run build` sem erro. O config real resolve `DeepSeek trabalho` e a trava aprova o `~/.claude-deepseek`; o auditor
`--sem-home` (o do CI) sem achado (o `--tudo` segue com 5 referências históricas no `PROGRESS.md`, já existentes). Falta
reiniciar a vila, pedir uma pergunta a cada agente e abrir a Fábrica para ver as etiquetas (regra 6).

## 2026-11-19 — Contas com nome: um botão de nova sessão e a tela «Com qual modelo?»

**O que mudou:** pedido do usuário: a vila tratava «pessoal» como sinônimo de DeepSeek e os botões «Nova sessão» /
«Nova sessão com DeepSeek» não acomodavam a segunda assinatura. O modelo virou **conta**: nome + provedor
(Claude/DeepSeek) + pasta de configuração + finalidade (pessoal/trabalho) + raízes opcionais. O config local ganhou
`contas` (o Claude de `~/.claude` é sempre a primeira); o formato antigo (`perfilPessoal`/`perfisExtras`) ainda é aceito
e convertido. A casa tem uma **conta padrão** (pela raiz) e oferece só as contas da **mesma finalidade**: casa pessoal
= DeepSeek pessoal; casa de trabalho = Claude + DeepSeek trabalho. O painel da casa ganhou **um** botão «Nova sessão»,
que abre a tela «Com qual modelo?» (Claude, DeepSeek pessoal, DeepSeek trabalho); a escolha vale só para a sessão. O
morador mostra a conta quando ela difere da padrão da casa; o topo do terminal mostra a conta sempre; a casa mostra
«Abre em». O **moinho** e o **Quadro de força da Fábrica** passaram a separar por conta; a **biblioteca** rotula as
memórias com o nome da conta. A chave da assinatura nova (`~/.claude-deepseek`) foi conferida preenchida: a trava do
conta aprova o terminal (PP-3 resolvida).
**Decisões (usuário, 19/11/2026):** D10 nomes das contas: «DeepSeek pessoal» e «DeepSeek trabalho»; D11 a tela escolhe
**só a conta** (o modelo fino, Sonnet/Opus e Flash/Pro, continua no `/model`); D12 casas separadas por finalidade (a conta
pessoal não aparece no trabalho; Claude não aparece na casa pessoal); D13 entram criação + rótulos + moinho/Fábrica (a
biblioteca só recebeu os rótulos por conta).
**Rotas:** `POST /api/sessions` passa a aceitar `{ conta }` (nome) no lugar de `{ perfil }` (configDir); valida a conta
contra as contas da casa e responde 400 com a lista quando não é oferecida; sessão avulsa aceita qualquer conta.
**Arquivos:** `server/src/{config,perfil,world,index,app,bastao,install-hooks,gasto,plugins,library}.ts`;
`web/src/api.ts`, `web/src/game/{villagerArt,villager,common,TownScene}.ts`,
`web/src/ui/{novaSessao,project,actions,terminal,gasto,plugins}.ts`, `web/src/style.css`;
testes `server/tests/{perfil,bastao,rotas,servidor,clinica,gasto,plugins,biblioteca-perfil}.test.ts` e
`web/tests/villager-art.test.ts`; `scripts/previa-moradores.ts`; docs (`CLAUDE.md`, `README.md`, `PENDENCIAS.md`,
`RETRABALHO.md`, `docs-dev/context/perfil-pessoal.md`, `fabrica-plugins-e-mcp.md`, `moinho-gasto-por-projeto.md`,
`torre-do-relogio.md`).
**Testes:** antes 305/305; depois 305/305, `npm run typecheck -w server` e `npm run build` sem erro; o config real foi
conferido por script (casa de trabalho oferece Claude + DeepSeek trabalho; casa pessoal só DeepSeek pessoal; os dois
terminais DeepSeek abrem com `CLAUDE_CONFIG_DIR` e o Claude abre sem). Falta reiniciar a vila e conferir na tela
(regra 6).

## 2026-11-19 — Sessão nova com a segunda assinatura do DeepSeek em qualquer casa

> **Superado no mesmo dia pela entrega acima:** os dois botões e o «perfil extra» viraram contas com nome e a tela de
> escolha. O registro fica como histórico da decisão que foi substituída.


**O que mudou:** pedido do usuário: abrir o DeepSeek em qualquer repositório da vila (a segunda assinatura, além da que
já usa nos repositórios pessoais). O painel da casa ganhou **"Nova sessão com DeepSeek"** nas casas que abrem no Claude;
a casa pessoal continua abrindo no perfil pessoal, como estava (decisões do usuário: escolha **por sessão**, nada
guardado por casa). Ao retomar, o perfil vem da **pasta da conversa** (`.jsonl`), não da pasta do projeto: um `--resume`
no perfil errado não acharia a conversa e abriria no Claude. O sucessor do bastão herda o perfil exato; a trava de chave
vale igual (mensagem com o nome do perfil, nunca o valor, G13). No mundo, o extra é da família pessoal: o morador veste
tons frios. Fora do repositório: perfil novo `~/.claude-deepseek` criado com o settings do DeepSeek e a chave em branco;
regras da CNR (`instalar.sh` com `CLAUDE_CONFIG_DIR`) e mod, hooks e agentes da vila (`npm run hooks:install`) instalados
nele; `dev-valley.config.local.json` ganhou `perfisExtras`.
**Rotas:** `POST /api/sessions` aceita `{ perfil }` (o `configDir` de um extra): casa pessoal ou perfil não configurado
responde 400. `PUT`/`DELETE` e as demais rotas não mudaram.
**Arquivos:** `server/src/{config,perfil,world,index,app,bastao,install-hooks,gasto,plugins}.ts`,
`web/src/api.ts`, `web/src/ui/project.ts`, testes `server/tests/{perfil,bastao,rotas,servidor,clinica,gasto}.test.ts`,
`docs-dev/context/perfil-pessoal.md`, `CLAUDE.md`.
**Testes:** antes 298/298; depois 305/305, typecheck do servidor e build do front sem erro. Falta o usuário colar a chave
da segunda assinatura no perfil novo e reiniciar a vila para o botão aparecer; Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-16 — Renomear a sessão pela vila

**O que mudou:** botão "✎ Renomear" no rodapé do terminal da sessão (não aparece em conversa com agente nem no maestro
só para ver). Troca **só o título** (o que aparece na lista da casa, no balão e no topo do terminal); o nome do morador,
o `@Nome` e a aparência não mudam. O título fica **só na vila**, em `~/.claude/dev-valley/titulos.json`; o arquivo da
conversa do Claude Code nunca é tocado (decisões do usuário, 16/11/2026). Vazio volta ao título automático; até 80
caracteres, espaços repetidos e quebras de linha viram um espaço; Enter salva, Esc cancela. O título renomeado também
vai no `moradores.json` (o `@Nome` traz o título novo). Sessão que sai da vila leva o título junto.
**Rota:** `PUT /api/sessions/:id/titulo` (`{ titulo }`), recusa outra origem (403), sessão fora do mundo (404) e título
que não é texto ou passa de 80 (400).
**Arquivos:** `server/src/moradores.ts` (`renomear`, `titulos.json`, aplicado no `sync`), `server/src/app.ts`,
`web/src/api.ts`, `web/src/ui/terminal.ts`, `web/src/style.css`, testes `server/tests/{rotas,servidor}.test.ts`,
`CLAUDE.md` (contagem de rotas e testes).
**Testes:** antes 296/296; depois 298/298, typecheck do servidor e build do front sem erro, auditor igual (5 achados
informativos antigos no PROGRESS). Conferido na vila pelo usuário em 20/11/2026 depois do reinício (regra 6).

## 2026-11-11 — Maestro v3: gate com linha de base, aceite e medição

**O que mudou:** o plano `docs-dev/context/maestro-v3.md` (decisões V1 a V5 do usuário), Etapas 0 e 1. (1) Agente:
3 sessões por padrão, 4 ou 5 só com tarefas independentes de verdade e dizendo por quê; a rota e o cartão continuam
aceitando até 5. (2) Agente: "vale paralelizar?" virou checklist de cinco itens (tarefa de ~30 min, comando de
verificação, aceite escrito sem inventar, fila abaixo de ~70%); o bloco de resposta traz a estimativa por tarefa e em
sessão única. (3) Briefing com "Pronto quando", "Leia primeiro"/"Não precisa ler", "Pode usar, não pode alterar" e o
arquivo hub como tarefa 0; a devolutiva ganha `aceite` (sim/não e como conferiu), lido pela vila e numa coluna do
relatório; devolutiva antiga continua sendo lida. (4) Gate rodado pela vila (`server/src/gate.ts`): os `testes` do
cartão, sem shell, um por vez, com limite de 15 min; **antes** de abrir as sessões (linha de base; o quadro diz
"conferindo a linha de base" e as tarefas abrem quando ela termina, mesmo vermelha) e com todas prontas, antes do
relatório. Cada comando sai como passou, já estava vermelho, quebrou ou consertou; algum "quebrou" = **reprovada** no
topo do relatório, com o caminho da saída, e ❗ na estante; nenhuma sessão é reaberta. Saída só em `<rodada>/gate/`, o
`rodada.json` guarda comando, código e duração. Fora da trava, idempotente entre voltas, retomado se a vila cair; o
gongo no meio descarta o resultado. Rodada sem `testes`: "sem verificação automática". (5) O pedido aceita
`estimativaSessaoUnicaMin`; a tarefa pronta guarda os tokens da conversa (`tokensDaConversa`, mesma regra do moinho, só
números); o relatório ganha "Custo e ganho" (tempo de parede, linha de base e gate, soma das tarefas, estimativa e
diferença, tokens por tarefa e total), com a frase fixa de que a estimativa não é medição.
**Arquivos:** `server/src/gate.ts` (novo), `server/src/{rodada,porao,gasto,app}.ts`, `server/agents/maestro-mirim.md`,
`web/src/api.ts`, `web/src/ui/porao.ts`, `web/src/game/PoraoScene.ts`, testes `server/tests/gate.test.ts` (novo) e
`server/tests/{rodada,porao}.test.ts` (o clique com comando de teste não abre mais na hora); `CLAUDE.md` (regra 10,
módulos, contagem), `README.md`, `docs-dev/context/maestro-v3.md` (era `a-codar/`), `docs-dev/painel.json`,
`PENDENCIAS.md` (MA-6 sai, MA-7 entra, MA-5 inclui o v3). Fora do repositório: `~/Documents/IA/claude/agents/maestro.md`
e `~/Documents/IA/guardrails-ia/convivencia.md`.
**Testes:** antes 279/279; depois 296/296, typecheck do servidor e do front e build sem erro, auditor igual. Ensaio
isolado com 1 sessão real (c8): linha de base antes de abrir, gate final quebrou, relatório "Reprovada", nenhuma sessão
reaberta. Tokens conferidos à parte na conversa do ensaio (o script não repassa o `.jsonl`). Falta a rodada real depois
do reinício (MA-5).

## 2026-11-11 — Maestro v2: corrida do clique, edição pelo Bash e ensaios c1 a c6

**O que mudou:** (1) A 1ª rodada real abriu mais de 5 sessões para 5 tarefas, com trabalho duplicado: o clique
(`Porao.aprovar`) e a volta automática (`Porao.avancar`) liam e gravavam o `rodada.json` ao mesmo tempo. Agora os dois
passam por uma trava única (`comTrava`), a tarefa é reservada no estado `abrindo` antes de o terminal subir, o `abrindo`
que sobra de uma vila que caiu é recuperado sem abrir por cima, e o pedido que repete tarefa da rodada é recusado (409).
(2) Nos ensaios, as sessões editavam pelo Bash (`sed -i`, `printf >>`) por fora do hook de posse, e o modo `auto` não
pede permissão: o hook ganhou o modo `bash` (recusa escrita em arquivo e o git que mexe no repositório) e a posse vale
também para o arquivo que ninguém listou (reserva atômica em `<rodada>/posse/`, a primeira que edita fica dona até
ficar pronta). Contrato e briefing do agente dizem "edite só com Edit/Write". (3) Ensaios reais isolados da vila
(script fora de `~/.claude/maestro/rodadas`): c1 independentes, c2 dependência, c3 posse + tela (cartão do roteiro),
c4 morte + retomada (na 2ª tentativa), c6 "não vale": todos certos; c5 (agente de ponta a ponta) fez o pedido certo e
parou no limite de uso. Nenhuma tarefa abriu duas vezes. Limite visto no c3: o teste de uma tarefa reprova pelo trabalho
inacabado da outra na mesma pasta (vai para o gate no fim da rodada, maestro v3).
**Arquivos:** `server/src/{rodada,porao}.ts`, `scripts/porao-hook.sh`, `server/tests/rodada.test.ts`, `RETRABALHO.md`;
fora do repositório, `~/Documents/IA/claude/agents/maestro.md` e `~/Documents/IA/guardrails-ia/convivencia.md`.
**Testes:** suíte completa depois da última mudança no hook (Etapa 0 do v3): 279/279, typecheck do servidor e build sem
erro, auditor limpo.

## 2026-11-11 — Pesquisa de fundamentos para o maestro v3 (sem código)

**O que mudou:** pesquisa profunda (documentação oficial do Claude Code, papers de 2025–2026, METR, DORA e
praticantes) sobre quando sessões paralelas pagam, quanto custam e como arquitetá-las. O documento separa
evidência, interpretação e proposta, e termina em 12 regras para o maestro v3: leitura paralela e escrita
serial, um dono por arquivo/decisão, tarefa mínima de 45–60 min, contrato antes do spawn, DAG com caminho
crítico, padrão 3 e teto 5, verificação como gargalo, revisor de contexto limpo por risco, estado em arquivo,
contexto cirúrgico, orçamento/critério de morte e medição contra a sessão única. Nada foi decidido nem codado.
**Arquivos:** `docs-dev/context/sessoes-paralelas-fundamentos.md` (novo), `PENDENCIAS.md` (MA-6).
**Testes:** não se aplica (só documento).

## 2026-11-11 — Maestro v2: a vila conduz a rodada

**O que mudou:** com as cinco recomendações aceitas pelo usuário (D1 a D5), o plano virou código. (1) Cada sessão de
trabalho termina gravando a **devolutiva** em `~/.claude/maestro/rodadas/<id>/devolutivas/<tN>.md`; um hook `Stop`
lembra quem tenta parar sem ela (uma vez só, para ela poder parar e perguntar). (2) A vila grava o `rodada.json` no
clique do cartão e, a cada volta do mundo, marca a tarefa pronta (devolutiva + sessão parada), abre sozinha a que
dependia dela e, com todas prontas, monta o relatório em `docs-dev/maestro/` sem modelo nenhum, pedindo o cartão do
roteiro quando alguma devolutiva diz `mexeu_em_tela: sim`. (3) Um hook `PreToolUse` recusa editar arquivo de outra
tarefa que ainda trabalha (`PROGRESS.md`/`PENDENCIAS.md` somam). Os hooks chegam só às sessões de trabalho, por
`--settings` no spawn. (4) O pedido aceita `dependeDe` (recusa ciclo e tarefa desconhecida; o teto conta as que
esperam) e o cartão mostra a ordem. (5) Quadro da rodada na estante (Esperando, Trabalhando, Precisa de você, Pronta),
com ❗ quando uma tarefa parou sem terminar. (6) MA-3 fechada: sessão de trabalho retomada volta com as regras e os
hooks. Agente do maestro reescrito (diz quando não vale paralelizar, um pedido só e sai) e contrato "Sob o maestro" com
o formato da devolutiva, em `~/Documents/IA` (sem commit lá: o repositório já tinha alterações antigas não commitadas
nos mesmos arquivos). Mirim lê o `rodada.json` e as devolutivas.
**Arquivos:** `server/src/{rodada,porao,app,index,terminals,world,mirim}.ts`, `server/agents/maestro-mirim.md`,
`scripts/porao-hook.sh` (novo), `web/src/{api.ts,style.css}`, `web/src/ui/{porao,actions}.ts`,
`web/src/game/{PoraoScene,TownScene}.ts`, testes `server/tests/rodada.test.ts` (novo), `web/tests/quadro-porao.test.ts`
(novo), `server/tests/{porao,mirim,clinica}.test.ts`, `server/tests/servidor.ts`; `CLAUDE.md` (regra 10),
`README.md`, `docs-dev/context/maestro-v2.md` (era `a-codar/`), `docs-dev/context/maestro.md`, `docs-dev/painel.json`,
`PENDENCIAS.md` (MA-3 sai, MA-5 vira conferência). Fora do repositório: `~/Documents/IA/claude/agents/maestro.md`,
`~/Documents/IA/guardrails-ia/convivencia.md`, `~/Documents/IA/guardrails-ia/guardrails-core.md` (G21) e
`~/Documents/IA/claude/skills/roteiro-testes/SKILL.md`.
**Testes:** antes 259/259; depois 274/274, typecheck do servidor e do front e build sem erro. Conferido na vila pelo usuário em 20/11/2026
depois do reinício (regra 6), numa rodada de verdade.

## 2026-11-11 — Plano do maestro v2 (sem código)

**O que mudou:** pesquisa de como a Anthropic (agent teams, sistema de pesquisa multi-agente) e a comunidade conduzem
sessões paralelas, e plano em 4 fases com os itens 1 a 5 escolhidos pelo usuário: devolutiva em arquivo cobrada por
hook `Stop`, estado da rodada pela vila, posse de arquivo por hook `PreToolUse`, dependências declaradas, quadro de
status e o maestro dizendo quando não vale paralelizar. Decisões D1 a D5 em aberto.
**Arquivos:** plano em `a-codar/` (hoje `docs-dev/context/maestro-v2.md`), `PENDENCIAS.md` (MA-5).
**Testes:** não se aplica (só documento).

## 2026-11-10 — Clínica sem o monitor de sinais vitais

**O que mudou:** a pedido do usuário, saiu o monitor de sinais vitais da clínica (ficou inútil com limites e máquina no
canto da tela): a peça, a textura `monitorVital`, o painel `openSinaisVitais` e as barras dele. A maca ficou espelhada com
a mesa da médica em relação ao corredor. Textos que apontavam para o monitor (fachada, moinho, README) agora apontam para
o canto da tela. `/api/clinica` segue devolvendo `vitais` para a ficha da médica.
**Arquivos:** `web/src/game/{ClinicaScene,interiorTextures,limites,layout,TownScene}.ts`,
`web/src/ui/{clinica,actions,gasto,limitesHud,limites-texto}.ts`, `web/tests/limites-hud.test.ts`, `server/src/app.ts`
(comentário); `README.md`, `docs-dev/context/clinica.md`.
**Testes:** antes 259/259; depois 259/259, typecheck do servidor e do front e build sem erro; auditor só com o histórico.
Conferido na vila pelo usuário em 20/11/2026 depois do reinício (regra 6).

## 2026-11-09 — Clínica reorganizada e limites de volta ao canto da tela

**O que mudou:** a pedido do usuário, duas coisas. (1) A planta da clínica: tudo estava espremido na metade de cima e o
rótulo do monitor quase encostava no da maca. Agora a triagem fica à esquerda (monitor na cabeceira da maca), o
consultório à direita (mesa da médica, que ganhou rótulo, e o armário na parede atrás dela) e o corredor do meio fica livre
da porta ao fundo, com os rótulos dos dois lados na mesma linha. (2) Os limites do Claude (5h e semana) voltam ao canto
inferior esquerdo, no desenho antigo do painel de uso, minimizável em chips, e com a máquina (WSL: memória, swap,
processador, disco) embaixo. Rota nova `GET /api/clinica/vitais`, leve (sem a amostra de processos da triagem), lida a cada
30 s. O monitor da clínica e a cruz da fachada continuam iguais.
**Arquivos:** `server/src/{clinica,app}.ts`, `server/tests/{clinica.test.ts,servidor.ts}`; `web/src/{api,main}.ts`,
`web/src/style.css`, `web/src/ui/{limitesHud,limites-texto}.ts`, `web/src/game/ClinicaScene.ts`,
`web/tests/limites-hud.test.ts`; `README.md`, `CLAUDE.md`, `docs-dev/context/clinica.md`.
**Testes:** antes 256/256; depois 259/259, typecheck do servidor e do front e build sem erro; auditor só com o histórico.
Conferido na vila pelo usuário em 20/11/2026 depois do reinício (regra 6): a planta não foi renderizada aqui.

## 2026-11-09 — Clínica, etapa 2 (CL-1): armário dos pacientes esquecidos

**O que mudou:** o usuário não pôde reiniciar a vila e pediu o próximo passo. O armário da clínica lista o que roda fora
da vila e pode ter sido esquecido: processos `claude` fora da árvore do servidor (com "provavelmente Fulano" quando um
morador vivo fora da vila está na mesma pasta), servidores escutando porta fora da lareira (porta `LISTEN` de
`/proc/net/tcp*` achada pelo inode nos `fd` de cada processo; o `.vscode-server` fica de fora, porque o próprio VS Code
escuta portas: os dois primeiros achados reais nesta máquina eram ele) e containers Docker de pé (`docker ps`, prazo
de 4 s, aviso quando o Docker não existe ou não responde). Cada item traz idade, memória, pasta e a linha para o usuário
encerrar; a vila não encerra nada (decisão 5 do plano). Rota nova `GET /api/clinica/armario`. O `Processo` ganhou a
memória (`statm`). Plano inteiro implementado: saiu de `a-codar/` para `docs-dev/context/clinica.md` e a
CL-1 saiu do `PENDENCIAS.md`.
**Arquivos:** `server/src/{clinica,app}.ts`, `server/tests/{clinica.test.ts,servidor.ts}`; `web/src/{api.ts,style.css}`,
`web/src/ui/{clinica,actions}.ts`, `web/src/game/{ClinicaScene,interiorTextures}.ts`; `README.md`, `CLAUDE.md`,
`PENDENCIAS.md`, `docs-dev/context/{clinica,torre-do-relogio}.md`.
**Testes:** antes 250/250; depois 256/256, typecheck do servidor e do front e build sem erro; auditor só com o histórico
do `PROGRESS.md` (informativo). Armário conferido nos processos reais desta máquina (Claude, portas e Docker). Falta
conferir na vila, junto com a etapa 1, depois do reinício.

## 2026-11-09 — Clínica no lugar da torre do relógio, com a médica que examina quem está demorando

**O que mudou:** decisão do usuário. Ele abria uma sessão nova só para conferir se outra, demorada, estava travada.
Agora a **✦ Dra. Lia** (agente da vila, `server/agents/medica.md`, `claude -p --no-session-persistence`, só Read/Grep/Glob
em modo estrito) examina o morador e responde 🟢/🟡/🟠/🔴/⚫ com evidências e, se for intervir, o texto para colar. Ela
recebe a ficha montada pela vila (`server/src/clinica.ts`): estado e tempo pelos hooks, contexto, a ferramenta cuja
resposta não voltou, erros recentes, últimos passos, os processos filhos do terminal com idade e CPU (duas leituras do
`/proc` com 1 s entre elas; os que nasceram com a sessão são marcados como MCP/plugin) e a máquina (memória, swap, carga,
disco). A clínica ocupa o lote da torre, que saiu: a cruz da placa herdou a cor do sino (pior limite) e o texto do
mouse; por dentro, maca de triagem (moradores vivos e o que rodam), monitor de sinais vitais (limites do Claude, antes
no clique da torre, e a máquina) e a mesa da médica. Atalho "🩺 Chamar a médica" no painel do morador e no aviso de
sessão aberta fora da vila. A médica veste o traje de agente com jaleco, máscara, estetoscópio e coque (exceção escrita
na regra 8). Rotas novas: `GET /api/clinica` e `POST /api/clinica/medica` (só pela página). `ultimosPassos` do mirim
passou a usar `eventosDoFim`, que a ficha também usa. Etapa 2 (armário dos "pacientes esquecidos") virou CL-1.
**Arquivos:** `server/src/clinica.ts` (novo), `server/agents/medica.md` (novo), `server/src/{app,index,terminals,mirim,gasto}.ts`,
`server/tests/{clinica.test.ts (novo),servidor.ts}`; `web/src/game/{ClinicaScene.ts (novo),limites.ts (era torre.ts),TownScene,layout,textures,interiorTextures,villagerArt}.ts`,
`web/src/ui/{clinica.ts (novo),librarian,terminal,actions,gasto}.ts`, `web/src/ui/usage.ts` (removido), `web/src/{main,api}.ts`,
`web/src/style.css`, `web/tests/{limites.test.ts (era torre.test.ts),layout,villager-art}.test.ts`, `scripts/previa-moradores.ts`;
`README.md`, `CLAUDE.md` (estrutura, regras 5 e 8), `PENDENCIAS.md` (CL-1), `docs-dev/context/clinica.md` (plano), `docs-dev/context/torre-do-relogio.md`.
**Testes:** antes 240/240; depois 250/250, typecheck do servidor e do front e build sem erro; auditor só com o histórico
do `PROGRESS.md` (informativo). Leituras do `/proc` conferidas nesta máquina e a médica conferida na prévia em PNG.
Conferido na vila pelo usuário em 20/11/2026, depois do reinício (regra 6): fachada, interior, triagem, sinais vitais e uma consulta de verdade.

## 2026-11-09 — Balão: ícone só enquanto a ferramenta roda; entre ferramentas, os "..." de pensando

**O que mudou:** decisão do usuário. Antes, o ícone da última ferramenta ficava até a próxima (lupa enquanto ele já
planejava). Agora o `PostToolUse` apaga a categoria no `HookStore`: ferramenta rodando = o ícone dela; entre ferramentas
e logo depois da mensagem = os três pontinhos de sempre ("pensando"). Pedido de permissão mantém a categoria. Como agora
cada ferramenta muda o estado duas vezes, os avisos de hook passaram a redesenhar a vila no máximo uma vez a cada 150 ms
(`/api/hooks` em `app.ts`); ferramenta instantânea nem pisca o ícone.
**Arquivos:** `server/src/hooks.ts`, `server/src/app.ts`, `server/tests/hooks.test.ts`; `README.md`.
**Testes:** antes 240/240; depois 240/240 (teste da atividade reescrito para o fim da ferramenta), typecheck e build sem
erro. Conferido na vila pelo usuário em 20/11/2026, depois do reinício e do `claude plugin update dev-valley@dev-valley`.

## 2026-11-08 — Ícones do balão redesenhados (lupa, lápis, terminal, globo, ✦)

**O que mudou:** pedido do usuário: o livro e o lápis do balão não se reconheciam. Os ícones viraram grades de
caracteres com contorno escuro (`web/src/game/iconesBalao.ts`, sem Phaser), desenhados num balão maior (18×14 em vez de
16×12, base no mesmo lugar) e gerados como uma textura por categoria (`bubble-ler`, `bubble-editar`…) em `textures.ts`: um
objeto por morador em vez de um retângulo por pixel. "Lendo" virou **lupa** (o livro aberto ficou ilegível no tamanho do
jogo, e a categoria inclui Grep e Glob); lápis na diagonal com borracha e anel, terminal com `>_`, globo com continentes,
✦ roxa com brilho. Conferido em prévia PNG ampliada e em tamanho de jogo antes de codar (G8: peça visual).
**Arquivos:** `web/src/game/iconesBalao.ts` (novo), `web/src/game/textures.ts`, `web/src/game/statusBubble.ts`,
`web/tests/icones-balao.test.ts` (novo); `README.md`, `CLAUDE.md` (regra 7).
**Testes:** antes 234/234; depois `npm test` 240/240 (6 novos: cada ícone cabe no miolo e só usa a paleta), typecheck
e build sem erro. Conferido na vila pelo usuário em 20/11/2026, depois do reinício e do `claude plugin update dev-valley@dev-valley`.

## 2026-11-08 — Passagem de bastão (BT-1)

**O que mudou:** decisão do usuário: aviso a partir de 70% de contexto, nunca automático, e a própria sessão escreve o
resumo. No painel do morador (sessão comum aberta pela vila, também as novas e avulsas), "Passar o bastão" fica ao lado
de "Encerrar sessão"; a partir de 70% vira botão principal com o aviso "Contexto em X%", e o morador mostra um bastão
vermelho ao lado da cabeça (o tooltip diz "hora de passar o bastão"; o `CONTEXT_WARN` de 70% que já pintava o contexto
é o mesmo limiar). O clique pede confirmação; `POST /api/bastao` (só da página, só sessão parada e fora do porão) digita
no terminal dela o pedido do resumo, numa linha (Objetivo, O que foi feito, O que ficou aberto, Arquivos tocados, Próximo
passo, Cuidados), para `~/.claude/dev-valley/bastao/<id>.md`. A cada 3 s o servidor confere: quando o arquivo aparece
(mais novo que o pedido), abre o sucessor na mesma pasta pelo mesmo `abrirSessao` do porão, com a primeira mensagem "leia o
bastão e diga onde ele parou" e leitura liberada só no arquivo. Pedido sem resumo caduca em 15 min.
**Arquivos:** `server/src/bastao.ts` (novo), `server/src/terminals.ts` (`escrever`), `server/src/app.ts`, `server/src/index.ts`;
`server/tests/bastao.test.ts` (novo), `server/tests/servidor.ts`; `web/src/api.ts`, `web/src/ui/terminal.ts`,
`web/src/ui/project.ts`, `web/src/ui/actions.ts`, `web/src/game/common.ts`, `web/tests/bastao.test.ts` (novo); `README.md`,
`CLAUDE.md` (57 rotas), `PENDENCIAS.md` (BT-1 sai).
**Testes:** antes 227/227; depois `npm test` 234/234 (7 novos: pedido e sucessor, resumo velho e validade, rota com as
travas, limiar do aviso), typecheck e build sem erro. Conferido na vila pelo usuário em 20/11/2026, depois do reinício (regra 6): o Enter
chegar separado do texto no terminal (400 ms) e o sucessor nascer na casa.

## 2026-11-08 — Regras duras por harness, balão com o que o morador faz e previsão dos limites no moinho

**O que mudou:** a partir da pesquisa de práticas da Anthropic e de repositórios parecidos (decisões do usuário, 08/11):
1. **Regras duras** (doc da Anthropic: o que não pode ter exceção vira hook ou permissão, não texto). O `.claude/settings.json`
   do repositório (novo) nega `npm start` e `npm run dev` às sessões (regra 6); no `~/.claude/settings.json` global, `git push`
   passa a perguntar sempre (`ask`; antes só o `--force` era negado). Backup em `settings.json.bak-20261108-185141`.
2. **Conferência ao parar:** hook `Stop` do mesmo arquivo roda `scripts/conferir-ao-parar.sh`: sessão que editou `.ts` de
   `server/`, `web/` ou `mod/` só termina a resposta com o typecheck do servidor e do front passando (erro volta à sessão,
   exit 2). Pula consulta de agente e sessão que só leu, e não roda de novo se o código não mudou desde a última que
   passou (marca em `.git/dev-valley-conferido`). Uns 8 s quando roda.
3. **Balão com o que o morador faz** (ideia do pixel-agents): o mod manda junto do `PreToolUse` só a categoria da
   ferramenta (`ler`, `editar`, `rodar`, `web`, `agente`; subagente conta como `agente`); o balão troca os "..." por livro,
   lápis, terminal, globo ou ✦ roxo, e o tooltip diz "trabalhando: editando". Regra 3 do `CLAUDE.md` ampliada; mod sobe para 0.3.0
   (o instalado é cópia: `claude plugin update dev-valley@dev-valley`).
4. **Moinho prevê os limites do plano** (ideia do Claude-Code-Usage-Monitor): "Limites do plano: até quando dá", com os
   números da torre; sessão de 5h pelo ritmo da última hora (mínimo 10 min de leitura), semana pelo ritmo médio dela.
   As leituras ficam só na memória do servidor (recomeçam no reinício).
**Arquivos:** `.claude/settings.json`, `scripts/conferir-ao-parar.sh`; `mod/hooks/moradores.ts`, `mod/hooks/register.ts`,
`mod/tests/dev-valley.test.ts`, `mod/.claude-plugin/plugin.json`; `server/src/hooks.ts`, `world.ts`, `statusline.ts`, `app.ts`; `server/tests/hooks.test.ts`,
`gasto.test.ts`, `rotas.test.ts`, `servidor.ts`; `web/src/api.ts`, `web/src/game/statusBubble.ts`, `web/src/game/common.ts`,
`web/src/ui/gasto.ts`, `web/src/ui/gasto-texto.ts`, `web/tests/gasto-texto.test.ts`; `README.md`, `CLAUDE.md`, `RETRABALHO.md`.
**Testes:** antes 219/219; depois `npm test` 227/227 (8 novos), typecheck e build sem erro, mod 12/12
(`claude plugin validate` ok), hook testado nos 4 casos (passa, pula sem mudança, ignora consulta, barra erro de tipo).
**Aberto na mesma conversa:** RV-1 (revisor do pombal, plano em `docs-dev/a-codar/revisor-pombal.md`, só depois de
commitar esta entrega), BT-1 (passagem de bastão, falta o limiar) e MA-4 (worktree no porão, ideia não decidida).
Fora deste repositório: enxugamento do núcleo dos guardrails (157 → 124 linhas) na branch `vinicius` do IA, numa cópia
separada (`~/Documents/IA-vinicius`), sem efeito nas sessões até o usuário juntar.
Conferido na vila pelo usuário em 20/11/2026: reinício (regra 6) e `claude plugin update dev-valley@dev-valley` para o balão (vale nas sessões novas); o moinho mede o
ritmo depois de uns 10 minutos de uso.

## 2026-11-05 — Sessão do roteiro de testes: o maestro pede, o clique abre um morador na casa

**O que mudou:** decisão do usuário. Rodada que mexeu em tela termina com a sessão que monta o roteiro de testes na
interface (skill `/roteiro-testes`, nova no repositório de regras). O maestro pede por `POST /api/porao/roteiro` (`curl`,
só o maestro vivo, com a rodada e o relatório em `docs-dev/maestro/`, que precisa existir; um por rodada, o recusado
libera outro). O cartão aparece na estante de partitura do porão e **só o clique** abre a sessão (regra 10). Ela nasce
**na casa**, como morador comum, com `/roteiro-testes <relatório>`: não é anotada no `porao.json`, não conta no teto, não
recebe regras de permissão, e o gongo não a apaga nem recusa o cartão dela. Reaproveita o pedido e o `aprovar` que já
existiam (campo `roteiro` no `PedidoPorao`). No IA, o passo 6 do maestro pede a sessão (só quando mexeu em tela).
**Arquivos:** `server/src/porao.ts`, `server/src/app.ts`; `web/src/api.ts`, `web/src/ui/porao.ts`,
`web/src/game/PoraoScene.ts`; `server/tests/porao.test.ts`, `server/tests/servidor.ts`; `README.md`, `CLAUDE.md` (regra
10, rotas e testes), `docs-dev/context/maestro.md`, `PROGRESS.md`.
**Testes:** antes 213/213; depois `npm test` 219/219 (6 novos: recusas do pedido, um por rodada e fora do teto, abre na
casa sem anotação nem regra, rota e travas, gongo preserva), typecheck e build sem erro. Falta o reinício e conferir na
vila (regra 6), na próxima rodada que mexer em tela.

## 2026-11-05 — CI do GitHub volta a ficar verde e passa a rodar o build do front

**O que mudou:** o job `auditar` falhava desde 29/10 (13 de 14 execuções): a pasta `docs-dev/a-codar/` ficou vazia e o
git não versiona pasta vazia, então no runner ela não existia e o auditor acusava 5 referências mortas de nível ALTO
(`CLAUDE.md`, `server/agents/administrador.md`). Na máquina passava. Entrou `docs-dev/a-codar/.gitkeep`. O job `testes`
ganhou o passo `npm run build`, fechando no CI o mesmo gate do `CLAUDE.md` (typecheck + testes + build).
**Arquivos:** `docs-dev/a-codar/.gitkeep` (novo), `.github/workflows/auditor.yml`, `CLAUDE.md` (linha do CI), `PROGRESS.md`.
**Testes:** antes e depois, na máquina: `npm test` 213/213, typecheck e build sem erro, auditor saída 0 (restam 2 avisos
informativos em entradas antigas do `PROGRESS.md`, sobre um arquivo da estante que não existe mais). O CI de verdade só confirma depois do push.

## 2026-11-04 — Maestro mirim: dúvidas da rodada sem tirar a atenção do maestro, que rege

**O que mudou:** proposta do usuário, com as três recomendações aceitas. Enquanto alguma tarefa da rodada trabalha, o
maestro **rege** (batuta girando, corpo balançando) e o clique nele abre o **maestro mirim**, agente menor ao lado dele,
com um botão para ver o terminal do maestro só para ler. Quando o maestro precisa do usuário, chama pela rota nova
`POST /api/porao/chamar` (`curl`, só o maestro vivo): ❗ nele e no telhado, e o clique abre a conversa (chamado atendido
por `/api/porao/chamar/atendido`, só pela página). O mirim (`server/agents/maestro-mirim.md`, `server/src/mirim.ts`,
rota `POST /api/porao/mirim`, só pela página) é uma consulta por pergunta, como a bibliotecária: a vila monta o estado
da rodada na hora (cada sessão do porão com estado, conversa e últimos passos lidos do fim do `.jsonl`) e ele lê o que
precisar, só com Read, Grep, Glob e `git -C <projeto> status/diff/log/show`, em modo estrito (`estrito` novo em
`consulta.ts`; Bash nunca vai liberado inteiro para agente nenhum). No IA, o agente maestro chama o usuário pela rota
sempre que precisa dele.
**Arquivos:** `server/src/mirim.ts` (novo), `server/agents/maestro-mirim.md` (novo), `consulta.ts`, `porao.ts`, `app.ts`,
`world.ts`, `index.ts`; `web/src/api.ts`, `ui/actions.ts`, `ui/librarian.ts`, `ui/terminal.ts`, `game/PoraoScene.ts`,
`game/interiorTextures.ts`, `game/villagerArt.ts`; `server/tests/mirim.test.ts` (novo), `servidor.ts`; `README.md`,
`CLAUDE.md` (regra 5), `docs-dev/context/maestro.md`, `PROGRESS.md`; no IA, `~/Documents/IA/claude/agents/maestro.md`.
**Testes:** `npm test` 203/203 antes → 213/213 depois (resumo das conversas, estado da rodada, ferramentas e modo do
mirim, Bash nunca inteiro, chamado no `Porao`, as 3 rotas novas: origem, maestro parado, projeto, pergunta vazia,
NDJSON); tipos do servidor e do front sem erro. **Mirim de verdade** (`askMirim`, agente real): pergunta sobre a tarefa
respondida em 8 s, lendo a conversa e o `git status`; pedido para editar o README e mandar recado ao maestro recusado em
6 s, README intacto (hash conferido). A animação da batuta e o tamanho do mirim não foram vistos (sem navegador e sem
reinício, regra 6). Build não rodado (regra 6). Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-04 — Maestro: sessões liberadas só nos arquivos e testes da tarefa, tempo no relatório, relatórios na estante do porão

**O que mudou:** três decisões do usuário. (1) A partitura do portão poluía o mapa: saiu da fachada (`TownScene` e
`textures.ts` voltaram ao último commit) e os relatórios foram para a estante de partitura que já existe ao lado do
maestro no porão: sem pedido esperando, o clique abre a lista; um ♪ flutua sobre ela com relatório não aberto. O "novo
até abrir" e a rota `POST /api/relatorios/lido` continuam. (2) **Permissão só no que a tarefa precisa:** o pedido do
maestro passa a levar, por tarefa, `{ id, arquivos, testes }` (nome sozinho continua valendo, sem permissão);
`validarPermissoes` recusa arquivo fora do projeto, com curinga, em `.git/`, `.claude/` ou `.env*`, e comando com o que o
shell interpreta ou da lista `NUNCA` (rm, git, curl, sudo…). O cartão mostra o que cada tarefa libera; ao aprovar,
`regrasDaTarefa` monta o `--allowedTools` (ler a rodada e o `porao.leitura` do config, editar só os arquivos, rodar só os
testes) e `argsDoTerminal` põe as regras depois da primeira mensagem. A rota passa a pasta da casa do maestro ao
`pedir`. Config local ganhou `porao.leitura` (o contrato "Sob o maestro"). (3) **Tempo no relatório:** o maestro anota a
hora no `COMECEI` e no `PRONTA`, junto com a ação que já faria (sem volta a mais); coluna Tempo e duração total. No IA:
agente (`maestro.md`: pedido novo, hora, briefing com "Testes liberados" e "leia com Read") e contrato (`convivencia.md`).
**Arquivos:** `server/src/porao.ts`, `app.ts`, `config.ts`, `index.ts`, `terminals.ts`, `relatorios.ts`, `world.ts`;
`web/src/api.ts`, `ui/porao.ts`, `ui/relatorios.ts`, `ui/actions.ts`, `game/PoraoScene.ts`; `server/tests/porao.test.ts`,
`relatorios.test.ts`, `servidor.ts`; `README.md`, `CLAUDE.md`, `PENDENCIAS.md` (MA-3), `docs-dev/context/maestro.md`,
`PROGRESS.md`; no IA, `~/Documents/IA/claude/agents/maestro.md` e `~/Documents/IA/guardrails-ia/convivencia.md`.
**Testes:** `npm test` 194/194 antes → 203/203 depois (validação de arquivos e comandos, regras, pedido misto, aprovação
com e sem regras, rota com a pasta da casa, ordem dos argumentos); tipos do servidor e do front sem erro; auditor só com
os avisos antigos. **Validado com o Claude Code de verdade, sem tela** (`claude -p --permission-mode default`, argumentos
gerados pelas funções novas): editar arquivo liberado e ler a rodada passaram; editar outro arquivo e ler fora foram
negados; o teste liberado passou puro, com `| tail` e com argumento a mais, e foi negado quando o modelo rodou
`npm --prefix <pasta> run checar` (por isso o briefing manda rodar exatamente como está). **Rodada de ponta a ponta:**
rota real → cartão aprovado pela página (sem ela, 403) → `Porao` real → 3 sessões em paralelo com as regras geradas:
25 s, 6 de 6 mensagens (`COMECEI`/`PRONTA`) entregues a esta sessão no papel de maestro, os 3 arquivos editados e o
mesmo `PROGRESS.md` somado pelas três; uma negativa só (uma sessão leu o contrato com `sed` no Bash, e o briefing agora
manda ler com Read). Rodada de teste apagada. Build não rodado (regra 6). Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-03 — Partitura do portão: o relatório do maestro à vista, "novo" até abrir; o quadro saiu do porão

**O que mudou:** decisão do usuário (o quadro do porão era inútil: era preciso descer, e nada avisava). Cada casa com
relatório em `docs-dev/maestro/` ganha uma estante de partitura à direita do caminho da porta, simétrica à placa de
vistoria. Com relatório não aberto, a folha fica branca com notas e um ♪ flutua em cima; o clique lista os relatórios,
com selo "novo" nos não abertos, e abrir um o marca como lido. Os lidos ficam em `relatorios-lidos.json`, em
`~/.claude/dev-valley/` (fora do git, como o `porao.json`), pela classe `RelatoriosLidos`; o mundo leva `lido` em cada
relatório. Rota nova `POST /api/relatorios/lido`: só pela página (`Origin` local presente) e só relatório listado no
mundo daquele projeto, senão 404 (G9). O quadro de cortiça e os bilhetes saíram do `PoraoScene`; a lista saiu de
`ui/porao.ts` para `ui/relatorios.ts`. Na primeira vez, todos os relatórios que já existem aparecem como novos.
**Arquivos:** `server/src/relatorios.ts`, `world.ts`, `app.ts`, `index.ts`; `web/src/api.ts`, `ui/relatorios.ts` (novo),
`ui/porao.ts`, `ui/actions.ts`, `game/textures.ts` (`scoreStand`, `scoreStand-new`), `game/TownScene.ts`,
`game/PoraoScene.ts`; `server/tests/relatorios.test.ts`, `server/tests/servidor.ts`; `README.md`, `CLAUDE.md`,
`docs-dev/context/maestro.md`, `PROGRESS.md`.
**Testes:** `npm test` 190/190 antes → 194/194 depois (lidos, arquivo estragado, rota: sucesso, já lido, 403 sem origem
e de outra origem, 404 por caminho e por projeto); typecheck do servidor e do front (`tsc --noEmit -p web`) sem erro;
auditor só com os 2 avisos antigos. Prévia da textura em PNG, sem navegador. Build não rodado (regra 6). A partitura do
portão saiu em 04/11/2026 sem ir à vila (entrada acima): nada a conferir aqui.

## 2026-11-03 — Maestro e porão fechados (MA-1)

**O que mudou:** o usuário rodou uma rodada de verdade pela vila depois da correção das mensagens (relatório
`docs-dev/maestro/2026-11-03-teste-rapido.md`: 2 sessões, pedido → cartão → `COMECEI` → aviso de parada → `PRONTA` das
duas) e deu o resultado como satisfatório. Plano movido de `docs-dev/a-codar/` para `docs-dev/context/maestro.md`, com
cabeçalho dizendo o que vale hoje (simplificação + correção das mensagens) e a seção da correção registrada; MA-1 saiu
do `PENDENCIAS.md`; o painel passa a mostrar o plano do maestro, as 4 fases feitas.
**Arquivos:** `docs-dev/context/maestro.md` (movido), `PENDENCIAS.md`, `docs-dev/painel.json`, `README.md` e o
comentário de `server/src/porao.ts` (caminho novo do plano), `PROGRESS.md`.
**Testes:** só documento e um comentário; auditor de referências, typecheck do servidor e `npm test` rodados no fechamento.

## 2026-11-03 — Maestro: as sessões avisam de verdade, e o maestro cobra sozinho quem parou

**O que mudou:** investigação da rodada `20261103-2313-testes-modulos`, em que o usuário ficou esperando sem retorno. As
três sessões terminaram em ~2 min, mas escreveram o `PRONTA` como texto na própria tela: a `SendMessage` é ferramenta
adiada e o contrato só dizia "mande PRONTA". O maestro, perguntado às 23:16, respondeu "ainda não acabou" sem cobrar;
só às 23:23 cobrou, e os três avisos chegaram em 3 s (a entrega entre sessões funciona, e o maestro acorda sozinho).
No repositório IA: o contrato ("Sob o maestro", `convivencia.md`) e o briefing mandam usar a ferramenta `SendMessage`
(carregando com `ToolSearch` se preciso), dizem que texto na tela não chega e pedem conferir `"success":true`; primeiro
passo da sessão é um `COMECEI`. O maestro, no `COMECEI`, assina o aviso de parada (`notify_when_idle`) e cobra na hora
quem parar sem `PRONTA`; quando o usuário pergunta, confere quem está parado e cobra; e fala sempre pelo endereço
(`from`), porque nomes de sessão se repetem e mudam ao reiniciar.
**Arquivos:** neste repositório, só `PROGRESS.md` e `RETRABALHO.md`; no IA, `~/Documents/IA/claude/agents/maestro.md` e
`~/Documents/IA/guardrails-ia/convivencia.md`.
**Testes:** cadeia de testes com sessões sem tela (`claude -p --no-session-persistence`), briefing no modelo novo e esta
sessão no papel de maestro: 1 sessão (chamou a ferramenta; falhou só pelo nome do maestro, que tinha mudado no
reinício, e não mandou a outra sessão), depois 2 rodadas de 3 sessões em paralelo: **12 de 12 mensagens entregues**
(`COMECEI` e `PRONTA`), 15 a 21 s cada. Rodada de teste apagada depois. O lado do maestro (aviso de parada e cobrança)
só se testa numa rodada de verdade pela vila.

## 2026-11-03 — Teste do quadro negro (rodada `20261103-2313-testes-modulos`, t1)

**O que mudou:** `readQuadro` ganhou teste (4 casos): sem painel ou sem `doc` → vazio; `doc` do plano primeiro e o de
cada fase depois, em qualquer estado, com caminho absoluto e tipo (`.md`, `.htm`, `.HTML` em maiúscula); fica de fora
arquivo que não existe, pasta com nome `.md`, extensão que não é HTML/Markdown, e `doc` fora do projeto (absoluto, `../`
e pasta irmã com o mesmo prefixo). Só teste: `server/src/quadro.ts` não mudou.
**Arquivos:** `server/tests/quadro.test.ts` (novo), `PROGRESS.md`.
**Testes:** `npm test` 169/169 antes → 190/190 depois (4 deste arquivo; o resto, de outras sessões da rodada); typecheck do servidor sem erro.

## 2026-11-03 — Teste do quadro de relatórios do porão (rodada `20261103-2313-testes-modulos`, t3)

**O que mudou:** `readRelatorios` ganhou arquivo de teste próprio (10 casos, as bordas que o caso feliz de
`porao.test.ts` não pega): pasta vazia → lista vazia e sem a pasta → null; só `.md` do primeiro nível (subpasta com nome
`.md` fica de fora); ordem decrescente pelo nome; `path` absoluto; título do primeiro `# ` (não `## `), aparado, sem
"Rodada:" em qualquer caixa e só no começo, ou o nome do arquivo quando não há título; data só com `AAAA-MM-DD` no
começo do nome. Só teste: `server/src/relatorios.ts` não mudou.
**Arquivos:** `server/tests/relatorios.test.ts` (novo), `PROGRESS.md`.
**Testes:** `npm test` 169/169 antes → 190/190 depois (10 deste arquivo; o resto, de outras sessões da rodada). Typecheck
do servidor sem erro no meu arquivo; no momento falha só em `server/tests/quadro.test.ts`, de outra sessão em andamento.

## 2026-11-03 — Teste da caixa de sementes (rodada `20261103-2313-testes-modulos`, t2)

**O que mudou:** `readSementes` ganhou teste (7 casos): sem pasta → null, pasta vazia → lista vazia, só `.md` do primeiro
nível sem o `README` em ordem de nome, título do primeiro `# ` ou o nome do arquivo, e `toCheck` acendendo com
"falta conferir na vila" mas não com a frase citada entre aspas. Só teste: `server/src/sementes.ts` não mudou.
**Arquivos:** `server/tests/sementes.test.ts` (novo), `PROGRESS.md`.
**Testes:** `npm test` 169/169 antes → 180/180 depois (7 deste arquivo; o resto, de outras sessões da rodada); typecheck do servidor sem erro.

## 2026-11-03 — Rodada de teste do maestro: commits do que estava pendente

**O que mudou:** rodada `20261103-1600-teste-commits`, 2 sessões só de leitura: uma propôs os commits, a outra conferiu
o rastro da fase 4 contra o código. Viraram os commits `6548a8b` (HUD) e `bfe3019` (fase 4), com o rastro da fase 4
corrigido antes. Relatório em `docs-dev/maestro/2026-11-03-teste-commits.md`; o bug achado no gongo virou o MA-2.
**Arquivos:** `docs-dev/maestro/2026-11-03-teste-commits.md` (novo), `PROGRESS.md`, `PENDENCIAS.md`.
**Testes:** `npm test` 168/168 e tipos sem erro (nenhum código mudou na rodada).

## 2026-11-03 — Gongo do porão: encerrar sempre responde (MA-2)

**O que mudou:** bug achado na rodada de teste (`docs-dev/maestro/2026-11-03-teste-commits.md`) e registrado como MA-2,
que sai do `PENDENCIAS.md`. `POST /api/porao/encerrar` tinha `try/finally` sem `catch` num handler `async` do Express 4:
erro ao fechar um terminal ou apagar uma conversa deixava a página sem resposta e o gongo travado. Agora para de apagar no
erro, tira do `porao.json` o que já foi apagado e responde 500 com "Parou depois de apagar N de M conversa(s): motivo".
**Arquivos:** `server/src/app.ts`, `server/tests/porao.test.ts`, `PENDENCIAS.md`, `CLAUDE.md`.
**Testes:** teste novo do erro no meio; `npm test` 169/169; typecheck do servidor sem erro.

## 2026-11-03 — Maestro simplificado: o usuário divide, o maestro só distribui e evita conflito

**O que mudou:** pedido do usuário depois da rodada de teste "organizar os commits", que levou ~50 min (o maestro
inventou uma auditoria de 22 min e o processo tinha ~26 min de custo fixo). Decisões no `docs-dev/context/maestro.md`
("Simplificação…"). O agente (`~/Documents/IA/claude/agents/maestro.md`) foi reescrito: recebe as tarefas já divididas,
levanta os arquivos de cada uma, responde num bloco ✔ paralelo / ⏸ espera, escreve briefings curtos, pede as sessões
(o clique no cartão é a única aprovação), responde `PEDIDO` com `LIBERADO`/`ESPERE` e, no fim, monta um relatório curto
só com os `PRONTA`. Não planeja, não revisa, não testa, não commita; hora pelo `date`. Seção "Sob o maestro" do
`convivencia.md` enxuta: a sessão trabalha como qualquer outra, só nos arquivos dela, anota o próprio rastro e não
commita (o usuário commita pelo pombal). Código da vila sem mudança.
**Arquivos:** `README.md`, `docs-dev/context/maestro.md`; no repositório IA, `~/Documents/IA/claude/agents/maestro.md`,
`~/Documents/IA/guardrails-ia/convivencia.md` e a linha da G21.
**Testes:** só instruções e documentação; `npm test` para conferir que nada mudou.

## 2026-11-03 — Maestro, fase 4: alçapão aceso, ❗ no telhado, quadro de relatórios e gongo de encerrar

**O que mudou:** fase 4 do `docs-dev/context/maestro.md`. O alçapão da casa acende (luz pelas frestas) com rodada em
andamento e ganha um ❗ quando alguém do porão pede permissão ou o cartão do maestro espera; o mesmo ❗ sobe ao telhado da
casa no mapa (`rodadaEmAndamento` e `poraoPrecisaDeVoce` no `api.ts`). No porão, um quadro de cortiça com um bilhete por
relatório de `docs-dev/maestro/` (`server/src/relatorios.ts`, lido no mundo como `relatorios`), que lista e abre no
leitor; e um gongo de "Encerrar rodada": com confirmação listando cada conversa, `POST /api/porao/encerrar` (só pela
página) apaga as conversas do porão do projeto, como o encerrar de sempre (decisão do usuário), recusa se alguma estiver
aberta em outro terminal, tira os ids do `porao.json` e dá o pedido aberto como recusado.
**Arquivos:** `server/src/relatorios.ts` (novo), `porao.ts`, `app.ts`, `world.ts`; `web/src/api.ts`,
`web/src/game/PoraoScene.ts`, `InteriorScene.ts`, `TownScene.ts`, `interiorTextures.ts`, `web/src/ui/porao.ts`,
`web/src/ui/actions.ts`; `server/tests/porao.test.ts`, `servidor.ts`; `CLAUDE.md`, `README.md`,
`docs-dev/context/maestro.md`, `PENDENCIAS.md`.
**Testes:** `npm test` 168/168; tipos do servidor e do front sem erro; prévia em PNG das peças novas (gongo, quadro,
alçapão aceso) fora do repositório. Falta: reinício e conferir na vila (regra 6).

## 2026-11-03 — Porão: a conversa do maestro mora no ✦, e as mesas são só das tarefas

**O que mudou:** pedido do usuário depois da primeira rodada de verdade (ajuste registrado no `docs-dev/context/maestro.md`).
A sessão do maestro deixa de aparecer como morador numa mesa: o ✦ ganha o balão de estado dela (trabalhando, ❗ de
permissão) e o clique nele continua a conversa da rodada em andamento, ou começa uma nova quando não há (sessão do
maestro aberta em outro terminal: o aviso de "ocupado" de sempre). O porão tem 5 mesas fixas, o teto, só para as
sessões de tarefa; os bancos também. O alçapão diz quando há rodada em andamento.
**Arquivos:** `web/src/game/PoraoScene.ts`, `web/src/game/InteriorScene.ts`, `web/src/ui/actions.ts`,
`docs-dev/context/maestro.md`, `RETRABALHO.md`.
**Testes:** `npm test` 165/165; tipos do servidor e do front sem erro. Conferido na vila pelo usuário (03/11/2026).

## 2026-11-03 — Rodada do maestro: memórias do perfil pessoal na biblioteca (PP-2) e contorno na carta do painel

**O que mudou:** primeira rodada de verdade pelo porão, com 2 sessões em paralelo. (1) A biblioteca lê as memórias de
todos os perfis (`projectsDirs(config)`): as do perfil de trabalho ficam com os ids e títulos de sempre, e as do perfil
pessoal entram como `memory:pessoal:<dir>`, com o título "Memórias do perfil pessoal — …". Fecha a PP-2. (2) A carta ✉️
de "Mudanças sem commit" no painel do canto superior direito ganha um contorno escuro (`text-shadow` em `::first-letter`),
e o número ao lado não muda.
**Arquivos:** `server/src/library.ts`, `server/tests/biblioteca-perfil.test.ts` (novo), `web/src/style.css`.
**Testes:** `npm test` 162/162 → 165/165; tipos do servidor sem erro; auditor sem achado novo. Falta conferir a carta na
tela. Relatório: `docs-dev/maestro/2026-11-03-biblioteca-carta.md`.

## 2026-11-03 — Maestro, fase 3: o maestro pede as sessões e o usuário aprova no cartão

**O que mudou:** fase 3 do `docs-dev/context/maestro.md`, com a aprovação decidida pelo usuário (cartão com botão, como o
push do pombal). A sessão do maestro aberta pela vila recebe `DEV_VALLEY_URL` e `DEV_VALLEY_SESSION`; com elas, ele pede
as sessões da rodada por `POST /api/porao/pedidos` (só o maestro anotado e vivo, briefing de cada tarefa já escrito,
teto de 5 por rodada contando as abertas e as pedidas). O pedido vira um ❗ na estante de partitura do porão; o cartão
lista as tarefas e os botões "Abrir" e "Recusar", que chamam rotas que **só aceitam com `Origin` local presente** (o
maestro, por `curl`, nunca se aprova). Aprovar anota cada sessão no `porao.json` e abre o terminal sem tela
(`TerminalManager.start`) com a frase do briefing como primeira mensagem; a que não abre sai do registro. Agente
atualizado (etapa 5 do `~/Documents/IA/claude/agents/maestro.md`: como pedir, proibido aprovar) e regra 10 no
`CLAUDE.md`. `porao.tetoSessoes` no config só baixa o teto.
**Arquivos:** `server/src/porao.ts`, `app.ts`, `index.ts`, `terminals.ts`, `config.ts`, `world.ts`;
`web/src/ui/porao.ts` (novo), `web/src/ui/actions.ts`, `web/src/api.ts`, `web/src/game/PoraoScene.ts`,
`InteriorScene.ts`, `TownScene.ts`; `server/tests/porao.test.ts`, `servidor.ts`; `CLAUDE.md`, `README.md`.
**Testes:** `npm test` 162/162 (156 antes; pedido, teto, aprovação, travas de origem); tipos do servidor e do front sem
erro; auditor sem achado novo. Sem build nem reinício: as rotas são do servidor, então só valem depois do `npm start`
do usuário (regra 6), e a rodada de verdade pela vila é a conferência.

## 2026-11-03 — Porão: sair da casa deixava a tela em branco

**O que mudou:** bug da fase 2 apontado pelo usuário depois do reinício. O banco do porão usava o nome de textura
`bench`, o mesmo do banco da praça; ao entrar numa casa, a geração das peças do porão apagava o da praça e o mapa
quebrava ao acordar (`glTexture` de null), com ou sem descer ao porão. Bancos do porão viram `poraoBench` e
`poraoBenchFront`; teste novo recusa nome de textura fixo repetido entre os arquivos de `web/src/game/`.
**Arquivos:** `web/src/game/interiorTextures.ts`, `web/src/game/PoraoScene.ts`, `web/tests/texturas-unicas.test.ts`
(novo), `RETRABALHO.md`.
**Testes:** reproduzido no navegador (Edge sem janela, pela porta de depuração) e conferido com a correção num Vite
avulso na porta 5199 ligado à vila no ar, sem build nem reinício: casa → Esc → mapa, sem erro no console. `npm test`
156/156; tipos do servidor e do front sem erro.

## 2026-11-03 — Maestro, fase 2: o porão na vila

**O que mudou:** fase 2 do `docs-dev/context/maestro.md`. Cada casa ganha um alçapão no chão (canto de baixo à
esquerda); ele desce ao porão (`PoraoScene`): parede e piso de pedra, escada para voltar, o maestro ✦ de terno
(combinação de pele e cabelo reservada) ao lado da estante de partitura, mesas para as sessões vivas da rodada (maestro e
tarefas, com o rótulo `maestro`/`t1`…) e dois bancos para as encerradas (rodadas antigas, para reabrir). Clique no
maestro = rodada nova: `POST /api/porao/maestro` anota a sessão no `porao.json` (em `~/.claude/dev-valley/`, criado no primeiro clique) antes de o terminal
abrir com `--agent maestro` na pasta do projeto; sem o agente instalado, 409 com o comando do instalador. As sessões de
trabalho entram no porão sozinhas, pelo primeiro prompt (a frase fixa do briefing, lida do `.jsonl` como o título).
Quem é do porão leva a marca `porao` no mundo e sai do mapa, da casa e da escrivaninha; HUD e pombal continuam contando
(aviso de permissão e de sessão viva antes do push). O maestro global sai da Fábrica e da praça.
**Arquivos:** `server/src/porao.ts` (novo), `sessions.ts`, `world.ts`, `agents.ts`, `app.ts`, `index.ts`;
`web/src/game/PoraoScene.ts` (novo), `InteriorScene.ts`, `interiorTextures.ts`, `villagerArt.ts`, `TownScene.ts`,
`web/src/api.ts`, `web/src/ui/actions.ts`, `web/src/ui/project.ts`, `web/src/main.ts`; testes em
`server/tests/porao.test.ts` (novo), `rotas-fabrica-biblioteca.test.ts`, `servidor.ts`.
**Testes:** `npm test` 155/155 (148 antes); typecheck do servidor e do front (`tsc --noEmit`) sem erro; auditor sem
achado novo. Prévia em PNG das peças novas (porão e alçapão) gerada fora do repositório, sem navegador. **Sem
`npm run build`**: publicaria no `web/dist` o `hud.ts` em andamento de outra sessão. Falta: build e reinício pelo
usuário (regra 6) e conferir na vila; conferido em 03/11/2026, depois da correção do banco (entrada acima).

## 2026-11-03 — Maestro, fase 1: o agente e a regra (no repositório IA)

**O que mudou:** fase 1 do `docs-dev/context/maestro.md`, feita fora deste repositório (o agente é universal). Em
`~/Documents/IA`: `~/Documents/IA/claude/agents/maestro.md` (etapas fixas da rodada, matriz de conflito, revisão por entrega e de
integração, retomada, protocolo `[maestro] <id> <tarefa>: <TIPO>`, modelos de briefing e relatório); `instalar.sh`
linka `claude/agents/*.md` em `~/.claude/agents/` sem sobrescrever agente alheio; seção "Sob o maestro" em
`~/Documents/IA/guardrails-ia/convivencia.md` e uma frase na G21. Estado da rodada em `~/.claude/maestro/rodadas/<id>/`. Falta o
usuário rodar o `instalar.sh` e fazer a primeira rodada no modo manual.
**Arquivos:** neste repositório, só `docs-dev/context/maestro.md` (fase 1 marcada, tabela de arquivos de controle).
**Testes:** passo novo do instalador testado em pasta temporária (agente novo, já linkado, alheio intocado);
`bash -n instalar.sh`; cabeçalho do agente validado como YAML; auditor sem achado novo.

## 2026-11-03 — Plano do maestro e do porão

**O que mudou:** planejado com o usuário o agente maestro, que coordena até 5 sessões em paralelo no mesmo projeto, e o
porão da casa onde isso acontece na vila. Decisões A–J e as 4 fases em `docs-dev/context/maestro.md`; aberto o MA-1 no
`PENDENCIAS.md`. Ainda sem código.
**Arquivos:** `docs-dev/context/maestro.md`, `PENDENCIAS.md`.
**Testes:** só documentação; nada a rodar.

## 2026-11-03 — HUD: carta no lugar do pacote nas mudanças sem commit

**O que mudou:** pedido do usuário, fora de plano. No canto superior direito, o contador de mudanças sem commit troca
📦 por ✉️, o mesmo símbolo que o pombal já usa para as alterações locais (metáfora da carta por enviar).
**Arquivos:** `web/src/ui/hud.ts`.
**Testes:** `npm run build`.

## 2026-11-03 — README: `mod/` e `scripts/` na seção "Estrutura"

**O que mudou:** a seção "Estrutura" do README listava só `server/` e `web/`; agora cita também o mod do Claude Code e
os scripts (auditor e prévia dos moradores). Só documentação, feita também para demonstrar o envio pelo pombal.
**Arquivos:** `README.md`.
**Testes:** sem código alterado; nada a rodar.

## 2026-11-02 — Moinho: painel mais claro

**O que mudou:** pedido do usuário ("está meio confuso"), proposta aprovada. No topo, só a janela ("Semana do plano: seg
27/10 → seg 03/11 · faltam 2 dias"). Por perfil ("Trabalho (Claude)", "Pessoal (DeepSeek)"), a comparação vira título
curto ("Gastando mais rápido que na semana passada.") com a projeção concreta ("No ritmo de agora, esta semana fecha em
1,4× o que foi a anterior."). Cada projeto é uma linha com nome, barra e % sempre à vista; o clique abre as conversas que
mais gastaram. Peso, cache ÷ 10, pás e totais em tokens foram para "Como é calculado", recolhido no fim. O balão do
moinho na vila usa o mesmo título curto.
**Arquivos:** `web/src/ui/gasto.ts`, `web/src/ui/gasto-texto.ts` (`comparacao`, `projecao`, `faltam`),
`web/tests/gasto-texto.test.ts`, `web/src/style.css` (seção `.gasto-*`), `docs-dev/context/moinho-gasto-por-projeto.md`.
**Testes:** 138/138 antes, 140/140 depois; typecheck e build sem erro. Conferido na vila pelo usuário em 20/11/2026, com atenção a nome de projeto comprido na linha e à tela estreita.

## 2026-11-02 — Conversa com o jornaleiro e edição extra da Gazeta

**O que mudou:** o clique no jornaleiro ✦ abre uma conversa (mesmo painel da bibliotecária); a banca continua abrindo a
Gazeta do dia. Ele responde pelo que mudou nos últimos 30 dias de commits de todos os projetos (seus e do time), sem
ferramenta e sem código, em linguagem de gente; pergunta que exige código vira sugestão de abrir sessão na casa. Dois
atalhos no topo ("A semana de um projeto", "Desde uma data") imprimem uma edição extra, que abre na folha da Gazeta com o
selo "Edição extra", sem marcar o jornal como lido nem trocar a edição do dia. Na base dos agentes, `argsDaConsulta`
passa `--tools ""` para agente sem ferramenta, e a leitura do cabeçalho deixou de pular para a linha de baixo quando o
campo está vazio (erro latente que teria dado ao agente uma "ferramenta" chamada `model: sonnet`).
**Arquivos:** `server/src/consulta.ts` (`argsDaConsulta`, `agentDefinition`), `server/src/jornal.ts` (`imprimirExtra`,
`pautaDaConversa`, `askJornaleiro`, `extra` no `view`), `server/agents/jornaleiro-conversa.md` (novo),
`server/src/app.ts` (`POST /api/jornal/extra`, `POST /api/jornaleiro/ask`), `server/src/index.ts`,
`server/tests/consulta.test.ts` (novo, 3 testes), `server/tests/jornal.test.ts` (5 testes novos),
`server/tests/servidor.ts`, `web/src/api.ts`, `web/src/ui/jornaleiro.ts` (novo), `web/src/ui/librarian.ts`
(`JORNALEIRO`), `web/src/ui/jornal.ts` (modo extra), `web/src/ui/actions.ts`, `web/src/game/TownScene.ts`, `README.md`,
`CLAUDE.md`, `docs-dev/context/conversa-com-o-jornaleiro.md` (saiu de `a-codar/`).
**Testes:** 138/138 antes, 148/148 depois; typecheck do servidor e build sem erro. O jornaleiro de verdade (`claude -p`
com `--tools ""`) não foi chamado aqui: a imitação cobre a rota, a montagem dos argumentos tem teste. Falta conferir na
vila (reinício do usuário, regra 6).

## 2026-11-02 — Plano: conversa com o jornaleiro e edição extra

**O que mudou:** só plano, nenhum código. O jornaleiro ✦ era o único agente da vila sem conversa. Decidido ("segue as
recomendações"): clique nele abre a conversa (a banca continua abrindo a Gazeta); ele enxerga 30 dias de commits, sem
ferramenta e sem diff; dois atalhos imprimem uma edição extra (a semana de um projeto, ou desde uma data). Antes, a banca
e a Gazeta foram commitadas (`bd69230`).
**Arquivos:** `docs-dev/context/conversa-com-o-jornaleiro.md` (era `a-codar/`), `PENDENCIAS.md` (JN-1).
**Testes:** não se aplica (sem código).

## 2026-11-02 — Gazeta do Vale: o jornal da banca com cara de jornal

**O que mudou:** pedido do usuário, com as 3 decisões aprovadas (título por notícia, nome "Gazeta do Vale", fonte de
jornal). O clique na banca abre uma folha de jornal no lugar do painel de pergaminho: papel creme com granulado,
cabeçalho em letra gótica, linha da data com filete duplo, manchete na largura toda, notícias em colunas com título,
capitular na primeira, "Achados e perdidos" (projetos parados) num quadro de contorno inteiro e "Sem novidade em" como
nota de rodapé. Abre desdobrando (sem animação com `prefers-reduced-motion`). O jornaleiro passa a mandar `titulo` por
notícia; edição antiga sem título usa o nome do projeto.
**Arquivos:** `server/src/jornal.ts` (`titulo`), `server/agents/jornaleiro.md`, `server/tests/jornal.test.ts`,
`web/src/ui/jornal.ts`, `web/src/api.ts`, `web/src/style.css` (seção Gazeta), `web/package.json` e `package-lock.json`
(`@fontsource/old-standard-tt` e `@fontsource/unifrakturmaguntia` 5.3.0), `README.md`,
`docs-dev/context/gazeta-do-vale.md`.
**Testes:** 138/138 antes e depois (o teste do jornaleiro ganhou o caso do título); typecheck e build sem erro. **Não
renderizado aqui:** sem navegador sem interface instalado. Conferido na vila pelo usuário em 20/11/2026, com
atenção a: colunas com 1 e com muitas notícias, cabeçalho em tela estreita, botões no canto da folha.

## 2026-11-02 — Banca de jornal: o que mudou nos projetos, em linguagem de gente

**O que mudou:** último dos planos da parte de cima da vila. A banca fica ao lado da praça, com o jornaleiro ✦ (agente da
vila, traje de agente secreto). O jornal conta o que mudou desde a última leitura (piso de 24h, teto de 7 dias), "Você" e
"o time" separados, com manchete, projetos sem novidade e projetos parados há 14 dias ou mais. Uma edição por dia, que sai
sozinha depois das 6h com a vila aberta ou no botão "Imprimir"; a pilha no balcão aparece quando a de hoje já saiu. O
jornaleiro recebe só assunto do commit e nome de arquivo (nunca o diff) e devolve JSON; sem commit, não é chamado.
O servidor da banca entrou no commit `7511263`; o desenho, a cena e a documentação, agora. As duas respostas longas que
caíram no meio ("Connection lost mid-response") foram retomadas em passos pequenos.
**Arquivos:** `server/src/jornal.ts`, `server/agents/jornaleiro.md`, `server/tests/jornal.test.ts` (8 testes),
`server/src/app.ts` (3 rotas), `server/src/index.ts`, `web/src/api.ts`, `web/src/ui/jornal.ts`, `web/src/ui/actions.ts`,
`web/src/game/textures.ts` (`newsstand`), `web/src/game/TownScene.ts` (`buildNewsstand`), `web/src/game/villagerArt.ts`,
`README.md`, `CLAUDE.md` (regra 5 cita o jornaleiro), `docs-dev/context/banca-de-jornal.md` (saiu de `a-codar/`).
**Testes:** 130/130 antes, 138/138 depois; typecheck do servidor e build sem erro. Prévia da arte em PNG conferida. O
jornaleiro de verdade (`claude -p`) não foi chamado nos testes (imitado). Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-02 — Moinho: com o que o Claude gastou na semana

**O que mudou:** terceiro plano da parte de cima da vila. O moinho fica entre a praça e a Fábrica; as pás giram no ritmo
da semana do plano comparado com o da semana passada (6 s por volta no mesmo ritmo, paradas sem gasto). O clique mostra,
por perfil (trabalho e pessoal, separados), cada projeto com a fatia dele do gasto e, ao abrir, os moradores que mais
gastaram; o número de tokens fica em letra miúda. Peso = entrada + saída + criação de cache + leitura ÷ 10. A leitura dos
`.jsonl` é incremental e conta cada resposta uma vez (o Claude Code repete o `usage` em várias linhas da mesma resposta).
**Arquivos:** `server/src/gasto.ts` (novo), `server/src/app.ts` (`GET /api/gasto`), `server/src/index.ts`,
`server/tests/gasto.test.ts` (novo, 5 testes), `server/tests/servidor.ts`, `web/src/api.ts`, `web/src/ui/gasto.ts` e
`gasto-texto.ts` (novos), `web/tests/gasto-texto.test.ts` (novo, 4 testes), `web/src/ui/actions.ts`,
`web/src/game/textures.ts` (`windmill`), `web/src/game/TownScene.ts` (`buildWindmill`, `girar`), `README.md`, `CLAUDE.md`,
`docs-dev/context/moinho-gasto-por-projeto.md` (saiu de `a-codar/`).
**Testes:** 121/121 antes, 130/130 depois; typecheck do servidor e build sem erro. Conferido nos dados reais (1ª leitura
155 ms, depois 10 ms). Prévia da arte em PNG conferida. Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-02 — Quadro de força na Fábrica: plugins e MCP (só leitura)

**O que mudou:** segundo plano da parte de cima da vila. Na parede da Fábrica, entre a janela e as skills, um quadro de
força com uma alavanca por plugin (verde para cima = ligado, vermelha para baixo = desligado). O clique abre os plugins
dos dois perfis (trabalho e pessoal), com descrição, versão, loja e o que cada um traz ("hooks", "2 skills e 1
comando"…), e os servidores MCP (global, por projeto e `.mcp.json` do repositório). Só leitura: o painel manda usar
`/plugin` para ligar e desligar. Do MCP sai só nome, tipo e onde (comando, URL e variáveis podem ter chave, G13).
Conectores do claude.ai não ficam em arquivo e o painel avisa que não aparecem. Hoje: 2 plugins nos 2 perfis, nenhum MCP.
**Arquivos:** `server/src/plugins.ts` (novo), `server/src/app.ts` (`GET /api/plugins`, `plugins` no `Contexto`),
`server/src/index.ts`, `server/tests/plugins.test.ts` (novo, 4 testes), `server/tests/servidor.ts`, `web/src/api.ts`,
`web/src/ui/plugins.ts` (novo), `web/src/ui/actions.ts`, `web/src/game/interiorTextures.ts` (`switchboard`),
`web/src/game/FactoryScene.ts`, `README.md`, `CLAUDE.md`, `docs-dev/context/fabrica-plugins-e-mcp.md` (saiu de
`a-codar/`).
**Testes:** 117/117 antes, 121/121 depois; typecheck do servidor e build sem erro. Prévia da arte em PNG conferida.
Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-02 — Torre do relógio no lugar do painel "Uso do Claude"

**O que mudou:** primeiro dos planos da parte de cima da vila (usuário: "segue as recomendações", do mais simples ao mais
complexo). A torre fica entre a biblioteca e a praça: ponteiro = sessão de 5h (uma volta = limite), céu do campanário =
semana (manhã, dia, tarde, noite em faixas de 25%), sino dourado/amarelo/vermelho pelo pior limite (balança no vermelho).
Clique abre os limites num painel; o painel fixo do canto inferior esquerdo saiu (e o CSS dele). Para caber torre, banca e
moinho, a linha cívica ganhou largura mínima de 5 lotes; casas ficam centralizadas quando a linha é mais estreita, e o
desempate das colunas passou a contar os lotes vazios na largura real (com 5 casas em tela larga continua uma linha só;
em 1366×768 vira 3 + 2 em vez de 4 + 1). Lotes da banca e do moinho já reservados.
**Arquivos:** `web/src/game/torre.ts` (novo), `web/src/game/textures.ts` (`clockTower`, `TOWER`), `web/src/game/TownScene.ts`
(`buildTower`, `updateTower`), `web/src/game/layout.ts` (`CIVIC_MIN_W`, `clockTower`, `newsstand`, `windmill`),
`web/src/ui/usage.ts` (`openUsage`), `web/src/ui/actions.ts`, `web/src/main.ts`, `web/src/style.css`,
`web/tests/torre.test.ts` (novo, 5 testes), `web/tests/layout.test.ts` (2 testes novos), `README.md`,
`docs-dev/context/torre-do-relogio.md` (saiu de `a-codar/`).
**Testes:** 110/110 antes, 117/117 depois; typecheck do servidor e build sem erro. Prévia da arte em PNG conferida (4
estados). Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-02 — Planos para preencher a parte de cima da vila

**O que mudou:** só documentação, nenhum código. A faixa da biblioteca, da praça e da Fábrica estava vazia. Das 6 ideias
discutidas, o usuário aprovou 4, que viraram planos em `docs-dev/a-codar/`: torre do relógio (os limites do plano, no
lugar do painel do canto), moinho (gasto de token por projeto), banca de jornal (o que mudou desde ontem, em linguagem
humana, por um agente jornaleiro) e plugins e MCP dentro da Fábrica. Ficaram de fora a prefeitura (repetia o quadro de
avisos da praça, que já junta as decisões 👤 de todos os projetos) e o cemitério de sessões órfãs (o Claude Code já apaga
as conversas antigas). Cada plano tem as decisões em aberto, com recomendação; elas estão no `PENDENCIAS.md` (VC-1 a VC-4).
**Arquivos:** `PENDENCIAS.md` (os quatro planos já foram codados e estão em `docs-dev/context/`).
**Testes:** não se aplica (sem código); auditor de referências rodado.

## 2026-11-02 — Morador do Claude veste tons quentes, do DeepSeek tons frios

**O que mudou:** pedido do usuário: diferenciar sessões do Claude e do DeepSeek só pela roupa. Cada sessão recebe o
`perfil` pela pasta da conversa (o mesmo critério do terminal, `perfilDe`); profissional (Claude) veste a paleta quente
(laranja da Anthropic: coral, laranja, vermelho, âmbar; calças marrom/ferrugem) e pessoal (DeepSeek) a fria (azul do
DeepSeek, azuis, turquesa, ardósia; calças marinho/petróleo). Vale para camisa, calça, jaqueta, acessório (boné, gorro,
faixa, laço, fitas) e lenço; a fita do chapéu de palha passou a usar a cor do acessório. Pele, cabelo, olhos e penteado
não mudam: o sorteio faz as mesmas chamadas, só a lista de cores muda. Peças neutras (avental, cinto, sapato, palha)
ficaram como estavam. Agentes ✦ seguem de preto (regra 8). Efeito colateral esperado: as roupas de todos os moradores
mudam uma vez, porque as listas de cores mudaram.
**Arquivos:** `web/src/game/villagerArt.ts` (`QUENTE`, `FRIA`, `paletaDo`, `lookFor(id, genero, perfil)`),
`web/src/game/villager.ts`, `web/src/game/common.ts`, `web/src/api.ts`, `server/src/world.ts` (`perfil` na sessão),
`scripts/previa-moradores.ts` (4º argumento `pessoal`), `web/tests/villager-art.test.ts` (4 testes novos).
**Testes:** 106/106 antes (último registro do dia, não rodado de novo antes de mexer), 110/110 depois; typecheck do servidor e build sem erro; auditor só com os 2 avisos
informativos antigos. Prévia em PNG dos dois perfis conferida. Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-02 — Vila ocupa a tela toda na visão geral

**O que mudou:** com a 5ª casa a vila ia para 4 + 1 e ficava "quadrada" numa tela larga: o zoom enquadrava pela altura,
a câmera encostava na esquerda e sobrava uma faixa vazia à direita, mais três lotes vazios. Agora (pedido do usuário):
(1) casas por linha escolhidas pelo formato da tela, a que ocupa mais tela no zoom de visão geral (5 casas numa tela
larga = uma linha de 5); (2) linha incompleta centralizada, com a estrada que desce até ela sempre no vão entre dois
lotes; (3) floresta extra em volta até a borda da tela, com a vila no centro, sem fundo vazio. O zoom inicial vem do
layout. A vila é montada para o tamanho da janela no momento em que a lista de casas muda (redimensionar a janela não
remonta).
**Arquivos:** `web/src/game/layout.ts` (`chooseCols`, `fitZoom`, `village`, `zoom`), `web/src/game/TownScene.ts`
(tamanho da tela no layout, floresta na faixa extra, zoom); `web/tests/layout.test.ts` (novo).
**Testes:** 101/101 antes, 106/106 depois; typecheck e build sem erro; auditor só com os 2 avisos informativos antigos.
Mapa conferido em texto para 5 casas (1920×1000) e 7 casas (1200×1000). Conferido na vila pelo usuário em 20/11/2026.

## 2026-11-01 — Perfil pessoal: projeto pessoal abre o terminal com outra API (DeepSeek)

**O que mudou:** projeto dentro das pastas `perfilPessoal.roots` (config local) é pessoal: o terminal abre com
`CLAUDE_CONFIG_DIR` do perfil pessoal, que manda as chamadas para o DeepSeek, e não abre se o perfil está sem endereço
de API ou sem chave (trava para nunca gastar a licença do trabalho). A vila lê e apaga conversas nos dois perfis, a
placa da casa diz "· pessoal", e o `hooks:install` instala mod, hooks e agentes nos dois perfis. Os agentes da vila
seguem como Claude. Fora do repositório: perfil pessoal criado com as mesmas regras (`instalar.sh` do repositório de
regras) e troca de modelo pelo `/model` (rápido como padrão, forte no `opus`), testada com a chave do usuário.
Decisões e funcionamento em `docs-dev/context/perfil-pessoal.md`.
**Arquivos:** `server/src/perfil.ts` (novo), `config.ts`, `world.ts`, `sessions.ts`, `terminals.ts`, `index.ts`,
`install-hooks.ts`; `web/src/api.ts`, `web/src/game/TownScene.ts`; `server/tests/perfil.test.ts` (novo),
`server/tests/servidor.ts`.
**Testes:** 96/96 antes, 101/101 depois; typecheck do servidor e build sem erro; auditor só com os 2 avisos informativos
que já existiam. Conferido na vila pelo usuário em 01/11/2026: casa "· pessoal" e terminal no DeepSeek.

## 2026-11-01 — Fábrica sem as bolinhas de fumaça paradas

**O que mudou:** saíram os dois discos de fumaça desenhados na textura da Fábrica, em cima da chaminé: ficavam
parados e destoavam da fumaça animada que a `TownScene` já solta ali. Pedido do usuário.
**Arquivos:** `web/src/game/textures.ts` (`factory`).
**Testes:** typecheck do front sem erro (a textura não tem teste). Conferido na vila pelo usuário em 20/11/2026.
