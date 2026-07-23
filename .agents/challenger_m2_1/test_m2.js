import handler from '../../api/dialogo.js';

// Mock response helper
function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) {
            this.headers[name] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        end() {
            return this;
        }
    };
}

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        testsPassed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log("=========================================");
    console.log("Starting Milestone 2 Verification Tests");
    console.log("=========================================\n");

    const originalFetch = global.fetch;

    try {
        // ----------------------------------------------------
        // Group 1: Input Validation Tests (missing/invalid item)
        // ----------------------------------------------------
        console.log("--- Group 1: Input Validation Tests ---");

        // Test 1.1: Missing item/palavra/termo
        {
            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);
            assert(res.statusCode === 400, "Missing item returns 400 status");
            assert(res.body?.error === 'Palavra ou item não informado para enriquecimento.', "Missing item error message is correct");
        }

        // Test 1.2: Empty string item
        {
            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', item: '', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);
            assert(res.statusCode === 400, "Empty string item returns 400 status");
        }

        // Test 1.3: Whitespace string item
        {
            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', item: '   ', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);
            assert(res.statusCode === 400, "Whitespace item returns 400 status");
        }

        // Test 1.4: Non-string item (number)
        {
            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', item: 12345, provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);
            assert(res.statusCode === 400, "Number item returns 400 status");
        }

        // Test 1.5: Alternative field 'palavra'
        {
            let aiCalled = false;
            global.fetch = async (url) => {
                if (url.includes('jisho.org')) {
                    return {
                        ok: true,
                        json: async () => ({ data: [] })
                    };
                }
                if (url.includes('api.openai.com')) {
                    aiCalled = true;
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{ message: { content: JSON.stringify({ significado: 'Gato', categoria: 'Substantivo', leitura: 'ねこ', jlpt: 'N5' }) } }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', palavra: '猫', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);
            assert(res.statusCode === 200, "Accepts 'palavra' field as item");
            assert(aiCalled === true, "Proceeds to call AI when 'palavra' is supplied");
        }

        // Test 1.6: Alternative field 'termo'
        {
            let aiCalled = false;
            global.fetch = async (url) => {
                if (url.includes('jisho.org')) {
                    return {
                        ok: true,
                        json: async () => ({ data: [] })
                    };
                }
                if (url.includes('api.openai.com')) {
                    aiCalled = true;
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{ message: { content: JSON.stringify({ significado: 'Cão', categoria: 'Substantivo', leitura: 'いぬ', jlpt: 'N5' }) } }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', termo: '犬', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);
            assert(res.statusCode === 200, "Accepts 'termo' field as item");
            assert(aiCalled === true, "Proceeds to call AI when 'termo' is supplied");
        }


        // ----------------------------------------------------
        // Group 2: Jisho Parsing & AI Prompt Construction Tests
        // ----------------------------------------------------
        console.log("\n--- Group 2: Jisho Parsing & AI Prompt Construction ---");

        // Test 2.1: Complete Jisho data extraction & prompt verification
        {
            let capturedPrompt = '';
            let capturedSystemInst = '';

            global.fetch = async (url, options) => {
                if (url.includes('jisho.org')) {
                    return {
                        ok: true,
                        json: async () => ({
                            data: [{
                                japanese: [{ word: '食べる', reading: 'たべる' }],
                                senses: [{
                                    parts_of_speech: ['Ichidan verb'],
                                    english_definitions: ['to eat']
                                }],
                                jlpt: ['jlpt-n5']
                            }]
                        })
                    };
                }
                if (url.includes('api.openai.com')) {
                    const payload = JSON.parse(options.body);
                    capturedSystemInst = payload.messages[0].content;
                    capturedPrompt = payload.messages[1].content;

                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        leitura: 'たべる',
                                        significado: 'Comer',
                                        categoria: 'Verbo Ichidan',
                                        jlpt: 'N5'
                                    })
                                }
                            }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', item: '食べる', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);

            assert(res.statusCode === 200, "Status is 200 on valid request with Jisho match");
            assert(capturedPrompt.includes('Termo em japonês: "食べる"'), "Prompt includes target item");
            assert(capturedPrompt.includes('Leitura identificada: "たべる"'), "Prompt includes Jisho reading");
            assert(capturedPrompt.includes('Categoria identificada no Jisho: "Ichidan verb"'), "Prompt includes Jisho POS");
            assert(capturedPrompt.includes('Nível JLPT: "N5"'), "Prompt includes parsed JLPT level N5");
            assert(capturedPrompt.includes('["to eat"]'), "Prompt includes English definitions from Jisho");

            assert(res.body?.item === '食べる', "Card item is correct");
            assert(res.body?.leitura === 'たべる', "Card leitura is correct");
            assert(res.body?.significado === 'Comer', "Card significado is correct");
            assert(res.body?.categoria === 'Verbo Ichidan', "Card categoria is correct");
            assert(res.body?.jlpt === 'N5', "Card JLPT is correct");
        }

        // Test 2.2: Example translation requested when exemplo_jp provided without exemplo_pt
        {
            let capturedPrompt = '';

            global.fetch = async (url, options) => {
                if (url.includes('jisho.org')) {
                    return { ok: true, json: async () => ({ data: [] }) };
                }
                if (url.includes('api.openai.com')) {
                    const payload = JSON.parse(options.body);
                    capturedPrompt = payload.messages[1].content;
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        leitura: 'たべる',
                                        significado: 'Comer',
                                        categoria: 'Verbo',
                                        jlpt: 'N5',
                                        exemplo_pt: 'Eu como maçã.'
                                    })
                                }
                            }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: {
                    acao: 'enriquecer_card',
                    item: '食べる',
                    exemplo_jp: 'りんごを食べる。',
                    provider: 'openai'
                }
            };
            const res = createMockRes();
            await handler(req, res);

            assert(capturedPrompt.includes('5. "exemplo_pt": Traduza a frase de exemplo em japonês "りんごを食べる。" para o português de forma natural.'), "Prompt contains instruction to translate exemplo_jp when exemplo_pt is missing");
            assert(res.body?.exemplo_jp === 'りんごを食べる。', "Response preserves exemplo_jp");
            assert(res.body?.exemplo_pt === 'Eu como maçã.', "Response includes AI-translated exemplo_pt");
        }

        // Test 2.3: Example translation NOT requested when exemplo_pt is already supplied
        {
            let capturedPrompt = '';

            global.fetch = async (url, options) => {
                if (url.includes('jisho.org')) {
                    return { ok: true, json: async () => ({ data: [] }) };
                }
                if (url.includes('api.openai.com')) {
                    const payload = JSON.parse(options.body);
                    capturedPrompt = payload.messages[1].content;
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        leitura: 'たべる',
                                        significado: 'Comer',
                                        categoria: 'Verbo',
                                        jlpt: 'N5'
                                    })
                                }
                            }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: {
                    acao: 'enriquecer_card',
                    item: '食べる',
                    exemplo_jp: 'りんごを食べる。',
                    exemplo_pt: 'Comer uma maçã.',
                    provider: 'openai'
                }
            };
            const res = createMockRes();
            await handler(req, res);

            assert(!capturedPrompt.includes('5. "exemplo_pt"'), "Prompt omits exemplo_pt translation instruction when exemplo_pt already provided");
            assert(res.body?.exemplo_pt === 'Comer uma maçã.', "Response retains user-provided exemplo_pt");
        }


        // ----------------------------------------------------
        // Group 3: Fault Tolerance & Resiliency Tests
        // ----------------------------------------------------
        console.log("\n--- Group 3: Fault Tolerance & Resiliency ---");

        // Test 3.1: Jisho API throws Network Error (e.g. offline/timeout)
        {
            let aiCalled = false;

            global.fetch = async (url) => {
                if (url.includes('jisho.org')) {
                    throw new Error("Network request failed");
                }
                if (url.includes('api.openai.com')) {
                    aiCalled = true;
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        leitura: 'ねこ',
                                        significado: 'Gato',
                                        categoria: 'Substantivo',
                                        jlpt: 'N5'
                                    })
                                }
                            }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', item: '猫', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);

            assert(res.statusCode === 200, "Handler survives Jisho fetch exception gracefully");
            assert(aiCalled === true, "Proceeds to call AI model even if Jisho fails");
            assert(res.body?.significado === 'Gato', "Card enrichment completes using AI fallback");
        }

        // Test 3.2: Jisho returns 404/500 HTTP error status
        {
            let aiCalled = false;

            global.fetch = async (url) => {
                if (url.includes('jisho.org')) {
                    return { ok: false, status: 500 };
                }
                if (url.includes('api.openai.com')) {
                    aiCalled = true;
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        leitura: 'いぬ',
                                        significado: 'Cão',
                                        categoria: 'Substantivo',
                                        jlpt: 'N5'
                                    })
                                }
                            }]
                        })
                    };
                }
                return { ok: false };
            };

            const req = {
                method: 'POST',
                headers: { 'x-openai-key': 'sk-mock-key' },
                body: { acao: 'enriquecer_card', item: '犬', provider: 'openai' }
            };
            const res = createMockRes();
            await handler(req, res);

            assert(res.statusCode === 200, "Handler handles non-ok Jisho response status gracefully");
            assert(aiCalled === true, "AI call executed after Jisho non-ok response");
        }

    } finally {
        global.fetch = originalFetch;
    }

    console.log("\n=========================================");
    console.log(`Test Execution Summary:`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log("=========================================\n");

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});
