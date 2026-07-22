# Handoff Report: `converter_kanji` Exploration & Plan

## 1. Observation
- **Inspected File**: `api/dialogo.js` (1386 lines).
- **HTTP Method Check**: Lines 275–279:
  ```javascript
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  ```
- **Provider API Key Checks**: Lines 327–335 check for `geminiKey`, `openAIKey`, or `groqKey` before executing `switch (acao)`.
- **Payload Extraction**: Line 318: `const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;`. Query parameters (`req.query`) are not currently checked in `api/dialogo.js`.
- **Switch Action Router**: Lines 341–1379 handle existing actions (`listar_sessoes`, `criar_sessao`, `gerar_guia`, `analisar_pratica`, `sugerir_multiplas_respostas`, etc.) and default to `res.status(400).json({ error: 'Ação inválida' })` at line 1378.
- **Related API Comparison**: `api/jisho.js` extracts `req.query` (`const { acao, termo } = req.query;`) at line 30 and supports GET requests.

## 2. Logic Chain
1. **Observation 1 & 4**: Line 279 restricts requests to `POST`, and line 318 extracts only `req.body`.
   - *Inference*: To support query string parameters and GET requests for `converter_kanji`, line 275 must include `GET` in `Access-Control-Allow-Methods`, line 279 must accept `GET` requests, and `req.query` must be merged into parameter resolution (`const query = req.query || {}; const acao = body.acao || query.acao;`).
2. **Observation 3**: Lines 327–335 enforce AI provider keys before `switch (acao)`.
   - *Inference*: `converter_kanji` uses Google Transliterate API, not LLM providers. Therefore, AI provider key validation must be skipped when `acao === 'converter_kanji'` to prevent false 401 errors when no LLM key is configured.
3. **Observation 5 & External Specification**: The action `converter_kanji` requires querying `http://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(texto)}` and returning `{ status: 'SUCCESS', candidates: [...] }`.
   - *Inference*: Adding `case 'converter_kanji':` inside `switch (acao)` with native `fetch`, parsing `data[0][1]`, returning 200 OK on success, 400 on missing text parameter, and 500 on fetch failure will fulfill all functional requirements cleanly.

## 3. Caveats
- No caveats. Google Transliterate API format `[["input", ["cand1", "cand2"]]]` is standard and documented.

## 4. Conclusion
The implementation plan for `converter_kanji` in `api/dialogo.js` is fully documented in `analysis.md`. It requires three targeted adjustments:
1. Update HTTP method allowed list & query string extraction.
2. Bypass LLM key checks for `converter_kanji`.
3. Add `case 'converter_kanji':` handler with error wrapping and candidate array parsing.

## 5. Verification Method
- Inspect `analysis.md` in `.agents/teamwork_preview_explorer_kanakanji_1/analysis.md`.
- Once implemented, verify via GET: `GET /api/dialogo?acao=converter_kanji&texto=かな` and POST: `POST /api/dialogo` with body `{ "acao": "converter_kanji", "texto": "かな" }`.
- Expected Response: `200 OK` `{ "status": "SUCCESS", "candidates": ["仮名", "金", "かな", "カナ"] }`.
