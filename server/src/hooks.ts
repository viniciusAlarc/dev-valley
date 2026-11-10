/**
 * Recebe os eventos dos hooks do Claude Code (instalados por `npm run hooks:install`)
 * e mantém o estado ao vivo de cada sessão — inclusive as abertas fora da vila.
 */

export type SessionStatus = 'working' | 'permission' | 'idle';

/** Categoria da ferramenta em uso, mandada pelo mod (regra 3: nunca o nome dela, o arquivo nem o comando). */
export type Atividade = 'ler' | 'editar' | 'rodar' | 'web' | 'agente';
const ATIVIDADES: readonly string[] = ['ler', 'editar', 'rodar', 'web', 'agente'];

export interface HookState {
  id: string;
  cwd: string;
  status: SessionStatus;
  updatedAt: number;
  /** Sessões citadas com `@Nome` (NPCs conversando); vazio = não está conversando. Ver `conversaAtiva`. */
  citados: string[];
  /** Quando a conversa começou (a mensagem que citou). */
  citadosEm: number;
  /** Quando a sessão terminou a última resposta (`Stop`); 0 = ainda não terminou desde a última mensagem. */
  paradoEm: number;
  /** Desde quando está trabalhando sem parar (ou pedindo permissão); 0 = parada. */
  trabalhandoDesde: number;
  /** A ferramenta que está rodando agora, pela categoria; null = pensando entre ferramentas, sem categoria ou parada. */
  atividade: Atividade | null;
}

export interface HookPayload {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  notification_type?: string;
  message?: string;
  /** Ids das sessões citadas, mandados pelo mod junto do `UserPromptSubmit` (regra 3: nunca o texto). */
  citados?: unknown;
  /** Categoria da ferramenta, mandada pelo mod junto do `PreToolUse`. */
  atividade?: unknown;
}

/** Sem evento há tanto tempo, "trabalhando" provavelmente é um processo que morreu. */
const WORKING_STALE_MS = 15 * 60 * 1000;
/** Sessões paradas somem do estado ao vivo depois disso. */
const FORGET_MS = 12 * 60 * 60 * 1000;
/** Limite de segurança da conversa entre NPCs, se o `Stop` não chegar (decisão do usuário, 30/10/2026). */
const CONVERSA_MS = 10 * 60 * 1000;
/** Depois que quem citou termina, quanto tempo a conversa espera o citado começar a responder. */
const RESPOSTA_ESPERA_MS = 20 * 1000;
const SESSION_ID = /^[0-9a-f-]{36}$/;

const ativa = (s: HookState) => s.status === 'working' || s.status === 'permission';

/**
 * A conversa `de` → `para` segue enquanto quem citou trabalha (até CONVERSA_MS), enquanto o citado responde (começou a
 * trabalhar depois da citação) e, entre um e outro, até RESPOSTA_ESPERA_MS depois que quem citou terminou. Assim os
 * dois ficam juntos enquanto o citado responde (pedido do usuário, 30/10/2026: quem citou ia embora quando o outro
 * começava a falar).
 */
export function conversaAtiva(de: HookState, para: HookState | undefined, now: number): boolean {
  if (ativa(de)) return now - de.citadosEm < CONVERSA_MS;
  if (para && ativa(para) && para.trabalhandoDesde >= de.citadosEm) return true;
  return de.paradoEm > 0 && now - de.paradoEm < RESPOSTA_ESPERA_MS;
}

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

    // A conversa começa com a mensagem que cita alguém; mensagem sem citação a encerra. O fim, com o citado
    // respondendo, é decidido em `all()` por `conversaAtiva`.
    const now = Date.now();
    let citados = prev?.citados ?? [];
    let citadosEm = prev?.citadosEm ?? 0;
    let paradoEm = prev?.paradoEm ?? 0;
    if (p.hook_event_name === 'UserPromptSubmit') {
      citados = validCitados(p.citados, id);
      citadosEm = now;
      paradoEm = 0;
    } else if (p.hook_event_name === 'Stop') paradoEm = now;
    const estava = prev ? ativa(prev) : false;
    const trabalhandoDesde = status === 'working' || status === 'permission' ? (estava ? prev!.trabalhandoDesde : now) : 0;
    // A categoria vale só enquanto a ferramenta roda: no fim dela, entre ferramentas, o balão volta aos "..." (pensando;
    // decisão do usuário, 08/11/2026). Pedido de permissão mantém a da ferramenta que pediu.
    let atividade = prev?.atividade ?? null;
    if (p.hook_event_name === 'PreToolUse') atividade = typeof p.atividade === 'string' && ATIVIDADES.includes(p.atividade) ? (p.atividade as Atividade) : null;
    else if (status === 'idle' || p.hook_event_name === 'UserPromptSubmit' || p.hook_event_name === 'PostToolUse') atividade = null;

    if (status === null) this.states.delete(id);
    else this.states.set(id, { id, cwd, status, updatedAt: now, citados, citadosEm, paradoEm, trabalhandoDesde, atividade });
    return status !== prev?.status || atividade !== (prev?.atividade ?? null) || citados.join() !== (prev?.citados ?? []).join();
  }

  /** Sessão apagada na vila: some do estado ao vivo sem esperar o `SessionEnd`. */
  forget(id: string) {
    this.states.delete(id);
  }

  all(): HookState[] {
    const now = Date.now();
    for (const [id, s] of this.states) {
      if (now - s.updatedAt > FORGET_MS) this.states.delete(id);
      else if (s.status === 'working' && now - s.updatedAt > WORKING_STALE_MS) {
        s.status = 'idle';
        s.atividade = null;
      }
    }
    // Conversa encerrada não volta: o citado trabalhar de novo mais tarde não reabre.
    for (const s of this.states.values()) {
      if (s.citados.length) s.citados = s.citados.filter((c) => conversaAtiva(s, this.states.get(c), now));
    }
    return [...this.states.values()];
  }
}
