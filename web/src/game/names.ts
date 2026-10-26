import { getWorld } from '../api';

/** Nome do morador: único na vila e fixo, dado pelo servidor (server/src/moradores.ts). */
export function villagerName(sessionId: string) {
  return getWorld().sessions.find((s) => s.id === sessionId)?.name || 'Morador novo';
}
