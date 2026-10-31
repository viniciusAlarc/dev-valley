// Lógica pura do mod (sem rede nem disco), para os testes poderem chamar direto.

/** Uma entrada do mapa ~/.claude/dev-valley/moradores.json, gravado pela vila (server/src/moradores.ts). */
export interface Morador {
  sessao: string;
  projeto: string | null;
  pasta: string;
  titulo: string;
  estado: string;
  conversa: string | null;
}

export interface Mapa {
  atualizadoEm: string;
  moradores: Record<string, Morador>;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** `@Nome` no começo ou depois de espaço/parêntese: não pega e-mail nem `@types/...`. */
export function citados(prompt: string): string[] {
  return [...new Set([...prompt.matchAll(/(?:^|[\s(])@([\p{L}]+\d*)/gu)].map((m) => m[1]!))];
}

/** O que a sessão lê junto da mensagem sobre cada morador citado; undefined quando não há o que dizer. */
export function contextoCitados(nomes: string[], mapa: Mapa, mapaPath: string): string | undefined {
  const byName = new Map(Object.entries(mapa.moradores).map(([name, m]) => [norm(name), { name, ...m }]));
  const lines: string[] = [];
  for (const c of nomes) {
    const m = byName.get(norm(c));
    if (m) {
      lines.push(
        `- @${m.name}: sessão ${m.sessao}${m.projeto ? `, projeto ${m.projeto}` : ', avulsa (praça)'}, pasta ${m.pasta}, ` +
          `"${m.titulo}", ${m.estado}.` +
          (m.conversa ? ` Conversa em ${m.conversa} (o fim do .jsonl mostra o que ela fez por último).` : ''),
      );
    } else if (/^\p{Lu}/u.test(c)) {
      lines.push(`- @${c}: nenhum morador com esse nome na vila agora.`);
    }
  }
  if (!lines.length) return undefined;
  return `Moradores do Dev Valley citados nesta mensagem (mapa ${mapaPath}, atualizado em ${mapa.atualizadoEm}):\n${lines.join('\n')}`;
}

/**
 * Ids das sessões citadas que estão no mapa, sem a própria: o único dado tirado da mensagem que vai à vila (regra 3,
 * ampliada em 30/10/2026 para os NPCs conversarem). Nunca o nome digitado nem o texto.
 */
export function idsCitados(nomes: string[], mapa: Mapa, propria: string): string[] {
  const byName = new Map(Object.entries(mapa.moradores).map(([name, m]) => [norm(name), m.sessao]));
  return [...new Set(nomes.map((n) => byName.get(norm(n))).filter((id): id is string => !!id && id !== propria))];
}

export function contextoProprioNome(name: string): string {
  return (
    `No Dev Valley (a vila em pixel art onde o usuário organiza as sessões do Claude Code), esta sessão é o morador ${name}. ` +
    'O usuário cita outros moradores como @Nome; quando ele citar, quem é o morador chega junto com a mensagem.'
  );
}

export interface Medida {
  context: { tokens?: number; window: number; percent?: number };
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[];
}

const LIMIT_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d' };

/** Texto do rodapé, o mesmo da status line de antes: `🌾 ctx 45% · 5h 30% · 7d 12%`. */
export function textoRodape(m: Medida): string {
  const parts = [`🌾 ctx ${Math.floor(m.context.percent ?? 0)}%`];
  for (const l of m.rateLimits) if (LIMIT_LABEL[l.kind]) parts.push(`${LIMIT_LABEL[l.kind]} ${Math.floor(l.percentUsed)}%`);
  return parts.join(' · ');
}

/** O corpo que `POST /api/statusline` já entende (o formato da status line de shell): o servidor não muda. */
export function corpoStatus(sessionId: string, model: string, m: Medida) {
  const rate_limits: Record<string, { used_percentage: number; resets_at?: string }> = {};
  for (const l of m.rateLimits) if (LIMIT_LABEL[l.kind]) rate_limits[l.kind] = { used_percentage: l.percentUsed, resets_at: l.resetsAt };
  return {
    session_id: sessionId,
    model,
    context_window: {
      context_window_size: m.context.window,
      used_percentage: m.context.percent,
      total_input_tokens: m.context.tokens,
    },
    rate_limits: Object.keys(rate_limits).length ? rate_limits : undefined,
  };
}
