# NPCs conversando

> Plano decidido com o usuário em 30/10/2026 (G7). Ao fechar cada passo: marcar aqui e no `PROGRESS.md`; ao fechar o
> plano, este arquivo vai para `docs-dev/context/`.

Primeiro ponto do refinamento das animações e dinâmicas dos NPCs (pedido do usuário, 30/10/2026): quando uma sessão fala
com outra, um morador vai até o outro e os dois ficam conversando.

```
1. Você escreve "@Vera ..." na sessão do Rafa
2. O mod (dentro da sessão) acha a Vera no mapa local → manda à vila só {Rafa, citados: [id da Vera]}
3. O servidor guarda "Rafa → Vera" até o Rafa terminar de responder (Stop), no máximo 10 min
4. A vila: o Rafa anda até a Vera, os dois se viram um para o outro e aparece o balão de conversa
```

## Decisões (30/10/2026)

1. **Regra 3 ampliada:** junto do `UserPromptSubmit`, o mod manda à vila os **ids** das sessões citadas com `@Nome` que
   estão no mapa de moradores (nunca a própria, nunca o texto). O teste `mod/tests/dev-valley.test.ts` confere.
2. **Gatilho:** só o `@Nome`. Mensagem entre sessões pela ferramenta `SendMessage` fica de fora.
3. **Duração:** até a sessão que citou terminar a resposta (`Stop`), ou encerrar; mensagem nova sem citação também
   encerra. Limite de segurança de 10 min.
4. **Onde:** quem cita vai até o citado. Na vila, sai do quintal dele (ou da praça) e anda até onde o citado está; o
   citado para de passear. Dentro da casa, só anima quando os dois moram nela: quem citou levanta da mesa e vai até o
   outro.

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Mod: ids citados junto do `UserPromptSubmit`; regra 3 e teste do mod atualizados | feito (30/10/2026, `idsCitados` em `mod/hooks/moradores.ts`; mod 0.2.0) |
| 2 | Servidor: `HookStore` guarda as conversas, `World.conversas`, testes | feito (30/10/2026, `server/src/hooks.ts`, `server/tests/hooks.test.ts`) |
| 3 | Vila: quem cita anda até o citado, os dois se viram e o balão de conversa aparece; volta ao terminar | feito (30/10/2026, `syncConversas` na `TownScene`, textura `talk`); falta conferir na vila |
| 4 | Dentro da casa: quem cita levanta e vai até o outro, quando os dois moram nela | feito (30/10/2026, `syncConversas` na `InteriorScene`, `standUp` no `VillagerView`); falta conferir na vila |

Limites conhecidos: uma visita por morador (vai até o primeiro citado que aparece na cena); citado que não aparece (fora
da vila, dentro da casa quando quem citou está fora, ou além do limite da praça) não recebe visita; o caminho é em linha
reta, sem desviar de casas.
