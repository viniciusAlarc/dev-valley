# Fábrica de agentes (PD-4)

> Decidido e implementado em 26/10/2026 (PD-4). Saiu de `docs-dev/a-codar/` ao fechar (G7) e fica aqui como registro
> das decisões.

Agente do Claude Code = um arquivo `.md` com cabeçalho (`name`, `description`, `tools`, `model`) e as instruções
embaixo, em `~/.claude/agents` (vale em todo lugar) ou em `<projeto>/.claude/agents` (só naquele projeto).

## Decisões do usuário (26/10/2026)

1. **A Fábrica mostra e edita os agentes globais e os de cada projeto**, agrupados por lugar; ao criar, escolhe-se onde.
2. **Edição por formulário:** nome, descrição (quando usar), ferramentas por caixas, modelo numa lista, instruções num
   campo grande. A vila monta o `.md`.
3. **Apagar pela Fábrica, com confirmação** mostrando o arquivo que sai.
4. **Cada agente vira um NPC ✦ andando em volta da Fábrica.** Clicar nele **abre uma conversa nova com o agente**
   (`claude --agent <nome>`), revisado pelo usuário em 26/10/2026 (antes: abria a edição). Agente de projeto conversa
   na pasta do projeto (vira morador da casa); agente global, sempre na praça (pasta pessoal). Sempre sessão nova; as
   anteriores continuam como moradores. Editar: pelo prédio da Fábrica.

**Atualização (26/10/2026, passo 7 de `context/ambiente-de-ia-na-vila.md`):** clicar na Fábrica entra nela; a bancada
abre este painel de agentes e a parede de ferramentas abre as skills. Os agentes da vila (bibliotecária e
administrador) aparecem num grupo próprio, só leitura, lidos de `server/agents/` (a cópia instalada da bibliotecária
não aparece repetida). Agente da vila nunca abre conversa por `claude --agent`: a rota recusa (regra 5).

**Atualização (27/10/2026):** todo agente (os NPCs ✦ do pátio, a bibliotecária e o administrador) veste o traje de
agente secreto, estilo "homens de preto" (`villagerTexture(scene, id, true)`); regra 8 do `CLAUDE.md`.

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
| 1 | Servidor: listar, ler, criar, salvar e apagar (só nas pastas de agentes conhecidas) | feito |
| 2 | Painel da Fábrica: lista por lugar + formulário + apagar com confirmação | feito |
| 3 | NPCs ✦ em volta da Fábrica (clique = conversa com o agente) | feito |
