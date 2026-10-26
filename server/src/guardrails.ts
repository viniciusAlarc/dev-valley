import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Config } from './config.js';

/** Outdoor dos guardrails (decisão de 26/10/2026): o plugin está ligado? E quais são os guardrails. Só leitura. */
export interface Guardrails {
  /** `enabledPlugins[plugin]` no `~/.claude/settings.json`; o que a vila consegue ver (não se o mod carregou). */
  enabled: boolean;
  plugin: string;
  /** Arquivo da lista (abre no leitor da biblioteca). */
  core: string;
  items: { id: string; title: string }[];
}

const ITEM = /^##\s+(G\d+)\s*[—–-]\s*(.+)$/gm;

export async function readGuardrails(config: Config): Promise<Guardrails | null> {
  if (!config.guardrails) return null;
  const { plugin, core } = config.guardrails;
  const [settings, text] = await Promise.all([
    fs.readFile(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8').catch(() => '{}'),
    fs.readFile(core, 'utf8').catch(() => ''),
  ]);
  let enabled = false;
  try {
    enabled = JSON.parse(settings)?.enabledPlugins?.[plugin] === true;
  } catch {
    // settings.json ilegível: o outdoor mostra como desligado.
  }
  return { enabled, plugin, core, items: [...text.matchAll(ITEM)].map((m) => ({ id: m[1], title: m[2].trim() })) };
}
