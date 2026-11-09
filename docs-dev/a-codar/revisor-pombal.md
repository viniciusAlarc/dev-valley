# Revisor do pombal — "🔍 Revisar" antes de enviar

> Decidido em 08/11/2026 (pesquisa de práticas da Anthropic: um Claude escreve, outro revisa). **Só começa depois que
> a entrega de 08/11 (regras duras, conferência ao parar, balão, moinho) estiver commitada**: o usuário quer validar
> isto à parte. Pendência RV-1 no `PENDENCIAS.md`.

## O que é

No painel "Enviar para o time" do pombal, ao lado de "✨ Sugerir texto", um botão **"🔍 Revisar"**. Ele chama um
agente da vila, só leitura e com o contexto limpo (não é a sessão que escreveu o código), que recebe o diff que vai
ser enviado e devolve uma lista curta de **possíveis bugs**, cada um com arquivo, linha e o cenário que quebra.
Sem estilo nem gosto: só o que pode estar errado.

## Como (a confirmar ao codar)

1. Mesmo molde do escrevente (`server/src/escrevente.ts`, `server/agents/escrevente.md`): `claude -p --no-session-persistence`
   pela base de `server/src/consulta.ts` (regra 5), agente `revisor.md` em `server/agents/`.
2. Ferramentas: `Read`, `Grep`, `Glob` (para ler o arquivo inteiro em volta do trecho do diff). Nenhuma de escrita.
3. Rota nova no `app.ts`, com origem local, como a do escrevente.
4. Resposta no painel do pombal: lista; vazia = "Nada suspeito no diff".
5. O agente da vila veste o traje de agente (regra 8) se aparecer na vila; se ficar só no botão, não precisa de NPC.

## Pontos em aberto

- 👤 Aparecer como NPC (perto do pombal) ou só como botão.
- 👤 Teto de tamanho do diff (diff enorme custa caro: avisar e pedir confirmação acima de X linhas).
