---
paths:
  - "server/src/consulta.ts"
  - "server/src/librarian.ts"
  - "server/src/administrador.ts"
  - "server/src/mirim.ts"
  - "server/src/clinica.ts"
  - "server/src/escrevente.ts"
  - "server/src/jornal.ts"
  - "server/src/critico.ts"
  - "server/src/perfil.ts"
  - "server/agents/**"
---

# Regra 5 do CLAUDE.md, por inteiro: agentes da vila

Consultas da bibliotecária, do administrador da praça, do maestro mirim, da médica da clínica, do escrevente do
pombal, do jornaleiro da banca e do crítico e do verificador do cartão usam `claude -p --no-session-persistence`
para não virarem moradores (base comum em `server/src/consulta.ts`).

- **Os agentes que só leem** (bibliotecária, maestro mirim, médica, escrevente, jornaleiro, jornaleiro da conversa e
  crítico do cartão) **respondem na conta DeepSeek de `agentes.conta`** do config local, com a mesma trava de chave do
  terminal, para continuarem disponíveis quando o Claude está no limite; o **administrador**, único que edita
  arquivos, continua no Claude (decisão do usuário, 19/11/2026).
- **O administrador só edita `PROGRESS.md`, `PENDENCIAS.md`, `docs-dev/painel.json` e `docs-dev/a-codar/` dos
  projetos da vila**, por regra `Edit(//caminho)` passada na chamada; nunca liberar `Edit` inteiro nem outra
  ferramenta de escrita para ele.
- **O maestro mirim só lê** (Read, Grep, Glob e `git -C <projeto> status/diff/log/show`, em modo estrito: o resto é
  negado mesmo com o `auto` do usuário) e não fala com o maestro nem com as sessões (decisão do usuário, 04/11/2026).
- **A médica também só lê** (Read, Grep e Glob, em modo estrito; a ficha com processos e máquina vem montada pela
  vila) e não fala com a sessão examinada nem encerra processo (decisão do usuário, 09/11/2026).
- **O crítico do cartão e o verificador dele só leem** (Read, Grep e Glob, em modo estrito; o verificador fica no
  Claude, Haiku, para a outra família conferir) e **só avisam** no cartão do porão: nunca bloqueiam o clique nem
  mexem no briefing (decisão do usuário, 21/11/2026).
