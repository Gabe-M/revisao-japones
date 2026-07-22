# Execution Plan: KanaKanjiInput Component Implementation (Controlled React IME)

## Overview
Implement the `KanaKanjiInput` component in `DialoGoPanel` using controlled React IME architecture and spacebar trigger. Proxy Kanji conversions through `converter_kanji` in `api/dialogo.js` to Google Transliterate API with timeout/fallback resilience and full keyboard navigation.

## Execution Steps

### Phase 1: Deep Codebase Investigation & Dependency Verification
- **Step 1.1**: Dispatch 3 Explorers in parallel:
  - **Explorer 1 (Backend API & Proxy)**: Inspect `api/dialogo.js` to determine exact action dispatching, request/response format, parameters, and proxy implementation details for `http://www.google.com/transliterate?langpair=ja-Hira|ja&text={texto}`.
  - **Explorer 2 (Frontend IME & Input Architecture)**: Inspect `src/dialogo/DialoGoPanel.tsx`, `wanakana` package import/usage, and input field structure to plan `KanaKanjiInput.tsx` controlled component, buffer segmentation state (`committedText`, `compositionBuffer`), `wanakana.toKana()` in `onChange`, and event propagation.
  - **Explorer 3 (UI Popup & Keyboard Navigation)**: Inspect existing Shadcn UI components and design candidate popup UI, keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`), and error fallback/timeout state management.

### Phase 2: Milestone Execution

#### Milestone 6: Backend Proxy Action (`converter_kanji`)
- **Worker 1**: Update `api/dialogo.js` to handle `converter_kanji` action.
  - Accept `texto` (or `text`) query/body parameter.
  - Fetch `http://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(texto)}`.
  - Handle response formatting e.g. return candidate array e.g. `[["かな", ["仮名", "金", "かな"]]]` or structured JSON `{ status: 'SUCCESS', candidates: [...] }`.
  - Wrap in try/catch with proper HTTP status codes.

#### Milestone 7: Controlled IME `KanaKanjiInput` Component
- **Worker 1 / Worker 2**: Create `src/dialogo/components/KanaKanjiInput.tsx`.
  - Controlled React input state management:
    - NO `wanakana.bind()`.
    - Intercept `onChange`: convert user input using `wanakana.toKana(val, { IMEMode: true })` before React state update.
    - Buffer segmentation: tracking `committedText` (text before active word) and `compositionBuffer` (active word being edited).
    - `Spacebar` trigger on `onKeyDown`:
      - Intercept `Space` key (`e.key === ' '`).
      - Prevent default behavior (`e.preventDefault()`).
      - Check if `compositionBuffer` is non-empty. If non-empty, initiate `converter_kanji` fetch for active buffer.
    - Candidate popup:
      - Floating candidate popup positioned below/near input (Shadcn/Tailwind UI).
      - Keyboard navigation when popup is open:
        - `ArrowDown` / `ArrowUp`: navigate highlight index in candidates list.
        - `Enter`: select highlighted candidate, replace active composition buffer with selected candidate, append to committed text, close popup, and call `e.preventDefault()` to PREVENT chat message submission while popup is active.
        - `Escape`: close popup, keep raw kana in composition buffer.
    - Frontend resilience:
      - Wrap `converter_kanji` fetch in `try/catch` with a 3-5 second `AbortController` timeout.
      - If proxy fails, returns error, or times out: silently close popup and commit/keep raw kana buffer without crashing the interface.

#### Milestone 8: Integration in `DialoGoPanel.tsx`
- **Worker 2**: Integrate `KanaKanjiInput` into `src/dialogo/DialoGoPanel.tsx`.
  - Replace raw input/textarea with `<KanaKanjiInput value={...} onChange={...} onSend={...} ... />`.
  - Ensure regular message submission (pressing `Enter` when candidate popup is NOT active) triggers `onSendMessage`.
  - Verify styling fits existing Tailwind CSS v4 design.

#### Phase 3: Review, Stress Verification & Forensic Audit
- **Reviewer 1 & 2**: Code review for IME control, `wanakana` usage (verify NO `wanakana.bind()`), buffer segmentation, keyboard event handlers, try/catch timeout, and TS types.
- **Challenger 1 & 2**: Stress test candidate selection, Spacebar trigger, fast typing, API failure/timeout simulation, Enter key chat prevention when popup active, Escape cancellation.
- **Forensic Auditor**: Integrity verification (no dummy/hardcoded candidate returns, no DOM mutations via `wanakana.bind()`, genuine API proxy calls).
- **Build Verification**: Run `npm run build` to verify no compilation/TypeScript errors.

### Phase 4: Final Reporting & Handoff
- Update `progress.md` and `PROJECT.md`.
- Produce final `handoff.md` and report project completion.
