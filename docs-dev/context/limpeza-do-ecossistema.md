# Limpeza do ecossistema de IA (EC-1)

> Análise de 24/11/2026 (15 sugestões em 4 blocos, a partir da apresentação do mapa do ecossistema) e o que saiu dela.
> Feito: Blocos 1 e 2 e os itens 11, 12 e 13 do Bloco 3. Esperam decisão do usuário: itens 10 e 14 e o Bloco 4.
> O registro de cada entrega está no `PROGRESS.md` (24 e 25/11/2026); a pendência, em `PENDENCIAS.md` (EC-1, EC-3).

## O que foi feito

| # | Sugestão | Onde ficou |
|---|---|---|
| 1 | Agentes da vila fora das contas, menos a bibliotecária | `server/src/install-hooks.ts`, rule `instalador.md` |
| 2 | As 3 contas iguais | `CLAUDE.md`, `skills/`, `agents/` e `rules/` das contas DeepSeek são links para os do `~/.claude` (`perfil-pessoal.md`, D16) |
| 3 | `PROGRESS.md` arquivado por mês | `scripts/arquivar-progress.ts`, `docs-dev/progresso/` |
| 4 a 8 | Núcleo dos guardrails de 129 para 70 linhas, sem renumerar | `~/Documents/IA/guardrails-ia/guardrails-core.md`, `historico.md`, `~/Documents/IA/claude/rules/` |
| 9 | Mesma receita no `sobre-mim.md` e neste `CLAUDE.md` | regras 3, 4 e 9 em `.claude/rules/` |
| — | Teto do núcleo de ~120 para ~75 linhas e ~14 blocos | `TRIAGEM.md`, `/auditar-regras`, mapa do ecossistema |
| 11 | Seção "Suposições e como conferi" | G2 do núcleo e campo "Suposições a conferir" do briefing do maestro |
| 12 | Medir os disparos de cada regra | mod `guardrails` 0.3.0 grava `~/.claude/guardrails-disparos.json` (só nomes e números) |
| 13 | Alertas de saúde no início da sessão | mod `guardrails` 0.3.0: cópia carregada diferente da fonte, núcleo acima do teto |

Achado no caminho: as 3 contas rodavam uma cópia do mod `guardrails` de 22/10 (versão não subia). Corrigido com a 0.2.0,
e o alerta do item 13 existe para isso não voltar.

## Para conferir depois de uma semana de uso

Nesta sessão, o Claude Code avisou várias vezes que hooks do `guardrails` foram **pulados** ("`cc-plugin-sec-default`
roda primeiro e passou o evento adiante"), tanto o `tool.check` quanto o `classic.Stop`. Se isso for frequente, os guardas
que dependem desses eventos (G3, G13, G18, G19, G14 e a trava do G5) valem menos do que parece. A contagem do item 12
responde: em `~/.claude/guardrails-disparos.json`, comparar `chamadas.Bash` com `avaliacoes["G3/G20"]` e
`avaliacoes.G18`, e `chamadas.escrita` com `avaliacoes.G13`. Avaliações bem abaixo das chamadas = guarda pulado.
Guarda com zero disparo em um mês é candidato a sair ou virar outra coisa (`/auditar-regras`).

## Decisões que esperam o usuário

### Item 10 — Uma worktree por sessão do porão (MA-4)

A MA-4 dizia: só se as rodadas começarem a travar por conflito de arquivo. Analisado em 25/11/2026 (a primeira versão
deste texto errou a data e a causa):

- **O único choque de escrita registrado (rodada de 11/11) não foi conflito entre tarefas.** O cartão estava certo:
  nenhuma tarefa que rodava junto declarava arquivo de outra (só duas repetiam arquivos, e uma dependia da outra). A
  tarefa que perdeu o trabalho foi aberta **duas vezes** pela corrida entre o clique em "Abrir" e a volta automática
  (`RETRABALHO.md`, 11/11); as duas cópias tinham o mesmo nome de tarefa, e por isso o hook de posse deixou passar. A
  corrida foi corrigida no mesmo dia (trava única em `server/src/porao.ts`) e é coberta por
  `server/tests/porao-propriedades.test.ts`. Nas 5 rodadas seguintes, nenhuma devolutiva fala de choque de escrita.
- **O que as devolutivas mostram de verdade é o ambiente compartilhado**, não o arquivo: suíte rodada por duas sessões ao
  mesmo tempo sujando a mesma pasta de build (uma rodada com centenas de erros falsos, verdes na segunda tentativa);
  dependência do front não instalada e banco local fora do ar derrubando o gate por motivo de ambiente; e arquivos de
  outra sessão misturados na árvore na hora do commit.

Conclusão: a condição da MA-4 **não aconteceu**. Worktree resolveria o build e o commit misturado, mas cobraria
instalar dependências e separar banco e portas por sessão, e traria o merge no fim. O estudo de 25/11 sobre execução
paralela está em `docs-dev/context/execucao-paralela-estudo.md`.

### Item 14 — Sessões curtas

É hábito, não código: uma tarefa por sessão e passar o bastão quando o contexto passa da metade (o Dev Valley já tem o
bastão e mostra o contexto no rodapé). Uma checagem possível, se o usuário quiser: o mod avisar uma vez quando o contexto
passa de ~60%, sugerindo o bastão. Não codado: depende de o engine expor o uso de contexto ao mod, e de o usuário querer
o aviso.

### Bloco 4 (item 15) — O que pode ir para a DeepSeek

Hoje (`agentes.conta` = DeepSeek trabalho, decisão de 19/11/2026) os agentes da vila que só leem respondem na DeepSeek,
inclusive nas casas de trabalho. O que cada um manda ao provedor:

| Agente | O que lê e manda ao modelo | Material da empresa? |
|---|---|---|
| Escrevente | o diff do que vai para o time | sim: código |
| Jornaleiro e jornaleiro da conversa | mensagens de commit dos projetos | sim: o que mudou nos sistemas |
| Maestro mirim | `git status/diff/log` da rodada | sim: código |
| Crítico do cartão | briefings e arquivos do projeto | sim: código |
| Bibliotecária | regras, memórias e docs de conhecimento | sim: contexto de negócio |
| Médica | processos e comandos da sessão examinada | às vezes: caminhos e argumentos |

A sessão de trabalho na conta DeepSeek trabalho também manda código ao provedor, pela mesma razão.

**Recomendação:** a conta dos agentes passa a seguir a **finalidade da casa**: casa de trabalho responde no Claude
(Haiku, que custa pouco), casa pessoal na DeepSeek. Mantém a vantagem de ter os agentes vivos quando o Claude está no
limite nos projetos pessoais, e o material da empresa só vai para o provedor que a empresa já usa. A decisão é do
usuário, e talvez da empresa (política de dados); por isso nada foi mudado. Código, quando decidido: `agentes.conta`
vira um mapa por finalidade em `server/src/config.ts`, e `consulta.ts` escolhe pela casa da consulta.
