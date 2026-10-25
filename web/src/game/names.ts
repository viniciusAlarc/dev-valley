import { hash } from './textures';

const VILLAGER_NAMES = [
  'Ana', 'Bento', 'Caio', 'Duda', 'Elis', 'Fábio', 'Gabi', 'Heitor', 'Íris', 'Joca', 'Kika', 'Lia',
  'Malu', 'Nico', 'Otto', 'Pietra', 'Rafa', 'Sofia', 'Theo', 'Vivi', 'Zeca', 'Bia', 'Davi', 'Nina',
];

/** Cada sessão ganha um nome fixo, derivado do id. */
export function villagerName(sessionId: string) {
  return VILLAGER_NAMES[hash(sessionId) % VILLAGER_NAMES.length];
}
