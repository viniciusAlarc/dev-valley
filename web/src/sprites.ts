import Phaser from 'phaser';
import { CONVERSA_DX, TALK_Y } from './game/common';
import { generateTextures } from './game/textures';
import { FACING_ROW, villagerTexture, type Facing } from './game/villager';

/** Galeria para conferir a pixel art dos moradores e, na última linha, dos agentes ✦ (só no `npm run dev`: /sprites.html). */
class Gallery extends Phaser.Scene {
  create() {
    generateTextures(this);
    const facings: Facing[] = ['down', 'side', 'up'];
    for (let i = 0; i < 24; i++) {
      // as duas primeiras linhas são moradores (sessões); a terceira, agentes com o traje de agente secreto
      const key = i < 16 ? villagerTexture(this, `morador-${i}`) : villagerTexture(this, `agente-${i}`, true);
      const x = 20 + (i % 8) * 60;
      const y = 10 + Math.floor(i / 8) * 46;
      facings.forEach((facing, j) => {
        this.add.image(x + j * 17 + 8, y + 37, 'shadow').setOrigin(0.5);
        const s = this.add.sprite(x + j * 17 + 8, y + 38, key, FACING_ROW[facing] * 4).setOrigin(0.5, 1);
        if (location.hash === '#andando') s.play(`${key}-walk-${facing}`);
      });
    }
    // Última linha: dois moradores conversando, com o "..." de quem citou (sempre trabalhando) e o balão da conversa,
    // nas mesmas medidas da vila.
    const y = 10 + 3 * 46 + 52;
    const de = villagerTexture(this, 'morador-0');
    const para = villagerTexture(this, 'morador-1');
    [40, 140].forEach((x) => {
      this.add.image(x, y, 'shadow');
      this.add.image(x + CONVERSA_DX, y, 'shadow');
      this.add.sprite(x, y + 1, de, FACING_ROW.side * 4).setOrigin(0.5, 1);
      this.add.sprite(x + CONVERSA_DX, y + 1, para, FACING_ROW.side * 4).setOrigin(0.5, 1).setFlipX(true);
      this.add.image(x + CONVERSA_DX / 2, y - TALK_Y, 'talk');
    });
    // Só o par da esquerda com o "..." (balão do StatusBubble, sem os pontinhos): para comparar com e sem.
    this.add.image(40 + 5, y - 33 - 6, 'bubble');
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  pixelArt: true,
  backgroundColor: '#6fb04a',
  width: 500,
  height: 230,
  zoom: Number(new URLSearchParams(location.search).get('zoom')) || 3,
  scene: Gallery,
});
