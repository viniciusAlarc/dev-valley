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
}

export interface HookPayload {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  notification_type?: string;
  message?: string;
}

/** Sem evento há tanto tempo, "trabalhando" provavelmente é um processo que morreu. */
const WORKING_STALE_MS = 15 * 60 * 1000;
/** Sessões paradas somem do estado ao vivo depois disso. */
const FORGET_MS = 12 * 60 * 60 * 1000;

export class HookStore {
  private states = new Map<string, HookState>();

  handle(p: HookPayload): boolean {
    const id = p.session_id;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return false;
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

    if (status === null) this.states.delete(id);
    else this.states.set(id, { id, cwd, status, updatedAt: Date.now() });
    return status !== prev?.status;
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
    }
    return [...this.states.values()];
  }
}
