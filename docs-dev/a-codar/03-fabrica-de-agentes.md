# Fábrica de agentes (PD-4)

> Decidido em 26/10/2026 (G7). Ao implementar: registrar no `PROGRESS.md`, fechar a PD-4 e mover este arquivo para
> `docs-dev/context/`.

Agente do Claude Code = um arquivo `.md` com cabeçalho (`name`, `description`, `tools`, `model`) e as instruções
embaixo, em `~/.claude/agents` (vale em todo lugar) ou em `<projeto>/.claude/agents` (só naquele projeto).

## Decisões do usuário (26/10/2026)

1. **A Fábrica mostra e edita os agentes globais e os de cada projeto**, agrupados por lugar; ao criar, escolhe-se onde.
2. **Edição por formulário:** nome, descrição (quando usar), ferramentas por caixas, modelo numa lista, instruções num
   campo grande. A vila monta o `.md`.
3. **Apagar pela Fábrica, com confirmação** mostrando o arquivo que sai.
4. **Cada agente vira um NPC ✦ andando em volta da Fábrica**; clicar abre a edição dele.

## Padrões assumidos (contestáveis)

- Agente gerado pelo Dev Valley (marca `<!-- dev-valley:`, como a bibliotecária) aparece **só para leitura** e não
  pode ser apagado: o original mora no repo e o `hooks:install` sobrescreveria a edição. A bibliotecária não vira NPC
  na Fábrica: ela já mora na biblioteca.
- **O nome não muda depois de criado** (é o nome do arquivo e o que as sessões chamam). Para renomear: criar outro e
  apagar o antigo.
- Nenhuma ferramenta marcada = o agente herda todas as da sessão (o padrão do Claude Code). Modelo "o mesmo da
  sessão" = sem a linha `model`.
- Campos do cabeçalho que o formulário não conhece (ex.: `color`) são **preservados** como estão ao salvar.
- Salvar compara a data do arquivo: se ele mudou no disco desde que foi aberto, recusa (como a biblioteca).
- Até 8 NPCs em volta da Fábrica; os demais só no painel.

## Passos

| # | Entrega | Estado |
|---|---|---|
| 1 | Servidor: listar, ler, criar, salvar e apagar (só nas pastas de agentes conhecidas) | a fazer |
| 2 | Painel da Fábrica: lista por lugar + formulário + apagar com confirmação | a fazer |
| 3 | NPCs ✦ em volta da Fábrica | a fazer |
