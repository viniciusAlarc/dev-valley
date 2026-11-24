---
paths:
  - "web/src/game/**"
  - "web/sprites.html"
  - "scripts/previa-moradores.ts"
  - "server/src/moradores.ts"
  - "server/src/world.ts"
---

# Regras 7 e 8 do CLAUDE.md, por inteiro: pixel art e traje de agente

## Regra 7: pixel art gerada em código

Pixel art é gerada em código (`web/src/game/textures.ts`, `interiorTextures.ts`; ícones do balão em grade de
caracteres em `iconesBalao.ts`; moradores em `villagerArt.ts`, sem Phaser); prévia em `web/sprites.html` e, dos
moradores, em PNG por `scripts/previa-moradores.ts` (o `catalogo` mostra cada peça).

- A aparência do morador combina com a marca do nome (`generoDoNome` no servidor): barba nunca em nome feminino,
  vestido e laço nunca em masculino (decisão do usuário, 31/10/2026).
- A roupa (camisa, calça, jaqueta, acessório, lenço) segue o provedor da conta da sessão: tons quentes no Claude,
  frios no DeepSeek (`paletaDo`); pele, cabelo e penteado nunca mudam com o provedor (decisão do usuário, 02/11/2026;
  vocabulário de contas em 19/11/2026).

## Regra 8: todo agente (NPC ✦) veste o traje de agente secreto

Estilo "homens de preto": paletó e calça pretos, camisa branca, gravata e óculos escuros; só pele e cor do cabelo
variam. É o que separa agente de sessão à primeira vista (decisão do usuário, 27/10/2026).

- Vale para os da Fábrica (automático na `AgentNpc`) e para qualquer agente da vila novo: desenhe com
  `villagerTexture(scene, id, true)`, nunca com a aparência sorteada dos moradores.
- Agente da vila novo entra na lista que reserva a combinação de pele × cabelo em `villagerArt.ts`, para nenhum
  agente sair igual a ele.
- **Exceção única: a médica da clínica** (`MEDICA_ID`) usa o traje com jaleco por cima, máscara, estetoscópio e coque
  (decisão do usuário, 09/11/2026). Nenhum outro agente ganha acessório de ofício sem decisão do usuário.
