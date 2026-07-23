# Execution Plan: AnkiConnect Data Enrichment & Export Pipeline

## Milestone Overview

### Milestone 1: R1 Sentence Mining (Frontend)
- Task: Implement utility function searching `historico` backwards for the last occurrence of `palavra`.
- Extract `Exemplo_JP` (cleaning ruby `<ruby>...<rt>...</rt></ruby>` and HTML tags) and `Exemplo_PT` (or null).
- Location: frontend utility in `src/dialogo/` directory.

### Milestone 2: R2 Enrichment Layer (Backend `api/dialogo.js`)
- Task: Add `case 'enriquecer_card'` in `api/dialogo.js`.
- Fetch `https://jisho.org/api/v1/search/words?keyword=${palavra}`.
- Extract reading, category, JLPT level, English definitions.
- Call LLM (`callAI`) to translate definitions to strict Portuguese (and translate `exemplo_jp` if `exemplo_pt` is null).
- Ensure authorization via `session.access_token` in `Authorization` header.
- Return JSON `{ item, leitura, significado, categoria, jlpt, exemplo_jp, exemplo_pt }`.

### Milestone 3: R3 AnkiConnect Integration (`ankiService.ts`)
- Task: Create `src/dialogo/services/ankiService.ts`.
- Auto-create deck `"DialoGo::Vocabulario"`.
- Auto-create model `"DialoGo Japones"` with 7 fields (`Item`, `Leitura`, `Significado`, `Categoria`, `JLPT`, `Exemplo_JP`, `Exemplo_PT`) if not present.
- `addNote` function mapping enriched JSON payload.
- Catch `ERR_CONNECTION_REFUSED` / fetch errors on local calls (`http://127.0.0.1:8765`) and fire toast error `"Anki não está aberto ou AnkiConnect falhou"`.

### Milestone 4: R4 UI Integration (`AjudaModal.tsx`, `PalavraNovaPopover.tsx` & Toast)
- Task: Set up/verify Shadcn UI `useToast` hook.
- Integrate `ankiService.ts` and `useToast` in `AjudaModal.tsx` and `PalavraNovaPopover.tsx`.
- Add "🎴 Adicionar ao Anki" button with disabled state & spinner during processing, and success toast notification upon completion.

### Milestone 5: Verification & E2E Validation
- Verification: `npx tsc --noEmit` build test.
- Forensic audit: Integrity check for genuine implementation (no facade, no hardcoded values).

## Execution Strategy
Each milestone will be executed using the Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
