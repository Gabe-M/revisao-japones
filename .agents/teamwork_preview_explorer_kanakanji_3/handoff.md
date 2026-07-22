# Handoff Report: Candidate Popup UI & Keyboard Navigation Design (`KanaKanjiInput`)

## 1. Observation
- **UI Components Directory (`src/components/ui/`)**: Confirmed availability of Shadcn UI primitives: `Card` (`card.tsx`), `ScrollArea` (`scroll-area.tsx`), `Input` (`input.tsx`), and `Button` (`button.tsx`), as well as helper utility `cn` in `src/lib/utils.ts`.
- **Dependencies (`package.json`)**: Confirmed installed packages: `tailwindcss` v4.3.1, `@radix-ui/react-scroll-area`, `wanakana` v5.3.1, `lucide-react`, `clsx`, `tailwind-merge`.
- **Chat Input Layout (`src/dialogo/DialoGoPanel.tsx`)**: DialoGoPanel renders a `<form onSubmit={(e) => enviarMensagem(e, ...)}> <Input ... /> <Button ... /> </form>` structure. Standard key press `Enter` submits the chat message unless intercepted with `e.preventDefault()`.
- **Floating Popovers (`src/dialogo/components/PalavraNovaPopover.tsx`)**: Confirmed pattern of using `fixed` or `absolute` positioning, `z-[50]` / `z-[999]`, backdrop blur, and custom scroll areas.

## 2. Logic Chain
1. **Popup Positioning**: Placing the candidate suggestion popup anchored directly above the text input using `absolute bottom-full left-0 mb-2 w-72 sm:w-80 z-50` within a `relative flex-1` container guarantees stable popover positioning without shifting surrounding chat layout or causing layout reflows.
2. **Keyboard Event Handler Interception**:
   - `Space`: Intercepting `e.key === ' '` with `preventDefault()` allows initiating conversion for the active `compositionBuffer` when popup is closed, or cycling through candidate options when open.
   - `ArrowDown` / `ArrowUp`: Intercepting arrow keys with `preventDefault()` navigates `selectedIndex` in `candidates` array with auto-scroll via `scrollIntoView`.
   - `Enter`: When popup is open, `e.preventDefault()` is mandatory to prevent the outer `<form onSubmit>` from sending the chat message prematurely. Once candidate is selected, `compositionBuffer` is replaced by chosen Kanji, appended to `committedText`, and popup is closed. When popup is closed, `Enter` passes through to submit chat message.
   - `Escape`: Closes popup, aborts active requests, and retains raw Kana composition text.
3. **Resilience & Timeout Mechanism**: Wrapping the fetch call in a `try/catch` with a 3-second `AbortController` timeout ensures that network latency, server errors, or offline states silently close the popup and preserve raw Kana buffer rather than freezing or breaking UI state.

## 3. Caveats
- **No Direct Code Implementation in `src/`**: As an Explorer subagent, no modifications were made to production source files in `src/`. The design and implementation specs are fully detailed in `analysis.md`.
- **Backend Action Dependency**: The candidate suggestions popup relies on the backend proxy action `converter_kanji` in `api/dialogo.js` (currently being designed by Explorer 1).

## 4. Conclusion
The candidate suggestions popup UI and keyboard navigation design for `KanaKanjiInput` is fully specified. It leverages existing Shadcn UI components (`Card`, `ScrollArea`), Tailwind CSS v4 design tokens, custom `onKeyDown` key event handling, and a 3-second `AbortController` timeout mechanism for robust fallback performance.

## 5. Verification Method
1. Inspect `analysis.md` for complete code layout, component props contract, `onKeyDown` decision matrix, and network fetch implementation.
2. Verify component dependencies in `src/components/ui/` (`card.tsx`, `scroll-area.tsx`, `input.tsx`) and `src/lib/utils.ts`.
3. To test once implemented:
   - Type Romaji e.g. `toukyou` -> converts to Kana `とうきょう`.
   - Press `Space` -> opens candidate popup, highlights first candidate `1. 東京`.
   - Press `ArrowDown` / `ArrowUp` -> highlights candidates with auto-scroll.
   - Press `Enter` -> replaces composition buffer with selected candidate `東京`, appends to committed text, closes popup without submitting chat form.
   - Press `Escape` -> closes popup and retains `とうきょう`.
