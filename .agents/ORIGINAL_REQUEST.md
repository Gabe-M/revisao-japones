# Original User Request

## Initial Request — 2026-06-23T23:12:48Z

# Teamwork Project Prompt

Project description: Break the AjudaModal down into highly isolated, smaller sub-components with strict structural rules to eradicate legacy CSS interference, focusing purely on visual polish, proper spacing, and robust layout isolation.

Working directory: c:/Users/Santos/biel/dev/web/revisao-japones
Integrity mode: demo

## Requirements

### R1. UI Extraction & Pure Tailwind Architecture
Extract the modal's complex sections (e.g., Vocabulary Ribbon, Chat Bubble, Draft Input, Dynamic Results) into smaller, highly cohesive sub-components. You must completely abandon any reliance on external or legacy custom CSS classes (e.g., `.ajuda-modal-*`). All layout, styling, spacing, and glassmorphism must be achieved strictly using pure Tailwind utilities and inline React `style` objects.

### R2. Layout Stability & Scrolling Isolation
Ensure the vocabulary ribbon perfectly scrolls horizontally as a single row of inline items without vertical wrapping or block-stacking. The Draft Input area must be rigidly docked to the bottom of the container without getting squashed, while the central Chat Bubble and results area must handle the vertical scroll. 

## Acceptance Criteria

### Component Extraction
- [ ] `AjudaModal.tsx` is successfully refactored to consume at least 3 newly extracted sub-components (e.g., `ChatBubble`, `VocabularyPill`, etc.).
- [ ] No legacy `.ajuda-*` CSS classes remain in the newly extracted component files.

### Verification
- [ ] The command `npm run build` executes and completes successfully with 0 TypeScript or Vite compilation errors.
- [ ] The application mounts locally without layout collapse.
