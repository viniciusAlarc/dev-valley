# Dev Valley — Progresso

> Memória oficial do projeto (guardrail G5). Toda mudança de código entra aqui,
> na mesma resposta que a produziu. Mais recente no topo.

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

## 2026-10-31 — Retrabalho vira lixeira dentro da casa e o pombal encosta na casa

**O que mudou:** as ervas daninhas do quintal (uma por linha do `RETRABALHO.md`) saíram: ficavam em posição de
destaque demais e empurravam o pombal para longe. No lugar, uma lixeira de vime no canto de baixo à direita da sala,
encostada na parede da porta, com uma bolinha de papel por retrabalho: cinco dentro (três no fundo, duas por cima) e
até mais quatro transbordando no chão. Mesmo clique de antes (abre a tabela do `RETRABALHO.md`); como as outras peças
de arquivo, só aparece se o projeto tem o arquivo. O pombal passou de x+76 para x+50 (colado à direita da casa) e as
12 cartas foram redistribuídas em volta dele, à esquerda do poste só abaixo da linha da casa para nenhuma ficar atrás
da parede. Pedido do usuário.
**Arquivos:** `web/src/game/TownScene.ts` (sem `growWeeds`; `POMBAL_DX`, `POMBAL_LETTER_SLOTS`),
`web/src/game/InteriorScene.ts` (`fillTrash`), `web/src/game/interiorTextures.ts` (`trashCan`, `paperBall`),
`web/src/game/textures.ts` (sem `weed`), textos em `web/src/ui/retrabalho.ts`, `README.md` e
`docs-dev/context/ambiente-de-ia-na-vila.md`.
**Testes:** `npm test` 96/96 antes e depois, typecheck do servidor e do front e `vite build` (diretório temporário) sem
erro, auditor só com os 2 avisos informativos que já existiam. Conferido na vila pelo usuário em 20/11/2026.

## 2026-10-31 — Casas refinadas sem mudar o desenho

**O que mudou:** acabamento sutil nas casas, como foi feito na Fábrica: mesma forma, cores, tamanho e posições
(brilho das janelas, fumaça, andaime, "!"). Telhado com juntas de telha desencontradas nas faixas, brilho na cumeeira e
beiral com filete; chaminé com tijolos marcados e chapéu com brilho; parede com emendas das tábuas desencontradas, filete
claro em cada tábua, esteios com meio-tom e sombra do beiral; janelas com reflexo extra e peitoril com brilho; porta com
almofadas, quina clara e maçaneta com brilho; fundação de pedra com rejunte e soleira na frente da porta. Pedido do
usuário depois de desistir das fachadas novas por referência.
**Arquivos:** `web/src/game/textures.ts` (`roof`, `window_`, `planks`, `house`).
**Testes:** `npm test` 96/96, typecheck do servidor e `tsc` + `vite build` do front (diretório temporário) sem erro,
auditor só com os 2 avisos informativos que já existiam. Antes e depois conferidos em prévia PNG (gerada das próprias
funções do `textures.ts`). Conferido na vila pelo usuário em 31/10/2026.

## 2026-10-31 — Placa de vistoria fincada no quintal da frente

**O que mudou:** a placa de vistoria saiu da parede (embaixo da janela da esquerda) e virou uma tabuleta numa estaca no
quintal da frente, à esquerda do caminho da porta, acima do letreiro do nome, para a fachada aparecer inteira (pedido
do usuário). Cores, tooltip e clique (entra na casa) iguais. Duas tentativas de fachada nova, a partir de imagens de
referência do usuário, foram desfeitas a pedido dele antes do commit: a casa segue com o desenho original.
**Arquivos:** `web/src/game/textures.ts` (`plaque` com estaca), `web/src/game/TownScene.ts` (posição), `README.md`.
**Testes:** `npm test` 96/96, typecheck do servidor e `tsc` + `vite build` do front (diretório temporário) sem erro,
auditor só com os 2 avisos informativos que já existiam. Placa conferida em prévia PNG; a posição foi medida (moita,
caminho e letreiro), não renderizada. Conferido na vila pelo usuário em 31/10/2026.

## 2026-10-31 — Pombal: o pombo chega voando quando o time manda coisa nova

**O que mudou:** quando a busca do remoto (a cada 5 min ou ao abrir o pombal) descobre commits a receber, o pombo entra
pela direita batendo asa, com a carta no bico, e desce até o telhado do pombal; lá vira o pombo parado de sempre, à
espera do "Trazer". Decisões do usuário (31/10/2026): ao abrir ou recarregar a vila com carta já esperando, ele já está
pousado (sem animação); com ele pousado, commit novo não repete a chegada; com painel aberto, chega quando fechar. Se o
motivo some no meio do voo (pull feito, erro), a chegada é cancelada. O bater de asa virou `baterAsa`, usado também no
envio.
**Arquivos:** `web/src/game/TownScene.ts` (`pousarPombo`, `chegarPombo`, `baterAsa`).
**Testes:** `npm test` 96/96 e typecheck do servidor sem erro; `TownScene.ts` sem erro de tipo. O build do front não
fechou por trabalho em andamento de outra sessão (`textures.ts` importa `./houseArt`, ainda inexistente; depois fechou).
Teste com repositório de mentira (remoto falso local): o pombo apareceu pousado após reiniciar a vila (a busca roda ao
subir, e o primeiro estado não anima), mas a chegada voando não foi vista. O usuário considerou funcionando e vai
observar no uso (31/10/2026).

## 2026-10-31 — Estante da casa abre o leitor da biblioteca, só com o projeto

**O que mudou:** pedido do usuário (a estante da casa e as da biblioteca faziam coisas diferentes, quebrando a imersão).
Clicar na estante da casa abre o mesmo painel da biblioteca (árvore de pastas, leitor, edição, VS Code), com título
"Estante — <projeto>" e só a seção `project:<id>`: busca e links entre documentos ficam no projeto, e a bibliotecária
não aparece (ela mora na biblioteca). A busca ganhou `?section=` no servidor, para o limite de 100 achados não esconder
os do projeto. O painel antigo (`web/src/ui/estante.ts`, só `docs-dev/context/`) saiu. Os livros desenhados na estante
continuam contando `docs-dev/context/`; a rota `/api/estante` ficou sem uso no front.
**Arquivos:** `web/src/ui/library.ts` (`openLibrary({ project })`), `web/src/ui/actions.ts`, `web/src/game/InteriorScene.ts`
(dica da estante), `server/src/library.ts` e `server/src/app.ts` (busca por seção), `web/src/api.ts` (`library.search`),
`server/tests/rotas-fabrica-biblioteca.test.ts`, `README.md`.
**Testes:** `npm test` 96/96, typecheck do servidor e build sem erro. Conferido na vila pelo usuário em 20/11/2026.

## 2026-10-31 — Pombal: o pombo recolhe as cartas e voa no envio

**O que mudou:** depois de um push, as cartas que foram não somem mais de uma vez do chão. O pombo sai do pombal, pula de
carta em carta (cada uma encolhe quando ele chega) e voa para a direita, batendo asa, até sair da tela. Decisões do
usuário (31/10/2026): só o push **feito pela vila** vira voo (`api.voar('enviar')` sem erro marca o projeto por 2 min,
`tomarEnvio`); descarte e push pelo terminal seguem sumindo direto. Com painel aberto (ele tapa o quintal), as cartas
esperam no chão e o voo começa quando o painel fecha. Push parcial leva só as cartas que foram. Durante o voo, a
atualização do mundo não redesenha as cartas; no fim, cartas e pombal voltam a seguir o mundo. Pombo ganhou três
quadros: sem carta, com carta e com carta de asa levantada.
**Arquivos:** `web/src/game/TownScene.ts` (`voarPombo`, `PombalView`), `web/src/game/textures.ts` (`pigeon`),
`web/src/api.ts` (`tomarEnvio`).
**Testes:** `npm test` 96/96, typecheck do servidor e build sem erro. Front sem teste automático: Conferido na vila pelo usuário em 20/11/2026.

## 2026-10-31 — Moradores variados e com a aparência combinando com o nome

**O que mudou:** plano `docs-dev/context/moradores-variados.md` (decisões do usuário em 31/10/2026).
1. **Arte sem Phaser:** o desenho dos moradores saiu de `web/src/game/villager.ts` para `villagerArt.ts` (o `villager.ts`
   só registra a textura no jogo); `hash` e `mulberry32` foram para `hash.ts` (o `textures.ts` reexporta). Assim a arte
   roda no Node.
2. **Prévia em PNG sem navegador:** `scripts/previa-moradores.ts` desenha com a mesma arte num canvas de mentira e grava
   PNG pelo `zlib`. `catalogo` mostra cada penteado, roupa e acessório sobre o mesmo morador; um número sorteia moradores
   alternando a marca do nome (f, m, neutro), com os agentes na última linha.
3. **Nome marcado (ponto 1):** `generoDoNome` em `server/src/moradores.ts` (36 femininos, 37 masculinos; ambíguos como
   Rafa, Duda e Gabi ficam neutros; "Ana2" usa a marca de "Ana"). A sessão leva `genero` no mundo e o sorteio respeita:
   penteados de cada lista, barba e bigode nunca em nome feminino, vestido e laço nunca em masculino; neutro pode tudo.
4. **Mais variedade (ponto 2):** penteados novos (raspado, cacheado com textura, rabo de cavalo, tranças, franja de
   lado), roupas novas (moletom com capuz, jaqueta aberta, avental, suéter, xadrez, vestido), acessórios de cabeça
   (boné, gorro com pompom, faixa, laço, além do chapéu de palha), óculos de grau (armação colorida, nunca escuros: são
   dos agentes), lenço, barba e bigode (no tom escuro do cabelo, para aparecer em cabelo claro). O sorteio passou a usar
   `mulberry32(hash(id))`: todos os moradores trocaram de visual (decisão do usuário); o nome continua. Agentes iguais.
   Na prévia, o cacheado ganhou contorno ondulado e textura e o boné, aba larga e costura, para não parecer gorro.
**Arquivos:** `web/src/game/villagerArt.ts` (novo), `web/src/game/hash.ts` (novo), `web/src/game/villager.ts`,
`web/src/game/textures.ts`, `web/src/game/common.ts`, `web/src/api.ts`, `server/src/moradores.ts`, `server/src/world.ts`,
`scripts/previa-moradores.ts` (novo), `server/tests/moradores.test.ts` (novo), `web/tests/villager-art.test.ts` (novo),
`server/tests/servidor.ts`, `CLAUDE.md` (regra 7 e comando da prévia), `docs-dev/context/moradores-variados.md`,
`docs-dev/painel.json`.
**Testes:** `npm test` 96/96 (8 novos: a marca respeitada em 600 sorteios por marca, chapéu sem penteado alto, vestido
com pernas na cor da pele, agente sem acessório, `generoDoNome`); liberando barba para nome feminino, o teste falha
(código restaurado). Em 3.000 sorteios: masculino com barba ou bigode 33%, óculos 20%, vestido 9% e laço 7% em
feminino. Typecheck, build do front e auditor sem erro; mod 10/10. Conferido na vila pelo usuário em 31/10/2026 ("bem
melhor"). Plano fechado: saiu de `docs-dev/a-codar/` para `docs-dev/context/moradores-variados.md`.

## 2026-10-31 — PD-10 (permitir/negar pelo balão) descartada

**O que mudou:** decisão do usuário (31/10/2026). Ganho só de UX, sem ganho de desempenho: a sessão espera a resposta do
mesmo jeito, e o atalho acrescentaria um hook esperando a vila, mais dados indo à vila (o comando pedido, contra a regra
3) e um ponto de falha com a vila fechada. E abrir a conversa quando aparece o "!" faz o usuário se recontextualizar,
o que importa com várias sessões trabalhando: aprovar pelo balão, sem ver o que veio antes, levaria a aprovar sem
entender. O fluxo atual ("!" no morador, resposta no terminal) fica. Com isso o `PENDENCIAS.md` ficou sem item aberto.
**Arquivos:** `PENDENCIAS.md`.
**Testes:** não se aplica (sem código).

## 2026-10-30 — NPCs conversando: os dois ficam juntos enquanto o citado responde

**O que mudou:** ajuste pedido pelo usuário depois de conferir na vila: a sessão A foi até a B, mas quando a B começou a
responder, a A virou as costas e saiu, e a B ficou falando sozinha. Causa: a conversa fechava no `Stop` de quem citou, e
o turno da A termina justamente quando ela manda a mensagem para a B. Regra nova (`conversaAtiva` em
`server/src/hooks.ts`): a conversa A → B segue enquanto a A trabalha (limite de 10 min), enquanto a B responde (começou a
trabalhar depois da citação) e, entre uma e outra, até 20 s depois de a A terminar, esperando a B começar. A B
terminando, a conversa fecha e não reabre se a B trabalhar de novo depois. Citado que já trabalhava antes da citação não
segura a conversa. O `HookStore` ganhou `paradoEm` e `trabalhandoDesde` por sessão; a vila não mudou.
**Arquivos:** `server/src/hooks.ts`, `server/tests/hooks.test.ts`, `docs-dev/context/npcs-conversando.md`.
**Testes:** `npm test` 88/88; testes da conversa reescritos com relógio falso, incluindo o caso visto pelo usuário (a B
responde 3 min: os dois juntos até o `Stop` da B). Com a condição "o citado está respondendo" desligada, esse teste
falha; código restaurado. Typecheck sem erro. Conferido na vila pelo usuário em 31/10/2026. Com isso o plano fechou:
saiu de `docs-dev/a-codar/` para `docs-dev/context/npcs-conversando.md` e as fases do painel ficaram feitas.

## 2026-10-30 — NPCs conversando: quem cita @Nome vai até o citado

**O que mudou:** plano `docs-dev/context/npcs-conversando.md` (decisões do usuário em 30/10/2026), passos 1 a 4.
1. **Mod (0.2.0):** junto do `UserPromptSubmit`, manda à vila `citados`: os ids das sessões citadas com `@Nome` que estão
   no mapa (`idsCitados`), sem a própria e nunca o texto nem o nome digitado. **Regra 3 ampliada** no `CLAUDE.md` e no
   `README.md`. Versão subiu para o `claude plugin update` trazer a mudança (o mod instalado é cópia, em
   `~/.claude/plugins/cache/dev-valley/`).
2. **Servidor:** cada estado do `HookStore` tem `citados`: abre na mensagem que cita, segue durante as ferramentas,
   fecha no `Stop`, numa mensagem sem citação ou em 10 min. Só ids válidos, sem repetir, sem a própria, até 5.
   `World.conversas` (`{ de, para }`) só entre sessões da vila.
3. **Vila (`TownScene`):** quem citou para de passear, anda em linha reta até ficar a 16 px do citado (que também para),
   os dois se viram e um balão de conversa (textura `talk`, dois balõezinhos) balança acima deles, 54 px acima dos pés,
   para ficar por cima do "..." de quem está trabalhando. Ao terminar, o balão some e cada um volta a passear.
4. **Dentro da casa (`InteriorScene`):** quando os dois moram nela e aparecem na sala, quem citou levanta (`standUp`, o
   inverso de `sit`) e vai até o outro; ao terminar volta ao lugar e senta de novo (ou volta a passear). O balanço de
   digitação e o passeio pausam durante a visita.
5. **Prévia `web/sprites.html`:** linha nova com dois moradores conversando, com e sem o "...", nas medidas da vila
   (`CONVERSA_DX` e `TALK_Y` em `common.ts`, usados pelas duas cenas).
Parte disto (passos 1 e 2, mais o começo do 3) foi enviada ao GitHub às 22:16 pelo pombal no meio da entrega
(`b491534`), sem o ajuste em `server/tests/servidor.ts`: o CI daquele commit fica vermelho no typecheck; este commit
corrige.
**Arquivos:** `mod/hooks/moradores.ts`, `mod/hooks/register.ts`, `mod/tests/dev-valley.test.ts`,
`mod/.claude-plugin/plugin.json`, `server/src/hooks.ts`, `server/src/world.ts`, `server/src/index.ts`,
`server/tests/hooks.test.ts` (novo), `server/tests/servidor.ts`, `web/src/api.ts`, `web/src/game/TownScene.ts`,
`web/src/game/InteriorScene.ts`, `web/src/game/common.ts`, `web/src/game/textures.ts`, `web/src/sprites.ts`,
`CLAUDE.md`, `README.md`, `docs-dev/context/npcs-conversando.md`, `docs-dev/painel.json`.
**Testes:** `npm test` 85/85 (5 novos do `HookStore`: abrir, manter, fechar, validar ids, expirar em 10 min com relógio
falso); `claude plugin test mod` 10/10 (`idsCitados`; corpo com `@Vera` leva só `citados: ['aaaa']`, sem o nome nem o
texto; mensagem sem `@Nome` não manda `citados`); typecheck do servidor e build do front sem erro; auditor sem achado.
Conferido na vila pelo usuário em 30/10/2026, com um ajuste: quem citou ia embora quando o citado começava a responder
(entrega seguinte).

## 2026-10-30 — PD-6 (tileset) descartada

**O que mudou:** levantamento da troca da pixel art por um tileset: ~80 desenhos em código, metade sem equivalente em
tileset nenhum (pombal, lareira, quadro negro, sementes, ervas, andaime, outdoor, sino) e moradores sorteados com o traje
de agente da regra 8, então a troca seria só parcial. Licenças conferidas: Kenney Tiny Town e Ninja Adventure são CC0;
Sprout Lands, o mais parecido com Stardew, proíbe redistribuir (não pode ir para o repositório público). Decisão do
usuário (30/10/2026): gosta do visual atual, a PD-6 sai; a pixel art em código segue como decisão do projeto (regra 7).
Saiu do `PENDENCIAS.md` e do painel.
**Arquivos:** `PENDENCIAS.md`, `docs-dev/painel.json`.
**Testes:** não se aplica (sem código).

## 2026-10-29 — Testes no CI do GitHub; plano de testes fechado (PD-8)

**O que mudou:** passo 4 (último) do plano `docs-dev/context/testes-automatizados.md`, por decisão do usuário. O
workflow `.github/workflows/auditor.yml` (agora "CI (auditor e testes)") ganhou o job `testes`: Node 24 com cache do
npm, `npm ci` (o `node-pty` compila código nativo no runner), `npm run typecheck -w server` e `npm test`. GitHub Actions
é gratuito em repositório público. Com isso o plano fechou: saiu de `docs-dev/a-codar/` para `docs-dev/context/`, a
PD-8 saiu do `PENDENCIAS.md` e a fase do painel foi marcada como feita. Próxima, pela ordem do usuário: PD-6 (tileset).
**Arquivos:** `.github/workflows/auditor.yml`, `docs-dev/context/testes-automatizados.md` (movido), `PENDENCIAS.md`,
`docs-dev/painel.json`, `CLAUDE.md`.
**Testes:** simulação do runner numa cópia limpa do repositório, sem o config local: `npm ci` (com a compilação do
`node-pty`), typecheck sem erro e `npm test` 80/80 com `HOME` vazio. O workflow em si só roda no primeiro push (o push é
do usuário). Auditor sem achado.

## 2026-10-29 — Testes automatizados, passo 3: pombal com git de verdade (PD-8)

**O que mudou:** passo 3 do plano `docs-dev/context/testes-automatizados.md`. `server/tests/pombal.test.ts` monta, numa
pasta temporária, um remoto (`--bare`, o papel do GitHub) e dois clones: `eu`, onde o pombal age, e `colega`, que manda
commits do time. Sem rede. O git do processo de teste não lê o `~/.gitconfig` do usuário (`GIT_CONFIG_GLOBAL=/dev/null`)
e tem autor fixo. 13 testes:
1. `readPombal`, `buscar` e `cartas`: arquivos só seus, commits a receber depois de buscar, remoto inacessível vira
   `falhaBusca` sem "!".
2. `enviar`: commit, rebase e push com o remoto ficando com os dois commits; só os arquivos escolhidos vão; sem
   mensagem recusa antes de sair, sem marcar erro; sem upstream só commita.
3. **Regra 9:** conflito no rebase termina em `rebase --abort`: commit local preservado, nenhum rebase em andamento,
   pasta limpa, remoto intacto e "!" no pombal, que some quando o HEAD sai daquele commit.
4. `receber`: traz o que chegou mantendo alteração sem commit (autostash); alteração que conflita fica no stash.
5. Dois cliques: a segunda viagem é recusada enquanto a primeira voa.
6. `/api/pombal` com o pombal de verdade: GET lista as cartas, POST entrega no remoto, conflito responde 409.
O "nunca `--force`" da regra 9 ficou sem teste: depois do rebase o push é sempre fast-forward, com ou sem `--force`.
**Arquivos:** `server/tests/pombal.test.ts` (novo), `CLAUDE.md`, `docs-dev/context/testes-automatizados.md`,
`PENDENCIAS.md`, `docs-dev/painel.json`.
**Testes:** `npm test` 80/80 em 5 s. Prova de que pegam bug: sem o `rebase --abort`, com o commit ignorando os arquivos
escolhidos e sem a checagem do stash, 3 testes falharam; `pombal.ts` restaurado (por `trap`, garantido mesmo se o teste
travasse) e 80/80 de novo. Typecheck sem erro, auditor sem achado. Só testes mudaram: nada a conferir na vila.

## 2026-10-29 — Testes automatizados, passo 2 fechado: as 37 rotas HTTP com teste (PD-8)

**O que mudou:** as 22 rotas que faltavam no passo 2 do plano `docs-dev/context/testes-automatizados.md`.
1. **Fábrica e biblioteca com as classes de verdade** (`server/tests/rotas-fabrica-biblioteca.test.ts`): quem recusa
   caminho de fora é a classe (`Agents`, `Skills`, `Library`), então imitá-la não testaria a trava (G9). Elas calculam
   `~/.claude` e o catálogo ao carregar o módulo: o arquivo troca o `HOME` por uma pasta temporária antes do `import`,
   confere que os caminhos caíram nela antes de qualquer escrita e apaga a pasta no fim. Cobre criar, ler, salvar
   (409 quando mudou no disco) e apagar agente e skill; fora das pastas, 404 e o arquivo intacto; cópia instalada do
   agente da vila e skill por link, 403; conversa com agente da vila, 403; estantes, busca, catálogo, ler, HTML
   isolado, salvar e abrir no VS Code só para livro da varredura (`.env` e caminho de fora, 404).
2. **Rotas que só repassam ao serviço**, com imitação (`rotas.test.ts`): `world`, `hooks` (sessão interna ignorada),
   `moradores/nome` (id que não é de sessão, 400), `statusline` e `statusline/last`, e as consultas da bibliotecária e
   do administrador (NDJSON, uma linha por evento; pergunta vazia não consulta o Claude).
3. **`subir()` com limite de 5 s por requisição:** erro dentro de rota `async` o Express 4 não captura, e a imitação
   proibida travava a suíte em vez de falhar (achado ao estragar a checagem do id de sessão; ver `RETRABALHO.md`).
**Arquivos:** `server/tests/rotas-fabrica-biblioteca.test.ts` (novo), `server/tests/rotas.test.ts`,
`server/tests/servidor.ts`, `CLAUDE.md`, `docs-dev/context/testes-automatizados.md`, `PENDENCIAS.md`,
`docs-dev/painel.json`, `RETRABALHO.md`.
**Testes:** `npm test` 67/67 em 1,5 s. Prova de que pegam bug: agente aceito fora da pasta de agentes, skill por link
apagável e id de sessão sem checagem fizeram 3 testes falharem; código restaurado e 67/67 de novo. Nenhum arquivo em
`~/.claude` criado pelos testes (conferido). Typecheck sem erro, auditor sem achado. Só testes mudaram: nada a conferir
na vila.

## 2026-10-29 — Testes automatizados, passo 2 (parte 1): rotas HTTP testáveis, 15 das 37 com teste (PD-8)

**O que mudou:** passo 2 do plano `docs-dev/context/testes-automatizados.md` (G11: sucesso e entrada inválida por rota;
G9: fora do projeto responde igual a inexistente).
1. **Rotas saíram do `index.ts` para `server/src/app.ts`**, em `criarApp(ctx)`. Código movido sem mudar a lógica
   (conferido com `diff` das rotas antes e depois, sem indentação: só `world` → `ctx.world()` e os efeitos externos
   vindo do `ctx`). Tudo que age fora da pasta do projeto chega pelo `Contexto`: terminais, lareira, hooks, biblioteca,
   moradores, agentes, skills, consultas ao Claude, apagar conversa e abrir o VS Code. O `index.ts` ficou com os
   serviços de verdade, os WebSockets e o `listen`.
2. **`subir()` em `server/tests/servidor.ts`:** sobe o `app` numa porta livre de 127.0.0.1 com mundo de mentira. Toda
   imitação que o teste não preparou falha alto se for chamada, para nenhum teste agir na vila de verdade.
3. **18 testes novos em `server/tests/rotas.test.ts`**, nas rotas que recebem caminho ou projeto do navegador:
   `/api/arquivo` (o mesmo 404 para fora, com ponto, inexistente e relativo), `/api/progress`, `/api/progress/conferir`
   (página de fora: 403 e arquivo intacto), `/api/quadro`, `/api/estante`, `/api/diff` (repositório git de mentira),
   `/api/open-vscode`, `/api/pombal/sugerir`, `/api/pombal` (só entrada inválida; o sucesso é do passo 3),
   `/api/lareira/acender` e `/apagar`, `/api/library/claude-md`, `POST` e `DELETE /api/sessions`.
**Arquivos:** `server/src/app.ts` (novo), `server/src/index.ts`, `server/tests/servidor.ts` (novo),
`server/tests/rotas.test.ts` (novo), `CLAUDE.md`, `docs-dev/context/testes-automatizados.md`, `PENDENCIAS.md`,
`docs-dev/painel.json`.
**Testes:** `npm test` 52/52. Prova de que pegam bug: sem a trava de origem no conferir, com o `safeRelative` aceitando
qualquer caminho e apagando sessão aberta fora da vila, 6 testes falharam; código restaurado e 52/52 de novo.
`npm run typecheck -w server` sem erro (testes incluídos), auditor sem achado; o front não mudou (sem build). O
`index.ts` montando o `app` de verdade não foi rodado (o reinício é do usuário, regra 6). Conferido na vila pelo usuário
em 29/10/2026, depois do reinício: a vila sobe, abre terminal, abre o diário da casa e um link de arquivo.
**Aberto:** faltam 22 rotas no passo 2 (`world`, `hooks`, `moradores/nome`, `agents`, `skills`, `librarian`,
`administrador`, `statusline` e o resto de `library`).

## 2026-10-29 — Testes automatizados, passo 1: leitores, lareira e travas de segurança (PD-8)

**O que mudou:** passo 1 do plano `docs-dev/context/testes-automatizados.md` (decisões do usuário em 29/10/2026:
`node:test` + `tsx`, sem dependência nova; só local, sem CI por enquanto). `npm test` na raiz roda 34 testes:
1. **Leitores** dos arquivos de acompanhamento: `readPendencias` (emoji no título, P6, colunas pelo cabeçalho, item
   riscado ou com ✅), `readProgress`/`summarizeProgress`/`markChecked` (frase citada entre aspas não conta, parêntese
   quebrado em duas linhas), `readPainel`, `readRetrabalho`, `missingStructure`, `readAuditoria` e `readLareira` (pipe
   escapado, pasta fora do projeto, porta inválida).
2. **Estado da lareira** (`estadoLareira`, front): os 7 casos da tabela do plano da lareira.
3. **Travas de segurança:** `isLocalOrigin` e a checagem do `/api/arquivo` saíram do `index.ts` para
   `server/src/seguranca.ts` (`arquivoPermitido`), sem mudar o comportamento. Testes: pasta vizinha com o mesmo começo de
   nome, arquivo com ponto em qualquer nível (`.env`, `.git/config`), link simbólico para fora.
Cada teste cria o projeto de mentira numa pasta temporária (`projeto()` em `server/tests/util.ts`). Os testes do
servidor entram no `npm run typecheck -w server`; o do front roda, mas fica fora do `tsc` do `web` (sem tipos do Node lá).
**Arquivos:** `server/src/seguranca.ts` (novo), `server/src/index.ts`, `server/tests/` (novo), `web/tests/` (novo),
`package.json` (`test`), `server/tsconfig.json`, `CLAUDE.md` (comando e gate), `docs-dev/context/testes-automatizados.md`
(novo), `PENDENCIAS.md`, `docs-dev/painel.json`.
**Testes:** `npm test` 34/34. Prova de que pegam bug: três estragos de propósito (sem a trava do ponto, sem o separador
de pasta na comparação, item riscado contando) fizeram 3 testes falharem; código restaurado e 34/34 de novo.
`npm run typecheck -w server` e `tsc` + `vite build` (pasta temporária) sem erro, auditor sem achado. Conferido na vila
pelo usuário em 29/10/2026: o `/api/arquivo` e os WebSockets usam as funções extraídas; o link de arquivo abriu no
terminal da vila.
**Aberto:** comparado com as regras de teste do `~/.claude/CLAUDE.md`, o passo 1 cobre G4 mas não G11 (teste de sucesso
e de entrada inválida por rota) nem o 404 do G9 conferido na resposta. Por decisão do usuário (29/10/2026), entrou no
plano o passo 2 "Rotas HTTP"; o pombal passou a ser o passo 3 e o CI o 4.

## 2026-10-29 — Biblioteca mostra arquivos HTML, além de markdown

**O que mudou:** pedido do usuário (29/10/2026): o leitor da biblioteca mostra também `.html`.
1. A varredura das estantes aceita `.html`/`.htm` além de `.md`/`.mdx`. Na estante o HTML aparece com 🌐.
2. O leitor abre o HTML num iframe isolado (`sandbox` sem `allow-same-origin`, igual à estante da casa): o script do
   documento não alcança a vila nem os terminais. Rota nova `GET /api/library/html`, só para arquivo que a varredura
   listou. "Editar" abre o Monaco com realce de HTML; depois de salvar, o iframe recarrega.
3. Catálogo da bibliotecária: o título do HTML vem do `<title>`.
4. Ficaram de fora outros formatos (`.json`, `.txt`…): encheriam as estantes de `package.json` e afins.
**Arquivos:** `server/src/library.ts`, `server/src/index.ts`, `server/src/catalog.ts`, `web/src/ui/library.ts`,
`web/src/style.css`, `README.md`.
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Acervo de teste no scratchpad: a
varredura listou o `.md` e o `.html` e ignorou o `.json`; a rota recusa `.md` e arquivo fora da biblioteca; o catálogo
saiu com o título do `<title>`. Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-29 — Sino marca entregas como conferidas pelas caixinhas, sem passar pelo administrador

**O que mudou:** pedido do usuário (29/10/2026): o sino deixa de ser só leitura (decisão de 26/10/2026 revista).
1. Cada entrega do painel do sino tem uma caixinha; o botão "Marcar como conferidas" grava as marcadas.
2. Faz **só** o passo mecânico do administrador: no `PROGRESS.md`, "Falta conferir na vila" (e o parêntese que vem
   junto, como "(reinício do usuário)", mesmo quebrado em duas linhas) vira "Conferido na vila pelo usuário em
   DD/MM/AAAA". Frase citada entre aspas ou crases não muda. Plano em `a-codar/` e pendência continuam com a sessão ou
   o administrador (decisão do usuário): quando o projeto tem plano que ainda diz "falta conferir na vila", o sino
   avisa embaixo da lista.
3. Rota `POST /api/progress/conferir`: só pedido de página local, e só entrega que o sino lista.
4. O painel se atualiza sozinho depois de gravar, e não perde as caixinhas marcadas quando chega evento de sessão.
**Arquivos:** `server/src/progress.ts` (`markChecked`), `server/src/sementes.ts` (`toCheck`), `server/src/index.ts`,
`web/src/ui/conferir.ts`, `web/src/api.ts`, `web/src/style.css`, `README.md`.
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. `markChecked` rodado num `PROGRESS.md`
de teste no scratchpad: as 2 entregas pedidas trocadas (inclusive o parêntese em duas linhas), a frase entre aspas e
a entrega não pedida intactas, nenhuma linha a mais no arquivo. Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-29 — CI do auditor no GitHub (PD-9) e plano da lareira fechado (PD-7)

**O que mudou:**
1. **PD-7 fechada.** O usuário conferiu a lareira na vila (29/10/2026, "funcionando 100%", com a fumaça na chaminé). O
   plano saiu de `docs-dev/a-codar/` para `docs-dev/context/lareira-subir-sistema.md`.
2. **PD-9: CI no GitHub.** `.github/workflows/auditor.yml` roda o auditor de referências a cada push e pull request. Na
   máquina do GitHub os caminhos `~/.claude/...` citados no `CLAUDE.md`, no `README.md` e nos agentes não existem: um
   clone limpo com `HOME` vazio deu 16 falsos achados. Opção nova `--sem-home` no `scripts/auditar-referencias.py` pula
   esses caminhos; o CI usa ela, e na máquina do usuário o auditor continua conferindo tudo.
3. **Ordem do que falta** (decisão do usuário, 29/10/2026): PD-8 (testes), depois PD-6 (tileset). PD-5 (chat próprio
   via Agent SDK) foi descartada: perderia o Claude Code de verdade (slash commands, skills, mod) e a maior vantagem
   dela, permitir/negar sem abrir o terminal, dá para ter pelo hook `PermissionRequest`. Entrou a PD-10 no lugar.
**Arquivos:** `.github/workflows/auditor.yml` (novo), `scripts/auditar-referencias.py` (`--sem-home`), `CLAUDE.md`,
`docs-dev/context/lareira-subir-sistema.md` (movido), `PENDENCIAS.md`, `docs-dev/painel.json`.
**Testes:** cópia limpa do repositório sem o config local e com `HOME` vazio (como no GitHub): sem `--sem-home` 16
achados, com ela nenhum; com uma referência morta de verdade inserida no `CLAUDE.md` da cópia, o auditor acusa e sai
com 1. Na máquina, `--tudo` sem a opção segue sem achado. O workflow só roda de verdade no primeiro push.

## 2026-10-29 — Arquivo de projeto abre por link clicável no terminal da vila

**O que mudou:** link `file://` nunca abre no terminal da vila: ele roda no navegador (xterm.js), que só torna clicável
link `http(s)://` e bloqueia `file://` vindo de página http. `explorer.exe` pelo WSL também não abriu. Pedido do
usuário (29/10/2026): o Claude entrega o link de todo arquivo que ele pede para criar.
1. Rota nova `GET /api/arquivo?path=/caminho/absoluto`: entrega o arquivo **só se estiver dentro da pasta de um projeto
   da vila**, conferido pelo caminho real (link simbólico não escapa). Fora disso, inexistente ou pasta: 404, igual.
2. HTML abre isolado (`sendIsolatedHtml`, como estante e quadro); Markdown e texto abrem na aba como `text/plain`
   em vez de virar download. Nada que comece com ponto (`.env`, `.git`, `.claude`), em qualquer nível dentro do
   projeto: recusa explícita, porque o `sendFile` com caminho absoluto **não** recusa sozinho (o primeiro teste entregou
   `.git/config`; corrigido no mesmo dia).
3. O servidor continua só em `127.0.0.1`.
**Arquivos:** `server/src/index.ts` (rota `/api/arquivo`).
**Validação:** typecheck do servidor sem erro. Falta reiniciar a vila (derruba os terminais) e testar por http.

## 2026-10-28 — Agente nunca repete a aparência de outro, senta na sala da casa do projeto e abre com cabeçalho de agente

**O que mudou:** um agente de projeto nasceu com a mesma cara do administrador da praça (a aparência sai de 25
combinações de pele × cabelo, sorteadas pelo id). Pedido do usuário (28/10/2026):
1. Cada agente pega a combinação sorteada ou, se outro agente já a usa, a próxima livre. Administrador e bibliotecária
   reservam a deles primeiro. Quem não colidia continua igual; o traje não muda (regra 8).
2. Agente de projeto fica **dentro da casa do projeto, sentado atrás de uma mesinha própria** na sala de estar
   (dossiê e caneca em cima), esperando o clique. Até 4 por casa: duas mesinhas à direita do sofá, depois duas à
   esquerda. Lá fora só ficam os agentes globais, passeando no pátio da Fábrica. (Primeiro ficou parado na frente da
   casa; o usuário preferiu dentro, no mesmo dia.)
3. Conversa com agente da Fábrica abre com o cabeçalho dos agentes da vila: "✦ Nome" e, embaixo, "Agente do projeto X"
   (ou "Agente global") com a descrição. Antes saía "Morador novo — ✦ Nome" e o id da sessão, como numa sessão comum.
   O comportamento não mudou: continua o terminal com `claude --agent` e o botão de encerrar.
**Arquivos:** `web/src/game/villager.ts` (`agentCombo`), `web/src/game/InteriorScene.ts` (`AGENT_TABLE_X`),
`web/src/game/interiorTextures.ts` (`agentTable`), `web/src/game/common.ts` (`AgentNpc.sit`), `web/src/game/TownScene.ts`,
`web/src/ui/terminal.ts` (`openTerminal`, opção `agent`), `web/src/ui/actions.ts` (`talkToAgent`).
**Validação:** typecheck do servidor e do front + `vite build` (numa pasta temporária, para não trocar o front servido)
sem erro; auditor sem achado. Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-28 — Painel de pendências da casa em linhas curtas que expandem

**O que mudou:** com dezenas de pendências e textos longos (num projeto da vila, mediana de ~390 caracteres por item),
o painel virava uma parede de texto. Decisão do usuário (28/10/2026): **linha curta + expandir**.
1. Cada prioridade é uma seção recolhível com a contagem no título; só a mais grave abre sozinha.
2. Cada item é uma linha: dono, ID e o começo do texto (até o primeiro ponto ou dois-pontos, no máximo 120
   caracteres, sem markdown). Clicar abre o texto inteiro e a 4ª coluna.
3. O texto inteiro passa a renderizar **negrito** e ~~riscado~~ (antes saíam os asteriscos); vale também no quadro
   de avisos da praça, que usa a mesma função.
Os bilhetes da sala (máximo 15) não mudaram: o usuário escolheu mexer só no painel.
**Arquivos:** `web/src/ui/pendencias.ts` (`shortText`, `openPendencias`), `web/src/style.css` (`.pend-group`, `.pend-row`).

## 2026-10-28 — Quadro de pendências lê títulos com emoji, P5/P6 e ignora itens fechados

**O que mudou:** o quadro de uma casa da vila ficava vazio porque o `PENDENCIAS.md` daquele projeto usa emoji antes
do P (`## 🔴 P1 — …`) e vai até P6; a regex só aceitava `## P1`..`## P4`, então toda tabela caía em prioridade 0.
1. Título aceita uma palavra/emoji entre `##` e `P<n>`, com n de 1 a 6. O formato sem emoji continua igual; seções
   sem P (auditoria, fechados) seguem zerando a prioridade.
2. Linha com ID riscado (`~~ID~~`) ou com ✅ no ID é item fechado e não entra. O `**` do ID é removido.
3. Coluna "Pendência" vale como item (além de "Item").
4. Front: bilhete, painel e CSS ganham cores para P5 (azul) e P6 (lilás).
**Conferido:** parser rodado nos dois formatos (o deste repo: 5 itens, como antes; o outro: 38 abertos de P1 a P6,
nenhum riscado). Typecheck, build e auditor sem achado. Conferido na vila pelo usuário em 29/10/2026.
**Arquivos:** `server/src/pendencias.ts`, `web/src/ui/pendencias.ts`, `web/src/game/interiorTextures.ts`, `web/src/style.css`.

## 2026-10-28 — Lareira: correções do primeiro uso de verdade

**O que mudou:** o usuário acendeu a lareira de um projeto com back e front; ela não terminava de subir e soltava
fumaça preta. Três causas, achadas reproduzindo cada lado como a lareira roda (pty, `bash -c`, o ambiente do servidor):
1. **Front preso em "acendendo":** o `ng serve`, num terminal, pergunta se quer ativar o autocompletar e espera para
   sempre; o log da lareira era só leitura. Decisão do usuário (28/10/2026): **as abas de log aceitam teclado**
   (`t: 'in'` no `/ws/lareira`, como o terminal do morador). Responder uma vez basta, o Angular guarda a resposta.
2. **Back com erro (a fumaça preta):** o comando da tabela "Subir" daquele projeto fazia `source .env`, e o
   `backend/.env` não existe nesta máquina (só o `.env.example`). Decisão do usuário: o comando do projeto passa a
   carregar o `.env` só se ele existir (correção no `OPERACAO.md` do outro projeto, não aqui).
3. **Apagar virava erro:** o bash sai com código 143 quando o filho leva SIGTERM, e eu só tratava o sinal como
   "apagado pela vila". Agora o lado é marcado como sendo apagado antes do sinal, e qualquer saída depois disso conta
   como código 0.
**Arquivos:** `server/src/lareira.ts` (`apagando`, teclado no `attach`), `web/src/ui/lareira.ts` (xterm aceita
teclado), `docs-dev/context/lareira-subir-sistema.md` (decisão 8), `RETRABALHO.md`.
**Testes:** `npm run typecheck -w server` e `tsc` do front. O back do projeto rodado pela classe `Lareiras`: porta
aberta em 30s, nenhuma linha de erro no log, e depois de apagar a porta ficou livre com código 0 (sem fumaça preta) e
sem processo sobrando. O front reproduzido mostrou a pergunta do autocompletar parada esperando resposta. Falta
conferir na vila (precisa do reinício): acender, responder `n` na aba do front e ver a lareira acesa; apagar e ver a
fumaça parar.

## 2026-10-28 — Lareira, passo 4: fumaça na chaminé da fachada

**O que mudou:** último passo do plano `docs-dev/context/lareira-subir-sistema.md` (PD-7). A chaminé de cada casa
com lareira solta baforadas pelo estado (`estadoLareira`, o mesmo da sala): apagada, nada; acendendo, fumaça fina e
espaçada; acesa, fumaça clara contínua; erro, fumaça escura. Cada baforada sobe uns 20px, se espalha e some em 1,8s.
Um timer só da cena (120ms) cuida de todas as casas e é recriado junto com a vila, para não acumular. A boca da
chaminé fica em (x+15, y-72) do pé da casa, pela textura `house` (chaminé nos pixels 43 a 52 de 64).
**Arquivos:** `web/src/game/TownScene.ts` (`HouseView.smoke`, `puffSmoke`, `smokeTimer`), `web/src/game/textures.ts`
(`smokePuff`: `smoke` e `smoke-dark`), `README.md`, `docs-dev/context/lareira-subir-sistema.md`, `docs-dev/painel.json`.
**Testes:** `tsc` + `vite build` (diretório temporário), auditor sem achado. Posição da fumaça calculada pela textura
da casa, sem renderizar. Conferido na vila pelo usuário em 29/10/2026: a casa do dev-valley deve soltar fumaça clara
(a 4777 é a própria vila, conta como acesa); acender o sistema de outra casa deve mostrar fumaça fina e depois
contínua. Com a conferência, o plano fecha: vai para `docs-dev/context/` e a PD-7 sai do `PENDENCIAS.md`.

## 2026-10-27 — Lareira, passo 3: lareira na sala e painel com os logs

**O que mudou:** passo 3 do plano `docs-dev/context/lareira-subir-sistema.md` (PD-7). Projeto com a tabela "Subir"
(algum lado com comando) ganha uma lareira encostada no canto de cima à direita (decisão 9). Primeiro ela ficou solta
no chão ao lado do sofá; o usuário apontou que não fazia sentido, e a parede de cima foi redistribuída: estante,
atril, quadro de cortiça, janela (saiu do centro), quadro negro com a caixa de sementes embaixo, escrivaninha e
lareira, com 8px entre as peças. A planta foi para o canto esquerdo da sala de estar. Ela tem 4 texturas, uma
por estado da tabela do plano: apagada (só lenha), acendendo (fogo pequeno), acesa (dois quadros alternando, para o
fogo tremer) e erro (brasa e fumaça escura). O estado vem de `estadoLareira` em `web/src/api.ts`. Ele conta só os
lados com comando e sem problema, e trata como acesa a porta ocupada por fora da vila (decisão 7). O clique abre o
painel (decisão 6) com cada lado: pasta, porta, comando e situação (apagado, acendendo, aceso pela vila com PID,
ligado fora da vila, parou com erro, sem comando, problema). Acender e Apagar ficam no cabeçalho; Apagar só fica
ativo quando a vila ligou algo. Embaixo, uma aba de log por lado (decisão 8): um xterm só leitura por `/ws/lareira`,
criado quando a aba abre. O painel acompanha o mundo enquanto está aberto. Correção no passo 2: abrir o log de um lado
nunca ligado criava um registro que aparecia como "saiu"; agora aparece como não ligado.
**Arquivos:** `web/src/ui/lareira.ts` (novo), `web/src/api.ts` (`estadoLareira`, `acenderLareira`, `apagarLareira`),
`web/src/game/interiorTextures.ts` (`fireplace`), `web/src/game/InteriorScene.ts` (lareira, `lightFireplace`),
`web/src/ui/actions.ts`, `web/src/style.css` (comando longo quebra), `server/src/lareira.ts` (`merge`), `README.md`,
`docs-dev/context/lareira-subir-sistema.md`, `docs-dev/painel.json`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado.
`estadoLareira` testado com os 7 casos da tabela do plano (apagada, acendendo por processo e por porta, acesa com um
lado de fora, erro, apagado pela vila, lados sem comando e com problema ignorados). As posições da parede foram
conferidas pelas medidas de cada peça (sem sobreposição), sem renderizar. Conferido na vila pelo usuário em 28/10/2026 (lareira no canto, painel, Acender e Apagar).

## 2026-10-27 — Lareira, passo 2: servidor liga e apaga os lados

**O que mudou:** passo 2 do plano `docs-dev/context/lareira-subir-sistema.md` (PD-7). `Lareiras` em
`server/src/lareira.ts` mantém um processo por lado, em pseudo-terminal (`node-pty`, como os moradores), filho do
servidor: `bash -c "<comando>"` na pasta da tabela. Acender liga só os lados que têm comando, não têm problema, não
estão rodando pela vila e cuja porta está livre (decisões 2 e 7: a vila nunca mexe em processo que não criou). Apagar
manda SIGTERM para o **grupo de processos** de cada lado e SIGKILL depois de 5s (decisão 4: o `java` ou o `vite` que
o `npm` abre vão junto). O mundo ganha o estado de cada lado (`vila`: rodando com o PID, ou saiu com o código).
Apagado pela vila conta como código 0; saiu sozinho com código diferente de 0 é erro. Log de cada lado por
`/ws/lareira` (histórico e depois ao vivo, só leitura). `POST /api/lareira/acender` e `/apagar` recebem só o
projeto: o comando vem da tabela lida pelo servidor. As duas rotas exigem página local, a mesma checagem do WebSocket
(regra 2), porque executam comando. Servidor saindo (SIGINT/SIGTERM) apaga o que a vila ligou. `OPERACAO.md` avisa que
reiniciar a vila derruba esses sistemas.
**Arquivos:** `server/src/lareira.ts` (`Lareiras`, `Lado.vila`), `server/src/index.ts` (rotas, `/ws/lareira`,
`refreshWorld` junta o estado, desligamento), `web/src/api.ts`, `docs-dev/guias/OPERACAO.md`,
`docs-dev/context/lareira-subir-sistema.md`, `docs-dev/painel.json`.
**Testes:** `npm run typecheck -w server` e `tsc` do front, auditor sem achado. Gerenciador testado de verdade, fora
da vila (sem reiniciar o servidor), num projeto falso no scratchpad com 3 lados: dois servidores HTTP (um deles com um
`sleep` em segundo plano) e um comando que sai com código 3. Acender ocupou as duas portas e marcou "rodando"; o lado
com erro ficou "saiu 3"; acender de novo pulou os lados com porta ocupada; apagar liberou as portas, e `ps` não mostrou
nenhum processo órfão (o `sleep` morreu junto). As rotas e o `/ws/lareira` não foram testados com o servidor rodando
(precisa do reinício); vão ser exercitados no passo 3, pelo painel.

## 2026-10-27 — Lareira, passo 1: servidor lê a tabela "Subir" e as portas

**O que mudou:** passo 1 do plano `docs-dev/context/lareira-subir-sistema.md` (PD-7). Cada projeto ganha `lareira`:
os lados da tabela "Subir" do `docs-dev/guias/OPERACAO.md` (primeira tabela depois de `## Subir`, colunas achadas
pelo nome), com pasta, comando, porta e se a porta está ocupada (e por qual PID, quando o processo é do usuário). Pasta
e comando saem sem as crases; `\|` vira pipe dentro do comando. Célula de comando vazia = a vila não liga aquele lado;
projeto sem nenhum lado com comando fica sem lareira (null). Cada lado diz o `problema` que impede de ligar: pasta fora
do projeto, pasta que não existe ou porta inválida. As portas são lidas uma vez por atualização do mundo
(`ss -ltnpH`), para todas as casas. Só leitura: nada liga nem desliga ainda (passo 2). O `painel.json` passa a ter
este plano (o anterior estava todo feito).
**Arquivos:** `server/src/lareira.ts` (novo), `server/src/world.ts` (`Project.lareira`, portas por atualização),
`web/src/api.ts` (tipo `Lado`), `docs-dev/context/lareira-subir-sistema.md`, `docs-dev/painel.json`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server` e `tsc` do front, auditor sem achado. Leitor testado nos projetos reais: este
repositório tem o back na 4777, que aparece ocupada pela própria vila; o de exemplo tem back e front livres; projeto sem
`OPERACAO.md` fica sem lareira. Uma tabela de teste confirmou pipe escapado, `../..` recusado, pasta inexistente, porta
inválida, linha sem comando e a seção seguinte ignorada. Não há o que conferir na vila ainda (nada aparece até o passo 3).

## 2026-10-27 — Fachada da fábrica mais trabalhada

**O que mudou:** pedido do usuário: manter a identidade da Fábrica de agentes, com mais acabamento. Mesmo tamanho
(100×96). Tijolo em amarração e pilares de canto; claraboias de vidro no dente-de-serra; chaminé de tijolo na frente
do telhado, soltando fumaça; janelas industriais em grade 2×2 com verga de tijolo (`factoryWindow`); portão de enrolar
sob viga de aço; base de pedra. A primeira versão saiu detalhada demais e o usuário pediu para suavizar e tirar o
símbolo do meio: sem a engrenagem, tijolo num tom só com juntas espaçadas, sem rebites, reflexos e vidraça acesa.
**Arquivos:** `web/src/game/textures.ts` (`factory`, `factoryWindow`).
**Testes:** `tsc` + `vite build` (diretório temporário), auditor sem achado. Prévia em PNG do sprite gerada fora do
navegador. Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-27 — Fachada da biblioteca com cara de biblioteca

**O que mudou:** pedido do usuário: por fora, a biblioteca não parecia uma biblioteca. A fachada foi redesenhada no
mesmo tamanho (100×90, sem mexer no layout): frontão triangular de pedra com um livro aberto em relevo, arquitrave
com inscrição e dentículos, colunas com capitel e base, janelas em arco que mostram estantes com lombadas coloridas
por dentro (`bookWindow`), porta em arco de duas folhas com lampiões dos lados, e escadaria na entrada.
**Arquivos:** `web/src/game/textures.ts` (`library`, `bookWindow`).
**Testes:** `tsc` + `vite build` (diretório temporário), auditor sem achado. Prévia em PNG do sprite gerada fora do
navegador. Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-27 — Banco da praça abre sessão nova avulsa

**O que mudou:** pedido do usuário. Clicar no banco da praça abre um terminal com uma sessão nova do Claude Code
fora de qualquer projeto; ela mora na praça, como as outras avulsas. Decisões do usuário (27/10/2026): nasce sempre
na home (`~`), sem perguntar pasta; a peça é o banco que já existia, sem pixel art nova. `POST /api/sessions` sem
`project` devolve um id novo e o guarda em `avulsaSessions`; o WebSocket do terminal aceita esse id uma vez, com
a home como pasta (mesmo esquema das conversas com agente da Fábrica).
**Arquivos:** `server/src/index.ts` (`avulsaSessions`, rota e WebSocket), `web/src/api.ts` (`newSession` sem
projeto), `web/src/ui/actions.ts` (`newAvulsa`), `web/src/game/TownScene.ts` (banco clicável).
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado.
Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-27 — Subfases do painel.json na horta e no quadro negro

**O que mudou:** pedido do usuário, com a estrutura do painel da Fábrica de agentes e o estilo da vila. O servidor
passa a ler as `etapas` de cada fase, em qualquer nível (até 6, para se proteger de JSON torto). Decisões do usuário
(27/10/2026): entra na horta e no quadro negro; só a estrutura, sem os botões "Começar sessão" e copiar. Cada nível
com etapas mostra "X de Y", contando as etapas diretas como a Fábrica faz (fase = subfases feitas, subfase = itens
feitos). A fase ganha uma barra de progresso, a mesma da barra de uso, com "X de Y · N%". Cada nível recua; o que está
em andamento abre aberto e o resto fica recolhido (`<details>`). As duas telas usam um renderizador só (`faseTree`).
**Arquivos:** `server/src/painel.ts` (`Etapa`, `etapas`), `web/src/api.ts`, `web/src/ui/painel.ts` (`faseTree`),
`web/src/ui/quadro.ts`, `web/src/style.css` (`.fase-tree`, `.fase-progress`).
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado no projeto de exemplo: a fase com 19 subfases sai "0 de 19" e a primeira subfase "1 de 4", como na imagem do
painel da Fábrica; fases sem etapas continuam como antes. Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-28 — Pombal: botão "Sugerir texto" para a mensagem do commit

**O que mudou:** pedido do usuário: na hora de escrever a mensagem, ficava a dúvida do que digitar. A tela de enviar
ganhou "✨ Sugerir texto": o escrevente, agente novo da vila (`server/agents/escrevente.md`, aparece só leitura na
Fábrica, sem NPC), recebe a regra de commit do `CLAUDE.md` do projeto, as últimas 15 mensagens do `git log`, os 5
títulos mais recentes do `PROGRESS.md` e o diff dos arquivos marcados, e devolve uma linha que preenche a caixa de
texto. Usa a base comum (`consulta.ts`, `claude -p --no-session-persistence`, só `Read`; regra 5 do `CLAUDE.md`
atualizada). `POST /api/pombal/sugerir` só aceita página local.
**Arquivos:** `server/agents/escrevente.md` (novo), `server/src/escrevente.ts` (novo), `server/src/index.ts`,
`web/src/api.ts`, `web/src/ui/commit.ts`, `README.md`, `CLAUDE.md`, `docs-dev/context/pombal.md`.
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor. Sugestão real neste repositório, com os arquivos
do pombal: em 4 s veio "Pombal passa a ser a única peça de git da casa: enviar para o time faz commit, rebase e push
de uma vez, e a caixa de envio saiu", no estilo do `git log`. Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-28 — Pombal absorve a caixa de envio: dois estágios, local e enviado

**O que mudou:** decisão do usuário (28/10/2026): a caixa de envio era redundante, e o caminho até desenvolvimento não
pede burocracia (homologação fica fora da vila). Dois estágios só: **local** (o que só você tem, com ou sem commit) e
**enviado** (o time já tem). Na vila, a caixa de envio e a bolinha vermelha saíram; no lugar, uma carta espalhada no
chão entre a casa e o pombal para cada arquivo local (até 12, lugares fixos), e o pombo acordado. "Enviar para o time"
abre a tela de diff e mensagem (a antiga caixa, agora `openEnviar`) e faz commit, rebase e push numa viagem; só
commits prontos, confirma no próprio painel. "Trazer" usa `--autostash` (alteração sem commit não impede o pull; se
o autostash conflitar, fica no stash e o "!" avisa). Arquivos locais contam a partir do merge-base com o upstream.
Toda casa com git tem pombal; sem upstream, enviar só guarda o commit. Rota `/api/commit` e `api.commit` removidas;
botão da escrivaninha vira "Pombal".
**Arquivos:** `server/src/pombal.ts` (reescrito), `server/src/index.ts`, `web/src/api.ts`, `web/src/ui/pombal.ts`
(reescrito), `web/src/ui/commit.ts` (`openEnviar`), `web/src/ui/actions.ts`, `web/src/ui/project.ts`,
`web/src/game/TownScene.ts` (só caixa e pombal), `web/src/game/textures.ts` (sem `bin`), `web/src/game/layout.ts`
(sem `bin`), `web/src/style.css`, `README.md`, `CLAUDE.md`, `docs-dev/context/pombal.md`.
**Testes:** `npm run typecheck -w server`, `npm run build`. Repositório de teste com remoto falso e dois clones na
mesma branch: arquivos locais sem contar o que veio do outro, enviar sem mensagem recusado, trazer com alteração sem
commit (autostash), enviar = commit + rebase + push (chão limpo depois), branch sem upstream só commita. Falta
conferir na vila (precisa do reinício do servidor).

## 2026-10-28 — Pombal em toda casa: pull e push da branch com o upstream

**O que mudou:** decisão do usuário (28/10/2026): o time passa a trabalhar direto na branch comum, e o pombal vira a
peça oficial de pull e push de toda casa (caixa de envio = commit; pombal = troca com o remoto). Sai o `pombal` do
config local (branch pessoal + branch comum): agora é a branch atual e o upstream dela, e só tem pombal quem tem
upstream. Pull com rebase em vez de merge (histórico em linha, decisão do usuário); conflito termina em
`rebase --abort`. Falha do fetch automático vai para `falhaBusca` (só no texto); o "!" fica para falha de viagem
disparada e some quando o HEAD muda (conflito resolvido por fora). O `POST /api/pombal` passou a recusar origem que
não seja local, como a lareira. Regra 9 do `CLAUDE.md` reescrita.
**Arquivos:** `server/src/pombal.ts` (reescrito), `server/src/config.ts` (sem `pombal`), `server/src/world.ts`,
`server/src/index.ts`, `web/src/api.ts`, `web/src/ui/pombal.ts`, `web/src/game/TownScene.ts` (só o pombal),
`README.md`, `CLAUDE.md`, `docs-dev/context/pombal.md`; `pombal` removido do `dev-valley.config.local.json`.
**Testes:** `npm run typecheck -w server`, `npm run build`. Repositório de teste com remoto falso e dois clones na
mesma branch: pull com commit dos dois lados (rebase em linha), push, conflito (rebase desfeito, arquivo listado,
repositório limpo), fetch falho sem "!", "!" que some depois de resolver por fora, branch sem upstream sem pombal.
Conferido na vila pelo usuário em 29/10/2026.

## 2026-10-27 — Pombal vira casinha de passarinho no quintal

**O que mudou:** pedido do usuário: o pombal acima da porta ficava pequeno e pouco destacado. Agora é uma casinha de
passarinho num poste, no quintal à direita da caixa de envio (único espaço livre do lote: a horta fica à esquerda e as
ervas acima da caixa), com 24×46 px (antes 16×15), parede azul e telhado vermelho. O pombo com carta e as cartas do
poleiro também cresceram. Estados e cliques iguais.
**Arquivos:** `web/src/game/textures.ts` (`dovecote`, `pigeonLetter`, `letter`), `web/src/game/TownScene.ts`
(`POMBAL_DX`, `buildPombal`, `updatePombal`), `README.md`, `docs-dev/context/pombal.md`.
**Testes:** `npm run build`. Só o front mudou: basta recarregar a página, sem reiniciar o servidor. Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-27 — Pombal: sincronização diária com a branch comum do time

**O que mudou:** decisão do usuário (27/10/2026, registrada em `docs-dev/context/pombal.md`). A casa configurada
ganha um pombal acima da porta. Pombo dormindo = em dia; pombo no telhado com carta = commits novos na branch comum;
cartas no poleiro = commits seus a levar; "!" amarelo = outra branch ou viagem que não completou. O painel lista as
cartas dos dois sentidos e tem as duas viagens: trazer (fetch, merge da comum na sua, push da sua) e levar (o mesmo e,
no fim, push fast-forward para a comum, com confirmação). Mudança sem commit e branch errada barram antes de sair;
conflito desfaz o merge e lista os arquivos. A contagem ignora merges. O remoto é buscado ao subir, a cada 5 min e ao
abrir o painel; o `git()` ganhou o modo `network` (sem pedir senha, 2 min de limite). Config `pombal` só no local.
Regra 9 nova no `CLAUDE.md` (push só por clique, nunca force, conflito sempre aborta).
**Arquivos:** `server/src/pombal.ts` (novo), `server/src/git.ts`, `server/src/config.ts`, `server/src/world.ts`,
`server/src/index.ts` (`GET`/`POST /api/pombal`, fetch periódico), `web/src/api.ts`, `web/src/ui/pombal.ts` (novo),
`web/src/ui/actions.ts`, `web/src/game/textures.ts` (pombal, pombo com carta, carta), `web/src/game/TownScene.ts`,
`web/src/style.css`, `README.md`, `CLAUDE.md`, `docs-dev/context/pombal.md` (novo).
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Leitura no projeto real (sem rede e sem
merge): em dia; branch errada e branch inexistente dão o estado certo. Viagens num repositório de teste com um remoto
falso e dois clones: pull, push até a comum, recusa com mudança sem commit (não marca o pombal) e conflito (merge
desfeito, arquivo listado, repositório limpo). Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-27 — Quadro negro mostra o painel.json inteiro

**O que mudou:** pedido do usuário, fora de plano. O quadro negro deixa de mostrar só o plano de ação das fases em
andamento e passa a mostrar o `docs-dev/painel.json` completo: plano (nome e `doc`), todas as fases com o estado,
todas as entregas e, num bloco recolhível, o JSON como está no arquivo (campos fora do formato inclusive). O `doc` do
plano e de cada fase, em qualquer estado, vira botão "Abrir plano": HTML abre no mesmo iframe isolado (com "Voltar ao
quadro"), `.md` no leitor; `doc` que não existe aparece como "não encontrado". O quadro fica escrito sempre que o
projeto tem `painel.json`, e o texto ao passar o mouse mostra o plano e quantas fases estão feitas.
**Arquivos:** `server/src/painel.ts` (`Painel.json`), `server/src/quadro.ts` (docs do plano e de todas as fases,
com o `doc` original), `server/src/world.ts`, `web/src/api.ts`, `web/src/ui/quadro.ts` (reescrito),
`web/src/ui/painel.ts` (`PHASE` exportado), `web/src/game/InteriorScene.ts`, `web/src/style.css`, `README.md`.
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-27 — Estante da casa com o que já foi construído

**O que mudou:** decisão do usuário (27/10/2026, opção B entre três): a estante, que era só decoração, passa a mostrar
`docs-dev/context/`, a arquitetura já implementada (G7). Fecha o ciclo do plano: semente (`a-codar/`) → quadro negro
(em andamento) → livro na estante. Mesmos critérios da caixa de sementes: só o primeiro nível, `.md` e `.html`, sem o
`README.md`; título = primeiro `# ` do Markdown ou `<title>` do HTML. A estante desenha um livro por documento (cabem
25; acima disso fica cheia) e fica vazia sem a pasta. `.md` abre no leitor da biblioteca; HTML abre no mesmo iframe
isolado do quadro negro, por `GET /api/estante`. A resposta isolada (CSP `sandbox allow-scripts`) virou uma função só
para as duas rotas.
**Arquivos:** `server/src/estante.ts` (novo), `server/src/world.ts` (`Project.estante`), `server/src/index.ts`
(`sendIsolatedHtml`, `/api/estante`), `web/src/api.ts`, `web/src/game/interiorTextures.ts` (estante vazia +
`SHELF_BOOKS`, um sprite por livro), `web/src/game/InteriorScene.ts` (`fillShelf`, clique), `web/src/ui/estante.ts`
(novo), `web/src/ui/actions.ts`, `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado nos projetos reais: 4 livros neste repositório, 13 no de exemplo (2 HTML, todos com título próprio), e os sem
`docs-dev/context/` ficam com a estante vazia. Os lugares dos livros são os mesmos do desenho antigo, sem
renderizar. Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-27 — Quadro negro na casa com o plano de ação da fase em andamento

**O que mudou:** pedido do usuário, fora de plano. Toda casa ganha um quadro negro na parede, entre a janela e a
escrivaninha. Ele mostra o plano de ação de cada fase em `andamento` do `docs-dev/painel.json` que tem `doc` (campo
opcional por fase, que o servidor passa a ler). Decisões do usuário (27/10/2026): várias fases em andamento = lista na
lateral para escolher; `.md` abre no leitor da biblioteca; HTML abre num painel dentro da vila. Sem plano, o quadro
aparece limpo e o clique diz que não há plano. O HTML é servido por `GET /api/quadro` só se estiver na lista do
projeto (arquivo existente, dentro da pasta, `.html`/`.htm`/`.md`), com `Content-Security-Policy: sandbox
allow-scripts`, e o iframe também tem `sandbox="allow-scripts"`. Os scripts do plano rodam, mas numa origem opaca, sem
acesso à API nem aos terminais (regra 2). Limite: o HTML não carrega arquivo relativo (CSS ou imagem ao lado), só o
que estiver embutido nele.
**Arquivos:** `server/src/quadro.ts` (novo), `server/src/painel.ts` (`doc` da fase), `server/src/world.ts`
(`Project.quadro`), `server/src/index.ts` (`/api/quadro`), `web/src/api.ts`, `web/src/game/interiorTextures.ts`
(`chalkboard`, limpo e escrito), `web/src/game/InteriorScene.ts`, `web/src/ui/quadro.ts` (novo),
`web/src/ui/actions.ts`, `web/src/style.css` (`.quadro-frame`), `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado nos projetos reais: o de exemplo lista as 3 fases em andamento (2 HTML, 1 md), os outros ficam com o quadro
limpo. Também conferi que caminho com `../`, extensão fora da lista e fase já feita ficam de fora. A posição na parede
foi conferida pelas medidas da janela, do quadro de cortiça e da escrivaninha, sem renderizar. Conferido na vila pelo
usuário em 27/10/2026.

## 2026-10-26 — Encerrar sessão na vila apaga a conversa de vez

**O que mudou:** decisão do usuário (26/10/2026): ao clicar em "Encerrar sessão", a sessão deixa de existir. O botão
pede confirmação no rodapé do painel (como o "Apagar" da Fábrica); confirmado, o servidor encerra o processo **e espera
ele sair** (SIGHUP, SIGKILL depois de 5s) para o `claude` não regravar o arquivo ao fechar, apaga `<id>.jsonl` e a pasta
`<id>/` (subagentes) em `~/.claude/projects`, tira a sessão do estado dos hooks e atualiza o mundo. O id só passa se
for UUID (ele vira nome de pasta no `rm` recursivo). Sessão aberta fora da vila responde 409 e não é apagada.
Sessão fechada fora da vila continua indo para dentro de casa até `sessionMaxAgeDays`.
**Arquivos:** `server/src/index.ts` (rota `DELETE /api/sessions/:id`), `server/src/sessions.ts` (`deleteSessionFiles`,
`listSessions` tolera arquivo apagado no meio da leitura), `server/src/terminals.ts` (`kill` espera o processo sair),
`server/src/hooks.ts` (`forget`), `web/src/ui/terminal.ts` (confirmação), `web/src/api.ts` (`killSession` → `deleteSession`).
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado; `deleteSessionFiles` testada num HOME
falso (apaga a sessão e a pasta dela, não toca nas outras, recusa `..`, vazio, `../x` e `<id>/..`). Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-27 — Agentes com traje de agente secreto

**O que mudou:** decisão do usuário (27/10/2026): todo agente fica nitidamente diferente das sessões, com aparência de
agente secreto, estilo "homens de preto". O gerador de moradores ganhou a variante agente (`villagerTexture(scene, id,
true)`): paletó e calça pretos, sapato preto, camisa branca com gravata preta (de frente e de lado), óculos escuros
com reflexo, cabelo curto em cor natural, sem chapéu e sem cinto à mostra; só pele e cor do cabelo variam por agente.
Aplicada aos NPCs ✦ do pátio (na `AgentNpc`, então todo agente criado na Fábrica já nasce assim), à bibliotecária e
ao administrador. A prévia `web/sprites.html` ganhou uma linha de agentes abaixo dos moradores. Virou a regra 8 do
`CLAUDE.md` (padrão para os próximos agentes, inclusive os da vila).
**Arquivos:** `web/src/game/villager.ts` (`agentLookFor`, traje no corpo, óculos na cabeça, sapato), `web/src/game/common.ts`
(`AgentNpc`), `web/src/game/LibraryScene.ts`, `web/src/game/TownScene.ts`, `web/src/sprites.ts`, `CLAUDE.md`,
`README.md`, `docs-dev/context/fabrica-de-agentes.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Conferido
na vila pelo usuário em 27/10/2026.

## 2026-10-26 — Fábrica com o mesmo visual por dentro e por fora; plano "Ambiente de IA na vila" fechado

**O que mudou:** o usuário conferiu a Fábrica e pediu um visual só, com a fachada como referência (por fora tijolo,
por dentro estava com o papel de parede e o piso de madeira das casas). O interior ganhou parede de tijolo aparente
(mesmo vermelho e rejunte da fachada) com viga de aço no rodapé e piso de chapa de aço com rebites, nos tons do portão;
os pés da bancada e a moldura da parede de ferramentas viraram aço. Com o passo 7 conferido, o plano fechou: o
arquivo foi de `docs-dev/a-codar/` para `docs-dev/context/ambiente-de-ia-na-vila.md` (G7) e as referências foram
atualizadas.
**Arquivos:** `web/src/game/interiorTextures.ts` (`factoryWall`, `factoryFloor`, aço na bancada e na parede de
ferramentas), `web/src/game/FactoryScene.ts`, `docs-dev/context/ambiente-de-ia-na-vila.md` (movido),
`docs-dev/painel.json`, `docs-dev/context/fabrica-de-agentes.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Visual novo
não renderizado. Conferido na vila pelo usuário em 27/10/2026.

## 2026-10-26 — Fábrica por dentro, com skills e os agentes da vila

**O que mudou:** passo 7 (último) do plano `docs-dev/context/ambiente-de-ia-na-vila.md` (decisões do usuário em
26/10/2026). Clicar na Fábrica entra nela (`FactoryScene`, como a biblioteca): a **bancada** abre o painel de agentes
de antes e a **parede de ferramentas** abre as **skills**; os NPCs ✦ continuam no pátio. O rótulo na vila virou
"Fábrica". Skills: pastas com `SKILL.md` em `~/.claude/skills` e `<projeto>/.claude/skills` (pasta sem `SKILL.md`,
como a `synced` do próprio Claude Code, fica de fora); criar, editar só o `SKILL.md` (campos desconhecidos do cabeçalho,
como `allowed-tools`, preservados; data do arquivo conferida ao salvar) e apagar a **pasta inteira**, com confirmação
que lista os arquivos. Skill instalada por link (as do `instalar.sh`) é só leitura e mostra a fonte; o servidor recusa
salvar e apagar.
**Por que o administrador não aparecia (pergunta do usuário):** a Fábrica só lia `~/.claude/agents` e
`<projeto>/.claude/agents`; a bibliotecária aparecia porque o `hooks:install` a copia para lá, e o administrador mora
só em `server/agents/`, de propósito (instalado, uma sessão poderia chamá-lo como subagente com `Edit` liberado,
contra a regra 5). Agora a Fábrica lê também `server/agents/` e mostra os **agentes da vila** num grupo só leitura (a
cópia instalada da bibliotecária não repete), sem NPC no pátio; e a rota de conversa (`/api/agents/session`) **recusa**
agente da vila, para ninguém rodá-lo por `claude --agent` sem as permissões da vila.
**Arquivos:** `server/src/skills.ts` (novo), `server/src/agents.ts` (agentes da vila; leitura do cabeçalho exportada),
`server/src/world.ts` (`World.skills`), `server/src/index.ts` (`/api/skills`, trava em `/api/agents/session`),
`web/src/api.ts`, `web/src/game/FactoryScene.ts` (novo), `web/src/game/interiorTextures.ts` (`workbench`,
`pegboard`), `web/src/game/TownScene.ts`, `web/src/main.ts`, `web/src/ui/skills.ts` (novo), `web/src/ui/factory.ts`
(grupo da vila), `web/src/ui/actions.ts`, `README.md`, `CLAUDE.md`, `docs-dev/context/fabrica-de-agentes.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Skills e
agentes testados num `HOME` falso no scratchpad (nunca nas skills reais): a `synced` fica de fora; skill por link
recusada ao salvar e apagar, com a fonte intacta; `allowed-tools` preservado; conflito de data (409); nome repetido e
`../` recusados; caminho fora das pastas recusado; apagar remove a pasta com o script junto; os dois agentes da vila
listados. Composição da sala conferida pelas medidas, não renderizada. Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-26 — Outdoor dos guardrails atrás da praça

**O que mudou:** passo 6 do plano `docs-dev/context/ambiente-de-ia-na-vila.md`. O servidor lê se o plugin dos
guardrails está ligado (`enabledPlugins` no `~/.claude/settings.json`) e a lista de regras (títulos `## G<n> — ...`
do arquivo de guardrails); só leitura. Plugin e arquivo vêm de uma chave nova, `guardrails`, que fica **só no config
local** (o caminho é pessoal e o repositório é público); sem ela, não há outdoor. Na vila, um outdoor na faixa atrás
da praça, entre a biblioteca e a Fábrica (reservada no layout, sem árvore nem flor embaixo; cabe com 3 ou 4 colunas
de casas): "Guardrails" e "✓ ligado" (verde) ou "✗ desligado" (vermelho). O tooltip diz quantas regras e o plugin; o
clique abre a lista em ordem numérica, com botão para abrir o arquivo na biblioteca e o aviso de que "ligado" é o
`settings.json` (se a status line da sessão não mostra `guardrails ✓`, o mod não carregou nela).
**Arquivos:** `server/src/guardrails.ts` (novo), `server/src/config.ts` (`guardrails`), `server/src/world.ts`
(`World.guardrails`), `server/src/index.ts`, `web/src/api.ts`, `web/src/game/layout.ts` (`billboard`, faixa
reservada), `web/src/game/textures.ts` (`billboard`), `web/src/game/TownScene.ts` (`buildBillboard`,
`updateBillboard`), `web/src/ui/guardrails.ts` (novo), `web/src/ui/actions.ts`, `README.md` (config e mapa),
`CLAUDE.md`; `dev-valley.config.local.json` (ignorado pelo git) ganhou a chave.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado com o config real (plugin ligado, 21 regras) e sem a chave (null). Posição conferida pelas medidas da praça,
da biblioteca e da Fábrica, não renderizada. Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-26 — Placa de vistoria na fachada

**O que mudou:** passo 5 do plano `docs-dev/context/ambiente-de-ia-na-vila.md`. O servidor lê a data de vencimento
da auditoria de julgamento das regras em `.claude/auditoria-regras.txt` de cada projeto (gravada pelo
`instalar-projeto.sh`, reagendada pela skill `/auditar-regras`); só leitura, e sem o arquivo não há placa. Na
fachada, embaixo da janela da esquerda (entre o peitoril e a fundação, do lado oposto ao andaime), uma plaquinha:
papel quando está em dia, amarela quando a data já passou (vence no dia seguinte ao do arquivo, como o aviso do hook
de Stop). O tooltip diz a data e, vencida, lembra o `/auditar-regras`; o clique entra na casa, como o resto da fachada.
**Arquivos:** `server/src/estrutura.ts` (`readAuditoria`), `server/src/world.ts` (`Project.auditoria`),
`web/src/api.ts`, `web/src/game/textures.ts` (`plaque-ok`, `plaque-due`), `web/src/game/TownScene.ts`
(`auditoriaVencida`), `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado contra os projetos reais (mesmas datas de um `grep`; sem arquivo = null). Hoje nenhum projeto está vencido,
então só a placa em dia aparece. Posição conferida pelas medidas da janela, da porta e da fundação, não renderizada.
Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-26 — Painéis de leitura sem rolagem

**O que mudou:** o usuário achou o painel do retrabalho cortado nas primeiras linhas. Causa: no painel grande o corpo
tem `overflow: hidden` (quem rola é um bloco interno, como na biblioteca), e os painéis de conteúdo simples punham a
lista direto no corpo. Afetava também as pendências da casa, o quadro de avisos, a horta, o sino, a obra e as sementes.
`openPanel` ganhou a opção `scroll` (classe `panel-scroll`, o próprio corpo rola) e os 7 painéis a usam; os que têm
rolagem própria (biblioteca, terminal, commit, diário, Fábrica, conversa com agentes) não mudam.
**Arquivos:** `web/src/ui/panel.ts`, `web/src/style.css`, `web/src/ui/{pendencias,painel,conferir,obra,sementes,retrabalho}.ts`,
`RETRABALHO.md`.
**Testes:** `tsc` + `vite build` (diretório temporário), `npm run typecheck -w server`, auditor sem achado. Conferido
na vila pelo usuário em 26/10/2026.

## 2026-10-26 — Ervas do retrabalho no quintal

**O que mudou:** passo 4 do plano `docs-dev/context/ambiente-de-ia-na-vila.md`. O servidor lê o `RETRABALHO.md` de
cada projeto (G17) guardando o cabeçalho da tabela e as linhas como estão: os projetos variam o formato (data
`AAAA-MM-DD` ou `DD/MM`, coluna extra como "Virou regra?"), então nada é reinterpretado. Só leitura; sem o arquivo,
sem ervas. No quintal, à direita da casa e acima da caixa de envio (espelhando a horta), uma erva daninha por linha
(até 9, grade 3x3; uma em cada três tem florzinha). O tooltip diz quantos registros há; o clique abre a tabela com as
colunas do arquivo e o lembrete de que três da mesma causa pedem `/nova-regra` (decisão do usuário: sem etiqueta nem
IA, o agrupamento é dele).
**Arquivos:** `server/src/retrabalho.ts` (novo), `server/src/world.ts` (`Project.retrabalho`), `web/src/api.ts`,
`web/src/game/textures.ts` (`weed0`, `weed1`), `web/src/game/TownScene.ts` (`growWeeds`), `web/src/ui/retrabalho.ts`
(novo), `web/src/ui/actions.ts`, `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado contra os projetos reais (mesma contagem de linhas de um `grep`, nos dois formatos, todas com o número de
colunas do cabeçalho). Posição das ervas conferida pelas medidas da caixa de envio, do selo dela e do telhado, não
renderizada. Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-26 — Caixa de sementes dentro da casa

**O que mudou:** passo 3 do plano `docs-dev/context/ambiente-de-ia-na-vila.md`. O servidor lê os planos em
`docs-dev/a-codar/` de cada projeto (só o primeiro nível, sem o `README.md`; título = primeiro `# `); só leitura, e
sem a pasta não há caixa. Dentro da casa, no chão entre a janela e a escrivaninha (decisão do usuário: dentro, para
não poluir a vila), uma caixa de ripas com um pacotinho de semente colorido por plano (até 6), saindo por trás da
frente. O tooltip diz quantos planos esperam código; o clique lista os planos, e cada um abre no leitor da biblioteca.
**Arquivos:** `server/src/sementes.ts` (novo), `server/src/world.ts` (`Project.sementes`), `web/src/api.ts`,
`web/src/game/interiorTextures.ts` (`seedBox`, `seedPacket0..5`), `web/src/game/InteriorScene.ts` (`fillSeedBox`),
`web/src/ui/sementes.ts` (novo), `web/src/ui/actions.ts`, `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado contra os projetos reais (com e sem a pasta, `README.md` fora) e o projeto falso do scratchpad. Posição da
caixa conferida pelas medidas da janela e da escrivaninha, não renderizada. Conferido na vila pelo usuário em
26/10/2026.

## 2026-10-26 — Casa em obra

**O que mudou:** passo 2 do plano `docs-dev/context/ambiente-de-ia-na-vila.md`. O servidor confere, em cada projeto,
a estrutura de acompanhamento dos guardrails: `CLAUDE.md`, `PENDENCIAS.md`, `PROGRESS.md`, `docs-dev/painel.json` e o
auditor (`scripts/auditar-referencias.py`); só leitura. Faltando qualquer um, a casa ganha um andaime na frente da
metade direita da fachada (postes, dois pisos de tábua e fita de obra). O tooltip diz o que falta; o clique abre o
painel com o que cada peça é e como resolver: `/novo-projeto` numa sessão da casa para os documentos, e
`~/Documents/IA/instalar-projeto.sh <caminho>` para o auditor.
**Arquivos:** `server/src/estrutura.ts` (novo), `server/src/world.ts` (`Project.missingStructure`), `web/src/api.ts`,
`web/src/game/textures.ts` (`scaffold`), `web/src/game/TownScene.ts`, `web/src/ui/obra.ts` (novo),
`web/src/ui/actions.ts`, `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado contra os projetos reais (mesmo resultado de uma conferência por shell) e o projeto falso do scratchpad.
Posição do andaime conferida pelas medidas da casa, do arbusto e da caixa de envio, não renderizada. Conferido na
vila pelo usuário em 26/10/2026.

## 2026-10-26 — ✦ Administrador da praça

**O que mudou:** decisão do usuário (26/10/2026): no lugar de um botão "Conferi" no sino, um agente permanente ao
lado do sino e do quadro de avisos. Ele tira dúvidas sobre os itens e, quando o usuário diz que conferiu, registra como
a sessão faria: lê o `CLAUDE.md` do projeto, troca "Falta conferir na vila" por "Conferido na vila pelo usuário em
DD/MM/AAAA", fecha o passo do plano em `a-codar/` e a pendência que esperava a conferência. Relato de problema não vira
conferência. Mesmos fundamentos da bibliotecária (`claude -p --no-session-persistence`, Sonnet, não vira morador);
a vila passa no prompt o que está no sino e no quadro, e libera `Edit` só para `PROGRESS.md`, `PENDENCIAS.md`,
`docs-dev/painel.json` e `docs-dev/a-codar/**` de cada projeto (o resto é negado: no `-p` não há diálogo). A execução
do `claude -p` saiu de `librarian.ts` para `consulta.ts` (base comum), e o painel de conversa da bibliotecária ficou
genérico, com uma conversa por agente.
Correção do sino: a regra casava a frase citada entre aspas (a própria entrega do sino sumia) e "falta conferir"
solto numa tabela; agora só as frases-padrão "Falta conferir na vila" / "Conferido na vila", fora de aspas e crases.
**Arquivos:** `server/agents/administrador.md` (novo), `server/src/administrador.ts` (novo), `server/src/consulta.ts`
(novo), `server/src/librarian.ts`, `server/src/index.ts` (`/api/administrador/ask`), `server/src/progress.ts`,
`web/src/ui/librarian.ts` (`openAdministrador`), `web/src/ui/actions.ts`, `web/src/game/TownScene.ts`, `README.md`,
`CLAUDE.md` (regra 5), `RETRABALHO.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Permissão
restrita testada num `claude -p` real (editou o arquivo liberado, foi negado no outro). Administrador testado num
projeto falso no scratchpad (git): "conferi o botão azul" trocou o texto no `PROGRESS.md`, fechou o passo no
`a-codar/` e a PD que esperava a conferência, e recusou editar código (US$ 0,09, 14s); "aparece, mas está cortado"
não alterou nenhum arquivo. Regra do sino testada contra os `PROGRESS.md` reais. Conferido na vila pelo usuário em
26/10/2026.

## 2026-10-26 — Sino de conferência na praça

**O que mudou:** passo 1 do plano `docs-dev/context/ambiente-de-ia-na-vila.md` (decisões do usuário em 26/10/2026). Na
praça, entre o canteiro e a árvore do canto, um sino num poste: lista as entregas do `PROGRESS.md` de todos os projetos
que dizem "Falta conferir" e ainda não dizem "Conferido na vila" (só leitura: a entrega sai quando a sessão troca o
texto). O sino também avisa o reinício pendente do próprio Dev Valley: `server/src` mais novo que o processo, ou
`web/src`/`web/index.html` mais novo que o último build (`web/dist`); a varredura roda no máximo a cada 15s. Com algo
na lista, o sino dá três balanços a cada 6s. O canteiro da praça foi de +40 para +34 para o poste caber.
**Arquivos:** `server/src/progress.ts` (`toCheck`), `server/src/reinicio.ts` (novo), `server/src/world.ts`
(`World.restart`), `server/src/index.ts`, `web/src/api.ts` (`bellCount`), `web/src/game/textures.ts` (`bell`,
`bell-post`), `web/src/game/TownScene.ts` (sino e `ringBell`), `web/src/ui/conferir.ts` (novo), `web/src/ui/actions.ts`,
`README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Leitor
testado contra os `PROGRESS.md` reais (a entrega da Fábrica, já conferida, fica de fora) e detector de reinício
testado (acusou o front alterado). Posição do sino conferida pelas coordenadas (largura das peças vizinhas), não
renderizada. Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-26 — Fábrica de agentes (PD-4)

**O que mudou:** decisões do usuário (26/10/2026, `docs-dev/context/fabrica-de-agentes.md`): a Fábrica mostra e edita
os agentes globais (`~/.claude/agents`) e os de cada projeto (`<projeto>/.claude/agents`); edição por formulário;
apagar com confirmação; cada agente vira um NPC ✦ em volta da Fábrica. O servidor (`agents.ts`) lista, lê, cria, salva e
apaga só dentro dessas pastas (nome do arquivo validado, caminho resolvido), compara a data do arquivo ao salvar (como a
biblioteca), escreve a descrição entre aspas quando ela tem `:` ou `#` e **preserva** campos do cabeçalho que o
formulário não conhece (ex.: `color`). Agente do Dev Valley (a bibliotecária) é só leitura e não é apagado. O mundo leva
a lista de agentes; o painel (mesmo layout da biblioteca) a acompanha ao vivo. Formulário: nome e lugar (só ao criar; o
nome não muda depois), descrição, ferramentas em caixas (nenhuma = todas as da sessão; ferramentas que o agente já tem
fora da lista aparecem junto), modelo (o mesmo da sessão, Sonnet, Opus, Haiku) e instruções. Até 8 NPCs ✦ passeiam no
pátio da Fábrica (a bibliotecária fica na biblioteca). A Fábrica deixou de ser "em construção".
Ajustes depois do primeiro teste do usuário (26/10/2026): (1) clicar num botão de painel acionava o que estivesse na
vila embaixo dele ("+ Novo agente" abria a biblioteca): o Phaser escuta o mouse na janela inteira; agora clique e hover
só valem quando começam no canvas da vila (`onCanvas` em `common.ts`), para todos os painéis. (2) Decisão do usuário:
clicar no NPC ✦ **abre uma conversa nova com o agente** (`claude --agent <nome>`), não a edição: agente de projeto na
pasta do projeto, global na praça (pasta pessoal). O servidor guarda a sessão pendente (`POST /api/agents/session`) e
o terminal passa o `--agent` ao abrir; o nome do agente não vai na URL. Conferido na vila pelo usuário em 26/10/2026
(PD-4 fechada; plano em `docs-dev/context/fabrica-de-agentes.md`).
**Arquivos:** `server/src/agents.ts` (novo), `server/src/world.ts` (`World.agents`), `server/src/index.ts`
(`/api/agents`), `web/src/api.ts`, `web/src/ui/factory.ts` (novo), `web/src/ui/actions.ts` (`talkToAgent`), `server/src/terminals.ts` (`--agent`),
`web/src/game/common.ts` (`AgentNpc`, `onCanvas`), `web/src/game/TownScene.ts` (`syncAgents`), `web/src/style.css`, `README.md`, `CLAUDE.md`.
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` (diretório temporário), auditor sem achado. Módulo de
agentes testado num HOME de teste: criar (global e projeto), nome repetido e inválido recusados, ferramenta com
caractere estranho filtrada, descrição com `:` e `#` entre aspas, `color` preservado ao salvar, conflito de data (409),
agente do Dev Valley protegido (403), caminho fora das pastas recusado, apagar. Falta conferir na vila (reinício do
usuário: o servidor mudou).

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
mensagem, testado no `claude plugin test` e conferido pelo usuário numa sessão nova em 26/10/2026 (PD-14 fechada). PD-11 e PD-13 fechadas; o plano
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
desenho, script no scratchpad). Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-25 — Quadro de avisos da praça e sinal só para P1

**O que mudou:** passo 2 do plano de representações visuais. O quadro de avisos da praça (antes só enfeite) agora
abre um painel com as pendências 👤 (decisão do usuário) de todos os projetos, agrupadas por projeto e com a
prioridade de cada uma; o tooltip diz quantas são. Decisão do usuário (25/10/2026): o "!" da fachada aparece **só com P1**
aberta (P2 não acende mais, para não alertar o tempo todo).
**Arquivos:** `web/src/ui/pendencias.ts` (`openUserPendencias`), `web/src/ui/actions.ts`, `web/src/game/TownScene.ts`
(quadro clicável, sinal só P1), `web/src/api.ts` (`urgentPendencias`).
**Testes:** `npm run typecheck -w server`, `tsc` + `vite build` do front (diretório temporário), auditor sem achado.
Conferido na vila pelo usuário em 26/10/2026.

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
Conferido na vila pelo usuário em 26/10/2026.

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
fora do navegador (mesmas funções de desenho). Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-25 — Avulsas encerradas voltam à praça

**O que mudou:** com o quintal só de vivas, as sessões avulsas encerradas ficaram sem lugar (a praça não tem
"dentro de casa"). Decisão do usuário (25/10/2026): na praça ficam todas as avulsas vivas e, se houver vaga, as encerradas
mais recentes, até 4 no total (regra antiga, agora fixa no código em `PLAZA_OFFLINE_LIMIT`). Os quintais das casas continuam só com vivas.
**Arquivos:** `web/src/api.ts` (`yardResidents`).
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Conferido na vila pelo usuário em 26/10/2026.

## 2026-10-25 — Quintal só com sessões vivas

**O que mudou:** o botão "Encerrar sessão" já matava o processo (conferido: SIGHUP encerra o `claude` e o `SessionEnd`
chega à vila), mas o NPC continuava no quintal porque ele mostrava as 4 sessões mais recentes, vivas ou não.
Decisão do usuário (25/10/2026): o quintal mostra **só sessões vivas**, valendo para qualquer sessão que termina (botão
da vila ou terminal fechado no VS Code). Encerrada, ela fica dentro de casa até ser retomada ou passar de
`sessionMaxAgeDays` (14 dias). Apagar o `.jsonl` foi descartado: é irreversível e quebra o `claude --resume`.
A config `sessionsPerProject` perdeu o uso e saiu.
**Arquivos:** `web/src/api.ts` (`yardResidents`), `server/src/config.ts`, `server/src/world.ts`, `server/src/index.ts`,
`web/src/game/TownScene.ts`, `dev-valley.config.json`, `README.md` (seção Configuração).
**Testes:** `npm run typecheck -w server`, `npm run build`, auditor sem achado. Conferido na vila pelo usuário em 26/10/2026.

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
