# Crítica do cartão pelo DeepSeek Flash: segunda opinião antes do clique

> Proposto e aprovado pelo usuário em 21/11/2026 (regras e checklist como estão abaixo), e implementado no mesmo dia:
> `server/src/critico.ts`, agentes `server/agents/critico-do-cartao.md` e `server/agents/verificador-do-cartao.md`,
> aviso no cartão em `web/src/ui/porao.ts`. Decisões dos pontos em aberto: verificador no **Haiku** (conta Claude, outra
> família) e **só aviso no cartão**, sem NPC. Falta conferir na vila (pendência CC-1).

## O que é

Antes de você aprovar o cartão da rodada no porão, um agente da vila **só leitura**, na conta DeepSeek de
`agentes.conta` (Flash), confere o cartão e os briefings contra um checklist fechado. Os apontamentos passam por um
verificador antes de aparecer. O resultado aparece **no cartão, como aviso**: nunca bloqueia o clique, nunca reescreve
o briefing. Quem decide é o usuário.

## Por quê

- Briefing é documento, e é onde nasce o erro de repasse (Cognition, "Don't Build Multi-Agents"; MAST, NeurIPS 2025:
  a maioria das falhas multiagente vem do desenho e do repasse, não do modelo).
- Revisor de outra família rendeu mais em **documento** que em código: 30 a 42% dos erros contra 17 a 25% do mesmo
  modelo (arXiv 2610.01471, preprint de autor único).
- Custa centavos na conta DeepSeek e não gasta a cota do Claude.

## O risco que as regras precisam segurar (decisão do usuário, 21/11/2026)

Dois vícios opostos:
1. **Bajulação:** concordar com o que leu, ainda mais sabendo que veio de um modelo "mais forte".
2. **Crítica inventada:** pedido para criticar, sempre acha algo.

## Regras do agente (para aprovar)

1. **Checklist fechado, nunca pergunta aberta.** Só os itens abaixo; nada de "o que você acha".
2. **Não sabe quem escreveu.** O prompt não diz que foi o maestro nem qual modelo (viés de procedência).
3. **Sem elogio, sem nota geral, sem resumo do cartão.** O formato só tem lugar para item reprovado com evidência, ou
   "Nada a apontar".
4. **Item só reprova com trecho citado** (do briefing, do cartão ou do arquivo do projeto, com caminho). Sem trecho, o
   item passa. Na dúvida, passa: o custo de um falso alarme no cartão é o usuário perder a confiança no aviso.
5. **Teto de 5 apontamentos.** Se houver mais, os 5 mais graves e uma linha com quantos ficaram de fora.
6. **Verificador antes de mostrar:** cada apontamento é conferido por um segundo agente (de preferência de outra
   família: Haiku), que só confirma ou refuta lendo o arquivo citado. No cartão só entra o confirmado.
7. **Medido:** cada rodada anota apontados / confirmados / se o usuário mudou o cartão por causa deles. Se em ~5
   rodadas nenhum confirmado mudar nada, o agente sai.

## Checklist (para aprovar)

Por tarefa do cartão:

| # | Pergunta (sim/não) | Evidência exigida para reprovar |
|---|---|---|
| C1 | Todo arquivo citado no briefing existe (ou o briefing diz que é novo)? | caminho que não existe |
| C2 | Alguma outra tarefa da mesma rodada, sem `dependeDe`, toca o mesmo arquivo? | os dois briefings e o arquivo |
| C3 | O comando de teste do cartão existe no projeto (script, alvo, pasta de teste)? | onde deveria estar e não está |
| C4 | O critério de aceite é conferível por alguém que não leu a conversa (comando, tela, valor esperado)? | o trecho vago |
| C5 | O briefing cita o trecho da spec/pedido de onde a tarefa saiu? | ausência do trecho |
| C6 | O briefing pede algo que a spec citada não pede (G1)? | o pedido e o trecho da spec |
| C7 | A tarefa toca banco, deploy, push ou envio externo sem dizer que espera o usuário (G3)? | o trecho |

Da rodada:

| # | Pergunta | Evidência |
|---|---|---|
| R1 | O `dependeDe` faz sentido (a tarefa que espera usa o que a outra cria)? | o que é usado e de onde viria |

## Como ficou (21/11/2026)

1. `server/src/critico.ts`: `criticaDoPorao(...).iniciar(pedido)` é chamado pela rota `POST /api/porao/pedidos` logo
   depois de o pedido ser aceito (o do roteiro de testes não passa por ela). Marca `pedido.critica` como `conferindo`,
   roda em segundo plano e, ao terminar, grava e atualiza o mundo. Nunca lança: erro vira `estado: 'falhou'` e o cartão
   segue sem aviso.
2. Crítico (`critico-do-cartao`, conta de `agentes.conta`, em `AGENTES_NA_CONTA`) e verificador
   (`verificador-do-cartao`, Haiku, conta Claude), os dois por `claude -p` da base de `consulta.ts`, modo estrito,
   Read/Grep/Glob. O crítico recebe o cartão sem o id do maestro nem o modelo; o verificador recebe os apontamentos
   numerados, sem saber quem os escreveu.
3. A vila também aplica as regras: apontamento sem evidência, de item fora do checklist ou de tarefa fora do cartão cai
   (`apontamentosValidos`); teto de 5; só o `confirmado` vai para o cartão (o que o verificador não responder fica
   incerto e não aparece).
4. Medição: `critica-<pedido>.json` na pasta da rodada (`~/.claude/maestro/rodadas/<rodada>/`), com a crítica e a
   decisão do usuário (`aguardando`, depois `aprovado` ou `recusado`, anotada pelas rotas de aprovar e recusar).
5. Cartão (`web/src/ui/porao.ts`): bloco "Segunda opinião" acima dos botões; enquanto confere, relê o
   `GET /api/porao/pedidos/:id` a cada 3 s. Os apontamentos usam a caixa de aviso que já existia (`.pombal-avisos`,
   contorno inteiro), sem CSS novo.
6. Testes: `server/tests/critico.test.ts`.
