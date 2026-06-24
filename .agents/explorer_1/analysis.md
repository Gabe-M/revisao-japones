# Component Exploration and Migration Analysis Report

This analysis focuses on the component architecture and styling of `src/dialogo/components/AjudaModal.tsx` and its related files (`VocabularyRibbon.tsx`, `DraftInput.tsx`, and `DynamicResultArea.tsx`). It details the identification of legacy CSS classes, proposes a refactoring plan to extract three newly isolated sub-components, and maps out the complete migration from custom/legacy CSS to pure Tailwind CSS classes.

---

## 1. Legacy CSS Identification

### Legacy Style Tag in `AjudaModal.tsx`
A `<style dangerouslySetInnerHTML>` block containing 42 selectors is defined in `AjudaModal.tsx` (lines 200–574). These styles control layout, animations, cards, and theme variations.

### Legacy Style in `src/index.css`
- `.ajuda-draft-textarea` (defined on line 30 of `src/index.css`) is a global legacy helper style.

### Complete List of Identified Legacy Classes and Styles
- **Overlay & Container**: `.ajuda-modal-overlay`, `.ajuda-modal-container`
- **Header Structure**: `.ajuda-modal-header`, `.ajuda-modal-title`, `.ajuda-modal-close`, `.ajuda-modal-close:hover`
- **Body & Scroll Area**: `.ajuda-modal-body`, `.ajuda-scrollable-section`, `.hide-scrollbar`
- **AI Chat Message**: `.ajuda-chat-bubble`, `.ajuda-chat-bubble__avatar`, `.ajuda-chat-bubble__body`, `.ajuda-chat-bubble__sender`, `.ajuda-chat-bubble__text`
- **Vocabulary Ribbon & Cards**: `.ajuda-vocab-toggle`, `.ajuda-vocab-toggle:hover`, `.ajuda-vocab-toggle-title`, `.ajuda-vocab-grid`, `.ajuda-vocab-card`, `.ajuda-vocab-card:hover`, `.vocab-kana`, `.vocab-meaning`, `.vocab-tag`
- **Action Toolbar & Buttons**: `.ajuda-pratica-section`, `.ajuda-pratica-label`, `.ajuda-input-row`, `.ajuda-input-text`, `.ajuda-input-text:focus`, `.ajuda-action-toolbar`, `.ajuda-action-btn`, `.ajuda-action-btn:hover`, `.ajuda-action-btn.active`, `.ajuda-btn-primary`, `.ajuda-btn-primary:hover`, `.ajuda-btn-primary:disabled`, `.ajuda-btn-secondary`, `.ajuda-btn-secondary:hover`
- **Feedback & Suggestion Boxes**: `.ajuda-pratica-box`, `.ajuda-dica-box`, `.ajuda-natural-box .natural-label`, `.ajuda-natural-box .natural-text`, `.ajuda-sugestao-box`, `.ajuda-sugestao-box .sugestao-label`, `.ajuda-sugestao-box .sugestao-jp`, `.ajuda-sugestao-box .sugestao-pt`, `.ajuda-sugestao-box .sugestao-dica`
- **Animations**: `@keyframes ajudaFadeInBg`, `@keyframes ajudaSlideUp`
- **Theme Theme/Dark Selectors**: `[data-theme="dark"] .ajuda-chat-bubble__body`, `[data-theme="dark"] .bg-card.text-slate-700`

---

## 2. Plan for Sub-component Extraction

To improve maintainability and follow modern React best practices, the following three components will be isolated:

### 1. `ChatBubble` (AI Messages)
- **Purpose**: Displays the AI assistant's avatar, sender tag, and the message content parsed through `InteractiveText`.
- **Target File**: `src/dialogo/components/ajuda/ChatBubble.tsx`
- **Props Definition**:
  ```typescript
  interface ChatBubbleProps {
      mensagem: string;
      sender?: string; // defaults to 'IA'
      avatar?: string; // defaults to '✨'
  }
  ```
- **Proposed Code Sketch**:
  ```tsx
  import React from 'react';
  import InteractiveText from '../../../components/InteractiveText';

  export default function ChatBubble({ mensagem, sender = 'IA', avatar = '✨' }: ChatBubbleProps) {
      return (
          <div className="flex items-start gap-2.5 mb-0 shrink-0">
              <div className="flex-shrink-0 w-[30px] h-[30px] rounded-full bg-[var(--highlight-color)] flex items-center justify-center text-xs mt-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.18)]" aria-hidden="true">
                  {avatar}
              </div>
              <div className="flex-1 p-3 px-4 rounded-2xl bg-slate-100/80 dark:bg-white/5 border-none shadow-sm text-slate-700 dark:text-slate-200">
                  <div className="text-[0.7rem] font-bold text-[var(--highlight-color)] uppercase tracking-[0.6px] mb-1.5 opacity-85">
                      {sender}
                  </div>
                  <div className="text-[1.08em] leading-relaxed">
                      <InteractiveText text={mensagem} />
                  </div>
              </div>
          </div>
      );
  }
  ```

### 2. `VocabularyPill` (Individual Vocabulary Item)
- **Purpose**: A small, self-contained pill showing the Japanese word with furigana and its Portuguese meaning. Separating it from the scrollable ribbon allows it to be reused or hoverable.
- **Target File**: `src/dialogo/components/ajuda/VocabularyPill.tsx`
- **Props Definition**:
  ```typescript
  interface VocabularyPillProps {
      item: string;
      leitura?: string;
      significado?: string;
  }
  ```
- **Proposed Code Sketch**:
  ```tsx
  import React from 'react';
  import InteractiveText from '../../../components/InteractiveText';

  export default function VocabularyPill({ item, leitura, significado }: VocabularyPillProps) {
      return (
          <div className="inline-flex items-center shrink-0 px-3 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)]/20 text-xs shadow-sm text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                  <InteractiveText text={`<ruby>${item}<rt>${leitura ?? ''}</rt></ruby>`} />
              </span>
              {significado && (
                  <span className="opacity-60 font-normal ml-1 text-slate-600 dark:text-slate-300">
                      ({significado})
                  </span>
              )}
          </div>
      );
  }
  ```

### 3. `ModalHeader` (Modal Title & Close Button)
- **Purpose**: Uniformly renders the header block containing the title, icon, and the close button.
- **Target File**: `src/dialogo/components/ajuda/ModalHeader.tsx`
- **Props Definition**:
  ```typescript
  interface ModalHeaderProps {
      title: string;
      onClose: () => void;
      icon?: React.ReactNode;
  }
  ```
- **Proposed Code Sketch**:
  ```tsx
  import React from 'react';

  export default function ModalHeader({ title, onClose, icon }: ModalHeaderProps) {
      return (
          <div className="flex items-center justify-between p-[18px] px-6 pb-3 border-b border-[var(--border-color)]/10 shrink-0">
              <h2 className="m-0 text-[1.05em] font-bold flex items-center gap-2 text-[var(--text-color)]">
                  {icon}
                  {title}
              </h2>
              <button 
                  onClick={onClose} 
                  className="bg-transparent border-none text-[var(--text-color)] cursor-pointer p-1.5 rounded-full flex items-center justify-center opacity-55 transition-all duration-200 hover:opacity-100 hover:bg-white/10 dark:hover:bg-white/5 active:scale-95"
              >
                  <span className="sr-only">Fechar</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          </div>
      );
  }
  ```

---

## 3. Tailwind CSS Style Mappings and Layout Stability

To achieve a modern, responsive, and robust layout that prevents page shifts, the structural classes must align perfectly.

### Layout Stability Strategy
1. **Vertical scrolling chat/result area**:
   - The body of the modal must use `flex flex-col h-full overflow-hidden`.
   - The middle area must be wrapped in `flex-1 overflow-y-auto min-h-0` to isolate its scrolling context.
2. **Sticky/docked bottom practice field**:
   - The `DraftInput` element at the bottom must have `shrink-0 w-full` to anchor it visually at the base of the modal.
3. **Horizontal scrolling vocabulary ribbon**:
   - In `VocabularyRibbon.tsx`, the horizontal container requires `flex flex-row flex-nowrap overflow-x-auto gap-2 w-full whitespace-nowrap pb-2`.
   - Use arbitrary Tailwind class properties `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]` to hide scrollbars natively.

### Mapping Table (Custom/Legacy CSS to Pure Tailwind CSS)

| Custom Selector / CSS Rules | Tailwind CSS Equivalent | Layout / Style Notes |
| :--- | :--- | :--- |
| **`.ajuda-modal-overlay`** | `fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4` | Replaces fixed overlay. Add animations via Tailwind config or inline styles. |
| **`.ajuda-modal-container`** | `bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.5)] w-full max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden text-[var(--text-color)] font-sans` | Holds the entire modal size and overflow context. |
| **`.ajuda-modal-header`** | `flex items-center justify-between p-[18px] px-6 pb-3 shrink-0` | Prevents header from shrinking or growing. |
| **`.ajuda-modal-title`** | `m-0 text-[1.05em] font-bold flex items-center gap-2 text-[var(--text-color)]` | Flex aligning title and icons. |
| **`.ajuda-modal-close`** | `bg-transparent border-none text-[var(--text-color)] cursor-pointer p-1.5 rounded-full flex items-center justify-center opacity-55 transition-all duration-200 hover:opacity-100 hover:bg-white/10 dark:hover:bg-white/5 active:scale-95` | Seamless transition and scaling. |
| **`.ajuda-modal-body`** | `flex-1 overflow-hidden p-0 flex flex-col gap-0` | Reconciles structural flex logic. |
| **`.ajuda-scrollable-section`**| `flex-1 overflow-y-auto min-h-0 pr-1` | Ensures content scrolls while keeping inputs static. |
| **`.hide-scrollbar`** | `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]` | Natively hides scrollbars on all browsers. |
| **`.ajuda-section`** | `mb-0 shrink-0` | Holds AI Chat Bubble layout spacing. |
| **`.ajuda-section-divider`**| `border-none border-t border-[var(--border-color)]/10 my-3.5 opacity-15` | Micro separator. |
| **`.ajuda-chat-bubble`** | `flex items-start gap-2.5` | Standard horizontal message align. |
| **`.ajuda-chat-bubble__avatar`**| `shrink-0 w-[30px] h-[30px] rounded-full bg-[var(--highlight-color)] flex items-center justify-center text-xs mt-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.18)]` | Avatar icon container. |
| **`.ajuda-chat-bubble__body`**| `flex-1 p-3 px-4 rounded-2xl bg-slate-100/80 dark:bg-white/5 border-none shadow-sm text-slate-700 dark:text-slate-200` | Incorporates dark mode selector fallback styling. |
| **`.ajuda-chat-bubble__sender`**| `text-[0.7rem] font-bold text-[var(--highlight-color)] uppercase tracking-[0.6px] mb-1.5 opacity-85` | Label styling. |
| **`.ajuda-chat-bubble__text`**| `text-[1.08em] leading-relaxed` | Text line heights. |
| **`.ajuda-vocab-toggle`** | `flex items-center justify-between cursor-pointer p-2 px-1 rounded-lg transition-colors duration-200 select-none hover:bg-white/[0.04]` | Clickable header pill. |
| **`.ajuda-vocab-toggle-title`**| `text-[0.82em] font-bold text-[var(--highlight-color)] uppercase tracking-[0.6px] flex items-center gap-1.5` | Micro heading. |
| **`.ajuda-vocab-grid`** | `grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 mt-3` | Grid layouts using Tailwind config values. |
| **`.ajuda-vocab-card`** | `bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-3 px-3.5 transition-all duration-200 shadow-[var(--shadow-subtle)] flex flex-col gap-1 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] hover:border-[var(--highlight-color)]` | Interactive vocabulary card. |
| **`.vocab-kana`** | `text-[1.15em] font-bold` | Primary word reading. |
| **`.vocab-meaning`** | `text-[0.9em] opacity-80` | Word translation context. |
| **`.vocab-tag`** | `self-start text-[0.72em] font-bold text-[var(--highlight-color)] bg-[rgba(230,126,34,0.1)] px-2 py-0.5 rounded-full mt-1` | Word tags like JLPT levels. |
| **`.ajuda-pratica-section`**| `bg-transparent border-none p-0` | Standard normalization. |
| **`.ajuda-pratica-label`** | `text-[0.78em] font-bold text-[var(--text-color)] opacity-55 uppercase tracking-[0.6px] mb-3 flex items-center gap-1.5` | Section labels. |
| **`.ajuda-input-row`** | `flex gap-2.5 items-center` | Input side button wrappers. |
| **`.ajuda-input-text`** | `flex-1 p-3 px-4 rounded-xl border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] text-[1.05em] outline-none transition-all duration-250 font-inherit focus:border-[var(--highlight-color)] focus:shadow-[0_0_0_3px_rgba(230,126,34,0.15)]` | Custom outline and transitions. |
| **`.ajuda-action-toolbar`** | `flex gap-2 mt-3.5 flex-wrap` | Button list toolbar. |
| **`.ajuda-action-btn`** | `flex items-center gap-1.5 p-2 px-4 rounded-xl text-[0.88em] font-semibold border border-[var(--border-color)] bg-white/[0.03] text-[var(--text-color)] cursor-pointer transition-all duration-200 whitespace-nowrap hover:bg-white/[0.07] hover:border-[var(--highlight-color)] hover:text-[var(--highlight-color)] hover:-translate-y-0.5 active:bg-[rgba(230,126,34,0.12)] active:border-[var(--highlight-color)] active:text-[var(--highlight-color)]` | Action button layout and active transitions. |
| **`.ajuda-btn-primary`** | `bg-[var(--highlight-color)] text-white p-3 px-[22px] rounded-xl font-bold text-[0.92em] border-none cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(230,126,34,0.2)] w-full hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none` | Primary form submit/trigger. |
| **`.ajuda-btn-secondary`** | `bg-white/[0.04] text-[var(--text-color)] border border-[var(--border-color)] p-2.5 px-[18px] rounded-xl font-semibold text-[0.88em] cursor-pointer transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:bg-white/[0.08] hover:-translate-y-0.5` | Secondary form trigger. |
| **`.ajuda-pratica-box`** | `bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4.5 shadow-[var(--shadow-subtle)] flex flex-col gap-3.5 relative` | Inner practice container box. |
| **`.ajuda-dica-box`** | `bg-black/5 dark:bg-white/5 border-l-4 border-[var(--highlight-color)] p-3 px-3.5 rounded-r-lg text-[0.92em] leading-relaxed` | Sidebar tip panel. |
| **`.ajuda-natural-box`** | `flex flex-col gap-1 mt-3` | Natural phrasing wrapper. |
| **`.natural-label`** | `text-[0.73em] font-bold opacity-55 uppercase mb-1 tracking-[0.5px]` | Natural phrase title. |
| **`.natural-text`** | `text-[1.2em] font-bold text-[#2ecc71]` | Natural color-coded phrase. |
| **`.ajuda-sugestao-box`** | `bg-[rgba(46,204,113,0.05)] border border-[rgba(46,204,113,0.22)] rounded-xl p-4.5 flex flex-col gap-2.5 shadow-[var(--shadow-subtle)]` | Suggestion block layout. |
| **`.ajuda-draft-textarea`** | `resize-none border-none outline-none bg-transparent w-full font-inherit` | Textarea resetting properties. |

---

## 4. Key Considerations for Implementation

1. **Animation Classes**: Tailwind's config does not contain `ajudaFadeInBg` or `ajudaSlideUp` by default. These should either be defined in `tailwind.config.js` or translated to standard Tailwind animations (like `animate-fade` / custom classes or simple React/Framer-motion handlers since Framer-motion is already imported and used inside `DynamicResultArea.tsx`).
2. **Transition Durations**: Transition definitions like `cubic-bezier(0.16, 1, 0.3, 1)` can be mapped using customized transition utilities or kept as is in a minimal tailwind config adjustment.
3. **Variables**: Tailwind utilities should use arbitrary values targeting `var(--highlight-color)`, `var(--border-color)`, `var(--card-bg)`, etc., to ensure existing light/dark theme functionality remains intact without changes to the main theme provider.
