## 2026-07-21T23:36:28Z

<USER_REQUEST>
You are a Worker subagent responsible for creating the KanaKanjiInput component and integrating it into DialoGoPanel.tsx.

Working directory: c:\Users\Fabiano\Downloads\sites\japones\.agents\teamwork_preview_worker_kanakanji_2
Project root: c:\Users\Fabiano\Downloads\sites\japones

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Read `c:\Users\Fabiano\Downloads\sites\japones\.agents\teamwork_preview_explorer_kanakanji_2\analysis.md` and `c:\Users\Fabiano\Downloads\sites\japones\.agents\teamwork_preview_explorer_kanakanji_3\analysis.md`.
2. Create `src/dialogo/components/KanaKanjiInput.tsx`:
   - Controlled React state (NO `wanakana.bind()`).
   - Intercept `onChange`: convert user input using `wanakana.toKana(val, { IMEMode: true })` before React state update.
   - Buffer segmentation: track `committedText` and `compositionBuffer`.
   - `Spacebar` trigger on `onKeyDown`: intercept `Space` (`e.key === ' '`), `preventDefault()`, initiate `converter_kanji` fetch for active composition buffer (`/api/dialogo?acao=converter_kanji&texto=${encodeURIComponent(compositionBuffer)}`) with 3-second `AbortController` timeout.
   - Candidate popup UI using Shadcn `Card` / `ScrollArea` and Tailwind v4 floating above/below input.
   - Keyboard navigation:
     - `ArrowDown` / `ArrowUp`: navigate `selectedIndex` in candidates list.
     - `Enter`: if popup is open, call `e.preventDefault()` (MUST PREVENT CHAT SEND!), select candidate, replace `compositionBuffer` with candidate, merge with `committedText`, and close popup. If popup is closed, allow normal message submission (`onSendMessage`).
     - `Escape`: close popup, keep raw Kana buffer.
   - Frontend resilience: wrap fetch in `try/catch` with 3-second `AbortController` timeout. On error/timeout, close popup silently and retain raw Kana composition buffer.
3. Refactor `src/dialogo/DialoGoPanel.tsx`:
   - Remove `wanakana.bind()` call from `useEffect`.
   - Replace raw input with `<KanaKanjiInput ... />`.
   - Connect props (`value`, `onChange`, `onSendMessage`, `disabled`, `mode`, etc.).
4. Run `npm run build` using `run_command` to verify there are no TypeScript or compilation errors.
5. Write your implementation report and test results to `.agents/teamwork_preview_worker_kanakanji_2/handoff.md` and send a message back when completed.
</USER_REQUEST>
