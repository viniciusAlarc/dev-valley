# Pombal: a peça de git de toda casa

> Decidido e implementado em 27/10/2026 (só uma casa, duas branches), generalizado em 28/10/2026 (toda casa, a
> branch com o upstream dela) e, no mesmo dia, absorveu a caixa de envio (dois estágios: local e enviado). Código: `server/src/pombal.ts`, `web/src/ui/pombal.ts`, `buildPombal` na `TownScene`.

## O problema

Em projeto com mais de uma pessoa, o ritual combinado é: **de manhã** trazer o que os outros entregaram (trabalhar com
tudo atualizado); **no fim do dia** levar tudo o que fez. A vila só tinha o commit (caixa de envio); faltava a troca
com o remoto. A outra pessoa não precisa usar a vila: ela só encontra o trabalho no remoto.

## Decisões

1. **27/10/2026: mora na vila, não no repositório do projeto.** A outra pessoa tem o próprio procedimento.
2. **27/10/2026: metáfora do pombal.** Pombo-correio é troca de notícias com outra pessoa. Desenho: casinha de
   passarinho num poste, no quintal à direita da casa, parede azul e telhado vermelho (no mesmo dia saiu de
   cima da porta, onde ficava pequeno e pouco visível).
3. **28/10/2026: toda casa, a branch com o upstream dela.** O time passou a trabalhar direto na branch comum, e a
   ideia de branch pessoal + branch comum (com `pombal` no config local) saiu. Caixa de envio = commit; pombal =
   pull e push. Casa com git e branch com upstream tem pombal; sem upstream, não tem. (Revisto no item 9: a caixa
   de envio saiu, e o pombal existe em toda casa com git.)
4. **28/10/2026: pull com rebase.** Com duas pessoas commitando na mesma branch, merge criaria um commit "Merge
   branch..." a cada pull; o rebase reaplica os seus commits locais em cima do que chegou e deixa o histórico em linha.

| No quintal | Estado |
|---|---|
| Pombo dormindo, chão limpo | Enviado: o time tem tudo o que você fez |
| Cartas espalhadas no chão (uma por arquivo, até 12), pombo acordado | Local: arquivos que só você tem, com ou sem commit |
| Pombo no telhado com carta no bico | Há commits novos no upstream (a trazer) |
| "!" amarelo, pombal vazio | A última viagem que você disparou não completou |

9. **28/10/2026: o pombal absorve a caixa de envio; dois estágios, não três.** O caminho é só até o ambiente de
   desenvolvimento (homologação vem depois e fica fora da vila), então não vale burocracia: **local** (o que só você
   tem, com ou sem commit) e **enviado** (o time já tem). Local = uma carta espalhada no chão entre a casa e o pombal
   por arquivo (até 12), no lugar da bolinha vermelha da caixa (quebrava a imersão), e o pombo acordado. "Enviar para
   o time" faz commit, rebase e push de uma vez, com o diff e a mensagem na mesma tela. "Trazer" usa `--autostash`:
   alteração sem commit não impede o pull. Os arquivos locais contam a partir do ponto em que a branch saiu do
   upstream, para o que o time mandou não virar carta sua. Sem upstream, o pombal existe e só guarda o commit.
   A rota `/api/commit` saiu: commit só pelo pombal.

10. **28/10/2026: "✨ Sugerir texto" na tela de enviar.** O escrevente (`server/agents/escrevente.md`, mesma base dos
    agentes da vila, `claude -p --no-session-persistence`, só `Read`) recebe a regra de commit do `CLAUDE.md` do
    projeto, as últimas 15 mensagens do `git log`, os 5 títulos mais recentes do `PROGRESS.md` e o diff dos arquivos
    marcados (até 60 mil caracteres), e devolve uma linha que vai direto para a caixa de texto. O usuário revisa e
    edita antes de enviar; nada é enviado sem o clique.

5. **Duas viagens:**
   - **Trazer (pull):** fetch → rebase dos seus commits locais em cima do upstream.
   - **Enviar para o time:** commit (mensagem obrigatória), o mesmo rebase e o push, que o git só aceita como
     fast-forward. Só commits já guardados, sem alteração nova: confirma com a lista no próprio painel.
6. **Travas:** conflito desfaz o rebase (`rebase --abort`) e lista
   os arquivos; resolve-se com um morador da casa. Morador trabalhando na casa gera aviso, não bloqueio. O POST só
   aceita página local (regra 2), como a lareira.
7. **28/10/2026: o "!" é só para falha sua.** Falha do fetch automático (remoto que pede senha, rede fora) aparece só no
   texto do pombal. O "!" some na próxima viagem que der certo ou quando o HEAD da casa muda (conflito resolvido por fora).
8. **Rede:** fetch ao subir o servidor, a cada 5 minutos e ao abrir o painel. Entre um e outro, o estado vem do disco.
   O git nunca pergunta senha (sem terminal para responder) e desiste em 2 minutos.
