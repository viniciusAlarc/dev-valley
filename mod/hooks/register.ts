import type { EngineInterface, Register } from 'claude-code'

import { citados, contextoCitados, contextoProprioNome, corpoStatus, idsCitados, textoRodape, type Mapa } from './moradores'

// Mod do Dev Valley (substitui a status line e quase todos os hooks de shell do settings.json; PD-11).
// Usa só eventos nativos: os `classic.*` de um mod de usuário são pulados pelo plugin de segurança que roda acima
// (cc-plugin-sec-default, visto em 26/10/2026). Por isso "pedindo permissão" continua num hook de shell
// (PermissionRequest e Notification, instalados pelo `npm run hooks:install`): nenhum evento nativo diz quando o
// diálogo de permissão abre (decisão do usuário, 26/10/2026: híbrido).
// À vila vão só session_id, cwd, nome do evento e os ids das sessões citadas (regra 3 do CLAUDE.md do repo): o texto
// das mensagens é lido aqui, localmente, só para achar `@Nome` no mapa de moradores. Vila fechada: tudo falha em
// silêncio e a sessão segue.

/** Espera pela vila para saber o nome do morador antes de seguir sem ele. */
const ESPERA_MS = 1500
/** Espera máxima de cada aviso de evento à vila. */
const AVISO_MS = 1000

let base: string | undefined
let home = ''
/** Nome de morador por sessão (um `/clear` troca o id da sessão sem novo `session.start`). */
const nomes = new Map<string, string>()
/** Sessões que já receberam "você é o morador X" junto de uma mensagem. */
const anunciados = new Set<string>()

async function vila($: EngineInterface): Promise<string> {
  if (base) return base
  home = (await $.env.get('HOME')) ?? ''
  let port = 4777
  try {
    // Gravado pelo `npm run hooks:install` com a porta do dev-valley.config.json.
    port = Number(JSON.parse(await $.fs.read(`${home}/.claude/dev-valley/vila.json`)).port) || port
  } catch {
    // sem o arquivo: porta padrão
  }
  base = `http://127.0.0.1:${port}`
  return base
}

async function post($: EngineInterface, path: string, body: unknown): Promise<string | undefined> {
  const res = await $.http.fetch(`${await vila($)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok ? res.text : undefined
}

/** A promessa, ou undefined se ela não resolver a tempo (ou falhar). */
function aTempo<T>($: EngineInterface, p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise(resolve => {
    $.clock.after(ms, () => resolve(undefined))
    p.then(resolve, () => resolve(undefined))
  })
}

/**
 * Manda o evento à vila (mesmo corpo dos hooks de shell de antes: o servidor não muda), esperando no máximo
 * AVISO_MS. É esperado dentro do hook: trabalho que segue depois de o hook voltar não tem garantia de rodar.
 */
async function avisar($: EngineInterface, evento: string, { sessionId, citados = [] }: { sessionId?: string; citados?: string[] } = {}) {
  const enviar = async () =>
    post($, '/api/hooks', {
      session_id: sessionId ?? (await $.session.id()),
      cwd: await $.session.cwd(),
      hook_event_name: evento,
      // Só ids de sessão do mapa (NPCs conversando, regra 3): nunca o texto da mensagem.
      ...(citados.length ? { citados } : {}),
    })
  await aTempo($, enviar(), AVISO_MS)
}

/** Nome do morador desta sessão; pergunta à vila (mandando só o session_id) quando ainda não sabe. */
async function nomeDoMorador($: EngineInterface): Promise<string | undefined> {
  const id = await $.session.id()
  const conhecido = nomes.get(id)
  if (conhecido) return conhecido
  const resposta = await aTempo($, post($, '/api/moradores/nome', { session_id: id }), ESPERA_MS)
  const name = resposta ? (JSON.parse(resposta) as { name: string | null }).name : null
  if (name) nomes.set(id, name)
  return name ?? undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await avisar($, 'SessionStart')
    await nomeDoMorador($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const id = await $.session.id()
    // `@Nome` é lido só aqui, no mapa local: à vila vão só os ids das sessões citadas (NPCs conversando).
    const nomesCitados = e.isMeta ? [] : citados(e.text)
    let mapa: Mapa | undefined
    const mapaPath = `${home || (await $.env.get('HOME'))}/.claude/dev-valley/moradores.json`
    if (nomesCitados.length) {
      try {
        mapa = JSON.parse(await $.fs.read(mapaPath)) as Mapa
      } catch {
        // sem mapa (vila nunca rodou): a mensagem segue sem esse contexto
      }
    }
    await avisar($, 'UserPromptSubmit', { citados: mapa ? idsCitados(nomesCitados, mapa, id) : [] })
    const contexto: string[] = []
    // "Você é o morador X" junto da primeira mensagem da sessão (o `prompt.compose` de um mod de usuário também é
    // pulado pelo plugin de segurança, visto em 26/10/2026).
    const name = await nomeDoMorador($)
    if (name && !anunciados.has(id)) {
      anunciados.add(id)
      contexto.push(contextoProprioNome(name))
    }
    const citado = mapa && contextoCitados(nomesCitados, mapa, mapaPath)
    if (citado) contexto.push(citado)
    return contexto.length ? next({ ...e, context: [...(e.context ?? []), ...contexto] }) : next(e)
  }).catch(($, e, next) => next(e))

  // Ferramenta: "trabalhando" antes e depois (o diálogo de permissão, se houver, acontece dentro do next).
  on('tool.call', async ($, e, next) => {
    await avisar($, 'PreToolUse')
    const result = await next(e)
    await avisar($, 'PostToolUse')
    return result
  }).catch(($, e, next) => next(e))

  // Fim de turno da conversa principal = esperando o usuário (o fim de turno de um subagente não conta).
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) await avisar($, 'Stop')
    return result
  })

  on('session.end', async ($, e, next) => {
    await avisar($, 'SessionEnd', { sessionId: e.sessionId })
    return next(e)
  })

  // Rodapé: contexto e limites do plano, como a status line de antes, ao lado do `guardrails ✓` (cada mod tem a sua).
  on('session.measure', async ($, e, next) => {
    $.ui.status(textoRodape(e))
    const enviar = async () => post($, '/api/statusline', corpoStatus(await $.session.id(), await $.session.model(), e))
    await aTempo($, enviar(), AVISO_MS)
    return next(e)
  })
}
