import { describe, expect, test } from 'claude-code/testing'

import { citados, contextoCitados, corpoStatus, idsCitados, textoRodape, type Mapa } from '../hooks/moradores'

const MAPA: Mapa = {
  atualizadoEm: '2026-10-26T18:00:00.000Z',
  moradores: {
    Vera: { sessao: 'aaaa', projeto: 'exemplo', pasta: '/tmp/exemplo', titulo: 'Arrumar a praça', estado: 'trabalhando', conversa: '/tmp/a.jsonl' },
    Íris: { sessao: 'bbbb', projeto: null, pasta: '/tmp', titulo: 'Avulsa', estado: 'encerrada', conversa: null },
  },
}

const ok = (text: string) => ({ value: { status: 200, ok: true, headers: {}, text } })

/** O limite de espera do mod (`$.clock.after`) nunca dispara: a vila de teste responde na hora. */
const semRelogio = (on: any) => on('clock.after', () => new Promise(() => {}))


describe('@Nome', () => {
  test('acha citações; e-mail e @pacote não contam', () => {
    expect(citados('pergunta pra @Vera e (@Iris), mail a@b.com, @types/node')).toEqual(['Vera', 'Iris', 'types'])
    expect(citados('sem citação')).toEqual([])
  })

  test('contexto: morador achado (sem acento também), desconhecido avisado, minúsculo ignorado', () => {
    const texto = contextoCitados(['Vera', 'Iris', 'Fulano', 'types'], MAPA, '/m.json')!
    expect(texto).toContain('@Vera: sessão aaaa, projeto exemplo')
    expect(texto).toContain('Conversa em /tmp/a.jsonl')
    expect(texto).toContain('@Íris: sessão bbbb, avulsa (praça)')
    expect(texto).toContain('@Fulano: nenhum morador')
    expect(texto).not.toContain('@types')
    expect(contextoCitados(['types'], MAPA, '/m.json')).toBeUndefined()
  })

  test('ids citados: só os do mapa (sem acento também), sem repetir e nunca a própria sessão', () => {
    expect(idsCitados(['Vera', 'Iris', 'Fulano', 'vera'], MAPA, 'zzzz')).toEqual(['aaaa', 'bbbb'])
    expect(idsCitados(['Vera', 'Iris'], MAPA, 'aaaa')).toEqual(['bbbb'])
    expect(idsCitados(['Fulano'], MAPA, 'zzzz')).toEqual([])
  })
})

describe('rodapé e status', () => {
  const medida = {
    context: { tokens: 90000, window: 200000, percent: 45 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 30.5, resetsAt: '2026-10-26T20:00:00Z' }, { kind: 'seven_day', percentUsed: 12 }],
  }

  test('mesmo texto da status line de antes', () => {
    expect(textoRodape(medida)).toBe('🌾 ctx 45% · 5h 30% · 7d 12%')
    expect(textoRodape({ context: { window: 200000 }, rateLimits: [] })).toBe('🌾 ctx 0%')
  })

  test('corpo no formato que /api/statusline já entende', () => {
    const c = corpoStatus('sid', 'modelo-x', medida)
    expect(c.context_window).toEqual({ context_window_size: 200000, used_percentage: 45, total_input_tokens: 90000 })
    expect(c.rate_limits?.five_hour).toEqual({ used_percentage: 30.5, resets_at: '2026-10-26T20:00:00Z' })
  })
})

// Nos testes do mod, cada `on(...)` sem plugin faz o papel do Claude Code por baixo: responde ao evento (`() => ({ ... })`)
// ou às chamadas do mod (`{ value }` para `$.session.id`, `$.http.fetch`...).
const MENSAGEM = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } as never })
const INICIO = { cwd: '/tmp/exemplo', surface: 'terminal' as const, isInteractive: true }

function sessao(on: any, id = 'sid-1') {
  on('session.id', () => ({ value: id }))
  on('session.cwd', () => ({ value: '/tmp/exemplo' }))
  on('env.get', () => ({ value: '/home/teste' }))
  semRelogio(on)
}

describe('mod', () => {
  test('a primeira mensagem diz à sessão o próprio nome; à vila vai só o session_id', async ($, on) => {
    sessao(on)
    const enviados: { url: string; body: unknown }[] = []
    on('fs.read', () => ({ deny: 'sem arquivo' }))
    on('http.fetch', (_$: unknown, e: any) => {
      enviados.push({ url: e.url, body: JSON.parse(e.init?.body ?? '{}') })
      return ok(e.url.endsWith('/api/moradores/nome') ? '{"name":"Vera"}' : '{}')
    })
    let contexto: readonly string[] | undefined
    on('session.start', () => ({ cwd: '/tmp/exemplo' }))
    on('prompt.submit', (_$: unknown, e: any) => ((contexto = e.context), { text: e.text }))
    await $.session.start(INICIO)
    await $.prompt.submit(MENSAGEM('oi'))
    expect(contexto?.join('\n')).toContain('esta sessão é o morador Vera')
    // só na primeira mensagem
    await $.prompt.submit(MENSAGEM('de novo'))
    expect(contexto).toBeUndefined()
    expect(enviados.find((x) => x.url.endsWith('/api/moradores/nome'))?.body).toEqual({ session_id: 'sid-1' })
    expect(enviados.find((x) => x.url.endsWith('/api/hooks'))?.body).toEqual({ session_id: 'sid-1', cwd: '/tmp/exemplo', hook_event_name: 'SessionStart' })
  })

  test('vila fechada: a sessão abre normal, sem nome', async ($, on) => {
    sessao(on)
    on('fs.read', () => ({ deny: 'sem arquivo' }))
    on('http.fetch', () => ({ deny: 'conexão recusada' }))
    let contexto: readonly string[] | undefined = ['marca']
    on('session.start', () => ({ cwd: '/tmp/exemplo' }))
    on('prompt.submit', (_$: unknown, e: any) => ((contexto = e.context), { text: e.text }))
    await $.session.start(INICIO)
    await $.prompt.submit(MENSAGEM('oi'))
    expect(contexto).toBeUndefined()
  })

  test('mensagem com @Nome traz o morador; o texto da mensagem nunca vai à vila (regra 3)', async ($, on) => {
    sessao(on, 'sid-2')
    const corpos: string[] = []
    let contexto: readonly string[] | undefined
    on('fs.read', (_$: unknown, e: any) => (e.path.endsWith('moradores.json') ? { value: JSON.stringify(MAPA) } : { deny: 'sem arquivo' }))
    on('http.fetch', (_$: unknown, e: any) => (corpos.push(e.init?.body ?? ''), ok('{"name":"Bia"}')))
    on('prompt.submit', (_$: unknown, e: any) => ((contexto = e.context), { text: e.text }))
    await $.prompt.submit(MENSAGEM('segredo do projeto: vê o que a @Vera fez'))
    expect(contexto?.join('\n')).toContain('@Vera: sessão aaaa')
    expect(corpos.length).toBeGreaterThan(0)
    for (const c of corpos) {
      expect(c).not.toContain('segredo')
      expect(c).not.toContain('Vera')
      const corpo = JSON.parse(c)
      expect(Object.keys(corpo).every((k) => ['session_id', 'cwd', 'hook_event_name', 'citados'].includes(k))).toBe(true)
      // Da mensagem, só o id da sessão citada (NPCs conversando): nunca o nome digitado nem o texto.
      if (corpo.citados) expect(corpo).toEqual({ session_id: 'sid-2', cwd: expect.any(String), hook_event_name: 'UserPromptSubmit', citados: ['aaaa'] })
    }
    expect(corpos.some((c) => JSON.parse(c).citados)).toBe(true)
  })

  test('mensagem sem @Nome não manda citados', async ($, on) => {
    sessao(on, 'sid-3')
    const corpos: any[] = []
    on('http.fetch', (_$: unknown, e: any) => (corpos.push(JSON.parse(e.init?.body ?? '{}')), ok('{"name":"Bia"}')))
    on('prompt.submit', (_$: unknown, e: any) => ({ text: e.text }))
    await $.prompt.submit(MENSAGEM('só uma pergunta, e-mail a@b.com'))
    expect(corpos.some((c) => 'citados' in c)).toBe(false)
  })

  test('porta lida do vila.json gravado pelo install; fim de turno vira "esperando"', async ($, on) => {
    sessao(on)
    const avisos: { url: string; evento: string }[] = []
    on('fs.read', (_$: unknown, e: any) => (e.path === '/home/teste/.claude/dev-valley/vila.json' ? { value: '{"port":5000}' } : { deny: 'sem arquivo' }))
    on('http.fetch', (_$: unknown, e: any) => (avisos.push({ url: e.url, evento: JSON.parse(e.init?.body ?? '{}').hook_event_name }), ok('{}')))
    on('turn.complete', () => ({ text: '' }))
    await $.turn.complete({ answer: 'pronto', durationMs: 1, isAborted: false, reason: 'answer', category: null, explanation: null, text: 'pronto', turnId: 't1' } as never)
    expect(avisos).toEqual([{ url: 'http://127.0.0.1:5000/api/hooks', evento: 'Stop' }])
  })
})
