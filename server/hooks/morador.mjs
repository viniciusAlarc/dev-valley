// Hook do Dev Valley para SessionStart e UserPromptSubmit (instalado por `npm run hooks:install`).
// - SessionStart: pergunta à vila o nome de morador desta sessão (manda só o session_id) e conta à sessão quem ela é.
// - UserPromptSubmit: acha `@Nome` na mensagem e junta quem é esse morador, lido do mapa local
//   ~/.claude/dev-valley/moradores.json (gravado pela vila). O texto da mensagem nunca sai da máquina.
// Qualquer falha (vila fechada, mapa ausente) termina em silêncio: o hook nunca atrapalha a sessão.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.argv[2]) || 4777;
const MAP_FILE = path.join(os.homedir(), '.claude', 'dev-valley', 'moradores.json');

const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function output(event, context) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
}

async function sessionStart(input) {
  const res = await fetch(`http://127.0.0.1:${port}/api/moradores/nome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: input.session_id }),
    signal: AbortSignal.timeout(1500),
  });
  const { name } = await res.json();
  if (!name) return;
  output(
    'SessionStart',
    `No Dev Valley (a vila em pixel art onde o usuário organiza as sessões do Claude Code), esta sessão é o morador ${name}. ` +
      'O usuário cita outros moradores como @Nome; quando ele citar, quem é o morador chega junto com a mensagem.',
  );
}

function userPrompt(input) {
  // `@` no começo ou depois de espaço/parêntese (não pega e-mail nem `@types/...`).
  const cited = [...new Set([...(input.prompt ?? '').matchAll(/(?:^|[\s(])@([\p{L}]+\d*)/gu)].map((m) => m[1]))];
  if (!cited.length) return;
  const { atualizadoEm, moradores } = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const byName = new Map(Object.entries(moradores).map(([name, m]) => [norm(name), { name, ...m }]));
  const lines = [];
  for (const c of cited) {
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
  if (!lines.length) return;
  output(
    'UserPromptSubmit',
    `Moradores do Dev Valley citados nesta mensagem (mapa ${MAP_FILE}, atualizado em ${atualizadoEm}):\n${lines.join('\n')}`,
  );
}

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (input.hook_event_name === 'SessionStart') await sessionStart(input);
  else if (input.hook_event_name === 'UserPromptSubmit') userPrompt(input);
} catch {
  // silêncio: sem vila ou sem mapa, a sessão segue normal
}
