# Technical Analysis & Implementation Plan: Sentence Mining Frontend Utility (Milestone 1 - R1)

## Executive Summary

This report provides a comprehensive analysis of string manipulation, ruby tag handling, HTML tag stripping, and `historico` data structures across the DialoGo codebase (`c:\Users\Fabiano\Downloads\sites\japones`). It formulates an optimal, battle-tested regex/parsing strategy to strip `<ruby>` furigana annotations cleanly without concatenating kanji and readings, and specifies the exact design for the reverse history search utility `extractSentenceForWord`.

---

## 1. Existing Tag Cleaning & String Manipulation Analysis

A thorough search across the codebase revealed several existing approaches to HTML tag stripping and ruby parsing:

### 1.1 Existing Approaches in Codebase

| Location | Pattern Used | Behavior / Limitations |
| :--- | :--- | :--- |
| `src/dialogo/hooks/useJapaneseTTS.ts:12-13`<br>`src/dialogo/components/PhraseCard.tsx:38`<br>`src/dialogo/DialoGoPanel.tsx:270-271` | `.replace(/<rt>.*?<\/rt>/g, '')`<br>`.replace(/<[^>]+>/g, '')` | **Two-pass stripping**: Removes `<rt>` tags and their contents, then strips remaining HTML tags.<br>*Limitations*: Non-case-insensitive, single-line matching (dot does not match newlines), does not handle `<rp>` tags (parentheses), ignores malformed LLM ruby tags, ignores markdown syntax or HTML entities. |
| `src/dialogo/components/AjudaModal.tsx:182,359`<br>`api/dialogo.js:1111` | `str.replace(/<[^>]*>/g, '')` | **Naive tag stripping**: Strips tag boundaries `<...>` but **retains** `<rt>` contents.<br>*Defect*: Transforms `<ruby>猫<rt>ねこ</rt></ruby>` into `"猫ねこ"`, causing furigana duplication in exported Anki sentences. |
| `src/components/InteractiveText.tsx:165` | `str.replace(/<\/?(?:w\|rt\|ruby\|rp)[^>]*>/gi, '')` | **Tag-boundary removal**: Strips `<ruby>`, `<rt>`, `<rp>`, `<w>` tag wrappers but retains inner text for DOM rendering.<br>*Defect*: Produces concatenated `"猫ねこ"` text, unsuitable for sentence mining. |
| `src/dialogo/components/FuriganaText.tsx:16-25` | Normalization regexes + `Intl.Segmenter` | Pre-processes malformed ruby tags and splits Japanese text for interactive React component rendering. |

### 1.2 Identified Defect in Naive Tag Stripping

When exporting sentences to Anki (`Exemplo_JP`), the text must be clean, natural Japanese text:
- **Input**: `<w><ruby>私<rt>わたし</rt></ruby></w>は<ruby>日本<rp>(</rp><rt>にほん</rt><rp>)</rp></ruby>に行きます。`
- **Naive Strip (`/<[^>]*>/g`) Output**: `私わたしは日本(にほん)に行きます。` *(UNACCEPTABLE for Anki)*
- **Target Clean Output**: `私は日本に行きます。` *(ACCEPTABLE for Anki)*

---

## 2. Structure of `historico` Data Elements

By analyzing `DialoGoPanel.tsx`, `api/dialogo.js`, `AjudaModal.tsx`, and `ProgressoDrawer.tsx`, the `historico` state structure is defined as follows:

- `historico` is an array of message objects: `historico: Array<MessageObject>`.
- Persisted in Supabase table `dialogo_sessoes` column `historico` (jsonb array).

### 2.1 Message Object Fields

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `role` | `'user' \| 'assistant'` | Sender identity (`'user'` = student, `'assistant'` = AI tutor). |
| `jp` | `string` | Japanese message text. For `'assistant'`, contains ruby `<ruby>...<rt>...</rt></ruby>` and `<w>` tags. For `'user'`, raw user input text. |
| `pt` | `string \| undefined` | Portuguese translation of the message. Present on AI `'assistant'` messages; `undefined` or null on `'user'` messages. |
| `content` | `string` | Fallback message content string (usually matches `jp`). |
| `analise` | `string \| undefined` | (Optional, present on `'user'` messages) Sensei feedback/corrections in Portuguese. |
| `score` | `number \| undefined` | (Optional, present on `'user'` messages) Grammar score from 0 to 100. |

---

## 3. Formulated Tag Cleaning & Regex Strategy

### 3.1 Step-by-Step Tag Cleaning Pipeline (`cleanJapaneseText`)

To handle all variations of standard, non-standard, multiline, and malformed LLM ruby tags:

```ts
export function cleanJapaneseText(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let text = html;

  // 1. Normalize malformed LLM ruby tags
  // Fix missing </rt> before </ruby> (e.g. <ruby>人<rt>ひと</ruby> -> <ruby>人<rt>ひと</rt></ruby>)
  text = text.replace(/<ruby>([\s\S]*?)<rt>([^<]*?)<\/ruby>/gi, '<ruby>$1<rt>$2</rt></ruby>');
  // Fix detached <rt> after </ruby> (e.g. <ruby>Kanji</ruby><rt>furigana</rt>)
  text = text.replace(/<ruby>([\s\S]*?)<\/ruby>\s*<rt>([\s\S]*?)<\/rt>/gi, '<ruby>$1<rt>$2</rt></ruby>');

  // 2. Remove <rt>...</rt> tags and their contents (furigana readings)
  text = text.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '');

  // 3. Remove <rp>...</rp> tags and their contents (parentheses wrappers)
  text = text.replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, '');

  // 4. Remove all remaining HTML tags (<ruby>, </ruby>, <w>, </w>, <span>, <br>, etc.)
  text = text.replace(/<[^>]+>/g, '');

  // 5. Remove markdown symbols (*, _, `)
  text = text.replace(/[\*\`\_]/g, '');

  // 6. Unescape HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // 7. Normalize spaces and trim
  return text.replace(/\s+/g, ' ').trim();
}
```

---

## 4. Reverse History Search Utility Design (`extractSentenceForWord`)

### 4.1 Interface Specification

```ts
export interface SentenceMiningResult {
  exemplo_jp: string | null;
  exemplo_pt: string | null;
}
```

### 4.2 Algorithm Implementation Plan

```ts
/**
  Searches historico backwards from newest to oldest message for the last occurrence of target palavra.
  @param historico - Array of dialogue message objects
  @param palavra - Target Japanese word string
  @returns SentenceMiningResult containing cleaned exemplo_jp and exemplo_pt (or null)
 */
export function extractSentenceForWord(
  historico: any[],
  palavra: string
): SentenceMiningResult {
  if (!Array.isArray(historico) || historico.length === 0 || !palavra || !palavra.trim()) {
    return { exemplo_jp: null, exemplo_pt: null };
  }

  const targetWord = palavra.trim();
  const cleanedTarget = cleanJapaneseText(targetWord);

  // Iterate backwards from newest message (end of array) to oldest (index 0)
  for (let i = historico.length - 1; i >= 0; i--) {
    const msg = historico[i];
    if (!msg) continue;

    const rawJp = msg.jp || msg.content || '';
    if (!rawJp || typeof rawJp !== 'string') continue;

    const cleanedJp = cleanJapaneseText(rawJp);

    // Match against cleaned sentence or raw sentence
    if (
      (cleanedTarget && cleanedJp.includes(cleanedTarget)) ||
      rawJp.includes(targetWord)
    ) {
      const exemplo_pt =
        msg.pt && typeof msg.pt === 'string' && msg.pt.trim()
          ? msg.pt.trim()
          : null;

      return {
        exemplo_jp: cleanedJp,
        exemplo_pt: exemplo_pt,
      };
    }
  }

  return { exemplo_jp: null, exemplo_pt: null };
}
```

---

## 5. Verification & Edge Case Matrix

| Edge Case Scenario | Input Condition | Expected Behavior |
| :--- | :--- | :--- |
| **Standard Ruby Tag** | `<ruby>日本<rt>にほん</rt></ruby>へ行く` | Cleaned: `"日本へ行く"` |
| **Ruby with RP Tags** | `<ruby>本<rp>(</rp><rt>ほん</rt><rp>)</rp></ruby>` | Cleaned: `"本"` (no parenthesis leftover) |
| **Malformed LLM Ruby** | `<ruby>猫</ruby><rt>ねこ</rt>がいる` | Cleaned: `"猫がいる"` |
| **User Message match** | `role: 'user'`, `jp: '日本語を勉強しています'` | `exemplo_jp`: `"日本語を勉強しています"`, `exemplo_pt`: `null` |
| **AI Message match** | `role: 'assistant'`, `jp: '<ruby>勉強<rt>べんきょう</rt></ruby>'`, `pt: 'Estudo'` | `exemplo_jp`: `"勉強"`, `exemplo_pt`: `"Estudo"` |
| **Empty History Array** | `historico: []` | Returns `{ exemplo_jp: null, exemplo_pt: null }` without error |
| **Null/Undefined Word** | `palavra: ""` or `null` | Returns `{ exemplo_jp: null, exemplo_pt: null }` without error |
