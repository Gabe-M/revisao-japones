# Project: AjudaModal Component Refactoring & Spacing Polish

## Architecture
- `AjudaModal.tsx`: The main container modal, handling state, APIs, overlays, and structure.
- `src/dialogo/components/ajuda/`: Sub-components directory:
  - `ChatBubble.tsx` (new): Visual bubble for AI messages.
  - `VocabularyRibbon.tsx`: Horizontal scroll ribbon of vocabulary.
  - `VocabularyPill.tsx` (new): Inside VocabularyRibbon, renders individual words and translations.
  - `DraftInput.tsx`: Floating action area and input box at the bottom.
  - `DynamicResultArea.tsx`: Central area containing dynamic suggestion, analyzer, and duda results.
  - `ModalHeader.tsx` (new): Renders the modal title, Sparkles icon, and close button.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Analysis & Extraction Design | Plan component extraction and map custom CSS classes to Tailwind equivalents. | none | DONE |
| 2 | M2: Component Extraction & Tailwind | Extract ChatBubble, VocabularyPill, and ModalHeader; rewrite all styles using pure Tailwind. | M1 | DONE |
| 3 | M3: Layout Stability & Build | Align horizontal scrolling, bottom docking, vertical scroll area, and verify npm run build success. | M2 | DONE |
| 4 | M4: Final Review & Integrity Audit | Challenger verification and Forensic Auditor clean verdict. | M3 | IN_PROGRESS |

## Interface Contracts
### `ChatBubble.tsx`
- **Props**:
  - `mensagem: string` (React/JSX or raw string with ruby tags)
- **Styling**: Pure Tailwind CSS (e.g. `flex items-start gap-2.5`, avatar: `w-[30px] h-[30px] rounded-full flex items-center justify-center bg-[var(--highlight-color)]`, bubble: `rounded-2xl bg-slate-100/80 dark:bg-white/5 shadow-sm p-4`).

### `VocabularyPill.tsx`
- **Props**:
  - `item: string` (Japanese word, handles ruby)
  - `leitura?: string` (Optional reading)
  - `significado?: string` (Optional translation/meaning)
- **Styling**: Pure Tailwind CSS (e.g. `inline-flex items-center shrink-0 px-3 py-1 rounded-full bg-[var(--card-bg)] text-xs shadow-sm text-slate-700 dark:text-slate-200`).

### `ModalHeader.tsx`
- **Props**:
  - `onClose: () => void`
- **Styling**: Pure Tailwind CSS (e.g. `flex items-center justify-between p-4 pb-2 border-none shrink-0`).

## Code Layout
- Main component: `src/dialogo/components/AjudaModal.tsx`
- Sub-components: `src/dialogo/components/ajuda/*.tsx`
