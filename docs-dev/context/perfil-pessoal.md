# Perfil pessoal: projeto pessoal com outra API

> Implementado em 01/11/2026. Código em `server/src/perfil.ts`; testes em `server/tests/perfil.test.ts`.

## Por quê

A licença do Claude é do trabalho. Projeto pessoal também é trabalhado pela vila, mas o terminal dele fala com outra
API compatível com a da Anthropic (hoje o DeepSeek), paga pelo usuário. O terminal continua sendo o Claude Code; só
muda quem responde.

## Decisões do usuário (01/11/2026)

| # | Decisão |
|---|---|
| D1 | O tipo vem da **pasta-raiz**: projeto dentro de `perfilPessoal.roots` é pessoal, o resto é profissional. Clonou ali, já nasce classificado. |
| D2 | Perfil **separado** do Claude Code: o terminal pessoal roda com `CLAUDE_CONFIG_DIR=perfilPessoal.configDir`. Conversas, login e configurações não se misturam. |
| D3 | Os agentes da vila (bibliotecária, administrador, escrevente) seguem **sempre como Claude**, inclusive nas casas pessoais: rodam com o ambiente da vila, que não tem `CLAUDE_CONFIG_DIR`. |
| D4 | O perfil pessoal segue **as mesmas regras de trabalho**: o `instalar.sh` do repositório de regras roda com `CLAUDE_CONFIG_DIR` apontando para ele, e o `npm run hooks:install` instala o mod, os hooks e os agentes da vila nos dois perfis. |
| D5 | **Sem fronteira de dados** entre os perfis: o objetivo é só não gastar a licença do trabalho. `@Nome` funciona nos dois sentidos (o mapa de moradores é um só, em `~/.claude/dev-valley`). |

## Como funciona

1. `dev-valley.config.local.json` tem `perfilPessoal: { roots, configDir }`. Sem isso, todo projeto é profissional.
2. A vila procura projetos também nas `roots` pessoais e marca `perfil` em cada um. A placa da casa diz "· pessoal".
3. Ao abrir o terminal (`/ws/terminal` em `index.ts`), `ambienteDoTerminal` devolve o `CLAUDE_CONFIG_DIR` do perfil.
4. **Trava:** o terminal pessoal só abre se o `settings.json` do perfil tem `ANTHROPIC_BASE_URL` fora de
   `anthropic.com` e a chave preenchida no `env`. Sem isso o `claude` cairia no login de sempre, que é a licença do
   trabalho. A mensagem nunca mostra a chave.
5. A vila lê as conversas dos dois perfis (`projectsDirs`) e, ao encerrar uma sessão, apaga nos dois.

## Configuração do perfil (fora do repositório)

O `settings.json` do perfil pessoal (permissão 600) tem no `env` o endereço da API, a chave e os modelos. A troca de
modelo é pelo `/model`, como no Claude: o alias `sonnet` aponta para o modelo padrão (rápido) e `opus` para o mais forte,
com `ANTHROPIC_DEFAULT_*_MODEL` e os `_NAME`/`_DESCRIPTION` de cada um; `"model": "sonnet"` deixa o rápido como padrão.
O custo que o Claude Code mostra é estimado pela tabela da Anthropic, não é o que a outra API cobra.

## Limitações conhecidas

- A outra API ignora servidores MCP e `cache_control`; o modelo mais forte do DeepSeek não lê imagem.
- As memórias automáticas do perfil pessoal ainda não aparecem na biblioteca (`library.ts` lê só `~/.claude`).
