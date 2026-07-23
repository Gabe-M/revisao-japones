# Handoff Report: Sentence Mining Frontend Utility Analysis (Milestone 1 - R1)

## 1. Observation

1. **Existing Tag Cleaning Functions**:
   - `src/dialogo/hooks/useJapaneseTTS.ts` (lines 11-13):
     ```ts
     const textoLimpo = texto
         .replace(/<rt>.*?<\/rt>/g, '')
         .replace(/<[^>]+>/g, '');
     ```
   - `src/dialogo/components/PhraseCard.tsx` (line 38): `const cleanJpText = jp.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '');`
   - `src/dialogo/DialoGoPanel.tsx` (lines 270-271) & `TraducaoPanel.tsx` (lines 158-159): `.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '')`
   - `src/dialogo/components/AjudaModal.tsx` (lines 182, 359) & `api/dialogo.js` (line 1111): `str.replace(/<[^>]*>/g, '')` (Naive replacement retaining `<rt>` contents).
   - `src/components/InteractiveText.tsx` (line 165): `const stripTags = (str: string) => str.replace(/<\/?(?:w|rt|ruby|rp)[^>]*>/gi, '');`

2. **`historico` Object Structure**:
   - Inspected `DialoGoPanel.tsx` (lines 114-121, 148-152, 238-243) and `api/dialogo.js` (lines 1078-1084):
     `historico` is an array of objects:
     - `role`: `'user' | 'assistant'`
     - `jp`: `string` (Japanese sentence; AI messages contain `<ruby>...<rt>...</rt></ruby>` and `<w>` tags; user messages contain raw user input text).
     - `pt`: `string | undefined` (Portuguese translation for AI assistant messages; absent/undefined for user messages).
     - `content`: `string` (Fallback string matching `jp`).

---

## 2. Logic Chain

1. **Observation 1** shows that naive tag replacement `replace(/<[^>]*>/g, '')` (used in `AjudaModal.tsx` and `api/dialogo.js`) strips tag brackets but keeps furigana contents (`<ruby>猫<rt>ねこ</rt></ruby>` -> `"猫ねこ"`).
2. **Observation 1** also shows that two-pass replacement `.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '')` (used in `useJapaneseTTS.ts` and `PhraseCard.tsx`) is effective for simple `<rt>` tags, but fails on multiline `<rt>` blocks, `<rp>` tags (leaving parenthesis `(` and `)`), uppercase/mixed case HTML tags, and malformed LLM outputs (e.g. unclosed `<rt>` or detached `<rt>`).
3. **Observation 2** shows that `historico` items contain the Japanese text in `msg.jp` (or `msg.content`) and Portuguese translation in `msg.pt`.
4. Therefore, a complete sentence mining utility must:
   - Provide a robust multi-pass tag cleaner `cleanJapaneseText(html: string)` that normalizes malformed ruby tags, removes `<rt>` AND `<rp>` tags with their inner contents across multiple lines (`[\s\S]*?`), strips remaining HTML/Markdown, and unescapes HTML entities.
   - Implement `extractSentenceForWord(historico: any[], palavra: string)` to search `historico` backwards (`i = length - 1` down to `0`), matching `palavra` against `cleanJapaneseText(msg.jp)`, and returning `{ exemplo_jp: cleanedJp, exemplo_pt: msg.pt || null }`.

---

## 3. Caveats

- **No Source Code Modified**: As per read-only explorer constraints, no source files were created or modified in `src/`. The recommended implementation code is detailed in `c:\Users\Fabiano\Downloads\sites\japones\.agents\explorer_m1_2\analysis.md`.
- **Assumptions**: Assumes `historico` passed to `extractSentenceForWord` follows the standard array of message objects found in `DialoGoPanel.tsx`. Defensive checks (`Array.isArray`, null checks) are included to handle empty or malformed inputs cleanly.

---

## 4. Conclusion

The analysis and design for Milestone 1 (R1) sentence mining utility are complete.
- **Recommended File Location**: `src/dialogo/utils/sentenceMining.ts`
- **Utility Exports**: `cleanJapaneseText(html: string): string` and `extractSentenceForWord(historico: any[], palavra: string): SentenceMiningResult`.
- **Target Clean Output**: Safely cleans `<ruby>` furigana without text concatenation (e.g. `<ruby>日本<rt>にほん</rt></ruby>` -> `"日本"`), correctly extracts `exemplo_jp` and `exemplo_pt`, and handles all edge cases gracefully.

---

## 5. Verification Method

1. **Code Inspection**:
   - View `c:\Users\Fabiano\Downloads\sites\japones\.agents\explorer_m1_2\analysis.md` for full implementation plan and code specifications.
2. **Type Check**:
   - Run `npx tsc --noEmit` after implementation to verify type safety.
3. **Invalidation Conditions**:
   - If `cleanJapaneseText` leaves furigana reading text concatenated to kanji (e.g. `"猫ねこ"`).
   - If `extractSentenceForWord` fails to return `null` on empty `historico` or non-matching `palavra`.
