# Technical Analysis: Sentence Mining Frontend Utility (Milestone 1 / R1)

## Executive Summary
This document details the architectural exploration, TypeScript type integration plan, and test verification scenarios for the **Sentence Mining Frontend Utility** (`R1`). The utility scans session dialogue history backwards to find the last occurrence of a target Japanese word, cleans HTML/ruby tags, and extracts clean Japanese example text (`exemplo_jp`) and its corresponding Portuguese translation (`exemplo_pt`).

---

## 1. Codebase Structure & Utility Placement Analysis

### Existing Architecture (`src/dialogo/`)
- `src/dialogo/`: Top-level panel components (`DialoGoApp.tsx`, `DialoGoPanel.tsx`, `ConfiguracaoPanel.tsx`, `GuiaPanel.tsx`, `TraducaoPanel.tsx`, `main.tsx`).
- `src/dialogo/components/`: Subcomponents (`AjudaModal.tsx`, `PalavraNovaPopover.tsx`, `InteractiveText.tsx`, `PhraseCard.tsx`, etc.).
- `src/dialogo/hooks/`: React custom hooks (`useJapaneseTTS.ts`).
- `src/dialogo/services/`: Planned location for AnkiConnect integration (`ankiService.ts` for Milestone 3 / R3).
- `src/lib/utils.ts`: Global UI styling utility (`cn` helper using `clsx` and `tailwind-merge`).

### Recommended Placement & Export Strategy
To maintain clean modular separation between UI components, custom hooks, services, and utility logic:
1. **Directory**: Create `src/dialogo/utils/`
2. **Main File**: `src/dialogo/utils/sentenceMining.ts`
3. **Barrel Export**: `src/dialogo/utils/index.ts` re-exporting functions and types.

This structure allows components like `AjudaModal.tsx` and `PalavraNovaPopover.tsx` to cleanly import the utility via:
```typescript
import { extractSentenceExample, cleanJapaneseText } from '../utils/sentenceMining';
```

---

## 2. TypeScript Types & Existing Exports Audit

### Audit of Existing Types in `src/dialogo/`
- **`src/dialogo/DialoGoApp.tsx`**:
  - `export type DialogoMode = 'config' | 'guia' | 'traducao' | 'dialogo';`
  - `export interface DialogoContextData { ... }`
- **`src/dialogo/components/PalavraNovaPopover.tsx`**:
  - `export type StatusAdaptativo = 'novo' | 'aprendendo_medio' | 'aprendendo_dificil' | 'aprendido';`
  - `export interface PalavraAdaptativa { ... }`
- **Dialogue History State (`historico`) in `DialoGoPanel.tsx`**:
  - `historico` is managed as state of objects (`any[]`).
  - Turn objects have fields:
    - `role`: `'user' | 'assistant'`
    - `jp` / `content`: string containing Japanese text (often with `<ruby>...<rt>...</rt></ruby>` or `<w>...</w>` tags)
    - `pt`: string (Portuguese translation, present on assistant turns)
    - `analise`: string (optional analysis on user turns)
    - `score`: number (optional score on user turns)

### Proposed Interfaces & Function Contracts
New types will be declared in `src/dialogo/utils/sentenceMining.ts`:

```typescript
export interface DialogueTurn {
    role: 'user' | 'assistant';
    jp?: string;
    content?: string;
    pt?: string;
    analise?: string;
    score?: number;
    [key: string]: any;
}

export interface MinedSentenceResult {
    exemplo_jp: string | null;
    exemplo_pt: string | null;
    turnIndex: number | null;
}

/**
 * Strips HTML tags, ruby markup (<rt>...</rt>, <rp>...</rp>), and word boundaries (<w>...</w>)
 * while preserving base Kanji/Kana text.
 */
export function cleanJapaneseText(rawText: string): string;

/**
 * Searches dialogue history in reverse (newest to oldest) for the target word.
 * Returns clean Japanese sentence, Portuguese translation (if available), and turn index.
 */
export function extractSentenceExample(
    historico: DialogueTurn[] | null | undefined,
    palavra: string
): MinedSentenceResult;
```

### Type Safety & Zero Regression Guarantees
- No existing files or types in `src/dialogo/` will be modified or broken.
- `DialogueTurn` is designed to be compatible with existing `historico` objects.
- `cleanJapaneseText` handles null/undefined/empty string inputs gracefully.

---

## 3. Sentence Mining & Tag Stripping Logic

### Tag Stripping Rules
1. **Remove Furigana (`<rt>...</rt>`)**: `<ruby>私<rt>わたし</rt></ruby>` -> `私`
2. **Remove Parentheses (`<rp>...</rp>`)**: `<rp>(</rp>` -> `""`
3. **Strip Ruby Container & Word Tags (`<ruby>`, `</ruby>`, `<w>`, `</w>`)**: `<w>猫</w>` -> `猫`
4. **Remove Any Remaining HTML Tags**: `/<[^>]*>/g` -> `""`
5. **Normalize Whitespace**: Trim leading/trailing whitespace.

---

## 4. Comprehensive Unit Test & Verification Scenarios

| Scenario ID | Test Name | Input History (`historico`) | Target Word | Expected `exemplo_jp` | Expected `exemplo_pt` | Verification Goal |
|---|---|---|---|---|---|---|
| **ST-01** | Word present with PT translation | `[{"role":"assistant", "jp":"<ruby>私<rt>わたし</rt></ruby>は<ruby>猫<rt>ねこ</rt></ruby>が好きです。", "pt":"Eu gosto de gatos."}]` | `"猫"` | `"私は猫が好きです。"` | `"Eu gosto de gatos."` | Verify correct furigana removal and PT translation capture |
| **ST-02** | Word present without PT translation | `[{"role":"user", "jp":"<ruby>学校<rt>がっこう</rt></ruby>に行きます。"}]` | `"学校"` | `"学校に行きます。"` | `null` | Verify `exemplo_pt` returns `null` when missing |
| **ST-03** | Nested Ruby & HTML `<w>` tags | `[{"role":"assistant", "jp":"<w><ruby>新<rt>し</rt></ruby>しい</w><ruby>車<rt>くるま</rt></ruby>を買いました。", "pt":"Comprei um carro novo."}]` | `"新しい"` | `"新しい車を買いました。"` | `"Comprei um carro novo."` | Verify clean removal of `<w>` and `<ruby>` without losing base kanji/kana |
| **ST-04** | Word absent from history | `[{"role":"assistant", "jp":"こんにちは。", "pt":"Olá."}]` | `"リンゴ"` | `null` | `null` | Verify graceful non-match result without errors |
| **ST-05** | Reverse search order (Newest first) | `[{"role":"assistant", "jp":"<ruby>犬<rt>いぬ</rt></ruby>です。", "pt":"É um cão."},{"role":"user", "jp":"大きな<ruby>犬<rt>いぬ</rt></ruby>が見えました。", "pt":"Vi um cão grande."}]` | `"犬"` | `"大きな犬が見えました。"` | `"Vi um cão grande."` | Verify latest turn (index 1) is selected over older turn (index 0) |
| **ST-06** | Edge Cases (Null/Empty input) | `[]`, `null`, `undefined`, empty target word `""` | `""` | `null` | `null` | Verify robust guard clause execution |

---

## 5. Recommended Implementation Plan for Implementer

1. **Step 1: Utility File Creation**
   - Create `src/dialogo/utils/sentenceMining.ts` with `cleanJapaneseText`, `extractSentenceExample`, and exported TypeScript types (`DialogueTurn`, `MinedSentenceResult`).
   - Create `src/dialogo/utils/index.ts` re-exporting `sentenceMining.ts`.
2. **Step 2: Unit Test Suite Creation**
   - Create test file `src/dialogo/utils/__tests__/sentenceMining.test.ts` (or node execution test script) implementing Scenarios ST-01 through ST-06.
3. **Step 3: Verification**
   - Execute TypeScript compilation check (`npx tsc --noEmit`) to verify clean type checking.
