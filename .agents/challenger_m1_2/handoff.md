# Empirical Challenge Report — Milestone 1 (R1. Sentence Mining Frontend Utility)

**Challenger**: Challenger 2 (`challenger_m1_2`)  
**Target Module**: `src/dialogo/utils/sentenceMining.ts`  
**Verdict**: **FAIL** (6 out of 22 empirical test scenarios failed)

---

## 1. Observation

Direct observations from source inspection and execution of the empirical test harness script (`temp_test_harness_m1_2.mjs`) on Node v24.16.0:

### Target Implementation (`src/dialogo/utils/sentenceMining.ts`)
```typescript
16:   cleaned = cleaned.replace(/<rt>[\s\S]*?<\/rt>/gi, '');
17:   cleaned = cleaned.replace(/<rp>[\s\S]*?<\/rp>/gi, '');
18: 
19:   // Strip remaining HTML tags
20:   cleaned = cleaned.replace(/<[^>]+>/g, '');
21: 
22:   // Decode standard HTML entities
23:   cleaned = cleaned
24:     .replace(/&amp;/g, '&')
25:     .replace(/&lt;/g, '<')
26:     .replace(/&gt;/g, '>')
27:     .replace(/&quot;/g, '"')
28:     .replace(/&#39;/g, "'");
...
38:   if (!Array.isArray(historico) || typeof palavra !== 'string' || !palavra.trim()) {
39:     return { exemplo_jp: null, exemplo_pt: null };
40:   }
41: 
42:   for (let i = historico.length - 1; i >= 0; i--) {
43:     const item = historico[i];
44:     if (!item) continue;
45: 
46:     const rawJp: string = item.jp || item.content || '';
47:     const cleanJp = cleanJapaneseText(rawJp);
48: 
49:     if (cleanJp.includes(palavra) || rawJp.includes(palavra)) {
50:       const exemplo_pt = item.pt && typeof item.pt === 'string' && item.pt.trim() ? item.pt.trim() : null;
51:       return {
52:         exemplo_jp: cleanJp || null,
53:         exemplo_pt,
54:       };
55:     }
56:   }
```

### Empirical Test Execution Summary
Command executed: `node --experimental-strip-types temp_test_harness_m1_2.mjs`
Total Tests: 22 | Passed: 16 | Failed: 6

#### Failed Scenarios:
1. `Clean HTML - Furigana with Tag Attributes (<rt class="...">)`
   - **Input**: `<ruby>日<rp class="rp-open">(</rp><rt class="furi-class">に</rt><rp class="rp-close">)</rp>本</ruby>`
   - **Got**: `"日(に)本"`
   - **Expected**: `"日本語"`

2. `Clean HTML - Line Breaks inside Tags and Attributes`
   - **Input**: `<div\n class="container"\n style="color:red">\n<ruby>漢<rt\n class="furi">かん</rt>字</ruby></div>`
   - **Got**: `"漢かん字"`
   - **Expected**: `"漢字"`

3. `Clean HTML - Double Entity Unescaping Protection`
   - **Input**: `&amp;lt;script&amp;gt;`
   - **Got**: `"<script>"`
   - **Expected**: `"&lt;script&gt;"`

4. `Adversarial - Target Word inside Stripped Furigana (<rt>)`
   - **Input**: `historico = [{ jp: '<ruby>猫<rt>ねこ</rt></ruby>が好き' }]`, `palavra = 'ねこ'`
   - **Got**: `{ exemplo_jp: "猫が好き", exemplo_pt: null }`
   - **Expected**: `{ exemplo_jp: null, exemplo_pt: null }` (because `"猫が好き"` does NOT contain the searched target word `"ねこ"`).

5. `Adversarial - Target Word matching HTML tag attribute`
   - **Input**: `historico = [{ jp: '<span class="highlight">日本語の勉強</span>' }]`, `palavra = 'highlight'`
   - **Got**: `{ exemplo_jp: "日本語の勉強", exemplo_pt: null }`
   - **Expected**: `{ exemplo_jp: null, exemplo_pt: null }` (class name attribute should not trigger false positive sentence match).

6. `Type Resilience - Non-string jp or content property`
   - **Input**: `historico = [{ jp: 12345 }]`, `palavra = '123'`
   - **Got**: Uncaught `TypeError: rawText.replace is not a function` at `cleanJapaneseText` (line 16).

---

## 2. Logic Chain

1. **Observation 1 (Regex hardcoding in lines 16-17)**: `cleaned.replace(/<rt>[\s\S]*?<\/rt>/gi, '')` strictly expects literal `<rt>` without attributes or line breaks inside the opening tag.
2. **Logic Step 1**: When real-world HTML content contains attributes (e.g., `<rt class="furigana">`) or line breaks (e.g. `<rt\n>`), the `<rt>` cleaner rule fails to match. The general tag cleaner `/<[^>]+>/g` on line 20 strips `<rt ...>` and `</rt>` tags, leaving the raw furigana text (e.g. `に`) inside the main output (`"日(に)本"`), corrupting the Japanese sentence output.

3. **Observation 2 (Chained replace calls in lines 24-28)**: `.replace(/&amp;/g, '&').replace(/&lt;/g, '<')` decodes `&amp;` before `&lt;`.
4. **Logic Step 2**: Chaining entity replacements causes double-decoding. `&amp;lt;` is converted to `&lt;` by `&amp;` replacement, and then immediately converted to `<` by `&lt;` replacement within the same function call. This causes security/escaping defects where double-escaped entities are unescaped into executable/raw HTML markup.

5. **Observation 3 (Fallback matching on rawJp in line 49)**: `if (cleanJp.includes(palavra) || rawJp.includes(palavra))` checks `rawJp.includes(palavra)`.
6. **Logic Step 3**: If `palavra` (e.g. `"ねこ"` or `"highlight"`) exists only inside stripped `<rt>` furigana or HTML attributes (e.g. `class="highlight"`), `cleanJp` does not contain `palavra`. However, `rawJp.includes(palavra)` evaluates to `true`. `findSentenceExample` returns `{ exemplo_jp: cleanJp }`, yielding an `exemplo_jp` string that DOES NOT CONTAIN the requested target word `palavra`.

7. **Observation 4 (Lack of string type check on item properties in line 46)**: `const rawJp: string = item.jp || item.content || '';` accepts any truthy value (such as numbers `123` or objects).
8. **Logic Step 4**: When `item.jp` is non-string (e.g. `123`), `rawJp` receives `123`. `cleanJapaneseText(123)` attempts `123.replace(...)` which throws an unhandled `TypeError` crashing the application runtime.

9. **Observation 5 (Performance testing)**: Performance benchmarks across 1,000, 5,000, and 10,000 turn history arrays executed cleanly in under 40ms total:
   - 1,000 items (worst case): ~3.83 ms
   - 5,000 items (worst case): ~16.47 ms
   - 10,000 items (not found): ~36.73 ms
10. **Logic Step 5**: Performance and reverse order search priority (selecting the most recent matching turn) passed all requirements without performance bottlenecks. However, correctness failures in HTML processing, entity handling, false positive matching, and type safety invalidate the current implementation.

---

## 3. Caveats

- **Benchmarked environment**: Tests executed on Node.js v24.16.0 V8 engine. Browser JS engine performance may vary slightly but will remain in the ~10-50ms range for 10,000 items.
- **Alternative Interpretations**: If furigana search were a feature requirement, the returned `exemplo_jp` would need to retain furigana annotation or Kanji mapping. Currently, `cleanJapaneseText` strips furigana while `rawJp.includes(palavra)` matches it, leading to inconsistent return objects where `exemplo_jp` lacks `palavra`.

---

## 4. Conclusion

**Verdict**: **FAIL**

While performance (O(N) search scaling < 40ms for 10,000 items) and reverse-order turn selection function properly, `src/dialogo/utils/sentenceMining.ts` fails 6 critical empirical tests:

1. **Furigana Leaks on Tag Attributes**: `<rt class="...">` furigana is not stripped and pollutes output.
2. **Furigana Leaks on Line Breaks**: Multiline tags like `<rt\n>` fail regex matching and pollute output.
3. **Double Unescaping Defect**: Chained entity replacements convert `&amp;lt;` to `<`.
4. **False Positive Matches (Stripped Furigana)**: Searching furigana returns sentences missing the searched word.
5. **False Positive Matches (HTML Attributes)**: Searching CSS class names / attributes matches raw HTML.
6. **TypeError Vulnerability**: Non-string `jp` / `content` values crash `cleanJapaneseText`.

---

## 5. Verification Method

To independently verify these findings:

1. Create a script importing `cleanJapaneseText` and `findSentenceExample` from `src/dialogo/utils/sentenceMining.ts`.
2. Run test assertions:
   ```javascript
   // 1. Furigana with attributes
   console.assert(cleanJapaneseText('<ruby>日<rt class="furi">に</rt>本</ruby>') === '日本語');
   
   // 2. Multiline tags
   console.assert(cleanJapaneseText('<ruby>漢<rt\n class="furi">かん</rt>字</ruby>') === '漢字');

   // 3. Double entity unescaping
   console.assert(cleanJapaneseText('&amp;lt;') === '&lt;');

   // 4. Target word in furigana
   const res = findSentenceExample([{ jp: '<ruby>猫<rt>ねこ</rt></ruby>が好き' }], 'ねこ');
   console.assert(res.exemplo_jp === null);

   // 5. Type safety
   findSentenceExample([{ jp: 123 }], '123'); // Should not throw TypeError
   ```
3. Run with `node --experimental-strip-types <test_script_path>`.
