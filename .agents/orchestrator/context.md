# Context & Requirements

## Requirements Summary
1. **R1**: `api/dialogo.js` prompt for `analisar_pratica` returns `erros_detalhados` (`[{ erro, regra_gramatical, explicacao, exemplo_correto }]`). `AjudaModal.tsx` renders this using Shadcn Accordion.
2. **R2**: `AjudaModal.tsx` handles `sugerir_multiplas_respostas` returning array of 3 options, rendering 3 Shadcn Cards (Concordar, Discordar, Perguntar) with "✏️ Praticar" and "✅ Usar direto" buttons.
3. **R3**: `AjudaModal.tsx` "Vocabulário Extraído" has "💾 Salvar" button. Dual POST to `/api/jisho?acao=salvar` and `/api/srs?acao=salvar` with `Authorization: Bearer <session.access_token>`. Success turns button into disabled "✅ Salvo".
4. **R4**: `DialoGoPanel.tsx` has "📊 Progresso" button opening Shadcn Sheet/Drawer without unmounting state. Displays current session turn count & score %, Supabase `dialogo_sessoes` past sessions history, and grouped error breakdown (from `regra_gramatical`).

## Technical Constraints
- Stack: Shadcn UI + Tailwind CSS v4 only.
- Resilience: All `/api/dialogo`, `/api/jisho`, `/api/srs` calls wrapped in try/catch with visual error feedback (Toast/alert).
- Auth: `session.access_token` prop-drilled and sent via `Authorization: Bearer <token>` header.
- Build: `npm run build` succeeds without TypeScript errors.
