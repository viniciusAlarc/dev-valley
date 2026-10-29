# Dev Valley — Progresso

> Memória oficial do projeto (guardrail G5). Toda mudança de código entra aqui,
> na mesma resposta que a produziu. Mais recente no topo.

## 2026-10-29 — Testes automatizados, passo 1: leitores, lareira e travas de segurança (PD-8)

**O que mudou:** passo 1 do plano `docs-dev/a-codar/testes-automatizados.md` (decisões do usuário em 29/10/2026:
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
`package.json` (`test`), `server/tsconfig.json`, `CLAUDE.md` (comando e gate), `docs-dev/a-codar/testes-automatizados.md`
(novo), `PENDENCIAS.md`, `docs-dev/painel.json`.
**Testes:** `npm test` 34/34. Prova de que pegam bug: três estragos de propósito (sem a trava do ponto, sem o separador
de pasta na comparação, item riscado contando) fizeram 3 testes falharem; código restaurado e 34/34 de novo.
`npm run typecheck -w server` e `tsc` + `vite build` (pasta temporária) sem erro, auditor sem achado. Falta conferir na
vila (reinício do usuário): o `/api/arquivo` e os WebSockets agora usam as funções extraídas; abrir um link de arquivo
no terminal da vila confere os dois.
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
saiu com o título do `<title>`. Falta conferir na vila (reinício do usuário).

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
