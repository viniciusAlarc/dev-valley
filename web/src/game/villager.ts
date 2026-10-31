import Phaser from 'phaser';
import { agentLookFor, drawSheet, FACING_ROW, FACINGS, lookFor, lookKey, VILLAGER_H, VILLAGER_W, type Genero } from './villagerArt';

export { FACING_ROW, VILLAGER_H, VILLAGER_W, type Facing } from './villagerArt';

/** Gera (uma vez por combinação) a folha de sprites de um morador e suas animações. */
/**
 * `agent`: traje de agente secreto, o padrão de todo NPC ✦ (agente), da Fábrica ou da vila. `genero`: marca do nome do
 * morador, para a aparência combinar com ele.
 */
export function villagerTexture(scene: Phaser.Scene, id: string, agent = false, genero: Genero = null): string {
  const L = agent ? agentLookFor(id) : lookFor(id, genero);
  const key = lookKey(L);
  if (scene.textures.exists(key)) return key;

  const c = document.createElement('canvas');
  c.width = VILLAGER_W * 4;
  c.height = VILLAGER_H * 3;
  drawSheet(c.getContext('2d', { willReadFrequently: true })!, L);

  const tex = scene.textures.addCanvas(key, c)!;
  for (let i = 0; i < 12; i++) tex.add(i, 0, (i % 4) * VILLAGER_W, Math.floor(i / 4) * VILLAGER_H, VILLAGER_W, VILLAGER_H);
  for (const facing of FACINGS) {
    const row = FACING_ROW[facing];
    scene.anims.create({
      key: `${key}-walk-${facing}`,
      frames: [0, 1, 2, 3].map((f) => ({ key, frame: row * 4 + f })),
      frameRate: 7,
      repeat: -1,
    });
  }
  return key;
}
