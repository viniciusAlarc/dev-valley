# Conta por tarefa no cartão do porão (Claude Sonnet ou DeepSeek Flash)

> Proposto em 21/11/2026. **Depois das métricas do revisor DeepSeek na `/revisar`** (~5 revisões medidas), por decisão
> do usuário. Pendência CC-2. Nada disto está implementado.

## O que é

Hoje toda sessão de trabalho do porão abre na conta padrão da casa, no Sonnet (`MODELO_DAS_SESSOES` em `rodada.ts`).
A proposta: o maestro marca **cada tarefa** do cartão com a conta, e a vila abre a sessão nela.

```
1. Maestro (Opus) monta o cartão e marca cada tarefa: "Claude Sonnet" ou "DeepSeek Flash"
2. O usuário vê a marcação no cartão e aprova a rodada, como hoje
3. A vila abre cada sessão na conta marcada (mesmo caminho das casas: ambienteDoTerminal + trava da chave)
4. Gate roda os testes; o relatório diz qual conta fez cada tarefa
```

## Critério para o Flash (todos juntos; na dúvida, Sonnet)

- Tem comando de teste no cartão (o gate pega o erro).
- Arquivos poucos e definidos no briefing.
- Sem tela nem imagem.
- Sem regra de negócio nova.

## Por quê

- Poupa a cota do Claude no trabalho mecânico.
- Flash perto do topo em código curto (SWE-bench Verified 79,0% contra 80,6% do Pro) e mais fraco em tarefa longa de
  agente (Terminal-Bench), por isso só tarefa curta com teste.
- O código do Flash é revisado pelas lentes do Claude na `/revisar`: revisão de outra família de graça.

## Riscos e o que conferir ao codar

- **Regra 10 (segurança do porão):** a marcação da conta faz parte do que o usuário aprova no clique; a vila não troca
  a conta depois. Os hooks do `porao-hook.sh` (devolutiva, posse de arquivo) precisam funcionar igual na conta DeepSeek
  (o `--settings` da tarefa vale nas duas).
- Conta DeepSeek sem chave: a trava recusa e a tarefa fica "não abriu" no quadro, nunca cai no Claude em silêncio.
- Sessão DeepSeek com esforço `max` é lenta (ensaio da `/revisar`: 11 min para uma lente).
- Testes novos em `porao.test.ts` e `rodada.test.ts`: conta por tarefa, recusa sem chave, conta mostrada no relatório.
- Cada casa só oferece contas da mesma finalidade (pessoal ou trabalho): a tarefa DeepSeek usa a conta DeepSeek da
  mesma finalidade da casa.

## Pontos em aberto

- 👤 O critério acima basta ou o usuário quer escolher tarefa a tarefa no cartão (trocar a marcação do maestro).
