import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './config.js';

/** O que mudou no próprio Dev Valley depois que a vila subiu (sino da praça; o reinício é do usuário, regra 6). */
export interface RestartPending {
  server: boolean;
  web: boolean;
}

const STARTED_AT = Date.now();
/** A varredura roda no máximo a cada CACHE_MS: o mundo é refeito a cada 3s. */
const CACHE_MS = 15_000;
let cache: { at: number; value: RestartPending } | null = null;

async function newestMtime(target: string): Promise<number> {
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.mtimeMs;
  const entries = await fs.readdir(target);
  const times = await Promise.all(entries.map((e) => newestMtime(path.join(target, e))));
  return Math.max(stat.mtimeMs, ...times);
}

/**
 * Servidor: `server/src` mais novo que o processo. Front: `web/src` mais novo que o último build (`web/dist`),
 * que o `npm start` refaz antes de subir.
 */
export async function restartPending(): Promise<RestartPending> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const [server, web, webHtml, built] = await Promise.all([
    newestMtime(path.join(ROOT_DIR, 'server', 'src')),
    newestMtime(path.join(ROOT_DIR, 'web', 'src')),
    newestMtime(path.join(ROOT_DIR, 'web', 'index.html')),
    newestMtime(path.join(ROOT_DIR, 'web', 'dist', 'index.html')),
  ]);
  const value = { server: server > STARTED_AT, web: Math.max(web, webHtml) > built };
  cache = { at: Date.now(), value };
  return value;
}
