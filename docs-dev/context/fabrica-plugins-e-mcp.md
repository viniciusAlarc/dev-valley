# Fábrica: plugins e servidores MCP

> **Implementado em 02/11/2026.** Planejado e codado no mesmo dia; saiu de `docs-dev/a-codar/`.

## Por que

A Fábrica mostra agentes (bancada) e skills (parede de ferramentas), mas plugins e servidores MCP, que também mudam o que
o Claude Code faz, continuam invisíveis. **Decisão do usuário:** isso mora dentro da Fábrica, não num prédio novo.

## Na Fábrica → por baixo

| Na Fábrica | Por baixo |
|---|---|
| Painel de controle na parede (uma alavanca por plugin) | `installed_plugins.json` de cada conta, cruzado com `enabledPlugins` do `settings.json` |
| Alavanca para cima / para baixo | Plugin ligado / desligado |
| Clique na alavanca | Nome, versão, de qual marketplace veio, data de instalação, o que ele traz (skills, comandos, hooks, agentes, MCP) |
| Tomadas na parede (uma por servidor MCP) | `mcpServers` do `.claude.json` de cada conta (global e por projeto) e `.mcp.json` dos projetos da vila |
| Etiqueta com o nome da conta | Item de uma conta (`ContaResumo`: nome e provedor); o painel tem uma seção por conta |

## Dados (conferido em 02/11/2026)

- `<conta>/plugins/installed_plugins.json` (`version: 2`, `plugins` → lista com `scope`, `installPath`, `version`,
  `installedAt`); `settings.json` → `enabledPlugins` e `extraKnownMarketplaces`. O conteúdo de cada plugin sai do
  manifesto em `installPath`.
- MCP: no perfil padrão, o global fica em `~/.claude.json`; nas demais contas, em `<configDir>/.claude.json`. Em 02/11/2026 não havia nenhum servidor em disco; os conectores do
  claude.ai (ex.: Claude Docs) vêm da conta e não ficam em arquivo, então a vila não os vê. Com isso, as tomadas
  ficariam vazias hoje (ver decisão 2).

## Passos

1. `server/src/plugins.ts`: leitura de todas as contas, conteúdo de cada plugin pelo manifesto; MCP dos arquivos acima.
2. Rota `GET /api/plugins`; teste com `HOME` trocado antes do `import` (como `rotas-fabrica-biblioteca.test.ts`).
3. Peça nova no `FactoryScene` (painel de alavancas e tomadas), textura em `interiorTextures.ts`, prévia em
   `web/sprites.html`.
4. Painel `web/src/ui/plugins.ts`.
5. `README.md` (linha da Fábrica), `docs-dev/context/fabrica-de-agentes.md`, `PROGRESS.md`.

## Decisões (usuário, 02/11/2026: "segue as recomendações")

1. Só leitura. Ligar e desligar continua no `/plugin` de uma sessão; o painel diz isso.
2. MCP entra já, mostrando "nenhum servidor MCP configurado nos arquivos" e a linha sobre os conectores do claude.ai.

## Como ficou

- `server/src/plugins.ts` (`Plugins.list`): `installed_plugins.json` + `enabledPlugins` de cada conta (`contasDe`, 19/11/2026), o que
  cada plugin traz pela pasta dele (`skills/`, `commands/`, `agents/`, `hooks/`, `.mcp.json`); MCP do `.claude.json` do
  conta (global e por projeto) e do `.mcp.json` do repositório. Só nome, tipo e onde: o teste confere que comando, URL e
  variáveis não saem. Rota `GET /api/plugins`; testes em `server/tests/plugins.test.ts`.
- Na Fábrica, o quadro de força fica na parede entre a janela e as skills (`switchboard` em `interiorTextures.ts`); as
  alavancas (até cinco) são desenhadas pela `FactoryScene` depois de ler a lista. Painel em `web/src/ui/plugins.ts`.
- Uma seção por conta (19/11/2026): o painel separa "Claude", "DeepSeek pessoal" e "DeepSeek trabalho"; cada linha de MCP diz de qual conta veio.
