# Pombal: sincronização diária com a branch comum do time

> Decidido e implementado em 27/10/2026. Código: `server/src/pombal.ts`, `web/src/ui/pombal.ts`, `buildPombal` na
> `TownScene`. Os nomes de projeto e de branch ficam só no `dev-valley.config.local.json` (repositório público).

## O problema

Em projeto com mais de uma pessoa, cada uma trabalha numa branch própria e todos se encontram numa branch comum. O
ritual combinado: **de manhã** trazer a branch comum para a sua (trabalhar com tudo atualizado); **no fim do dia**
levar tudo o que fez para a comum (o outro recebe no pull dele). A outra pessoa não usa a vila: ela só precisa
encontrar o trabalho na branch comum.

## Decisões (27/10/2026)

1. **Mora na vila, não no repositório do projeto.** A outra pessoa tem o próprio procedimento.
2. **Só na casa configurada.** Não é peça da praça nem de toda casa: aparece onde o config local tem `pombal`.
3. **Metáfora: pombal.** Pombo-correio é troca de notícias com outra pessoa. Desenho: casinha de passarinho num poste,
   no quintal à direita da caixa de envio, parede azul e telhado vermelho (no mesmo dia saiu de cima da porta, onde
   ficava pequeno e pouco visível).

| Na casa | Estado |
|---|---|
| Pombo dormindo no pombal | Em dia |
| Pombo no telhado com carta no bico | Há commits novos na branch comum (a trazer) |
| Cartas no poleiro (até 4), pombo acordado no buraco | Commits seus que a comum não tem (a levar) |
| "!" amarelo, pombal vazio | Casa em outra branch, ou a última viagem não completou |

4. **Duas viagens:**
   - **Trazer (pull):** fetch → merge da comum na sua → push da sua.
   - **Levar (push):** a mesma coisa e, no fim, push da sua para a comum, só como fast-forward. Pede confirmação com a
     lista de commits que vão.
5. **Travas:** o pombo não sai com mudança rastreada sem commit, nem fora da sua branch. Conflito desfaz o merge
   (`merge --abort`) e lista os arquivos; resolve-se com um morador da casa. O conflito é resolvido sempre na sua
   branch, nunca na comum. Morador trabalhando na casa gera aviso, não bloqueio.
6. **Contagem sem merges.** O merge da manhã sozinho não é "carta a levar"; senão o pombal nunca ficaria em dia.
7. **Rede:** fetch ao subir o servidor, a cada 5 minutos e ao abrir o painel. Entre um e outro, o estado vem do disco.
   O git nunca pergunta senha (sem terminal para responder) e desiste em 2 minutos.
