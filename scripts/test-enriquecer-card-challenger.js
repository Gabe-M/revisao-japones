import handler from '../api/dialogo.js';

function createMockReqRes(body = {}, query = {}, headers = {}) {
    let statusCode = 200;
    let resHeaders = {};
    let responseData = null;

    const req = {
        method: 'POST',
        body,
        query,
        headers
    };

    const res = {
        setHeader(name, value) {
            resHeaders[name] = value;
        },
        status(code) {
            statusCode = code;
            return res;
        },
        json(data) {
            responseData = data;
            return res;
        },
        end() {
            return res;
        },
        _getResponse() {
            return { statusCode, resHeaders, responseData };
        }
    };

    return { req, res };
}

async function runTests() {
    console.log("=== EMPIRICAL TEST SUITE FOR case 'enriquecer_card' ===");

    const tests = [
        {
            name: "Test 1.1: Whitespace-only item",
            body: { acao: 'enriquecer_card', item: '   ' },
            expectedStatus: 400
        },
        {
            name: "Test 1.2: Whitespace-only palavra",
            body: { acao: 'enriquecer_card', palavra: '\t\n ' },
            expectedStatus: 400
        },
        {
            name: "Test 1.3: Empty string termo",
            body: { acao: 'enriquecer_card', termo: '' },
            expectedStatus: 400
        },
        {
            name: "Test 2.1: Undefined item/palavra/termo fields",
            body: { acao: 'enriquecer_card' },
            expectedStatus: 400
        },
        {
            name: "Test 2.2: Undefined optional fields (leitura, exemplo_jp, exemplo_pt, etc.)",
            body: { acao: 'enriquecer_card', item: '猫' },
            expectedStatus: 200,
            checkResult: (data) => data.item === '猫' && data.leitura && data.significado
        },
        {
            name: "Test 2.3: Non-string truthy exemplo_pt (e.g. true or 123)",
            body: { acao: 'enriquecer_card', item: '猫', exemplo_jp: '猫がいます', exemplo_pt: true },
            expectedStatus: 500, // Or does it crash with TypeError on .trim()?
            checkError: (data, status) => status === 500 && data.message.includes('trim is not a function')
        },
        {
            name: "Test 3.1: Empty exemplo_jp (empty string)",
            body: { acao: 'enriquecer_card', item: '犬', exemplo_jp: '' },
            expectedStatus: 200,
            checkResult: (data) => data.item === '犬' && data.exemplo_jp === null
        },
        {
            name: "Test 3.2: Null exemplo_jp",
            body: { acao: 'enriquecer_card', item: '犬', exemplo_jp: null },
            expectedStatus: 200,
            checkResult: (data) => data.item === '犬' && data.exemplo_jp === null
        },
        {
            name: "Test 4.1: Null exemplo_pt with valid exemplo_jp",
            body: { acao: 'enriquecer_card', item: '本', exemplo_jp: '本を読んだ', exemplo_pt: null },
            expectedStatus: 200,
            checkResult: (data) => data.item === '本' && data.exemplo_jp === '本を読んだ' && typeof data.exemplo_pt === 'string' && data.exemplo_pt.length > 0
        },
        {
            name: "Test 4.2: Whitespace exemplo_pt ('   ') with valid exemplo_jp",
            body: { acao: 'enriquecer_card', item: '水', exemplo_jp: '水を飲む', exemplo_pt: '   ' },
            expectedStatus: 200,
            checkResult: (data) => {
                console.log("   --> Test 4.2 data.exemplo_pt:", JSON.stringify(data.exemplo_pt));
                // If data.exemplo_pt is '   ', line 1492 bug is confirmed!
                return data.exemplo_pt !== '   ' && typeof data.exemplo_pt === 'string' && data.exemplo_pt.trim().length > 0;
            }
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const t of tests) {
        console.log(`\nRunning: ${t.name}`);
        const { req, res } = createMockReqRes(t.body);
        try {
            await handler(req, res);
            const { statusCode, responseData } = res._getResponse();
            console.log(`  Status: ${statusCode}, Response:`, JSON.stringify(responseData));
            
            let ok = statusCode === t.expectedStatus;
            if (ok && t.checkResult) {
                ok = t.checkResult(responseData);
            }
            if (t.checkError) {
                ok = t.checkError(responseData, statusCode);
            }

            if (ok) {
                console.log(`  RESULT: PASS`);
                passed++;
            } else {
                console.log(`  RESULT: FAIL (Unexpected behavior/assertion mismatch)`);
                failed++;
            }
        } catch (err) {
            console.log(`  ERROR THROWN:`, err.message);
            if (t.expectedStatus === 500) {
                console.log(`  RESULT: PASS (500 expected/caught)`);
                passed++;
            } else {
                console.log(`  RESULT: FAIL (Unhandled exception)`);
                failed++;
            }
        }
    }

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
}

runTests().catch(err => console.error("Test runner exception:", err));
