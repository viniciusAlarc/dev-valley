import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HookStore } from '../src/hooks.js';

const RAFA = '00000000-0000-0000-0000-0000000000a1';
const VERA = '00000000-0000-0000-0000-0000000000b2';
const IRIS = '00000000-0000-0000-0000-0000000000c3';

const evento = (store: HookStore, hook_event_name: string, extra: object = {}) =>
  store.handle({ session_id: RAFA, cwd: '/tmp/x', hook_event_name, ...extra });
const citados = (store: HookStore) => store.all().find((s) => s.id === RAFA)?.citados;

describe('HookStore: estado da sessão', () => {
  test('mensagem trabalha, fim de turno espera, encerrar some; id inválido e evento desconhecido são ignorados', () => {
    const store = new HookStore();
    assert.equal(evento(store, 'UserPromptSubmit'), true);
    assert.equal(store.all()[0].status, 'working');
    assert.equal(evento(store, 'Stop'), true);
    assert.equal(store.all()[0].status, 'idle');
    assert.equal(evento(store, 'Inventado'), false);
    assert.equal(store.handle({ session_id: '../x', hook_event_name: 'Stop' }), false);
    evento(store, 'SessionEnd');
    assert.deepEqual(store.all(), []);
  });
});

describe('HookStore: NPCs conversando', () => {
  /** Evento de outra sessão (o citado). */
  const da = (store: HookStore, id: string, hook_event_name: string) => store.handle({ session_id: id, cwd: '/tmp/y', hook_event_name });

  test('a mensagem que cita abre a conversa; ferramentas no meio não fecham', () => {
    const store = new HookStore();
    assert.equal(evento(store, 'UserPromptSubmit', { citados: [VERA, IRIS] }), true);
    evento(store, 'PreToolUse');
    evento(store, 'PostToolUse');
    assert.deepEqual(citados(store), [VERA, IRIS]);
  });

  test('quem citou terminou e o citado não respondeu: a conversa espera 20 s e fecha', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const store = new HookStore();
    evento(store, 'UserPromptSubmit', { citados: [VERA] });
    evento(store, 'Stop');
    t.mock.timers.tick(19_000);
    assert.deepEqual(citados(store), [VERA]);
    t.mock.timers.tick(2_000);
    assert.deepEqual(citados(store), []);
  });

  test('o citado responde: os dois ficam juntos até ele terminar, mesmo bem depois dos 20 s (caso visto pelo usuário)', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const store = new HookStore();
    da(store, VERA, 'Stop');
    evento(store, 'UserPromptSubmit', { citados: [VERA] });
    evento(store, 'Stop');
    t.mock.timers.tick(5_000);
    da(store, VERA, 'UserPromptSubmit');
    t.mock.timers.tick(3 * 60_000);
    da(store, VERA, 'PreToolUse');
    assert.deepEqual(citados(store), [VERA], 'a Vera ainda responde');
    da(store, VERA, 'Stop');
    assert.deepEqual(citados(store), [], 'a Vera terminou');
    // Conversa encerrada não volta quando a Vera trabalha de novo depois.
    da(store, VERA, 'UserPromptSubmit');
    assert.deepEqual(citados(store), []);
  });

  test('citado que já trabalhava antes da citação não segura a conversa', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const store = new HookStore();
    da(store, VERA, 'UserPromptSubmit');
    t.mock.timers.tick(1_000);
    evento(store, 'UserPromptSubmit', { citados: [VERA] });
    evento(store, 'Stop');
    t.mock.timers.tick(21_000);
    assert.deepEqual(citados(store), []);
  });

  test('mensagem nova sem citação também fecha; mesma citação de novo não conta como mudança', () => {
    const store = new HookStore();
    evento(store, 'UserPromptSubmit', { citados: [VERA] });
    assert.equal(evento(store, 'UserPromptSubmit', { citados: [VERA] }), false);
    assert.equal(evento(store, 'UserPromptSubmit'), true);
    assert.deepEqual(citados(store), []);
  });

  test('só ids válidos, sem repetir, sem a própria sessão e no máximo 5', () => {
    const store = new HookStore();
    const muitos = Array.from({ length: 8 }, (_, i) => `00000000-0000-0000-0000-00000000000${i}`);
    evento(store, 'UserPromptSubmit', { citados: [VERA, VERA, RAFA, 'Vera', 42, '../x', ...muitos] });
    assert.deepEqual(citados(store), [VERA, ...muitos.slice(0, 4)]);
    evento(store, 'UserPromptSubmit', { citados: 'não é lista' });
    assert.deepEqual(citados(store), []);
  });

  test('quem citou trabalhando sem o fim da resposta: a conversa some depois de 10 minutos', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const store = new HookStore();
    evento(store, 'UserPromptSubmit', { citados: [VERA] });
    t.mock.timers.tick(9 * 60_000);
    assert.deepEqual(citados(store), [VERA]);
    t.mock.timers.tick(2 * 60_000);
    assert.deepEqual(citados(store), []);
  });
});
