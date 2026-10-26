import Phaser from 'phaser';
import { activityOf, contextText, type AgentSummary, type Session } from '../api';
import { ui } from '../ui/actions';
import { villagerName } from './names';
import { StatusBubble } from './statusBubble';
import { FACING_ROW, villagerTexture, type Facing } from './villager';

export const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Pixelify Sans", monospace',
  fontSize: '8px',
  color: '#3b2312',
  resolution: 4,
};

/**
 * O ponteiro está na própria vila, e não num painel HTML por cima dela: o Phaser escuta o mouse na janela inteira, e
 * sem isto um clique num botão do painel acionava o que estivesse embaixo (ex.: "+ Novo agente" abria a biblioteca).
 */
export function onCanvas(pointer: Phaser.Input.Pointer) {
  return pointer.event?.target === pointer.manager.game.canvas;
}

/** Diferencia clique de arraste (o arraste move a câmera); só vale clique feito na vila. */
export function isClick(pointer: Phaser.Input.Pointer) {
  return onCanvas(pointer) && pointer.getDistance() < 6 && pointer.getDuration() < 500;
}

export function makeInteractive(
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  tooltip: () => string,
  onClick: () => void,
) {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerover', (p: Phaser.Input.Pointer) => {
    if (!onCanvas(p)) return;
    obj.setTint(0xfff2c4);
    ui.showTooltip(tooltip());
  });
  obj.on('pointerout', () => {
    obj.clearTint();
    ui.hideTooltip();
  });
  obj.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (isClick(p)) onClick();
  });
}

/** Plaquinha de madeira com texto. */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, depth: number) {
  const t = scene.add.text(0, 0, text, TEXT_STYLE).setOrigin(0.5);
  const w = Math.ceil(t.width) + 8;
  const board = scene.add.graphics();
  board.fillStyle(0x2b1a0e).fillRect(-w / 2 - 1, -7, w + 2, 14);
  board.fillStyle(0xe9c88f).fillRect(-w / 2, -6, w, 12);
  board.fillStyle(0xc99a5b).fillRect(-w / 2, 4, w, 2);
  return scene.add.container(Math.round(x), Math.round(y), [board, t]).setDepth(depth);
}

const ACTIVITY_LABEL = {
  working: 'trabalhando',
  permission: 'precisa da sua permissão!',
  idle: 'esperando você',
  offline: '',
};

/** Um morador na tela: sprite, sombra, balão de status, tooltip e clique para abrir o chat. */
export class VillagerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly texture: string;
  facing: Facing = 'down';
  private shadow: Phaser.GameObjects.Image;
  private bubble: StatusBubble;
  /** Sentado: esconde as pernas (a cadeira/sofá fica por cima). */
  private seated = false;

  constructor(
    private scene: Phaser.Scene,
    public session: Session,
    x: number,
    y: number,
  ) {
    this.texture = villagerTexture(scene, session.id);
    this.shadow = scene.add.image(x, y, 'shadow').setOrigin(0.5);
    this.sprite = scene.add.sprite(x, y, this.texture, 0).setOrigin(0.5, 1);
    this.bubble = new StatusBubble(scene);
    makeInteractive(
      this.sprite,
      () => {
        const status = ACTIVITY_LABEL[activityOf(this.session)];
        const context = contextText(this.session);
        return `${villagerName(this.session.id)}: ${this.session.title}${status ? ` (${status})` : ''}${context ? `\n${context}` : ''}`;
      },
      () => ui.openSession(this.session),
    );
    this.update(session);
    this.place();
  }

  update(session: Session) {
    this.session = session;
    this.bubble.set(activityOf(session));
  }

  face(facing: Facing, flipX = false) {
    this.facing = facing;
    this.sprite.setFlipX(facing === 'side' && flipX);
    if (!this.sprite.anims.isPlaying) this.sprite.setFrame(FACING_ROW[facing] * 4);
  }

  walk(facing: Facing, flipX = false) {
    this.face(facing, flipX);
    this.sprite.play(`${this.texture}-walk-${facing}`, true);
  }

  stand() {
    this.sprite.stop();
    this.sprite.setFrame(FACING_ROW[this.facing] * 4);
  }

  sit(facing: Facing) {
    this.seated = true;
    this.face(facing);
    this.sprite.setCrop(0, 0, 16, 26);
    this.shadow.setVisible(false);
    this.place();
  }

  place() {
    const { x, y } = this.sprite;
    this.sprite.setDepth(y);
    this.shadow.setPosition(x, y).setDepth(y - 1);
    this.bubble.setPosition(x + 5, y - (this.seated ? 30 : 33));
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.shadow.destroy();
    this.bubble.destroy();
  }
}

/**
 * Agente (Fábrica, PD-4) como NPC ✦ em volta da Fábrica: mesma aparência gerada dos moradores e a estrela da
 * bibliotecária no lugar do balão de status. Clicar abre uma conversa nova com ele (editar: pelo prédio da Fábrica).
 */
export class AgentNpc {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly texture: string;
  facing: Facing = 'down';
  private shadow: Phaser.GameObjects.Image;
  private star: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    public agent: AgentSummary,
    where: string,
    x: number,
    y: number,
  ) {
    this.texture = villagerTexture(scene, `agente:${agent.path}`);
    this.shadow = scene.add.image(x, y, 'shadow').setOrigin(0.5);
    this.sprite = scene.add.sprite(x, y, this.texture, 0).setOrigin(0.5, 1);
    this.star = scene.add.text(x, y, '✦', { fontFamily: 'serif', fontSize: '10px', color: '#f7d046', resolution: 4 }).setOrigin(0.5);
    makeInteractive(
      this.sprite,
      () =>
        `✦ ${this.agent.name} — agente (${where}) — clique para conversar` +
        (this.agent.description ? `\n${this.agent.description.slice(0, 120)}` : ''),
      () => void ui.talkToAgent(this.agent),
    );
    this.place();
  }

  face(facing: Facing, flipX = false) {
    this.facing = facing;
    this.sprite.setFlipX(facing === 'side' && flipX);
    if (!this.sprite.anims.isPlaying) this.sprite.setFrame(FACING_ROW[facing] * 4);
  }

  walk(facing: Facing, flipX = false) {
    this.face(facing, flipX);
    this.sprite.play(`${this.texture}-walk-${facing}`, true);
  }

  stand() {
    this.sprite.stop();
    this.sprite.setFrame(FACING_ROW[this.facing] * 4);
  }

  place() {
    const { x, y } = this.sprite;
    this.sprite.setDepth(y);
    this.shadow.setPosition(x, y).setDepth(y - 1);
    this.star.setPosition(x + 6, y - 34).setDepth(y + 1);
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.shadow.destroy();
    this.star.destroy();
  }
}
