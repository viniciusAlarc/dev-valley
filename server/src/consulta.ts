import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT_DIR } from './config.js';

/**
 * Consulta a um agente permanente da vila (bibliotecária, administrador da praça). Cada pergunta é um `claude -p`
 * novo e curto, sem gravar sessão (--no-session-persistence): não vira morador nem enche contexto. A continuidade
 * da conversa vem das últimas trocas, repassadas no prompt.
 */

const TIMEOUT_MS = 3 * 60 * 1000;
const MAX_HISTORY = 3;

export type AgentEvent =
  | { type: 'step'; text: string }
  | { type: 'answer'; text: string; costUsd?: number; durationMs?: number }
  | { type: 'error'; text: string };

export interface Exchange {
  question: string;
  answer: string;
}

export interface AgentQuery {
  /** Arquivo em `server/agents/` (nome do agente = nome do arquivo). */
  name: string;
  /** Quem responde, nas mensagens de erro ("A bibliotecária"). */
  who: string;
  replacements?: Record<string, string>;
  /** Contexto montado pela vila na hora, antes da conversa. */
  preamble?: string;
  /** Permissões extras além das ferramentas do agente (ex.: `Edit(//caminho/PROGRESS.md)`). */
  allow?: string[];
  stepFor: (tool: string, input: any) => string;
}

/** Lê o modelo do agente do repositório — a vila usa sempre a versão atual, instalada ou não. */
function agentDefinition(name: string, replacements: Record<string, string> = {}) {
  let raw = fs.readFileSync(path.join(ROOT_DIR, 'server', 'agents', `${name}.md`), 'utf8');
  for (const [key, value] of Object.entries(replacements)) raw = raw.replaceAll(key, value);
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)!;
  const field = (f: string) => fm[1].match(new RegExp(`^${f}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
  return {
    description: field('description'),
    prompt: raw.slice(fm[0].length).replace(/<!--[\s\S]*?-->\s*/, ''),
    tools: field('tools').split(',').map((t) => t.trim()),
    model: field('model') || 'sonnet',
  };
}

function buildPrompt(question: string, history: Exchange[], preamble?: string) {
  const recent = history.slice(-MAX_HISTORY);
  const parts = preamble ? [preamble] : [];
  if (recent.length) {
    const context = recent.map((h) => `Pergunta: ${h.question}\nSua resposta: ${h.answer.slice(0, 1500)}`).join('\n\n');
    parts.push(`Conversa anterior (só para contexto):\n\n${context}`);
  }
  return parts.length ? `${parts.join('\n\n')}\n\nNova pergunta: ${question}` : question;
}

export function askAgent(
  query: AgentQuery,
  question: string,
  history: Exchange[],
  onEvent: (e: AgentEvent) => void,
  hooksToIgnore: Set<string>,
): () => void {
  const sessionId = randomUUID();
  // Os hooks também disparam para esta consulta; a vila ignora este id para não criar morador fantasma.
  hooksToIgnore.add(sessionId);
  const agent = agentDefinition(query.name, query.replacements);
  const child = spawn(
    'claude',
    [
      '-p',
      buildPrompt(question, history, query.preamble),
      '--agents',
      JSON.stringify({ [query.name]: agent }),
      '--agent',
      query.name,
      '--session-id',
      sessionId,
      '--no-session-persistence',
      '--output-format',
      'stream-json',
      '--verbose',
      '--allowedTools',
      // Edit nunca vai liberado inteiro: só os caminhos de `allow` (o resto é negado, sem diálogo no -p).
      ...agent.tools.filter((t) => t !== 'Edit'),
      ...(query.allow ?? []),
    ],
    { cwd: os.homedir(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let buffer = '';
  let stderr = '';
  let finished = false;
  const finish = (e: AgentEvent) => {
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
          if (block.type === 'tool_use') onEvent({ type: 'step', text: query.stepFor(block.name, block.input) });
        }
      } else if (msg.type === 'result') {
        if (msg.is_error || msg.subtype !== 'success') finish({ type: 'error', text: msg.result || `${query.who} não conseguiu responder (${msg.subtype}).` });
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
    finish({ type: 'error', text: `${query.who} demorou demais (3 min). Tente uma pergunta mais específica.` });
    child.kill();
  }, TIMEOUT_MS);
  child.on('close', () => clearTimeout(timer));

  return () => child.kill();
}
