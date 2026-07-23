# Technical Analysis & Implementation Plan: Milestone 2 (R2 - Enrichment Layer in `api/dialogo.js`)

## Executive Summary
This document presents the detailed architectural inspection of `api/dialogo.js` and formulates the technical design for adding `case 'enriquecer_card'`. The enrichment layer integrates data from the Jisho REST API (`https://jisho.org/api/v1/search/words`) with LLM-powered translation (`callAI`) to produce standardized, high-quality Portuguese study cards `{ item, leitura, significado, categoria, jlpt, exemplo_jp, exemplo_pt }`.

---

## 1. Codebase Inspection (`api/dialogo.js`)

### 1.1 Action Routing
- **Routing mechanism**: `api/dialogo.js` uses a `switch (acao)` block at line 356.
- **Action parameter extraction**:
  ```javascript
  const acao = body.acao || query.acao;
  ```
- **Existing cases**: `listar_sessoes`, `criar_sessao`, `apagar_sessao`, `gerar_guia`, `gerar_vocabulario_lote`, `processar_personalizadas`, `gerar_traducao`, `analisar_traducao`, `salvar_traducao_dados`, `iniciar_dialogo`, `continuar_dialogo`, `ajustar_nota`, `analisar_mensagem`, `obter_vocabulario_relacionado`, `sugerir_resposta`, `sugerir_multiplas_respostas`, `tirar_duvida`, `analisar_pratica`, `sugerir_lacuna`, `explicar_termo_contextual`, `analisar_selecao_livre`, `converter_kanji`.
- **Target insertion point for `case 'enriquecer_card'`**: Added to the `switch (acao)` statement in `api/dialogo.js`.

### 1.2 Authentication & Session Verification
- **Header capture**: `const tokenUsuario = req.headers['authorization'];` (line 281).
- **JWT Decoder / Validator**: `obterUserIdDoToken(authHeader)` (lines 232–257) attempts local base64 decoding of `payload.sub` and falls back to `supabase.auth.getUser(token)`.
- **Auth Enforcement**:
  ```javascript
  const precisaAuth = ['listar_sessoes', 'criar_sessao'].includes(acao) || !!sessionId;
  if (precisaAuth && !userId) {
      return res.status(401).json({ error: 'Não autorizado. Token de autenticação ausente ou inválido.' });
  }
  ```
- **API Key Validation**:
  ```javascript
  if (acao !== 'converter_kanji') {
      if (provider === 'gemini' && !geminiKey) return res.status(401).json({ error: '...' });
      if (provider === 'openai' && !openAIKey) return res.status(401).json({ error: '...' });
      if (provider === 'groq' && !groqKey) return res.status(401).json({ error: '...' });
  }
  ```
  `case 'enriquecer_card'` relies on provider key validation.

### 1.3 LLM Invocation (`callAI`)
- **Signature**: `async function callAI(systemInstruction, messages, geminiKey, openAIKey, groqKey, provider = 'gemini', groqModel = 'llama-3.3-70b-versatile')` (lines 22–132).
- **Supported Providers**: `'gemini'`, `'openai'`, `'groq'`, `'pollinations'`.
- **JSON Sanitization**: Uses `cleanAndParseJson(text)` (lines 1–20) to strip code fences (` ```json ... ``` `) and parse output safely.
- **Invocation Pattern for Fast Tasks**: Uses fast model (e.g. `'llama-3.1-8b-instant'` for Groq or standard Gemini Flash) for low latency.

---

## 2. Jisho API Analysis

### 2.1 Endpoint Specification
- **URL**: `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(palavra)}`
- **Method**: GET
- **Response Format**:
  ```json
  {
    "meta": { "status": 200 },
    "data": [
      {
        "slug": "猫",
        "is_common": true,
        "jlpt": ["jlpt-n5"],
        "japanese": [
          { "word": "猫", "reading": "ねこ" }
        ],
        "senses": [
          {
            "english_definitions": ["cat (esp. the domestic cat, Felis catus)", "feline"],
            "parts_of_speech": ["Noun"]
          }
        ]
      }
    ]
  }
  ```

### 2.2 Field Extraction Matrix
| Target Field | Source in Jisho API Response | Fallback |
|---|---|---|
| **Reading (`leitura`)** | `japanese[0].reading` | `japanese[0].word` or `''` |
| **Category (`categoria`)** | `senses[0].parts_of_speech[0]` | `''` (LLM translates to PT, e.g., "Noun" -> "Substantivo") |
| **JLPT Level (`jlpt`)** | `jlpt[0]` (e.g., `"jlpt-n5"` formatted to `"N5"`) | `''` |
| **English Definitions** | `senses[0].english_definitions` (Array of strings) | `[]` |

### 2.3 Edge Cases & Resiliency
1. **Empty `data` Array (`data: []`)**: Occurs when Jisho has no entry for the word.
   - *Handling*: Do not throw error; fallback to LLM generation of reading, Portuguese meaning, category, and JLPT directly from `palavra`.
2. **Network Timeout / Fetch Error**:
   - *Handling*: Wrap fetch in `try/catch` with `AbortController` timeout (e.g. 5 seconds). Fallback gracefully to pure LLM enrichment.
3. **Kana-only Words** (e.g., `ラーメン`): `japanese[0].word` may equal `japanese[0].reading` or be omitted. Using `japanese[0].reading || japanese[0].word` correctly extracts `ラーメン`.
4. **Multiple Definitions / Senses**: `senses[0].english_definitions` captures primary definitions.

---

## 3. Technical Design for `case 'enriquecer_card'`

### 3.1 Contract Definition
- **Input Request Body**:
  ```json
  {
    "acao": "enriquecer_card",
    "item": "猫",             // or "palavra" / "termo"
    "exemplo_jp": "猫がいます", // Optional
    "exemplo_pt": null,       // Optional (if null/empty and exemplo_jp is present, LLM translates)
    "provider": "gemini"      // Optional
  }
  ```

- **Output Response JSON**:
  ```json
  {
    "item": "猫",
    "leitura": "ねこ",
    "significado": "gato, felino",
    "categoria": "Substantivo",
    "jlpt": "N5",
    "exemplo_jp": "猫がいます",
    "exemplo_pt": "Há um gato."
  }
  ```

### 3.2 Workflow Logic
```
  +-------------------------------------------------------+
  | 1. Extract inputs (item/palavra, exemplo_jp, etc.)     |
  +-------------------------------------------------------+
                            |
                            v
  +-------------------------------------------------------+
  | 2. Fetch Jisho API with AbortController timeout (5s)  |
  +-------------------------------------------------------+
                            |
            +---------------+---------------+
            |                               |
  (Jisho Data Found)              (Empty/API Error)
            |                               |
            v                               v
  Extract reading, category,      Fallback to empty Jisho
  JLPT, english_defs               metadata array
            |                               |
            +---------------+---------------+
                            |
                            v
  +-------------------------------------------------------+
  | 3. Construct prompt for callAI:                       |
  |    - Translate english_defs -> strict PT              |
  |    - Translate/map category English -> PT             |
  |    - If exemplo_pt is empty & exemplo_jp present,     |
  |      translate exemplo_jp -> exemplo_pt               |
  |    - (If Jisho empty, LLM generates missing metadata) |
  +-------------------------------------------------------+
                            |
                            v
  +-------------------------------------------------------+
  | 4. Merge Jisho data + LLM result into response JSON   |
  +-------------------------------------------------------+
                            |
                            v
  +-------------------------------------------------------+
  | 5. Return res.status(200).json(cardEnriquecido)       |
  +-------------------------------------------------------+
```

### 3.3 Proposed Code Implementation Sketch (for Implementer)

```javascript
case 'enriquecer_card': {
    const palavra = body.item || body.palavra || body.termo;
    if (!palavra || typeof palavra !== 'string' || !palavra.trim()) {
        return res.status(400).json({ error: 'Palavra ou item não informado para enriquecimento.' });
    }

    const itemStr = palavra.trim();
    let leituraJisho = body.leitura || '';
    let categoriaJisho = body.categoria || '';
    let jlptJisho = body.jlpt || '';
    let englishDefs = [];

    // Step 1: Safe Fetch Jisho API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const urlJisho = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(itemStr)}`;
        const resJisho = await fetch(urlJisho, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resJisho.ok) {
            const jishoData = await resJisho.json();
            if (jishoData && Array.isArray(jishoData.data) && jishoData.data.length > 0) {
                const firstMatch = jishoData.data[0];
                if (firstMatch.japanese && firstMatch.japanese[0]) {
                    leituraJisho = firstMatch.japanese[0].reading || firstMatch.japanese[0].word || leituraJisho;
                }
                if (firstMatch.senses && firstMatch.senses[0]) {
                    if (Array.isArray(firstMatch.senses[0].parts_of_speech) && firstMatch.senses[0].parts_of_speech.length > 0) {
                        categoriaJisho = firstMatch.senses[0].parts_of_speech[0];
                    }
                    if (Array.isArray(firstMatch.senses[0].english_definitions)) {
                        englishDefs = firstMatch.senses[0].english_definitions;
                    }
                }
                if (Array.isArray(firstMatch.jlpt) && firstMatch.jlpt.length > 0) {
                    jlptJisho = firstMatch.jlpt[0].replace(/^jlpt-/, '').toUpperCase();
                }
            }
        }
    } catch (errJisho) {
        console.warn("Aviso: Falha ou timeout ao consultar Jisho API para enriquecimento:", errJisho.message);
    }

    // Step 2: Construct LLM Prompt
    const precisaTraduzirExemplo = body.exemplo_jp && (!body.exemplo_pt || !body.exemplo_pt.trim());

    systemInstruction = "Você é um dicionário e assistente pedagógico de japonês para português. Retorne APENAS um JSON válido em português (PT-BR).";
    prompt = `Termo em japonês: "${itemStr}"
Leitura identificada: "${leituraJisho}"
Categoria identificada no Jisho: "${categoriaJisho}"
Nível JLPT: "${jlptJisho}"
Definições em inglês do Jisho: ${englishDefs.length > 0 ? JSON.stringify(englishDefs) : 'Nenhuma (não encontrada no Jisho)'}
${body.exemplo_jp ? `Frase de exemplo em japonês: "${body.exemplo_jp}"` : ''}
${body.exemplo_pt ? `Tradução existente do exemplo: "${body.exemplo_pt}"` : ''}

Instruções:
1. "significado": Traduza as definições em inglês acima para o português (PT-BR) de forma direta, concisa e natural. Se não houver definições em inglês, forneça o significado em português mais preciso para o termo "${itemStr}".
2. "categoria": Traduza a categoria gramatical para o português (ex: "Noun" -> "Substantivo", "Ichidan verb" -> "Verbo", "Na-adjective" -> "Adjetivo Na"). Se vazia, deduza a classe gramatical em português.
3. "leitura": Se a leitura estiver vazia, forneça a leitura em hiragana correspondente.
4. "jlpt": Se o nível JLPT estiver vazio, informe o nível estimado (ex: "N5", "N4", "N3", etc).
${precisaTraduzirExemplo ? `5. "exemplo_pt": Traduza a frase de exemplo em japonês "${body.exemplo_jp}" para o português de forma natural.` : ''}

Estrutura do JSON esperado:
{
    "leitura": "${leituraJisho || 'leitura em hiragana'}",
    "significado": "Tradução concisa em português",
    "categoria": "Substantivo/Verbo/etc",
    "jlpt": "${jlptJisho || 'N5'}"${precisaTraduzirExemplo ? ',\n    "exemplo_pt": "Tradução em português da frase de exemplo"' : ''}
}`;

    result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');

    // Step 3: Assemble normalized JSON response
    const cardEnriquecido = {
        item: itemStr,
        leitura: result.leitura || leituraJisho || body.leitura || '',
        significado: result.significado || (englishDefs.length > 0 ? englishDefs.join(', ') : body.significado || ''),
        categoria: result.categoria || categoriaJisho || body.categoria || 'Geral',
        jlpt: result.jlpt || jlptJisho || body.jlpt || '',
        exemplo_jp: body.exemplo_jp || null,
        exemplo_pt: body.exemplo_pt || result.exemplo_pt || null
    };

    return res.status(200).json(cardEnriquecido);
}
```

---

## 4. Verification and Invalidation Strategy

### 4.1 Verification Methods
1. **Normal Flow Verification**:
   - Send `POST /api/dialogo` with body `{ "acao": "enriquecer_card", "item": "猫" }`.
   - Verify response status `200` and structure containing `item`, `leitura`, `significado` (translated to PT), `categoria` ("Substantivo"), `jlpt` ("N5"), `exemplo_jp` (null), `exemplo_pt` (null).
2. **Sentence Translation Verification**:
   - Send `POST /api/dialogo` with body `{ "acao": "enriquecer_card", "item": "猫", "exemplo_jp": "猫が好きです。" }`.
   - Verify `exemplo_pt` is non-null and contains Portuguese translation (e.g., "Gosto de gatos.").
3. **Empty Jisho Result Verification**:
   - Send `POST /api/dialogo` with body `{ "acao": "enriquecer_card", "item": "TermoInexistente12345" }`.
   - Verify handler does not crash and LLM gracefully handles enrichment.
4. **Validation Error Verification**:
   - Send `POST /api/dialogo` with body `{ "acao": "enriquecer_card" }` (missing item).
   - Verify response status `400 Bad Request`.

---
