# Project: DialoGo KanaKanjiInput Component & IME Architecture

## Architecture
- **Frontend Stack**: React, TypeScript, Vite, Tailwind CSS v4, Shadcn UI (`components/ui/...`).
- **Backend API**: Node.js serverless handlers in `api/` (`api/dialogo.js`, `api/jisho.js`, `api/srs.js`).
- **Data Stores**: Supabase (`srs_progresso`, `vocabulario`, `dialogo_sessoes`).
- **Auth**: `session.access_token` passed from `DialoGoApp.tsx` down to components and sent as `Authorization: Bearer <token>` header.
- **IME Architecture**: Controlled React IME (`wanakana.toKana()` in `onChange` - strictly NO `wanakana.bind`), buffer segmentation (committed text + active composition buffer), spacebar trigger on active buffer, backend proxy `converter_kanji` (Google Transliterate API), resilient timeout/fallback, keyboard navigation (ArrowUp/Down/Enter/Escape).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1-M5 | DialoGo Features R1-R4 & Initial Verification | Backend & Frontend R1-R4 implementation | None | DONE |
| M6 | Backend Proxy Action (`converter_kanji`) | `api/dialogo.js` GET/POST proxy to Google Transliterate API (`http://www.google.com/transliterate?langpair=ja-Hira|ja&text={texto}`) | None | DONE |
| M7 | Frontend `KanaKanjiInput` Component | `src/dialogo/components/KanaKanjiInput.tsx` controlled IME, buffer segmentation, spacebar trigger, suggestions popup, keyboard nav, timeout fallback | M6 | DONE |
| M8 | `DialoGoPanel.tsx` Integration | Integrate `KanaKanjiInput` in `DialoGoPanel.tsx`, wiring `onSendMessage` and prop drilling | M7 | DONE |
| M9 | Final Verification & Forensic Audit | `npm run build`, Reviewer review (Reviewers 1 & 2 PASS), Challenger stress tests (Challengers 1 & 2 PASS), Forensic Auditor integrity check (VERDICT: CLEAN) | M6, M7, M8 | DONE |

## Interface Contracts
### API Handlers
- `GET/POST /api/dialogo` (action: `converter_kanji`, query/body: `texto`): Proxies GET to `http://www.google.com/transliterate?langpair=ja-Hira|ja&text={texto}`, returns parsed JSON array e.g. `{ status: 'SUCCESS', candidates: ["仮名", "金", "かな", "カナ"] }`.
- `POST /api/dialogo` (action: `analisar_pratica`): returns `{ erros_detalhados: Array<{ erro: string, regra_gramatical: string, explicacao: string, exemplo_correto: string }> }`.
- `POST /api/dialogo` (action: `sugerir_multiplas_respostas`): returns `{ sugestoes: Array<{ intencao: string, emoji: string, jp: string, pt: string, dica: string }> }`.

## Code Layout
- `api/dialogo.js`: Serverless function handling AI prompts, dialog actions, and `converter_kanji` proxy.
- `src/dialogo/DialoGoApp.tsx`: Parent container holding state & session.
- `src/dialogo/DialoGoPanel.tsx`: Main chat panel UI integrating `KanaKanjiInput`.
- `src/dialogo/components/KanaKanjiInput.tsx`: Controlled React IME input with Kanji conversion candidate popup.
- `src/dialogo/components/AjudaModal.tsx`: Modal for help, grammar analysis, suggestions, vocabulary.
- `src/dialogo/components/ProgressoDrawer.tsx`: Session statistics and history drawer.
