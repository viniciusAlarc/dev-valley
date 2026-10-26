# Operação local — subir, derrubar e reiniciar

> Como o sistema sobe na máquina de desenvolvimento. A tabela logo abaixo segue o formato do G14
> (lado, pasta, comando, porta); o resto é para gente.

## Subir (lido pela Fábrica de agentes)

<!-- Uma linha por lado. Comando que fica em primeiro plano: sem &, sem kill, sem tail -f. Pipe = \|.
     Célula de comando vazia = a Fábrica não liga aquele lado. -->

| Lado | Pasta | Comando | Porta |
|------|-------|---------|-------|
| back | `.` | `npm start` | 4777 |
| front | | | |

O front não tem processo próprio: `npm start` gera o build do `web/` e o servidor o serve na mesma porta.

## Pré-requisitos

- Node LTS (fnm) dentro do WSL e `npm install` na raiz.
- `claude` no PATH: o terminal da vila e a bibliotecária chamam o CLI.
- `jq` e `curl`: usados pelos hooks e pela status line instalados com `npm run hooks:install`.
- O hook de moradores roda com o node que rodou o `npm run hooks:install` (caminho absoluto): trocou a versão do
  node no fnm, rodar o install de novo.
- Sem `.env` e sem segredo.

## Ver o que está rodando

```bash
ss -ltnp | grep -E ':(4777|5173) '
```

## Desligar e subir de novo

**Antes de reiniciar:** todo terminal aberto na vila é processo filho do servidor. Reiniciar o servidor encerra
todas as sessões do Claude Code abertas pela vila, inclusive uma que esteja editando este repositório. Terminar o
trabalho delas primeiro.

```bash
cd ~/Documents/Desenvolvimento/dev-valley && npm start
```

Desenvolvimento com hot reload: `npm run dev` (front em http://localhost:5173). O servidor roda com `tsx watch` e
**reinicia sozinho a cada arquivo salvo em `server/`**, derrubando os terminais da vila. Não usar `npm run dev`
enquanto o trabalho estiver sendo feito por uma sessão aberta dentro da própria vila.

## Quando alguma coisa não sobe

- Porta 4777 ocupada: outro `npm start` ainda está de pé (`ss -ltnp | grep 4777`).
- Arquivo editado pelo lado Windows (`\\wsl.localhost\...`) não dispara o watcher do Vite/tsx: reiniciar o processo.
