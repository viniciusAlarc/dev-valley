import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface FileChange {
  path: string;
  /** Código de 2 letras do `git status --porcelain` (ex.: " M", "??", "A "). */
  status: string;
}

const MAX_DIFF_BYTES = 1024 * 1024;

/**
 * `network`: fetch/push. O git nunca pergunta senha no terminal (a vila não tem um para responder) e desiste em
 * 2 minutos, em vez de deixar o servidor esperando para sempre.
 */
export function git(cwd: string, args: string[], opts: { network?: boolean } = {}): Promise<string> {
  const net = opts.network ? { timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } } : {};
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 32 * 1024 * 1024, ...net }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout);
    });
  });
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

export async function branch(cwd: string): Promise<string> {
  try {
    return (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  } catch {
    return '(sem commits)';
  }
}

export async function remoteUrl(cwd: string): Promise<string | null> {
  try {
    return (await git(cwd, ['remote', 'get-url', 'origin'])).trim() || null;
  } catch {
    return null;
  }
}

export async function changes(cwd: string): Promise<FileChange[]> {
  const out = await git(cwd, ['status', '--porcelain=v1', '-z', '-uall']);
  const entries = out.split('\0').filter(Boolean);
  const result: FileChange[] = [];
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i].slice(0, 2);
    result.push({ status, path: entries[i].slice(3) });
    // Em renomeações o -z coloca o caminho de origem como entrada seguinte.
    if (status[0] === 'R' || status[0] === 'C') i++;
  }
  return result;
}

async function readCapped(file: string): Promise<string> {
  try {
    const stat = await fs.stat(file);
    if (stat.size > MAX_DIFF_BYTES) return `(arquivo grande demais para exibir: ${stat.size} bytes)`;
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

export async function fileDiff(cwd: string, file: string): Promise<{ original: string; modified: string }> {
  let original = '';
  try {
    original = await git(cwd, ['show', `HEAD:${file}`]);
  } catch {
    // arquivo novo ou repositório sem commits
  }
  const modified = await readCapped(path.join(cwd, file));
  return { original, modified };
}

export async function commit(cwd: string, message: string, files: string[]): Promise<string> {
  if (files.length) await git(cwd, ['add', '-A', '--', ...files]);
  else await git(cwd, ['add', '-A']);
  return git(cwd, ['commit', '-m', message]);
}
