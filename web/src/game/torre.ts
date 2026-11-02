import type { UsageRow, World } from '../api';

/**
 * Estado da torre do relógio a partir dos limites do plano (`World['usage']`), sem Phaser para poder ser testado.
 * Ponteiro = sessão de 5h (volta inteira = limite); céu = semana; sino = o pior dos limites (02/11/2026).
 */
export type Ceu = 'manha' | 'dia' | 'tarde' | 'noite';
export type Sino = 'normal' | 'warning' | 'critical';

export interface EstadoTorre {
  /** Graus a partir das 12h, no sentido horário; null = relógio parado (sem dado). */
  angulo: number | null;
  ceu: Ceu | null;
  sino: Sino;
  texto: string;
}

const DIAS = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];

export const isCincoHoras = (r: Pick<UsageRow, 'kind'>) => r.kind === 'session' || r.kind === 'five_hour';
export const isSemana = (r: Pick<UsageRow, 'kind'>) => r.kind === 'weekly_all' || r.kind === 'seven_day';

const pct = (r: UsageRow) => Math.max(0, Math.min(100, Math.round(r.percent)));

/** "volta às 14:30" (hoje) ou "volta na quinta" (outro dia); vazio sem data. */
export function voltaQuando(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (at.getTime() <= now.getTime()) return 'voltando agora';
  if (at.toDateString() === now.toDateString())
    return `volta às ${at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return `volta ${DIAS[at.getDay()]}`;
}

export function ceuDa(percent: number): Ceu {
  return percent < 25 ? 'manha' : percent < 50 ? 'dia' : percent < 75 ? 'tarde' : 'noite';
}

export function estadoTorre(usage: World['usage'], now = new Date()): EstadoTorre {
  const rows = usage?.rows ?? [];
  if (!rows.length)
    return { angulo: null, ceu: null, sino: 'normal', texto: 'Torre do relógio — parada até a primeira resposta do Claude numa sessão' };
  const cinco = rows.find(isCincoHoras);
  const semana = rows.find(isSemana);
  const sino: Sino = rows.some((r) => r.severity === 'critical')
    ? 'critical'
    : rows.some((r) => r.severity === 'warning')
      ? 'warning'
      : 'normal';
  const parte = (nome: string, r: UsageRow) => [`${nome}: ${pct(r)}%`, voltaQuando(r.resetsAt, now)].filter(Boolean).join(', ');
  const partes = [cinco && parte('5h', cinco), semana && parte('Semana', semana)].filter(Boolean);
  return {
    angulo: cinco ? pct(cinco) * 3.6 : null,
    ceu: semana ? ceuDa(pct(semana)) : null,
    sino,
    texto: `Torre do relógio — limites do Claude\n${partes.join(' · ')} — clique para ver tudo`,
  };
}
