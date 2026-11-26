---
paths:
  - "server/src/pombal.ts"
  - "web/src/ui/pombal.ts"
  - "server/tests/pombal.test.ts"
  - "docs-dev/context/pombal.md"
---

# Regra 9 do CLAUDE.md, por inteiro: o push do pombal

O pombal (`server/src/pombal.ts`) faz push numa branch que outras pessoas podem usar.

- Push só por **clique confirmado no painel** e só de **página local**.
- Nunca `--force`: o git só aceita fast-forward.
- Conflito no rebase sempre termina em `rebase --abort` (o repositório fica como estava).
