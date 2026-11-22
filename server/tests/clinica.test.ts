import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { agentDefinition, argsDaConsulta } from '../src/consulta.js';
import {
  Clinica,
  descendentes,
  fichaDoPaciente,
  haQuanto,
  lerMeminfo,
  lerProcessos,
  lerStat,
  lerVitais,
  montarPacientes,
  pendenteEErros,
  processoPeloId,
  type Processo,
} from '../src/clinica.js';
import type { HookState } from '../src/hooks.js';
import { ehClaude, lerContainers, lerPortas, procurarEsquecidos } from '../src/clinica.js';

const proibido = async (): Promise<never> => {
  throw new Error('não devia ser chamado');
};
import { sessao, subir } from './servidor.js';

// Clínica e médica (decisão do usuário, 09/11/2026). O `/proc` e as conversas são de mentira, em pasta temporária.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-valley-clinica-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const PAGINA = 'http://localhost:4777';
const ID = '11111111-2222-3333-4444-555555555555';

/** Uma linha de `/proc/<pid>/stat`: estado, pai, ticks de CPU (utime + stime) e início em ticks desde o boot. */
const stat = (pid: number, nome: string, estado: string, ppid: number, ticks: number, inicio: number) =>
  `${pid} (${nome}) ${estado} ${ppid} 0 0 0 0 0 0 0 0 0 ${ticks} 0 0 0 0 0 0 0 ${inicio} 0 0`;

function proc(p: Partial<Processo> & { pid: number }): Processo {
  return { ppid: 1, estado: 'S', ticks: 0, inicio: 0, comando: '', memMb: 0, ...p };
}

describe('leituras do /proc', () => {
  test('lerStat: campos depois do último parêntese, mesmo com espaço e ")" no nome', () => {
    assert.deepEqual(lerStat(stat(42, 'node (x) y', 'R', 7, 350, 1200)), { pid: 42, ppid: 7, estado: 'R', ticks: 350, inicio: 12 });
    assert.equal(lerStat('lixo'), null);
  });

  test('lerProcessos: pasta de mentira; o que não é número e o que some no meio ficam de fora', async () => {
    const dir = path.join(TMP, 'proc-lista');
    for (const [pid, linha, cmd] of [
      [10, stat(10, 'claude', 'S', 1, 100, 0), 'claude\0--resume\0' + ID],
      [11, stat(11, 'bash', 'R', 10, 50, 3000), 'bash\0-c\0mvn test'],
    ] as const) {
      fs.mkdirSync(path.join(dir, String(pid)), { recursive: true });
      fs.writeFileSync(path.join(dir, String(pid), 'stat'), linha);
      fs.writeFileSync(path.join(dir, String(pid), 'cmdline'), cmd);
    }
    fs.mkdirSync(path.join(dir, '12')); // sem stat: saiu no meio
    fs.writeFileSync(path.join(dir, 'meminfo'), '');
    const lista = await lerProcessos(dir);
    assert.deepEqual([...lista.keys()].sort(), [10, 11]);
    assert.equal(lista.get(11)!.comando, 'bash -c mvn test');
    assert.equal(processoPeloId(ID, lista), 10);
    assert.equal(processoPeloId('outro', lista), null);
  });

  test('descendentes: filhos e netos, sem a raiz e sem os de outra árvore, na ordem em que nasceram', () => {
    const m = new Map([proc({ pid: 10 }), proc({ pid: 12, ppid: 11, inicio: 9 }), proc({ pid: 11, ppid: 10, inicio: 5 }), proc({ pid: 20, ppid: 1 })].map((p) => [p.pid, p]));
    assert.deepEqual(descendentes(10, m).map((p) => p.pid), [11, 12]);
  });

  test('lerMeminfo e lerVitais: usada = total − disponível; sem arquivo, null', async () => {
    const meminfo = 'MemTotal:  8388608 kB\nMemFree: 100 kB\nMemAvailable: 2097152 kB\nSwapTotal: 2097152 kB\nSwapFree: 1048576 kB\n';
    assert.deepEqual(lerMeminfo(meminfo), { memoria: { totalMb: 8192, usadaMb: 6144 }, swap: { totalMb: 2048, usadaMb: 1024 } });
    assert.deepEqual(lerMeminfo(''), { memoria: null, swap: null });
    const dir = path.join(TMP, 'proc-vitais');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'meminfo'), meminfo);
    fs.writeFileSync(path.join(dir, 'loadavg'), '3.20 2.00 1.00 2/300 999\n');
    const v = await lerVitais(dir, TMP);
    assert.equal(v.carga!.umMinuto, 3.2);
    assert.ok(v.disco && v.disco.totalGb > 0);
    assert.deepEqual(await lerVitais(path.join(TMP, 'nada'), path.join(TMP, 'nada')), { memoria: null, swap: null, carga: null, disco: null });
  });

  test('haQuanto', () => {
    assert.equal(haQuanto(40), 'há 40 s');
    assert.equal(haQuanto(12 * 60), 'há 12 min');
    assert.equal(haQuanto(65 * 60), 'há 1 h 05 min');
  });
});

describe('montarPacientes: só os vivos, com CPU e comandos', () => {
  const sessoes = [sessao('vivo', { live: true, status: 'working', name: 'Ana' }), sessao('fora', { live: true }), sessao('parado', { live: false })];
  const hooks = new Map<string, HookState>([['vivo', { id: 'vivo', cwd: '/p', status: 'working', updatedAt: 500, citados: [], citadosEm: 0, paradoEm: 0, trabalhandoDesde: 100, atividade: 'rodar' }]]);
  // Claude nasceu em 1000 s; o servidor MCP 2 s depois; o `mvn test` 10 min depois, comendo uma CPU inteira.
  const antes = new Map([proc({ pid: 10, inicio: 1000, ticks: 0 }), proc({ pid: 11, ppid: 10, inicio: 1002, ticks: 0 }), proc({ pid: 12, ppid: 10, inicio: 1600, ticks: 0 })].map((p) => [p.pid, p]));
  const depois = new Map(
    [
      proc({ pid: 10, inicio: 1000, ticks: 3, comando: 'claude' }),
      proc({ pid: 11, ppid: 10, inicio: 1002, ticks: 0, comando: 'node mcp-server.js' }),
      proc({ pid: 12, ppid: 10, inicio: 1600, ticks: 100, estado: 'R', comando: 'bash -c mvn test' }),
    ].map((p) => [p.pid, p]),
  );

  test('processo do terminal da vila, CPU pela diferença de ticks, MCP separado dos comandos', () => {
    const ps = montarPacientes(sessoes, hooks, (id) => (id === 'vivo' ? 10 : null), antes, depois, 2200, 1);
    assert.deepEqual(ps.map((p) => p.id), ['vivo', 'fora'], 'sessão encerrada não é paciente');
    const [p] = ps;
    assert.deepEqual(p!.processo, { pid: 10, cpu: 3 });
    assert.deepEqual(p!.comandos, [{ pid: 12, comando: 'bash -c mvn test', idadeS: 600, cpu: 100, estado: 'R', daSessao: false }]);
    assert.deepEqual(p!.servidores.map((c) => c.pid), [11]);
    assert.equal(p!.trabalhandoDesde, 100);
    assert.equal(p!.ultimoEvento, 500);
    const semProcesso = ps[1]!;
    assert.equal(semProcesso.processo, null);
    assert.deepEqual(semProcesso.comandos, []);
  });
});

describe('a ficha que a médica recebe', () => {
  test('ferramenta sem resultado = o que ela espera; erros de ferramenta recentes', async () => {
    const T = '2026-11-09T14:05:00.000Z';
    const file = path.join(TMP, 'paciente.jsonl');
    fs.writeFileSync(
      file,
      [
        { type: 'assistant', timestamp: T, message: { content: [{ type: 'tool_use', id: 'a', name: 'Bash', input: { command: 'npm test' } }] } },
        { type: 'user', timestamp: T, message: { content: [{ type: 'tool_result', tool_use_id: 'a', is_error: true, content: 'Error: falhou' }] } },
        { type: 'assistant', timestamp: T, message: { content: [{ type: 'tool_use', id: 'b', name: 'Bash', input: { command: 'npm run dev' } }] } },
      ]
        .map((l) => JSON.stringify(l))
        .join('\n'),
    );
    const { pendente, erros } = await pendenteEErros(file);
    assert.match(pendente!, /^Bash: npm run dev \(chamada às \d\d:\d\d\)$/);
    assert.equal(erros.length, 1);
    assert.match(erros[0]!, /Error: falhou/);

    const s = sessao('vivo', { live: true, status: 'working', name: 'Ana', file, cwd: '/p' });
    const agora = Date.parse('2026-11-09T15:00:00.000Z');
    const ficha = await fichaDoPaciente(
      {
        id: 'vivo', name: 'Ana', projectId: null, status: 'working', live: true, inTown: true, atividade: 'rodar', contexto: 64,
        trabalhandoDesde: agora - 23 * 60_000, ultimoEvento: agora - 120_000,
        processo: { pid: 10, cpu: 0 },
        comandos: [{ pid: 12, comando: 'npm run dev', idadeS: 1200, cpu: 0, estado: 'S', daSessao: false }],
        servidores: [],
      },
      s,
      'praça',
      { memoria: { totalMb: 8192, usadaMb: 6144 }, swap: null, carga: null, disco: null },
      agora,
    );
    for (const trecho of ['trabalhando sem parar há 23 min', 'último evento há 2 min', 'Contexto: 64%', 'há 20 min, CPU 0%, dormindo (esperando algo): npm run dev', 'memória 6,0 de 8,0 GB em uso (75%)', 'Esperando o resultado de: Bash: npm run dev', 'Últimos passos:'])
      assert.ok(ficha.includes(trecho), `falta "${trecho}" na ficha:\n${ficha}`);
  });

  test('Clinica.ficha: só de morador vivo', async () => {
    const c = new Clinica(
      () => ({ projects: [], sessions: [sessao('morto', { live: false })], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null, conversas: [], pedidosPorao: [], maestroChamando: {}, rodadasPorao: [], contas: [] }),
      () => [],
      () => null,
      path.join(TMP, 'proc-vazio'),
    );
    assert.equal(await c.ficha('morto'), null);
    assert.equal(await c.ficha('nenhum'), null);
  });
});

describe('a médica só lê', () => {
  test('Read, Grep e Glob, modo estrito, nada de escrita nem Bash', () => {
    const def = agentDefinition('medica');
    assert.deepEqual(def.tools, ['Read', 'Grep', 'Glob']);
    const args = argsDaConsulta('medica', def, 'p', 'id', [], true);
    assert.deepEqual(args.slice(args.indexOf('--allowedTools') + 1), ['Read', 'Grep', 'Glob']);
    assert.equal(args[args.indexOf('--permission-mode') + 1], 'default');
  });
});

describe('Rotas da clínica', () => {
  test('GET /api/clinica devolve a triagem', async () => {
    const s = await subir({}, { clinica: { triagem: async () => ({ vitais: { memoria: null, swap: null, carga: null, disco: null }, pacientes: [] }), ficha: async () => null, armario: proibido, vitais: proibido } });
    const r = await s.get('/api/clinica');
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).pacientes, []);
  });

  test('médica: só pela página, pergunta não vazia, morador vivo; responde em NDJSON com a ficha', async () => {
    const perguntas: { question: string; ficha: string }[] = [];
    const s = await subir(
      {},
      {
        clinica: { triagem: async () => ({ vitais: { memoria: null, swap: null, carga: null, disco: null }, pacientes: [] }), ficha: async (id) => (id === ID ? 'FICHA' : null), armario: proibido, vitais: proibido },
        askMedica: async (question, _h, ficha, onEvent) => {
          perguntas.push({ question, ficha });
          onEvent({ type: 'step', text: '🔎 Procurando' });
          onEvent({ type: 'answer', text: '🟢 Trabalhando' });
          return () => {};
        },
      },
    );
    assert.equal((await s.enviar('POST', '/api/clinica/medica', { sessionId: ID, question: 'como está?' })).status, 403, 'sem Origin');
    assert.equal((await s.enviar('POST', '/api/clinica/medica', { sessionId: ID, question: '  ' }, PAGINA)).status, 400);
    assert.equal((await s.enviar('POST', '/api/clinica/medica', { sessionId: 'outro', question: 'oi' }, PAGINA)).status, 404);
    assert.equal(perguntas.length, 0);
    const r = await s.enviar('POST', '/api/clinica/medica', { sessionId: ID, question: 'como está?', history: [] }, PAGINA);
    assert.equal(r.status, 200);
    const eventos = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(eventos.map((e) => e.type), ['step', 'answer']);
    assert.deepEqual(perguntas, [{ question: 'como está?', ficha: 'FICHA' }]);
  });
});

describe('armário: pacientes esquecidos (CL-1)', () => {
  test('ehClaude: o executável, não o caminho de um argumento', () => {
    assert.ok(ehClaude({ comando: 'claude --resume x' }));
    assert.ok(ehClaude({ comando: '/home/u/.local/bin/claude' }));
    assert.ok(!ehClaude({ comando: 'bash -c source /home/u/.claude/shell-snapshots/x.sh' }));
    assert.ok(!ehClaude({ comando: 'node claude-helper.js' }));
  });

  test('lerPortas: só LISTEN, porta em hexadecimal, pelo inode', () => {
    const tcp = [
      '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
      '   0: 0100007F:12A9 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 555 1 0 100 0 0 10 0',
      '   1: 0100007F:B4FB 0100007F:1F90 01 00000000:00000000 00:00000000 00000000  1000        0 556 1 0 100 0 0 10 0',
    ].join('\n');
    assert.deepEqual([...lerPortas(tcp)], [[555, 4777]]);
  });

  test('lerContainers: uma linha JSON por container, com o projeto do compose; lixo é pulado', () => {
    const saida = [
      JSON.stringify({ Names: 'banco', Image: 'postgres:18', Status: 'Up 2 hours', Ports: '0.0.0.0:5432->5432/tcp', Labels: 'a=b,com.docker.compose.project=meu-projeto,c=d' }),
      'lixo',
      JSON.stringify({ Names: 'solto', Image: 'redis', Status: 'Up 1 minute', Ports: '' }),
    ].join('\n');
    assert.deepEqual(lerContainers(saida), [
      { nome: 'banco', imagem: 'postgres:18', status: 'Up 2 hours', portas: '0.0.0.0:5432->5432/tcp', compose: 'meu-projeto' },
      { nome: 'solto', imagem: 'redis', status: 'Up 1 minute', portas: '', compose: null },
    ]);
  });

  test('procurarEsquecidos: o que descende da vila fica de fora; claude filho de claude e o próprio VS Code também; servidor pela porta', async () => {
    const dir = path.join(TMP, 'proc-armario');
    // 100 = servidor da vila; 101 = terminal de morador (claude); 102 = lareira escutando 5173.
    // 200 = claude fora da vila (VS Code), na pasta do morador Bia; 201 = subagente dele; 202 = servidor que ele subiu (8080).
    const procs: [number, string, number, number, string, string | null][] = [
      [100, 'node', 1, 100, 'node server/src/index.ts', null],
      [101, 'claude', 100, 200, 'claude --resume x', null],
      [102, 'node', 100, 300, 'npm run dev', '5173'],
      [200, 'claude', 1, 400, 'claude', null],
      [201, 'claude', 200, 500, 'claude --agent y', null],
      [202, 'java', 200, 600, 'java -jar app.jar', '8080'],
      [300, 'node', 1, 50, '/home/u/.vscode-server/bin/abc/node server-main.js', '44975'],
    ];
    const inodes: Record<string, number> = { '5173': 900, '8080': 901, '44975': 902 };
    for (const [pid, nome, ppid, inicio, cmd, porta] of procs) {
      const base = path.join(dir, String(pid));
      fs.mkdirSync(path.join(base, 'fd'), { recursive: true });
      fs.writeFileSync(path.join(base, 'stat'), stat(pid, nome, 'S', ppid, 0, inicio * 100));
      fs.writeFileSync(path.join(base, 'cmdline'), cmd.split(' ').join('\0'));
      fs.writeFileSync(path.join(base, 'statm'), '1000 2560 0 0 0 0 0');
      fs.symlinkSync(pid === 200 ? '/projetos/bia' : '/outra', path.join(base, 'cwd'));
      if (porta) fs.symlinkSync(`socket:[${inodes[porta]}]`, path.join(base, 'fd', '3'));
    }
    fs.mkdirSync(path.join(dir, 'net'));
    const linha = (porta: number, inode: number) => `   0: 00000000:${porta.toString(16).toUpperCase()} 00000000:0000 0A 0:0 0:0 0 1000 0 ${inode} 1`;
    fs.writeFileSync(path.join(dir, 'net', 'tcp'), ['cabeçalho', linha(5173, 900), linha(8080, 901), linha(44975, 902)].join('\n'));
    fs.writeFileSync(path.join(dir, 'uptime'), '1000.0 0');

    const bia = sessao('s-bia', { live: true, inTown: false, name: 'Bia', cwd: '/projetos/bia' });
    const { claudes, servidores } = await procurarEsquecidos(dir, 100, [bia]);
    assert.deepEqual(claudes.map((c) => [c.pid, c.morador, c.pasta, c.memMb, c.idadeS]), [[200, 'Bia', '/projetos/bia', 10, 600]]);
    assert.deepEqual(servidores.map((s) => [s.pid, s.portas]), [[202, [8080]]]);
  });

  test('rota: GET /api/clinica/armario devolve o que a clínica achou', async () => {
    const vazio = { claudes: [], servidores: [], containers: null, dockerErro: 'Docker não está instalado.' };
    const s = await subir({}, { clinica: { triagem: proibido, ficha: proibido, armario: async () => vazio, vitais: proibido } });
    const r = await s.get('/api/clinica/armario');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), vazio);
  });

  test('rota: GET /api/clinica/vitais devolve só os sinais da máquina', async () => {
    const v = { memoria: { totalMb: 8000, usadaMb: 4000 }, swap: null, carga: { umMinuto: 1.5, cpus: 8 }, disco: null };
    const s = await subir({}, { clinica: { triagem: proibido, ficha: proibido, armario: proibido, vitais: async () => v } });
    const r = await s.get('/api/clinica/vitais');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), v);
  });

  test('Clinica.armario: Docker ausente vira aviso, não erro', async () => {
    const semDocker = Object.assign(new Error('x'), { code: 'ENOENT' });
    const c = new Clinica(
      () => ({ projects: [], sessions: [], agents: [], skills: [], usage: null, restart: { server: false, web: false }, guardrails: null, conversas: [], pedidosPorao: [], maestroChamando: {}, rodadasPorao: [], contas: [] }),
      () => [],
      () => null,
      path.join(TMP, 'proc-vazio'),
      1,
      () => Promise.reject(semDocker),
    );
    const a = await c.armario();
    assert.equal(a.containers, null);
    assert.equal(a.dockerErro, 'Docker não está instalado.');
  });
});
