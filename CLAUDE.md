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

Vila, interior das casas, status ao vivo, biblioteca, bibliotecária e painel de uso prontos. Contas com nome (Claude,
DeepSeek pessoal e DeepSeek trabalho) e a tela de escolha da sessão nova prontas.
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
    `administrador.ts` (administrador da praça), `mirim.ts` (maestro mirim: dúvidas da rodada, só lendo), `critico.ts` (crítica do cartão do porão: segunda opinião do DeepSeek, conferida pelo Haiku), `clinica.ts` (clínica: triagem, sinais vitais e a ficha da médica), `agents.ts`/`skills.ts`/`plugins.ts` (Fábrica: agentes, skills e, só leitura, plugins e MCP), `gasto.ts` (moinho: gasto por projeto), `jornal.ts` (banca de jornal), `perfil.ts` (contas do Claude Code: Claude, DeepSeek pessoal e DeepSeek trabalho; a conta padrão da casa vem da raiz e a sessão escolhe a conta), `bastao.ts` (passagem de bastão: resumo e sucessor), `reinicio.ts` (sino:
    reinício pendente), `estrutura.ts` (casa em obra e
    placa de vistoria), `sementes.ts` (caixa
    de sementes), `retrabalho.ts` (ervas do quintal), `porao.ts` (porão da casa: quem é do maestro), `quarto.ts` (quarto da casa: quem dorme), `rodada.ts` (estado da rodada, devolutivas e relatório montado pela vila), `gate.ts` (porão: testes do cartão antes e depois da rodada), `relatorios.ts` (estante de partitura do porão: relatórios do maestro, novo até abrir), `quadro.ts` (quadro negro), `notas.ts` (quadro de avisos da praça: notas do usuário, em `~/.claude/dev-valley`), `estante.ts` (estante), `lareira.ts` (lareira: tabela "Subir" e portas), `pombal.ts` (pombal: commit, pull e push), `escrevente.ts` (pombal: sugerir texto do commit), `guardrails.ts`
    (outdoor), `install-hooks.ts`.
  - `agents/bibliotecaria.md`: agente instalado em `~/.claude/agents`; `agents/administrador.md`, `agents/maestro-mirim.md`, `agents/critico-do-cartao.md`, `agents/verificador-do-cartao.md`, `agents/escrevente.md`, `agents/medica.md`, `agents/jornaleiro.md` e `agents/jornaleiro-conversa.md` (sem ferramenta: `--tools ""`): usados só pela vila.
- `mod/` — mod do Claude Code (`mod/hooks/register.ts`, lógica em `mod/hooks/moradores.ts`, testes em `mod/tests/`): eventos de
  sessão, rodapé com contexto e uso, nomes dos moradores e `@Nome`. Marketplace local em `.claude-plugin/`.
- `web/` — Vite + Phaser 3 (vila), xterm.js (chat), Monaco (diff), marked + DOMPurify (leitor de docs).
  - `src/game/` cenas Phaser (`TownScene`, `InteriorScene`, `LibraryScene`, `FactoryScene`, `PoraoScene`, `QuartoScene`, `ClinicaScene`) e pixel art gerada em código.
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
  com imitações; teste que usa classe que grava em `~` troca o `HOME` antes do `import`, como
  `rotas-fabrica-biblioteca.test.ts`; git em remoto e clones de mentira, isolado do `~/.gitconfig`, como
  `pombal.test.ts`). Cobre leitores, estado da lareira, travas de segurança, as 66 rotas e o pombal; WebSockets e front
  seguem validados com typecheck + build e na vila. O CI do GitHub roda typecheck do servidor, `npm test` e `npm run build` a cada push
  (job `testes` em `.github/workflows/auditor.yml`). Nada vermelho em 22/11/2026 (337/337). O hook `Stop` do `.claude/settings.json` roda
  `scripts/conferir-ao-parar.sh`: a sessão que editou `.ts` daqui só termina a resposta com os tipos do servidor e do front
  passando (G4 cobrado pelo harness, 08/11/2026).
- Mod: `claude plugin validate mod` e `claude plugin test mod`.
- Prévia dos moradores em PNG, sem navegador: `npx tsx scripts/previa-moradores.ts <saida.png> [quantos|catalogo]`.
- Auditor de referências: `python3 scripts/auditar-referencias.py . --tudo` (o CI do GitHub roda o mesmo com
  `--sem-home`, em `.github/workflows/auditor.yml`)
- Mod e agentes: `npm run hooks:install` / `npm run hooks:uninstall`

## Regras técnicas deste projeto — invioláveis

1. **Repositório público.** Os projetos que aparecem na vila são privados: nunca escrever aqui nome, caminho,
   trecho ou dado deles (nem em exemplo, teste, commit ou print). Caminho pessoal vai no
   `dev-valley.config.local.json`.
2. **O servidor escuta só em `127.0.0.1` e recusa WebSocket de outra origem:** os terminais rodam comandos de
   verdade. Nunca afrouxar isso.
3. **O mod (`mod/`) e os hooks de permissão mandam à vila só `session_id`, `cwd`, nome do evento, tipo de
   notificação, a categoria da ferramenta em uso (`ler`, `editar`, `rodar`, `web`, `agente`) e os ids das sessões
   citadas com `@Nome`** (e contexto/limites no `/api/statusline`). Nunca conteúdo de
   arquivo ou prompt, nem o nome digitado: o prompt é lido **só localmente**, para achar `@Nome` no mapa
   `~/.claude/dev-valley/moradores.json`; os ids citados servem aos NPCs conversando (decisão do usuário, 30/10/2026); a categoria desenha o balão de quem trabalha,
   nunca leva o nome da ferramenta, o arquivo nem o comando (decisão do usuário, 08/11/2026). O
   teste `mod/tests/dev-valley.test.ts` confere isso.
4. **`hooks:install` instala o mod (`claude plugin install`) e mexe em `~/.claude/settings.json` (global, com
   backup) só nas entradas do Dev Valley (os hooks de shell de `PermissionRequest` e `Notification`; o mod não vê
   quando o diálogo de permissão abre):** nunca sobrescreve agente do usuário com o mesmo nome, e o
   uninstall remove só o que é do Dev Valley.
5. **Consultas da bibliotecária, do administrador da praça, do maestro mirim, da médica da clínica, do escrevente do pombal, do jornaleiro da banca e do crítico e do verificador do cartão usam `claude -p --no-session-persistence`** para não
   virarem moradores (base comum em `server/src/consulta.ts`). **Os agentes que só leem** (bibliotecária, maestro
   mirim, médica, escrevente, jornaleiro, jornaleiro da conversa e crítico do cartão) **respondem na conta DeepSeek de `agentes.conta`**
   do config local, com a mesma trava de chave do terminal, para continuarem disponíveis quando o Claude está no
   limite; o **administrador**, único que edita arquivos, continua no Claude (decisão do usuário, 19/11/2026).
   **O administrador só edita `PROGRESS.md`,
   `PENDENCIAS.md`, `docs-dev/painel.json` e `docs-dev/a-codar/` dos projetos da vila**, por regra `Edit(//caminho)`
   passada na chamada; nunca liberar `Edit` inteiro nem outra ferramenta de escrita para ele. **O maestro mirim só lê** (Read, Grep, Glob e `git -C <projeto> status/diff/log/show`, em modo estrito: o
   resto é negado mesmo com o `auto` do usuário) e não fala com o maestro nem com as sessões (decisão do usuário, 04/11/2026). **A médica também só lê** (Read, Grep e Glob,
   em modo estrito; a ficha com processos e máquina vem montada pela vila) e não fala com a sessão examinada nem encerra
   processo (decisão do usuário, 09/11/2026). **O crítico do cartão e o verificador dele só leem** (Read, Grep e Glob,
   em modo estrito; o verificador fica no Claude, Haiku, para a outra família conferir) e **só avisam** no cartão do
   porão: nunca bloqueiam o clique nem mexem no briefing (decisão do usuário, 21/11/2026).
6. **Este repositório costuma ser editado de dentro da própria vila.** Reiniciar o servidor (`npm start` de novo,
   `npm run dev`, que reinicia sozinho ao salvar em `server/`) encerra todos os terminais da vila, inclusive a
   sessão que está editando. Nunca reiniciar nem rodar `npm run dev` por conta própria: avisar o usuário e ele
   reinicia quando as sessões terminarem (G21). O `.claude/settings.json` do repositório nega `npm start` e `npm run dev` às sessões
   (regra dura, 08/11/2026): o usuário reinicia pelo próprio terminal.
7. **Pixel art é gerada em código** (`web/src/game/textures.ts`, `interiorTextures.ts`; ícones do balão em grade de
   caracteres em `iconesBalao.ts`; moradores em `villagerArt.ts`,
   sem Phaser); prévia em `web/sprites.html` e, dos moradores, em PNG por `scripts/previa-moradores.ts` (o `catalogo`
   mostra cada peça). A aparência do morador combina com a marca do nome (`generoDoNome` no servidor): barba nunca em
   nome feminino, vestido e laço nunca em masculino (decisão do usuário, 31/10/2026). A roupa (camisa, calça, jaqueta,
   acessório, lenço) segue o provedor da conta da sessão: tons quentes no Claude, frios no DeepSeek (`paletaDo`); pele,
   cabelo e penteado nunca mudam com o provedor (decisão do usuário, 02/11/2026; vocabulário de contas em 19/11/2026).
8. **Todo agente (NPC ✦) veste o traje de agente secreto**, estilo "homens de preto": paletó e calça pretos, camisa
   branca, gravata e óculos escuros; só pele e cor do cabelo variam. É o que separa agente de sessão à primeira vista
   (decisão do usuário, 27/10/2026). Vale para os da Fábrica (automático na `AgentNpc`) e para qualquer agente da
   vila novo: desenhe com `villagerTexture(scene, id, true)`, nunca com a aparência sorteada dos moradores. Agente da vila
   novo entra na lista que reserva a combinação de pele × cabelo em `villagerArt.ts`, para nenhum agente sair igual a ele.
   **Exceção única: a médica da clínica** (`MEDICA_ID`) usa o traje com jaleco por cima, máscara, estetoscópio e coque
   (decisão do usuário, 09/11/2026). Nenhum outro agente ganha acessório de ofício sem decisão do usuário.
9. **O pombal (`server/src/pombal.ts`) faz push numa branch que outras pessoas podem usar.** Push só por clique
   confirmado no painel e só de página local, nunca `--force` (o git só aceita fast-forward). Conflito no rebase sempre
   termina em `rebase --abort` (o repositório fica como estava).
10. **Sessão de trabalho do porão (`server/src/porao.ts`) só nasce de uma tarefa que o usuário aprovou no cartão.** O
   maestro pede pela rota (`curl` local), mas aprovar e recusar exigem `Origin` local presente (a página), nunca só a
   ausência dele. O clique aprova a rodada inteira: a tarefa com `dependeDe`, listada no cartão, a vila abre sozinha
   quando as donas ficam prontas; nenhuma tarefa fora do cartão abre (decisão do usuário, 11/11/2026). Teto de 5 sessões
   por rodada (o config só baixa; conta também as que esperam a vez; o padrão de 3 é só do agente, a rota aceita até 5),
   e cada sessão é anotada no `porao.json` antes de o
   terminal abrir (decisão do usuário, 03/11/2026). A vila conduz a rodada pelo `rodada.json` (`server/src/rodada.ts`,
   único escritor: a vila) e passa às sessões de trabalho, só a elas e por `--settings`, os hooks de
   `scripts/porao-hook.sh` (devolutiva ao parar, posse de arquivo). **Gate (maestro v3, `server/src/gate.ts`):** a vila
   roda os comandos de teste do cartão (os que passaram por `validarPermissoes`), sem shell, antes de abrir as sessões
   (linha de base) e com todas prontas, antes do relatório; saída só em arquivo da pasta da rodada, nunca no
   `rodada.json`. Gate vermelho só avisa (relatório "Reprovada" e ❗ na estante): nenhuma sessão é reaberta (decisão do
   usuário, 11/11/2026). A sessão do roteiro de testes (uma por rodada, pedida
   pela vila quando uma devolutiva diz `mexeu_em_tela: sim`) também só nasce do clique, mas na **casa**: não é anotada,
   não conta no teto e o gongo não a apaga (decisão do usuário, 05/11/2026).

## Regras de processo deste projeto

- Mensagens de commit em português, uma linha descrevendo a entrega (ver `git log`).
- **Ao final de cada entrega:** `PROGRESS.md` na mesma resposta (G5); `PENDENCIAS.md` se algo abriu ou fechou;
  `docs-dev/painel.json` só quando uma fase avança ou fecha (G14); `OPERACAO.md` se mudou o jeito de subir.
- **Gate de fechamento:** `npm test`, `npm run typecheck -w server` e `npm run build` sem erro, auditor sem achado, e a
  mudança conferida na vila pelo usuário (o reinício é dele, regra 6).
