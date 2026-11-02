# Banca de jornal: o que mudou desde ontem, em linguagem de gente

> Plano decidido em 02/11/2026, ainda não codado (G7). Ao implementar: marcar aqui, registrar no `PROGRESS.md` e
> mover este arquivo para `docs-dev/context/`.

## Por que

Um standup pronto pela manhã: o que você e o time fizeram em cada projeto nas últimas 24h. **Regra do usuário:** a
informação vem em formato humano, nada técnico. Sem hash, branch, nome de arquivo nem jargão de git.

## Na vila → por baixo

| Na vila | Por baixo |
|---|---|
| Jornaleiro ✦ na banca, segurando o jornal | Agente da vila "jornaleiro" (`claude -p --no-session-persistence`, base em `consulta.ts`), terno preto (regra 8) |
| Manchete no balão ao passar o mouse | A frase mais importante da edição do dia ("Time terminou o cadastro de clientes no X") |
| Clique | O jornal: uma seção por projeto, 1 a 3 frases cada, "Você" e "o time" separados |
| Pilha de jornal na banca | Edição de hoje pronta; banca vazia = ainda não saiu (botão "Imprimir a edição") |
| Projeto sem movimento | Não aparece; no rodapé, "Sem novidade em: A, B" |

Exemplo do tom esperado: "No X, você deixou a tela de pedidos aceitando desconto e o time corrigiu o erro que travava o
login." Não: "feat(pedidos): add desconto; fix: auth 401".

## Dados

1. Por casa com git: `git log --since="24 hours ago" --no-merges --format=...` em todas as branches locais e no remoto
   já buscado (o pombal já faz `fetch`; a banca **não** faz rede própria). Autor = você (e-mail do `git config`) ou o time.
2. Só a **mensagem** do commit e a lista de arquivos (para dar contexto ao agente). Nunca o diff.
3. O jornaleiro recebe esse texto e devolve as frases. Ele não lê o repositório nem tem ferramenta (`--tools ""`),
   como o escrevente do pombal.

## Quando sai a edição

Uma por dia, gerada na primeira vez que a vila abre depois das 6h (ou no clique "Imprimir a edição"), guardada em
`~/.cache/dev-valley/jornal/AAAA-MM-DD.json`. Abrir o jornal de novo não gasta token. Sem nenhum commit nas 24h, não chama
o agente ("Dia calmo na vila").

## Passos

1. `server/src/jornal.ts`: coleta do git por casa (reaproveitar `git.ts`), separação você × time, cache do dia.
2. `agents/jornaleiro.md`: instruções (tom humano, sem termos técnicos, 1 a 3 frases por projeto, manchete), só usado pela
   vila, como `escrevente.md`.
3. Rota `GET /api/jornal` e `POST /api/jornal/imprimir`; testes com repositório e remoto de mentira (como
   `pombal.test.ts`), agente imitado.
4. Textura da banca e do jornaleiro (`villagerTexture(scene, id, true)` e entrada na lista de pele × cabelo reservada em
   `villagerArt.ts`); lote em `layout.ts`.
5. Painel `web/src/ui/jornal.ts` com cara de jornal (título, data por extenso, seções).
6. `README.md`, `CLAUDE.md` (regra 5 passa a citar o jornaleiro entre as consultas `claude -p`), `PROGRESS.md`.

## Decisões em aberto (👤, antes de codar)

1. **Janela:** "últimas 24h" ou "desde a última vez que você abriu o jornal"? **Recomendação:** desde a última leitura,
   com piso de 24h. Segunda-feira cobre o fim de semana sem esforço.
2. **Seus commits** entram ou só os do time? **Recomendação:** entram, separados ("Você fez" / "O time fez"); ajuda a
   lembrar onde parou.
3. **Projeto parado há muito tempo** ("X sem movimento há 3 semanas") vai no rodapé do jornal? Foi sugerido no lugar da
   prefeitura, que não entrou. **Recomendação:** sim, uma linha só, a partir de 14 dias.
