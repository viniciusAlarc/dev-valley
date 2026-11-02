# Conversa com o jornaleiro e edição extra

> **Implementado em 02/11/2026**, no mesmo dia do plano. O que mudou em relação ao plano está em "Ajustes na
> implementação", no fim.

## Por que

O jornaleiro ✦ é o único agente da vila com quem não dá para conversar. A manchete resume; às vezes o usuário quer o
detalhe ("o que foi esse erro do login?") sem abrir o git, ou o resumo de outro período (depois de férias, projeto
esquecido).

## Decisões (usuário, 02/11/2026: "segue as recomendações")

1. **Clique no jornaleiro abre a conversa**; clique na banca continua abrindo a Gazeta do dia.
2. **Ele enxerga os últimos 30 dias** de commits de todos os projetos da vila (seus e do time), além da edição do dia.
3. **Sem ferramenta, sem diff:** só mensagem de commit e nome de arquivo, como no jornal. Pergunta que exige código vira
   sugestão de abrir uma sessão na casa do projeto.
4. **Edição extra entra junto:** dois atalhos na conversa, "A semana de um projeto" e "Desde uma data", que imprimem uma
   Gazeta especial (outro período, ou só um projeto).

## Na vila → por baixo

| Na vila | Por baixo |
|---|---|
| Clique no jornaleiro ✦ | Painel de conversa, o mesmo da bibliotecária e do administrador (`openChat` em `web/src/ui/librarian.ts`) |
| Pergunta | `claude -p --no-session-persistence` com o agente `jornaleiro-conversa` (regra 5); contexto montado pela vila: edição do dia + pauta dos últimos 30 dias por projeto |
| Botão "A semana de um projeto" | Escolhe a casa; imprime uma edição extra dos últimos 7 dias só daquele projeto |
| Botão "Desde uma data" | Escolhe a data (até 30 dias atrás); imprime uma edição extra de todos os projetos desde ela |
| Edição extra | Abre na mesma folha da Gazeta, com o selo "Edição extra" na linha da data. Não marca o jornal como lido e não substitui a edição do dia |

## Como

- **Servidor (`server/src/jornal.ts`):**
  - `pautaDaConversa(dias = 30)`: reaproveita `commitsDesde` e `pauta`, com teto maior de commits por projeto (o de hoje,
    40 por lado, é para 1 dia).
  - `imprimirExtra({ desde, projectId? })`: o mesmo `montar` com outro período e outra lista de projetos. Grava em
    `~/.cache/dev-valley/jornal/extra.json` (só a última extra). `desde` fora dos últimos 30 dias vira 30 dias atrás.
  - `view()` passa a devolver também `extra`.
- **Agente:** `server/agents/jornaleiro-conversa.md` (o `jornaleiro.md` continua só para imprimir, porque responde em
  JSON). Mesmo tom: linguagem de gente, nada inventado, sem jargão de git; quando a pauta não basta, diz isso e sugere a
  sessão na casa.
- **Agente sem ferramenta:** hoje a `consulta.ts` lê o campo `tools` e o passa em `--allowedTools`. Campo vazio viraria
  um item vazio ali, e omitir `tools` na definição pode significar "herda todas". Na implementação: conferir como o
  Claude Code trata `tools: []` em `--agents` e fazer a `consulta.ts` aceitar agente sem ferramenta, com teste.
- **Rotas (`app.ts`):**
  - `POST /api/jornaleiro/ask`: NDJSON, como `/api/administrador/ask`.
  - `POST /api/jornal/extra`: 202, a página pergunta de novo, como "Imprimir". Projeto que não é da vila responde 404 (G9).
  - As duas só de página local (`isLocalOrigin`).
- **Front:** `JORNALEIRO` em `librarian.ts`, com os dois atalhos. `TownScene`: o clique no NPC chama `ui.openJornaleiro()`.
  `web/src/ui/jornal.ts`: mostra a extra com o selo.

## Custo

Cada pergunta e cada edição extra é uma chamada ao Claude, como na bibliotecária. Nada roda sozinho: só quando o
usuário pergunta ou pede a extra.

## Passos

1. `consulta.ts`: agente sem ferramenta (conferir o comportamento, depois teste).
2. `jornal.ts`: `pautaDaConversa`, `imprimirExtra`, `extra` no `view`; testes (período limitado a 30 dias, projeto de
   fora = 404, pauta sem hash, extra não marca lido nem troca a edição do dia).
3. Agente `jornaleiro-conversa.md` e `askJornaleiro`; rotas com trava de origem; testes de rota.
4. Front: chat do jornaleiro com os atalhos, clique do NPC, selo da extra na Gazeta.
5. Testes, typecheck, build, README, `PROGRESS.md`, `PENDENCIAS.md`.

## Ajustes na implementação

- **Agente sem ferramenta:** a ajuda do `claude` (2.1.316) documenta `--tools ""` para desligar todas. A `consulta.ts`
  ganhou `argsDaConsulta`: agente sem ferramenta vai com `--tools ""` e sem `--allowedTools`. Os outros agentes saem com
  os mesmos argumentos de antes (testes em `server/tests/consulta.test.ts`).
- **Erro latente achado no caminho:** a leitura do cabeçalho dos agentes usava `tools:\s*(.+)`; com o campo vazio, o `\s`
  pulava a quebra de linha e lia `model: sonnet` como lista de ferramentas. Agora lê só até o fim da linha (`[ \t]*`).
- **Uma edição por vez:** pedir a extra enquanto outra edição está sendo escrita responde 409 ("tente de novo em
  instantes"), em vez de mostrar a extra antiga como nova.
- **Atalhos:** só cabe um painel aberto por vez, então o formulário de cada atalho (casa ou data) aparece no lugar dos
  botões, no topo da conversa (`web/src/ui/jornaleiro.ts`). Ao imprimir, a Gazeta extra abre no lugar da conversa, que
  continua guardada. "A semana de um projeto" lista só as casas com git.

