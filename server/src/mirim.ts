import fs from 'node:fs/promises';
import path from 'node:path';
import { askAgent, type AgentEvent, type Exchange } from './consulta.js';
import { RODADAS_DIR } from './porao.js';
import type { Project, WorldSession } from './world.js';

/**
 * Maestro mirim (decisão do usuário, 04/11/2026): o assistente do maestro, só para o usuário tirar dúvidas da rodada
 * enquanto o maestro rege. Mesma base da bibliotecária (`consulta.ts`): cada pergunta é um `claude -p` novo, sem virar
 * morador, e ele não é atualizado por ninguém, só lê o estado na hora em que o usuário pergunta. **Só lê**: Read, Grep,
 * Glob e `git status/diff/log` da pasta do projeto, em modo estrito; não fala com o maestro nem com as sessões.
 */

/** Quantos passos recentes de cada sessão entram no resumo (o resto ele lê no `.jsonl`, se precisar). */
const PASSOS = 8;
/** Só o fim do `.jsonl` é lido para o resumo: a conversa inteira pode ter megabytes. */
const FIM_DO_ARQUIVO = 256 * 1024;

const curto = (t: string, n: number) => {
  const s = t.replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

function hora(iso: unknown): string {
  const d = typeof iso === 'string' ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--:--';
}

function descreverFerramenta(nome: string, input: any): string {
  const arq = typeof input?.file_path === 'string' ? input.file_path : null;
  if (arq) return `${nome} ${arq}`;
  if (nome === 'Bash') return `Bash: ${curto(String(input?.command ?? ''), 120)}`;
  if (nome === 'SendMessage') return `SendMessage → ${curto(String(input?.message ?? ''), 140)}`;
  return nome;
}

/**
 * Os últimos passos de uma conversa: o que ela disse, as ferramentas que usou e as mensagens que recebeu, com a hora.
 * Lê só o fim do arquivo; linha cortada no começo ou sendo escrita é pulada.
 */
export async function ultimosPassos(file: string, n = PASSOS): Promise<string[]> {
  let raw: string;
  try {
    const fh = await fs.open(file, 'r');
    try {
      const { size } = await fh.stat();
      const inicio = Math.max(0, size - FIM_DO_ARQUIVO);
      const buf = Buffer.alloc(size - inicio);
      await fh.read(buf, 0, buf.length, inicio);
      raw = buf.toString('utf8');
    } finally {
      await fh.close();
    }
  } catch {
    return [];
  }
  const passos: string[] = [];
  for (const line of raw.split('\n')) {
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.isSidechain) continue;
    const h = hora(e.timestamp);
    const content = e.message?.content;
    if (e.type === 'user' && typeof content === 'string') passos.push(`[${h}] recebeu: ${curto(content, 200)}`);
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const b of content) {
        if (b.type === 'text' && b.text?.trim()) passos.push(`[${h}] disse: ${curto(b.text, 240)}`);
        if (b.type === 'tool_use') passos.push(`[${h}] usou ${descreverFerramenta(b.name, b.input)}`);
      }
    }
  }
  return passos.slice(-n);
}

const ESTADO: Record<string, string> = { working: 'trabalhando', permission: 'ESPERANDO PERMISSÃO do usuário', idle: 'parada (terminou a vez dela)' };

function estadoDe(s: WorldSession): string {
  if (!s.live) return 'encerrada (processo fechado)';
  return ESTADO[s.status ?? 'working'] ?? 'trabalhando';
}

/** O estado da rodada agora, montado pela vila: quem é quem, em que pé está, onde ler mais. */
export async function preambuloDaRodada(project: Project, sessions: WorldSession[], rodadasDir = RODADAS_DIR): Promise<string> {
  const doPorao = sessions.filter((s) => s.projectId === project.id && s.porao);
  const maestros = doPorao.filter((s) => s.porao?.papel === 'maestro');
  const tarefas = doPorao.filter((s) => s.porao?.papel === 'tarefa');
  const rodadas = [...new Set(tarefas.map((s) => (s.porao?.papel === 'tarefa' ? s.porao.rodada : '')).filter(Boolean))];
  const bloco = async (s: WorldSession, rotulo: string) => {
    const passos = s.file ? await ultimosPassos(s.file) : [];
    return [
      `### ${rotulo} — ${s.name} (${estadoDe(s)})`,
      `Conversa: ${s.file ?? '(ainda sem arquivo)'}`,
      ...(passos.length ? ['Últimos passos:', ...passos.map((p) => `- ${p}`)] : ['Últimos passos: nenhum ainda.']),
    ].join('\n');
  };
  const agora = new Date();
  const partes = [
    `Agora: ${agora.toLocaleDateString('pt-BR')} ${hora(agora.toISOString())}.`,
    `Projeto: ${project.name} — ${project.path}`,
    rodadas.length
      ? `Rodada(s): ${rodadas.map((r) => `${r} (briefings em ${path.join(rodadasDir, r, 'briefings')})`).join('; ')}`
      : 'Nenhuma sessão de tarefa no porão agora.',
    `Relatórios das rodadas: ${path.join(project.path, 'docs-dev', 'maestro')}`,
  ];
  for (const m of maestros) partes.push(await bloco(m, '✦ Maestro'));
  for (const t of tarefas) partes.push(await bloco(t, `Tarefa ${t.porao?.papel === 'tarefa' ? t.porao.tarefa : '?'}`));
  return partes.join('\n\n');
}

function stepFor(tool: string, input: any): string {
  const where = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');
  if (tool === 'Read') return `📖 Lendo ${where(input?.file_path)}`;
  if (tool === 'Grep') return `🔎 Procurando "${String(input?.pattern ?? '').slice(0, 40)}"`;
  if (tool === 'Glob') return `🗂️ Olhando ${String(input?.pattern ?? '').slice(0, 40)}`;
  if (tool === 'Bash') return `🔧 ${String(input?.command ?? '').slice(0, 60)}`;
  return `🔧 ${tool}`;
}

/** Só leitura do git, na pasta do projeto (a consulta roda na home: o caminho vai no `-C`). */
export function regrasDoMirim(projectPath: string): string[] {
  return ['status', 'diff', 'log', 'show'].map((c) => `Bash(git -C ${projectPath} ${c}:*)`);
}

export async function askMirim(
  question: string,
  history: Exchange[],
  project: Project,
  sessions: WorldSession[],
  onEvent: (e: AgentEvent) => void,
  hooksToIgnore: Set<string>,
): Promise<() => void> {
  const preamble = await preambuloDaRodada(project, sessions);
  return askAgent(
    { name: 'maestro-mirim', who: 'O maestro mirim', preamble, allow: regrasDoMirim(project.path), estrito: true, stepFor, replacements: { '{{PROJETO}}': project.path } },
    question,
    history,
    onEvent,
    hooksToIgnore,
  );
}
