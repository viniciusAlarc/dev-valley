import { api, contaPadraoDaCasa, contasDaCasa as contasOferecidas, getWorld, type ContaResumo, type Project } from '../api';
import { button, escapeHtml, openPanel } from './panel';
import { openTerminal } from './terminal';

/**
 * Tela de sessão nova (decisão do usuário, 19/11/2026): um botão só, e aqui a escolha da conta — Claude, DeepSeek
 * pessoal ou DeepSeek trabalho. A casa oferece as contas da finalidade dela (`project.contas`; a pessoal, também as
 * DeepSeek de trabalho); a praça oferece todas.
 * A escolha vale só para esta sessão; nada fica guardado por casa.
 */
export function openNovaSessao(opts: { project?: Project; voltar?: () => void }) {
  const { project } = opts;
  const todas = getWorld().contas ?? [];
  const contas: ContaResumo[] = project
    ? contasOferecidas(project)
    : todas.length
      ? todas
      : [{ nome: 'Claude', provedor: 'claude', finalidade: 'trabalho' }];
  const padrao = project ? contaPadraoDaCasa(project) : contas[0]!;
  const panel = openPanel({ title: 'Nova sessão', subtitle: project ? project.name : 'Sessão avulsa, na praça' });
  const ordenadas = [...contas].sort((a, b) => (a.nome === padrao.nome ? -1 : b.nome === padrao.nome ? 1 : 0));

  const lista = document.createElement('div');
  lista.className = 'conta-lista';
  const erro = document.createElement('p');
  erro.className = 'conta-erro';
  erro.hidden = true;

  const abrir = async (conta: ContaResumo) => {
    for (const b of lista.querySelectorAll('button')) b.disabled = true;
    erro.hidden = true;
    try {
      const { sessionId } = await api.newSession(project?.id, conta.nome);
      openTerminal({
        sessionId,
        projectId: project?.id ?? null,
        title: `Nova sessão · ${conta.nome}`,
        conta,
        bastao: true,
      });
    } catch (e) {
      for (const b of lista.querySelectorAll('button')) b.disabled = false;
      erro.textContent = `Não deu para abrir a sessão: ${(e as Error).message ?? e}`;
      erro.hidden = false;
    }
  };

  for (const conta of ordenadas) {
    const b = document.createElement('button');
    b.className = `conta-opcao${conta.nome === padrao.nome ? ' padrao' : ''}`;
    const detalhe = conta.nome === padrao.nome && project ? 'Padrão desta casa' : conta.finalidade === 'pessoal' ? 'Conta pessoal' : 'Conta de trabalho';
    b.innerHTML = `
      <span class="conta-dot ${conta.provedor}"></span>
      <span class="conta-texto"><b>${escapeHtml(conta.nome)}</b><small>${escapeHtml(detalhe)}</small></span>
      <span class="conta-seta">→</span>`;
    b.addEventListener('click', () => void abrir(conta));
    lista.append(b);
  }

  panel.body.innerHTML = `<p class="conta-pergunta">${contas.length === 1 ? 'Esta casa abre só nesta conta.' : 'Com qual modelo?'}</p>`;
  panel.body.append(lista, erro);
  panel.actions.append(button('Cancelar', () => (opts.voltar ? opts.voltar() : panel.close())));
}
