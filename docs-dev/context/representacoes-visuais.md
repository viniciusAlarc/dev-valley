# Representações visuais dos arquivos de acompanhamento

> Plano decidido e implementado em 25/10/2026; saiu de `docs-dev/a-codar/` ao fechar (G7). Fica aqui como registro
> das decisões. Todas as peças são só leitura: os arquivos são lidos a cada atualização do mundo
> (`server/src/pendencias.ts`, `painel.ts`, `progress.ts`), e o texto do diário vem sob demanda por `GET /api/progress`.

A vila passa a mostrar os arquivos de acompanhamento que todo projeto tem (formatos fixos dos guardrails):
`PENDENCIAS.md`, `PROGRESS.md` e `docs-dev/painel.json`.

## Decisões (25/10/2026)

1. **Metáforas aprovadas:**
   - `PENDENCIAS.md` → quadro de bilhetes dentro da casa. Cada pendência é um bilhete; cor = prioridade,
     dono no painel que abre ao clicar.
   - P1 aberta → sinal "!" na fachada da casa, visível da vila. (Antes P1/P2; P2 saiu em 25/10/2026 a pedido do
     usuário: projeto com várias pendências não deve alertar o tempo todo.)
   - Pendências 👤 de todos os projetos → o quadro de avisos da praça (hoje decorativo) passa a funcionar.
   - `docs-dev/painel.json` → horta no quintal: cada fase é um canteiro (feito = planta madura,
     em andamento = broto, a fazer = terra arada).
   - `PROGRESS.md` → diário dentro da casa: abre como livro, uma página por entrega.
2. **Quadro da praça mostra só as pendências 👤** (decisão do usuário), não todas.
3. **Só leitura no começo.** Criar ou fechar pendência pela vila fica para depois: é a vila editando arquivo de
   outro projeto, e pede cuidado próprio.
4. Projeto sem o arquivo = sem a peça correspondente, sem erro.

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Quadro de pendências na casa + sinal na fachada | feito |
| 2 | Quadro da praça com as pendências 👤 de todos os projetos | feito |
| 3 | Horta das fases (`painel.json`) | feito |
| 4 | Diário do progresso (`PROGRESS.md`), com sumário lateral por data | feito |

O passo 3 cobre a primeira metade da PD-7 (casa mostrar o `painel.json`).

**Próximos refinamentos possíveis (não decididos):** busca no sumário do diário; criar ou fechar pendência pela vila
(decisão 3 acima).
