import type { UsageRow, World } from '../api';

/**
 * Limites do plano (`World['usage']`) para a fachada da clínica, sem Phaser para poder ser testado. A clínica ocupa o lote
 * da antiga torre do relógio (decisão do usuário, 09/11/2026): a cruz da fachada tem a cor do pior limite, como o sino da
 * torre, e o texto ao passar o mouse é o mesmo. O detalhe fica no canto inferior esquerdo da tela (`ui/limitesHud.ts`).
 */
export type Severidade = 'normal' | 'warning' | 'critical';

export interface EstadoLimites {
  severidade: Severidade;
  /** "5h: 30%, volta às 14h · Semana: 12%, volta na quinta"; vazio sem dado. */
  resumo: string;
}

const DIAS = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];

export const isCincoHoras = (r: Pick<UsageRow, 'kind'>) => r.kind === 'session' || r.kind === 'five_hour';
export const isSemana = (r: Pick<UsageRow, 'kind'>) => r.kind === 'weekly_all' || r.kind === 'seven_day';

export const pct = (r: Pick<UsageRow, 'percent'>) => Math.max(0, Math.min(100, Math.round(r.percent)));

/** "volta às 14:30" (hoje) ou "volta na quinta" (outro dia); vazio sem data. */
export function voltaQuando(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (at.getTime() <= now.getTime()) return 'voltando agora';
  if (at.toDateString() === now.toDateString())
    return `volta às ${at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return `volta ${DIAS[at.getDay()]}`;
}

export function estadoDosLimites(usage: World['usage'], now = new Date()): EstadoLimites {
  const rows = usage?.rows ?? [];
  const severidade: Severidade = rows.some((r) => r.severity === 'critical')
    ? 'critical'
    : rows.some((r) => r.severity === 'warning')
      ? 'warning'
      : 'normal';
  const cinco = rows.find(isCincoHoras);
  const semana = rows.find(isSemana);
  const parte = (nome: string, r: UsageRow) => [`${nome}: ${pct(r)}%`, voltaQuando(r.resetsAt, now)].filter(Boolean).join(', ');
  return { severidade, resumo: [cinco && parte('5h', cinco), semana && parte('Semana', semana)].filter(Boolean).join(' · ') };
}

/** Texto da fachada ao passar o mouse. */
export function textoDaClinica(usage: World['usage'], now = new Date()): string {
  const { resumo } = estadoDosLimites(usage, now);
  return `Clínica — a médica examina quem está demorando; limites do Claude e máquina no canto da tela\n${
    resumo ? `Limites: ${resumo}` : 'Limites: aparecem depois da primeira resposta do Claude numa sessão'
  } — clique para entrar`;
}
