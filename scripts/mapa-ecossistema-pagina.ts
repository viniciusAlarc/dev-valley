// Página do mapa do ecossistema: função pura que recebe os dados e devolve o HTML completo.
//
// A rota /api/arquivo entrega HTML com `Content-Security-Policy: sandbox allow-scripts`: a origem
// é opaca, então nada de link externo, localStorage, hash ou fetch. CSS, JS e fonte vão inline.

import type { Cobranca, Ecossistema, Guardrail, Metrica, Origem, Peca, Quando, Sinal, VilaItem } from './mapa-ecossistema-dominio.js';
import { dataBr, dataHoraBr, escaparHtml } from './mapa-ecossistema-dominio.js';

export interface OpcoesPagina {
  apresentacao: boolean;
}

const ROTULO_ORIGEM: Record<Origem, string> = {
  universal: 'universal',
  cnr: 'CNR',
  projeto: 'projeto',
  pessoal: 'pessoal',
  maquina: 'máquina',
};

const ROTULO_QUANDO: Record<Quando, string> = {
  sempre: 'sempre',
  'sob-demanda': 'sob demanda',
  evento: 'por evento',
};

const ROTULO_COBRANCA: Record<Cobranca, string> = {
  mod: 'mod',
  teste: 'teste/checklist',
  julgamento: 'julgamento',
};

function e(texto: string | undefined): string {
  return escaparHtml(texto ?? '');
}

const CSS = `
:root{--fundo:#f6f7f8;--superficie:#fff;--texto:#1f2328;--muted:#5b6570;--borda:#d6dbe1;--borda-forte:#b8c0c8;--acento:#2f5a26;--alerta:#b42318;--universal:#2f6f3e;--cnr:#8a4b2a;--projeto:#1f5f8b;--pessoal:#6a4c93;--maquina:#5b6570}
*{box-sizing:border-box}
html{background:var(--fundo)}
body{margin:0;background:var(--fundo);color:var(--texto);font:15px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
[hidden]{display:none!important}
.folha{max-width:1180px;margin:0 auto;padding:34px 24px 64px}
.topo{padding-bottom:18px;border-bottom:1px solid var(--borda);margin-bottom:6px}
.selo{display:inline-block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border:1px solid var(--borda);border-radius:4px;padding:2px 8px;background:var(--superficie)}
.selo.apresentacao{color:var(--acento);border-color:#b7cdb0;background:#f3f8f1}
h1{font-size:30px;line-height:1.2;margin:12px 0 4px;font-weight:650;letter-spacing:-.01em}
.subtitulo{margin:0;color:var(--muted);font-size:16px}
.gerado{margin:10px 0 0;font-size:12.5px;color:var(--muted)}
code{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:.9em;background:#eef1f3;border:1px solid var(--borda);border-radius:3px;padding:0 4px;word-break:break-all}
.sumario{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.secao{margin-top:38px}
.secao>h2{font-size:20px;font-weight:650;margin:0 0 4px;padding-bottom:6px;border-bottom:1px solid var(--borda)}
.secao>.ajuda{margin:6px 0 16px;color:var(--muted);font-size:13.5px}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--borda);border:1px solid var(--borda);border-radius:6px;overflow:hidden}
.metrica{background:var(--superficie);padding:14px 16px}
.metrica-valor{font-size:26px;font-weight:650;line-height:1.1}
.metrica-unidade{font-size:12px;color:var(--muted);margin-left:4px}
.metrica-rotulo{display:block;margin-top:4px;font-size:13px}
.metrica-detalhe{display:block;margin-top:2px;font-size:12px;color:var(--muted)}
.metrica.alerta .metrica-valor{color:var(--alerta)}
.camadas{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:start}
.camada h2{font-size:14px;font-weight:650;margin:0}
.camada .pergunta{display:block;font-size:12px;font-weight:400;color:var(--muted);margin-top:1px}
.pecas{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.peca{text-align:left;font:inherit;background:var(--superficie);border:1px solid var(--borda);border-radius:6px;padding:9px 10px;cursor:pointer;color:var(--texto);transition:border-color .12s,box-shadow .12s}
.peca:hover,.peca:focus-visible{border-color:var(--borda-forte);box-shadow:0 1px 2px rgba(31,35,40,.08);outline:none}
.peca.destacado{border-color:var(--acento);box-shadow:0 0 0 2px rgba(47,90,38,.18)}
.peca-nome{display:block;font-size:13.5px;font-weight:600}
.peca-papel{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.peca-meta{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-top:6px;font-size:11px;color:var(--muted)}
.ponto{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--muted)}
.ponto.universal{background:var(--universal)}.ponto.cnr{background:var(--cnr)}.ponto.projeto{background:var(--projeto)}.ponto.pessoal{background:var(--pessoal)}.ponto.maquina{background:var(--maquina)}
.peca-na-vila{display:block;margin-top:4px;font-size:11px;color:var(--muted)}
.fluxos{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.fluxo{text-align:left;background:var(--superficie);border:1px solid var(--borda);border-radius:6px;padding:12px 14px;cursor:pointer;color:var(--texto);font:inherit}
.fluxo:hover,.fluxo:focus-visible{border-color:var(--borda-forte);outline:none}
.fluxo h3{margin:0 0 6px;font-size:14px;font-weight:650}
.fluxo ol{margin:0;padding-left:18px;font-size:12.5px}
.fluxo li{margin:2px 0}
.tabela{width:100%;border-collapse:collapse;font-size:13px;background:var(--superficie);border:1px solid var(--borda);border-radius:6px;overflow:hidden}
.tabela th,.tabela td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--borda);vertical-align:top}
.tabela tr:last-child td{border-bottom:0}
.tabela th{font-size:12px;font-weight:600;color:var(--muted);background:#f0f2f4;white-space:nowrap}
.selo-cobranca{display:inline-block;border:1px solid currentColor;border-radius:3px;padding:0 5px;font-size:11px;white-space:nowrap}
.selo-cobranca.mod{color:#2f6f3e;border-color:#b7cdb0;background:#f3f8f1}
.selo-cobranca.teste{color:#8a5a1f;border-color:#e3d3b5;background:#fbf7ee}
.selo-cobranca.julgamento{color:var(--muted)}
.lista-sinais{display:grid;gap:8px}
.sinal{background:var(--superficie);border:1px solid var(--borda);border-radius:6px;padding:12px 14px}
.sinal.alerta{border-color:#e4b8b3;background:#fdf6f5}
.sinal-rotulo{font-size:13px;font-weight:600}
.sinal-valor{font-size:15px;font-weight:650;margin-left:8px}
.sinal.alerta .sinal-valor{color:var(--alerta)}
.sinal-detalhe{display:block;font-size:12.5px;margin-top:4px}
.sinal-prova{display:block;font-size:11.5px;color:var(--muted);margin-top:4px}
.vila{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px}
.vila-item{background:var(--superficie);border:1px solid var(--borda);border-radius:4px;padding:8px 10px;font-size:12.5px}
.vila-item strong{font-weight:600}
.vila-item .muted{color:var(--muted)}
.aviso{background:#f0f2f4;border:1px solid var(--borda);border-radius:4px;padding:10px 12px;font-size:12.5px;margin-top:8px}
.rodape{margin-top:40px;padding-top:12px;border-top:1px solid var(--borda);font-size:12px;color:var(--muted)}
.btn{font:inherit;font-size:13px;background:var(--superficie);border:1px solid var(--borda-forte);border-radius:4px;padding:4px 10px;cursor:pointer;color:var(--texto)}
.btn:hover{background:#eef1f3}
#veu{position:fixed;inset:0;background:rgba(31,35,40,.32);z-index:90}
#gaveta{position:fixed;top:0;right:0;bottom:0;width:min(460px,94vw);background:var(--superficie);box-shadow:0 0 24px rgba(31,35,40,.18);z-index:100;overflow:auto;padding:20px 20px 40px}
.gaveta-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid var(--borda)}
.gaveta-topo h2{font-size:20px;margin:0}
.gaveta-papel{margin:0 0 8px;font-size:14.5px}
.gaveta-nota{margin:0 0 10px;font-size:13px;color:var(--muted)}
.gaveta-meta{margin:4px 0;font-size:13px}
.gaveta-bloco{margin-top:14px}
.gaveta-bloco h3{font-size:13px;margin:0 0 4px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.gaveta-bloco ul{margin:0;padding-left:18px;font-size:13px}
.gaveta-bloco li{margin:2px 0}
@media(max-width:1100px){.camadas{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.camadas{grid-template-columns:1fr}.folha{padding:20px 14px 48px}h1{font-size:25px}}
@media print{body{background:#fff}.sumario,#veu,#gaveta{display:none!important}}
`;

function cartaoMetrica(m: Metrica): string {
  return (
    `<div class="metrica${m.alerta ? ' alerta' : ''}">` +
    `<span class="metrica-valor">${e(String(m.valor))}</span><span class="metrica-unidade">${e(m.unidade)}</span>` +
    `<span class="metrica-rotulo">${e(m.rotulo)}</span>` +
    (m.detalhe ? `<span class="metrica-detalhe">${e(m.detalhe)}</span>` : '') +
    `</div>`
  );
}

function cartaoPeca(peca: Peca): string {
  return (
    `<button class="peca" type="button" data-peca="${e(peca.id)}">` +
    `<span class="peca-nome">${e(peca.nome)}</span>` +
    `<span class="peca-papel">${e(peca.papel)}</span>` +
    `<span class="peca-meta"><span class="ponto ${e(peca.origem)}" aria-hidden="true"></span>${e(ROTULO_ORIGEM[peca.origem])} · ${e(ROTULO_QUANDO[peca.quando])}</span>` +
    (peca.naVila ? `<span class="peca-na-vila">na vila: ${e(peca.naVila)}</span>` : '') +
    `</button>`
  );
}

function linhaGuardrail(g: Guardrail): string {
  return (
    `<tr><td><strong>${e(g.codigo)}</strong></td><td>${e(g.titulo)}</td>` +
    `<td><span class="selo-cobranca ${e(g.cobranca)}">${e(ROTULO_COBRANCA[g.cobranca])}</span></td>` +
    `<td><code>${e(g.onde)}</code></td></tr>`
  );
}

function cartaoSinal(s: Sinal): string {
  return (
    `<div class="sinal${s.alerta ? ' alerta' : ''}">` +
    `<span class="sinal-rotulo">${e(s.rotulo)}</span><span class="sinal-valor">${e(s.valor)}</span>` +
    `<span class="sinal-detalhe">${e(s.detalhe)}</span>` +
    `<span class="sinal-prova">prova: <code>${e(s.prova)}</code></span>` +
    `</div>`
  );
}

function itemVila(v: VilaItem): string {
  return `<div class="vila-item"><strong>${e(v.peca)}</strong> · ${e(v.mecanismo)}<br><span class="muted">${e(v.detalhe)}</span></div>`;
}

export function montarHtml(eco: Ecossistema, opcoes: OpcoesPagina): string {
  const pecasPorId: Record<string, Peca> = {};
  for (const camada of eco.camadas) for (const peca of camada.pecas) pecasPorId[peca.id] = peca;
  const dados = JSON.stringify({ pecas: pecasPorId }).replace(/</g, '\\u003c');

  const camadas = eco.camadas
    .map(
      (c) =>
        `<section class="camada" id="camada-${e(c.id)}">` +
        `<h2>${e(c.titulo)}<span class="pergunta">${e(c.pergunta)}</span></h2>` +
        `<div class="pecas">${c.pecas.map(cartaoPeca).join('')}</div>` +
        `</section>`,
    )
    .join('');

  const fluxos = eco.fluxos
    .map(
      (f) =>
        `<button class="fluxo" type="button" data-pecas="${e(f.pecas.join(' '))}">` +
        `<h3>${e(f.titulo)}</h3><ol>${f.passos.map((p) => `<li>${e(p)}</li>`).join('')}</ol>` +
        `</button>`,
    )
    .join('');

  const avisos = eco.avisos.map((a) => `<div class="aviso">${e(a)}</div>`).join('');
  const selo = opcoes.apresentacao ? 'Apresentação · sem dado pessoal' : 'Análise local · não compartilhar';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'">
<title>Mapa do ecossistema de IA — ${opcoes.apresentacao ? 'apresentação' : 'análise'}</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="folha">
<header class="topo">
<span class="selo${opcoes.apresentacao ? ' apresentacao' : ''}">${e(selo)}</span>
<h1>Mapa do ecossistema de IA</h1>
<p class="subtitulo">O que é dito, o que fica e o que vira regra.</p>
<p class="gerado">Gerado em ${e(dataHoraBr(eco.geradoEm))} por <code>npx tsx scripts/mapa-ecossistema.ts</code>.</p>
<nav class="sumario" aria-label="Seções">
<button class="btn" type="button" data-alvo="metricas">Estado atual</button>
<button class="btn" type="button" data-alvo="camadas">O caminho</button>
<button class="btn" type="button" data-alvo="fluxos">Fluxos</button>
<button class="btn" type="button" data-alvo="guardrails">Guardrails</button>
<button class="btn" type="button" data-alvo="saude">Saúde</button>
<button class="btn" type="button" data-alvo="vila">Na vila</button>
</nav>
</header>

<section class="secao" id="metricas">
<h2>Estado atual</h2>
<p class="ajuda">Números lidos dos arquivos desta máquina na hora da geração. Clique num card do mapa para ver caminho, tamanho e itens.</p>
<div class="cartoes">${eco.metricas.map(cartaoMetrica).join('')}</div>
${avisos}
</section>

<section class="secao" id="camadas">
<h2>O caminho do que é dito</h2>
<p class="ajuda">Cinco camadas, da fala ao que volta como regra. O ponto colorido indica o dono: verde universal, vermelho CNR, marrom projeto, roxo pessoal, cinza máquina.</p>
<div class="camadas">${camadas}</div>
</section>

<section class="secao" id="fluxos">
<h2>Fluxos</h2>
<p class="ajuda">Clique num fluxo para destacar as peças que ele atravessa.</p>
<div class="fluxos">${fluxos}</div>
</section>

<section class="secao" id="guardrails">
<h2>Guardrails</h2>
<p class="ajuda">Lidos do <code>guardrails-core.md</code>: ${eco.guardrails.length} regras. O selo mostra como a regra é cobrada hoje.</p>
<table class="tabela">
<thead><tr><th>Regra</th><th>Título</th><th>Cobrança</th><th>Onde mora</th></tr></thead>
<tbody>${eco.guardrails.map(linhaGuardrail).join('')}</tbody>
</table>
</section>

<section class="secao" id="saude">
<h2>Saúde do ecossistema</h2>
<p class="ajuda">Sinais que saem do próprio scan. Não é auditoria completa: isso é papel do <code>/auditar-regras</code>.</p>
<div class="lista-sinais">${eco.sinais.map(cartaoSinal).join('')}</div>
</section>

<section class="secao" id="vila">
<h2>Onde isso aparece na vila</h2>
<p class="ajuda">A mesma estrutura, do lado de dentro do jogo.</p>
<div class="vila">${eco.vila.map(itemVila).join('')}</div>
</section>

<footer class="rodape">
<p>Retrato gerado em ${e(dataBr(eco.geradoEm))}. Regenerar: <code>npx tsx scripts/mapa-ecossistema.ts</code>. A página não se atualiza sozinha.</p>
<p>${opcoes.apresentacao ? 'Versão de apresentação: caminho pessoal, nome de projeto e listas de memória/pendências foram mascarados ou omitidos na geração.' : 'Versão de análise: contém caminho pessoal e nome de projeto. Não compartilhar; para apresentar, use <code>ecossistema-apresentacao.html</code>.'}</p>
</footer>
</div>

<div id="veu" hidden></div>
<aside id="gaveta" hidden aria-label="Detalhe da peça"><div id="gaveta-corpo"></div></aside>

<script type="application/json" id="dados">${dados}</script>
<script>
(function () {
  var raiz = document.getElementById('dados');
  var dados = JSON.parse(raiz.textContent || '{"pecas":{}}');
  var gaveta = document.getElementById('gaveta');
  var corpo = document.getElementById('gaveta-corpo');
  var veu = document.getElementById('veu');
  var ultimoFoco = null;

  function el(tag, classe, texto) {
    var no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto !== undefined) no.textContent = texto;
    return no;
  }
  function bytesTexto(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1).replace('.', ',') + ' KB';
    return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }
  function bloco(titulo) {
    var caixa = el('div', 'gaveta-bloco');
    caixa.appendChild(el('h3', '', titulo));
    var lista = el('ul');
    caixa.appendChild(lista);
    return { caixa: caixa, lista: lista };
  }
  function fechar() {
    gaveta.hidden = true;
    veu.hidden = true;
    if (ultimoFoco) ultimoFoco.focus();
  }
  function abrir(id) {
    var p = dados.pecas[id];
    if (!p) return;
    corpo.textContent = '';
    var topo = el('div', 'gaveta-topo');
    topo.appendChild(el('h2', '', p.nome));
    var botao = el('button', 'btn', 'Fechar');
    botao.type = 'button';
    botao.addEventListener('click', fechar);
    topo.appendChild(botao);
    corpo.appendChild(topo);
    corpo.appendChild(el('p', 'gaveta-papel', p.papel));
    if (p.nota) corpo.appendChild(el('p', 'gaveta-nota', p.nota));
    corpo.appendChild(el('p', 'gaveta-meta', 'Dono: ' + (p.origem || '') + ' · quando entra: ' + (p.quando || '')));
    if (p.naVila) corpo.appendChild(el('p', 'gaveta-meta', 'Na vila: ' + p.naVila));
    if (p.caminhos && p.caminhos.length) {
      var caminhos = bloco('Caminhos');
      for (var i = 0; i < p.caminhos.length; i++) {
        var li = el('li');
        li.appendChild(el('code', '', p.caminhos[i]));
        caminhos.lista.appendChild(li);
      }
      corpo.appendChild(caminhos.caixa);
    }
    if (p.linhas !== undefined || p.bytes !== undefined || p.modificadoEm) {
      var numeros = bloco('Números');
      if (p.linhas !== undefined) numeros.lista.appendChild(el('li', '', p.linhas + ' linhas'));
      if (p.bytes !== undefined) numeros.lista.appendChild(el('li', '', bytesTexto(p.bytes)));
      if (p.modificadoEm) numeros.lista.appendChild(el('li', '', 'modificado em ' + p.modificadoEm));
      corpo.appendChild(numeros.caixa);
    }
    if (p.itens && p.itens.length) {
      var itens = bloco('Itens');
      for (var j = 0; j < p.itens.length; j++) itens.lista.appendChild(el('li', '', p.itens[j]));
      corpo.appendChild(itens.caixa);
    } else if (p.detalheOmitido) {
      corpo.appendChild(el('p', 'gaveta-nota', 'Detalhe omitido na versão de apresentação.'));
    }
    gaveta.hidden = false;
    veu.hidden = false;
    var primeiro = gaveta.querySelector('button');
    if (primeiro) primeiro.focus();
  }

  var pecas = document.querySelectorAll('.peca');
  for (var i = 0; i < pecas.length; i++) {
    pecas[i].addEventListener('click', function () {
      ultimoFoco = this;
      abrir(this.getAttribute('data-peca'));
    });
  }
  var fluxos = document.querySelectorAll('.fluxo');
  for (var j = 0; j < fluxos.length; j++) {
    fluxos[j].addEventListener('click', function () {
      var ids = (this.getAttribute('data-pecas') || '').split(' ').filter(Boolean);
      var antigos = document.querySelectorAll('.peca.destacado');
      for (var k = 0; k < antigos.length; k++) antigos[k].classList.remove('destacado');
      var primeiro = null;
      for (var n = 0; n < ids.length; n++) {
        var alvo = document.querySelector('.peca[data-peca="' + ids[n] + '"]');
        if (alvo) {
          alvo.classList.add('destacado');
          if (!primeiro) primeiro = alvo;
        }
      }
      if (primeiro) primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }
  var atalhos = document.querySelectorAll('.sumario [data-alvo]');
  for (var a = 0; a < atalhos.length; a++) {
    atalhos[a].addEventListener('click', function () {
      var alvo = document.getElementById(this.getAttribute('data-alvo'));
      if (alvo) alvo.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
  veu.addEventListener('click', fechar);
  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && !gaveta.hidden) fechar();
  });
})();
</script>
</body>
</html>`;
}
