import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import Phaser from 'phaser';
import { connectWorld, onWorld } from './api';
import { TownScene } from './game/TownScene';
import './style.css';
import { mountHud } from './ui/hud';

await document.fonts.load('16px "Pixelify Sans"');

const scene = new TownScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#2f5a26',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene,
});

mountHud();

onWorld((w) => scene.applyWorld(w));
connectWorld();
