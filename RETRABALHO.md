# Dev Valley — Retrabalho

> Guardrail G17: uma linha por retrabalho causado por suposição, invenção ou ferramenta cara à toa, com data e causa.
> Três linhas da mesma causa pedem um guardrail novo.

| Data | O que foi refeito | Causa |
|---|---|---|
| 2026-10-26 | Rolagem dos painéis de leitura (retrabalho, sino, obra, sementes, pendências, horta): a lista longa ficava cortada | Copiei o padrão do painel de pendências sem conferir que, no painel grande, o corpo tem `overflow: hidden` e quem rola é um bloco interno; testei só com listas curtas |
| 2026-10-26 | Regra do sino de conferência refeita: casava a frase citada entre aspas (sumiu a própria entrega do sino) e "falta conferir" solto numa tabela de outro projeto | Supus que "falta conferir" só aparece como marcação; testei contra os arquivos reais mas não conferi cada item da lista |
| 2026-10-26 | Mod dev-valley (PD-11) reescrito de eventos `classic.*` para eventos nativos, e a permissão voltou ao hook de shell | Supus que um mod de usuário recebe os eventos `classic.*`; validei com `claude plugin test` (que não tem o plugin de segurança acima) e não numa sessão real antes de pedir o install |
| 2026-10-27 | Lareira reposicionada: estava solta no chão da sala, ao lado do sofá; foi para o canto de cima à direita, encostada na parede, e a parede foi redistribuída | Peça visual nova posicionada pela área livre no mapa, sem pensar no objeto real (lareira encosta na parede) e sem render; o usuário aprovou "sala de estar" e eu li como "no meio do chão" |
| 2026-10-28 | Lareira: aba de log passou a aceitar teclado e o apagar deixou de virar erro | Supus que sistema de dev sobe sem perguntar nada (log só leitura) e que processo encerrado pela vila sai por sinal; testei com `python -m http.server`, não com o `ng serve` e o `mvnw` reais da tabela |
| 2026-10-29 | Catálogo da bibliotecária (`~/.cache/dev-valley/catalogo.md`) sobrescrito com um acervo de teste e regravado pelo servidor da vila | Testei a classe `Library` fora do servidor sem lembrar que `sections()` grava o catálogo real como efeito colateral |
