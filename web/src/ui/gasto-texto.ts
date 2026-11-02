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

/** Título da comparação com a semana passada: curto, serve também ao balão do moinho. */
export function comparacao(total: number, anterior: number, decorrido: number): string {
  const r = ritmo(total, anterior, decorrido);
  if (r === null) return total > 0 ? 'Sem registro da semana passada para comparar.' : 'Nada gasto ainda nesta semana.';
  if (r >= 1.15) return 'Gastando mais rápido que na semana passada.';
  if (r > 0.85) return 'No mesmo ritmo da semana passada.';
  return 'Gastando mais devagar que na semana passada.';
}

/**
 * Detalhe concreto da comparação (02/11/2026): a projeção de como a semana fecha, que é exatamente o que o `ritmo` mede
 * ("1,4×" ou "20% da anterior"). Vazio quando não há com o que comparar.
 */
export function projecao(total: number, anterior: number, decorrido: number): string {
  const r = ritmo(total, anterior, decorrido);
  if (r === null) return '';
  if (r >= 1.15) return `No ritmo de agora, esta semana fecha em ${r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o que foi a anterior.`;
  if (r > 0.85) return 'No ritmo de agora, esta semana fecha perto do que foi a anterior.';
  return `No ritmo de agora, esta semana fecha em ${Math.max(1, Math.round(r * 100))}% do que foi a anterior.`;
}

/** "faltam 2 dias", "falta 1 dia", "termina em 5 h", "termina em menos de 1 h". */
export function faltam(fim: number, agora = Date.now()): string {
  const ms = Math.max(0, fim - agora);
  const dias = Math.floor(ms / 86_400_000);
  if (dias >= 2) return `faltam ${dias} dias`;
  if (dias === 1) return 'falta 1 dia';
  const horas = Math.floor(ms / 3_600_000);
  return horas >= 1 ? `termina em ${horas} h` : 'termina em menos de 1 h';
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
