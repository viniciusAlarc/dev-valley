# Gazeta do Vale: o jornal da banca com cara de jornal

> **Implementado em 02/11/2026**, no mesmo dia do plano. Fontes: Old Standard TT (texto e títulos) e UnifrakturMaguntia
> (só o nome no cabeçalho), em `web/package.json`. CSS na seção "Gazeta do Vale" do `web/src/style.css`.
> **Não conferido em navegador sem interface:** não há um instalado, e instalar grava fora do repositório (pede o ok do
> usuário). A conferência visual ficou para a vila.

## Por que

Pedido do usuário: clicar na banca e abrir um jornal de verdade na tela, com as mesmas informações de hoje.

## Decisões (usuário, 02/11/2026)

1. **Título por notícia:** o jornaleiro passa a devolver um título curto para cada projeto (`titulo` no JSON). Sem
   título na resposta, a notícia usa o nome do projeto.
2. **Nome:** "Gazeta do Vale".
3. **Fonte serifada de jornal** instalada no projeto (`@fontsource`), só no jornal; o resto da vila continua pixelado.

## Como

- HTML + CSS por cima da vila (não em Phaser: texto longo em canvas fica ilegível). Folha creme com granulado leve,
  cabeçalho grande, linha da data, manchete na largura toda, notícias em colunas (`column-width`, uma coluna em tela
  estreita), filetes entre colunas. Abre desdobrando (animação curta, respeitando `prefers-reduced-motion`).
- Seções com os dados que já existem: notícias por projeto ("Você" e "O time"); "Sem novidade em" vira nota de rodapé;
  projetos parados viram "Achados e perdidos".
- Sem documento de design no projeto: cor só nos títulos e filetes, nada de faixa colorida colada numa borda (G19).
- Conferir a geometria num navegador sem interface com edições de mentira (1 notícia e 6 notícias), sem reiniciar a
  vila (regra 6).

## Passos

1. Servidor: `titulo` em `Noticia`, `lerResposta` e `server/agents/jornaleiro.md`; testes em `jornal.test.ts`.
2. Fonte: pacote `@fontsource` no `web/`.
3. `web/src/ui/jornal.ts`: folha da Gazeta no lugar do painel; botões "Imprimir" e fechar (Esc) continuam.
4. CSS da Gazeta em `web/src/style.css`.
5. Prévia renderizada, testes, typecheck, build, docs.
