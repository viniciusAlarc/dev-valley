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
  test('a mensagem que cita abre a conversa; ferramentas no meio não fecham; o fim da resposta fecha', () => {
    const store = new HookStore();
    assert.equal(evento(store, 'UserPromptSubmit', { citados: [VERA, IRIS] }), true);
    assert.deepEqual(citados(store), [VERA, IRIS]);
    evento(store, 'PreToolUse');
    evento(store, 'PostToolUse');
    assert.deepEqual(citados(store), [VERA, IRIS]);
    assert.equal(evento(store, 'Stop'), true, 'mudou: a conversa acabou');
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

  test('conversa sem o fim da resposta some depois de 10 minutos', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const store = new HookStore();
    evento(store, 'UserPromptSubmit', { citados: [VERA] });
    t.mock.timers.tick(9 * 60_000);
    assert.deepEqual(citados(store), [VERA]);
    t.mock.timers.tick(2 * 60_000);
    assert.deepEqual(citados(store), []);
  });
});
