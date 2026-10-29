# Lareira: ligar o sistema da casa (PD-7)

> Plano decidido com o usuário em 26/10/2026 (G7) e implementado de 27 a 28/10/2026. Conferido na vila pelo usuário em
> 29/10/2026: plano fechado, PD-7 saiu do `PENDENCIAS.md`. Código: `server/src/lareira.ts`, `web/src/ui/lareira.ts`,
> `puffSmoke` na `TownScene`.

Todo projeto tem, pelo G14, a tabela "Subir" no topo do `docs-dev/guias/OPERACAO.md` (lado, pasta, comando, porta).
Este plano usa essa tabela para a vila ligar e desligar o sistema do projeto de dentro da casa.

## Decisões (26 e 27/10/2026)

1. **O processo roda num terminal da vila** (opção A): é filho do servidor, criado com `node-pty` como os terminais
   dos moradores (`server/src/terminals.ts`), com o log guardado e reenviado ao reabrir o painel. Descartado o
   segundo plano desacoplado: a vila perderia o controle do processo (PID e log em disco) e sobraria processo órfão
   no WSL. Consequência aceita: reiniciar o servidor da vila derruba os sistemas que ela ligou (regra 6).
2. **A vila também olha a porta da tabela** (`ss -ltn`): porta ocupada conta como ligado, mesmo quando o sistema
   subiu fora da vila; com a porta ocupada, a vila não tenta ligar de novo.
3. **Metáfora: lareira dentro da casa, com back e front juntos.** Um clique liga todos os lados da tabela que têm
   comando; outro clique desliga todos. Visto da vila: fumaça na chaminé da fachada (a chaminé já existe em
   `web/src/game/textures.ts`, função `house`).
4. **Desligar mata a árvore de processos** de cada lado, não só o processo do topo (`npm start` abre `java` ou `vite`
   por baixo, e o filho que sobra segura a porta).
5. **Célula de comando vazia = a vila não liga aquele lado**, como já diz o comentário do template. Projeto sem
   `OPERACAO.md` ou sem nenhum comando na tabela não ganha lareira.
6. **Clicar na lareira abre o painel dela** (27/10/2026), com cada lado da tabela: pasta, comando, porta e estado,
   e o botão Acender/Apagar. O comando aparece sempre antes de ligar, sem diálogo extra.
7. **Ligado fora da vila só avisa** (27/10/2026): porta ocupada por processo que a vila não criou deixa a lareira
   acesa, e o painel diz "ligado fora da vila" com o PID. Apagar fica desativado: a vila nunca mata processo que não
   criou.
8. **Um terminal (xterm) por lado, em abas back/front** (27/10/2026), para cores e barras de progresso saírem certas.
   O terminal aceita teclado (28/10/2026): o `ng serve` pergunta do autocompletar na primeira vez e, só leitura, a
   lareira ficava presa em "acendendo".
9. **A lareira fica encostada na parede, no canto de cima à direita** (27/10/2026; antes estava solta no chão ao
   lado do sofá, o que não fazia sentido). A parede de cima foi redistribuída, com 8px entre as peças: estante, atril,
   quadro de cortiça, janela (saiu do centro), quadro negro (com a caixa de sementes no chão, embaixo), escrivaninha e
   lareira. A planta, que ocupava o canto, foi para o canto esquerdo da sala de estar.

## Estados da lareira

| Estado | Quando | Lareira | Chaminé |
|---|---|---|---|
| Apagada | Nenhum lado rodando e nenhuma porta ocupada | Sem fogo | Sem fumaça |
| Acendendo | Processo vivo, mas alguma porta ainda não responde | Fogo pequeno | Fumaça fina |
| Acesa | Todas as portas com comando respondendo | Fogo | Fumaça |
| Com erro | Algum lado saiu com código diferente de 0 | Brasa / fumaça preta | Fumaça preta |

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Servidor: ler a tabela "Subir" de cada projeto e checar as portas | feito (27/10/2026, `server/src/lareira.ts`) |
| 2 | Servidor: ligar e desligar os lados (pty, árvore de processos, estado e log) | feito (27/10/2026, `Lareiras` em `server/src/lareira.ts`) |
| 3 | Casa: lareira com os estados e o painel do log | feito (27/10/2026, `web/src/ui/lareira.ts`) |
| 4 | Vila: fumaça na chaminé da fachada | feito (28/10/2026, `puffSmoke` em `web/src/game/TownScene.ts`) |
