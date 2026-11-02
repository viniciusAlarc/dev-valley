# Torre do relógio: os limites do plano dentro da vila

> **Implementado em 02/11/2026.** Planejado e codado no mesmo dia; saiu de `docs-dev/a-codar/`.

## Por que

A parte de cima da vila (biblioteca, praça e Fábrica) está vazia. Hoje os limites do plano ficam num painel HTML por cima
do jogo, no canto inferior esquerdo (`web/src/ui/usage.ts`). A torre leva essa informação para dentro da vila, sem
criar dado novo.

## Na vila → por baixo

| Na vila | Por baixo |
|---|---|
| Ponteiro do relógio | % usado da sessão de 5h (`rows` com `kind` `session`/`five_hour` do `/api/statusline`) |
| Céu atrás da torre: sol nascendo → sol a pino → lua | % usado da semana (`weekly_all`/`seven_day`) |
| Sino da torre normal / amarelo / vermelho | `severity` da pior linha: `normal` / `warning` (≥ 75%) / `critical` (≥ 90%) |
| Texto ao passar o mouse | "5h: 30%, volta às 14h · Semana: 12%, volta na quinta" |
| Clique | Abre o mesmo conteúdo do painel atual (todas as linhas, inclusive as semanais por modelo) |
| Sem dado (nenhuma sessão mandou status line ainda) | Relógio parado, sem ponteiro |

## Dados

Nada novo no servidor: `World['usage']` já chega à `TownScene` (é o que o `usage.ts` lê).

## Onde fica

Na faixa de cima, num dos vãos entre a biblioteca e a praça ou entre a praça e a Fábrica (`layout.ts`, `reserved`).
A posição exata sai da prévia (`web/sprites.html`), dividindo os vãos com o moinho e a banca de jornal.

## Passos

1. Textura da torre em `web/src/game/textures.ts` (corpo, mostrador, sino em 3 cores), prévia em `web/sprites.html`.
2. Reservar o lote em `layout.ts` (`clockTower`), com caminho até a rua cívica, como a biblioteca.
3. Na `TownScene`: desenhar, atualizar ponteiro, céu e sino a cada `World` novo, `makeInteractive` com o texto e o clique.
4. Tirar o painel do canto ou deixá-lo (ver decisão 1). O conteúdo do clique reaproveita a função de montar linhas do
   `usage.ts`.
5. Teste em `web/tests/`: função pura de "% → ângulo do ponteiro / fase do céu / cor do sino", com os limites 75 e 90.
6. `README.md` (linha "Painel Uso do Claude" vira "Torre do relógio"), `PROGRESS.md`.

## Decisões (usuário, 02/11/2026: "segue as recomendações")

1. O painel fixo do canto saiu; a torre substitui, e o clique dela abre os limites (`web/src/ui/usage.ts`, `openUsage`).
2. A torre mostra só os limites do Claude. Ela só muda quando o status line traz `rate_limits` (`StatusLineStore`
   ignora reporte sem esse campo), e esse campo vem dos limites do plano da Anthropic. Não conferido numa sessão do perfil
   pessoal (DeepSeek): se um dia vier `rate_limits` de lá, a torre misturaria os dois.

## Como ficou

- Estado puro em `web/src/game/torre.ts` (`estadoTorre`): ângulo do ponteiro, céu (`manha`, `dia`, `tarde`, `noite`,
  em faixas de 25%) e sino (pior `severity` de todas as linhas, inclusive as semanais por modelo). Testes em
  `web/tests/torre.test.ts`.
- Arte em `web/src/game/textures.ts` (`clockTower`, `TOWER`): corpo com o vão do campanário vazado, céus e sinos
  separados; o ponteiro é desenhado pixel a pixel pela `TownScene` (`buildTower`/`updateTower`).
- Layout: a linha cívica ganhou largura mínima de 5 lotes (`CIVIC_MIN_W`) para caber torre, banca e moinho; com menos
  casas por linha, as casas ficam centralizadas. Os lotes da banca e do moinho já ficaram reservados.
