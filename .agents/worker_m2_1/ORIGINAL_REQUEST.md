## 2026-07-22T10:59:42Z
You are Worker 1 for Milestone 2 (R2 - Enrichment Layer in `api/dialogo.js`).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m2_1

Task:
1. Initialize your working directory c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m2_1 with BRIEFING.md and progress.md.
2. Read the technical analysis report in c:\Users\Fabiano\Downloads\sites\japones\.agents\explorer_m2_1\analysis.md and inspect api/dialogo.js.
3. Implement `case 'enriquecer_card'` in `api/dialogo.js`:
   - Input extraction: `const palavra = body.item || body.palavra || body.termo;` Return 400 Bad Request if missing/empty string.
   - Jisho API integration: Fetch `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(itemStr)}` inside try/catch with 5-second timeout (AbortController). Safely extract reading, category, JLPT level, and English definitions array.
   - LLM translation via `callAI`: Prompt `callAI` to translate definitions to strict PT-BR, map category to PT-BR (e.g. "Noun" -> "Substantivo"), provide hiragana reading/JLPT fallback if missing, and if `exemplo_jp` is provided without `exemplo_pt`, translate `exemplo_jp` to `exemplo_pt`.
   - Response payload: `res.status(200).json({ item, leitura, significado, categoria, jlpt, exemplo_jp, exemplo_pt })`.
4. Verify JS syntax using `node --check api/dialogo.js` and run `npx tsc --noEmit` if applicable. Document verification results in your handoff report.
5. Create handoff report in `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m2_1\handoff.md` and update `progress.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
