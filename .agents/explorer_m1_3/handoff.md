# Handoff Report: Sentence Mining Frontend Utility Exploration (Milestone 1 / R1)

## 1. Observation
- **Project Structure**:
  - `src/dialogo/` contains core dialogue components (`DialoGoApp.tsx`, `DialoGoPanel.tsx`, `TraducaoPanel.tsx`, `GuiaPanel.tsx`, `ConfiguracaoPanel.tsx`).
  - `src/dialogo/components/` contains UI components (`AjudaModal.tsx`, `PalavraNovaPopover.tsx`, `InteractiveText.tsx`, etc.).
  - `src/dialogo/hooks/` contains hooks (`useJapaneseTTS.ts`).
  - No utility folder exists within `src/dialogo/` yet. `src/lib/utils.ts` (lines 1-7) only contains the `cn` helper function for Tailwind CSS.
- **Existing TypeScript Types**:
  - `src/dialogo/DialoGoApp.tsx` (lines 9-31) exports `DialogoMode` and `DialogoContextData`.
  - `src/dialogo/components/PalavraNovaPopover.tsx` (lines 4-15) exports `StatusAdaptativo` and `PalavraAdaptativa`.
  - `historico` in `DialoGoPanel.tsx` (lines 114-121, 238-244) stores dialogue turn objects with fields `{ role, jp, pt, content, analise, score }`.
- **Tag Formatting in Dialogue Sentences**:
  - Japanese text in `historico` contains furigana annotations as HTML ruby tags (e.g., `<ruby>私<rt>わたし</rt></ruby>`) and optional word boundary tags (`<w>...</w>`).
  - `InteractiveText.tsx` (lines 165-176, 226-240) parses HTML ruby tags by extracting base kanji from `<ruby>` and removing contents of `<rt>` tags.

---

## 2. Logic Chain
1. **Utility Location**: Since `src/dialogo/components/` is dedicated to React UI components and `src/dialogo/hooks/` is for state hooks, placing non-React pure utility functions in a new `src/dialogo/utils/` directory (`src/dialogo/utils/sentenceMining.ts`) keeps the architecture modular and aligned with `PROJECT.md`.
2. **Type Integration**: Defining `DialogueTurn` and `MinedSentenceResult` interfaces in `src/dialogo/utils/sentenceMining.ts` ensures complete type safety for the `historico` search function without modifying existing type definitions in `DialoGoApp.tsx` or `PalavraNovaPopover.tsx`.
3. **Mining Algorithm**: Searching `historico` in reverse order (from `length - 1` down to `0`) guarantees that the most recent example sentence for a target word is extracted. Stripping `<rt>...</rt>` contents prior to removing generic HTML tags ensures clean base Japanese text (`exemplo_jp`) while preserving optional Portuguese translations (`exemplo_pt`).
4. **Verification Scenarios**: Specifying 6 detailed unit test scenarios (ST-01 to ST-06) covers all required operational conditions (word with PT, word without PT, nested ruby/w tags, word absent, reverse order priority, and empty/invalid inputs).

---

## 3. Caveats
- No source code files were modified during this read-only investigation.
- `historico` objects may originate from different AI providers or backend endpoints; key lookup checks both `msg.jp` and `msg.content` for resilience.
- The unit test scenarios assume a standard Vitest or Node test harness execution.

---

## 4. Conclusion
The proposed sentence mining utility should be implemented in `src/dialogo/utils/sentenceMining.ts` with re-exports in `src/dialogo/utils/index.ts`. It will seamlessly integrate into `src/dialogo/` without breaking any existing imports or TypeScript compilation.

---

## 5. Verification Method

### Steps to Verify Implementation
1. **File Inspection**: Verify existence of `src/dialogo/utils/sentenceMining.ts` and `src/dialogo/utils/index.ts`.
2. **Type Check**: Run TypeScript compilation check:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: 0 errors.
3. **Unit Test Execution**: Verify that all 6 test scenarios (ST-01 to ST-06 detailed in `analysis.md`) pass.
