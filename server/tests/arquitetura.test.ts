import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

// Fronteira das rotas (CLAUDE.md, "Stack e estrutura"): `app.ts` recebe os serviços pelo `Contexto` de `criarApp(ctx)`.
// É o que deixa os testes de rota trocarem tudo por imitações e o que impede uma rota de agir fora da pasta do
// projeto sem passar pelo `index.ts`. Antes era só prosa; agora este teste barra import de valor novo.
//
// PERMITIDOS: o que a rota pode importar como valor. Constante, função pura ou operação que age só dentro da pasta do
// projeto da casa (git, pombal, PROGRESS.md). Serviço com estado ou que age fora dela entra pelo `Contexto`.
const PERMITIDOS: Record<string, string[]> = {
  'node:crypto': ['randomUUID'],
  'node:os': ['os'],
  'node:path': ['path'],
  express: ['express'],
  './agents.js': ['agentInput', 'Agents'], // validação da entrada e o nome do agente no CLI (estático)
  './config.js': ['CONTA_CLAUDE'],
  './git.js': ['gitOps'], // diff e status na pasta do projeto
  './moradores.js': ['TITULO_MAX'],
  './pombal.js': ['buscar', 'cartas', 'PombalError', 'voar'], // git na pasta do projeto, clique confirmado (regra 9)
  './progress.js': ['markChecked', 'readProgressComArquivo'], // PROGRESS.md do projeto e o arquivo dele (docs-dev/progresso)
  './seguranca.js': ['arquivoPermitido', 'isLocalOrigin'],
  './porao.js': ['MAESTRO'],
  './skills.js': ['skillInput'],
  './notas.js': ['NOTA_MAX'],
};

interface Importado {
  modulo: string;
  nome: string;
}

// Imports de valor do arquivo: `import type` e os nomes marcados com `type` dentro das chaves ficam de fora.
export function importsDeValor(fonte: string): Importado[] {
  const saida: Importado[] = [];
  const re = /^import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)';/gm;
  for (const m of fonte.matchAll(re)) {
    if (m[1]) continue;
    const [clausula, modulo] = [m[2]!, m[3]!];
    const padrao = /^(\w+)\s*(?:,|$)/.exec(clausula.trim());
    if (padrao) saida.push({ modulo, nome: padrao[1]! });
    const tudo = /\*\s+as\s+(\w+)/.exec(clausula);
    if (tudo) saida.push({ modulo, nome: tudo[1]! });
    const chaves = /\{([^}]*)\}/.exec(clausula);
    for (const parte of chaves ? chaves[1]!.split(',') : []) {
      const nome = parte.trim();
      if (!nome || nome.startsWith('type ')) continue;
      saida.push({ modulo, nome: nome.split(/\s+as\s+/).pop()! });
    }
  }
  return saida;
}

describe('fronteira das rotas: app.ts recebe serviço pelo Contexto', () => {
  const fonte = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  const valores = importsDeValor(fonte);

  test('nenhum import de valor fora da lista PERMITIDOS', () => {
    const fora = valores.filter((i) => !PERMITIDOS[i.modulo]?.includes(i.nome));
    assert.deepEqual(
      fora,
      [],
      `server/src/app.ts importa como valor: ${fora.map((i) => `${i.nome} de '${i.modulo}'`).join(', ')}. ` +
        'Rota recebe serviço pelo Contexto: acrescente o campo em `Contexto` (app.ts), passe o serviço de verdade no ' +
        'index.ts e a imitação em server/tests/servidor.ts, e importe só o tipo (`import type`). Constante ou função ' +
        'pura, sem estado e sem efeito fora da pasta do projeto, pode entrar em PERMITIDOS (server/tests/arquitetura.test.ts), com o porquê.',
    );
  });

  test('a lista PERMITIDOS só encolhe: item que o app.ts não importa mais sai dela', () => {
    const usados = new Set(valores.map((i) => `${i.modulo}#${i.nome}`));
    const sobrando = Object.entries(PERMITIDOS).flatMap(([m, nomes]) => nomes.filter((n) => !usados.has(`${m}#${n}`)).map((n) => `${n} de '${m}'`));
    assert.deepEqual(sobrando, [], `tire de PERMITIDOS o que o app.ts não importa mais: ${sobrando.join(', ')}`);
  });

  test('o leitor de imports separa tipo de valor', () => {
    const exemplo = [
      "import type { A } from './a.js';",
      "import { b, type C, d as e } from './b.js';",
      "import * as g from './g.js';",
      "import h, { i } from 'h';",
    ].join('\n');
    assert.deepEqual(importsDeValor(exemplo), [
      { modulo: './b.js', nome: 'b' },
      { modulo: './b.js', nome: 'e' },
      { modulo: './g.js', nome: 'g' },
      { modulo: 'h', nome: 'h' },
      { modulo: 'h', nome: 'i' },
    ]);
  });
});
