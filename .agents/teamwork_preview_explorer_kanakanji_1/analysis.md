# Analysis & Implementation Plan: `converter_kanji` Action in `api/dialogo.js`

## Executive Summary
This document presents the detailed architectural analysis of `api/dialogo.js` and formulates the implementation plan for adding the new `converter_kanji` action. The endpoint acts as a proxy to the Google Transliterate API (`http://www.google.com/transliterate`), converting Hiragana/Kana text into Kanji candidates.

---

## 1. Architectural Analysis of `api/dialogo.js`

### 1.1 Overview & Request Lifecycle
`api/dialogo.js` is a Vercel Serverless API handler (`export default async function handler(req, res)`).

1. **CORS & HTTP Method Guarding (Lines 274–279)**:
   - Sets headers for CORS (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST, OPTIONS`).
   - Responds to `OPTIONS` preflight with 200 OK.
   - Enforces `req.method === 'POST'`, returning `405 Método não permitido` for non-POST methods.
   
2. **Authentication & User Context (Lines 281–285)**:
   - Reads `Authorization` header and extracts `userId` via Supabase JWT decoding (`obterUserIdDoToken`).
   - Certain actions (`listar_sessoes`, `criar_sessao`, `apagar_sessao`, `gerar_vocabulario_lote`, `processar_personalizadas`) enforce `userId` check.

3. **AI API Key Resolution (Lines 287–315)**:
   - Checks environment variables (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`) and request headers (`x-gemini-key`, `x-openai-key`, `x-groq-key`).

4. **Payload Parsing & AI Key Validation (Lines 317–335)**:
   - Parses `req.body` (handling JSON string or object).
   - Validates that the requested AI provider (default `gemini`) has an API key configured.
   
5. **Action Routing (`switch (acao)` - Lines 341–1379)**:
   - Routes actions such as `listar_sessoes`, `gerar_guia`, `analisar_pratica`, `sugerir_multiplas_respostas`, etc.
   - Returns JSON responses via `res.status(200).json(...)`.
   - Default case returns `400 Ação inválida`.

6. **Global Error Catching (Lines 381–384)**:
   - Outer `try/catch` catches uncaught exceptions and returns `500 Erro no servidor.`.

---

## 2. Key Considerations for `converter_kanji` Integration

### 2.1 HTTP Method & Query Parameter Handling
- **Requirement**: `converter_kanji` must receive `texto` (or `text`) from query string (`req.query`) or body (`req.body`).
- **Current Limitation**: Line 279 currently rejects all non-POST requests with `405 Método não permitido`.
- **Solution**:
  1. Update `Access-Control-Allow-Methods` header to `'GET, POST, OPTIONS'`.
  2. Parse `req.query` alongside `req.body`:
     ```javascript
     const query = req.query || {};
     const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
     const acao = body.acao || query.acao;
     ```
  3. Modify method check to allow both `POST` and `GET` requests (or allow `GET` when `acao === 'converter_kanji'`).

### 2.2 Provider Key Validation Bypass
- **Current Limitation**: Lines 327–335 check for Gemini / OpenAI / Groq API keys *before* the `switch (acao)` statement. If `GEMINI_API_KEY` is not present, any request defaults to failing with `401 Chave de API do Gemini não configurada`.
- **Solution**: Bypass AI key validation when `acao === 'converter_kanji'`, as `converter_kanji` does not use LLM providers.

### 2.3 Google Transliterate API Response Structure
- **Target Endpoint**: `http://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(texto)}`
- **Response Format**: Google Transliterate returns a nested JSON array:
  `[["かな", ["仮名", "金", "かな", "カナ"]]]`
- **Parsing Logic**:
  - `data` is an array of segments.
  - For single segment inputs (e.g. `かな`), `data[0][1]` contains the candidates array `["仮名", "金", "かな", "カナ"]`.
  - For multi-segment inputs (e.g. `かなじ`), `data.flatMap(segment => segment[1] || [])` aggregates all candidate options.

---

## 3. Exact Implementation Plan for `converter_kanji`

### 3.1 Code Changes in `api/dialogo.js`

#### Change 1: Allow GET and Extract Parameters from Query & Body
```javascript
// Header update:
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

if (req.method === 'OPTIONS') return res.status(200).end();
if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
}
```

```javascript
// Extraction update:
const query = req.query || {};
const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
const acao = body.acao || query.acao;
```

#### Change 2: Bypass AI Provider Key Check for Non-AI Actions
```javascript
// Only validate provider keys if the action requires AI
if (acao !== 'converter_kanji') {
    if (provider === 'gemini' && !geminiKey) {
        return res.status(401).json({ error: 'Chave de API do Gemini não configurada no .env' });
    }
    if (provider === 'openai' && !openAIKey) {
        return res.status(401).json({ error: 'Chave de API da OpenAI não configurada no .env' });
    }
    if (provider === 'groq' && !groqKey) {
        return res.status(401).json({ error: 'Chave de API do Groq (GROQ_API_KEY) não configurada no .env' });
    }
}
```

#### Change 3: Add `converter_kanji` Case to `switch (acao)`
```javascript
case 'converter_kanji': {
    const texto = body.texto || body.text || query.texto || query.text;
    
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
        return res.status(400).json({ error: "Parâmetro 'texto' ou 'text' é obrigatório." });
    }

    try {
        const url = `http://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(texto.trim())}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Transliterate API retornou status HTTP ${response.status}`);
        }

        const data = await response.json();
        let candidates = [];

        if (Array.isArray(data) && data.length > 0) {
            if (data.length === 1 && Array.isArray(data[0]?.[1])) {
                candidates = data[0][1];
            } else {
                candidates = data.flatMap(seg => (Array.isArray(seg?.[1]) ? seg[1] : []));
            }
        }

        return res.status(200).json({
            status: 'SUCCESS',
            candidates: candidates
        });
    } catch (err) {
        console.error("Erro na ação converter_kanji:", err);
        return res.status(500).json({
            error: "Erro ao converter texto para kanji",
            message: err.message
        });
    }
}
```

---

## 4. Verification Plan

1. **GET Request Verification**:
   - `GET /api/dialogo?acao=converter_kanji&texto=かな`
   - Expect: Status 200, `{ status: 'SUCCESS', candidates: ["仮名", "金", "かな", "カナ"] }`

2. **POST Request Verification**:
   - `POST /api/dialogo` with body `{ "acao": "converter_kanji", "texto": "かな" }`
   - Expect: Status 200, `{ status: 'SUCCESS', candidates: ["仮名", "金", "かな", "カナ"] }`

3. **Validation Error Verification**:
   - `POST /api/dialogo` with body `{ "acao": "converter_kanji" }` (no text provided)
   - Expect: Status 400, `{ error: "Parâmetro 'texto' ou 'text' é obrigatório." }`

4. **Network/Upstream Failure Handling**:
   - Invalid URL or unreachable host in try/catch block.
   - Expect: Status 500, `{ error: "Erro ao converter texto para kanji", message: ... }`
