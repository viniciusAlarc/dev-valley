import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { askAdministrador } from './administrador.js';
import { agentInput, Agents } from './agents.js';
import type { sugerirMensagem } from './escrevente.js';
import * as gitOps from './git.js';
import type { HookStore } from './hooks.js';
import type { Lareiras } from './lareira.js';
import type { askLibrarian } from './librarian.js';
import type { Library } from './library.js';
import type { Moradores } from './moradores.js';
import { buscar, cartas, PombalError, voar } from './pombal.js';
import { markChecked, readProgress } from './progress.js';
import { arquivoPermitido, isLocalOrigin } from './seguranca.js';
import { skillInput, type Skills } from './skills.js';
import type { StatusLineStore } from './statusline.js';
import type { TerminalManager } from './terminals.js';
import type { Project, World } from './world.js';

/**
 * O que as rotas usam da vila (PD-8, passo 2). O `index.ts` passa os de verdade; os testes passam imitações. Tudo que
 * age fora da pasta do projeto (`~/.claude`, consulta ao Claude, VS Code, apagar conversa) chega por aqui, para o teste
 * nunca tocar no que é real.
 */
export interface Contexto {
  world: () => World;
  refreshWorld: () => Promise<void>;
  terminals: Pick<TerminalManager, 'kill'>;
  lareiras: Pick<Lareiras, 'acender' | 'apagar'>;
  hooks: Pick<HookStore, 'handle' | 'forget'>;
  library: Pick<Library, 'sections' | 'read' | 'htmlPath' | 'write' | 'createClaudeMd' | 'search'>;
  statusLine: Pick<StatusLineStore, 'handle'>;
  moradores: Pick<Moradores, 'claim'>;
  agents: Pick<Agents, 'read' | 'create' | 'save' | 'remove'>;
  skills: Pick<Skills, 'read' | 'create' | 'save' | 'remove'>;
  /** Sessões que a própria vila abre por baixo (consultas à bibliotecária e ao administrador) — não viram moradores. */
  internalSessions: Set<string>;
  /** Sessões novas de conversa com um agente, esperando o terminal abrir: id → pasta e agente (o front não escolhe). */
  agentSessions: Map<string, { cwd: string; agent: string }>;
  /** Sessões avulsas novas (banco da praça), esperando o terminal abrir: nascem na home, fora de qualquer projeto. */
  avulsaSessions: Set<string>;
  askLibrarian: typeof askLibrarian;
  askAdministrador: typeof askAdministrador;
  sugerirMensagem: typeof sugerirMensagem;
  /** Apaga os arquivos da conversa (`deleteSessionFiles`). */
  apagarConversa: (id: string) => Promise<void>;
  abrirVscode: (args: string[]) => void;
  /** Front já buildado que o próprio servidor entrega; null = não entrega. */
  webDist: string | null;
}

/** Garante que `file` é um caminho relativo dentro do projeto. */
function safeRelative(project: Project, file: unknown): string | null {
  if (typeof file !== 'string' || !file) return null;
  const resolved = path.resolve(project.path, file);
  return resolved.startsWith(project.path + path.sep) ? path.relative(project.path, resolved) : null;
}

// HTML de um repositório (quadro negro e estante da casa), só os arquivos listados no mundo. Ele tem script:
// `sandbox` sem `allow-same-origin` o deixa numa origem opaca, sem acesso à API nem aos terminais da vila, mesmo
// aberto numa aba própria.
function sendIsolatedHtml(res: express.Response, doc: { path: string; kind: string } | undefined) {
  if (!doc || doc.kind !== 'html') return res.status(404).json({ error: 'documento não encontrado' });
  res.set({ 'Content-Security-Policy': 'sandbox allow-scripts', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.type('html').sendFile(doc.path);
}

export function criarApp(ctx: Contexto): express.Express {
  const { terminals, lareiras, hooks, library, statusLine, moradores, agents, skills, internalSessions, agentSessions, avulsaSessions } = ctx;
  const refreshWorld = ctx.refreshWorld;
  const findProject = (id: unknown): Project | undefined => ctx.world().projects.find((p) => p.id === id);
  let lastStatusLine: unknown = null;

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/world', (_req, res) => {
    res.json(ctx.world());
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
    const cancel = ctx.askLibrarian(
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
    const cancel = ctx.askAdministrador(
      question,
      history,
      ctx.world().projects,
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

  // Sino da praça: marca entregas como conferidas pelas caixinhas (pedido do usuário, 29/10/2026). Escreve em arquivo de
  // projeto: só pedido de página local, e só entrega que o sino lista (o `markChecked` confere de novo no arquivo).
  app.post('/api/progress/conferir', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const project = findProject(req.body?.project);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const listed = project?.progress?.toCheck ?? [];
    const chosen = listed.filter((e) => items.some((i: { date?: unknown; title?: unknown }) => i?.date === e.date && i?.title === e.title));
    if (!project || !chosen.length) return res.status(400).json({ error: 'projeto ou entrega inválida' });
    try {
      res.json({ marcadas: await markChecked(project.path, chosen) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    } finally {
      await refreshWorld();
    }
  });

  app.get('/api/quadro', (req, res) => sendIsolatedHtml(res, findProject(req.query.project)?.quadro[Number(req.query.i)]));
  app.get('/api/estante', (req, res) => sendIsolatedHtml(res, findProject(req.query.project)?.estante?.[Number(req.query.i)]));

  // Link clicável para arquivo no terminal da vila: o terminal roda no navegador, que só abre link http(s), nunca file://
  // (pedido do usuário, 29/10/2026). O que `arquivoPermitido` recusa responde 404, igual a arquivo inexistente.
  // HTML abre isolado, como os da estante.
  app.get('/api/arquivo', (req, res) => {
    const pedido = typeof req.query.path === 'string' ? req.query.path : '';
    const naoEncontrado = () => res.status(404).json({ error: 'arquivo não encontrado' });
    const real = arquivoPermitido(pedido, ctx.world().projects.map((p) => p.path));
    if (!real) return naoEncontrado();

    const ext = path.extname(real).toLowerCase();
    if (ext === '.html' || ext === '.htm') return sendIsolatedHtml(res, { path: real, kind: 'html' });
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    // Texto abre na aba, em vez de virar download (o navegador baixa text/markdown).
    if (['.md', '.txt', '.log', '.csv', '.json', '.yml', '.yaml', '.sql'].includes(ext)) res.type('text/plain; charset=utf-8');
    res.sendFile(real, (err) => {
      if (err && !res.headersSent) naoEncontrado();
    });
  });

  // "Sugerir texto" na tela de enviar: o escrevente lê o diff dos arquivos escolhidos (vazio = todos) e devolve a
  // mensagem de commit. Gasta uma consulta ao Claude: só pedido de página local.
  app.post('/api/pombal/sugerir', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const project = findProject(req.body?.project);
    if (!project?.pombal) return res.status(400).json({ error: 'projeto sem pombal' });
    const arquivos: string[] = [];
    for (const f of req.body.arquivos ?? []) {
      const rel = safeRelative(project, f);
      if (!rel) return res.status(400).json({ error: `arquivo inválido: ${f}` });
      arquivos.push(rel);
    }
    try {
      res.json({ texto: await ctx.sugerirMensagem(project.path, arquivos, internalSessions) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Abrir o pombal busca o remoto na hora e lista as cartas dos dois sentidos.
  app.get('/api/pombal', async (req, res) => {
    const project = findProject(req.query.project);
    if (!project?.pombal) return res.status(400).json({ error: 'projeto sem pombal' });
    await buscar(project.path);
    await refreshWorld();
    res.json(await cartas(project.path));
  });

  // Viagem do pombo: `receber` (manhã) ou `enviar` (fim do dia). Faz push numa branch que outra pessoa usa (regra 9):
  // só pedido de página local, como a lareira, e só por clique confirmado no painel.
  app.post('/api/pombal', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const project = findProject(req.body?.project);
    const acao = req.body?.acao;
    if (!project?.pombal || (acao !== 'receber' && acao !== 'enviar')) return res.status(400).json({ error: 'projeto ou ação inválida' });
    // Arquivos escolhidos para ir (vazio = todos); só caminhos dentro do projeto.
    const arquivos: string[] = [];
    for (const f of req.body.arquivos ?? []) {
      const rel = safeRelative(project, f);
      if (!rel) return res.status(400).json({ error: `arquivo inválido: ${f}` });
      arquivos.push(rel);
    }
    try {
      res.json({ passos: await voar(project.path, acao, { mensagem: String(req.body.mensagem ?? ''), arquivos }) });
    } catch (err) {
      const e = err as PombalError;
      res.status(409).json({ error: e.message, conflitos: e.conflitos ?? [], passos: e.passos ?? [] });
    } finally {
      await refreshWorld();
    }
  });

  // Lareira (PD-7): liga e apaga os lados da tabela "Subir". Roda comando de verdade: só pedido de página local
  // (mesma checagem do WebSocket, regra 2), e só o que está na tabela lida pelo servidor (o front manda só o projeto).
  app.post('/api/lareira/acender', (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const project = findProject(req.body?.project);
    if (!project?.lareira) return res.status(404).json({ error: 'projeto sem lareira' });
    res.json({ ligados: lareiras.acender(project.id, project.lareira) });
  });

  app.post('/api/lareira/apagar', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const project = findProject(req.body?.project);
    if (!project?.lareira) return res.status(404).json({ error: 'projeto sem lareira' });
    await lareiras.apagar(project.id);
    res.json({ ok: true });
  });

  app.get('/api/diff', async (req, res) => {
    const project = findProject(req.query.project);
    const file = project && safeRelative(project, req.query.file);
    if (!project || !file) return res.status(400).json({ error: 'projeto ou arquivo inválido' });
    res.json(await gitOps.fileDiff(project.path, file));
  });

  app.post('/api/open-vscode', (req, res) => {
    const project = findProject(req.body.project);
    if (!project) return res.status(400).json({ error: 'projeto inválido' });
    const args = [project.path];
    const file = req.body.file && safeRelative(project, req.body.file);
    if (file) args.push('--goto', path.join(project.path, file));
    ctx.abrirVscode(args);
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

  // HTML da biblioteca, só o que a varredura listou: abre isolado como os da estante (o script não alcança a vila).
  app.get('/api/library/html', async (req, res) => {
    const file = await library.htmlPath(req.query.path);
    sendIsolatedHtml(res, file ? { path: file, kind: 'html' } : undefined);
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
    ctx.abrirVscode(['--goto', file.path]);
    res.json({ ok: true });
  });

  app.get('/api/library/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    res.json(await library.search(q, 100, typeof req.query.section === 'string' ? req.query.section : undefined));
  });

  app.post('/api/sessions', (req, res) => {
    // Sem projeto: sessão avulsa do banco da praça, sempre na home (decisão do usuário, 27/10/2026).
    if (req.body.project == null) {
      const sessionId = randomUUID();
      avulsaSessions.add(sessionId);
      return res.json({ sessionId, cwd: os.homedir() });
    }
    const project = findProject(req.body.project);
    if (!project) return res.status(400).json({ error: 'projeto inválido' });
    res.json({ sessionId: randomUUID(), cwd: project.path });
  });

  // Encerrar na vila apaga a conversa de vez (decisão do usuário, 26/10/2026): processo, arquivos e estado ao vivo.
  app.delete('/api/sessions/:id', async (req, res) => {
    const id = req.params.id;
    const session = ctx.world().sessions.find((s) => s.id === id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });
    // Apagar por baixo de um processo vivo fora da vila (VS Code) deixaria aquele terminal gravando numa conversa sumida.
    if (session.live && !session.inTown) {
      return res.status(409).json({ error: 'A sessão está aberta em outro terminal. Feche por lá primeiro.' });
    }
    try {
      await terminals.kill(id);
      await ctx.apagarConversa(id);
    } catch (err) {
      return res.status(500).json({ error: String((err as Error).message ?? err) });
    }
    hooks.forget(id);
    await refreshWorld();
    res.json({ ok: true });
  });

  // Em produção o próprio servidor entrega o front já buildado.
  if (ctx.webDist) {
    const webDist = ctx.webDist;
    app.use(express.static(webDist));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  return app;
}
