import { getWorld, type GastoView } from '../api';
import { comparacao, faltam, fatia, numeroCurto, projecao } from './gasto-texto';
import { escapeHtml, openPanel } from './panel';

const PERFIL = { profissional: 'Trabalho (Claude)', pessoal: 'Pessoal (DeepSeek)' } as const;

const dia = (t: number) => new Date(t).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

/** Quanto da janela já passou, de 0 a 1. */
export const decorrido = (v: GastoView, agora = Date.now()) => Math.max(0, Math.min(1, (agora - v.janela.inicio) / (v.janela.fim - v.janela.inicio)));

function nomeDaSessao(id: string) {
  const s = getWorld().sessions.find((x) => x.id === id);
  return s ? s.name : 'uma conversa que já saiu da vila';
}

function secao(p: GastoView['perfis'][number], quanto: number) {
  const linhas = p.projetos
    .map((proj) => {
      const pct = p.total ? Math.round((proj.peso / p.total) * 100) : 0;
      const sessoes = proj.sessoes
        .map((s) => `<li>${escapeHtml(nomeDaSessao(s.id))} <span class="muted">· ${fatia(s.peso, proj.peso)} do projeto</span></li>`)
        .join('');
      return `
        <details class="gasto-row">
          <summary>
            <span class="gasto-nome">${escapeHtml(proj.nome)}</span>
            <span class="usage-bar gasto-barra"><span class="usage-fill" style="width:${pct}%"></span></span>
            <span class="gasto-pct">${fatia(proj.peso, p.total)}</span>
          </summary>
          <p class="usage-reset">Conversas que mais gastaram aqui:</p>
          <ul class="usage-reset gasto-sessoes">${sessoes}</ul>
        </details>`;
    })
    .join('');
  const detalhe = projecao(p.total, p.anterior, quanto);
  return `
    <h3>${PERFIL[p.perfil]}</h3>
    <p class="gasto-ritmo"><strong>${escapeHtml(comparacao(p.total, p.anterior, quanto))}</strong>${detalhe ? ` ${escapeHtml(detalhe)}` : ''}</p>
    ${linhas ? `<div class="gasto-lista">${linhas}</div>` : '<p class="empty">Nada gasto ainda nesta semana.</p>'}`;
}

/**
 * Painel do moinho (02/11/2026, refeito no mesmo dia para ficar mais claro): no topo só a janela; por perfil, a
 * comparação com a semana passada e uma linha por projeto com barra e porcentagem sempre à vista (o clique abre as
 * conversas); o como é calculado fica recolhido no fim, com o total em tokens.
 */
export function openGasto(v: GastoView | null) {
  const panel = openPanel({ title: 'Moinho', subtitle: 'Com o que o Claude gastou nesta semana', size: 'lg', scroll: true });
  if (!v) {
    panel.body.innerHTML = '<p class="empty">Ainda lendo as conversas. Tente de novo em alguns segundos.</p>';
    return;
  }
  const janela =
    v.janela.fonte === 'plano'
      ? `Semana do plano: ${dia(v.janela.inicio)} → ${dia(v.janela.fim)} · ${faltam(v.janela.fim)}`
      : 'Últimos 7 dias';
  const quanto = decorrido(v);
  const totais = v.perfis.map((p) => `${PERFIL[p.perfil]}: ${numeroCurto(p.total)} nesta semana, ${numeroCurto(p.anterior)} na anterior.`);
  panel.body.innerHTML = `
    <p class="gasto-janela">${escapeHtml(janela)}</p>
    ${v.perfis.map((p) => secao(p, quanto)).join('') || '<p class="empty">Nenhuma conversa nesta semana.</p>'}
    <details class="gasto-como">
      <summary>Como é calculado</summary>
      <ul class="usage-reset">
        <li>A porcentagem é a fatia de cada projeto no gasto do perfil. Não é custo em reais (o plano é assinatura).</li>
        <li>O gasto soma os tokens de entrada, de saída e de criação de cache; a leitura de cache conta 1/10, porque custa bem menos.</li>
        <li>A comparação projeta o gasto de agora para a semana inteira e compara com a semana passada.</li>
        <li>${v.janela.fonte === 'plano' ? 'A semana é a mesma da torre do relógio.' : 'A semana do plano aparece depois da primeira resposta do Claude numa sessão; até lá, valem os últimos 7 dias.'}</li>
        <li>As pás do moinho giram mais rápido quando o gasto passa o ritmo da semana passada.</li>
        ${totais.map((t) => `<li>${escapeHtml(t)} (em tokens)</li>`).join('')}
      </ul>
    </details>`;
}
