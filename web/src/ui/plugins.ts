import { plugins, type McpInfo, type PluginInfo } from '../api';
import { escapeHtml, openPanel } from './panel';

const PERFIL = { profissional: 'Perfil do trabalho (Claude)', pessoal: 'Perfil pessoal (DeepSeek)' } as const;

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "2 skills, 1 comando e hooks": o que o plugin traz, em português corrido. */
export function trazTexto(t: PluginInfo['traz']): string {
  const partes = [
    t.skills && plural(t.skills, 'skill', 'skills'),
    t.comandos && plural(t.comandos, 'comando', 'comandos'),
    t.agentes && plural(t.agentes, 'agente', 'agentes'),
    t.hooks && 'hooks (reage a eventos da sessão)',
    t.mcp.length && plural(t.mcp.length, 'servidor MCP', 'servidores MCP'),
  ].filter(Boolean) as string[];
  if (!partes.length) return 'nada que a vila reconheça';
  return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
}

function pluginRow(p: PluginInfo) {
  const quando = p.installedAt ? ` · instalado em ${new Date(p.installedAt).toLocaleDateString('pt-BR')}` : '';
  return `
    <li>
      <span class="ctx-pill ${p.enabled ? '' : 'critical'}">${p.enabled ? 'ligado' : 'desligado'}</span>
      <span class="pend-item"><b>${escapeHtml(p.name)}</b>${p.version ? ` <span class="muted">v${escapeHtml(p.version)}</span>` : ''}
        ${p.description ? `<br>${escapeHtml(p.description)}` : ''}
        <br><span class="muted">Traz ${escapeHtml(trazTexto(p.traz))} · da loja ${escapeHtml(p.marketplace)}${quando}</span></span>
    </li>`;
}

function mcpRow(m: McpInfo) {
  return `<li><b class="pend-id">${escapeHtml(m.name)}</b><span class="pend-item">${escapeHtml(m.onde === 'global' ? 'em todos os projetos' : `no projeto ${m.onde}`)} <span class="muted">· ${escapeHtml(m.type)}</span></span></li>`;
}

/**
 * Quadro de força da Fábrica (02/11/2026): plugins e servidores MCP dos dois perfis, só leitura. Para ligar ou
 * desligar um plugin, `/plugin` numa sessão do Claude Code.
 */
export async function openPlugins() {
  const panel = openPanel({ title: 'Quadro de força', subtitle: 'Plugins e servidores MCP do Claude Code · só leitura', size: 'lg', scroll: true });
  panel.body.innerHTML = '<p class="muted">Lendo…</p>';
  let view: Awaited<ReturnType<typeof plugins.list>>;
  try {
    view = await plugins.list();
  } catch (err) {
    panel.body.innerHTML = `<p class="empty error">Não deu para ler os plugins: ${escapeHtml(String(err))}</p>`;
    return;
  }
  const perfis = (['profissional', 'pessoal'] as const).filter((p) => view.plugins.some((x) => x.perfil === p));
  const secoes = perfis.map(
    (perfil) => `
      <h3>${PERFIL[perfil]}</h3>
      <ul class="session-list pend-list">${view.plugins.filter((p) => p.perfil === perfil).map(pluginRow).join('')}</ul>`,
  );
  panel.body.innerHTML = `
    <p class="muted">Plugin muda o que o Claude Code faz em toda sessão do perfil. Para ligar ou desligar, use <code>/plugin</code>
    numa sessão; aqui é só para ver.</p>
    ${secoes.join('') || '<p class="empty">Nenhum plugin instalado.</p>'}
    <h3>Servidores MCP</h3>
    ${
      view.mcp.length
        ? `<ul class="session-list pend-list">${view.mcp.map(mcpRow).join('')}</ul>`
        : '<p class="empty">Nenhum servidor MCP configurado nos arquivos.</p>'
    }
    <p class="muted">Conectores do claude.ai (como o Claude Docs) vêm da sua conta e não ficam em arquivo, por isso não
    aparecem aqui.</p>`;
}
