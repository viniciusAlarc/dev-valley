# Ambiente de IA na vila

> Plano decidido com o usuário em 26/10/2026 (G7). Ao fechar cada passo: marcar aqui, `PROGRESS.md` e
> `docs-dev/painel.json`; ao fechar o plano, este arquivo vai para `docs-dev/context/`.

A vila já mostra `PENDENCIAS.md`, `PROGRESS.md` e `painel.json`. Este plano traz o que mais o ambiente de IA
(`~/Documents/IA`, guardrails G1–G21) pede de cada projeto e ainda não aparecia.

## Decisões (26/10/2026)

1. **Tudo continua só leitura**, como as representações visuais (decisão 3 de `context/representacoes-visuais.md`),
   exceto as skills na Fábrica (decisão 7).
2. **Sino de conferência na praça:** lista as entregas do `PROGRESS.md` de todos os projetos que ainda dizem
   "Falta conferir na vila". A entrega sai da lista quando o texto vira "Conferido na vila pelo usuário em ...".
   O sino também avisa quando o código do próprio Dev Valley (`server/`, `web/`) mudou depois que a vila subiu:
   falta o reinício do usuário (regra 6).
   **Atualização (26/10/2026):** em vez de um botão "Conferi" (que só trocaria o texto e deixaria plano, pendência e
   painel desatualizados), o usuário decidiu por um **✦ administrador da praça**, ao lado do sino e do quadro de
   avisos: tira dúvidas sobre os itens e, quando o usuário diz que conferiu, registra como a sessão faria
   (`PROGRESS.md`, passo do plano em `a-codar/`, `PENDENCIAS.md`, `painel.json` se a regra do projeto pedir).
   Mesmos fundamentos da bibliotecária: `claude -p --no-session-persistence` (não vira morador), Sonnet. Edição só
   nesses arquivos de acompanhamento, por regra de permissão passada na chamada (o resto é negado no `-p`).
3. **Casa em obra:** projeto sem a estrutura dos guardrails (`CLAUDE.md`, `PENDENCIAS.md`, `PROGRESS.md`,
   `docs-dev/painel.json`, auditor em `scripts/auditar-referencias.py`) ganha andaime; o tooltip/painel diz o que falta
   e como resolver (`instalar-projeto.sh`, `/novo-projeto`).
4. **Caixa de sementes dentro da casa** (não no quintal, para não poluir a vila): uma semente por plano em
   `docs-dev/a-codar/` (decidido e não codado, G7). Clique abre a lista.
5. **Ervas daninhas no quintal:** uma por linha do `RETRABALHO.md` (G17). Sem etiqueta nem IA (decisão do usuário
   de deixar a escolha comigo: o mais seguro é não mudar o template universal do G17 nem gastar token). O painel
   lista as linhas; agrupar por causa e levar ao `/nova-regra` fica com o usuário.
6. **Placa de vistoria na fachada:** data de `.claude/auditoria-regras.txt`; vencida = placa amarela, tooltip
   lembra o `/auditar-regras` (G12/G16).
7. **Fábrica por dentro:** vira construção com interior, como a biblioteca. Dentro, dois itens: os agentes (o painel
   atual) e as **skills** (`~/.claude/skills` e `<projeto>/.claude/skills`), com ler, criar, editar e apagar. Skill que
   é link para `~/Documents/IA` (instalada pelo `instalar.sh`) fica só leitura: a fonte é o repositório de regras.
8. **Outdoor dos guardrails:** mostra `guardrails ✓` quando `enabledPlugins["guardrails@ia"]` está ligado no
   `~/.claude/settings.json`; o clique lista os guardrails (títulos `## G..` do `guardrails-core.md`).

**Fora do plano:** aviso de duas sessões no mesmo repositório (o usuário achou desnecessário: os dois moradores já
aparecem no quintal); `docs-conhecimento` na biblioteca (a pasta ainda não existe, e `~/Documents/IA` já está no
`libraryRoots` local); tabela "Subir" do `OPERACAO.md` continua como PD-7.

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Sino de conferência, reinício pendente e ✦ administrador da praça | feito |
| 2 | Casa em obra | feito |
| 3 | Caixa de sementes (`a-codar/`) dentro da casa | feito |
| 4 | Ervas do retrabalho no quintal | feito |
| 5 | Placa de vistoria | a fazer |
| 6 | Outdoor dos guardrails | a fazer |
| 7 | Fábrica por dentro, com skills | a fazer |
