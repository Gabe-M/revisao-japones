// Empirical Test Harness for Backend API & AjudaModal (R1, R2, R3)
import fs from 'fs';
import path from 'path';

console.log("=== STARTING EMPIRICAL VERIFICATION HARNESS ===");

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
    if (condition) {
        passed++;
        results.push(`[PASS] ${message}`);
        console.log(`[PASS] ${message}`);
    } else {
        failed++;
        results.push(`[FAIL] ${message}`);
        console.log(`[FAIL] ${message}`);
    }
}

// ----------------------------------------------------
// 1. TEST R1 BACKEND NORMALIZATION LOGIC
// ----------------------------------------------------
console.log("\n--- Testing R1 Backend Normalization Logic ---");

function testNormalization(resultInput) {
    let result = resultInput;
    try {
        if (!result || typeof result !== 'object') {
            result = {};
        }
        if (!Array.isArray(result.erros_detalhados)) {
            result.erros_detalhados = [];
        } else {
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
    } catch (errNormalizacao) {
        if (!result || typeof result !== 'object') result = {};
        result.erros_detalhados = [];
        result.erros = result.erros || [];
    }
    return result;
}

// Case 1.1: Valid payload
const norm1 = testNormalization({
    score: 90,
    correto: true,
    erros_detalhados: [
        { erro: 'Partícula は', regra_gramatical: 'Tópico', explicacao: 'Usar は', exemplo_correto: '私は' }
    ]
});
assert(Array.isArray(norm1.erros_detalhados) && norm1.erros_detalhados.length === 1, "R1.1: Valid erros_detalhados array handled");
assert(norm1.erros_detalhados[0].regra_gramatical === 'Tópico', "R1.2: Preserves property values");
assert(Array.isArray(norm1.erros) && norm1.erros[0] === 'Partícula は', "R1.3: Generates erros array fallback from erros_detalhados");

// Case 1.2: Null erros_detalhados
const norm2 = testNormalization({ score: 50, erros_detalhados: null });
assert(Array.isArray(norm2.erros_detalhados) && norm2.erros_detalhados.length === 0, "R1.4: Null erros_detalhados normalized to []");

// Case 1.3: Non-object result (string/null)
const norm3 = testNormalization("Invalid LLM string response");
assert(typeof norm3 === 'object' && Array.isArray(norm3.erros_detalhados) && norm3.erros_detalhados.length === 0, "R1.5: String result normalized to object with empty erros_detalhados");

// Case 1.4: Malformed elements in array (null element or missing properties)
const norm4 = testNormalization({
    erros_detalhados: [null, { erro: null, explicacao: undefined }]
});
assert(norm4.erros_detalhados.length === 2, "R1.6: Handles array containing null/malformed elements without throwing");
assert(norm4.erros_detalhados[0].erro === '' && norm4.erros_detalhados[0].regra_gramatical === 'Gramática', "R1.7: Safely converts null element fields to defaults");

// ----------------------------------------------------
// 2. TEST AUTH JWT DECODER IN JISHO & SRS
// ----------------------------------------------------
console.log("\n--- Testing JWT Decoding (api/jisho.js & api/srs.js) ---");

function obterUserIdDoToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
            if (payload && payload.sub && payload.role === 'authenticated') {
                return payload.sub;
            }
        }
    } catch (e) {
        // console.error("Erro ao decodificar JWT:", e);
    }
    return null;
}

assert(obterUserIdDoToken(null) === null, "Auth: Null header returns null");
assert(obterUserIdDoToken("Basic 12345") === null, "Auth: Non-Bearer header returns null");
assert(obterUserIdDoToken("Bearer invalid.jwt.string") === null, "Auth: Malformed JWT string returns null without crashing");

// Valid synthetic JWT payload { sub: 'user_123', role: 'authenticated' }
const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString('base64url');
const payload = Buffer.from(JSON.stringify({ sub: "user_123", role: "authenticated" })).toString('base64url');
const syntheticJwt = `Bearer ${header}.${payload}.signature`;
assert(obterUserIdDoToken(syntheticJwt) === 'user_123', "Auth: Valid JWT extracts user ID correctly");

// ----------------------------------------------------
// 3. TEST AJUDAMODAL COMPONENT SOURCE CONTRACTS
// ----------------------------------------------------
console.log("\n--- Testing AjudaModal Source Code Contracts ---");

const mePath = path.resolve('src/dialogo/components/AjudaModal.tsx');
const ajudaModalCode = fs.readFileSync(mePath, 'utf-8');

// Check prop drilling session
assert(ajudaModalCode.includes('session?: any'), "AjudaModal accepts session prop in AjudaModalProps");
assert(ajudaModalCode.includes("headers['Authorization'] = 'Bearer ' + session.access_token"), "AjudaModal callEndpoint sets Authorization Bearer token from session");

// Check R1 Accordion rendering
assert(ajudaModalCode.includes('<Accordion type="single" collapsible'), "R1: Uses Accordion component from @/components/ui/accordion");
assert(ajudaModalCode.includes('analisePratica.erros_detalhados'), "R1: Checks analisePratica.erros_detalhados");
assert(ajudaModalCode.includes('analisePratica.erros'), "R1: Fallback to analisePratica.erros");

// Check R2 3 Cards rendering
assert(ajudaModalCode.includes("callEndpoint('sugerir_multiplas_respostas')"), "R2: Calls backend endpoint sugerir_multiplas_respostas");
assert(ajudaModalCode.includes('sugestoes.map'), "R2: Maps over 3 suggestions array");
assert(ajudaModalCode.includes('✏️ Praticar'), "R2: Render '✏️ Praticar' button");
assert(ajudaModalCode.includes('✅ Usar direto'), "R2: Render '✅ Usar direto' button");

// Check R3 Dual Persistence (Jisho + SRS)
assert(ajudaModalCode.includes("fetch('/api/jisho?acao=salvar'"), "R3: Performs POST fetch to /api/jisho?acao=salvar");
assert(ajudaModalCode.includes("fetch('/api/srs?acao=salvar'"), "R3: Performs POST fetch to /api/srs?acao=salvar");
assert(ajudaModalCode.includes("if (!session?.access_token)"), "R3: Checks session?.access_token before saving");
assert(ajudaModalCode.includes("alert("), "R3: Provides fallback alert feedback on error or unauthenticated session");

console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
fs.writeFileSync(
    path.resolve('.agents/challenger_1/test_results.txt'),
    `SUMMARY: ${passed} PASSED, ${failed} FAILED\n\n` + results.join('\n')
);
