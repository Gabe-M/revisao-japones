## 2026-07-22T07:51:40Z
<USER_REQUEST>
You are Worker 2 for Milestone 1 (R1. Sentence Mining Frontend Utility).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m1_2

Tasks:
1. Update `src/dialogo/utils/sentenceMining.ts` with the following fixes based on Reviewer and Challenger feedback:
   - In `cleanJapaneseText(rawText: any)`:
     - Guard non-string inputs: `if (typeof rawText !== 'string' || !rawText) return '';`
     - Use attribute-aware regexes for `<rt>` and `<rp>`:
       `rawText.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '').replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, '').replace(/<[^>]+>/g, '')`
     - Decode entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) and trim.
   - In `findSentenceExample(historico: any[], palavra: string)`:
     - Guard inputs: `if (!Array.isArray(historico) || typeof palavra !== 'string' || !palavra.trim()) return { exemplo_jp: null, exemplo_pt: null };`
     - Clean target: `const target = palavra.trim();`
     - Search backwards (`for (let i = historico.length - 1; i >= 0; i--)`).
     - Extract `rawJp`: `const rawJp = typeof item?.jp === 'string' ? item.jp : typeof item?.content === 'string' ? item.content : '';`
     - Clean text: `const cleanJp = cleanJapaneseText(rawJp);`
     - Check MATCH STRICTLY ON `cleanJp`: `if (cleanJp.includes(target))` (DO NOT check `rawJp.includes(target)` as that matches furigana in `<rt>` or HTML attributes).
     - Return `{ exemplo_jp: cleanJp || null, exemplo_pt: typeof item?.pt === 'string' && item.pt.trim() ? item.pt.trim() : null }`.
2. Run `npx tsc --noEmit` using `run_command` in `c:\Users\Fabiano\Downloads\sites\japones`.
3. Deliver your handoff report to `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m1_2\handoff.md`.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
</USER_REQUEST>
