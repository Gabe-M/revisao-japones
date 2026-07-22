import handler from '../../api/dialogo.js';

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.headers = {};
        this.body = null;
        this.ended = false;
    }
    setHeader(key, value) {
        this.headers[key] = value;
        return this;
    }
    status(code) {
        this.statusCode = code;
        return this;
    }
    json(data) {
        this.body = data;
        this.ended = true;
        return this;
    }
    end() {
        this.ended = true;
        return this;
    }
}

async function runTests() {
    console.log("=== Testing api/dialogo.js converter_kanji ===");

    // Test 1: OPTIONS request
    {
        const req = { method: 'OPTIONS' };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 1 (OPTIONS):", res.statusCode === 200 && res.headers['Access-Control-Allow-Methods'].includes('GET') ? "PASS" : "FAIL", res.statusCode, res.headers);
    }

    // Test 2: Invalid HTTP Method (DELETE)
    {
        const req = { method: 'DELETE' };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 2 (DELETE 405):", res.statusCode === 405 && res.body?.error === 'Método não permitido' ? "PASS" : "FAIL", res.statusCode, res.body);
    }

    // Test 3: GET request missing texto
    {
        const req = { method: 'GET', query: { acao: 'converter_kanji' }, headers: {} };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 3 (GET missing texto 400):", res.statusCode === 400 && res.body?.error === 'Texto não informado' ? "PASS" : "FAIL", res.statusCode, res.body);
    }

    // Test 4: GET request valid texto (かな)
    {
        const req = { method: 'GET', query: { acao: 'converter_kanji', texto: 'かな' }, headers: {} };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 4 (GET converter_kanji 'かな'):", res.statusCode === 200 && res.body?.status === 'SUCCESS' && Array.isArray(res.body?.candidates) ? "PASS" : "FAIL", res.statusCode, JSON.stringify(res.body));
    }

    // Test 5: POST request valid texto (かな) via body
    {
        const req = { method: 'POST', body: JSON.stringify({ acao: 'converter_kanji', texto: 'かな' }), headers: {} };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 5 (POST converter_kanji 'かな'):", res.statusCode === 200 && res.body?.status === 'SUCCESS' && Array.isArray(res.body?.candidates) ? "PASS" : "FAIL", res.statusCode, JSON.stringify(res.body));
    }

    // Test 6: POST request valid text (sakura) via body object
    {
        const req = { method: 'POST', body: { acao: 'converter_kanji', text: 'さくら' }, headers: {} };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 6 (POST converter_kanji 'さくら'):", res.statusCode === 200 && res.body?.status === 'SUCCESS' && Array.isArray(res.body?.candidates) ? "PASS" : "FAIL", res.statusCode, JSON.stringify(res.body));
    }

    // Test 7: Verify AI key bypass (no API keys in env/headers, action is converter_kanji)
    {
        const req = { method: 'GET', query: { acao: 'converter_kanji', texto: 'ねこ' }, headers: {} };
        const res = new MockResponse();
        await handler(req, res);
        console.log("Test 7 (AI key bypass):", res.statusCode === 200 ? "PASS" : "FAIL", res.statusCode, res.body);
    }
}

runTests().catch(err => console.error("Test execution error:", err));
