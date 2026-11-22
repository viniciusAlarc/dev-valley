import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { CONTA_CLAUDE, type Conta } from '../src/config.js';
import { Plugins } from '../src/plugins.js';
import type { Project } from '../src/world.js';
import { subir } from './servidor.js';
import { projeto } from './util.js';

// Plugins e MCP na Fábrica (02/11/2026): só leitura, uma seção por conta, e nunca o comando/URL/variáveis do MCP (G13).
const j = (v: unknown) => JSON.stringify(v);

async function cenario() {
  const home = await projeto({
    '.claude/settings.json': j({ enabledPlugins: { 'ligado@loja': true, 'desligado@loja': false } }),
    '.claude/plugins/installed_plugins.json': j({
      version: 2,
      plugins: {
        'ligado@loja': [{ scope: 'user', installPath: 'PLUGIN_LIGADO', version: '1.2.0', installedAt: '2026-10-01T00:00:00Z' }],
        'desligado@loja': [{ scope: 'user', installPath: 'NAO_EXISTE', version: '0.1.0' }],
      },
    }),
    '.claude.json': j({ mcpServers: { banco: { type: 'stdio', command: 'npx', args: ['--token', 'SEGREDO'] } } }),
  });
  const plugin = await projeto({
    '.claude-plugin/plugin.json': j({ name: 'ligado', description: 'Faz coisas' }),
    'skills/uma/SKILL.md': '---\nname: uma\n---\n',
    'skills/duas/SKILL.md': '---\nname: duas\n---\n',
    'commands/oi.md': 'oi',
    'hooks/hooks.json': '{}',
    '.mcp.json': j({ mcpServers: { busca: { type: 'http', url: 'https://x.invalid/?key=SEGREDO' } } }),
  });
  const installed = path.join(home, '.claude/plugins/installed_plugins.json');
  const fs = await import('node:fs/promises');
  await fs.writeFile(installed, (await fs.readFile(installed, 'utf8')).replace('PLUGIN_LIGADO', plugin));
  const pessoal = await projeto({
    'settings.json': j({ enabledPlugins: { 'ligado@loja': true } }),
    'plugins/installed_plugins.json': j({ version: 2, plugins: { 'ligado@loja': [{ scope: 'user', installPath: plugin, version: '1.2.0' }] } }),
  });
  const extra = await projeto({
    '.claude.json': j({ mcpServers: { outro: { type: 'http' } } }),
    'settings.json': j({ enabledPlugins: { 'ligado@loja': true } }),
    'plugins/installed_plugins.json': j({ version: 2, plugins: { 'ligado@loja': [{ scope: 'user', installPath: plugin, version: '1.2.0' }] } }),
  });
  const repo = await projeto({ '.mcp.json': j({ mcpServers: { docs: { command: 'node', env: { API_KEY: 'SEGREDO' } } } }) });
  const projects = [{ id: 'p', name: 'repo', path: repo } as Project];
  const contas: Conta[] = [
    { ...CONTA_CLAUDE, configDir: path.join(home, '.claude') },
    { nome: 'DeepSeek pessoal', provedor: 'deepseek', configDir: pessoal, roots: [], finalidade: 'pessoal' },
    { nome: 'DeepSeek trabalho', provedor: 'deepseek', configDir: extra, roots: [], finalidade: 'trabalho' },
  ];
  return new Plugins({ contas }, () => projects, home);
}

describe('plugins e MCP na Fábrica', () => {
  test('lista os plugins de cada conta, ligados primeiro, com o que cada um traz', async () => {
    const { plugins } = await (await cenario()).list();
    assert.deepEqual(
      plugins.map((p) => [p.id, p.conta.nome, p.enabled]),
      [
        ['ligado@loja', 'Claude', true],
        ['ligado@loja', 'DeepSeek pessoal', true],
        ['ligado@loja', 'DeepSeek trabalho', true],
        ['desligado@loja', 'Claude', false],
      ],
    );
    const ligado = plugins[0]!;
    assert.equal(ligado.description, 'Faz coisas');
    assert.equal(ligado.version, '1.2.0');
    assert.deepEqual(ligado.traz, { skills: 2, comandos: 1, agentes: 0, hooks: true, mcp: ['busca'] });
    assert.deepEqual(plugins[3]!.traz, { skills: 0, comandos: 0, agentes: 0, hooks: false, mcp: [] }, 'pasta sumida não quebra');
  });

  test('MCP: global e do repositório, só nome, tipo e onde; nunca comando, URL ou variável', async () => {
    const view = await (await cenario()).list();
    const claude = { nome: 'Claude', provedor: 'claude', finalidade: 'trabalho' };
    assert.deepEqual(view.mcp, [
      { name: 'banco', type: 'stdio', conta: claude, onde: 'global' },
      { name: 'outro', type: 'http', conta: { nome: 'DeepSeek trabalho', provedor: 'deepseek', finalidade: 'trabalho' }, onde: 'global' },
      { name: 'docs', type: 'stdio', conta: claude, onde: 'repo' },
    ]);
    assert.ok(!j(view).includes('SEGREDO'));
  });

  test('conta sem arquivo nenhum: listas vazias, sem erro', async () => {
    const vazio = await projeto();
    assert.deepEqual(await new Plugins({ contas: [] }, () => [], vazio).list(), { plugins: [], mcp: [] });
  });

  test('rota GET /api/plugins entrega a lista', async () => {
    const s = await subir({}, { plugins: await cenario() });
    const r = await s.get('/api/plugins');
    assert.equal(r.status, 200);
    assert.equal(((await r.json()) as { plugins: unknown[] }).plugins.length, 4);
  });
});
