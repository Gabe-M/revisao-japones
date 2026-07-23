## 2026-07-22T10:45:38Z
You are Worker 1 for Milestone 1 (R1. Sentence Mining Frontend Utility).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m1_1

Tasks:
1. Create `src/dialogo/utils/sentenceMining.ts` with the following clean, robust implementation:
   - Export interface `SentenceMiningResult { exemplo_jp: string | null; exemplo_pt: string | null; }`
   - Export function `cleanJapaneseText(rawText: string): string`
     - Strip `<rt>...</rt>` and `<rp>...</rp>` blocks including inner furigana contents using case-insensitive multi-line regex (`/<rt>[\s\S]*?<\/rt>/gi`, `/<rp>[\s\S]*?<\/rp>/gi`).
     - Strip remaining HTML tags (`/<[^>]+>/g`).
     - Decode standard HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
     - Trim whitespace.
   - Export function `findSentenceExample(historico: any[], palavra: string): SentenceMiningResult`
     - Validate input `historico` is an array and `palavra` is a non-empty string.
     - Search `historico` backwards (`let i = historico.length - 1; i >= 0; i--`).
     - Extract `rawJp` from `item.jp || item.content || ''`.
     - Clean `rawJp` using `cleanJapaneseText(rawJp)`.
     - Match if `cleanJp.includes(palavra)` or `rawJp.includes(palavra)`.
     - On match, return `{ exemplo_jp: cleanJp || null, exemplo_pt: item.pt && item.pt.trim() ? item.pt.trim() : null }`.
     - If no match found after loop, return `{ exemplo_jp: null, exemplo_pt: null }`.
2. Check if `src/dialogo/utils/index.ts` exists or needs to be created/updated to re-export `sentenceMining.ts`.
3. Run `npx tsc --noEmit` using `run_command` in `c:\Users\Fabiano\Downloads\sites\japones` to verify TypeScript compilation.
4. Deliver your handoff report to `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m1_1\handoff.md`. Include the output of `npx tsc --noEmit` and exact files created/modified.
