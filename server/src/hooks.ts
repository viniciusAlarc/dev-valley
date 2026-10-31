/**
 * Recebe os eventos dos hooks do Claude Code (instalados por `npm run hooks:install`)
 * e mantém o estado ao vivo de cada sessão — inclusive as abertas fora da vila.
 */

export type SessionStatus = 'working' | 'permission' | 'idle';

export interface HookState {
  id: string;
  cwd: string;
  status: SessionStatus;
  updatedAt: number;
  /** Sessões citadas com `@Nome` na mensagem em curso (NPCs conversando); vazio = não está conversando. */
  citados: string[];
  /** Quando a conversa começou: some sozinha depois de CONVERSA_MS. */
  citadosEm: number;
}

export interface HookPayload {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  notification_type?: string;
  message?: string;
  /** Ids das sessões citadas, mandados pelo mod junto do `UserPromptSubmit` (regra 3: nunca o texto). */
  citados?: unknown;
}

/** Sem evento há tanto tempo, "trabalhando" provavelmente é um processo que morreu. */
const WORKING_STALE_MS = 15 * 60 * 1000;
/** Sessões paradas somem do estado ao vivo depois disso. */
const FORGET_MS = 12 * 60 * 60 * 1000;
/** Limite de segurança da conversa entre NPCs, se o `Stop` não chegar (decisão do usuário, 30/10/2026). */
const CONVERSA_MS = 10 * 60 * 1000;
const SESSION_ID = /^[0-9a-f-]{36}$/;

/** Até 5 ids de sessão válidos, sem repetir e sem a própria. */
function validCitados(v: unknown, self: string): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((c): c is string => typeof c === 'string' && SESSION_ID.test(c) && c !== self))].slice(0, 5);
}

export class HookStore {
  private states = new Map<string, HookState>();

  handle(p: HookPayload): boolean {
    const id = p.session_id;
    if (!id || !SESSION_ID.test(id)) return false;
    const prev = this.states.get(id);
    const cwd = p.cwd ?? prev?.cwd ?? '';

    let status: SessionStatus | null = prev?.status ?? 'idle';
    switch (p.hook_event_name) {
      case 'SessionStart':
      case 'Stop':
        status = 'idle';
        break;
      case 'UserPromptSubmit':
      case 'PreToolUse':
      case 'PostToolUse':
        status = 'working';
        break;
      case 'PermissionRequest':
        status = 'permission';
        break;
      case 'Notification':
        if (p.notification_type === 'permission_prompt' || /permiss/i.test(p.message ?? '')) status = 'permission';
        else if (p.notification_type === 'idle_prompt') status = 'idle';
        break;
      case 'SessionEnd':
        status = null;
        break;
      default:
        return false;
    }

    // A conversa começa com a mensagem que cita alguém e acaba no fim da resposta ou numa mensagem sem citação.
    const now = Date.now();
    let citados = prev?.citados ?? [];
    let citadosEm = prev?.citadosEm ?? 0;
    if (p.hook_event_name === 'UserPromptSubmit') {
      citados = validCitados(p.citados, id);
      citadosEm = now;
    } else if (p.hook_event_name === 'Stop') citados = [];

    if (status === null) this.states.delete(id);
    else this.states.set(id, { id, cwd, status, updatedAt: now, citados, citadosEm });
    return status !== prev?.status || citados.join() !== (prev?.citados ?? []).join();
  }

  /** Sessão apagada na vila: some do estado ao vivo sem esperar o `SessionEnd`. */
  forget(id: string) {
    this.states.delete(id);
  }

  all(): HookState[] {
    const now = Date.now();
    for (const [id, s] of this.states) {
      if (now - s.updatedAt > FORGET_MS) this.states.delete(id);
      else if (s.status === 'working' && now - s.updatedAt > WORKING_STALE_MS) s.status = 'idle';
      if (s.citados.length && now - s.citadosEm > CONVERSA_MS) s.citados = [];
    }
    return [...this.states.values()];
  }
}
