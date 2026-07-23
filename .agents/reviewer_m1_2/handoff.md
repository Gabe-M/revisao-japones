# Review Report: Milestone 1 (R1. Sentence Mining Frontend Utility)

**Reviewer**: Reviewer 2 (reviewer, critic)  
**Date**: 2026-07-22  
**Verdict**: **VETO** (REQUEST_CHANGES)

---

## Executive Summary

The implementation of `src/dialogo/utils/sentenceMining.ts` and `src/dialogo/utils/index.ts` introduces the core structure for sentence mining, HTML/ruby tag cleaning, and history searching. No integrity violations or hardcoded test shortcuts were found. However, a **critical logic bug** exists in `findSentenceExample` where matching against uncleaned `rawJp` allows false positives (HTML attributes, entity names, or stripped furigana), causing the function to return sentence examples (`exemplo_jp`) that **do not contain** the searched word (`palavra`). Additionally, `<rt>`/`<rp>` regexes fail on tags with attributes, and `npx tsc --noEmit` fails on unrelated files in the project codebase.

---

## 1. Observation

### 1.1 Codebase Inspection

- **File `src/dialogo/utils/sentenceMining.ts` (Lines 15-28)**:
  ```typescript
  // Strip <rt>...</rt> and <rp>...</rp> blocks including inner furigana contents
  cleaned = cleaned.replace(/<rt>[\s\S]*?<\/rt>/gi, '');
  cleaned = cleaned.replace(/<rp>[\s\S]*?<\/rp>/gi, '');

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Decode standard HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  ```

- **File `src/dialogo/utils/sentenceMining.ts` (Lines 37-56)**:
  ```typescript
  export function findSentenceExample(historico: any[], palavra: string): SentenceMiningResult {
    if (!Array.isArray(historico) || typeof palavra !== 'string' || !palavra.trim()) {
      return { exemplo_jp: null, exemplo_pt: null };
    }

    for (let i = historico.length - 1; i >= 0; i--) {
      const item = historico[i];
      if (!item) continue;

      const rawJp: string = item.jp || item.content || '';
      const cleanJp = cleanJapaneseText(rawJp);

      if (cleanJp.includes(palavra) || rawJp.includes(palavra)) {
        const exemplo_pt = item.pt && typeof item.pt === 'string' && item.pt.trim() ? item.pt.trim() : null;
        return {
          exemplo_jp: cleanJp || null,
          exemplo_pt,
        };
      }
    }

    return { exemplo_jp: null, exemplo_pt: null };
  }
  ```

- **File `src/dialogo/utils/index.ts` (Lines 1-2)**:
  ```typescript
  export * from './sentenceMining';
  ```

### 1.2 TypeScript Compilation Command & Output
- Tool Command: `npx tsc --noEmit` executed in `c:\Users\Fabiano\Downloads\sites\japones`
- Result: Exit code 1
- Verbatim Output:
  ```
  src/dialogo/components/AjudaModal.tsx(197,67): error TS7006: Parameter 'k' implicitly has an 'any' type.
  src/dialogo/DialoGoPanel.tsx(216,86): error TS2322: Type '"aprendido"' is not assignable to type '"aprendendo_medio" | "aprendendo_dificil"'.
  ```
  *(Note: `src/dialogo/utils/sentenceMining.ts` and `src/dialogo/utils/index.ts` produced 0 TypeScript errors).*

---

## 2. Logic Chain

1. **Observation 1.1 (Line 49)**: `if (cleanJp.includes(palavra) || rawJp.includes(palavra))`
   - **Step 1**: Suppose `rawJp` contains `<ruby>猫<rt>ねこ</rt></ruby>が好き` and `palavra` is `"ねこ"` (the reading in furigana).
   - **Step 2**: `cleanJapaneseText(rawJp)` strips `<rt>ねこ</rt>`, producing `cleanJp = "猫が好き"`.
   - **Step 3**: `cleanJp.includes("ねこ")` is `false`.
   - **Step 4**: `rawJp.includes("ねこ")` is `true`.
   - **Step 5**: The condition evaluates to `true`.
   - **Step 6**: The function returns `{ exemplo_jp: "猫が好き", exemplo_pt: ... }`.
   - **Step 7**: The caller receives `exemplo_jp = "猫が好き"`, which **does not contain** `"ねこ"`.
   - **Step 8 (HTML attribute matching)**: If `rawJp` is `<span class="jp">こんにちは</span>` and `palavra` is `"span"`, `rawJp.includes("span")` evaluates to `true`. `cleanJp` (`"こんにちは"`) is returned, which does not contain `"span"`.

2. **Observation 1.1 (Lines 16-17)**: `cleaned.replace(/<rt>[\s\S]*?<\/rt>/gi, '')`
   - **Step 1**: If an `<rt>` tag contains attributes (e.g., `<rt class="furigana">`), the literal regex `/<rt>/` will not match `<rt class="...">`.
   - **Step 2**: The inner furigana text will not be stripped prior to general HTML tag removal, resulting in furigana leaking into the cleaned sentence.

3. **Observation 1.1 (Line 37)**: `historico: any[]`
   - **Step 1**: Loose `any[]` type bypasses TypeScript type checking for history items.
   - **Step 2**: While not an error in `tsc`, defining an explicit interface (`HistoryItem` or `ConversationMessage`) improves type safety.

4. **Observation 1.2 (`npx tsc --noEmit`)**:
   - `sentenceMining.ts` has valid syntax and types, but the repository has pre-existing compilation errors in `AjudaModal.tsx` and `DialoGoPanel.tsx`.

---

## 3. Caveats

- No unit test suite exists in the repository for `sentenceMining.ts` yet. Testing was done via static code analysis, execution of `tsc`, and logical trace of edge cases.
- The `historico` structure expected by `DialoGoPanel` / `DialoGoApp` includes objects with `.jp`, `.content`, or `.pt` properties.

---

## 4. Conclusion & Findings

### Verdict: VETO (REQUEST_CHANGES)

### Findings

#### [Critical] Finding 1: False Positive Search Match Returns Invalid `exemplo_jp`
- **Location**: `src/dialogo/utils/sentenceMining.ts:49`
- **Why it's a problem**: `rawJp.includes(palavra)` matches text inside HTML tags, entity names, or stripped furigana (`<rt>`). When this triggers, `cleanJp` (which does NOT contain `palavra`) is returned as `exemplo_jp`.
- **Suggested Fix**: Only match against `cleanJp.includes(palavra)`. If furigana matching is desired, `cleanJapaneseText` must preserve furigana or generate a version containing kanji+furigana that retains `palavra`.
  ```typescript
  if (cleanJp.includes(palavra)) {
    const exemplo_pt = item.pt && typeof item.pt === 'string' && item.pt.trim() ? item.pt.trim() : null;
    return {
      exemplo_jp: cleanJp,
      exemplo_pt,
    };
  }
  ```

#### [Major] Finding 2: HTML Attribute Vulnerability in Furigana Tag Stripping
- **Location**: `src/dialogo/utils/sentenceMining.ts:16-17`
- **Why it's a problem**: `/<rt>[\s\S]*?<\/rt>/gi` fails to match `<rt class="...">` or tags with attributes.
- **Suggested Fix**: Update regexes to support attributes:
  ```typescript
  cleaned = cleaned.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '');
  cleaned = cleaned.replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '');
  ```

#### [Minor] Finding 3: Loose `any[]` Parameter Typing
- **Location**: `src/dialogo/utils/sentenceMining.ts:37`
- **Why it's a problem**: Reduces TypeScript strictness.
- **Suggested Fix**: Define a contract interface:
  ```typescript
  export interface MiningHistoryItem {
    jp?: string;
    content?: string;
    pt?: string;
    [key: string]: unknown;
  }
  export function findSentenceExample(historico: MiningHistoryItem[], palavra: string): SentenceMiningResult
  ```

---

## 5. Verification Method

To verify these findings:
1. **False Positive Trace**:
   Run node / ts-node with:
   ```js
   const historico = [{ jp: '<ruby>漢字<rt>かんじ</rt></ruby>', pt: 'Kanji' }];
   findSentenceExample(historico, 'かんじ');
   // Current Output: { exemplo_jp: '漢字', exemplo_pt: 'Kanji' }
   // '漢字' does NOT contain 'かんじ'!
   ```
2. **Attribute Trace**:
   ```js
   cleanJapaneseText('<ruby>漢字<rt class="furi">かんじ</rt></ruby>');
   // Current Output: '漢字かんじ' (furigana leaked because <rt class="..."> was not matched by /<rt>/)
   ```
3. **TypeScript Compilation**:
   Run `npx tsc --noEmit` in `c:\Users\Fabiano\Downloads\sites\japones`.
