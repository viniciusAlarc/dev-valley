# Mapa do ecossistema de IA — decisão e manutenção

> Pedido do usuário em 24/11/2026: uma visualização clara de como o ecossistema trata o que é dito
> à IA, o que ela guarda e o que ela aprende, para apresentação e para análise própria.

## O que é

Um gerador local lê os arquivos reais desta máquina e escreve **duas páginas HTML**:

| Página | Conteúdo | Onde pode ir |
|---|---|---|
| `ecossistema.html` | análise: caminho absoluto, nome de arquivo de memória, título de pendência | só nesta máquina; a pasta é ignorada pelo git |
| `ecossistema-apresentacao.html` | apresentação: caminho pessoal trocado por `~`, projeto por "Casa N", memória e pendência só por contagem | pode ser compartilhada; não contém caminho pessoal nem nome de projeto |

A separação é a fronteira de privacidade. Um botão que esconde texto no DOM não serviria: o arquivo
compartilhado continuaria com o dado dentro.

## Como regenerar

```bash
npx tsx scripts/mapa-ecossistema.ts                 # as duas páginas
npx tsx scripts/mapa-ecossistema.ts --apresentacao  # só a de apresentação
npx tsx scripts/mapa-ecossistema.ts --resumo        # contagens no terminal, sem escrever
```

A saída fica em `docs-dev/ecossistema/` (ignorada pelo git). Para abrir no terminal da vila:

```
http://localhost:4777/api/arquivo?path=<caminho absoluto do html>
```

A rota entrega HTML com `Content-Security-Policy: sandbox allow-scripts`: a página é toda inline
(CSS e JS) e não faz requisição externa. A linguagem visual é editorial e sóbria de propósito: fundo
claro, tipografia de sistema, bordas finas e uma cor de acento. A identidade em pergaminho/pixel da
vila atrapalhava a leitura de uma página densa (correção do usuário em 24/11/2026).

## O que a página mostra

1. **Estado atual** — métricas lidas dos arquivos: guardrails, cobertura automática, peças mapeadas,
   memória, pendências por dono, auditoria, skills e moradores.
2. **O caminho do que é dito** — cinco camadas: Entrada, Contexto, Ação, Rastro e Aprendizado. Cada
   card abre um painel com caminho, tamanho, data e itens.
3. **Fluxos** — abrir uma sessão, fazer uma entrega, aprender uma correção e uma sessão na vila.
4. **Guardrails** — tabela lida do `guardrails-core.md`, com a cobrança de cada regra.
5. **Saúde** — sinais calculados do estado: orçamento do núcleo, auditoria, cobertura, mods por conta,
   agentes instalados e cópias do roteador.
6. **Onde isso aparece na vila** — a ligação com as peças do jogo.

## De onde lê

- `~/Documents/IA`: guardrails, convenções da CNR, perfil, skills, agentes, mods, templates e instaladores.
- `~/.claude` e `~/.claude-deepseek`: roteador, settings (só permissões, hooks e plugins), agentes,
  skills, memória (só nome e tamanho), plugins instalados e estado da vila.
- O próprio repositório: `CLAUDE.md`, `.claude/rules/`, rastros (`PROGRESS.md`, `PENDENCIAS.md`,
  `RETRABALHO.md`), `docs-dev/painel.json`, planos, contextos, operação, mod e agentes da vila.

**Nunca lê:** `.credentials.json`, `.env`, `policy-limits.json`, histórico de prompt, conversas
(`projects/**/*.jsonl`) nem o bloco `env` do settings. Caminho ausente vira seção vazia, sem erro.

## Manutenção

- Peça nova no ecossistema: acrescentar o card na camada certa em `scripts/mapa-ecossistema.ts`
  (função `coletarEcossistema`) e um caminho em `docs-dev/context/` se for decisão de arquitetura.
- A página é um retrato: não se atualiza sozinha. Regenere depois de mudar regra, memória ou rastro.
- O teste `server/tests/mapa-ecossistema.test.ts` usa home e repositório de mentira; nunca lê projeto
  de verdade. Ele confere os parsers, a máscara, o determinismo e a ausência de dado pessoal na versão
  de apresentação.
- G19 vale para a página: contorno inteiro neutro; cor de identidade só em ponto, badge ou número.
- A PP-5 (Fábrica e biblioteca lendo só `~/.claude`) deixou de limitar o mapa em 24/11/2026: o `CLAUDE.md`,
  `skills/` e `agents/` das contas DeepSeek são links para os de lá (`perfil-pessoal.md`, D16).
