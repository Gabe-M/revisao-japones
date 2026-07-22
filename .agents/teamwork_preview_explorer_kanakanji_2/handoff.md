# Handoff Report — Explorer (Controlled React IME Architecture)

## 1. Observation
- `package.json` contains `"wanakana": "^5.3.1"` in `dependencies` (line 48) and `"@types/wanakana": "^4.0.6"` in `devDependencies` (line 54).
- `DialoGoPanel.tsx` imports `wanakana` at line 4, and imperatively binds it in `useEffect` at lines 72–82 (`wanakana.bind(inputEl)`).
- `DialoGoPanel.tsx` uses `<Input value={inputUser} onChange={e => setInputUser(e.target.value)} />` at lines 494–502.
- `AjudaModal.tsx` demonstrates controlled `wanakana.toHiragana(part, { IMEMode: true })` inside `onChange` at lines 94–126, confirming that controlled Romaji-to-Kana interceptor pattern works without `wanakana.bind()`.
- API endpoint `/api/jisho` accepts `termo` query param for Japanese vocabulary/kanji search.

## 2. Logic Chain
- `wanakana.bind(inputEl)` directly manipulates the DOM `HTMLInputElement.value`.
- React controlled inputs (`value={inputUser}`) re-render component state, overwriting raw DOM values and causing race conditions (cursor jumping, missing letters, corrupted keystrokes).
- Imperative binding offers no mechanism for buffer segmentation or Kanji conversion candidate menus.
- Therefore, replacing `wanakana.bind()` with a dedicated controlled component (`KanaKanjiInput.tsx`) that intercepts input in `onChange` with `wanakana.toKana(raw, { IMEMode: true })` fixes React rendering bugs while enabling buffer segmentation and Kanji conversion popovers.

## 3. Caveats
- Read-only investigation: source code in `src/dialogo/DialoGoPanel.tsx` has not been modified yet.
- Kanji conversion candidate lookup relies on `/api/jisho` endpoint or candidate dictionary mapping.
- Browser native Japanese IME composition events (`onCompositionStart`, `onCompositionEnd`) should be handled gracefully alongside Romaji typing interceptors to avoid double-transforming native Japanese keyboard inputs.

## 4. Conclusion
- The controlled React IME architecture plan for `src/dialogo/components/KanaKanjiInput.tsx` is completely designed and documented in `.agents/teamwork_preview_explorer_kanakanji_2/analysis.md`.
- Key specifications defined:
  1. No `wanakana.bind()`. Controlled state with `onChange` interceptor using `wanakana.toKana(val, { IMEMode: true })`.
  2. Buffer segmentation logic separating `committedText` and `compositionBuffer`.
  3. Clear props contract (`value`, `onChange`, `onSendMessage`, `placeholder`, `disabled`, `mode`, `onModeChange`).
  4. Full key handling (Space for Kanji candidate lookup/cycle, Enter for candidate select / commit / send message, Escape for candidate close).
  5. Detailed refactoring instructions for `DialoGoPanel.tsx`.

## 5. Verification Method
- Code inspection: Check `analysis.md` for complete proposed React implementation of `KanaKanjiInput.tsx` and refactoring steps for `DialoGoPanel.tsx`.
- Build verification: Run `npm run build` or `npx tsc --noEmit` after implementer component creation to ensure full TypeScript type compliance.
- Functional verification: Test typing romaji (`nihon`), pressing `Space` for Kanji (`日本`), and pressing `Enter` to submit.
