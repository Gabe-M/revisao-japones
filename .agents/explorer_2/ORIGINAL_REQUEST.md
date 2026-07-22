## 2026-07-21T22:47:56Z
Analyze `src/dialogo/components/AjudaModal.tsx`, `src/dialogo/DialoGoApp.tsx`, and associated components for requirements R1, R2, R3.
Specifically:
1. Examine how `AjudaModal.tsx` receives props (including `session`), handles state for help tabs, displays errors from `analisar_pratica`, handles response suggestions from `sugerir_multiplas_respostas`, and displays extracted vocabulary.
2. For R1: Identify how string error rendering can be replaced with Shadcn `Accordion` mapping `erros_detalhados`.
3. For R2: Identify how the "Sugestão" button triggers `sugerir_multiplas_respostas` and how to render 3 Shadcn `Card`s (Concordar, Discordar, Perguntar) with "✏️ Praticar" (pre-fill input) and "✅ Usar direto" (send message directly).
4. For R3: Identify how each word in "Vocabulário Extraído" tab can have a "💾 Salvar" button executing dual POST requests to `/api/jisho?acao=salvar` and `/api/srs?acao=salvar` using `session.access_token` header `Authorization: Bearer <token>`, with loading state and disabled "✅ Salvo" text upon success.
5. Document all findings, component structure, state management, line references, and exact modification requirements in `c:\Users\Fabiano\Downloads\sites\japones\.agents\explorer_2\analysis.md`.
6. Deliver your handoff report.
