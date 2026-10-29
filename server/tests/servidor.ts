import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after } from 'node:test';
import { criarApp, type Contexto } from '../src/app.js';
import type { Project, World, WorldSession } from '../src/world.js';

/** Imitação que não foi preparada para o teste: falha alto em vez de agir na vila de verdade. */
const proibido = (nome: string) => () => {
  throw new Error(`${nome} não devia ser chamado neste teste`);
};

/** Casa de mentira apontando para uma pasta temporária (`projeto()` de util.ts). */
export function casa(id: string, dir: string, extra: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    path: dir,
    isGit: false,
    branch: null,
    remote: null,
    changes: [],
    pendencias: null,
    painel: null,
    quadro: [],
    progress: null,
    missingStructure: [],
    sementes: null,
    estante: null,
    retrabalho: null,
    auditoria: null,
    pombal: null,
    lareira: null,
    ...extra,
  };
}

export function sessao(id: string, extra: Partial<WorldSession> = {}): WorldSession {
  return { id, name: 'Teste', cwd: '/tmp', projectId: null, inTown: true, live: false, status: null, context: null, ...extra } as WorldSession;
}

export interface Servidor {
  url: string;
  ctx: Contexto;
  get: (rota: string, init?: RequestInit) => Promise<Response>;
  /** POST/PUT/DELETE com JSON; `origem` vira o cabeçalho Origin. */
  enviar: (metodo: string, rota: string, corpo?: unknown, origem?: string) => Promise<Response>;
}

/** Sobe o `app` numa porta livre de 127.0.0.1 com um mundo de mentira; fecha sozinho no fim do arquivo de teste. */
export async function subir(mundo: { projects?: Project[]; sessions?: WorldSession[] }, extra: Partial<Contexto> = {}): Promise<Servidor> {
  const world: World = { projects: [], sessions: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null, ...mundo };
  const ctx: Contexto = {
    world: () => world,
    refreshWorld: async () => {},
    terminals: { kill: proibido('terminals.kill') },
    lareiras: { acender: proibido('lareiras.acender'), apagar: proibido('lareiras.apagar') },
    hooks: { handle: proibido('hooks.handle'), forget: proibido('hooks.forget') },
    library: {
      sections: proibido('library.sections'),
      read: proibido('library.read'),
      htmlPath: proibido('library.htmlPath'),
      write: proibido('library.write'),
      createClaudeMd: proibido('library.createClaudeMd'),
      search: proibido('library.search'),
    },
    statusLine: { handle: proibido('statusLine.handle') },
    moradores: { claim: proibido('moradores.claim') },
    agents: { read: proibido('agents.read'), create: proibido('agents.create'), save: proibido('agents.save'), remove: proibido('agents.remove') },
    skills: { read: proibido('skills.read'), create: proibido('skills.create'), save: proibido('skills.save'), remove: proibido('skills.remove') },
    internalSessions: new Set(),
    agentSessions: new Map(),
    avulsaSessions: new Set(),
    askLibrarian: proibido('askLibrarian'),
    askAdministrador: proibido('askAdministrador'),
    sugerirMensagem: proibido('sugerirMensagem'),
    apagarConversa: proibido('apagarConversa'),
    abrirVscode: proibido('abrirVscode'),
    webDist: null,
    ...extra,
  };
  const server = http.createServer(criarApp(ctx));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  after(() => new Promise<void>((ok) => server.close(() => ok())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Erro dentro de rota async (uma imitação proibida, por exemplo) o Express 4 não captura: a resposta nunca chega.
  // O limite faz o teste falhar em vez de travar a suíte.
  const limite = () => AbortSignal.timeout(5000);
  return {
    url,
    ctx,
    get: (rota, init) => fetch(url + rota, { signal: limite(), ...init }),
    enviar: (metodo, rota, corpo, origem) =>
      fetch(url + rota, {
        signal: limite(),
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(origem ? { Origin: origem } : {}) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      }),
  };
}
