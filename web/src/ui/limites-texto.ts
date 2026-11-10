import type { Vitais, World } from '../api';
import { pct, voltaQuando } from '../game/limites';

/** As linhas do canto inferior esquerdo (limites do Claude e a máquina), sem DOM para poder ser testado. Uso: `limitesHud.ts`. */
type Sev = 'normal' | 'warning' | 'critical';
const nivel = (valor: number, aviso: number, critico: number): Sev => (valor >= critico ? 'critical' : valor >= aviso ? 'warning' : 'normal');

export interface Linha {
  rotulo: string;
  curto: string;
  percent: number;
  sev: Sev;
  detalhe: string;
}

function curtoDoLimite(kind: string, label: string) {
  if (kind === 'session' || kind === 'five_hour') return '5h';
  if (kind === 'weekly_all' || kind === 'seven_day') return '7d';
  return label.replace(/^Semana — /, '');
}

const gb = (mb: number) => (mb / 1024).toFixed(1).replace('.', ',');

/** As linhas da máquina, com os limiares do antigo monitor da clínica; sem texto longo, que o canto é pequeno. */
export function linhasDaMaquina(v: Vitais | null): Linha[] {
  if (!v) return [];
  const linhas: Linha[] = [];
  if (v.memoria) {
    const p = (v.memoria.usadaMb / v.memoria.totalMb) * 100;
    linhas.push({ rotulo: 'Memória', curto: 'Mem', percent: p, sev: nivel(p, 85, 95), detalhe: `${gb(v.memoria.usadaMb)} de ${gb(v.memoria.totalMb)} GB` });
  }
  if (v.swap && v.swap.totalMb > 0) {
    const p = (v.swap.usadaMb / v.swap.totalMb) * 100;
    linhas.push({ rotulo: 'Swap', curto: 'Swap', percent: p, sev: nivel(p, 50, 80), detalhe: `${gb(v.swap.usadaMb)} de ${gb(v.swap.totalMb)} GB` });
  }
  if (v.carga) {
    const p = (v.carga.umMinuto / v.carga.cpus) * 100;
    linhas.push({ rotulo: 'Processador', curto: 'CPU', percent: p, sev: nivel(p, 100, 200), detalhe: `carga ${v.carga.umMinuto.toFixed(1).replace('.', ',')} em ${v.carga.cpus} CPUs` });
  }
  if (v.disco) {
    const p = ((v.disco.totalGb - v.disco.livreGb) / v.disco.totalGb) * 100;
    linhas.push({ rotulo: 'Disco', curto: 'Disco', percent: p, sev: nivel(p, 90, 97), detalhe: `${String(v.disco.livreGb).replace('.', ',')} GB livres` });
  }
  return linhas;
}

export function linhasDosLimites(usage: World['usage'], now = new Date()): Linha[] {
  return (usage?.rows ?? []).map((r) => ({
    rotulo: r.label,
    curto: curtoDoLimite(r.kind, r.label),
    percent: pct(r),
    sev: (r.severity as Sev) ?? 'normal',
    detalhe: voltaQuando(r.resetsAt, now),
  }));
}
