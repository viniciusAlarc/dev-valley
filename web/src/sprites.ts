import Phaser from 'phaser';
import { generateTextures } from './game/textures';
import { FACING_ROW, villagerTexture, type Facing } from './game/villager';

/** Galeria para conferir a pixel art dos moradores (só no `npm run dev`: /sprites.html). */
class Gallery extends Phaser.Scene {
  create() {
    generateTextures(this);
    const facings: Facing[] = ['down', 'side', 'up'];
    for (let i = 0; i < 16; i++) {
      const key = villagerTexture(this, `morador-${i}`);
      const x = 20 + (i % 8) * 60;
      const y = 10 + Math.floor(i / 8) * 46;
      facings.forEach((facing, j) => {
        this.add.image(x + j * 17 + 8, y + 37, 'shadow').setOrigin(0.5);
        const s = this.add.sprite(x + j * 17 + 8, y + 38, key, FACING_ROW[facing] * 4).setOrigin(0.5, 1);
        if (location.hash === '#andando') s.play(`${key}-walk-${facing}`);
      });
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  pixelArt: true,
  backgroundColor: '#6fb04a',
  width: 500,
  height: 110,
  zoom: Number(new URLSearchParams(location.search).get('zoom')) || 3,
  scene: Gallery,
});
