import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import type { Ecossistema } from '../../scripts/mapa-ecossistema-dominio.js';
import {
  auditoriaVencida,
  contarLinhas,
  contarPendencias,
  criarMascara,
  diasAte,
  lerGuardrails,
  lerRoteador,
  prepararParaApresentacao,
  rotularProjetos,
} from '../../scripts/mapa-ecossistema-dominio.js';
import { coletarEcossistema } from '../../scripts/mapa-ecossistema.js';
import { montarHtml } from '../../scripts/mapa-ecossistema-pagina.js';

// Nomes e caminhos de mentira: o teste nunca lê projeto de verdade (CLAUDE.md, regras de teste).
const HOME_FALSO = '/home/fulano';
const REPO_FALSO = '/home/fulano/Documents/Desenvolvimento/ProjetoAlfa';

function ecoDeTeste(): Ecossistema {
  return {
    versao: 1,
    geradoEm: '2026-11-24T12:00:00',
    metricas: [{ id: 'guardrails', rotulo: 'Guardrails no núcleo', valor: 3, unidade: 'regras', detalhe: '3 linhas · teto ~120', alerta: true }],
    camadas: [
      {
        id: 'contexto',
        titulo: 'Contexto',
        pergunta: 'O que é lido antes de agir?',
        pecas: [
          {
            id: 'roteador',
            nome: 'Roteador <b>',
            papel: 'Diz o que carregar em toda sessão.',
            caminhos: [`${REPO_FALSO}/CLAUDE.md`],
            origem: 'universal',
            quando: 'sempre',
            naVila: 'biblioteca',
            linhas: 3,
            bytes: 42,
            modificadoEm: '2026-11-24',
            itens: ['um', 'dois'],
          },
          {
            id: 'memoria',
            nome: 'Memória automática',
            papel: 'Memória por projeto e por conta.',
            caminhos: [`${HOME_FALSO}/.claude/projects/x/memory`],
            origem: 'maquina',
            quando: 'sob-demanda',
            itens: ['fatura-do-ProjetoAlfa.md'],
          },
          {
            id: 'pendencias',
            nome: 'PENDENCIAS.md',
            papel: 'Rastreador único do que está aberto.',
            caminhos: [`${REPO_FALSO}/PENDENCIAS.md`],
            origem: 'projeto',
            quando: 'evento',
            itens: ['MC-1 · Contrato do ProjetoAlfa com o cliente'],
          },
        ],
      },
    ],
    guardrails: [{ codigo: 'G1', titulo: 'A especificação manda', cobranca: 'julgamento', onde: 'guardrails-core.md' }],
    fluxos: [{ id: 'f', titulo: 'Fluxo', passos: ['um', 'dois'], pecas: ['roteador'] }],
    sinais: [{ id: 's', rotulo: 'Sinal', valor: 'ok', detalhe: 'tudo bem', prova: `${HOME_FALSO}/x`, alerta: false }],
    vila: [{ peca: 'Biblioteca', mecanismo: 'docs', detalhe: 'leitor' }],
    avisos: ['aviso de teste'],
  };
}

describe('mapa-ecossistema: parsers puros', () => {
  test('contarLinhas conta como wc -l: linha final sem quebra também conta', () => {
    assert.equal(contarLinhas('a\nb\n'), 2);
    assert.equal(contarLinhas('a\nb'), 2);
    assert.equal(contarLinhas(''), 0);
  });

  test('lerRoteador separa imports e a tabela de leitura sob demanda', () => {
    const texto = [
      '## Carregado em toda sessão',
      '',
      '@/a/um.md',
      '@/a/dois.md',
      '',
      '## Ler sob demanda',
      '',
      '| Arquivo | Ler quando |',
      '|---|---|',
      '| `/a/tres.md` | Quando precisar |',
      '| `/a/quatro.md` | Sempre que |',
    ].join('\n');
    assert.deepEqual(lerRoteador(texto), {
      imports: ['/a/um.md', '/a/dois.md'],
      sobDemanda: [
        { arquivo: '/a/tres.md', quando: 'Quando precisar' },
        { arquivo: '/a/quatro.md', quando: 'Sempre que' },
      ],
    });
  });

  test('lerGuardrails classifica cobrança pelo mod, teste/checklist e julgamento', () => {
    const texto = [
      '## G1 — A especificação manda',
      'Implementar apenas o que está escrito.',
      '',
      '## G3 — Ação irreversível',
      'Cobrado pelo mod (pergunta): SQL destrutivo.',
      '',
      '## G4 — Testar antes e depois',
      'Rodar a suíte antes e depois.',
      '',
      '## G19 — Peça visual',
      'Filete colorido numa aresta é barrado pelo mod.',
      '',
      '## G20 — Recurso pago',
      'O mod pergunta nos comandos de nuvem.',
    ].join('\n');
    const lido = lerGuardrails(texto);
    assert.deepEqual(
      lido.guardrails.map((g) => [g.codigo, g.titulo, g.cobranca]),
      [
        ['G1', 'A especificação manda', 'julgamento'],
        ['G3', 'Ação irreversível', 'mod'],
        ['G4', 'Testar antes e depois', 'teste'],
        ['G19', 'Peça visual', 'mod'],
        ['G20', 'Recurso pago', 'mod'],
      ],
    );
    assert.equal(lido.linhas, contarLinhas(texto));
  });

  test('contarPendencias agrupa por dono e limpa markdown do título', () => {
    const texto = [
      '| ID | Dono | Item | Aberto em |',
      '|---|---|---|---|',
      '| MC-1 | 👤 | Consolidador de **memória** em `docs-dev/a-codar/x.md`. | 2026-11-24 |',
      '| PP-5 | 💻 | Fábrica lê só `~/.claude` | 2026-11-19 |',
      '| SR-1 | 🖥️ | Reiniciar a vila | 2026-11-20 |',
    ].join('\n');
    const lido = contarPendencias(texto);
    assert.equal(lido.total, 3);
    assert.deepEqual(lido.porDono, { usuario: 1, codigo: 1, servidor: 1 });
    assert.equal(lido.itens[0].titulo, 'Consolidador de memória em docs-dev/a-codar/x.md.');
  });

  test('auditoriaVencida e diasAte comparam só a data', () => {
    assert.equal(auditoriaVencida('2026-12-24', '2026-11-24T12:00:00'), false);
    assert.equal(auditoriaVencida('2026-11-23', '2026-11-24T12:00:00'), true);
    assert.equal(auditoriaVencida(null, '2026-11-24T12:00:00'), false);
    assert.equal(diasAte('2026-12-24', '2026-11-24T12:00:00'), 30);
  });

  test('rotularProjetos ordena por code point e deduplica', () => {
    assert.deepEqual([...rotularProjetos(['b', 'a', 'b']).entries()], [
      ['a', 'Casa 1'],
      ['b', 'Casa 2'],
    ]);
  });
});

describe('mapa-ecossistema: modo apresentação', () => {
  test('a máscara tira caminho pessoal, nome do usuário e nome de projeto', () => {
    const mascarar = criarMascara({
      home: HOME_FALSO,
      usuario: 'fulano',
      projetos: ['ProjetoAlfa', 'loja-b2b'],
    });
    const saida = mascarar('cd /home/fulano/Documents/Desenvolvimento/ProjetoAlfa\nloja-b2b e fulano');
    assert.ok(!saida.includes('/home/'));
    assert.ok(!saida.includes('fulano'));
    assert.ok(!saida.includes('ProjetoAlfa'));
    assert.ok(!saida.includes('loja-b2b'));
    assert.ok(saida.includes('~'));
    assert.ok(saida.includes('você'));
    assert.ok(saida.includes('Casa'));
  });

  test('a versão de apresentação omite memória e pendências, e mascara o resto', () => {
    const mascarar = criarMascara({ home: HOME_FALSO, usuario: 'fulano', projetos: ['ProjetoAlfa'] });
    const eco = prepararParaApresentacao(ecoDeTeste(), mascarar);
    const html = montarHtml(eco, { apresentacao: true });

    assert.ok(!html.includes('/home/'));
    assert.ok(!html.includes('fulano'));
    assert.ok(!html.includes('ProjetoAlfa'));
    assert.ok(!html.includes('fatura-do-ProjetoAlfa'));
    assert.ok(!html.includes('Contrato do ProjetoAlfa'));
    assert.ok(html.includes('Casa 1'));
    assert.ok(html.includes('Detalhe omitido na versão de apresentação.'));
  });
});

describe('mapa-ecossistema: página', () => {
  test('é determinística, escapa texto de arquivo e não carrega nada de fora', () => {
    const eco = ecoDeTeste();
    const primeiro = montarHtml(eco, { apresentacao: false });
    const segundo = montarHtml(eco, { apresentacao: false });
    assert.equal(primeiro, segundo);
    assert.ok(primeiro.includes('Roteador &lt;b&gt;'));
    assert.ok(!primeiro.includes('Roteador <b>'));
    assert.ok(primeiro.includes('id="camadas"'));
    assert.ok(primeiro.includes('id="guardrails"'));
    assert.ok(primeiro.includes('id="saude"'));
    assert.ok(primeiro.includes('id="vila"'));
    assert.ok(!/https?:\/\//.test(primeiro), 'página não pode ter URL externa');
    assert.ok(primeiro.includes('/home/fulano/Documents/Desenvolvimento/ProjetoAlfa/CLAUDE.md'));
  });
});

describe('mapa-ecossistema: coletor', () => {
  test('home e repositório vazios não lançam e saem com as cinco camadas', () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-eco-'));
    const home = path.join(raiz, 'home');
    const repo = path.join(raiz, 'repo');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(repo, { recursive: true });
    try {
      const eco = coletarEcossistema({ home, repo, agora: '2026-11-24T12:00:00' });
      assert.equal(eco.camadas.length, 5);
      assert.equal(eco.guardrails.length, 0);
      assert.ok(eco.metricas.length >= 6);
      assert.ok(eco.avisos.some((aviso) => aviso.includes('guardrails-core')));
      assert.ok(eco.sinais.some((sinal) => sinal.id === 'roteadores' && sinal.alerta));
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });
});
