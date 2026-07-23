## 2026-07-22T11:00:27Z
You are Worker 2 (replacement worker) for Milestone 2 (R2 - Enrichment Layer in `api/dialogo.js`).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m2_2

Instructions:
1. Create your working directory files `BRIEFING.md` and `progress.md` in `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m2_2\`.
2. Read the technical analysis in `c:\Users\Fabiano\Downloads\sites\japones\.agents\explorer_m2_1\analysis.md`.
3. View `api/dialogo.js` to find the exact line where `switch (acao)` is located.
4. Edit `api/dialogo.js` using code edit tools to add `case 'enriquecer_card':` inside `switch (acao)`.
   Implementation details:
   - Check input: `const palavra = body.item || body.palavra || body.termo;` Return 400 Bad Request `{ error: 'Palavra ou item não informado para enriquecimento.' }` if missing or empty string.
   - Fetch Jisho API: `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(itemStr)}` with 5s timeout (`AbortController`). Safely extract reading (`japanese[0].reading || japanese[0].word`), category (`senses[0].parts_of_speech[0]`), JLPT (`jlpt[0]`), and English definitions (`senses[0].english_definitions`). Handle fetch errors with try/catch.
   - LLM invocation via `callAI`: Prompt LLM to translate English definitions to concise PT-BR, translate category to PT-BR, infer reading/JLPT if missing, and translate `exemplo_jp` to `exemplo_pt` if `exemplo_jp` is provided without `exemplo_pt`.
   - Return response: `res.status(200).json({ item, leitura, significado, categoria, jlpt, exemplo_jp, exemplo_pt })`.
5. Run build/syntax check command `node --check api/dialogo.js` using run_command to verify syntax.
6. Write your handoff report to `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m2_2\handoff.md`.
