import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTA_CLAUDE, ROOT_DIR, type Conta } from './config.js';
import { problemaDaContaSync } from './perfil.js';

/**
 * Consulta a um agente permanente da vila (bibliotecária, administrador da praça). Cada pergunta é um `claude -p`
 * novo e curto, sem gravar sessão (--no-session-persistence): não vira morador nem enche contexto. A continuidade
 * da conversa vem das últimas trocas, repassadas no prompt.
 */

const TIMEOUT_MS = 3 * 60 * 1000;
const MAX_HISTORY = 3;

/**
 * Agentes da vila que respondem na conta de `agentes.conta` (os que só leem). Agente novo fica fora até decisão
 * explícita: o padrão é o Claude, que é a licença do trabalho. O administrador é o único que edita, e fica no Claude.
 */
export const AGENTES_NA_CONTA = new Set(['bibliotecaria', 'jornaleiro', 'jornaleiro-conversa', 'escrevente', 'medica', 'maestro-mirim', 'critico-do-cartao']);

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
  /**
   * Só o que está liberado vale, nada é aprovado por classificador (`--permission-mode default`; no `-p` o resto é
   * negado). O maestro mirim usa: só lê, mesmo com o modo `auto` no settings do usuário (04/11/2026).
   */
  estrito?: boolean;
  /** Conta que responde (padrão: Claude). Os agentes que só leem usam a conta DeepSeek do config local. */
  conta?: Conta;
  stepFor: (tool: string, input: any) => string;
}

/** Lê o modelo do agente do repositório — a vila usa sempre a versão atual, instalada ou não. */
export function agentDefinition(name: string, replacements: Record<string, string> = {}) {
  let raw = fs.readFileSync(path.join(ROOT_DIR, 'server', 'agents', `${name}.md`), 'utf8');
  for (const [key, value] of Object.entries(replacements)) raw = raw.replaceAll(key, value);
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)!;
  // `[ \t]*` e não `\s*`: com o campo vazio (`tools:`), `\s` pularia a quebra de linha e leria o campo de baixo.
  const field = (f: string) => fm[1].match(new RegExp(`^${f}:[ \\t]*(.*)$`, 'm'))?.[1].trim() ?? '';
  return {
    description: field('description'),
    prompt: raw.slice(fm[0].length).replace(/<!--[\s\S]*?-->\s*/, ''),
    // Campo vazio = agente sem ferramenta nenhuma (jornaleiro da conversa, 02/11/2026).
    tools: field('tools').split(',').map((t) => t.trim()).filter(Boolean),
    model: field('model') || 'sonnet',
  };
}

/**
 * Ambiente do `claude -p` de uma consulta. A conta DeepSeek entra como `CLAUDE_CONFIG_DIR`; a do Claude de `~/.claude`
 * tira a variável herdada, para a consulta não cair numa conta DeepSeek quando o servidor foi iniciado de dentro de
 * uma sessão dela.
 */
export function ambienteDaConsulta(conta: Conta = CONTA_CLAUDE, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  if (conta.provedor === 'claude' && conta.configDir === CONTA_CLAUDE.configDir) delete env.CLAUDE_CONFIG_DIR;
  else env.CLAUDE_CONFIG_DIR = conta.configDir;
  return env;
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

/**
 * Argumentos do `claude -p` de uma consulta. Agente sem ferramenta vai com `--tools ""` (o Claude Code desliga todas) e
 * sem `--allowedTools`: omitir a lista não basta, porque a definição sem `tools` herda as ferramentas padrão.
 */
export function argsDaConsulta(
  name: string,
  agent: { description: string; prompt: string; tools: string[]; model: string },
  prompt: string,
  sessionId: string,
  allow: string[] = [],
  estrito = false,
): string[] {
  const base = ['-p', prompt, '--agents', JSON.stringify({ [name]: agent }), '--agent', name, '--session-id', sessionId];
  const fixos = ['--no-session-persistence', '--output-format', 'stream-json', '--verbose', ...(estrito ? ['--permission-mode', 'default'] : [])];
  // Edit e Bash nunca vão liberados inteiros: só as regras de `allow` (o resto é negado, sem diálogo no -p).
  const liberadas = [...agent.tools.filter((t) => t !== 'Edit' && t !== 'Bash'), ...allow];
  if (!agent.tools.length && !allow.length) return [...base, ...fixos, '--tools', ''];
  return [...base, ...fixos, '--allowedTools', ...liberadas];
}

export function askAgent(
  query: AgentQuery,
  question: string,
  history: Exchange[],
  onEvent: (e: AgentEvent) => void,
  hooksToIgnore: Set<string>,
): () => void {
  const sessionId = randomUUID();
  const agent = agentDefinition(query.name, query.replacements);
  const conta = query.conta ?? CONTA_CLAUDE;
  // A trava (perfil.ts) impede o `claude` de cair no login do trabalho quando a conta está sem base URL ou sem chave.
  const erroDaConta = conta.provedor === 'deepseek' ? problemaDaContaSync(conta.configDir) : null;
  if (erroDaConta) {
    // Sem spawn: nada de morador fantasma. O erro leva o nome da conta e o motivo, nunca o valor da chave (G13).
    setTimeout(() => onEvent({ type: 'error', text: `${conta.nome}: ${erroDaConta} A consulta não usou a licença do trabalho.` }), 0);
    return () => {};
  }
  // Os hooks também disparam para esta consulta; a vila ignora este id para não criar morador fantasma.
  hooksToIgnore.add(sessionId);
  const child = spawn(
    'claude',
    argsDaConsulta(query.name, agent, buildPrompt(question, history, query.preamble), sessionId, query.allow, query.estrito),
    { cwd: os.homedir(), env: ambienteDaConsulta(conta), stdio: ['ignore', 'pipe', 'pipe'] },
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
