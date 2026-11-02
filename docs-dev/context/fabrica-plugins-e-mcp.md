# Fábrica: plugins e servidores MCP

> **Implementado em 02/11/2026.** Planejado e codado no mesmo dia; saiu de `docs-dev/a-codar/`.

## Por que

A Fábrica mostra agentes (bancada) e skills (parede de ferramentas), mas plugins e servidores MCP, que também mudam o que
o Claude Code faz, continuam invisíveis. **Decisão do usuário:** isso mora dentro da Fábrica, não num prédio novo.

## Na Fábrica → por baixo

| Na Fábrica | Por baixo |
|---|---|
| Painel de controle na parede (uma alavanca por plugin) | `installed_plugins.json` do perfil, cruzado com `enabledPlugins` do `settings.json` |
| Alavanca para cima / para baixo | Plugin ligado / desligado |
| Clique na alavanca | Nome, versão, de qual marketplace veio, data de instalação, o que ele traz (skills, comandos, hooks, agentes, MCP) |
| Tomadas na parede (uma por servidor MCP) | `mcpServers` do `~/.claude.json` (global e por projeto) e `.mcp.json` dos projetos da vila |
| Etiqueta "pessoal" | Item do perfil pessoal (`perfilPessoal.configDir`) |

## Dados (conferido em 02/11/2026)

- `~/.claude/plugins/installed_plugins.json` (`version: 2`, `plugins` → lista com `scope`, `installPath`, `version`,
  `installedAt`); `settings.json` → `enabledPlugins` e `extraKnownMarketplaces`. O conteúdo de cada plugin sai do
  manifesto em `installPath`.
- MCP: hoje **não há nenhum servidor em disco** (`~/.claude.json` sem `mcpServers`, nenhum projeto com). Os conectores do
  claude.ai (ex.: Claude Docs) vêm da conta e não ficam em arquivo, então a vila não os vê. Com isso, as tomadas
  ficariam vazias hoje (ver decisão 2).

## Passos

1. `server/src/plugins.ts`: leitura dos dois perfis, conteúdo de cada plugin pelo manifesto; MCP dos arquivos acima.
2. Rota `GET /api/plugins`; teste com `HOME` trocado antes do `import` (como `rotas-fabrica-biblioteca.test.ts`).
3. Peça nova no `FactoryScene` (painel de alavancas e tomadas), textura em `interiorTextures.ts`, prévia em
   `web/sprites.html`.
4. Painel `web/src/ui/plugins.ts`.
5. `README.md` (linha da Fábrica), `docs-dev/context/fabrica-de-agentes.md`, `PROGRESS.md`.

## Decisões (usuário, 02/11/2026: "segue as recomendações")

1. Só leitura. Ligar e desligar continua no `/plugin` de uma sessão; o painel diz isso.
2. MCP entra já, mostrando "nenhum servidor MCP configurado nos arquivos" e a linha sobre os conectores do claude.ai.

## Como ficou

- `server/src/plugins.ts` (`Plugins.list`): `installed_plugins.json` + `enabledPlugins` de cada perfil (`perfisDe`), o que
  cada plugin traz pela pasta dele (`skills/`, `commands/`, `agents/`, `hooks/`, `.mcp.json`); MCP do `.claude.json` do
  perfil (global e por projeto) e do `.mcp.json` do repositório. Só nome, tipo e onde: o teste confere que comando, URL e
  variáveis não saem. Rota `GET /api/plugins`; testes em `server/tests/plugins.test.ts`.
- Na Fábrica, o quadro de força fica na parede entre a janela e as skills (`switchboard` em `interiorTextures.ts`); as
  alavancas (até cinco) são desenhadas pela `FactoryScene` depois de ler a lista. Painel em `web/src/ui/plugins.ts`.
- A etiqueta "pessoal" virou seção: o painel separa "Perfil do trabalho (Claude)" e "Perfil pessoal (DeepSeek)".
