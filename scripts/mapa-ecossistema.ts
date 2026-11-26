// Mapa do ecossistema de IA: lê os arquivos reais desta máquina e gera duas páginas.
//
//   npx tsx scripts/mapa-ecossistema.ts               análise + apresentação
//   npx tsx scripts/mapa-ecossistema.ts --apresentacao só a versão mascarada
//   npx tsx scripts/mapa-ecossistema.ts --resumo      contagens no terminal, sem escrever página
//
// A versão de análise contém caminho pessoal e nome de projeto: fica em docs-dev/ecossistema/,
// pasta ignorada pelo git. A de apresentação passa pela máscara antes de virar HTML.
//
// Só leitura. Nunca abre credencial, .env, histórico de prompt nem o bloco env do settings.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Camada, Ecossistema, Guardrail, Metrica, Origem, Peca, Quando, Sinal, VilaItem } from './mapa-ecossistema-dominio.js';
import {
  auditoriaVencida,
  contarLinhas,
  contarPendencias,
  criarMascara,
  dataBr,
  diasAte,
  formatarBytes,
  lerDataAuditoria,
  lerGuardrails,
  lerRoteador,
  prepararParaApresentacao,
} from './mapa-ecossistema-dominio.js';
import { montarHtml } from './mapa-ecossistema-pagina.js';

// Teto do TRIAGEM.md (Passo 0b), baixado em 24/11/2026: conta blocos `## G…`, não números (regras dividem bloco).
const PESO_TETO_BLOCOS = 14;
const PESO_TETO_LINHAS = 75;

// ---------------------------------------------------------------------------
// I/O básico

interface Info {
  linhas?: number;
  bytes: number;
  modificadoEm: string;
}

function lerTexto(caminho: string): string | null {
  try {
    return fs.readFileSync(caminho, 'utf8');
  } catch {
    return null;
  }
}

function infoDe(caminho: string, contar = true, limiteLeitura = 2_000_000): Info | undefined {
  try {
    const st = fs.statSync(caminho);
    if (!st.isFile()) return undefined;
    const linhas = contar && st.size <= limiteLeitura ? contarLinhas(fs.readFileSync(caminho, 'utf8')) : undefined;
    return { linhas, bytes: st.size, modificadoEm: st.mtime.toISOString().slice(0, 10) };
  } catch {
    return undefined;
  }
}

function listar(caminho: string): string[] {
  try {
    return fs
      .readdirSync(caminho)
      .map((nome) => path.join(caminho, nome))
      .filter((p) => {
        try {
          return fs.statSync(p).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function listarPastas(caminho: string): string[] {
  try {
    return fs
      .readdirSync(caminho)
      .map((nome) => path.join(caminho, nome))
      .filter((p) => {
        try {
          return fs.statSync(p).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function listarRecursivo(caminho: string, filtro: (nome: string) => boolean): string[] {
  const saida: string[] = [];
  const pilha: string[] = [caminho];
  while (pilha.length) {
    const atual = pilha.pop();
    if (!atual) break;
    const entradas = (() => {
      try {
        return fs.readdirSync(atual, { withFileTypes: true });
      } catch {
        return [];
      }
    })();
    for (const entrada of entradas) {
      const completo = path.join(atual, entrada.name);
      if (entrada.isDirectory()) pilha.push(completo);
      else if (entrada.isFile() && filtro(entrada.name)) saida.push(completo);
    }
  }
  return saida.sort();
}

function nomesDe(lista: string[]): string[] {
  return lista.map((p) => path.basename(p, path.extname(p))).sort();
}

function somarArquivos(caminhos: string[], contar = true): Partial<Peca> {
  let linhas = 0;
  let bytes = 0;
  let modificadoEm: string | undefined;
  const existentes: string[] = [];
  for (const caminho of caminhos) {
    const info = infoDe(caminho, contar);
    if (!info) continue;
    existentes.push(caminho);
    bytes += info.bytes;
    linhas += info.linhas ?? 0;
    if (!modificadoEm || info.modificadoEm > modificadoEm) modificadoEm = info.modificadoEm;
  }
  return {
    caminhos: existentes,
    linhas: linhas || undefined,
    bytes: bytes || undefined,
    modificadoEm,
  };
}

function contarChavesJson(caminho: string): number | undefined {
  const texto = lerTexto(caminho);
  if (!texto) return undefined;
  try {
    const json: unknown = JSON.parse(texto);
    if (!json || typeof json !== 'object' || Array.isArray(json)) return undefined;
    return Object.keys(json as Record<string, unknown>).length;
  } catch {
    return undefined;
  }
}

function contarMoradores(caminho: string): number {
  const texto = lerTexto(caminho);
  if (!texto) return 0;
  try {
    const json = JSON.parse(texto) as Record<string, unknown>;
    const moradores = json.moradores;
    if (moradores && typeof moradores === 'object' && !Array.isArray(moradores)) {
      return Object.keys(moradores as Record<string, unknown>).length;
    }
    return Object.keys(json).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Configurações (só o que a página mostra; nada de env, token ou valor de permissão)

interface ConfigLida {
  modelo?: string;
  defaultMode?: string;
  allow: number;
  deny: number;
  ask: number;
  hooks: string[];
  plugins: string[];
}

function lerConfig(texto: string | null): ConfigLida | undefined {
  if (!texto) return undefined;
  try {
    const json = JSON.parse(texto) as Record<string, unknown>;
    const permissoes = (json.permissions && typeof json.permissions === 'object' ? json.permissions : {}) as Record<string, unknown>;
    const quantidade = (valor: unknown) => (Array.isArray(valor) ? valor.length : 0);
    const chaves = (valor: unknown) => (valor && typeof valor === 'object' ? Object.keys(valor as Record<string, unknown>).sort() : []);
    return {
      modelo: typeof json.model === 'string' ? json.model : undefined,
      defaultMode: typeof permissoes.defaultMode === 'string' ? permissoes.defaultMode : undefined,
      allow: quantidade(permissoes.allow),
      deny: quantidade(permissoes.deny),
      ask: quantidade(permissoes.ask),
      hooks: chaves(json.hooks),
      plugins: chaves(json.enabledPlugins),
    };
  } catch {
    return undefined;
  }
}

interface PluginConta {
  nome: string;
  versao: string;
  commit: string;
  atualizadoEm: string;
}

function lerPlugins(texto: string | null): PluginConta[] {
  if (!texto) return [];
  try {
    const json = JSON.parse(texto) as { plugins?: Record<string, Array<Record<string, unknown>>> };
    const saida: PluginConta[] = [];
    for (const nome of Object.keys(json.plugins ?? {}).sort()) {
      const entradas = json.plugins?.[nome];
      const entrada = Array.isArray(entradas) ? entradas[0] : undefined;
      if (!entrada) continue;
      saida.push({
        nome,
        versao: String(entrada.version ?? '?'),
        commit: String(entrada.gitCommitSha ?? '').slice(0, 7),
        atualizadoEm: String(entrada.lastUpdated ?? '').slice(0, 10),
      });
    }
    return saida;
  } catch {
    return [];
  }
}

function nomesDeProjeto(repo: string, home: string): string[] {
  const lerJson = (arquivo: string): Record<string, unknown> => {
    const texto = lerTexto(arquivo);
    if (!texto) return {};
    try {
      const json: unknown = JSON.parse(texto);
      return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  const lista = (config: Record<string, unknown>, campo: string): string[] => {
    const valor = config[campo];
    return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === 'string') : [];
  };
  const expandir = (p: string) => (p.startsWith('~') ? path.join(home, p.slice(1)) : p);
  const base = lerJson(path.join(repo, 'dev-valley.config.json'));
  const local = lerJson(path.join(repo, 'dev-valley.config.local.json'));
  const escolha = (campo: string) => {
    const doLocal = lista(local, campo);
    return doLocal.length ? doLocal : lista(base, campo);
  };
  const nomes = escolha('extraProjects')
    .map((p) => path.basename(expandir(p)))
    .filter(Boolean);
  for (const raiz of escolha('projectRoots').map(expandir)) {
    try {
      for (const entrada of fs.readdirSync(raiz, { withFileTypes: true })) {
        if (entrada.isDirectory() && !entrada.name.startsWith('.')) nomes.push(entrada.name);
      }
    } catch {
      // raiz ausente não é erro: o mapa sai sem ela
    }
  }
  const proprio = path.basename(repo);
  return [...new Set(nomes)].filter((nome) => nome !== proprio).sort();
}

// ---------------------------------------------------------------------------
// Coleta

export interface OpcoesColeta {
  home: string;
  repo: string;
  agora: string;
}

interface MemoriaConta {
  arquivos: number;
  bytes: number;
  nomes: string[];
}

function memoriaDe(base: string): MemoriaConta {
  const pastas = listarPastas(path.join(base, 'projects'))
    .map((projeto) => path.join(projeto, 'memory'))
    .filter((pasta) => {
      try {
        return fs.statSync(pasta).isDirectory();
      } catch {
        return false;
      }
    });
  const arquivos = pastas.flatMap((pasta) => listarRecursivo(pasta, (nome) => nome.endsWith('.md')));
  let bytes = 0;
  const frequencia = new Map<string, number>();
  for (const arquivo of arquivos) {
    const info = infoDe(arquivo, false);
    if (info) bytes += info.bytes;
    const nome = path.basename(arquivo);
    frequencia.set(nome, (frequencia.get(nome) ?? 0) + 1);
  }
  const nomes = [...frequencia.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([nome, vezes]) => (vezes > 1 ? `${nome} ×${vezes}` : nome));
  return { arquivos: arquivos.length, bytes, nomes };
}

function historicoDe(base: string): { arquivos: number; bytes: number } {
  const arquivos = listarRecursivo(path.join(base, 'projects'), (nome) => nome.endsWith('.jsonl'));
  let bytes = 0;
  for (const arquivo of arquivos) {
    const info = infoDe(arquivo, false);
    if (info) bytes += info.bytes;
  }
  return { arquivos: arquivos.length, bytes };
}

function primeiraLinhaDiferente(a: string, b: string): number | null {
  const linhasA = a.split('\n');
  const linhasB = b.split('\n');
  const total = Math.max(linhasA.length, linhasB.length);
  for (let i = 0; i < total; i += 1) {
    if ((linhasA[i] ?? '') !== (linhasB[i] ?? '')) return i + 1;
  }
  return null;
}

function peca(
  id: string,
  nome: string,
  papel: string,
  dados: Pick<Peca, 'origem' | 'quando'> & Partial<Omit<Peca, 'id' | 'nome' | 'papel' | 'origem' | 'quando'>>,
): Peca {
  return { id, nome, papel, caminhos: [], ...dados };
}

function contarPorCobranca(guardrails: Guardrail[]): Record<Guardrail['cobranca'], number> {
  const contagem = { mod: 0, teste: 0, julgamento: 0 };
  for (const guardrail of guardrails) contagem[guardrail.cobranca] += 1;
  return contagem;
}

export function coletarEcossistema(opcoes: OpcoesColeta): Ecossistema {
  const { home, repo, agora } = opcoes;
  const ia = path.join(home, 'Documents', 'IA');
  const claude = path.join(home, '.claude');
  const deepseek = path.join(home, '.claude-deepseek');

  const coreTexto = lerTexto(path.join(ia, 'guardrails-ia', 'guardrails-core.md')) ?? '';
  const nucleo = lerGuardrails(coreTexto);
  const roteadorClaudeTexto = lerTexto(path.join(claude, 'CLAUDE.md')) ?? '';
  const roteadorDeepseekTexto = lerTexto(path.join(deepseek, 'CLAUDE.md')) ?? '';
  const roteador = lerRoteador(roteadorClaudeTexto || roteadorDeepseekTexto);

  const pendenciasTexto = lerTexto(path.join(repo, 'PENDENCIAS.md')) ?? '';
  const pendencias = contarPendencias(pendenciasTexto);
  const auditoriaTexto = lerTexto(path.join(repo, '.claude', 'auditoria-regras.txt')) ?? '';
  const auditoriaData = lerDataAuditoria(auditoriaTexto);

  const configClaude = lerConfig(lerTexto(path.join(claude, 'settings.json')));
  const configDeepseek = lerConfig(lerTexto(path.join(deepseek, 'settings.json')));
  const configProjeto = lerConfig(lerTexto(path.join(repo, '.claude', 'settings.json')));
  const pluginsClaude = lerPlugins(lerTexto(path.join(claude, 'plugins', 'installed_plugins.json')));
  const pluginsDeepseek = lerPlugins(lerTexto(path.join(deepseek, 'plugins', 'installed_plugins.json')));

  const skillsGlobais = listarPastas(path.join(claude, 'skills'))
    .map((p) => path.basename(p))
    .filter((nome) => nome !== 'synced');
  const skillsIa = listarPastas(path.join(ia, 'claude', 'skills')).map((p) => path.basename(p));
  const skills = [...new Set([...skillsGlobais, ...skillsIa])].sort();
  const caminhosSkills = skills.map((nome) => {
    const noIa = path.join(ia, 'claude', 'skills', nome, 'SKILL.md');
    return fs.existsSync(noIa) ? noIa : path.join(claude, 'skills', nome, 'SKILL.md');
  });

  const agentesClaude = nomesDe(listar(path.join(claude, 'agents')).filter((p) => p.endsWith('.md')));
  const agentesDeepseek = nomesDe(listar(path.join(deepseek, 'agents')).filter((p) => p.endsWith('.md')));
  const agentesIa = nomesDe(listar(path.join(ia, 'claude', 'agents')).filter((p) => p.endsWith('.md')));
  const agentesServer = nomesDe(listar(path.join(repo, 'server', 'agents')).filter((p) => p.endsWith('.md')));
  const caminhosAgentes = [
    ...listar(path.join(ia, 'claude', 'agents')).filter((p) => p.endsWith('.md')),
    ...listar(path.join(repo, 'server', 'agents')).filter((p) => p.endsWith('.md')),
    ...listar(path.join(deepseek, 'agents')).filter((p) => p.endsWith('.md')).filter((p) => !agentesIa.includes(path.basename(p, '.md'))),
  ];

  const memoriaClaude = memoriaDe(claude);
  const memoriaDeepseek = memoriaDe(deepseek);
  const historicoClaude = historicoDe(claude);
  const historicoDeepseek = historicoDe(deepseek);

  const moradoresJson = path.join(claude, 'dev-valley', 'moradores.json');
  const moradores = contarMoradores(moradoresJson);
  const rodadasDir = listarPastas(path.join(claude, 'maestro', 'rodadas')).filter((pasta) => fs.existsSync(path.join(pasta, 'rodada.json')));
  const rodadas = rodadasDir.length;

  const progress = somarArquivos([path.join(repo, 'PROGRESS.md')]);
  const retrabalho = somarArquivos([path.join(repo, 'RETRABALHO.md')]);
  const painel = somarArquivos([path.join(repo, 'docs-dev', 'painel.json')]);
  const operacao = somarArquivos([path.join(repo, 'docs-dev', 'guias', 'OPERACAO.md')]);
  const planos = listar(path.join(repo, 'docs-dev', 'a-codar')).filter((p) => path.basename(p) !== '.gitkeep');
  const contextos = listar(path.join(repo, 'docs-dev', 'context')).filter((p) => p.endsWith('.md'));
  const templates = listar(path.join(ia, 'guardrails-ia', 'templates'));
  const relatorios = listar(path.join(repo, 'docs-dev', 'maestro')).filter((p) => p.endsWith('.md'));

  const caminhosMods = [
    path.join(ia, 'mods', 'guardrails', 'hooks', 'register.ts'),
    path.join(ia, 'mods', 'guardrails', 'hooks', 'regras.ts'),
    path.join(ia, 'mods', 'guardrails', 'hooks', 'rastro.ts'),
    path.join(repo, 'mod', 'hooks', 'register.ts'),
    path.join(repo, 'mod', 'hooks', 'moradores.ts'),
  ];
  const dadosMods = somarArquivos(caminhosMods);

  const dadosNucleo = somarArquivos([path.join(ia, 'guardrails-ia', 'guardrails-core.md')]);
  const caminhosCnr = [
    path.join(ia, 'cnr', 'como-trabalhamos.md'),
    path.join(ia, 'cnr', 'comunicacao.md'),
    path.join(ia, 'cnr', 'contexto.md'),
  ];
  const dadosCnr = somarArquivos(caminhosCnr);
  const dadosPerfil = somarArquivos([path.join(ia, 'pessoal', 'sobre-mim.md')]);
  const caminhosProjeto = [path.join(repo, 'CLAUDE.md'), ...listar(path.join(repo, '.claude', 'rules')).filter((p) => p.endsWith('.md'))];
  const dadosProjeto = somarArquivos(caminhosProjeto);
  const dadosSkills = somarArquivos(caminhosSkills);
  const dadosAgentes = somarArquivos(caminhosAgentes);
  const dadosConfig = somarArquivos([
    path.join(claude, 'settings.json'),
    path.join(deepseek, 'settings.json'),
    path.join(repo, '.claude', 'settings.json'),
  ]);
  const dadosRoteador = somarArquivos([
    path.join(claude, 'CLAUDE.md'),
    path.join(deepseek, 'CLAUDE.md'),
    path.join(ia, 'claude', 'CLAUDE.md.template'),
  ]);
  const dadosTriagem = somarArquivos([path.join(ia, 'guardrails-ia', 'TRIAGEM.md')]);
  const dadosAuditoriaSkill = somarArquivos([path.join(ia, 'claude', 'skills', 'auditar-regras', 'SKILL.md')]);
  const dadosAuditor = somarArquivos([path.join(repo, 'scripts', 'auditar-referencias.py')]);
  const dadosCi = somarArquivos([path.join(repo, '.github', 'workflows', 'auditor.yml')]);
  const dadosNovaRegra = somarArquivos([path.join(ia, 'claude', 'skills', 'nova-regra', 'SKILL.md')]);
  const dadosRevisar = somarArquivos([
    path.join(ia, 'claude', 'skills', 'revisar', 'SKILL.md'),
    path.join(ia, 'claude', 'agents', 'revisor.md'),
    path.join(ia, 'claude', 'agents', 'verificador.md'),
  ]);
  const dadosRoteiro = somarArquivos([path.join(ia, 'claude', 'skills', 'roteiro-testes', 'SKILL.md')]);
  const dadosInstaladores = somarArquivos([
    path.join(ia, 'instalar.sh'),
    path.join(ia, 'instalar-projeto.sh'),
    path.join(repo, 'server', 'src', 'install-hooks.ts'),
  ]);
  const dadosTemplates = somarArquivos(templates);
  const dadosPlanos = somarArquivos(planos);
  const dadosContextos = somarArquivos(contextos);

  const cobertura = contarPorCobranca(nucleo.guardrails);
  const blocosNucleo = coreTexto.split('\n').filter((l) => /^## G\d/.test(l)).length;
  const orcamentoEstourado = blocosNucleo > PESO_TETO_BLOCOS || nucleo.linhas > PESO_TETO_LINHAS;
  const vencida = auditoriaVencida(auditoriaData, agora);
  const dias = auditoriaData ? diasAte(auditoriaData, agora) : null;

  const nomesMods = [...new Set([...pluginsClaude, ...pluginsDeepseek].map((p) => p.nome))].sort();
  const detalhesMods = nomesMods.map((nome) => {
    const noClaude = pluginsClaude.find((p) => p.nome === nome);
    const noDeepseek = pluginsDeepseek.find((p) => p.nome === nome);
    return `${nome} ${noClaude?.versao ?? '?'} (${noClaude?.commit ?? '?'}, Claude) × ${noDeepseek?.versao ?? '?'} (${noDeepseek?.commit ?? '?'}, DeepSeek)`;
  });
  const modsDivergem = nomesMods.some((nome) => {
    const noClaude = pluginsClaude.find((p) => p.nome === nome);
    const noDeepseek = pluginsDeepseek.find((p) => p.nome === nome);
    return !noClaude || !noDeepseek || noClaude.versao !== noDeepseek.versao || noClaude.commit !== noDeepseek.commit;
  });
  // Só a bibliotecária vai para as contas; os outros agentes da vila rodam pela vila (install-hooks.ts, 24/11/2026).
  const agentesNaConta: string[] = agentesServer.filter((nome) => nome === 'bibliotecaria');
  const faltamClaude = agentesNaConta.filter((nome) => !agentesClaude.includes(nome));
  const faltamDeepseek = agentesNaConta.filter((nome) => !agentesDeepseek.includes(nome));
  const sobram = agentesServer.filter((nome) => !agentesNaConta.includes(nome) && (agentesClaude.includes(nome) || agentesDeepseek.includes(nome)));
  const agentesCompletos = faltamClaude.length === 0 && faltamDeepseek.length === 0 && sobram.length === 0;
  const linhaRoteador = roteadorClaudeTexto && roteadorDeepseekTexto ? primeiraLinhaDiferente(roteadorClaudeTexto, roteadorDeepseekTexto) : null;
  const roteadoresAusentes = !roteadorClaudeTexto && !roteadorDeepseekTexto;
  const roteadoresDiferem = roteadoresAusentes || Boolean(roteadorClaudeTexto) !== Boolean(roteadorDeepseekTexto) || linhaRoteador !== null;
  const totalMemoria = memoriaClaude.arquivos + memoriaDeepseek.arquivos;
  const bytesMemoria = memoriaClaude.bytes + memoriaDeepseek.bytes;

  const camada = (id: Camada['id'], titulo: string, pergunta: string, pecas: Peca[]): Camada => ({ id, titulo, pergunta, pecas });

  const camadas: Camada[] = [
    camada('entrada', 'Entrada', 'O que chega?', [
      peca('prompt-usuario', 'Prompt e correções', 'O pedido do usuário e as correções no meio do caminho. É o que inicia a sessão.', {
        origem: 'pessoal',
        quando: 'evento',
        naVila: 'balão de fala do morador',
        nota: 'O texto não vai para a vila: o mod lê localmente para achar @Nome e manda só ids e categorias.',
        ...somarArquivos([path.join(claude, 'history.jsonl'), path.join(deepseek, 'history.jsonl')]),
      }),
      peca('mod-dev-valley-prompt', 'Mod Dev Valley no prompt', 'Avisa a vila que a sessão recebeu um prompt e resolve as sessões citadas com @Nome.', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'balão e NPCs conversando',
        itens: ['UserPromptSubmit', 'SessionStart', 'PreToolUse', 'PostToolUse', 'Stop', 'SessionEnd', 'session.measure'],
        ...somarArquivos([path.join(repo, 'mod', 'hooks', 'register.ts'), path.join(repo, 'mod', 'hooks', 'moradores.ts')]),
      }),
      peca('at-nome', '@Nome', 'Citação de outro morador; a vila desenha os NPCs conversando e a sessão citada recebe o contexto.', {
        origem: 'maquina',
        quando: 'evento',
        naVila: 'NPCs no pátio',
        itens: [`${moradores} moradores mapeados`, 'o prompt é lido só localmente'],
        ...somarArquivos([moradoresJson, path.join(claude, 'dev-valley', 'nomes.json')]),
      }),
      peca('hooks-shell', 'Hooks de shell', 'PermissionRequest e Notification avisam a vila quando o diálogo de permissão abre ou há notificação; PostToolUse roda shellcheck em .sh.', {
        origem: 'maquina',
        quando: 'evento',
        naVila: 'sino e clínica',
        itens: [...new Set([...(configClaude?.hooks ?? []), ...(configDeepseek?.hooks ?? [])])].sort(),
        ...somarArquivos([path.join(claude, 'settings.json'), path.join(deepseek, 'settings.json')]),
      }),
    ]),
    camada('contexto', 'Contexto', 'O que é lido antes de agir?', [
      peca('roteador', 'Roteador global', 'O CLAUDE.md gerado pelo instalador: diz o que carregar em toda sessão e o que fica indexado para ler sob demanda.', {
        origem: 'universal',
        quando: 'sempre',
        naVila: 'biblioteca',
        itens: [
          `${roteador.imports.length} imports em toda sessão`,
          `${roteador.sobDemanda.length} assuntos sob demanda`,
          'duas cópias geradas: Claude e DeepSeek',
        ],
        ...dadosRoteador,
      }),
      peca('nucleo-guardrails', 'Núcleo de guardrails', 'G1 a G21: o que vale em todo projeto, importado em toda sessão.', {
        origem: 'universal',
        quando: 'sempre',
        naVila: 'outdoor',
        itens: [`${nucleo.guardrails.length} guardrails`, `${nucleo.linhas} linhas`, `${blocosNucleo} blocos`, `teto declarado: ~${PESO_TETO_BLOCOS} blocos / ~${PESO_TETO_LINHAS} linhas`],
        ...dadosNucleo,
      }),
      peca('cnr', 'Convenções da CNR', 'Como o time trabalha com IA: idioma, divisão de trabalho, forma de explicar e regras de texto para terceiros.', {
        origem: 'cnr',
        quando: 'sempre',
        naVila: 'biblioteca',
        itens: ['como-trabalhamos.md (sempre)', 'comunicacao.md e contexto.md (sob demanda)'],
        ...dadosCnr,
      }),
      peca('perfil', 'Perfil pessoal', 'Nível por linguagem, preferências e jeito de explicar. Calibra a resposta e fica fora do git.', {
        origem: 'pessoal',
        quando: 'sempre',
        naVila: 'biblioteca',
        itens: ['sobre-mim.md', 'pasta pessoal não versionada'],
        ...dadosPerfil,
      }),
      peca('claude-projeto', 'Regras do projeto', 'O CLAUDE.md do repositório tem precedência sobre o global; o detalhe por assunto fica em .claude/rules/.', {
        origem: 'projeto',
        quando: 'sempre',
        naVila: 'biblioteca e estante',
        itens: ['10 regras técnicas invioláveis', 'regras de processo e gate de fechamento', ...nomesDe(listar(path.join(repo, '.claude', 'rules')).filter((p) => p.endsWith('.md')))],
        ...dadosProjeto,
      }),
      peca('skills', 'Skills', 'Receitas que o Claude carrega sob demanda: nova regra, auditoria, revisão, roteiro de testes, projeto novo e fluidez.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'fábrica (parede de skills)',
        itens: skills,
        ...dadosSkills,
      }),
      peca('agentes', 'Agentes', 'Subagentes com contexto limpo: revisores, verificador, maestro, bibliotecária, médica e jornaleiro.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'fábrica e NPC ✦',
        itens: [`${agentesClaude.length} em ~/.claude/agents`, `${agentesServer.length} em server/agents`, ...agentesServer],
        ...dadosAgentes,
      }),
      peca('mods', 'Mods e plugins', 'Dois mods locais: guardrails (guardas automáticos) e dev-valley (liga a sessão à vila).', {
        origem: 'maquina',
        quando: 'sempre',
        naVila: 'quadro de força',
        itens: nomesMods.map((nome) => `${nome}: ${pluginsClaude.find((p) => p.nome === nome)?.versao ?? '?'}`),
        ...dadosMods,
      }),
      peca('config', 'Config e permissões', 'O settings.json de cada conta: o que roda sem perguntar, o que pergunta, o que é negado, modelo e hooks.', {
        origem: 'maquina',
        quando: 'sempre',
        naVila: 'quadro de força',
        itens: [
          `Claude: ${configClaude?.allow ?? 0} allow · ${configClaude?.ask ?? 0} ask · ${configClaude?.deny ?? 0} deny`,
          `DeepSeek: ${configDeepseek?.allow ?? 0} allow · ${configDeepseek?.ask ?? 0} ask · ${configDeepseek?.deny ?? 0} deny`,
          `projeto: ${configProjeto?.deny ?? 0} negações (npm start/dev)`,
        ],
        ...dadosConfig,
      }),
    ]),
    camada('acao', 'Ação', 'O que pode fazer?', [
      peca('ferramentas', 'Ferramentas', 'Ler, editar, rodar, buscar, abrir a web e chamar agente. A categoria vai à vila; o nome da ferramenta e o arquivo não.', {
        origem: 'maquina',
        quando: 'evento',
        naVila: 'balão de trabalho do morador',
        itens: ['ler', 'editar', 'rodar', 'web', 'agente'],
      }),
      peca('mod-guardrails', 'Mod guardrails', 'Confere sozinho sete guardrails e pergunta antes do que é irreversível.', {
        origem: 'universal',
        quando: 'evento',
        naVila: 'outdoor',
        itens: nucleo.guardrails.filter((g) => g.cobranca === 'mod').map((g) => `${g.codigo} — ${g.titulo}`),
        ...dadosMods,
      }),
      peca('mod-dev-valley-eventos', 'Mod Dev Valley nos eventos', 'Mantém o estado ao vivo da sessão e manda à vila só ids, evento e categoria de ferramenta.', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'moradores, balões e clínica',
        itens: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'SessionEnd', 'session.measure'],
        ...somarArquivos([path.join(repo, 'mod', 'hooks', 'register.ts'), path.join(repo, 'mod', 'hooks', 'moradores.ts')]),
      }),
      peca('agentes-vila', 'Agentes da vila', 'Consultas por claude -p --no-session-persistence: bibliotecária, administrador, jornaleiro, médica, maestro mirim e crítico do cartão.', {
        origem: 'projeto',
        quando: 'sob-demanda',
        naVila: 'fábrica e NPCs ✦',
        itens: agentesServer,
        ...somarArquivos([...listar(path.join(repo, 'server', 'agents')).filter((p) => p.endsWith('.md')), path.join(repo, 'server', 'src', 'consulta.ts')]),
      }),
      peca('pombal-porao', 'Pombal e porão', 'Git (diff, commit e push por clique) e a rodada de sessões paralelas com gate antes e depois.', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'pombal e porão',
        itens: [`${rodadas} rodadas registradas`, `${relatorios.length} relatórios de rodada`],
        ...somarArquivos([
          path.join(repo, 'server', 'src', 'pombal.ts'),
          path.join(repo, 'server', 'src', 'porao.ts'),
          path.join(repo, 'server', 'src', 'rodada.ts'),
          path.join(repo, 'server', 'src', 'gate.ts'),
        ]),
      }),
      peca('contas', 'Contas Claude e DeepSeek', 'Duas contas com configs separadas; os agentes que só leem respondem na conta DeepSeek.', {
        origem: 'maquina',
        quando: 'sempre',
        naVila: 'moinho e fábrica',
        itens: [
          `Claude: modelo ${configClaude?.modelo ?? 'não declarado'} · modo ${configClaude?.defaultMode ?? 'não declarado'}`,
          `DeepSeek: modelo no env da conta (não lido) · modo ${configDeepseek?.defaultMode ?? 'não declarado'}`,
          ...detalhesMods,
        ],
        ...dadosConfig,
      }),
    ]),
    camada('rastro', 'Rastro', 'O que fica registrado?', [
      peca('progress', 'PROGRESS.md', 'Memória oficial do projeto: uma entrada por entrega, atualizada na mesma resposta (G5).', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'diário da casa',
        itens: [`${progress.linhas ?? 0} linhas`, 'uma entrada por entrega'],
        ...progress,
      }),
      peca('pendencias', 'PENDENCIAS.md', 'Rastreador único do que está aberto, com dono explícito (G6).', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'quadro de bilhetes e sino',
        itens: pendencias.itens.map((item) => `${item.id} · ${item.titulo.length > 140 ? `${item.titulo.slice(0, 137)}...` : item.titulo}`),
        ...somarArquivos([path.join(repo, 'PENDENCIAS.md')]),
      }),
      peca('painel', 'painel.json', 'Plano em andamento e fases; entrega que avança ou fecha fase atualiza na mesma resposta (G14).', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'horta e quadro negro',
        itens: ['fases, entregas e andamento'],
        ...painel,
      }),
      peca('a-codar', 'Planos a codar', 'Decisão fechada e não codada vira documento aqui (G7); ao implementar, sai do índice.', {
        origem: 'projeto',
        quando: 'sob-demanda',
        naVila: 'caixa de sementes',
        itens: planos.map((p) => path.basename(p)),
        ...dadosPlanos,
      }),
      peca('context', 'Documentos de contexto', 'Arquitetura implementada e decisões fechadas, por assunto.', {
        origem: 'projeto',
        quando: 'sob-demanda',
        naVila: 'estante e biblioteca',
        itens: contextos.map((p) => path.basename(p)),
        ...dadosContextos,
      }),
      peca('operacao', 'OPERACAO.md', 'Como subir, derrubar e reiniciar; a tabela "Subir" alimenta a lareira.', {
        origem: 'projeto',
        quando: 'sob-demanda',
        naVila: 'lareira',
        ...operacao,
      }),
      peca('retrabalho', 'RETRABALHO.md', 'Registro do que teve de ser refeito por suposição, invenção ou ferramenta cara à toa (G17).', {
        origem: 'projeto',
        quando: 'evento',
        naVila: 'lixeira',
        ...retrabalho,
      }),
      peca('memoria', 'Memória automática', 'Memória por projeto e por conta, carregada no início da sessão. É a menor camada: o núcleo é regra versionada + rastro.', {
        origem: 'maquina',
        quando: 'sob-demanda',
        naVila: 'biblioteca',
        itens: [
          `Claude: ${memoriaClaude.arquivos} arquivos (${formatarBytes(memoriaClaude.bytes)}) · ${memoriaClaude.nomes.join(', ') || 'vazia'}`,
          `DeepSeek: ${memoriaDeepseek.arquivos} arquivos (${formatarBytes(memoriaDeepseek.bytes)}) · ${memoriaDeepseek.nomes.join(', ') || 'vazia'}`,
        ],
        caminhos: [path.join(claude, 'projects'), path.join(deepseek, 'projects')],
        bytes: bytesMemoria,
      }),
      peca('estado-vila', 'Estado da vila', 'Moradores, nomes, títulos, sessões dormindo, porão e notas do quadro de avisos.', {
        origem: 'maquina',
        quando: 'evento',
        naVila: 'praça, quarto e porão',
        itens: [
          `${moradores} moradores`,
          `${contarChavesJson(path.join(claude, 'dev-valley', 'dormindo.json')) ?? 0} dormindo`,
          `${contarChavesJson(path.join(claude, 'dev-valley', 'notas.json')) ?? 0} notas no quadro`,
        ],
        ...somarArquivos(
          ['moradores.json', 'nomes.json', 'titulos.json', 'dormindo.json', 'porao.json', 'notas.json'].map((nome) => path.join(claude, 'dev-valley', nome)),
        ),
      }),
      peca('historico-sessoes', 'Histórico de sessão', 'Conversas completas gravadas pelo Claude Code, por conta. O mapa só conta arquivos e tamanho.', {
        origem: 'maquina',
        quando: 'evento',
        naVila: 'moradores',
        itens: [`Claude: ${historicoClaude.arquivos} arquivos · ${formatarBytes(historicoClaude.bytes)}`, `DeepSeek: ${historicoDeepseek.arquivos} arquivos · ${formatarBytes(historicoDeepseek.bytes)}`],
        caminhos: [path.join(claude, 'projects'), path.join(deepseek, 'projects')],
        bytes: historicoClaude.bytes + historicoDeepseek.bytes,
      }),
      peca('rodadas', 'Rodadas do maestro', 'Estado de cada rodada: tarefas, arquivos, testes, gate, devolutivas e relatório.', {
        origem: 'maquina',
        quando: 'evento',
        naVila: 'porão',
        itens: rodadasDir.map((p) => path.basename(p)),
        caminhos: [path.join(claude, 'maestro', 'rodadas')],
      }),
    ]),
    camada('aprendizado', 'Aprendizado', 'Como vira regra na próxima?', [
      peca('triagem', 'Triagem de regra nova', 'Passo 0 (procurar antes), orçamento do núcleo, escada checagem-antes-de-prosa e a decisão universal × projeto × memória.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'biblioteca e quadro de avisos',
        ...dadosTriagem,
      }),
      peca('nova-regra', 'Skill /nova-regra', 'Operacionaliza a triagem e escreve a regra no arquivo certo, tentando primeiro virar checagem.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'fábrica',
        ...dadosNovaRegra,
      }),
      peca('checagem', 'Checagem antes de prosa', 'Toda correção pergunta primeiro se dá para virar teste, lint, guarda do mod ou desenho de código; prosa só protege se for lida.', {
        origem: 'universal',
        quando: 'sempre',
        naVila: 'outdoor',
        itens: [`${cobertura.mod} guardrails com cobrança pelo mod`, `${cobertura.teste} com teste/checklist no fluxo`, `${cobertura.julgamento} por julgamento`],
        ...dadosCi,
      }),
      peca('auditoria', 'Auditoria de regras', 'A metade de julgamento (skill /auditar-regras) e a metade mecânica (auditor de referências no CI) conferem o que envelheceu.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'placa de vistoria',
        itens: [`vencimento: ${auditoriaData ?? 'sem data'}`, `${dadosAuditor.linhas ?? 0} linhas no auditor`, 'CI a cada push'],
        ...somarArquivos([
          ...(dadosAuditoriaSkill.caminhos ?? []),
          ...(dadosAuditor.caminhos ?? []),
          path.join(repo, '.claude', 'auditoria-regras.txt'),
        ]),
      }),
      peca('templates', 'Templates de projeto', 'Esqueleto de CLAUDE.md, PROGRESS.md, PENDENCIAS.md, OPERACAO.md e painel.json para projeto novo.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'caixa de sementes',
        itens: templates.map((p) => path.basename(p)),
        ...dadosTemplates,
      }),
      peca('instaladores', 'Instaladores', 'instalar.sh gera o roteador e liga skills/agentes/mods; instalar-projeto.sh leva o auditor ao repositório; hooks:install liga a vila.', {
        origem: 'universal',
        quando: 'evento',
        naVila: 'lareira e fábrica',
        itens: ['instalar.sh', 'instalar-projeto.sh', 'npm run hooks:install'],
        ...dadosInstaladores,
      }),
      peca('revisao', 'Revisão de entrega', 'Revisores em contexto limpo, uma lente cada, com verificador por achado e relatório de uma tela.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'pombal (revisar antes de enviar)',
        ...dadosRevisar,
      }),
      peca('roteiro-testes', 'Roteiro de testes', 'Monta o roteiro de interface para o usuário, tria o resultado colado e gera o reteste até zerar.', {
        origem: 'universal',
        quando: 'sob-demanda',
        naVila: 'banca do jornal',
        ...dadosRoteiro,
      }),
    ]),
  ];

  const totalPecas = camadas.reduce((soma, c) => soma + c.pecas.length, 0);
  const sempre = camadas.reduce((soma, c) => soma + c.pecas.filter((p) => p.quando === 'sempre').length, 0);

  const metricas: Metrica[] = [
    {
      id: 'guardrails',
      rotulo: 'Guardrails no núcleo',
      valor: nucleo.guardrails.length,
      unidade: 'regras',
      detalhe: `${nucleo.linhas} linhas · teto ~${PESO_TETO_LINHAS}`,
      alerta: orcamentoEstourado,
    },
    {
      id: 'checagem',
      rotulo: 'Com cobrança automática',
      valor: cobertura.mod,
      unidade: 'guardrails',
      detalhe: `de ${nucleo.guardrails.length} · ${cobertura.teste} com teste/checklist`,
      alerta: false,
    },
    {
      id: 'pecas',
      rotulo: 'Peças mapeadas',
      valor: totalPecas,
      unidade: 'peças',
      detalhe: `${sempre} carregam sempre`,
      alerta: false,
    },
    {
      id: 'memoria',
      rotulo: 'Memória automática',
      valor: totalMemoria,
      unidade: 'arquivos',
      detalhe: `${formatarBytes(bytesMemoria)} nas duas contas`,
      alerta: false,
    },
    {
      id: 'pendencias',
      rotulo: 'Pendências abertas',
      valor: pendencias.total,
      unidade: 'itens',
      detalhe: `👤 ${pendencias.porDono.usuario} · 💻 ${pendencias.porDono.codigo} · 🖥️ ${pendencias.porDono.servidor}`,
      alerta: false,
    },
    {
      id: 'auditoria',
      rotulo: 'Até a auditoria',
      valor: vencida ? 0 : (dias ?? 0),
      unidade: 'dias',
      detalhe: auditoriaData ? dataBr(auditoriaData) : 'sem data de vencimento',
      alerta: vencida || auditoriaData === null,
    },
    {
      id: 'skills',
      rotulo: 'Skills disponíveis',
      valor: skills.length,
      unidade: 'skills',
      detalhe: 'globais e do repositório de regras',
      alerta: false,
    },
    {
      id: 'sessoes',
      rotulo: 'Moradores mapeados',
      valor: moradores,
      unidade: 'sessões',
      detalhe: `${rodadas} rodadas do maestro`,
      alerta: false,
    },
  ];

  const sinais: Sinal[] = [
    {
      id: 'orcamento',
      rotulo: 'Orçamento do núcleo',
      valor: `${nucleo.guardrails.length} regras · ${nucleo.linhas} linhas`,
      detalhe: orcamentoEstourado
        ? `Teto declarado: ~${PESO_TETO_BLOCOS} blocos / ~${PESO_TETO_LINHAS} linhas. Acima do teto: consolidar, não acrescentar.`
        : `Dentro do teto de ~${PESO_TETO_BLOCOS} blocos / ~${PESO_TETO_LINHAS} linhas.`,
      prova: path.join(ia, 'guardrails-ia', 'guardrails-core.md'),
      alerta: orcamentoEstourado,
    },
    {
      id: 'auditoria',
      rotulo: 'Auditoria de julgamento',
      valor: auditoriaData ? dataBr(auditoriaData) : 'sem data',
      detalhe: auditoriaData
        ? vencida
          ? `Vencida há ${Math.abs(dias ?? 0)} dias. Rodar /auditar-regras e reagendar.`
          : `Faltam ${dias} dias. A skill reagenda quando rodar.`
        : 'Arquivo .claude/auditoria-regras.txt ausente ou sem data.',
      prova: path.join(repo, '.claude', 'auditoria-regras.txt'),
      alerta: vencida || auditoriaData === null,
    },
    {
      id: 'cobertura',
      rotulo: 'Cobertura automática',
      valor: `${cobertura.mod} de ${nucleo.guardrails.length}`,
      detalhe: `${cobertura.teste} com teste/checklist no fluxo · ${cobertura.julgamento} só por julgamento.`,
      prova: path.join(ia, 'guardrails-ia', 'guardrails-core.md'),
      alerta: false,
    },
    {
      id: 'contas',
      rotulo: 'Contas e mods',
      valor: modsDivergem ? 'divergem' : 'iguais',
      detalhe: detalhesMods.join(' · ') || 'nenhum plugin instalado encontrado',
      prova: path.join(claude, 'plugins', 'installed_plugins.json'),
      alerta: modsDivergem,
    },
    {
      id: 'agentes-instalados',
      rotulo: 'Agentes da vila instalados',
      valor: agentesCompletos ? 'só a bibliotecária' : `faltam ${new Set([...faltamClaude, ...faltamDeepseek]).size} · sobram ${sobram.length}`,
      detalhe:
        agentesServer.length === 0
          ? 'Não encontrei agentes em server/agents; o mapa saiu sem a comparação.'
          : agentesCompletos
            ? 'A bibliotecária está nas duas contas; os outros agentes rodam só pela vila.'
            : `${[
                faltamClaude.length + faltamDeepseek.length ? `Faltam: ${[...new Set([...faltamClaude, ...faltamDeepseek])].join(', ')}` : '',
                sobram.length ? `Sobram cópias antigas: ${sobram.join(', ')}` : '',
              ]
                .filter(Boolean)
                .join('. ')}. Rodar npm run hooks:install.`,
      prova: path.join(claude, 'agents'),
      alerta: agentesServer.length === 0 || !agentesCompletos,
    },
    {
      id: 'roteadores',
      rotulo: 'Cópias do roteador',
      valor: roteadoresAusentes ? 'ausentes' : roteadoresDiferem ? 'diferentes' : 'iguais',
      detalhe: roteadoresAusentes
        ? 'Não encontrei nenhuma das duas cópias do roteador.'
        : roteadoresDiferem
          ? linhaRoteador
            ? `Claude e DeepSeek divergem na linha ${linhaRoteador}. Rodar o instalar.sh de novo iguala as cópias.`
            : 'Uma das cópias do roteador está ausente.'
          : 'As duas contas leem o mesmo roteador.',
      prova: path.join(claude, 'CLAUDE.md'),
      alerta: roteadoresDiferem,
    },
    {
      id: 'memoria',
      rotulo: 'Memória automática',
      valor: `${totalMemoria} arquivos`,
      detalhe: `Claude ${memoriaClaude.arquivos} · DeepSeek ${memoriaDeepseek.arquivos}. É a menor camada: o núcleo é regra versionada + rastro.`,
      prova: path.join(claude, 'projects'),
      alerta: false,
    },
  ];

  const fluxos = [
    {
      id: 'abrir-sessao',
      titulo: 'Abrir uma sessão',
      passos: [
        'O prompt chega e o mod do Dev Valley lê @Nome só localmente.',
        'O CLAUDE.md global importa núcleo, convenções da CNR e perfil.',
        'O CLAUDE.md do projeto tem precedência e aponta as regras por assunto.',
        'Skills e agentes entram sob demanda; as ferramentas agem.',
      ],
      pecas: ['prompt-usuario', 'mod-dev-valley-prompt', 'roteador', 'nucleo-guardrails', 'cnr', 'perfil', 'claude-projeto', 'ferramentas'],
    },
    {
      id: 'fazer-entrega',
      titulo: 'Fazer uma entrega',
      passos: [
        'A spec manda (G1); ambiguidade que muda código para e pergunta (G2).',
        'Antes de mexer a suíte roda; depois, roda de novo (G4).',
        'A entrega deixa rastro no PROGRESS.md e, se avançou fase, no painel.json.',
        'O gate fecha com teste, typecheck, build e auditoria; o sino espera a conferência.',
      ],
      pecas: ['nucleo-guardrails', 'progress', 'painel', 'ferramentas', 'checagem', 'pendencias'],
    },
    {
      id: 'aprender-correcao',
      titulo: 'Aprender uma correção',
      passos: [
        'O usuário corrige; a primeira pergunta é se dá para virar checagem.',
        'O Passo 0 procura antes de escrever: regra em cima de regra apodrece.',
        'O que exige julgamento vira prosa com escopo, no arquivo certo.',
        'A auditoria e o CI conferem referências e o orçamento do núcleo.',
      ],
      pecas: ['triagem', 'nova-regra', 'checagem', 'auditoria', 'nucleo-guardrails'],
    },
    {
      id: 'sessao-na-vila',
      titulo: 'Uma sessão na vila',
      passos: [
        'O terminal roda num node-pty no servidor local.',
        'O mod manda eventos, ids e categorias; nunca o texto.',
        'O WebSocket atualiza a cena; cada prédio mostra uma peça.',
        'O pombal, o porão e o sino fecham o ciclo.',
      ],
      pecas: ['mod-dev-valley-eventos', 'ferramentas', 'estado-vila', 'pombal-porao', 'progress', 'pendencias'],
    },
  ];

  const vila: VilaItem[] = [
    { peca: 'Casa', mecanismo: 'um projeto', detalhe: 'pasta em projectRoots; o interior reúne todas as sessões' },
    { peca: 'Morador', mecanismo: 'uma sessão do Claude Code', detalhe: 'nome, balão e estado vêm dos eventos do mod' },
    { peca: 'Biblioteca', mecanismo: 'CLAUDE.md, memórias e docs', detalhe: 'leitor, edição e busca por projeto' },
    { peca: 'Estante', mecanismo: 'leitor restrito ao projeto', detalhe: 'a mesma biblioteca filtrada para a casa' },
    { peca: 'Fábrica', mecanismo: 'agentes, skills e plugins/MCP', detalhe: 'criar, editar e apagar; por conta' },
    { peca: 'Outdoor', mecanismo: 'mod guardrails e lista de regras', detalhe: 'o canário guardrails ✓ na status line' },
    { peca: 'Sino', mecanismo: 'entregas e pendências', detalhe: 'lê a frase "Falta conferir na vila"' },
    { peca: 'Quadro de avisos', mecanismo: 'notas do usuário', detalhe: 'notas.json da praça' },
    { peca: 'Moinho', mecanismo: 'gasto de tokens e limites', detalhe: 'por projeto e por conta' },
    { peca: 'Pombal', mecanismo: 'git local e enviado', detalhe: 'diff, commit e push por clique' },
    { peca: 'Porão', mecanismo: 'rodada do maestro', detalhe: 'sessões paralelas, gate e relatório' },
    { peca: 'Clínica', mecanismo: 'triagem de sessões lentas', detalhe: 'a médica Dra. Lia só lê' },
    { peca: 'Banca', mecanismo: 'jornal e Gazeta', detalhe: 'o que mudou nos projetos pelos commits' },
    { peca: 'Lareira', mecanismo: 'tabela "Subir" do OPERACAO.md', detalhe: 'sobe e derruba back e front' },
    { peca: 'Lixeira', mecanismo: 'RETRABALHO.md', detalhe: 'uma bolinha por linha, sem IA' },
    { peca: 'Caixa de sementes', mecanismo: 'docs-dev/a-codar/', detalhe: 'uma semente por plano' },
    { peca: 'Escrivaninha', mecanismo: 'painel do projeto', detalhe: 'nova sessão, VS Code, pombal e dormir' },
    { peca: 'Quarto', mecanismo: 'sessões dormindo', detalhe: 'acordam com claude --resume' },
  ];

  const avisos: string[] = [
    'As contas DeepSeek usam o mesmo CLAUDE.md, skills e agentes do ~/.claude, por link; plugins e config são de cada conta.',
    'A memória automática é a menor camada; o que a IA "sabe" de verdade está nas regras versionadas e nos rastros.',
  ];
  if (!nucleo.guardrails.length) avisos.push('Não encontrei o guardrails-core.md em ~/Documents/IA; a tabela de guardrails saiu vazia.');
  if (!roteador.imports.length) avisos.push('Não encontrei o roteador global em ~/.claude/CLAUDE.md nem em ~/.claude-deepseek/CLAUDE.md.');

  return {
    versao: 1,
    geradoEm: agora,
    metricas,
    camadas,
    guardrails: nucleo.guardrails,
    fluxos,
    sinais,
    vila,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// CLI

function agoraLocalIso(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 19);
}

function principal(): void {
  const argumentos = process.argv.slice(2);
  const resumo = argumentos.includes('--resumo');
  const somenteApresentacao = argumentos.includes('--apresentacao');
  const home = os.homedir();
  const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const agora = agoraLocalIso();
  const ecossistema = coletarEcossistema({ home, repo, agora });

  if (resumo) {
    const porCamada = ecossistema.camadas.map((c) => `${c.titulo} ${c.pecas.length}`).join(' · ');
    const mod = ecossistema.guardrails.filter((g) => g.cobranca === 'mod').length;
    const pend = ecossistema.metricas.find((m) => m.id === 'pendencias');
    const memoria = ecossistema.metricas.find((m) => m.id === 'memoria');
    console.log(`camadas: ${porCamada}`);
    console.log(`guardrails: ${ecossistema.guardrails.length} (${mod} com mod)`);
    console.log(`pendências: ${pend?.valor ?? 0} (${pend?.detalhe ?? ''})`);
    console.log(`memória: ${memoria?.valor ?? 0} arquivos`);
    console.log(`sinais em alerta: ${ecossistema.sinais.filter((s) => s.alerta).map((s) => s.rotulo).join(' · ') || 'nenhum'}`);
    return;
  }

  const pasta = path.join(repo, 'docs-dev', 'ecossistema');
  fs.mkdirSync(pasta, { recursive: true });
  const arquivoAnalise = path.join(pasta, 'ecossistema.html');
  const arquivoApresentacao = path.join(pasta, 'ecossistema-apresentacao.html');

  if (!somenteApresentacao) {
    fs.writeFileSync(arquivoAnalise, montarHtml(ecossistema, { apresentacao: false }));
  }

  const mascara = criarMascara({ home, usuario: path.basename(home), projetos: nomesDeProjeto(repo, home) });
  const apresentacao = prepararParaApresentacao(ecossistema, mascara);
  fs.writeFileSync(arquivoApresentacao, montarHtml(apresentacao, { apresentacao: true }));

  const link = (arquivo: string) => `http://localhost:4777/api/arquivo?path=${encodeURI(arquivo)}`;
  if (!somenteApresentacao) {
    console.log(`análise:      ${arquivoAnalise}`);
    console.log(`abrir:        ${link(arquivoAnalise)}`);
  }
  console.log(`apresentação: ${arquivoApresentacao}`);
  console.log(`abrir:        ${link(arquivoApresentacao)}`);
}

const invocadoDiretamente = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invocadoDiretamente) principal();
