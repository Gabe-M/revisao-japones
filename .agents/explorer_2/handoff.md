# Handoff Report — Explorer 2 (AjudaModal Explorer)

## 1. Observation

- **Target Files Analyzed**:
  - `src/dialogo/components/AjudaModal.tsx` (748 lines)
  - `src/dialogo/DialoGoPanel.tsx` (405 lines)
  - `src/dialogo/DialoGoApp.tsx` (309 lines)
  - `api/jisho.js` (lines 55-90)
  - `api/srs.js` (lines 58-95)
  - `api/dialogo.js` (lines 1196-1235)
- **Key Findings**:
  1. **Prop & Auth Gap**: In `DialoGoPanel.tsx:395`, `<AjudaModal>` is rendered without the `session` prop. In `AjudaModal.tsx:12-18`, `AjudaModalProps` lacks `session`. In `callEndpoint` (`AjudaModal.tsx:119-139`), no `Authorization` header is attached.
  2. **Shadcn Component Gap (R1)**: `src/components/ui/` contains `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `scroll-area.tsx`, `select.tsx`, `tabs.tsx`, but **lacks `accordion.tsx`**.
  3. **R1 Error Output**: `AjudaModal.tsx:380-386` currently maps a simple `analisePratica.erros` string array.
  4. **R2 Suggestion Output**: `AjudaModal.tsx:43, 221-233, 419-462` currently uses a single `sugestao` state object and calls action `'sugerir_resposta'`. The backend `api/dialogo.js:1196` supports action `'sugerir_multiplas_respostas'` returning `sugestoes: Array<{ intencao, emoji, jp, pt, dica }>`.
  5. **R3 Vocabulary Extraction**: `AjudaModal.tsx:587-612` renders extracted vocabulary items but does not include any "💾 Salvar" button or dual fetch logic.

---

## 2. Logic Chain

1. **Auth & Session Integration**: Rule 16 mandates prop drilling for `session` and header `Authorization: Bearer <token>`. Passing `session` from `DialoGoPanel` to `AjudaModal` enables `callEndpoint` as well as the dual fetch operations in R3 to execute authenticated requests.
2. **R1 (Shadcn Accordion)**: The backend `analisar_pratica` action returns structured error details `erros_detalhados: Array<{ erro, regra_gramatical, explicacao, exemplo_correto }>`. Adding `src/components/ui/accordion.tsx` allows replacing lines 380-386 in `AjudaModal.tsx` with an interactive accordion that expands each error trigger to display the grammar rule, explanation, and correct interactive example.
3. **R2 (3 Cards for Suggestions)**: Action `'sugerir_multiplas_respostas'` returns an array of 3 contextual suggestions (Concordar, Discordar, Perguntar). Updating state `sugestoes` and mapping them into 3 Shadcn `Card` components with "✏️ Praticar" (`usarSugestaoNoCampo`) and "✅ Usar direto" (`onUsarResposta`) satisfies R2 while retaining existing input filling and direct sending helper functions.
4. **R3 (Dual Persistence)**: `/api/jisho?acao=salvar` persists terms to the `vocabulario` table while `/api/srs?acao=salvar` initializes SRS progress in `srs_progresso`. Executing both in `handleSalvarVocabulario` with `session.access_token` and tracking state per item via `salvandoMap` / `salvosMap` provides clear visual feedback ("Salvando..." -> "✅ Salvo" disabled).

---

## 3. Caveats

- `src/components/ui/accordion.tsx` must be created or added via Shadcn CLI before importing it in `AjudaModal.tsx`.
- For backward compatibility and resilience, if `erros_detalhados` is missing in older backend responses, `AjudaModal.tsx` should fall back to rendering string error array `analisePratica.erros`.
- Suggestion payloads may return keys `intencao` or `tipo`, `jp` or `texto_jp`, `pt` or `traducao_pt`. The frontend implementation uses fallback expressions (`s.jp || s.texto_jp`) for robust parsing.

---

## 4. Conclusion

All technical requirements for R1, R2, and R3 have been fully analyzed and documented with precise line numbers, component dependencies, state changes, and API contracts in `c:\Users\Fabiano\Downloads\sites\japones\.agents\explorer_2\analysis.md`. The implementer can immediately follow `analysis.md` to make the exact code changes.

---

## 5. Verification Method

To verify the investigation and subsequent implementation:
1. **TypeScript Build Verification**: Run `npx tsc --noEmit` or `npm run build`.
2. **R1 Accordion Check**: In `AjudaModal.tsx`, verify `erros_detalhados` maps to `AccordionTrigger` and `AccordionContent`.
3. **R2 3 Cards Check**: In `AjudaModal.tsx`, verify "Sugestão" triggers `sugerir_multiplas_respostas` and renders 3 `Card` elements for Concordar, Discordar, Perguntar.
4. **R3 Dual Fetch Check**: In `AjudaModal.tsx` "Vocabulário Extraído" tab, click "💾 Salvar" and verify dual network requests to `/api/jisho?acao=salvar` and `/api/srs?acao=salvar` with header `Authorization: Bearer <token>`.
