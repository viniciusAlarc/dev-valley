# Rodada: testes dos módulos

03/11/2026 · 3 sessões · 23:13 → 23:23

| Tarefa | Sessão | O que fez | Arquivos | Testes |
|---|---|---|---|---|
| t1 Quadro negro | dev-valley-90 | 4 casos: sem painel ou sem doc fica vazio; doc do plano primeiro e depois o de cada fase; arquivo inexistente e extensão errada ficam de fora; doc fora do projeto nunca entra. `quadro.ts` não mudou. | `server/tests/quadro.test.ts` (novo), `PROGRESS.md` | 169 → 190, typecheck sem erro |
| t2 Caixa de sementes | dev-valley-08 | 7 casos: sem `a-codar` dá null; só os .md do primeiro nível, sem README, em ordem; título do primeiro "# " ou do nome do arquivo; o aviso "falta conferir" não acende quando a frase vem entre aspas. `sementes.ts` não mudou. | `server/tests/sementes.test.ts` (novo), `PROGRESS.md` | 169 → 180, typecheck sem erro |
| t3 Relatórios do porão | dev-valley-49 | 10 casos de borda: pasta vazia ou ausente; só .md do primeiro nível; mais novo primeiro; título sem "Rodada:"; data só com AAAA-MM-DD no começo do nome. `relatorios.ts` não mudou. | `server/tests/relatorios.test.ts` (novo), `PROGRESS.md` | 169 → 190 |

**Ficou de fora / pendências:**
- A t3 viu o typecheck falhar em `quadro.test.ts` (tipo `Painel`), mas isso foi enquanto a t1 ainda trabalhava; depois a t1 disse que o typecheck passa. Conferir com `npm run typecheck -w server` antes de commitar.
- O auditor aponta 4 referências mortas em entradas antigas do `PROGRESS.md` (linhas 41, 42, 415 e 1002). Já existiam antes da rodada.
- O protocolo: nenhuma das 3 sessões mandou `PRONTA` sozinha; só mandaram depois que o maestro cobrou (23:23).

**Commits:** pelo pombal, a fazer.
