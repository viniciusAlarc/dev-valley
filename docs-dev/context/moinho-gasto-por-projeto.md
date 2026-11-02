# Moinho: quanto cada projeto gasta

> **Implementado em 02/11/2026.** Planejado e codado no mesmo dia; saiu de `docs-dev/a-codar/`.

## Por que

"Custo de token importa" é regra de trabalho, mas hoje não há como ver **onde** o gasto está. A torre do relógio diz
quanto do plano foi usado; o moinho diz **com o quê**.

## Na vila → por baixo

| Na vila | Por baixo |
|---|---|
| Moinho girando; velocidade das pás | Total de tokens da semana em todos os projetos (gira devagar em semana calma) |
| Clique | Painel com uma barra por projeto: "X ficou com 45% do gasto da semana", do maior para o menor |
| Dentro da barra, ao expandir | As 3 sessões que mais gastaram naquele projeto (nome do morador, não o id) |
| Sessões fora de projeto | Linha "Praça (sessões avulsas)" |

Texto humano: porcentagem e comparação ("o dobro da semana passada"), nunca número cru de token como destaque. O número
fica em letra pequena para quem quiser.

## Dados (conferido em 02/11/2026)

Cada linha `type: "assistant"` dos `.jsonl` em `~/.claude/projects/**` tem `message.usage` com `input_tokens`,
`output_tokens`, `cache_creation_input_tokens` e `cache_read_input_tokens`, mais `message.model` e o `timestamp`.
O `sessions.ts` já lê esse campo para o contexto (`contextTokens`). Pular `isSidechain` não: subagente também gasta.
Pular `model: "<synthetic>"`.

Projeto = `cwd` da sessão, casado com as casas como o `world.ts` já faz. Os dois perfis (`projectsDirs`).

## Desempenho

Os `.jsonl` podem ter dezenas de MB. Ler incremental: guardar por arquivo o tamanho já lido e os totais por dia em
`~/.cache/dev-valley/gasto.json`; a cada passada, ler só o que cresceu. Recalcular no máximo a cada poucos minutos, não a
cada evento.

## Passos

1. `server/src/gasto.ts`: leitura incremental, soma por projeto × dia × perfil, cache em disco.
2. Rota `GET /api/gasto?dias=7` em `app.ts` (via `Contexto`, como as demais), teste em `server/tests/` com `.jsonl` de
   mentira (`projeto()`), incluindo arquivo que cresce entre duas leituras.
3. Textura do moinho (pás num sprite separado para girar), prévia em `web/sprites.html`; lote em `layout.ts`.
4. `TownScene`: velocidade das pás; painel `web/src/ui/gasto.ts`.
5. `README.md` (linha nova na tabela), `PROGRESS.md`.

## Decisões (usuário, 02/11/2026: "segue as recomendações")

1. Peso = entrada + saída + criação de cache + leitura de cache ÷ 10. Não é custo em reais: é o peso relativo.
2. Janela = a semana do plano (pelo `resetsAt` do limite semanal, a mesma da torre); sem ele, os últimos 7 dias.
3. Perfil pessoal (DeepSeek) em lista separada no painel.

## Como ficou

- `server/src/gasto.ts` (`Gasto`): leitura incremental dos `.jsonl` dos dois perfis (inclusive `<sessão>/subagents/`),
  totais por hora em `~/.cache/dev-valley/gasto.json`, cálculo guardado por 2 minutos. **O Claude Code grava a mesma
  resposta em várias linhas** (uma por bloco, com o mesmo `usage`): cada `message.id` conta uma vez só (numa conversa
  real, 174 linhas eram 81 respostas). Rota `GET /api/gasto`; testes em `server/tests/gasto.test.ts`.
- Comparação pelo **ritmo**: o gasto até agora contra a semana passada inteira, descontando quanto da semana já passou
  (`web/src/ui/gasto-texto.ts`, testes em `web/tests/gasto-texto.test.ts`). Uma volta das pás leva 6 s no mesmo ritmo,
  de 1,5 s a 16 s.
- Arte em `textures.ts` (`windmill`, `WINDMILL`), pás numa peça separada; `TownScene.buildWindmill` lê a rota ao montar e a
  cada 5 minutos. Painel em `web/src/ui/gasto.ts`.
