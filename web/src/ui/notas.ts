import { notas as api, type Nota } from '../api';
import { escapeHtml, openPanel } from './panel';

/**
 * Quadro de avisos da praça (21/11/2026): o zoom do quadro, com as notas soltas do usuário presas na cortiça. Só criar
 * e excluir (decisão do usuário); as pendências 👤 ficam só dentro de cada casa.
 */

/** Quantas notas há no quadro, para o tooltip da praça; null até a primeira leitura. */
let contagem: number | null = null;

export const notasNoQuadro = () => contagem;

/** Lê a contagem para o tooltip (chamado quando a praça abre); erro deixa o tooltip sem número. */
export function carregarContagemDeNotas() {
  api
    .list()
    .then((l) => (contagem = l.length))
    .catch(() => {});
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function notaHtml(n: Nota, i: number) {
  return `<article class="nota nota-cor${i % 3}" data-id="${escapeHtml(n.id)}">
      <span class="nota-alfinete" aria-hidden="true"></span>
      <button class="nota-excluir" title="Excluir nota" aria-label="Excluir nota">✕</button>
      <p class="nota-texto">${escapeHtml(n.texto)}</p>
      <time class="nota-data">${escapeHtml(quando(n.criadaEm))}</time>
    </article>`;
}

export function openQuadroDeNotas() {
  const panel = openPanel({ title: 'Quadro de avisos', subtitle: 'Suas notas', size: 'lg', scroll: true });
  const nova = document.createElement('button');
  nova.className = 'btn btn-primary';
  nova.textContent = 'Nova nota';
  panel.actions.append(nova);
  panel.body.innerHTML = '<div class="quadro-cortica"><p class="empty">Carregando…</p></div>';
  const cortica = panel.body.querySelector<HTMLElement>('.quadro-cortica')!;
  let lista: Nota[] = [];

  const desenhar = () => {
    contagem = lista.length;
    panel.root.querySelector('.subtitle')!.textContent = lista.length ? `${lista.length} nota(s) no quadro` : 'Nenhuma nota no quadro';
    const rascunho = cortica.querySelector('.nota-nova');
    cortica.innerHTML = lista.length || rascunho ? lista.map(notaHtml).join('') : '<p class="empty quadro-vazio">O quadro está vazio. Clique em "Nova nota" para prender a primeira.</p>';
    if (rascunho) cortica.prepend(rascunho);
  };

  const carregar = async () => {
    try {
      lista = await api.list();
      desenhar();
    } catch (err) {
      cortica.innerHTML = `<p class="empty error">Não consegui ler as notas: ${escapeHtml((err as Error).message)}</p>`;
    }
  };

  nova.addEventListener('click', () => {
    const aberto = cortica.querySelector<HTMLTextAreaElement>('.nota-nova textarea');
    if (aberto) return aberto.focus();
    cortica.querySelector('.quadro-vazio')?.remove();
    const papel = document.createElement('article');
    papel.className = 'nota nota-nova';
    papel.innerHTML = `<span class="nota-alfinete" aria-hidden="true"></span>
      <textarea maxlength="2000" placeholder="Escreva a nota… (Ctrl+Enter salva)"></textarea>
      <div class="nota-botoes">
        <button class="btn" data-acao="cancelar">Cancelar</button>
        <button class="btn btn-primary" data-acao="salvar">Salvar</button>
      </div>
      <p class="empty error nota-erro" hidden></p>`;
    cortica.prepend(papel);
    const texto = papel.querySelector('textarea')!;
    const erro = papel.querySelector<HTMLElement>('.nota-erro')!;
    const salvar = papel.querySelector<HTMLButtonElement>('[data-acao="salvar"]')!;
    const gravar = async () => {
      if (!texto.value.trim()) return texto.focus();
      salvar.disabled = true;
      try {
        lista.push(await api.criar(texto.value));
        papel.remove();
        desenhar();
      } catch (err) {
        erro.textContent = (err as Error).message;
        erro.hidden = false;
        salvar.disabled = false;
      }
    };
    salvar.addEventListener('click', gravar);
    texto.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void gravar();
    });
    papel.querySelector('[data-acao="cancelar"]')!.addEventListener('click', () => {
      papel.remove();
      desenhar();
    });
    texto.focus();
  });

  cortica.addEventListener('click', async (e) => {
    const botao = (e.target as HTMLElement).closest<HTMLButtonElement>('.nota-excluir');
    const id = botao?.closest<HTMLElement>('.nota')?.dataset.id;
    if (!botao || !id || !confirm('Excluir esta nota?')) return;
    botao.disabled = true;
    try {
      await api.excluir(id);
      lista = lista.filter((n) => n.id !== id);
      desenhar();
    } catch (err) {
      botao.disabled = false;
      alert(`Não consegui excluir: ${(err as Error).message}`);
    }
  });

  void carregar();
}
