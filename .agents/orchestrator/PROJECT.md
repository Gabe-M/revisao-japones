# Project: DialoGo Feature Implementation

## Architecture
- **Frontend Stack**: React, TypeScript, Vite, Tailwind CSS v4, Shadcn UI (`components/ui/...`).
- **Backend API**: Node.js serverless handlers in `api/` (`api/dialogo.js`, `api/jisho.js`, `api/srs.js`).
- **Data Stores**: Supabase (`srs_progresso`, `vocabulario`, `dialogo_sessoes`).
- **Auth**: `session.access_token` passed from `DialoGoApp.tsx` down to components and sent as `Authorization: Bearer <token>` header.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Structured Grammar Explanations (R1) | `api/dialogo.js` backend prompt + JSON parse; `AjudaModal.tsx` Accordion render | None | DONE |
| M2 | Contextual Response Suggestions (R2) | `AjudaModal.tsx` render 3 Cards for `sugerir_multiplas_respostas` (Concordar, Discordar, Perguntar) with "Praticar" & "Usar direto" buttons | None | DONE |
| M3 | Vocabulary & SRS Dual Persistence (R3) | `AjudaModal.tsx` "Vocabulário Extraído" tab button "Salvar" with dual fetch to `/api/jisho?acao=salvar` and `/api/srs?acao=salvar` using token | None | DONE |
| M4 | Session Progress Stats Drawer (R4) | `DialoGoPanel.tsx` button "📊 Progresso" + Shadcn Sheet/Drawer component displaying current session metrics, Supabase history, error grouping | M1 | DONE |
| M5 | Final E2E Build & Audit | Final `npm run build` check, code quality & integrity verification | M1, M2, M3, M4 | DONE |

## Interface Contracts
### API Handlers
- `POST /api/dialogo` (action: `analisar_pratica`): returns `{ erros_detalhados: Array<{ erro: string, regra_gramatical: string, explicacao: string, exemplo_correto: string }> }`.
- `POST /api/dialogo` (action: `sugerir_multiplas_respostas`): returns `{ sugestoes: Array<{ intencao: string, emoji: string, jp: string, pt: string, dica: string }> }`.
- `POST /api/jisho?acao=salvar`: body `{ item, leitura, significado, categoria, jlpt }`, header `Authorization: Bearer <token>`.
- `POST /api/srs?acao=salvar`: body `{ item, repetitions: 0, due: Date.now(), ... }`, header `Authorization: Bearer <token>`.

## Code Layout
- `api/dialogo.js`: Serverless function handling AI prompts and dialog actions.
- `src/dialogo/DialoGoApp.tsx`: Parent container holding state & session.
- `src/dialogo/DialoGoPanel.tsx`: Main chat panel UI.
- `src/dialogo/components/AjudaModal.tsx`: Modal for help, grammar analysis, suggestions, vocabulary.
- `src/dialogo/components/ProgressoDrawer.tsx`: Session statistics and history drawer.
- `src/components/ui/accordion.tsx`: Shadcn Accordion component.
- `src/components/ui/sheet.tsx`: Shadcn Sheet drawer component.
