# Handoff Report - Component Analysis

This handoff report summarizes the component analysis and legacy CSS mapping for the `AjudaModal` and its children in `revisao-japones`.

## 1. Observation
- **File Paths and Lines**:
  - `src/dialogo/components/AjudaModal.tsx`:
    - Contains a `<style dangerouslySetInnerHTML>` block from lines 200 to 574 defining 42 style selectors.
    - Integrates the other sub-components: `VocabularyRibbon` (line 613), `DynamicResultArea` (line 620), and `DraftInput` (line 648).
    - Renders the AI chat bubble directly in the component (lines 596–610).
  - `src/dialogo/components/ajuda/VocabularyRibbon.tsx`:
    - Iterates over the `vocabulario` list (line 26) to render individual vocabulary items inline as pills (lines 27–41).
    - Uses the `.hide-scrollbar` class (line 25).
  - `src/dialogo/components/ajuda/DraftInput.tsx`:
    - Defines a custom `<style>` block for floating canvas elements (lines 318–347).
  - `src/dialogo/components/ajuda/DynamicResultArea.tsx`:
    - Uses standard flex layouts mixed with custom CSS classes like `.ajuda-pratica-box` (line 112) and `.ajuda-sugestao-box` (line 190).
  - `src/index.css`:
    - Defines `.ajuda-draft-textarea` at line 30.

## 2. Logic Chain
- **Step 1**: By inspecting the legacy `<style>` tag in `AjudaModal.tsx` and matching it with classes used in all files, we confirmed all legacy CSS styles are confined to `.ajuda-*` prefix rules.
- **Step 2**: Identifying code duplication and inline-renders (such as the AI message chat bubble in `AjudaModal.tsx` and the vocabulary item maps in `VocabularyRibbon.tsx`) pointed to the exact extraction boundaries for `ChatBubble`, `VocabularyPill`, and `ModalHeader`.
- **Step 3**: By mapping every attribute (e.g. color, transitions, shadows, margins) to Tailwind CSS's utility classes and using arbitrary values for CSS variables, we established a complete class-by-class migration blueprint.
- **Step 4**: To ensure layout stability:
  - Scrolling areas were mapped to `overflow-y-auto min-h-0` inside a flex container to prevent page/modal jumps.
  - The bottom practice field was mapped to `shrink-0 mt-auto` (or `shrink-0 border-t`).
  - Hiding the scrollbar on the vocabulary ribbon was achieved using arbitrary Tailwind scrollbar utilities.

## 3. Caveats
- Hover transitions and keyframe animations (`ajudaFadeInBg`, `ajudaSlideUp`) are custom. The implementation phase must either add these keyframes to the Tailwind config or keep them as inline styled animations.

## 4. Conclusion
- The refactoring and migration to Tailwind CSS is fully planned and documented in `analysis.md`. The components are ready to be extracted, and the custom classes can be cleanly replaced with pure Tailwind utility equivalents.

## 5. Verification Method
- **Files to Inspect**:
  - `c:/Users/Santos/biel/dev/web/revisao-japones/.agents/explorer_1/analysis.md`
  - `src/dialogo/components/AjudaModal.tsx`
  - `src/dialogo/components/ajuda/VocabularyRibbon.tsx`
  - `src/dialogo/components/ajuda/DraftInput.tsx`
  - `src/dialogo/components/ajuda/DynamicResultArea.tsx`
- **Invalidation Conditions**:
  - The verification fails if any `.ajuda-*` class in the code has not been accounted for, or if the layout stability strategy causes visual regression.
