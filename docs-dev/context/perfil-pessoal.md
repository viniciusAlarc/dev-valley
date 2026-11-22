# Contas do Claude Code: Claude, DeepSeek pessoal e DeepSeek trabalho

> Implementado em 01/11/2026; **redesenhado em 19/11/2026**, com a segunda assinatura do DeepSeek. Código em
> `server/src/perfil.ts` e `server/src/config.ts`; testes em `server/tests/perfil.test.ts`.

## Por quê

A licença do Claude é do trabalho. Projeto pessoal também é trabalhado pela vila, mas o terminal dele fala com outra API
compatível com a da Anthropic (hoje o DeepSeek), paga pelo usuário. O terminal continua sendo o Claude Code; só muda
quem responde.

Em 19/11/2026 o usuário passou a ter uma **segunda assinatura do DeepSeek**. A partir daí “pessoal” e “DeepSeek”
deixaram de ser a mesma coisa: o que antes era um “perfil extra” virou uma **conta com nome, provedor e finalidade**.

## Vocabulário

| Termo | O que é |
|---|---|
| **Provedor** | Quem responde: `claude` ou `deepseek`. Decide a roupa do morador (tons quentes no Claude, frios no DeepSeek) e o rótulo. |
| **Conta** | Um perfil do Claude Code com nome e pasta de configuração: `Claude` (`~/.claude`), `DeepSeek pessoal` (`~/.claude-pessoal`) e `DeepSeek trabalho` (`~/.claude-deepseek`). |
| **Finalidade** | `pessoal` ou `trabalho`. Decide em que casas a conta aparece. |
| **Conta padrão da casa** | A primeira conta cuja `roots` contém a pasta do projeto; sem raiz, o Claude. É a conta que abre quando ninguém escolhe. |

## Decisões do usuário

### Origem (01/11/2026)

| # | Decisão |
|---|---|
| D1 | O tipo vem da **pasta-raiz**: projeto dentro de `roots` de uma conta pessoal abre nela; o resto abre no Claude. Clonou ali, já nasce classificado. |
| D2 | Conta **separada** do Claude Code: o terminal roda com `CLAUDE_CONFIG_DIR` da conta. Conversas, login e configurações não se misturam. |
| D3 | Os agentes da vila (bibliotecária, administrador, escrevente) seguiam **sempre como Claude**, inclusive nas casas pessoais: rodavam com o ambiente da vila, que não tem `CLAUDE_CONFIG_DIR`. **Substituída por D15 (19/11/2026).** |
| D4 | Cada conta segue **as mesmas regras de trabalho**: o `instalar.sh` do repositório de regras roda com o `CLAUDE_CONFIG_DIR` dela, e o `npm run hooks:install` instala o mod, os hooks e os agentes da vila em todas. |
| D5 | **Sem fronteira de dados** entre as contas: o objetivo é só não gastar a licença do trabalho. `@Nome` funciona nos dois sentidos (o mapa de moradores é um só, em `~/.claude/dev-valley`). |

### Perfis extras (19/11/2026, manhã — **substituídas à tarde**)

| # | Decisão | Situação |
|---|---|---|
| D6 | A escolha por sessão no painel da casa, com dois botões: “Nova sessão” (Claude) e “Nova sessão com DeepSeek”. | Substituída por D11/D12. |
| D7 | O botão do extra só aparecia nas casas que abrem no Claude; a casa pessoal continuava abrindo no perfil pessoal. | Substituída por D12. |
| D8 | Ao retomar, o perfil é o da **pasta da conversa** (onde o `.jsonl` mora), nunca o da pasta do projeto. | Mantida, agora por conta. |
| D9 | O sucessor do bastão **herda o perfil exato** da sessão original. | Mantida, agora por conta. |

### Redesenho (19/11/2026, tarde)

| # | Decisão |
|---|---|
| D10 | Nomes na tela: **DeepSeek pessoal** (a de `~/.claude-pessoal`) e **DeepSeek trabalho** (a nova, `~/.claude-deepseek`). |
| D11 | A tela de sessão nova escolhe **só a conta**. O modelo fino (Sonnet/Opus no Claude, Flash/Pro no DeepSeek) continua sendo trocado no `/model` dentro da sessão. |
| D12 | Casas **separadas por finalidade**: casa pessoal só abre contas pessoais (nunca Claude, para não gastar a licença do trabalho); casa de trabalho abre Claude e as contas de trabalho (a conta pessoal não aparece). |
| D13 | Entram nesta entrega a criação, os rótulos, o moinho e a Fábrica (plugins/MCP) por conta; a biblioteca recebeu só os rótulos por conta. Ficam para depois a Fábrica de agentes/skills e as instruções globais (PP-5). |
| D14 | Decisão de implementação: a **sessão avulsa** (banco da praça) oferece **todas** as contas, porque não é casa e a sessão pode ser pessoal. |
| D15 | (19/11/2026, noite) Os agentes que **só leem** (bibliotecária, jornaleiro, jornaleiro da conversa, escrevente, médica e maestro mirim) respondem na conta **DeepSeek trabalho**, escolhida em `agentes.conta` do config local, para continuarem disponíveis quando o Claude está no limite. O **administrador**, único que edita arquivos, continua no Claude; o **maestro** (sessão do porão) fica como está. |

## Como funciona

1. `dev-valley.config.local.json` tem `contas: [...]`, só com as contas **além do Claude** (o Claude de `~/.claude` é
   sempre a primeira, implícito). Exemplo, sem chave nenhuma:
   ```json
   "contas": [
     { "nome": "DeepSeek pessoal", "provedor": "deepseek", "configDir": "~/.claude-pessoal",
       "roots": ["~/Documents/Projetos-pessoais"], "finalidade": "pessoal" },
     { "nome": "DeepSeek trabalho", "provedor": "deepseek", "configDir": "~/.claude-deepseek",
       "finalidade": "trabalho" }
   ]
   ```
   O formato antigo (`perfilPessoal` + `perfisExtras`) continua aceito e é convertido; nome e pasta são únicos, e a
   pasta do Claude não pode ser repetida.
2. A vila procura projetos nas `projectRoots` e em todas as `roots` das contas. Cada casa recebe `contaPadrao` (pela
   raiz) e `contas` (as da mesma finalidade da padrão). A placa da casa mostra “· pessoal” quando a padrão é pessoal.
3. O painel da casa tem **um** botão “Nova sessão”. Ele abre `web/src/ui/novaSessao.ts` com as contas da casa (ou todas,
   na praça). O clique chama `POST /api/sessions` com `{ project, conta }`; a rota valida a conta contra `project.contas`
   e guarda a escolha em `escolhasDeConta` (id da sessão → nome), só até a conversa ser gravada.
4. No `/ws/terminal`, `contaDaSessao` resolve: conversa salva → escolha da abertura → conta padrão da pasta. O terminal
   abre com o `CLAUDE_CONFIG_DIR` da conta resolvida.
5. **Trava:** uma conta DeepSeek só abre se o `settings.json` dela tem `ANTHROPIC_BASE_URL` fora de `anthropic.com` e a
   chave preenchida no `env`. Sem isso o `claude` cairia no login de sempre, que é a licença do trabalho. A mensagem leva
   o **nome da conta**, nunca o valor da chave (G13). A conta do Claude nunca recebe `CLAUDE_CONFIG_DIR` (a de `~/.claude`)
   ou recebe o dela, se for uma conta Claude separada.
6. No mundo, a sessão carrega a `conta` exata: o **provedor** decide a paleta do morador; a casa mostra a conta padrão em
   “Abre em”; a lista de moradores mostra uma etiqueta com a conta quando ela difere da padrão da casa; o topo do terminal
   mostra a conta sempre.
7. **Moinho** e **Quadro de força da Fábrica** separam por conta (cada `.jsonl` guarda a conta dona no cache; os plugins e
   MCP são lidos do `settings.json`/`.claude.json` de cada conta). A **biblioteca** rotula as memórias com o nome da conta.
8. Instalação: `npm run hooks:install` instala mod, hooks e agentes da vila em todas as contas; o `instalar.sh` das regras
   roda uma vez por conta, com o `CLAUDE_CONFIG_DIR` dela.
9. **Agentes que só leem na conta DeepSeek (D15):** `askAgent` (`server/src/consulta.ts`) roda o `claude -p` com o
   `CLAUDE_CONFIG_DIR` da conta de `agentes.conta`; a conta do Claude abre sem a variável, e a trava de chave vale para a
   escolhida (sem base URL/chave, o painel mostra o erro e a consulta não cai na licença do trabalho). O administrador
   usa sempre o Claude. A **Fábrica de agentes** mostra a conta fixa de cada agente da vila na lista
   (`DeepSeek`/`Claude`) e o nome da conta no detalhe; os agentes globais e de projeto não têm etiqueta, porque seguem a
   conta da sessão.

## Configuração de cada conta (fora do repositório)

O `settings.json` de cada conta DeepSeek (permissão 600) tem no `env` o endereço da API, a chave e os modelos. A troca de
modelo é pelo `/model`, como no Claude: o alias `sonnet` aponta para o modelo padrão (rápido) e `opus` para o mais forte,
com `ANTHROPIC_DEFAULT_*_MODEL` e os `_NAME`/`_DESCRIPTION` de cada um; `"model": "sonnet"` deixa o rápido como padrão.
O custo que o Claude Code mostra é estimado pela tabela da Anthropic, não é o que a outra API cobra.

A chave da assinatura nova foi preenchida e a trava aprovou o terminal em 19/11/2026. O valor nunca entra em documento,
teste ou print (G13): só a referência ao arquivo.

## Limitações conhecidas e pendências

- A outra API ignora servidores MCP e `cache_control`; o modelo mais forte do DeepSeek não lê imagem.
- **PP-5:** a Fábrica de **agentes e skills** e as **instruções globais** da biblioteca ainda leem só `~/.claude`;
  agentes/skills globais das contas DeepSeek não aparecem nem podem ser criados pela vila, e o `CLAUDE.md` global delas
  não abre no leitor. Memórias, plugins/MCP, moinho e sessões já são por conta.
- **PP-6:** os limites do plano (canto, clínica e moinho) guardam um único `usage`; se uma sessão DeepSeek reportar
  `rate_limits`, ela sobrescreve os números do Claude. A API do DeepSeek normalmente não manda esse campo.
