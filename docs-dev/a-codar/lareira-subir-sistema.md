# Lareira: ligar o sistema da casa (PD-7)

> Plano decidido com o usuário em 26/10/2026 (G7). Ao fechar cada passo: marcar aqui e no `PROGRESS.md`; ao fechar o
> plano, este arquivo vai para `docs-dev/context/` e a PD-7 sai do `PENDENCIAS.md`.

Todo projeto tem, pelo G14, a tabela "Subir" no topo do `docs-dev/guias/OPERACAO.md` (lado, pasta, comando, porta).
Este plano usa essa tabela para a vila ligar e desligar o sistema do projeto de dentro da casa.

## Decisões (26/10/2026)

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

## Estados da lareira

| Estado | Quando | Lareira | Chaminé |
|---|---|---|---|
| Apagada | Nenhum lado rodando e nenhuma porta ocupada | Sem fogo | Sem fumaça |
| Acendendo | Processo vivo, mas alguma porta ainda não responde | Fogo pequeno | Fumaça fina |
| Acesa | Todas as portas com comando respondendo | Fogo | Fumaça |
| Com erro | Algum lado saiu com código diferente de 0 | Brasa / fumaça preta | Fumaça preta |

## Em aberto (perguntar antes de codar o passo correspondente, G2)

- **Confirmação antes de ligar:** mostrar comando e pasta de cada lado antes do primeiro "ligar" de cada projeto
  (proposta minha, o comando vem de um arquivo do projeto). Sempre, só na primeira vez, ou nunca?
- **Ligado fora da vila:** com a porta ocupada por um processo que a vila não criou, a lareira aparece acesa. O clique
  só avisa ("ligado fora da vila") ou a vila pode encerrar quem está na porta?
- **Log de dois lados:** um painel com uma aba por lado (back/front), ou os dois logs juntos com prefixo?

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Servidor: ler a tabela "Subir" de cada projeto e checar as portas | a fazer |
| 2 | Servidor: ligar e desligar os lados (pty, árvore de processos, estado e log) | a fazer |
| 3 | Casa: lareira com os estados e o painel do log | a fazer |
| 4 | Vila: fumaça na chaminé da fachada | a fazer |
