// Regra 1 do CLAUDE.md cobrada pelo git: este repositório é público, e nome de projeto da vila ou caminho pessoal
// nunca entra em arquivo nem em mensagem de commit. Os nomes vêm das pastas em `projectRoots` e `extraProjects` do
// config (o local, ignorado pelo git, inclusive), então só dá para conferir nesta máquina: hooks `pre-commit` e
// `commit-msg` em `.githooks/` (ligados pelo `npm install`, script `prepare`). Roda com o Node puro (tipos removidos).
//
//   node scripts/conferir-publico.mts --staged          linhas acrescentadas no que vai para o commit
//   node scripts/conferir-publico.mts --mensagem <arq>  a mensagem do commit
//   node scripts/conferir-publico.mts --tudo            todos os arquivos rastreados (varredura)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface Achado {
  onde: string;
  termo: string;
}

// Nome de pasta que também é palavra comum ("infra", "docs") não dá para cobrar sem falso positivo: só entra nome
// com cara de identificador (tem _, -, número ou maiúscula) e os pedaços dele que também têm, com 5+ letras.
export function termosPrivados(pastas: string[], proprio: string): string[] {
  const identificador = (t: string) => t.length >= 5 && /[_\-0-9A-Z]/.test(t);
  const termos = new Set<string>();
  for (const nome of pastas) {
    if (nome === proprio || nome.startsWith('.')) continue;
    if (identificador(nome)) termos.add(nome);
    for (const pedaco of nome.split(/[_\-]/)) if (identificador(pedaco)) termos.add(pedaco);
  }
  return [...termos].sort((a, b) => b.length - a.length);
}

export function procurar(texto: string, termos: string[], usuario: string, onde: (linha: number) => string): Achado[] {
  const achados: Achado[] = [];
  const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const padroes = termos.map((t) => ({ termo: t, re: new RegExp(`(^|[^A-Za-z0-9])${escapar(t)}($|[^A-Za-z0-9])`, 'i') }));
  const caminho = new RegExp(`(/home/|\\\\home\\\\|/Users/|\\\\Users\\\\)${escapar(usuario)}([/\\\\]|$)`, 'i');
  texto.split('\n').forEach((linha, i) => {
    const p = padroes.find(({ re }) => re.test(linha));
    if (p) achados.push({ onde: onde(i + 1), termo: p.termo });
    else if (caminho.test(linha)) achados.push({ onde: onde(i + 1), termo: `caminho pessoal (${usuario})` });
  });
  return achados;
}

// Linhas acrescentadas do diff (`git diff -U0`), com o arquivo e a linha nova de cada uma.
export function linhasAcrescentadas(diff: string): { arquivo: string; linha: number; texto: string }[] {
  const saida: { arquivo: string; linha: number; texto: string }[] = [];
  let arquivo = '';
  let linha = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) arquivo = l.replace(/^\+\+\+ (b\/)?/, '');
    else if (l.startsWith('@@')) linha = Number(/\+(\d+)/.exec(l)?.[1] ?? 0);
    else if (l.startsWith('+')) saida.push({ arquivo, linha: linha++, texto: l.slice(1) });
  }
  return saida;
}

function pastasDosProjetos(raiz: string): string[] {
  const ler = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {});
  const base = ler(path.join(raiz, 'dev-valley.config.json'));
  const local = ler(path.join(raiz, 'dev-valley.config.local.json'));
  const til = (p: string) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);
  const raizes: string[] = (local.projectRoots ?? base.projectRoots ?? []).map(til);
  const extras: string[] = (local.extraProjects ?? base.extraProjects ?? []).map(til);
  const nomes = extras.map((p) => path.basename(p));
  for (const r of raizes) {
    if (!existsSync(r)) continue;
    for (const n of readdirSync(r)) if (statSync(path.join(r, n), { throwIfNoEntry: false })?.isDirectory()) nomes.push(n);
  }
  return nomes;
}

function principal(argv: string[]): number {
  const raiz = execFileSync('git', ['rev-parse', '--show-toplevel']).toString().trim();
  const termos = termosPrivados(pastasDosProjetos(raiz), path.basename(raiz));
  const usuario = os.userInfo().username;
  let achados: Achado[] = [];
  if (argv[0] === '--mensagem' && argv[1]) {
    const msg = readFileSync(argv[1], 'utf8').split('\n').filter((l) => !l.startsWith('#')).join('\n');
    achados = procurar(msg, termos, usuario, (n) => `mensagem do commit, linha ${n}`);
  } else if (argv[0] === '--tudo') {
    const arquivos = execFileSync('git', ['-C', raiz, 'ls-files']).toString().split('\n').filter(Boolean);
    for (const a of arquivos) {
      const f = path.join(raiz, a);
      if (!existsSync(f) || statSync(f).size > 2_000_000) continue;
      achados.push(...procurar(readFileSync(f, 'utf8'), termos, usuario, (n) => `${a}:${n}`));
    }
  } else {
    const diff = execFileSync('git', ['-C', raiz, 'diff', '--cached', '-U0', '--no-color', '--no-ext-diff']).toString();
    for (const l of linhasAcrescentadas(diff)) achados.push(...procurar(l.texto, termos, usuario, () => `${l.arquivo}:${l.linha}`));
  }
  if (!achados.length) return 0;
  console.error('Repositório público (CLAUDE.md, regra 1): nome de projeto da vila ou caminho pessoal não entra aqui.');
  for (const a of achados.slice(0, 20)) console.error(`  ${a.onde}: ${a.termo}`);
  console.error('Troque por um nome genérico (ex.: "projeto-exemplo", "~/projetos") ou mova o caminho para o');
  console.error('dev-valley.config.local.json. Nada foi commitado.');
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(principal(process.argv.slice(2)));
