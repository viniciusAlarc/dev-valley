# Moradores mais variados e coerentes com o nome

> Plano decidido com o usuário, implementado e conferido na vila em 31/10/2026 (fechado).

Segundo ponto do refinamento dos NPCs (pedido do usuário, 31/10/2026):
1. Nome feminino às vezes sai com aparência masculina, e o contrário: nome e aparência eram sorteados separados (nome no
   servidor, aparência no front pelo id da sessão).
2. Aparência muito repetida: em 16x32 o que o olho vê é a silhueta, e havia 5 penteados, 4 roupas e um chapéu.

## Decisões (31/10/2026)

1. **Nome marcado:** cada nome da lista do servidor é feminino, masculino ou neutro (ambíguos como Rafa, Duda, Gabi).
   O sorteio da aparência respeita a marca no **penteado e nos detalhes**: barba e bigode nunca em nome feminino,
   vestido e laço nunca em nome masculino; neutro pode tudo.
2. **Variáveis novas**, todas no padrão atual (16x32, 3 tons, contorno colorido): mais penteados, acessórios (óculos de
   grau, nunca escuros, que são dos agentes pela regra 8; boné, gorro, faixa, laço, lenço), mais roupas (moletom,
   jaqueta, avental, suéter, xadrez, vestido) e barba/bigode.
3. **Todos trocam de visual** com o sorteio novo (o nome continua).
4. **Conferência antes da vila:** `scripts/previa-moradores.ts` gera a prévia em PNG fora do navegador, com a mesma arte
   do jogo (`web/src/game/villagerArt.ts`, separada do Phaser para isso).

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Arte do morador separada do Phaser (`villagerArt.ts`) e prévia em PNG | feito (31/10/2026) |
| 2 | Nome marcado no servidor, `genero` na sessão, sorteio respeitando a marca | feito (31/10/2026, `generoDoNome` em `server/src/moradores.ts`) |
| 3 | Penteados, roupas, acessórios e barba novos, conferidos na prévia | feito (31/10/2026: 5 penteados novos, 6 roupas novas, 4 acessórios de cabeça novos, óculos, lenço, barba e bigode) |
| 4 | Testes do sorteio (marca respeitada, agente sem acessório) e conferência na vila | feito (31/10/2026); conferido na vila pelo usuário |
