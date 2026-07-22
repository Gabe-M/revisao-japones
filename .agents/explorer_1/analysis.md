# Backend API Analysis Report — DialoGo

**Explorer**: Explorer 1 (Backend API Explorer)  
**Date**: 2026-07-21  
**Target Files Analyzed**:
- `api/dialogo.js`
- `api/jisho.js`
- `api/srs.js`

---

## 1. Action `analisar_pratica` (`api/dialogo.js`) Analysis

### 1.1 Current Implementation

In `api/dialogo.js` (lines 1256–1271), the handler for `case 'analisar_pratica'` is defined as follows:

```javascript
case 'analisar_pratica':
    systemInstruction = "Você é um professor de japonês avaliando a resposta do aluno no contexto de um diálogo. Retorne APENAS um JSON válido. O feedback (dica e erro) DEVE estar em Português. IMPORTANTE: Na propriedade 'traducao_correta', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e deve ser colocado apenas sobre os Kanjis, nunca sobre hiragana ou katakana puro. Não utilize nenhuma outra tag além de <ruby> e <rt>.";
    prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
    Resposta do aluno: "${body.resposta_usuario_jp}"
    
    Avalie se a resposta do aluno faz sentido no contexto da conversa e se a gramática/vocabulário estão corretos.
    Estrutura do JSON esperado:
    {
        "score": 85, // número de 0 a 100
        "correto": true, // true se for uma resposta aceitável e compreensível, false caso contrário
        "erros": ["O aluno usou a partícula errada em X"], // array de strings com erros identificados (vazio se não houver)
        "dica": "Dica de como soar mais natural ou corrigir o erro.",
        "traducao_correta": "Sugestão de como o aluno poderia ter formulado essa mesma ideia de forma correta e natural em japonês"
    }`;
    result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
    return res.status(200).json(result);
```

### 1.2 Current Response Payload Schema

Currently, `analisar_pratica` returns:

```typescript
interface CurrentAnalisePraticaResponse {
    score: number;             // 0-100
    correto: boolean;          // true/false
    erros: string[];           // Array of error message strings
    dica: string;              // General tip in PT-BR
    traducao_correta: string;  // Corrected sentence with HTML <ruby> tags
}
```

### 1.3 Target Requirement (R1 — Explicações Gramaticais Estruturadas)

Requirement R1 demands that `analisar_pratica` return an array of structured error objects in `erros_detalhados`:

```typescript
interface ErroDetalhado {
    erro: string;              // Specific error description (e.g. "Uso incorreto da partícula に")
    regra_gramatical: string;  // Grammar rule name (e.g. "Partícula de Lugar vs Destino")
    explicacao: string;        // Detailed explanation in PT-BR
    exemplo_correto: string;   // Correct usage example
}

interface UpdatedAnalisePraticaResponse {
    score: number;
    correto: boolean;
    erros: string[];           // Retained for backward compatibility
    erros_detalhados: ErroDetalhado[]; // NEW structured error array
    dica: string;
    traducao_correta: string;
}
```

### 1.4 Exact Backend Modification Plan for `analisar_pratica`

1. **Update `systemInstruction` & `prompt`**:
   Extend prompt instructions to explicitly request `erros_detalhados` as an array of objects with `{ erro, regra_gramatical, explicacao, exemplo_correto }`.

2. **Safe JSON Parsing & Fallback Sanitization**:
   Before returning `res.status(200).json(result)`, add defensive normalization:

```javascript
case 'analisar_pratica':
    systemInstruction = "Você é um professor de japonês avaliando a resposta do aluno no contexto de um diálogo. Retorne APENAS um JSON válido. O feedback (dica, explicação e regras) DEVE estar em Português (PT-BR). IMPORTANTE: Na propriedade 'traducao_correta', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e deve ser colocado apenas sobre os Kanjis. Não utilize nenhuma outra tag além de <ruby> e <rt>.";
    prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
    Resposta do aluno: "${body.resposta_usuario_jp}"
    
    Avalie se a resposta do aluno faz sentido no contexto da conversa e se a gramática/vocabulário estão corretos.
    Estrutura do JSON esperado:
    {
        "score": 85, // número de 0 a 100
        "correto": true, // true se for uma resposta aceitável e compreensível, false caso contrário
        "erros": ["Descrição resumida do erro"], // array de strings (vazio se não houver)
        "erros_detalhados": [
            {
                "erro": "Trecho ou conceito errado",
                "regra_gramatical": "Nome da regra gramatical violada",
                "explicacao": "Explicação didática detalhada em português de por que está errado e como funciona a regra",
                "exemplo_correto": "Exemplo prático de frase ou expressão correta"
            }
        ],
        "dica": "Dica de como soar mais natural ou corrigir o erro.",
        "traducao_correta": "Sugestão de como o aluno poderia ter formulado essa mesma ideia de forma correta e natural em japonês"
    }`;
    result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
    
    // Normalização e Fallback Seguro de JSON
    if (!result || typeof result !== 'object') {
        result = {};
    }
    if (!Array.isArray(result.erros_detalhados)) {
        result.erros_detalhados = [];
    } else {
        // Garantir que todos os campos de cada erro detalhado existam como string
        result.erros_detalhados = result.erros_detalhados.map(e => ({
            erro: String(e?.erro || ''),
            regra_gramatical: String(e?.regra_gramatical || 'Gramática'),
            explicacao: String(e?.explicacao || ''),
            exemplo_correto: String(e?.exemplo_correto || '')
        }));
    }
    if (!Array.isArray(result.erros)) {
        result.erros = result.erros_detalhados.map(e => e.erro).filter(Boolean);
    }
    return res.status(200).json(result);
```

---

## 2. Action `sugerir_multiplas_respostas` (`api/dialogo.js`) Analysis

### 2.1 Current Implementation

In `api/dialogo.js` (lines 1196–1241):

```javascript
case 'sugerir_multiplas_respostas': {
    let limitacoesVocabMulti = '';
    if (vocabulario && vocabulario.length > 0) {
        limitacoesVocabMulti = `...`;
    }
    systemInstruction = `Você é um personagem em um RPG de conversa em japonês focado no tema: "${tema}" e também um professor ajudando o aluno. Retorne APENAS um JSON válido. IMPORTANTE: Use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> em TODOS os campos '_jp' para TODOS os Kanjis presentes (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e aplicado apenas sobre Kanjis. Você DEVE separar os blocos lógicos/pedagógicos usando a tag <w>. Nunca use tags <span> ou qualquer outra tag HTML além de <ruby>, <rt> e <w>.`;
    prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
    Tema do RPG: "${tema}"
    ${jlpt ? `Nível de dificuldade máximo: ${jlpt}.` : ''}
    ${limitacoesVocabMulti}
    
    Gere 3 sugestões de resposta distintas e adequadas ao contexto: uma concordando/aceitando, uma discordando/recusando, e uma fazendo uma pergunta de volta. Adapte ao contexto do tema.
    
    Estrutura do JSON esperado:
    {
        "sugestoes": [
            {
                "intencao": "Concordar",
                "emoji": "✅",
                "jp": "Frase em japonês (com ruby tags e <w>)",
                "pt": "Tradução exata em português",
                "dica": "Por que essa é uma boa resposta neste contexto"
            },
            {
                "intencao": "Discordar",
                "emoji": "🙅",
                "jp": "Frase em japonês (com ruby tags e <w>)",
                "pt": "Tradução exata em português",
                "dica": "Por que essa é uma boa resposta neste contexto"
            },
            {
                "intencao": "Perguntar",
                "emoji": "🤔",
                "jp": "Frase em japonês (com ruby tags e <w>)",
                "pt": "Tradução exata em português",
                "dica": "Por que essa é uma boa resposta neste contexto"
            }
        ]
    }`;
    result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
    return res.status(200).json(result);
}
```

### 2.2 Response Payload Structure

The endpoint returns JSON:

```json
{
    "sugestoes": [
        {
            "intencao": "Concordar",
            "emoji": "✅",
            "jp": "<w><ruby>行<rt>い</rt></ruby>きましょう</w>",
            "pt": "Vamos!",
            "dica": "Aceita a proposta de forma natural."
        },
        {
            "intencao": "Discordar",
            "emoji": "🙅",
            "jp": "<w>ちょっと<ruby>忙<rt>いそが</rt></ruby>しい desu</w>",
            "pt": "Estou um pouco ocupado.",
            "dica": "Maneira polida de recusar."
        },
        {
            "intencao": "Perguntar",
            "emoji": "🤔",
            "jp": "<w><ruby>何時<rt>なんじ</rt></ruby>ですか</w>",
            "pt": "Que horas é?",
            "dica": "Pede mais informações."
        }
    ]
}
```

### 2.3 Notes for Frontend Implementation (R2)

- Backend functionality for `sugerir_multiplas_respostas` is fully functional and implemented.
- Field mappings:
  - `intencao`: `'Concordar' | 'Discordar' | 'Perguntar'`
  - `emoji`: `'✅' | '🙅' | '🤔'`
  - `jp`: Japanese text with `<ruby>` and `<w>` tags
  - `pt`: Portuguese translation
  - `dica`: Contextual rationale
- Frontend (`AjudaModal.tsx`) should call `callEndpoint('sugerir_multiplas_respostas')` when clicking the "Sugestão" button, rendering 3 Shadcn Cards (one per item in `data.sugestoes`).

---

## 3. Examination of `api/jisho.js` and `api/srs.js` (`acao=salvar`)

### 3.1 Authorization & Authentication Token Extraction

Both `api/jisho.js` and `api/srs.js` share the JWT parsing logic via `obterUserIdDoToken(tokenUsuario)`:

```javascript
const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;
const userId = obterUserIdDoToken(tokenUsuario);
```

#### JWT Extraction Mechanism:
- Splits token string by `.`.
- Reads `payload.sub` from second base64 part.
- If valid JWT token is sent as `Authorization: Bearer <session.access_token>`, `userId` is extracted successfully.
- `tokenUsuario` header is forwarded directly to Supabase REST calls (`headers: { "Authorization": tokenUsuario, "apikey": SUPABASE_KEY }`), ensuring Supabase RLS (Row Level Security) functions seamlessly.

---

### 3.2 `api/jisho.js` (`acao=salvar`) Contract & DB Operations

#### Request Contract:
- **Method**: `POST`
- **URL**: `/api/jisho?acao=salvar`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <session.access_token>`
- **Body**:

```json
{
    "item": "学生",
    "leitura": "がくせい",
    "significado": "Estudante",
    "categoria": "Substantivo",
    "jlpt": "N5"
}
```

*(Can also be passed as an array of objects).*

#### Database & Business Operations:
1. Checks for existing vocabulary entries matching `item` to merge set tags (`[Conjuntos: ...]`) and `baralhos` arrays.
2. Attaches `user_id = userId` (if logged in).
3. Executes PostgREST UPSERT on Supabase table `vocabulario`:
   - `POST https://sodqxkvkxifczfscbxwo.supabase.co/rest/v1/vocabulario`
   - Header `Prefer: resolution=merge-duplicates,return=representation`
4. Returns `201 Created` with array of inserted/updated records.

---

### 3.3 `api/srs.js` (`acao=salvar`) Contract & DB Operations

#### Request Contract:
- **Method**: `POST`
- **URL**: `/api/srs?acao=salvar`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <session.access_token>`
- **Body**:

```json
{
    "item": "学生",
    "repetitions": 0,
    "due": 1753140000000
}
```

#### Database & Business Operations:
1. Attaches `user_id = userId` (if logged in).
2. Executes PostgREST UPSERT on Supabase table `srs_progresso`:
   - `POST https://sodqxkvkxifczfscbxwo.supabase.co/rest/v1/srs_progresso`
   - Header `Prefer: resolution=merge-duplicates,return=representation`
3. Default SRS initial fields: `ease = 2.5`, `interval = 0`, `repetitions = 0`, `due = Date.now()`, `lapses = 0`.
4. Returns `201 Created` with array of inserted/updated records.

---

## 4. Requirement Verification & Risk Assessment Matrix

| Requirement | Target File | Current Status | Required Action / Change | Risk Level & Mitigation |
|-------------|-------------|----------------|--------------------------|-------------------------|
| **R1 — Explicações Gramaticais** | `api/dialogo.js` | Returns simple string array `erros` | Update system prompt + JSON prompt schema to include `erros_detalhados` array of objects. Add defensive array validation & fallback parsing. | **Low**: Ensure fallback logic populates `erros_detalhados = []` if LLM fails, so frontend never breaks on `.map()`. |
| **R2 — Múltiplas Sugestões** | `api/dialogo.js` | Action `sugerir_multiplas_respostas` already implemented and returning `{ sugestoes: [...] }` | None required in backend. Document contract for Frontend implementer. | **Low**: Field names (`intencao`, `emoji`, `jp`, `pt`, `dica`) are confirmed. |
| **R3 — Salvar Vocabulário (Jisho + SRS)** | `api/jisho.js` & `api/srs.js` | `acao=salvar` endpoints fully functional and handling auth token & DB upserts | None required in backend. Confirm request payload structures for Frontend dual call. | **Low**: Ensure frontend passes `Authorization: Bearer <session.access_token>` header on both requests. |

---

## 5. Proposed Diff Patch for `api/dialogo.js`

```patch
--- api/dialogo.js
+++ api/dialogo.js
@@ -1256,18 +1256,47 @@
             case 'analisar_pratica':
-                systemInstruction = "Você é um professor de japonês avaliando a resposta do aluno no contexto de um diálogo. Retorne APENAS um JSON válido. O feedback (dica e erro) DEVE estar em Português. IMPORTANTE: Na propriedade 'traducao_correta', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e deve ser colocado apenas sobre os Kanjis, nunca sobre hiragana ou katakana puro. Não utilize nenhuma outra tag além de <ruby> e <rt>.";
+                systemInstruction = "Você é um professor de japonês avaliando a resposta do aluno no contexto de um diálogo. Retorne APENAS um JSON válido. O feedback (dica, explicação e regras) DEVE estar em Português (PT-BR). IMPORTANTE: Na propriedade 'traducao_correta', use obrigatoriamente tags HTML no formato correto <ruby>Kanji<rt>furigana</rt></ruby> para TODOS os Kanjis presentes na frase (sem exceção). O furigana deve ser escrito exclusivamente em Hiragana e deve ser colocado apenas sobre os Kanjis. Não utilize nenhuma outra tag além de <ruby> e <rt>.";
                 prompt = `Mensagem do personagem: "${body.mensagem_ia_jp}"
                 Resposta do aluno: "${body.resposta_usuario_jp}"
                 
                 Avalie se a resposta do aluno faz sentido no contexto da conversa e se a gramática/vocabulário estão corretos.
                 Estrutura do JSON esperado:
                 {
                     "score": 85, // número de 0 a 100
                     "correto": true, // true se for uma resposta aceitável e compreensível, false caso contrário
                     "erros": ["O aluno usou a partícula errada em X"], // array de strings com erros identificados (vazio se não houver)
+                    "erros_detalhados": [
+                        {
+                            "erro": "Trecho ou conceito errado",
+                            "regra_gramatical": "Nome da regra gramatical violada",
+                            "explicacao": "Explicação didática detalhada em português de por que está errado e como funciona a regra",
+                            "exemplo_correto": "Exemplo prático de frase ou expressão correta em japonês"
+                        }
+                    ],
                     "dica": "Dica de como soar mais natural ou corrigir o erro.",
                     "traducao_correta": "Sugestão de como o aluno poderia ter formulado essa mesma ideia de forma correta e natural em japonês"
                 }`;
                 result = await callAI(systemInstruction, [{ role: 'user', content: prompt }], geminiKey, openAIKey, groqKey, provider, 'llama-3.1-8b-instant');
+                
+                if (!result || typeof result !== 'object') {
+                    result = {};
+                }
+                if (!Array.isArray(result.erros_detalhados)) {
+                    result.erros_detalhados = [];
+                } else {
+                    result.erros_detalhados = result.erros_detalhados.map(e => ({
+                        erro: String(e?.erro || ''),
+                        regra_gramatical: String(e?.regra_gramatical || 'Gramática'),
+                        explicacao: String(e?.explicacao || ''),
+                        exemplo_correto: String(e?.exemplo_correto || '')
+                    }));
+                }
+                if (!Array.isArray(result.erros)) {
+                    result.erros = result.erros_detalhados.map(e => e.erro).filter(Boolean);
+                }
                 return res.status(200).json(result);
```
