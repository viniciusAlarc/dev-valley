# Testes automatizados (PD-8)

> Plano decidido com o usuário em 29/10/2026 (G7). Ao fechar cada passo: marcar aqui e no `PROGRESS.md`; ao fechar o
> plano, este arquivo vai para `docs-dev/context/` e a PD-8 sai do `PENDENCIAS.md`.

Antes deste plano o servidor e o front eram validados só com typecheck, build e o usuário olhando na vila. O mod já
tinha testes próprios (`mod/tests/`, `claude plugin test mod`) e fica fora deste plano.

## Decisões (29/10/2026)

1. **Ferramenta:** `node:test` (vem no Node) rodado pelo `tsx`, que o projeto já usa. Nenhuma dependência nova.
   Comando: `npm test` na raiz.
2. **Primeira leva:** os leitores dos arquivos de acompanhamento (pendências, progresso, painel, retrabalho, estrutura,
   tabela "Subir"), o estado da lareira (front) e as travas de segurança (origem local e `/api/arquivo`). Para testar
   as travas, elas saíram do `index.ts` para `server/src/seguranca.ts`, sem mudar o comportamento.
3. **CI:** por enquanto os testes rodam só na máquina do usuário; o CI do GitHub segue só com o auditor.
4. **Onde moram:** `server/tests/` e `web/tests/`. Cada teste cria o projeto de mentira numa pasta temporária
   (`projeto()` em `server/tests/util.ts`), nunca lê projeto de verdade (regra 1 do `CLAUDE.md`: repositório público).

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Leitores, estado da lareira e travas de segurança | feito (29/10/2026, 34 testes) |
| 2 | Rotas HTTP: um teste de sucesso e um de entrada inválida por rota (G11), começando pelas que recebem caminho ou `project` do navegador, com o 404 de "fora do projeto" igual ao de inexistente conferido na resposta (G9). Pede separar a montagem do `app` do `server.listen` no `index.ts` | a fazer |
| 3 | Pombal com repositórios git de mentira: commit, rebase com conflito terminando em `rebase --abort` | a fazer |
| 4 | Testes no CI do GitHub (`npm ci` + `npm test`; o `node-pty` compila código nativo lá) | a decidir com o usuário |

O passo 2 entrou em 29/10/2026 (decisão do usuário), depois de comparar o passo 1 com as regras de teste do
`~/.claude/CLAUDE.md`: G11 pede teste por endpoint e G9 pede o 404 conferido na resposta, e o passo 1 só testa funções.
