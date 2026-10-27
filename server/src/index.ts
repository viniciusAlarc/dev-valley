import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadConfig, ROOT_DIR } from './config.js';
import * as gitOps from './git.js';
import { HookStore } from './hooks.js';
import { Library } from './library.js';
import { askAdministrador } from './administrador.js';
import { askLibrarian } from './librarian.js';
import { agentInput, Agents } from './agents.js';
import { skillInput, Skills } from './skills.js';
import { Moradores } from './moradores.js';
import { readProgress } from './progress.js';
import { StatusLineStore } from './statusline.js';
import { TerminalManager } from './terminals.js';
import { buildWorld, type Project, type World } from './world.js';

const config = loadConfig();
const HOST = '127.0.0.1';
const POLL_MS = 3000;

let world: World = { projects: [], sessions: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null };
let worldJson = '';
const eventClients = new Set<WebSocket>();

const terminals = new TerminalManager(() => void refreshWorld());
const hooks = new HookStore();
const library = new Library(config, () => world.projects);
const statusLine = new StatusLineStore();
/** Sessões que a própria vila abre por baixo (consultas à bibliotecária e ao administrador) — não viram moradores. */
const internalSessions = new Set<string>();
const moradores = new Moradores();
const agents = new Agents(() => world.projects);
const skills = new Skills(() => world.projects);
/** Sessões novas de conversa com um agente, esperando o terminal abrir: id → pasta e agente (o front não escolhe). */
const agentSessions = new Map<string, { cwd: string; agent: string }>();
let lastStatusLine: unknown = null;

async function refreshWorld() {
  try {
    world = await buildWorld(config, terminals.live(), hooks.all(), statusLine, moradores, agents, skills);
    const json = JSON.stringify(world);
    if (json === worldJson) return;
    worldJson = json;
    for (const c of eventClients) c.send(json);
  } catch (err) {
    console.error('[world] falha ao atualizar:', err);
  }
}

function findProject(id: unknown): Project | undefined {
  return world.projects.find((p) => p.id === id);
}

/** Garante que `file` é um caminho relativo dentro do projeto. */
function safeRelative(project: Project, file: unknown): string | null {
  if (typeof file !== 'string' || !file) return null;
  const resolved = path.resolve(project.path, file);
  return resolved.startsWith(project.path + path.sep) ? path.relative(project.path, resolved) : null;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/world', (_req, res) => {
  res.json(world);
});

// Chamado pelos hooks do Claude Code (curl local) a cada evento de sessão.
app.post('/api/hooks', (req, res) => {
  if (!internalSessions.has(req.body?.session_id) && hooks.handle(req.body ?? {})) void refreshWorld();
  res.json({});
});

// SessionStart do mod (mod/hooks/register.ts): a sessão que acabou de abrir pergunta o próprio nome de morador.
// Recebe só o session_id (regra 3); consultas internas da bibliotecária não viram moradores.
app.post('/api/moradores/nome', async (req, res) => {
  const id = req.body?.session_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'sessão inválida' });
  res.json({ name: internalSessions.has(id) ? null : await moradores.claim(id) });
});

// ---- Fábrica de agentes (PD-4): só nas pastas de agentes (global e dos projetos) ----

app.get('/api/agents/file', async (req, res) => {
  const agent = await agents.read(req.query.path);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado.' });
  res.json(agent);
});

app.post('/api/agents', async (req, res) => {
  const input = agentInput(req.body);
  if (!input) return res.status(400).json({ error: 'Preencha a descrição.' });
  const result = await agents.create(req.body.projectId ?? null, req.body.name, input);
  if ('error' in result) return res.status(400).json(result);
  void refreshWorld();
  res.json(result);
});

app.put('/api/agents', async (req, res) => {
  const input = agentInput(req.body);
  if (!input) return res.status(400).json({ error: 'Preencha a descrição.' });
  const result = await agents.save(req.body.path, req.body.mtime, input);
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  void refreshWorld();
  res.json(result);
});

// Clique no NPC ✦: conversa nova com o agente. Agente de projeto roda no projeto; global, na praça (pasta pessoal,
// fora de qualquer projeto). Decisão do usuário, 26/10/2026.
app.post('/api/agents/session', async (req, res) => {
  const agent = await agents.read(req.body?.path);
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado.' });
  // Agente da vila só roda pela vila, com as permissões dela (regra 5): nunca por `claude --agent`.
  if (agent.village) return res.status(403).json({ error: 'Agente da vila: converse com ele no lugar dele (biblioteca ou praça).' });
  const project = agent.projectId ? findProject(agent.projectId) : undefined;
  const sessionId = randomUUID();
  agentSessions.set(sessionId, { cwd: project?.path ?? os.homedir(), agent: Agents.cliName(agent) });
  res.json({ sessionId, projectId: project?.id ?? null, name: agent.name });
});

app.delete('/api/agents', async (req, res) => {
  const result = await agents.remove(req.query.path);
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  void refreshWorld();
  res.json(result);
});

// ---- Skills na Fábrica (parede de ferramentas): só nas pastas de skills (global e dos projetos) ----

app.get('/api/skills/file', async (req, res) => {
  const skill = await skills.read(req.query.path);
  if (!skill) return res.status(404).json({ error: 'Skill não encontrada.' });
  res.json(skill);
});

app.post('/api/skills', async (req, res) => {
  const input = skillInput(req.body);
  if (!input) return res.status(400).json({ error: 'Preencha a descrição.' });
  const result = await skills.create(req.body.projectId ?? null, req.body.name, input);
  if ('error' in result) return res.status(400).json(result);
  void refreshWorld();
  res.json(result);
});

app.put('/api/skills', async (req, res) => {
  const input = skillInput(req.body);
  if (!input) return res.status(400).json({ error: 'Preencha a descrição.' });
  const result = await skills.save(req.body.path, req.body.mtime, input);
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  void refreshWorld();
  res.json(result);
});

app.delete('/api/skills', async (req, res) => {
  const result = await skills.remove(req.query.path);
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  void refreshWorld();
  res.json(result);
});

// Pergunta à bibliotecária; responde em NDJSON conforme ela trabalha (passos e resposta final).
app.post('/api/librarian/ask', (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'pergunta vazia' });
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  res.setHeader('Content-Type', 'application/x-ndjson');
  const cancel = askLibrarian(
    question,
    history,
    (event) => {
      res.write(JSON.stringify(event) + '\n');
      if (event.type !== 'step') res.end();
    },
    internalSessions,
  );
  res.on('close', () => {
    if (!res.writableEnded) cancel();
  });
});

// Pergunta ao administrador da praça (sino e quadro de avisos); ele pode registrar conferências nos arquivos de
// acompanhamento dos projetos. Mesmo formato NDJSON da bibliotecária.
app.post('/api/administrador/ask', (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'pergunta vazia' });
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  res.setHeader('Content-Type', 'application/x-ndjson');
  const cancel = askAdministrador(
    question,
    history,
    world.projects,
    (event) => {
      res.write(JSON.stringify(event) + '\n');
      if (event.type !== 'step') {
        res.end();
        void refreshWorld();
      }
    },
    internalSessions,
  );
  res.on('close', () => {
    if (!res.writableEnded) cancel();
  });
});

// Diário da casa: as entregas do PROGRESS.md, só leitura.
app.get('/api/progress', async (req, res) => {
  const project = findProject(req.query.project);
  if (!project) return res.status(400).json({ error: 'projeto inválido' });
  res.json((await readProgress(project.path)) ?? []);
});

app.get('/api/diff', async (req, res) => {
  const project = findProject(req.query.project);
  const file = project && safeRelative(project, req.query.file);
  if (!project || !file) return res.status(400).json({ error: 'projeto ou arquivo inválido' });
  res.json(await gitOps.fileDiff(project.path, file));
});

app.post('/api/commit', async (req, res) => {
  const project = findProject(req.body.project);
  const message = String(req.body.message ?? '').trim();
  if (!project?.isGit) return res.status(400).json({ error: 'projeto inválido' });
  if (!message) return res.status(400).json({ error: 'mensagem de commit vazia' });
  const files: string[] = [];
  for (const f of req.body.files ?? []) {
    const rel = safeRelative(project, f);
    if (!rel) return res.status(400).json({ error: `arquivo inválido: ${f}` });
    files.push(rel);
  }
  try {
    const output = await gitOps.commit(project.path, message, files);
    await refreshWorld();
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/open-vscode', (req, res) => {
  const project = findProject(req.body.project);
  if (!project) return res.status(400).json({ error: 'projeto inválido' });
  const args = [project.path];
  const file = req.body.file && safeRelative(project, req.body.file);
  if (file) args.push('--goto', path.join(project.path, file));
  spawn('code', args, { detached: true, stdio: 'ignore' }).unref();
  res.json({ ok: true });
});

// Chamado pelo status line do Claude Code: contexto da sessão e limites do plano.
app.post('/api/statusline', (req, res) => {
  lastStatusLine = req.body;
  if (statusLine.handle(req.body ?? {})) void refreshWorld();
  res.json({});
});

app.get('/api/statusline/last', (_req, res) => {
  res.json(lastStatusLine);
});

// ---- Biblioteca ----

app.get('/api/library', async (_req, res) => {
  res.json(await library.sections());
});

app.get('/api/library/file', async (req, res) => {
  const file = await library.read(req.query.path);
  if (!file) return res.status(404).json({ error: 'arquivo fora da biblioteca' });
  res.json(file);
});

app.put('/api/library/file', async (req, res) => {
  const result = await library.write(req.body.path, req.body.content, req.body.mtime);
  if (!result) return res.status(404).json({ error: 'arquivo fora da biblioteca' });
  if ('conflict' in result) return res.status(409).json({ error: 'O arquivo mudou no disco desde que foi aberto. Recarregue antes de salvar.' });
  res.json(result);
});

app.post('/api/library/claude-md', async (req, res) => {
  const project = findProject(req.body.project);
  if (!project) return res.status(400).json({ error: 'projeto inválido' });
  const file = await library.createClaudeMd(project);
  if (!file) return res.status(409).json({ error: 'o projeto já tem CLAUDE.md' });
  res.json({ path: file });
});

app.post('/api/library/open-vscode', async (req, res) => {
  const file = await library.read(req.body.path);
  if (!file) return res.status(404).json({ error: 'arquivo fora da biblioteca' });
  spawn('code', ['--goto', file.path], { detached: true, stdio: 'ignore' }).unref();
  res.json({ ok: true });
});

app.get('/api/library/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  res.json(await library.search(q));
});

app.post('/api/sessions', (req, res) => {
  const project = findProject(req.body.project);
  if (!project) return res.status(400).json({ error: 'projeto inválido' });
  res.json({ sessionId: randomUUID(), cwd: project.path });
});

app.delete('/api/sessions/:id', (req, res) => {
  terminals.kill(req.params.id);
  res.json({ ok: true });
});

// Em produção o próprio servidor entrega o front já buildado.
const webDist = path.join(ROOT_DIR, 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

server.on('upgrade', (req, socket, head) => {
  // Os terminais rodam comandos de verdade: só aceitamos páginas servidas localmente.
  if (!isLocalOrigin(req.headers.origin)) {
    socket.destroy();
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (url.pathname === '/ws/events') {
      eventClients.add(ws);
      ws.on('close', () => eventClients.delete(ws));
      if (worldJson) ws.send(worldJson);
      return;
    }
    if (url.pathname === '/ws/terminal') {
      const sessionId = url.searchParams.get('session') ?? '';
      const known = world.sessions.find((s) => s.id === sessionId);
      const project = findProject(url.searchParams.get('project'));
      const forAgent = known ? undefined : agentSessions.get(sessionId);
      agentSessions.delete(sessionId);
      const cwd = known?.cwd ?? forAgent?.cwd ?? project?.path;
      if (!/^[0-9a-f-]{36}$/.test(sessionId) || !cwd) {
        ws.close(1008, 'sessão inválida');
        return;
      }
      terminals.attach(ws, {
        sessionId,
        cwd,
        mode: known ? 'resume' : 'new',
        agent: forAgent?.agent,
        cols: Number(url.searchParams.get('cols')) || 120,
        rows: Number(url.searchParams.get('rows')) || 32,
      });
      return;
    }
    ws.close(1008, 'rota desconhecida');
  });
});

await refreshWorld();
setInterval(refreshWorld, POLL_MS);
// Mantém o catálogo da bibliotecária em dia mesmo sem ninguém abrir a biblioteca.
void library.sections();
setInterval(() => void library.sections(), 60_000);

server.listen(config.port, HOST, () => {
  console.log(`🌾 Dev Valley rodando em http://localhost:${config.port}`);
  console.log(`   ${world.projects.length} projetos, ${world.sessions.length} sessões`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    terminals.killAll();
    process.exit(0);
  });
}
