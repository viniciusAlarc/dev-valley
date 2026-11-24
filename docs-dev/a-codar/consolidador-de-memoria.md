# Consolidador de memória: o "sonho" que só propõe

> Decidido em 24/11/2026, depois de uma pesquisa sobre memória entre sessões (Anthropic, OpenAI Codex, GitHub
> Copilot, Gemini CLI, Letta, comunidade). No mesmo dia o auto-dream nativo do Claude Code foi desligado nas três
> contas (`autoDreamEnabled: false`): ele só mexe na pasta `memory/`, que quase não tem nada, e não conhece as regras
> versionadas. Pendência MC-1 no `PENDENCIAS.md`.

## O que é

Um agente da vila (NPC ✦, regra 8) que, de tempos em tempos, **lê** o que a vila já registra e devolve **propostas**
numa caixa de entrada. Ele nunca aplica nada: quem aprova é o usuário. É o formato em que as fontes convergem
(Copilot Dreaming abre PR, Gemini Auto Memory usa `/memory inbox`, Claude Dreams gera um store novo para revisar).

O que ele aponta, por projeto da vila:

1. `RETRABALHO.md` com três linhas ou mais da mesma causa: "checagem pedindo para nascer" (G15, G17).
2. Memória da pasta `memory/` que contradiz uma regra versionada, que repete o que já está no `CLAUDE.md` ou que
   está sem data.
3. Pendência parada no `PENDENCIAS.md` há muito tempo, ou que o código indica já estar feita (G12).

## Como (a confirmar ao codar)

1. Mesmo molde dos agentes que só leem: `claude -p --no-session-persistence` pela base de `server/src/consulta.ts`,
   na conta DeepSeek de `agentes.conta` (regra 5), agente `consolidador.md` em `server/agents/`, com `Read`, `Grep` e
   `Glob` em modo estrito.
2. Nada de reler os transcripts `.jsonl` crus: a comunidade relata custo alto e ruído. A entrada são os arquivos de
   rastro e as memórias, que já são o destilado.
3. Cada proposta leva arquivo, trecho e o porquê (proveniência), para o usuário aprovar ou descartar.

## Pontos em aberto

- 👤 Onde mora na vila (prédio novo, praça, biblioteca) e como a caixa de entrada aparece.
- 👤 Gatilho: botão, ou automático (intervalo, quantas sessões desde a última vez).
- 👤 O que o "aprovar" faz: só marca como lida, ou abre uma sessão para aplicar a proposta.
- 👤 Cobre o `~/Documents/IA` também (núcleo dos guardrails) ou só os projetos.
