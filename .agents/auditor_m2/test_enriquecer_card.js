import handler from '../../api/dialogo.js';

function createMockRes() {
    let statusCode = 200;
    let headers = {};
    let jsonBody = null;

    return {
        setHeader(key, val) {
            headers[key] = val;
        },
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            jsonBody = body;
            return this;
        },
        end() {
            return this;
        },
        get _statusCode() { return statusCode; },
        get _jsonBody() { return jsonBody; }
    };
}

async function runTests() {
    console.log("=== Testing input validation for missing palavra (with key) ===");
    {
        const req = {
            method: 'POST',
            headers: { 'x-gemini-key': 'dummy-key-for-test' },
            body: { acao: 'enriquecer_card' }
        };
        const res = createMockRes();
        await handler(req, res);
        console.log("Status:", res._statusCode);
        console.log("Body:", res._jsonBody);
        if (res._statusCode === 400 && res._jsonBody?.error?.includes('Palavra ou item não informado')) {
            console.log("PASS: Input validation missing word test");
        } else {
            console.log("FAIL: Input validation missing word test");
        }
    }

    console.log("\n=== Testing invalid action ===");
    {
        const req = {
            method: 'POST',
            headers: { 'x-gemini-key': 'dummy-key-for-test' },
            body: { acao: 'acao_inexistente' }
        };
        const res = createMockRes();
        await handler(req, res);
        console.log("Status:", res._statusCode);
        console.log("Body:", res._jsonBody);
        if (res._statusCode === 400 && res._jsonBody?.error === 'Ação inválida') {
            console.log("PASS: Invalid action test");
        } else {
            console.log("FAIL: Invalid action test");
        }
    }

    console.log("\n=== Testing enriquecer_card flow with dummy key (expecting callAI failure) ===");
    {
        const req = {
            method: 'POST',
            headers: { 'x-gemini-key': 'dummy-key-for-test' },
            body: { acao: 'enriquecer_card', item: '猫' }
        };
        const res = createMockRes();
        await handler(req, res);
        console.log("Status:", res._statusCode);
        console.log("Body:", res._jsonBody);
        if (res._statusCode === 500 && res._jsonBody?.error === 'Erro no servidor.') {
            console.log("PASS: Real callAI attempt made and failed cleanly with 500 on invalid key (not mocked!)");
        } else {
            console.log("FAIL: Did not fail with 500 as expected for invalid AI key");
        }
    }
}

runTests().catch(err => console.error("Test error:", err));
