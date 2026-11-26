import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { askAdministrador } from './administrador.js';
import type { askMirim } from './mirim.js';
import type { askMedica, Clinica } from './clinica.js';
import { agentInput, Agents } from './agents.js';
import { CONTA_CLAUDE } from './config.js';
import type { sugerirMensagem } from './escrevente.js';
import * as gitOps from './git.js';
import type { HookStore } from './hooks.js';
import type { Lareiras } from './lareira.js';
import type { askLibrarian } from './librarian.js';
import type { Library } from './library.js';
import { TITULO_MAX, type Moradores } from './moradores.js';
import { buscar, cartas, PombalError, voar } from './pombal.js';
import { markChecked, readProgressComArquivo } from './progress.js';
import { arquivoPermitido, isLocalOrigin } from './seguranca.js';
import type { Bastao } from './bastao.js';
import type { Gasto } from './gasto.js';
import type { askJornaleiro, Jornal } from './jornal.js';
import type { Plugins } from './plugins.js';
import { MAESTRO, type PedidoPorao, type Porao } from './porao.js';
import type { RelatoriosLidos } from './relatorios.js';
import { skillInput, type Skills } from './skills.js';
import type { StatusLineStore } from './statusline.js';
import type { TerminalManager } from './terminals.js';
import type { Project, World, WorldSession } from './world.js';
import type { Conta } from './perfil.js';
import type { Quarto } from './quarto.js';
import { NOTA_MAX, type Notas } from './notas.js';

/**
 * O que as rotas usam da vila (PD-8, passo 2). O `index.ts` passa os de verdade; os testes passam imitações. Tudo que
 * age fora da pasta do projeto (`~/.claude`, consulta ao Claude, VS Code, apagar conversa) chega por aqui, para o teste
 * nunca tocar no que é real.
 */
export interface Contexto {
  world: () => World;
  refreshWorld: () => Promise<void>;
  terminals: Pick<TerminalManager, 'kill'>;
  /** Passagem de bastão (BT-1, 08/11/2026): o pedido do resumo; o sucessor é aberto pelo `index.ts`. */
  bastao: Pick<Bastao, 'pedir' | 'pendente' | 'arquivoDe'>;
  /** Os terminais da vila, para o bastão achar a pasta da sessão e digitar o pedido nela. */
  terminaisDoBastao: Pick<TerminalManager, 'live' | 'escrever'>;
  lareiras: Pick<Lareiras, 'acender' | 'apagar'>;
  hooks: Pick<HookStore, 'handle' | 'forget'>;
  library: Pick<Library, 'sections' | 'read' | 'htmlPath' | 'write' | 'createClaudeMd' | 'search'>;
  statusLine: Pick<StatusLineStore, 'handle' | 'ritmo'>;
  moradores: Pick<Moradores, 'claim' | 'renomear'>;
  /** Quarto da casa (21/11/2026): quem a escrivaninha mandou dormir. */
  quarto: Pick<Quarto, 'dormir'>;
  /** Quadro de avisos da praça (21/11/2026): notas soltas do usuário. */
  notas: Pick<Notas, 'list' | 'criar' | 'excluir'>;
  agents: Pick<Agents, 'read' | 'create' | 'save' | 'remove'>;
  skills: Pick<Skills, 'read' | 'create' | 'save' | 'remove'>;
  /** Plugins e MCP de cada conta, só leitura (Fábrica, 02/11/2026; por conta em 19/11/2026). */
  plugins: Pick<Plugins, 'list'>;
  /** Gasto por projeto na semana do plano (moinho, 02/11/2026). */
  gasto: Pick<Gasto, 'resumo'>;
  /** Banca de jornal: a edição do dia, imprimir e marcar como lido (02/11/2026). */
  jornal: Pick<Jornal, 'view' | 'imprimir' | 'marcarLido' | 'imprimirExtra' | 'pautaDaConversa'>;
  askJornaleiro: typeof askJornaleiro;
  /** Sessões que a própria vila abre por baixo (consultas à bibliotecária e ao administrador) — não viram moradores. */
  internalSessions: Set<string>;
  /** Sessões novas de conversa com um agente, esperando o terminal abrir: id → pasta e agente (o front não escolhe). */
  agentSessions: Map<string, { cwd: string; agent: string }>;
  /** Sessões avulsas novas (banco da praça), esperando o terminal abrir: nascem na home, fora de qualquer projeto. */
  avulsaSessions: Set<string>;
  /** Porão da casa (MA-1): registro das sessões de maestro e se o agente está instalado. */
  porao: Pick<Porao, 'registrarMaestro' | 'maestroInstalado' | 'pedir' | 'pedirRoteiro' | 'pedido' | 'aprovar' | 'recusar' | 'esquecer' | 'chamar' | 'atender'>;
  /** Relatórios do maestro já abertos (estante de partitura do porão, 04/11/2026). */
  relatoriosLidos: Pick<RelatoriosLidos, 'marcar'>;
  /** Contas do config local (Claude primeiro): a rota de sessão nova valida a escolha da casa. */
  contas: Conta[];
  /** Sessões novas que pediram uma conta: id → nome (vale até a conversa ser gravada). */
  escolhasDeConta: Map<string, string>;
  /** Conta exata de uma sessão (pelo arquivo da conversa ou pela escolha da abertura), como o terminal abre. */
  contaDaSessao: (s: WorldSession) => Conta;
  /** Sessões de trabalho por rodada (`porao.tetoSessoes` do config, até 5). */
  tetoSessoes: number;
  /**
   * Abre a sessão de trabalho sem tela, com a frase do briefing, as regras `--allowedTools` da tarefa (vazio = sessão
   * comum) e o `--settings` com os hooks dela (maestro v2); devolve o motivo quando não abre.
   */
  abrirTarefa: (o: { sessionId: string; cwd: string; prompt: string; permitir: string[]; settings?: string }) => Promise<string | null>;
  /** O que as sessões de trabalho leem fora do projeto sem pedir (`porao.leitura` do config). */
  leituraPorao: string[];
  askLibrarian: typeof askLibrarian;
  askAdministrador: typeof askAdministrador;
  askMirim: typeof askMirim;
  /** Crítica do cartão (21/11/2026, `critico.ts`): roda em segundo plano depois do pedido; só avisa no cartão. */
  criticaDoCartao: { iniciar: (pedido: PedidoPorao) => void; anotarDecisao: (pedido: PedidoPorao) => Promise<void> };
  /** Clínica (09/11/2026): triagem dos moradores vivos, sinais vitais e a ficha que a médica recebe. */
  clinica: Pick<Clinica, 'triagem' | 'ficha' | 'armario' | 'vitais'>;
  askMedica: typeof askMedica;
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
  const { terminals, lareiras, hooks, library, statusLine, moradores, agents, skills, plugins, gasto, jornal, internalSessions, agentSessions, avulsaSessions, porao, contas, escolhasDeConta } = ctx;
  const refreshWorld = ctx.refreshWorld;
  const findProject = (id: unknown): Project | undefined => ctx.world().projects.find((p) => p.id === id);
  let lastStatusLine: unknown = null;

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/world', (_req, res) => {
    res.json(ctx.world());
  });

  // Chamado pelos hooks do Claude Code (curl local) a cada evento de sessão.
  // Os avisos chegam em rajada (início e fim de cada ferramenta, 08/11/2026): um redesenho só a cada 150 ms. Ferramenta
  // instantânea (uma leitura) nem chega a piscar o ícone no balão.
  let redesenho: ReturnType<typeof setTimeout> | null = null;
  const redesenhar = () => {
    if (redesenho) return;
    redesenho = setTimeout(() => {
      redesenho = null;
      void refreshWorld();
    }, 150);
    redesenho.unref?.();
  };
  app.post('/api/hooks', (req, res) => {
    if (!internalSessions.has(req.body?.session_id) && hooks.handle(req.body ?? {})) redesenhar();
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

  // Clique no maestro ✦ do porão: rodada nova, uma sessão com `--agent maestro` na pasta do projeto. A sessão é anotada
  // no porao.json antes de o terminal abrir, para ela nunca aparecer na casa nem no mapa (MA-1, 03/11/2026).
  app.post('/api/porao/maestro', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const project = findProject(req.body?.projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    if (!(await porao.maestroInstalado())) {
      return res.status(409).json({ error: 'O agente maestro não está instalado: rode ~/Documents/IA/instalar.sh.' });
    }
    const sessionId = randomUUID();
    await porao.registrarMaestro(sessionId, project.id);
    agentSessions.set(sessionId, { cwd: project.path, agent: MAESTRO });
    // O maestro fala sempre no Claude, mesmo na casa pessoal (decisão do usuário, 20/11/2026): quem coordena a rodada
    // precisa do modelo mais forte. Vale a escolha da abertura; ao retomar, a conversa salva em ~/.claude manda.
    escolhasDeConta.set(sessionId, CONTA_CLAUDE.nome);
    res.json({ sessionId, projectId: project.id });
  });

  // Fase 3 do MA-1: o maestro pede sessões (curl local, sem Origin) e o usuário decide no cartão do porão. Aprovar e
  // recusar exigem a página da vila (Origin local presente): o maestro pede, mas nunca se aprova (decisão de 03/11/2026).
  const daPagina = (origin: string | undefined) => !!origin && isLocalOrigin(origin);

  app.post('/api/porao/pedidos', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const maestro = ctx.world().sessions.find((s) => s.id === req.body?.maestro);
    if (!maestro?.live || maestro.porao?.papel !== 'maestro') return res.status(403).json({ error: 'Só o maestro aberto no porão, com a sessão viva, pede sessões.' });
    const casaDoMaestro = findProject(maestro.projectId);
    if (!casaDoMaestro) return res.status(404).json({ error: 'Projeto do maestro não encontrado.' });
    const r = await porao.pedir({ maestro: maestro.id, rodada: req.body?.rodada, tarefas: req.body?.tarefas, estimativaSessaoUnicaMin: req.body?.estimativaSessaoUnicaMin, sprint: req.body?.sprint }, ctx.tetoSessoes, casaDoMaestro.path);
    if ('erro' in r) return res.status(r.status).json({ error: r.erro });
    ctx.criticaDoCartao.iniciar(r);
    await refreshWorld();
    res.status(201).json({ pedidoId: r.id, estado: r.estado, aviso: 'Peça ao usuário para aprovar no cartão da estante de partitura, no porão.' });
  });

  // Fim da rodada que mexeu em tela (05/11/2026): o maestro pede a sessão do roteiro de testes. Mesmas travas do pedido
  // de sessões (maestro vivo, e o clique do usuário no cartão abre); a sessão nasce na casa, com /roteiro-testes.
  app.post('/api/porao/roteiro', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const maestro = ctx.world().sessions.find((s) => s.id === req.body?.maestro);
    if (!maestro?.live || maestro.porao?.papel !== 'maestro') return res.status(403).json({ error: 'Só o maestro aberto no porão, com a sessão viva, pede sessões.' });
    const casaDoMaestro = findProject(maestro.projectId);
    if (!casaDoMaestro) return res.status(404).json({ error: 'Projeto do maestro não encontrado.' });
    const r = await porao.pedirRoteiro({ maestro: maestro.id, rodada: req.body?.rodada, relatorio: req.body?.relatorio }, casaDoMaestro.path);
    if ('erro' in r) return res.status(r.status).json({ error: r.erro });
    await refreshWorld();
    res.status(201).json({ pedidoId: r.id, estado: r.estado, aviso: 'Peça ao usuário para abrir a sessão do roteiro no cartão do porão.' });
  });

  app.get('/api/porao/pedidos/:id', (req, res) => {
    const p = porao.pedido(req.params.id);
    if (!p) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json({ estado: p.estado, rodada: p.rodada, tarefas: p.tarefas, sessoes: p.sessoes, critica: p.critica ?? null });
  });

  app.post('/api/porao/pedidos/:id/aprovar', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila aprova.' });
    const pedido = porao.pedido(req.params.id);
    const project = pedido && findProject(pedido.projectId);
    if (!pedido || !project) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const r = await porao.aprovar(pedido.id, (sessionId, prompt, permitir, settings) => ctx.abrirTarefa({ sessionId, cwd: project.path, prompt, permitir, settings }), ctx.leituraPorao);
    if (!r) return res.status(409).json({ error: 'Este pedido já foi decidido.' });
    await ctx.criticaDoCartao.anotarDecisao(pedido);
    await refreshWorld();
    res.json({ estado: r.estado, sessoes: r.sessoes });
  });

  // Passagem de bastão (BT-1, decisão do usuário de 08/11/2026): só pela página, só sessão comum aberta pela vila e parada
  // (escrever no meio de uma resposta embaralharia o terminal). A vila digita o pedido do resumo no terminal dela; quando o
  // arquivo aparece, o `index.ts` abre o sucessor na mesma pasta.
  app.post('/api/bastao', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila passa o bastão.' });
    const s = ctx.world().sessions.find((x) => x.id === req.body?.sessionId);
    const terminal = s && ctx.terminaisDoBastao.live().find((t) => t.id === s.id);
    if (!s || !terminal || s.porao) return res.status(404).json({ error: 'Sessão não encontrada entre as abertas pela vila.' });
    if (s.status === 'working' || s.status === 'permission') return res.status(409).json({ error: 'Espere ele terminar a resposta para passar o bastão.' });
    if (ctx.bastao.pendente(s.id)) return res.status(409).json({ error: 'O bastão desta sessão já foi pedido: espere o resumo.' });
    // O sucessor herda a conta exata da sessão que passa o bastão (um DeepSeek num repositório de trabalho continua DeepSeek).
    const texto = await ctx.bastao.pedir(s.id, s.name, terminal.cwd, ctx.contaDaSessao(s));
    ctx.terminaisDoBastao.escrever(s.id, texto);
    res.status(202).json({ arquivo: ctx.bastao.arquivoDe(s.id) });
  });

  // Estante de partitura do porão (04/11/2026): abrir um relatório do maestro o tira de "novo". Só pela página, e só relatório
  // listado no mundo daquele projeto; outro caminho responde 404, como inexistente (G9).
  app.post('/api/relatorios/lido', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila marca relatório como lido.' });
    const project = findProject(req.body?.projectId);
    const relatorio = project?.relatorios?.find((r) => r.path === req.body?.path);
    if (!relatorio) return res.status(404).json({ error: 'Relatório não encontrado.' });
    if (!relatorio.lido) {
      await ctx.relatoriosLidos.marcar(relatorio.path);
      await refreshWorld();
    }
    res.json({ ok: true });
  });

  // "Encerrar rodada" (fase 4, decisão do usuário de 03/11/2026): apaga as conversas do porão do projeto (maestro e
  // tarefas), como o "encerrar" de sempre da vila; o registro do que foi feito fica no relatório e nos commits. Só pela
  // página, e nada é apagado se alguma delas estiver aberta em outro terminal.
  app.post('/api/porao/encerrar', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila encerra a rodada.' });
    const project = findProject(req.body?.projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    const doPorao = ctx.world().sessions.filter((s) => s.projectId === project.id && s.porao);
    const fora = doPorao.filter((s) => s.live && !s.inTown);
    if (fora.length) return res.status(409).json({ error: `Aberta(s) em outro terminal: ${fora.map((s) => s.name || s.id).join(', ')}. Feche por lá primeiro.` });
    // Sempre responde (MA-2): erro no meio para de apagar, mas o registro fica coerente com o que já foi apagado e a página
    // recebe o motivo, em vez de o gongo ficar esperando para sempre (Express 4 não captura erro de handler async).
    const apagadas: string[] = [];
    let falha: string | null = null;
    try {
      for (const s of doPorao) {
        await terminals.kill(s.id);
        await ctx.apagarConversa(s.id);
        hooks.forget(s.id);
        apagadas.push(s.id);
      }
    } catch (err) {
      falha = String((err as Error)?.message ?? err);
    }
    try {
      await porao.esquecer(project.id, apagadas);
      await refreshWorld();
    } catch (err) {
      falha ??= String((err as Error)?.message ?? err);
    }
    if (falha) return res.status(500).json({ error: `Parou depois de apagar ${apagadas.length} de ${doPorao.length} conversa(s): ${falha}`, apagadas: apagadas.length });
    res.json({ apagadas: apagadas.length });
  });

  app.post('/api/porao/pedidos/:id/recusar', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila recusa.' });
    const pedido = porao.pedido(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (!porao.recusar(req.params.id)) return res.status(409).json({ error: 'Este pedido já foi decidido.' });
    await ctx.criticaDoCartao.anotarDecisao(pedido);
    await refreshWorld();
    res.json({ estado: 'recusado' });
  });

  // O maestro chama o usuário no meio da rodada (04/11/2026): como o pedido, vem do curl do maestro vivo (sem Origin).
  // Com o chamado, o ❗ aparece no maestro e o clique nele abre a conversa em vez do mirim.
  app.post('/api/porao/chamar', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const maestro = ctx.world().sessions.find((s) => s.id === req.body?.maestro);
    if (!maestro?.live || maestro.porao?.papel !== 'maestro') return res.status(403).json({ error: 'Só o maestro aberto no porão, com a sessão viva, chama o usuário.' });
    if (!(await porao.chamar(maestro.id, req.body?.motivo))) return res.status(403).json({ error: 'Só o maestro aberto no porão chama o usuário.' });
    await refreshWorld();
    res.status(201).json({ ok: true });
  });

  // A página abriu a conversa com o maestro: o chamado foi atendido.
  app.post('/api/porao/chamar/atendido', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila atende o chamado.' });
    if (typeof req.body?.maestro !== 'string') return res.status(400).json({ error: 'maestro inválido' });
    porao.atender(req.body.maestro);
    await refreshWorld();
    res.json({ ok: true });
  });

  // Maestro mirim (04/11/2026): dúvidas do usuário sobre a rodada em andamento, só lendo. Mesmo formato NDJSON da
  // bibliotecária. Só pela página: o mirim lê as conversas das sessões do porão.
  app.post('/api/porao/mirim', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila fala com o mirim.' });
    const project = findProject(req.body?.projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    const question = String(req.body?.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'pergunta vazia' });
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    res.setHeader('Content-Type', 'application/x-ndjson');
    const cancel = await ctx.askMirim(
      question,
      history,
      project,
      ctx.world().sessions,
      (event) => {
        res.write(JSON.stringify(event) + '\n');
        if (event.type !== 'step') res.end();
      },
      internalSessions,
    );
    if (res.writableEnded) return;
    res.on('close', () => {
      if (!res.writableEnded) cancel();
    });
  });

  // ---- Clínica (09/11/2026): a maca de triagem e os sinais da máquina (canto da tela); a médica examina um morador vivo ----
  app.get('/api/clinica', async (_req, res) => {
    res.json(await ctx.clinica.triagem());
  });

  // Sinais da máquina (WSL) para o canto inferior esquerdo, junto dos limites do Claude: leve, sem a amostra de CPU da triagem.
  app.get('/api/clinica/vitais', async (_req, res) => {
    res.json(await ctx.clinica.vitais());
  });

  // Armário (CL-1): processos `claude` e servidores fora da vila e containers de pé. Só aponta; ninguém encerra por aqui.
  app.get('/api/clinica/armario', async (_req, res) => {
    res.json(await ctx.clinica.armario());
  });

  // A médica lê a conversa da sessão: só pela página, como o mirim. NDJSON igual ao da bibliotecária.
  app.post('/api/clinica/medica', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila chama a médica.' });
    const question = String(req.body?.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'pergunta vazia' });
    const ficha = typeof req.body?.sessionId === 'string' ? await ctx.clinica.ficha(req.body.sessionId) : null;
    if (!ficha) return res.status(404).json({ error: 'Esse morador não está vivo agora: não há o que examinar.' });
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    res.setHeader('Content-Type', 'application/x-ndjson');
    const cancel = await ctx.askMedica(
      question,
      history,
      ficha,
      (event) => {
        res.write(JSON.stringify(event) + '\n');
        if (event.type !== 'step') res.end();
      },
      internalSessions,
    );
    if (res.writableEnded) return;
    res.on('close', () => {
      if (!res.writableEnded) cancel();
    });
  });

  app.delete('/api/agents', async (req, res) => {
    const result = await agents.remove(req.query.path);
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    void refreshWorld();
    res.json(result);
  });

  // ---- Banca de jornal: a edição do dia (o jornaleiro roda em segundo plano; a página pergunta de novo) ----
  app.get('/api/jornal', async (_req, res) => {
    res.json(await jornal.view());
  });
  app.post('/api/jornal/imprimir', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    void jornal.imprimir();
    res.status(202).json(await jornal.view());
  });
  app.post('/api/jornal/lido', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    await jornal.marcarLido();
    res.json({ ok: true });
  });

  // Edição extra pedida na conversa com o jornaleiro: outro período (até 30 dias) ou um projeto só. Projeto que não é
  // da vila responde 404, como inexistente (G9).
  app.post('/api/jornal/extra', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const desde = Number(req.body?.desde);
    if (!Number.isFinite(desde)) return res.status(400).json({ error: 'data inválida' });
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    const r = jornal.imprimirExtra({ desde, projectId });
    if (r === 'fora') return res.status(404).json({ error: 'projeto não encontrado' });
    if (r === 'ocupado') return res.status(409).json({ error: 'O jornaleiro está escrevendo outra edição. Tente de novo em instantes.' });
    res.status(202).json(await jornal.view());
  });

  // Conversa com o jornaleiro: mesmo formato NDJSON da bibliotecária e do administrador.
  app.post('/api/jornaleiro/ask', (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const question = String(req.body?.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'pergunta vazia' });
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    res.setHeader('Content-Type', 'application/x-ndjson');
    const cancel = ctx.askJornaleiro(
      question,
      history,
      jornal,
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

  // ---- Moinho: gasto por projeto na semana do plano, só leitura ----
  app.get('/api/gasto', async (_req, res) => {
    res.json({ ...(await gasto.resumo(ctx.world().usage)), limites: statusLine.ritmo() });
  });

  // ---- Plugins e MCP na Fábrica (quadro de força): só leitura ----
  app.get('/api/plugins', async (_req, res) => {
    res.json(await plugins.list());
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

  // Pergunta ao administrador da praça (sino de conferência); ele pode registrar conferências nos arquivos de
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
    res.json((await readProgressComArquivo(project.path)) ?? []);
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
    // A conta escolhida na tela (nome); sem escolha, a casa abre na conta padrão dela (Claude, ou a pessoal pela raiz).
    const pedido = req.body?.conta;
    const conta = pedido == null ? null : contas.find((c) => c.nome === pedido);
    if (pedido != null && !conta) return res.status(400).json({ error: 'conta inválida' });
    // Sem projeto: sessão avulsa do banco da praça, na home (decisão do usuário, 27/10/2026); aceita qualquer conta.
    if (req.body.project == null) {
      const sessionId = randomUUID();
      avulsaSessions.add(sessionId);
      if (conta) escolhasDeConta.set(sessionId, conta.nome);
      return res.json({ sessionId, cwd: os.homedir() });
    }
    const project = findProject(req.body.project);
    if (!project) return res.status(400).json({ error: 'projeto inválido' });
    // A casa oferece só as contas da finalidade dela (a pessoal, também as DeepSeek de trabalho); o resto responde 400.
    if (conta) {
      if (!project.contas.some((c) => c.nome === conta.nome)) {
        return res.status(400).json({ error: `Esta casa abre em: ${project.contas.map((c) => c.nome).join(', ')}.` });
      }
      const sessionId = randomUUID();
      escolhasDeConta.set(sessionId, conta.nome);
      return res.json({ sessionId, cwd: project.path });
    }
    res.json({ sessionId: randomUUID(), cwd: project.path });
  });

  // Renomear a sessão na vila (16/11/2026): só o título, guardado no cadastro da vila; o nome do morador e o arquivo da
  // conversa não mudam (decisão do usuário). Vazio volta ao título automático. Só pela página da vila.
  app.put('/api/sessions/:id/titulo', async (req, res) => {
    if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ error: 'origem recusada' });
    const id = req.params.id;
    if (!ctx.world().sessions.some((s) => s.id === id)) return res.status(404).json({ error: 'Sessão não encontrada.' });
    const titulo = req.body?.titulo;
    if (typeof titulo !== 'string') return res.status(400).json({ error: 'Título inválido.' });
    const limpo = titulo.replace(/\s+/g, ' ').trim();
    if (limpo.length > TITULO_MAX) return res.status(400).json({ error: `Título com mais de ${TITULO_MAX} caracteres.` });
    await moradores.renomear(id, limpo);
    await refreshWorld();
    res.json({ ok: true });
  });

  // Mandar dormir (quarto, 21/11/2026), várias de uma vez pela escrivaninha: encerra o processo (a hibernação) e anota no
  // quarto; a conversa fica. Só sessão de casa, fora do porão e não aberta em outro terminal; o resto volta em
  // `recusadas` com o motivo, sem parar as outras. Trabalhando também dorme: a escrivaninha avisa antes (decisão do
  // usuário). O processo sai antes da anotação: com ele vivo, a sessão ainda apareceria acordada. Encerra processos, então
  // só a página da vila (Origin local presente, como no cartão do porão): o `curl` de uma sessão não põe outra para dormir.
  // Quadro de avisos da praça (21/11/2026): notas soltas, só criar e excluir (decisão do usuário). Gravar e apagar só
  // pela página; ler também pelo curl local, como o resto da vila.
  app.get('/api/notas', async (_req, res) => {
    res.json({ notas: await ctx.notas.list() });
  });

  app.post('/api/notas', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila escreve no quadro.' });
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : null;
    if (!texto) return res.status(400).json({ error: 'Escreva alguma coisa na nota.' });
    if (texto.length > NOTA_MAX) return res.status(400).json({ error: `A nota passa de ${NOTA_MAX} caracteres.` });
    res.json(await ctx.notas.criar(texto));
  });

  app.delete('/api/notas/:id', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila tira nota do quadro.' });
    if (!(await ctx.notas.excluir(req.params.id))) return res.status(404).json({ error: 'Nota não encontrada.' });
    res.json({ ok: true });
  });

  app.post('/api/sessions/dormir', async (req, res) => {
    if (!daPagina(req.headers.origin)) return res.status(403).json({ error: 'Só a página da vila manda dormir.' });
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'Lista de sessões inválida.' });
    }
    const recusadas: { id: string; motivo: string }[] = [];
    const aceitas: string[] = [];
    for (const id of new Set<string>(ids)) {
      const s = ctx.world().sessions.find((x) => x.id === id);
      const motivo = !s
        ? 'Sessão não encontrada.'
        : !s.projectId
          ? 'Só sessão de uma casa dorme no quarto.'
          : s.porao
            ? 'Sessão do porão: encerre pela rodada.'
            : s.live && !s.inTown
              ? 'Aberta em outro terminal: feche por lá primeiro.'
              : null;
      if (motivo) recusadas.push({ id, motivo });
      else aceitas.push(id);
    }
    try {
      for (const id of aceitas) {
        await terminals.kill(id);
        hooks.forget(id);
      }
      if (aceitas.length) await ctx.quarto.dormir(aceitas);
    } catch (err) {
      return res.status(500).json({ error: String((err as Error).message ?? err) });
    }
    await refreshWorld();
    res.json({ dormindo: aceitas.length, recusadas });
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
