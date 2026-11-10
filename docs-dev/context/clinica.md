# Clínica e a médica (no lugar da torre do relógio)

> Decidido com o usuário em 09/11/2026 e implementado no mesmo dia (etapa 1 e a etapa 2, CL-1); saiu de `docs-dev/a-codar/`.
> Falta só a conferência na vila, depois do reinício.

## Por que

O usuário costuma abrir uma sessão nova só para conferir se outra, que está demorando, está trabalhando ou travada, e se
deve intervir. A médica faz esse exame com o que a vila já sabe (hooks, `.jsonl`, contexto) mais os processos do
terminal, sem ele precisar abrir uma sessão nem a sessão nova ler a conversa inteira. A torre do relógio estava vazia de
informação: a clínica fica no lugar dela e leva os limites do plano para dentro.

## Decisões (usuário, 09/11/2026)

1. **Clínica no lote da torre do relógio**, que sai da vila. Os limites do plano (o que a torre mostrava) vão para o
   monitor de sinais vitais da clínica; a cruz da fachada muda de cor como o sino da torre (normal, ≥ 75%, ≥ 90%) e o
   texto ao passar o mouse é o mesmo da torre. O moinho fica como está.
2. **A médica é chamada só pelo usuário**: pela clínica (maca de triagem ou a própria médica) e pelo atalho
   "🩺 Chamar a médica" do morador (painel do terminal e o aviso de "ocupado" da sessão aberta fora da vila). Nada de
   aviso automático por enquanto.
3. **É uma médica (Dra. Lia)**, de traje de agente secreto (regra 8) com jaleco por cima do terno, máscara e
   estetoscópio. Exceção à regra 8 escrita na própria regra. Penteado de coque (o único que muda do padrão do agente).
4. **Por dentro**: maca de triagem (os moradores vivos, um por linha, com estado, há quanto tempo, contexto e o comando
   rodando), monitor de sinais vitais (limites do plano e o WSL: memória, swap, carga, disco) e a mesa da médica.
5. **Etapa 2 (CL-1)**: armário dos "pacientes esquecidos" (processos `claude` fora dos terminais da vila, servidores fora
   da lareira, containers Docker de pé). Só aponta; quem encerra é o usuário.

## Como (etapa 1)

| Na vila | Por baixo |
|---|---|
| Cruz da fachada (cor) e texto do mouse | `estadoDosLimites` (`web/src/game/limites.ts`, antigo `torre.ts`) |
| Monitor de sinais vitais | `/api/clinica` (`vitais`: `/proc/meminfo`, `/proc/loadavg`, `statfs` da home) e `world.usage` |
| Maca de triagem | `/api/clinica` (`pacientes`): mundo + `HookStore` + processos filhos do terminal (`/proc`) |
| Médica | `POST /api/clinica/medica` (NDJSON, só pela página): `claude -p --no-session-persistence` com o agente `server/agents/medica.md`, Read/Grep/Glob em modo estrito, ficha do paciente no começo |

- `server/src/clinica.ts`: leitura de `/proc` (pasta trocável para teste), ficha do paciente, `askMedica`.
- Processo da sessão: o `pid` do terminal da vila; fora da vila, o processo `claude` com o id da sessão na linha de
  comando (sem ele, a ficha diz que não achou). CPU por duas leituras com 1 s de intervalo.
- A médica não fala com a sessão, não edita, não roda comando e não encerra processo.

## Como (etapa 2, CL-1: armário)

| Na vila | Por baixo |
|---|---|
| Armário, encostado na parede | `GET /api/clinica/armario` → `Clinica.armario()` (`procurarEsquecidos` + `docker ps`) |
| "Claude fora da vila" | Processos cujo executável é `claude`, fora da árvore do servidor da vila e sem pai `claude`; morador vivo fora da vila na mesma pasta = "provavelmente Fulano" |
| "Servidores fora da lareira" | Portas `LISTEN` de `/proc/net/tcp`/`tcp6`, achadas pelo inode nos `fd` de cada processo; fora da árvore da vila (terminais, lareiras, consultas) e sem o `.vscode-server` (o próprio VS Code escuta portas) |
| "Containers Docker de pé" | `docker ps --format '{{json .}}'` (prazo de 4 s); sem Docker, um aviso no lugar |

- Cada item mostra idade, memória, pasta e a linha para encerrar (`kill <pid>`, `docker stop <nome>`), **para o usuário
  rodar**: a vila não encerra nada (decisão 5).
- Processo de outro usuário (root) não deixa ler os `fd`: não aparece como servidor. O `docker-proxy` dos containers é
  root; o container aparece na seção dele.

## Ajuste de 09/11/2026 (decisão do usuário)

- **Limites do Claude e a máquina (WSL) voltam ao canto inferior esquerdo** (`web/src/ui/limitesHud.ts`, linhas em
  `limites-texto.ts`): dentro da clínica ficava difícil de achar. Minimizável em chips (`5h`, `7d`, `Mem`); a máquina vem
  de `GET /api/clinica/vitais` (só `/proc/meminfo`, `loadavg` e o disco, sem a amostra de processos da triagem), a cada 30 s.
  O monitor de sinais vitais da clínica continua com o detalhe, e a cruz da fachada continua com a cor do pior limite.
- **Planta da clínica:** triagem à esquerda (monitor na cabeceira da maca), consultório à direita (mesa da médica, com
  rótulo, e o armário na parede atrás), corredor do meio livre da porta ao fundo; rótulos dos dois lados na mesma linha.

## Monitor de sinais vitais removido (10/11/2026, decisão do usuário)

Com os limites e a máquina no canto da tela, o monitor da clínica ficou inútil e saiu: a peça, a textura `monitorVital` e
o painel "Sinais vitais". A maca ficou espelhada com a mesa da médica em relação ao corredor. O que segue valendo da lista
acima: a cruz da fachada; `/api/clinica` ainda devolve `vitais`, porque a ficha da médica usa.

