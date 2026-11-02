/**
 * Textos do moinho em linguagem de gente (02/11/2026): porcentagem e comparação, nunca número cru como destaque.
 * Sem DOM nem API, para poder ser testado.
 */

/** "1,4 mi", "237 mil", "850": o número pequeno que fica em letra miúda. */
export function numeroCurto(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} mil`;
  return String(Math.round(n));
}

/**
 * Ritmo da semana atual comparado com a anterior inteira, descontando quanto da semana já passou: na terça, gastar 2/7
 * do que se gastou a semana passada toda é "o mesmo ritmo". `decorrido` vai de 0 a 1.
 */
export function ritmo(total: number, anterior: number, decorrido: number): number | null {
  if (anterior <= 0 || decorrido <= 0) return null;
  return total / (anterior * Math.min(1, decorrido));
}

export function comparacao(total: number, anterior: number, decorrido: number): string {
  const r = ritmo(total, anterior, decorrido);
  if (r === null) return total > 0 ? 'Sem registro da semana passada para comparar.' : 'Nada gasto ainda nesta semana.';
  if (r >= 2.5) return `Ritmo ${Math.round(r)} vezes maior que o da semana passada.`;
  if (r >= 1.8) return 'Ritmo dobrado em relação à semana passada.';
  if (r >= 1.15) return `Ritmo ${Math.round((r - 1) * 100)}% maior que o da semana passada.`;
  if (r > 0.85) return 'Ritmo parecido com o da semana passada.';
  if (r >= 0.4 && r <= 0.6) return 'Ritmo pela metade em relação à semana passada.';
  return `Ritmo ${Math.round((1 - r) * 100)}% menor que o da semana passada.`;
}

/** Duração de uma volta das pás (ms): 6 s no ritmo da semana passada, mais rápido quando o ritmo sobe. */
export function voltaDasPas(total: number, anterior: number, decorrido: number): number {
  if (total <= 0) return 0; // parado
  const r = ritmo(total, anterior, decorrido) ?? 1;
  return Math.round(Math.min(16000, Math.max(1500, 6000 / Math.max(r, 0.1))));
}

/** "ficou com 45% do gasto"; abaixo de 1%, "menos de 1%". */
export function fatia(peso: number, total: number): string {
  if (total <= 0) return '0%';
  const p = (peso / total) * 100;
  return p < 1 ? 'menos de 1%' : `${Math.round(p)}%`;
}
