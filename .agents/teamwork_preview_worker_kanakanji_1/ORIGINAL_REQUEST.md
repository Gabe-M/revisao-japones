## 2026-07-21T23:36:28Z
You are a Worker subagent responsible for implementing the backend proxy action 'converter_kanji' in api/dialogo.js.

Working directory: c:\Users\Fabiano\Downloads\sites\japones\.agents\teamwork_preview_worker_kanakanji_1
Project root: c:\Users\Fabiano\Downloads\sites\japones

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Read the analysis report at `c:\Users\Fabiano\Downloads\sites\japones\.agents\teamwork_preview_explorer_kanakanji_1\analysis.md`.
2. Update `api/dialogo.js`:
   - Update CORS headers to include `GET` in `Access-Control-Allow-Methods` and accept `GET` request method.
   - Extract `acao` and `texto`/`text` from `req.query` as well as `req.body`.
   - Bypass AI provider API key validation (`geminiKey`, `openAIKey`, `groqKey`) when `acao === 'converter_kanji'`.
   - Add `case 'converter_kanji':` inside `switch (acao)`:
     - Check if `texto` is provided (if missing, return 400 `{ error: 'Texto não informado' }`).
     - Fetch `http://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(texto)}`.
     - Parse JSON response e.g. `[["かな", ["仮名", "金", "かな", "カナ"]]]`.
     - Return 200 OK JSON response: `{ status: 'SUCCESS', candidates: Array.isArray(data?.[0]?.[1]) ? data[0][1] : [] }`.
     - Wrap in try/catch block returning 500 on fetch failure.
3. Verify your changes in `api/dialogo.js`.
4. Write your implementation report and test results to `.agents/teamwork_preview_worker_kanakanji_1/handoff.md` and send a message back when completed.
