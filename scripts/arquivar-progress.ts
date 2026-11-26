/**
 * Arquiva o `PROGRESS.md`: entregas já conferidas de meses fechados vão para `docs-dev/progresso/AAAA-MM.md`; o
 * `PROGRESS.md` fica com o mês corrente, o que não tem data e o que ainda diz "Falta conferir na vila" (o sino só lê
 * ele). O diário do atril continua mostrando tudo (`readProgressComArquivo`). Decisão do usuário, 24/11/2026.
 *
 *   npx tsx scripts/arquivar-progress.ts [pasta-do-projeto] [--mes AAAA-MM]
 *
 * `--mes` é o mês corrente (o padrão é o de hoje): só sai o que é anterior a ele. Rodar de novo é seguro.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ARQUIVO_DIR, separarParaArquivo } from '../server/src/progress.js';

const args = process.argv.slice(2);
const iMes = args.indexOf('--mes');
const hoje = new Date();
const mesAtual = iMes >= 0 ? args[iMes + 1] : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const dir = path.resolve(args.find((a, i) => !a.startsWith('--') && (iMes < 0 || i !== iMes + 1)) ?? '.');
if (!/^\d{4}-\d{2}$/.test(mesAtual ?? '')) throw new Error('--mes precisa ser AAAA-MM');

const arquivoProgress = path.join(dir, 'PROGRESS.md');
const texto = fs.readFileSync(arquivoProgress, 'utf8');
const { fica, porMes } = separarParaArquivo(texto, mesAtual);
if (!porMes.size) {
  console.log(`Nada a arquivar em ${arquivoProgress} (antes de ${mesAtual}, tudo ainda espera conferência ou não tem data).`);
  process.exit(0);
}

const titulo = (texto.split('\n')[0] || '# Progresso').trim();
const dataDe = (bloco: string) => bloco.match(/^##\s+(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
fs.mkdirSync(path.join(dir, ARQUIVO_DIR), { recursive: true });
let total = 0;
// O arquivo é gravado antes de o PROGRESS.md encolher: se algo falhar no meio, a entrega fica duplicada, nunca perdida.
for (const [mes, novos] of porMes) {
  const destino = path.join(dir, ARQUIVO_DIR, `${mes}.md`);
  const existentes = fs.existsSync(destino)
    ? fs.readFileSync(destino, 'utf8').split(/^(?=## )/m).slice(1).map((b) => b.trimEnd())
    : [];
  // Mais recente no topo; mesma data mantém a ordem (sort estável).
  const blocos = [...novos, ...existentes].sort((a, b) => dataDe(b).localeCompare(dataDe(a)));
  const cabecalho = `${titulo} (${mes}, arquivo)\n\n> Entregas já conferidas, tiradas do PROGRESS.md por \`scripts/arquivar-progress.ts\`. Mais recente no topo.\n`;
  fs.writeFileSync(destino, `${cabecalho}\n${blocos.join('\n\n')}\n`);
  total += novos.length;
  console.log(`${novos.length} entrega(s) → ${destino}`);
}
fs.writeFileSync(arquivoProgress, fica);
console.log(`${total} entrega(s) arquivada(s); o PROGRESS.md ficou com ${fica.split('\n').length} linhas.`);
