# Dev Valley — Retrabalho

> Guardrail G17: uma linha por retrabalho causado por suposição, invenção ou ferramenta cara à toa, com data e causa.
> Três linhas da mesma causa pedem um guardrail novo.

| Data | O que foi refeito | Causa |
|---|---|---|
| 2026-10-26 | Mod dev-valley (PD-11) reescrito de eventos `classic.*` para eventos nativos, e a permissão voltou ao hook de shell | Supus que um mod de usuário recebe os eventos `classic.*`; validei com `claude plugin test` (que não tem o plugin de segurança acima) e não numa sessão real antes de pedir o install |
