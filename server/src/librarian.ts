import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CATALOG_PATH } from './catalog.js';
import { ROOT_DIR } from './config.js';

/**
 * Consultas à bibliotecária feitas pela vila. Cada pergunta é um `claude -p` novo e curto:
 * a "memória" dela é o catálogo em disco, não a conversa — por isso nunca enche o contexto.
 * Não grava sessão (--no-session-persistence), então não vira morador nem deixa histórico.
 */

const TIMEOUT_MS = 3 * 60 * 1000;
const MAX_HISTORY = 3;

export type LibrarianEvent =
  | { type: 'step'; text: string }
  | { type: 'answer'; text: string; costUsd?: number; durationMs?: number }
  | { type: 'error'; text: string };

export interface Exchange {
  question: string;
  answer: string;
}

/** Lê o modelo do agente do repositório — a vila usa sempre a versão atual, instalada ou não. */
function agentDefinition() {
  const raw = fs.readFileSync(path.join(ROOT_DIR, 'server', 'agents', 'bibliotecaria.md'), 'utf8').replaceAll('{{CATALOGO}}', CATALOG_PATH);
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)!;
  const field = (name: string) => fm[1].match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
  return {
    description: field('description'),
    prompt: raw.slice(fm[0].length).replace(/<!--[\s\S]*?-->\s*/, ''),
    tools: field('tools').split(',').map((t) => t.trim()),
    model: field('model') || 'sonnet',
  };
}

function stepFor(tool: string, input: any): string {
  const file = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');
  if (tool === 'Read') return input?.file_path === CATALOG_PATH ? '📇 Consultando o catálogo' : `📖 Lendo ${file(input?.file_path)}`;
  if (tool === 'Grep') return `🔎 Procurando "${String(input?.pattern ?? '').slice(0, 40)}"`;
  if (tool === 'Glob') return `🗂️ Olhando as estantes (${String(input?.pattern ?? '').slice(0, 40)})`;
  return `🔧 ${tool}`;
}

function buildPrompt(question: string, history: Exchange[]) {
  const recent = history.slice(-MAX_HISTORY);
  if (!recent.length) return question;
  const context = recent.map((h) => `Pergunta: ${h.question}\nSua resposta: ${h.answer.slice(0, 1500)}`).join('\n\n');
  return `Conversa anterior (só para contexto):\n\n${context}\n\nNova pergunta: ${question}`;
}

export function askLibrarian(
  question: string,
  history: Exchange[],
  onEvent: (e: LibrarianEvent) => void,
  hooksToIgnore: Set<string>,
): () => void {
  const sessionId = randomUUID();
  // Os hooks também disparam para esta consulta; a vila ignora este id para não criar morador fantasma.
  hooksToIgnore.add(sessionId);
  const agent = agentDefinition();
  const child = spawn(
    'claude',
    [
      '-p',
      buildPrompt(question, history),
      '--agents',
      JSON.stringify({ bibliotecaria: agent }),
      '--agent',
      'bibliotecaria',
      '--session-id',
      sessionId,
      '--no-session-persistence',
      '--output-format',
      'stream-json',
      '--verbose',
      '--allowedTools',
      ...agent.tools,
    ],
    { cwd: os.homedir(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let buffer = '';
  let stderr = '';
  let finished = false;
  const finish = (e: LibrarianEvent) => {
    if (finished) return;
    finished = true;
    onEvent(e);
  };

  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === 'assistant') {
        for (const block of msg.message?.content ?? []) {
          if (block.type === 'tool_use') onEvent({ type: 'step', text: stepFor(block.name, block.input) });
        }
      } else if (msg.type === 'result') {
        if (msg.is_error || msg.subtype !== 'success') finish({ type: 'error', text: msg.result || `A bibliotecária não conseguiu responder (${msg.subtype}).` });
        else finish({ type: 'answer', text: msg.result ?? '', costUsd: msg.total_cost_usd, durationMs: msg.duration_ms });
      }
    }
  });
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.on('error', (err) => finish({ type: 'error', text: `Não consegui chamar o claude: ${err.message}` }));
  child.on('close', (code) => {
    // Um hook atrasado (ex.: SessionEnd) ainda pode chegar logo depois.
    setTimeout(() => hooksToIgnore.delete(sessionId), 10_000);
    finish({ type: 'error', text: `A consulta terminou sem resposta (código ${code}). ${stderr.trim().slice(0, 300)}` });
  });

  const timer = setTimeout(() => {
    finish({ type: 'error', text: 'A bibliotecária demorou demais (3 min). Tente uma pergunta mais específica.' });
    child.kill();
  }, TIMEOUT_MS);
  child.on('close', () => clearTimeout(timer));

  return () => child.kill();
}
