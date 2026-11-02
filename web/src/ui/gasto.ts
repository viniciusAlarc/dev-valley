import { getWorld, type GastoView } from '../api';
import { comparacao, fatia, numeroCurto } from './gasto-texto';
import { escapeHtml, openPanel } from './panel';

const PERFIL = { profissional: 'Perfil do trabalho (Claude)', pessoal: 'Perfil pessoal (DeepSeek)' } as const;

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
        <details class="usage-row">
          <summary class="usage-label"><span>${escapeHtml(proj.nome)} ficou com ${fatia(proj.peso, p.total)} do gasto</span></summary>
          <div class="usage-bar"><div class="usage-fill" style="width:${pct}%"></div></div>
          <p class="usage-reset">Quem mais gastou aqui:</p>
          <ul class="usage-reset">${sessoes}</ul>
          <p class="usage-reset">${numeroCurto(proj.peso)} tokens de peso</p>
        </details>`;
    })
    .join('');
  return `
    <h3>${PERFIL[p.perfil]}</h3>
    <p>${escapeHtml(comparacao(p.total, p.anterior, quanto))}</p>
    ${linhas || '<p class="empty">Nada gasto ainda nesta semana.</p>'}`;
}

/**
 * Painel do moinho (02/11/2026): com o que o gasto da semana foi, por projeto, do maior para o menor. Texto humano:
 * porcentagem e comparação; o número de tokens fica em letra miúda ao abrir o projeto.
 */
export function openGasto(v: GastoView | null) {
  const panel = openPanel({ title: 'Moinho', subtitle: 'Com o que o Claude gastou nesta semana', size: 'lg', scroll: true });
  if (!v) {
    panel.body.innerHTML = '<p class="empty">Ainda lendo as conversas. Tente de novo em alguns segundos.</p>';
    return;
  }
  const janela =
    v.janela.fonte === 'plano'
      ? `Semana do plano: de ${dia(v.janela.inicio)} a ${dia(v.janela.fim)}, a mesma da torre do relógio.`
      : 'Últimos 7 dias (a semana do plano aparece depois da primeira resposta do Claude numa sessão).';
  const quanto = decorrido(v);
  panel.body.innerHTML = `
    <p class="muted">${escapeHtml(janela)} As pás giram no ritmo da semana: mais rápido quando ele passa o da semana passada.
    O peso conta a leitura de cache como 1/10, porque ela custa bem menos.</p>
    ${v.perfis.map((p) => secao(p, quanto)).join('') || '<p class="empty">Nenhuma conversa nesta semana.</p>'}`;
}
