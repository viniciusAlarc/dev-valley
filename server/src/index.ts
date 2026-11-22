import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { askAdministrador } from './administrador.js';
import { askMirim } from './mirim.js';
import { criticaDoPorao, perguntarDeVerdade } from './critico.js';
import { askMedica, Clinica } from './clinica.js';
import { Agents } from './agents.js';
import { criarApp } from './app.js';
import { CONTA_CLAUDE, loadConfig, ROOT_DIR } from './config.js';
import { sugerirMensagem } from './escrevente.js';
import { HookStore } from './hooks.js';
import { Lareiras } from './lareira.js';
import { askLibrarian } from './librarian.js';
import { Library } from './library.js';
import { Moradores } from './moradores.js';
import { Quarto } from './quarto.js';
import { buscar } from './pombal.js';
import { isLocalOrigin } from './seguranca.js';
import { ambienteDoTerminal, contaDaSessao, contaPorNome, projectsDirs, type Conta } from './perfil.js';
import { Bastao } from './bastao.js';
import { deleteSessionFiles } from './sessions.js';
import { Gasto } from './gasto.js';
import { askJornaleiro, Jornal } from './jornal.js';
import { Plugins } from './plugins.js';
import { MAESTRO, Porao, RODADAS_DIR } from './porao.js';
import { RelatoriosLidos } from './relatorios.js';
import { Skills } from './skills.js';
import { StatusLineStore } from './statusline.js';
import { TerminalManager } from './terminals.js';
import { buildWorld, type Project, type World } from './world.js';

const config = loadConfig();
/** Conta das consultas dos agentes que só leem (`agentes.conta` do config local); nome inexistente cai no Claude. */
const contaConfigurada = contaPorNome(config, config.agentes.conta);
const contaDosAgentes = contaConfigurada ?? CONTA_CLAUDE;
if (config.agentes.conta && !contaConfigurada) {
  console.warn(`[agentes] a conta "${config.agentes.conta}" não está no config; os agentes usam Claude.`);
}
const HOST = '127.0.0.1';
const POLL_MS = 3000;
/** De quanto em quanto tempo o pombal busca o remoto (rede); entre uma busca e outra, o estado vem do disco. */
const POMBAL_FETCH_MS = 5 * 60_000;

let world: World = { projects: [], sessions: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null, conversas: [], pedidosPorao: [], maestroChamando: {}, rodadasPorao: [], contas: [] };
let worldJson = '';
const eventClients = new Set<WebSocket>();

const terminals = new TerminalManager(() => void refreshWorld());
const lareiras = new Lareiras(() => void refreshWorld());
const hooks = new HookStore();
const library = new Library(config, () => world.projects);
const statusLine = new StatusLineStore();
/** Sessões que a própria vila abre por baixo (consultas à bibliotecária e ao administrador) — não viram moradores. */
const internalSessions = new Set<string>();
const moradores = new Moradores();
const quarto = new Quarto();
const agents = new Agents(() => world.projects, () => contaDosAgentes);
const skills = new Skills(() => world.projects);
const plugins = new Plugins(config, () => world.projects);
const gasto = new Gasto(config, () => world.projects);
const jornal = new Jornal(() => world, internalSessions, contaDosAgentes);
/** Sessões novas de conversa com um agente, esperando o terminal abrir: id → pasta e agente (o front não escolhe). */
const agentSessions = new Map<string, { cwd: string; agent: string }>();
/** Sessões avulsas novas (banco da praça), esperando o terminal abrir: nascem na home, fora de qualquer projeto. */
const avulsaSessions = new Set<string>();
/** Quem mora no porão das casas (maestro e tarefas das rodadas, MA-1). */
const porao = new Porao();
const bastao = new Bastao();
/**
 * Sessões novas que pediram uma conta na casa (decisão do usuário, 19/11/2026): id → nome da conta. Vale até a conversa
 * ser gravada; depois disso a pasta do `.jsonl` é a fonte (perfil.ts), inclusive ao retomar.
 */
const escolhasDeConta = new Map<string, string>();

/** Conta com que uma sessão fala: a conversa salva manda; sem ela, a escolha da abertura; senão, a pasta. */
const contaDaSessaoDe = (s: { id: string; cwd: string; file: string | null }): Conta =>
  contaDaSessao(s, config, contaPorNome(config, escolhasDeConta.get(s.id)));

/** Abre uma sessão nova sem ninguém olhando, já com a primeira mensagem (tarefa do porão, roteiro, sucessor do bastão). */
async function abrirSessao({ sessionId, cwd, prompt, permitir, settings, conta }: { sessionId: string; cwd: string; prompt: string; permitir: string[]; settings?: string; conta?: Conta | null }) {
  const ambiente = await ambienteDoTerminal(cwd, config, conta);
  if ('erro' in ambiente) return ambiente.erro;
  terminals.start({ sessionId, cwd, mode: 'new', prompt, permitir, settings, env: ambiente.env, cols: 120, rows: 32 });
  return null;
}

// Passagem de bastão (BT-1): quando o resumo pedido aparece, nasce o sucessor na mesma pasta.
setInterval(() => {
  void bastao
    .conferir(abrirSessao)
    .then(async (abertos) => {
      if (abertos.length) await refreshWorld();
    })
    .catch(() => {});
}, 3000);
const relatoriosLidos = new RelatoriosLidos();
const clinica = new Clinica(() => world, () => hooks.all(), (id) => terminals.pidDe(id));

/** Tarefa de rodada que a vila abre sozinha (a dependente, maestro v2): na pasta do projeto dela. */
function abrirDaRodada(projectId: string) {
  return (sessionId: string, prompt: string, permitir: string[], settings?: string) => {
    const project = findProject(projectId);
    return project ? abrirSessao({ sessionId, cwd: project.path, prompt, permitir, settings }) : Promise.resolve('Projeto da rodada não encontrado.');
  };
}

async function refreshWorld() {
  try {
    // A vila conduz as rodadas do maestro (v2): pronta pela devolutiva, dependente abre, relatório no fim.
    await porao
      .avancar(world.sessions, abrirDaRodada, config.porao.leitura)
      .catch((err) => console.error('[porão] falha ao conduzir a rodada:', err));
    const built = await buildWorld(config, terminals.live(), hooks.all(), statusLine, moradores, agents, skills, porao, relatoriosLidos, (id) =>
      contaPorNome(config, escolhasDeConta.get(id)),
      quarto,
    );
    world = { ...built, projects: built.projects.map((p) => ({ ...p, lareira: lareiras.merge(p.id, p.lareira) })) };
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

// As rotas HTTP moram em app.ts (PD-8, passo 2: testáveis sem subir a vila); aqui ficam os serviços de verdade.
const webDist = path.join(ROOT_DIR, 'web', 'dist');
const app = criarApp({
  world: () => world,
  refreshWorld,
  terminals,
  lareiras,
  hooks,
  library,
  statusLine,
  moradores,
  quarto,
  agents,
  skills,
  plugins,
  gasto,
  jornal,
  internalSessions,
  agentSessions,
  avulsaSessions,
  porao,
  relatoriosLidos,
  contas: config.contas,
  escolhasDeConta,
  contaDaSessao: contaDaSessaoDe,
  tetoSessoes: config.porao.tetoSessoes,
  leituraPorao: config.porao.leitura,
  abrirTarefa: abrirSessao,
  bastao,
  terminaisDoBastao: terminals,
  // Os agentes que só leem respondem na conta DeepSeek do config local; o administrador, único que edita, fica no Claude.
  askLibrarian: (question, history, onEvent, hooksToIgnore) => askLibrarian(question, history, onEvent, hooksToIgnore, contaDosAgentes),
  askAdministrador,
  askMirim: (question, history, project, sessions, onEvent, hooksToIgnore) => askMirim(question, history, project, sessions, onEvent, hooksToIgnore, contaDosAgentes),
  // Crítico na conta dos agentes (DeepSeek Flash); verificador no Claude (Haiku): outra família confere cada apontamento.
  criticaDoCartao: criticaDoPorao(perguntarDeVerdade(contaDosAgentes, CONTA_CLAUDE, internalSessions), RODADAS_DIR, () => void refreshWorld()),
  clinica,
  askMedica: (question, history, ficha, onEvent, hooksToIgnore) => askMedica(question, history, ficha, onEvent, hooksToIgnore, contaDosAgentes),
  sugerirMensagem: (dir, arquivos, hooksToIgnore) => sugerirMensagem(dir, arquivos, hooksToIgnore, contaDosAgentes),
  askJornaleiro: (question, history, jornal, onEvent, hooksToIgnore) => askJornaleiro(question, history, jornal, onEvent, hooksToIgnore, contaDosAgentes),
  apagarConversa: (id: string) => deleteSessionFiles(id, projectsDirs(config)),
  abrirVscode: (args) => spawn('code', args, { detached: true, stdio: 'ignore' }).unref(),
  webDist: fs.existsSync(webDist) ? webDist : null,
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  // Os terminais rodam comandos de verdade: só aceitamos páginas servidas localmente.
  if (!isLocalOrigin(req.headers.origin)) {
    socket.destroy();
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  wss.handleUpgrade(req, socket, head, async (ws) => {
    if (url.pathname === '/ws/events') {
      eventClients.add(ws);
      ws.on('close', () => eventClients.delete(ws));
      if (worldJson) ws.send(worldJson);
      return;
    }
    if (url.pathname === '/ws/lareira') {
      const project = findProject(url.searchParams.get('project'));
      const lado = url.searchParams.get('lado') ?? '';
      if (!project?.lareira?.lados.some((l) => l.lado === lado && l.comando)) {
        ws.close(1008, 'lado inválido');
        return;
      }
      lareiras.attach(ws, project.id, lado);
      return;
    }
    if (url.pathname === '/ws/terminal') {
      const sessionId = url.searchParams.get('session') ?? '';
      const known = world.sessions.find((s) => s.id === sessionId);
      const project = findProject(url.searchParams.get('project'));
      const forAgent = known ? undefined : agentSessions.get(sessionId);
      agentSessions.delete(sessionId);
      const avulsa = avulsaSessions.delete(sessionId) ? os.homedir() : undefined;
      const cwd = known?.cwd ?? forAgent?.cwd ?? project?.path ?? avulsa;
      if (!/^[0-9a-f-]{36}$/.test(sessionId) || !cwd) {
        ws.close(1008, 'sessão inválida');
        return;
      }
      // Conta exata: a conversa salva manda; sem ela, a escolha da abertura; senão, a raiz da pasta. Não abre se a conta
      // DeepSeek escolhida está sem configuração (perfil.ts).
      const ambiente = terminals.has(sessionId)
        ? { env: {} }
        : await ambienteDoTerminal(cwd, config, contaDaSessaoDe({ id: sessionId, cwd, file: known?.file ?? null }));
      if ('erro' in ambiente) {
        ws.send(`\r\n\x1b[31m[${ambiente.erro} O terminal não abriu, para não usar a licença do trabalho.]\x1b[0m\r\n`);
        ws.close(1008, 'conta sem configuração');
        return;
      }
      // Maestro do porão: sabe onde está a vila e qual é a própria sessão, para pedir as sessões da rodada (MA-1, fase 3).
      const ehMaestro = forAgent?.agent === MAESTRO || known?.porao?.papel === 'maestro';
      const porta = ehMaestro ? { DEV_VALLEY_URL: `http://127.0.0.1:${config.port}`, DEV_VALLEY_SESSION: sessionId } : {};
      // Tarefa do porão retomada: volta com as regras e os hooks com que nasceu (MA-3).
      const daTarefa = known?.porao?.papel === 'tarefa' && !terminals.has(sessionId) ? await porao.retomada(sessionId, config.porao.leitura) : null;
      // Abrir quem dorme no quarto acorda e a sessão volta à sala (decisão do usuário, 21/11/2026).
      if (known) await quarto.acordar([sessionId]);
      terminals.attach(ws, {
        env: { ...ambiente.env, ...porta },
        sessionId,
        cwd,
        mode: known ? 'resume' : 'new',
        agent: forAgent?.agent,
        permitir: daTarefa?.permitir,
        settings: daTarefa?.settings,
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
// Pombal: busca o remoto de tempos em tempos para saber se chegou carta (a primeira, logo ao subir).
async function buscarPombais() {
  await Promise.all(world.projects.filter((p) => p.pombal).map((p) => buscar(p.path)));
  await refreshWorld();
}
void buscarPombais();
setInterval(() => void buscarPombais(), POMBAL_FETCH_MS);
// Banca de jornal: a edição do dia sai sozinha depois das 6h, com a vila aberta (um minuto depois de subir, para o
// pombal ter buscado o remoto, e depois a cada meia hora). Já impressa, não chama o jornaleiro de novo.
setTimeout(() => void jornal.garantirDoDia(), 60_000);
setInterval(() => void jornal.garantirDoDia(), 30 * 60_000);

server.listen(config.port, HOST, () => {
  console.log(`🌾 Dev Valley rodando em http://localhost:${config.port}`);
  console.log(`   ${world.projects.length} projetos, ${world.sessions.length} sessões`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    terminals.killAll();
    lareiras.killAll();
    process.exit(0);
  });
}
