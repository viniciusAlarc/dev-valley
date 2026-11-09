/**
 * Ícones do balão de quem trabalha (decisão do usuário, 08/11/2026; redesenhados no mesmo dia porque o livro e o lápis
 * não se reconheciam). Cada ícone é uma grade de caracteres, com contorno escuro, desenhada no balão maior
 * (`BALAO_ICONE`): lupa = lendo/buscando, lápis = editando, terminal = rodando comando, globo = na web, ✦ = com um agente.
 * Sem Phaser, para o teste conferir que cabem. `.` = transparente.
 */
import type { Atividade } from '../api';

/** Balão dos ícones: maior que o dos "..." (16×12), com miolo de 18×11. */
export const BALAO_ICONE = { w: 18, h: 14, miolo: 11 } as const;

export const PALETA_ICONE: Record<string, string> = {
  k: '#3b2312', // contorno
  w: '#ffffff',
  l: '#cfe8ff', // lente
  y: '#e8b030', // corpo do lápis
  p: '#e07070', // borracha
  m: '#c0c4c8', // anel de metal
  s: '#e8c890', // madeira da ponta
  t: '#2b2b2b', // tela do terminal
  T: '#7ee07e', // texto do terminal
  b: '#4a90d9', // mar
  G: '#5cb85c', // terra
  v: '#7a4fc0', // estrela
  V: '#b48ae0', // brilho da estrela
};

export const ICONES: Record<Atividade, string[]> = {
  ler: [
    '..kkkk....',
    '.kllllk...',
    'klwllllk..',
    'klwllllk..',
    'kllllllk..',
    '.kllllk...',
    '..kkkkkk..',
    '......kkk.',
    '.......kk.',
  ],
  editar: [
    '.......kk.',
    '......kppk',
    '.....kmmpk',
    '....kyymk.',
    '...kyyyk..',
    '..kyyyk...',
    '.ksyyk....',
    '.kssk.....',
    '.kkk......',
  ],
  rodar: [
    'kkkkkkkkkkkk',
    'kttttttttttk',
    'ktTttttttttk',
    'kttTtttttttk',
    'ktTttTTTtttk',
    'kttttttttttk',
    'kkkkkkkkkkkk',
  ],
  web: [
    '..kkkkk..',
    '.kbGGbbk.',
    'kbGGGbbbk',
    'kbbGbbGGk',
    'kbbbbGGGk',
    'kbbbbbGbk',
    '.kbbbbbk.',
    '..kkkkk..',
  ],
  agente: [
    '....k....',
    '...kVk...',
    '...kvk...',
    '.kkvvvkk.',
    'kVvvvvvvk',
    '.kkvvvkk.',
    '...kvk...',
    '...kvk...',
    '....k....',
  ],
};

/** Canto de cima à esquerda do ícone dentro do balão: centrado no miolo. */
export function posicaoDoIcone(icone: string[]): { x: number; y: number } {
  const w = Math.max(...icone.map((l) => l.length));
  return { x: Math.floor((BALAO_ICONE.w - w) / 2), y: Math.floor((BALAO_ICONE.miolo - icone.length) / 2) };
}
