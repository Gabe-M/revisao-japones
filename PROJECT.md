# Project: AnkiConnect Data Enrichment & Export Pipeline

## Architecture
- **Frontend**: Sentence mining utility scanning session history backwards for word examples, UI integration in `AjudaModal.tsx` and `PalavraNovaPopover.tsx` using Shadcn `useToast` hook.
- **Service Layer**: `src/dialogo/services/ankiService.ts` communicating with AnkiConnect API (`http://127.0.0.1:8765`), handling auto-creation of deck "DialoGo::Vocabulario" and model "DialoGo Japones" (7 fields), and error handling for connection refused.
- **Backend API**: `api/dialogo.js` handling `case 'enriquecer_card'`, fetching Jisho API for readings, categories, JLPT level, and English definitions, calling LLM (`callAI`) for strict Portuguese translation (and `exemplo_jp` translation if `exemplo_pt` is null), authenticated via `session.access_token` in `Authorization` header.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | R1 Sentence Mining | Utitary function for history search & HTML/ruby tag cleaning | None | DONE |
| 2 | R2 Enrichment Layer | `api/dialogo.js` backend handler `enriquecer_card` (Jisho + LLM translation) | None | DONE |
| 3 | R3 AnkiConnect Integration | `src/dialogo/services/ankiService.ts` (deck, model, addNote, connection error handling) | None | DONE |
| 4 | R4 UI Integration | Shadcn `useToast`, `AjudaModal.tsx`, `PalavraNovaPopover.tsx` button and notifications | M1, M2, M3 | PLANNED |
| 5 | Verification & Build | Full TypeScript compilation check (`npx tsc --noEmit`) and E2E verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Frontend ↔ Backend (`api/dialogo.js`)
- **Request**: Action `enriquecer_card`, payload `{ palavra, exemplo_jp, exemplo_pt }`, `Authorization: Bearer <session.access_token>`
- **Response**: JSON `{ item, leitura, significado, categoria, jlpt, exemplo_jp, exemplo_pt }`

### Service Layer ↔ AnkiConnect (`http://127.0.0.1:8765`)
- Deck: `"DialoGo::Vocabulario"`
- Model: `"DialoGo Japones"` (Fields: `Item`, `Leitura`, `Significado`, `Categoria`, `JLPT`, `Exemplo_JP`, `Exemplo_PT`)
- Note Payload: mapped fields from enriched JSON item.
- Error handling: Catch `ERR_CONNECTION_REFUSED` / fetch failure, trigger toast `"Anki não está aberto ou AnkiConnect falhou"`.

## Code Layout
- `api/dialogo.js` — Vercel Serverless / Node backend handler.
- `src/dialogo/services/ankiService.ts` — AnkiConnect integration service.
- `src/dialogo/` — Sentence mining utility & components.
- `src/components/ui/` — Toast components and hooks (`use-toast.ts` / `useToast`).
