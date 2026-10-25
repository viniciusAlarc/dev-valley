import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import Phaser from 'phaser';
import { connectWorld, onWorld } from './api';
import { InteriorScene } from './game/InteriorScene';
import { LibraryScene } from './game/LibraryScene';
import { TownScene } from './game/TownScene';
import './style.css';
import { mountHud } from './ui/hud';
import { mountUsage } from './ui/usage';

await document.fonts.load('16px "Pixelify Sans"');

const scene = new TownScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#2f5a26',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene, InteriorScene, LibraryScene],
});

mountHud();
mountUsage();

onWorld((w) => scene.applyWorld(w));
connectWorld();
