import { api, CONTEXT_CRITICAL, CONTEXT_WARN, getWorld, type Armario, type Esquecido, type Paciente, type Triagem } from '../api';
import { openMedica } from './librarian';
import { button, escapeHtml, openPanel } from './panel';

/**
 * Clínica (decisão do usuário, 09/11/2026), no lote da antiga torre do relógio. Maca de triagem: os moradores vivos e o
 * que cada um roda agora, com o botão de chamar a médica; lê `/api/clinica` na hora em que abre. O monitor de sinais
 * vitais saiu em 10/11/2026 (decisão do usuário): limites e máquina ficam no canto da tela (`limitesHud.ts`).
 */

type Sev = 'normal' | 'warning' | 'critical';
const nivel = (valor: number, aviso: number, critico: number): Sev => (valor >= critico ? 'critical' : valor >= aviso ? 'warning' : 'normal');

/** "12 min", "1 h 05 min", "40 s". */
export function duracao(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

const ESTADO: Record<string, [string, Sev]> = {
  permission: ['❗ esperando permissão', 'critical'],
  working: ['trabalhando', 'normal'],
  idle: ['parado, esperando você', 'normal'],
};

/** Uma linha da maca: quem, estado, há quanto tempo, contexto e o comando que roda agora. */
export function linhaDoPaciente(p: Paciente, projeto: string, agora = Date.now()): string {
  const [estado, sev] = p.status ? ESTADO[p.status] ?? [p.status, 'normal'] : ['sem hooks', 'warning'];
  const tempo = p.trabalhandoDesde ? ` há ${duracao((agora - p.trabalhandoDesde) / 1000)}` : '';
  const ctx = p.contexto === null ? '' : `<span class="ctx-pill ${nivel(p.contexto, CONTEXT_WARN, CONTEXT_CRITICAL)}" title="Janela de contexto usada">${p.contexto}%</span>`;
  const comandos = p.processo
    ? p.comandos.length
      ? p.comandos
          .map((c) => `<li><code>${escapeHtml(c.comando)}</code> <span class="muted">· ${duracao(c.idadeS)} · CPU ${c.cpu}%</span></li>`)
          .join('')
      : '<li class="muted">Nenhum comando rodando agora.</li>'
    : `<li class="muted">${p.inTown ? 'Processo não encontrado.' : 'Aberto fora da vila: a médica vê a conversa, mas não os comandos.'}</li>`;
  return `
    <b>${escapeHtml(p.name)}</b>
    <span class="session-title">${escapeHtml(projeto)}</span>
    ${ctx}
    <span class="ctx-pill ${sev}">${escapeHtml(estado + tempo)}</span>
    <ul class="usage-reset gasto-sessoes">${comandos}</ul>`;
}

/** Maca de triagem: os moradores vivos; o botão de cada um chama a médica. */
export async function openTriagem() {
  const panel = openPanel({ title: 'Triagem', subtitle: 'Os moradores vivos agora. Escolha quem a médica examina.', size: 'lg', scroll: true });
  panel.body.innerHTML = '<p class="usage-empty">Medindo os pacientes…</p>';
  let t: Triagem;
  try {
    t = await api.clinica();
  } catch (err) {
    if (panel.body.isConnected) panel.body.innerHTML = `<p class="empty">Não consegui medir: ${escapeHtml((err as Error).message)}</p>`;
    return;
  }
  if (!panel.body.isConnected) return;
  const w = getWorld();
  const projeto = (id: string | null) => w.projects.find((x) => x.id === id)?.name ?? 'praça';
  // Quem precisa de atenção primeiro: permissão, depois quem trabalha há mais tempo.
  const ordem = [...t.pacientes].sort(
    (a, b) => Number(b.status === 'permission') - Number(a.status === 'permission') || (a.trabalhandoDesde || Infinity) - (b.trabalhandoDesde || Infinity),
  );
  if (!ordem.length) {
    panel.body.innerHTML = '<p class="empty">Nenhum morador vivo agora: ninguém para examinar.</p>';
    return;
  }
  panel.body.innerHTML = '<ul class="session-list clinica-triagem"></ul>';
  const lista = panel.body.querySelector('ul')!;
  for (const p of ordem) {
    const li = document.createElement('li');
    li.innerHTML = linhaDoPaciente(p, projeto(p.projectId));
    const s = w.sessions.find((x) => x.id === p.id);
    if (s) li.insertBefore(button('🩺 Examinar', () => openMedica(s), 'primary'), li.querySelector('ul'));
    lista.append(li);
  }
}

function itemEsquecido(e: Esquecido, tipo: 'claude' | 'servidor'): string {
  const quem = e.morador ? `provavelmente ${escapeHtml(e.morador)}, aberto fora da vila` : tipo === 'claude' ? 'nenhum morador vivo nessa pasta' : '';
  const detalhes = [
    e.portas.length ? `porta ${e.portas.join(', ')}` : '',
    `rodando há ${duracao(e.idadeS)}`,
    `${e.memMb} MB de memória`,
    quem,
  ].filter(Boolean);
  return `
    <li>
      <code>${escapeHtml(e.comando)}</code>
      <div class="usage-reset">${detalhes.join(' · ')}${e.pasta ? `<br>em <code>${escapeHtml(e.pasta)}</code>` : ''}</div>
      <div class="usage-reset">Para encerrar, no terminal: <code>kill ${e.pid}</code></div>
    </li>`;
}

/** O conteúdo do armário, sem rede: separado para teste. */
export function conteudoDoArmario(a: Armario): string {
  const secao = (titulo: string, explica: string, itens: string[], vazio: string) => `
    <h3>${titulo}</h3>
    <p class="usage-empty">${explica}</p>
    ${itens.length ? `<ul class="clinica-armario">${itens.join('')}</ul>` : `<p class="empty">${vazio}</p>`}`;
  const containers = a.containers
    ? a.containers.map(
        (c) => `
        <li>
          <b>${escapeHtml(c.nome)}</b> <span class="muted">${escapeHtml(c.imagem)}${c.compose ? ` · compose ${escapeHtml(c.compose)}` : ''}</span>
          <div class="usage-reset">${escapeHtml(c.status)}${c.portas ? ` · ${escapeHtml(c.portas)}` : ''}</div>
          <div class="usage-reset">Para parar: <code>docker stop ${escapeHtml(c.nome)}</code></div>
        </li>`,
      )
    : [];
  return `
    <p>Aqui fica o que roda na máquina <b>fora da vila</b> e pode ter sido esquecido. Eu só aponto: quem encerra é você, no terminal.</p>
    ${secao(
      'Claude fora da vila',
      'Sessões abertas no VS Code ou em outro terminal. Se tiver um morador vivo na mesma pasta, é provável que seja ele.',
      a.claudes.map((e) => itemEsquecido(e, 'claude')),
      'Nenhum Claude rodando fora da vila.',
    )}
    ${secao(
      'Servidores fora da lareira',
      'Processos escutando uma porta que não foram ligados pela lareira de uma casa (o VS Code não entra).',
      a.servidores.map((e) => itemEsquecido(e, 'servidor')),
      'Nenhum servidor de pé fora da lareira.',
    )}
    ${
      a.containers
        ? secao('Containers Docker de pé', 'O banco de um projeto costuma ficar aqui de propósito; o que você não reconhece, vale olhar.', containers, 'Nenhum container de pé.')
        : `<h3>Containers Docker de pé</h3><p class="empty">${escapeHtml(a.dockerErro ?? 'Sem leitura do Docker.')}</p>`
    }`;
}

/** Armário dos "pacientes esquecidos" (etapa 2, CL-1). */
export async function openArmario() {
  const panel = openPanel({ title: 'Armário', subtitle: 'Pacientes esquecidos: o que roda fora da vila', size: 'lg', scroll: true });
  panel.body.innerHTML = '<p class="usage-empty">Abrindo o armário…</p>';
  try {
    const a = await api.armario();
    if (panel.body.isConnected) panel.body.innerHTML = conteudoDoArmario(a);
  } catch (err) {
    if (panel.body.isConnected) panel.body.innerHTML = `<p class="empty">Não consegui olhar: ${escapeHtml((err as Error).message)}</p>`;
  }
}
