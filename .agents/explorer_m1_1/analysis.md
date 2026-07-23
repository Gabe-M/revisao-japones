# Technical Analysis & Specification: Sentence Mining Frontend Utility (Milestone 1 / R1)

## 1. Executive Summary

This document presents the detailed findings and technical design for the **Sentence Mining Frontend Utility** for the DialoGo Japanese Learning application (`c:\Users\Fabiano\Downloads\sites\japones`). 

The utility function's objective is to search dialogue history (`historico`) backwards (from newest turn to oldest) to find the most recent example sentence containing a target Japanese word (`palavra`). It extracts and cleans the Japanese sentence (`Exemplo_JP`) by stripping furigana (`<rt>`) and HTML tags, while capturing the corresponding Portuguese translation (`Exemplo_PT`) if available.

---

## 2. Structure of `historico` in Dialogue Components

### 2.1 State Location & Persistence
- **State Owner**: `src/dialogo/DialoGoPanel.tsx` maintains `historico` as a React state:
  ```typescript
  const [historico, setHistorico] = useState<any[]>([]);
  ```
- **Context Persistence**: History is passed to/from `context.dialogoDados.historico` when switching tabs or loading a session, and passed as a prop to components such as `ProgressoDrawer.tsx`.

### 2.2 History Item Schema
Each message turn object in `historico` has the following schema:
```typescript
interface DialogueMessage {
    role: 'assistant' | 'user' | 'system';
    jp?: string;        // Raw Japanese text (may contain <ruby>...<rt>...</rt></ruby> tags)
    pt?: string;        // Portuguese translation (present primarily on assistant messages)
    content?: string;   // Fallback string (usually identical to `jp`)
    analise?: any;      // Optional AI feedback / analysis object (on user messages)
    score?: number;     // Optional score (on user messages)
}
```

### 2.3 Message Generation Flow
1. **Dialogue Initialization (`iniciar_dialogo`)**:
   An initial assistant turn is added to `historico`:
   ```typescript
   {
       role: 'assistant',
       jp: data.mensagem_ia_jp,
       pt: data.mensagem_ia_pt,
       content: data.mensagem_ia_jp
   }
   ```
2. **Dialogue Continuation (`continuar_dialogo`)**:
   - User turn added: `{ role: 'user', content: textoJp, jp: textoJp }`
   - Assistant turn appended: `{ role: 'assistant', jp: data.mensagem_ia_jp, pt: data.mensagem_ia_pt, content: data.mensagem_ia_jp }`

---

## 3. Storage and Rendering of Japanese Text & Tag Cleaning

### 3.1 LLM Output & HTML Tags
The backend LLM (Groq / Gemini / OpenAI) returns Japanese text formatted with HTML ruby tags for furigana readings, for instance:
```html
<ruby>私<rt>わたし</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>を<ruby>勉強<rt>べんきょう</rt></ruby>しています。
```
In some edge cases or fallback outputs, `<w>` tags or unclosed `<rt>` elements may also appear:
```html
<w>わたし</w> <ruby>人<rt>ひと</ruby>
```

### 3.2 Key Finding on Furigana Stripping
A naive regex tag stripper `str.replace(/<[^>]*>/g, '')` removes the `<ruby>` and `<rt>` tag delimiters but **leaves the furigana reading text inside**, producing a corrupted sentence with duplicated readings:
- **Naive stripping result**: `私わたしは日本語にほんごを勉強べんきょうしています。` *(Incorrect)*
- **Target clean Japanese text**: `私は日本語を勉強しています。` *(Correct)*

### 3.3 Clean Japanese Text Extraction Algorithm
To produce clean Japanese text (`Exemplo_JP`), the cleaning function must perform a 2-step removal process:
1. **Remove `<rt>` and `<rp>` content blocks** (and their inner readings):
   ```typescript
   text.replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<rp>[\s\S]*?<\/rp>/gi, '')
   ```
2. **Remove any remaining HTML tags**:
   ```typescript
   text.replace(/<[^>]*>/g, '')
   ```
3. **Normalize whitespace and unescape characters**:
   ```typescript
   text.trim()
   ```

---

## 4. Technical Design & Specification for Sentence Mining Utility

### 4.1 File Location
Proposed file: `src/dialogo/utils/sentenceMiner.ts`

### 4.2 Utility Interface Specification

```typescript
export interface MiningResult {
    exemplo_jp: string | null;
    exemplo_pt: string | null;
}

/**
 * Cleans Japanese text by stripping furigana readings (<rt>...</rt>) and HTML tags.
 */
export function cleanJapaneseText(rawText: string | null | undefined): string {
    if (!rawText) return '';
    return rawText
        // Step 1: Remove <rt>...</rt> and <rp>...</rp> contents completely
        .replace(/<rt>[\s\S]*?<\/rt>/gi, '')
        .replace(/<rp>[\s\S]*?<\/rp>/gi, '')
        // Step 2: Handle potential malformed unclosed <rt> tags
        .replace(/<rt>[^<]*/gi, '')
        // Step 3: Remove all remaining HTML tags (<ruby>, </ruby>, <w>, </w>, etc.)
        .replace(/<[^>]*>/g, '')
        // Step 4: Trim surrounding whitespace
        .trim();
}

/**
 * Cleans Portuguese text by stripping any stray HTML tags.
 */
export function cleanPortugueseText(rawText: string | null | undefined): string | null {
    if (!rawText) return null;
    const cleaned = rawText.replace(/<[^>]*>/g, '').trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * Searches history backwards for the target Japanese word and extracts cleaned examples.
 * 
 * @param historico Array of dialogue message objects ({ jp, pt, content, role })
 * @param palavra Target Japanese word string to search for
 * @returns MiningResult containing cleaned exemplo_jp and exemplo_pt (or nulls if not found)
 */
export function findSentenceExample(
    historico: any[] | null | undefined,
    palavra: string | null | undefined
): MiningResult {
    if (!Array.isArray(historico) || historico.length === 0 || !palavra || !palavra.trim()) {
        return { exemplo_jp: null, exemplo_pt: null };
    }

    const targetWord = palavra.trim();

    // Iterate backwards from newest message to oldest
    for (let i = historico.length - 1; i >= 0; i--) {
        const msg = historico[i];
        if (!msg) continue;

        const rawJp = msg.jp || msg.content || '';
        if (!rawJp) continue;

        const cleanJp = cleanJapaneseText(rawJp);

        // Match against clean text OR raw text (to handle both Kanji and Kana inputs)
        if (cleanJp.includes(targetWord) || rawJp.includes(targetWord)) {
            const exemplo_pt = cleanPortugueseText(msg.pt);
            return {
                exemplo_jp: cleanJp || null,
                exemplo_pt: exemplo_pt
            };
        }
    }

    return { exemplo_jp: null, exemplo_pt: null };
}
```

---

## 5. Verification & Test Plan

### 5.1 Test Cases & Assertions

| Test Case | Inputs | Expected `exemplo_jp` | Expected `exemplo_pt` |
|---|---|---|---|
| **1. Basic Ruby Tag Stripping** | `historico`: `[{ jp: '<ruby>猫<rt>ねこ</rt></ruby>が好きです。', pt: 'Gosto de gatos.' }]`, `palavra`: `'猫'` | `'猫が好きです。'` | `'Gosto de gatos.'` |
| **2. Reverse Search Priority** | `historico`: `[{ jp: '猫がいる。', pt: 'Há um gato.' }, { jp: '黒い猫を見た。', pt: 'Vi um gato preto.' }]`, `palavra`: `'猫'` | `'黒い猫を見た。'` | `'Vi um gato preto.'` |
| **3. Missing Translation Handling** | `historico`: `[{ jp: '<ruby>犬<rt>いぬ</rt></ruby>です。' }]`, `palavra`: `'犬'` | `'犬です。'` | `null` |
| **4. Word Not Found** | `historico`: `[{ jp: 'こんにちは。', pt: 'Olá.' }]`, `palavra`: `'魚'` | `null` | `null` |
| **5. Empty/Null History Guard** | `historico`: `[]`, `palavra`: `'猫'` | `null` | `null` |
| **6. Malformed HTML Tags** | `historico`: `[{ jp: '<w>わたし</w>は<ruby>学生<rt>がくせい</rt></ruby>です', pt: 'Eu sou estudante.' }]`, `palavra`: `'学生'` | `'わたしは学生です'` | `'Eu sou estudante.'` |

---

## 6. Implementation Recommendation & Next Steps

1. **Implement Utility File**: Create `src/dialogo/utils/sentenceMiner.ts` containing `cleanJapaneseText`, `cleanPortugueseText`, and `findSentenceExample`.
2. **Export Helpers**: Export all functions for easy consumption by downstream components in Milestone 4 (`AjudaModal.tsx`, `PalavraNovaPopover.tsx`) and potential backend/service helpers.
3. **No Source Modifications Made**: As per Explorer guidelines, no source code was modified during this exploration phase. Implementation is ready for the Implementer agent.
