// scripts/test-kanakanji-resilience-runner.js
import assert from 'node:assert';

console.log("=== Running KanaKanjiInput Empirical Network Resilience Tests ===");

// 1. Simulating Component State Machine & fetchKanjiCandidates
class MockKanaKanjiInputState {
    constructor() {
        this.value = '';
        this.committedText = '';
        this.compositionBuffer = '';
        this.candidates = [];
        this.selectedIndex = 0;
        this.showCandidates = false;
        this.loadingCandidates = false;
        this.abortController = null;
        this.sentMessages = [];
        this.unhandledRejections = [];
    }

    onChange(newVal) {
        this.value = newVal;
    }

    onSendMessage(text) {
        this.sentMessages.push(text);
    }

    // Mirroring handleInputChange in KanaKanjiInput.tsx
    inputKana(converted) {
        if (converted.startsWith(this.committedText)) {
            this.compositionBuffer = converted.slice(this.committedText.length);
        } else {
            this.committedText = '';
            this.compositionBuffer = converted;
        }
        this.onChange(converted);
        if (this.showCandidates) {
            this.showCandidates = false;
            this.candidates = [];
        }
    }

    // Mirroring fetchKanjiCandidates in KanaKanjiInput.tsx
    async fetchKanjiCandidates(textToConvert, fetchFn) {
        if (!textToConvert.trim()) return;

        if (this.abortController) {
            this.abortController.abort();
        }

        const controller = new AbortController();
        this.abortController = controller;

        this.loadingCandidates = true;
        this.showCandidates = true;
        this.selectedIndex = 0;

        const timeoutId = setTimeout(() => {
            controller.abort('TIMEOUT');
        }, 3000);

        try {
            const res = await fetchFn(`/api/dialogo?acao=converter_kanji&texto=${encodeURIComponent(textToConvert)}`, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            let extracted = [];

            if (data && Array.isArray(data.candidatos)) {
                extracted = data.candidatos;
            } else if (data && Array.isArray(data.candidates)) {
                extracted = data.candidates;
            } else if (data && Array.isArray(data.data)) {
                extracted = data.data.map((item) => item.japanese?.[0]?.word || item.japanese?.[0]?.reading).filter(Boolean);
            }

            const uniqueList = Array.from(new Set(extracted.filter(Boolean)));
            if (!uniqueList.includes(textToConvert)) {
                uniqueList.push(textToConvert);
            }

            if (uniqueList.length > 0) {
                this.candidates = uniqueList;
                this.selectedIndex = 0;
                this.showCandidates = true;
            } else {
                this.showCandidates = false;
                this.candidates = [];
            }
        } catch (err) {
            clearTimeout(timeoutId);
            // Frontend resilience: silent fallback to raw Kana composition buffer
            this.showCandidates = false;
            this.candidates = [];
        } finally {
            this.loadingCandidates = false;
            this.abortController = null;
        }
    }

    // Mirroring handleKeyDown Enter key behavior
    pressEnter() {
        if (this.showCandidates) {
            const selected = this.candidates[this.selectedIndex] || this.compositionBuffer;
            this.commitCandidate(selected);
            return 'candidate_committed';
        }

        if (!this.showCandidates && this.value.trim()) {
            this.committedText = this.value;
            this.compositionBuffer = '';
            this.onSendMessage(this.value);
            return 'message_sent';
        }
    }

    commitCandidate(candidate) {
        const newTotal = this.committedText + candidate;
        this.committedText = newTotal;
        this.compositionBuffer = '';
        this.showCandidates = false;
        this.candidates = [];
        this.onChange(newTotal);
    }
}

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Listen for unhandled rejections globally during test run
    const globalRejections = [];
    process.on('unhandledRejection', (reason) => {
        globalRejections.push(reason);
    });

    // Test 1: API returns 500 Internal Server Error
    try {
        console.log("\n[Test 1] Testing HTTP 500 response resilience...");
        const state = new MockKanaKanjiInputState();
        state.inputKana('にほん');

        const mockFetch500 = async () => ({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' })
        });

        await state.fetchKanjiCandidates('にほん', mockFetch500);

        assert.strictEqual(state.showCandidates, false, "Popup should be closed on 500 error");
        assert.deepStrictEqual(state.candidates, [], "Candidates array should be empty on 500 error");
        assert.strictEqual(state.loadingCandidates, false, "Loading state should be reset");
        assert.strictEqual(state.value, 'にほん', "Raw Kana value must be preserved");

        // User hits Enter to submit
        const action = state.pressEnter();
        assert.strictEqual(action, 'message_sent', "Pressing Enter after silent fallback should send raw message");
        assert.strictEqual(state.sentMessages[0], 'にほん', "Sent message should contain raw Kana composition");

        console.log("  PASS: HTTP 500 handled gracefully, popup closed silently, raw Kana preserved and sent.");
        passed++;
    } catch (err) {
        console.error("  FAIL: Test 1 failed:", err);
        failed++;
    }

    // Test 2: API returns non-JSON response (HTML page or malformed response)
    try {
        console.log("\n[Test 2] Testing non-JSON response handling...");
        const state = new MockKanaKanjiInputState();
        state.inputKana('とうきょう');

        const mockFetchNonJson = async () => ({
            ok: true,
            status: 200,
            json: async () => { throw new SyntaxError("Unexpected token '<', \"<html>...\" is not valid JSON"); }
        });

        await state.fetchKanjiCandidates('とうきょう', mockFetchNonJson);

        assert.strictEqual(state.showCandidates, false, "Popup should be closed on JSON parse error");
        assert.deepStrictEqual(state.candidates, [], "Candidates should be cleared on non-JSON response");
        assert.strictEqual(state.loadingCandidates, false, "Loading state should be false");
        assert.strictEqual(state.value, 'とうきょう', "Raw Kana composition preserved");

        const action = state.pressEnter();
        assert.strictEqual(action, 'message_sent', "Raw Kana committed on Enter");
        assert.strictEqual(state.sentMessages[0], 'とうきょう', "Sent message contains raw Kana 'とうきょう'");

        console.log("  PASS: Non-JSON response handled cleanly without uncaught exception.");
        passed++;
    } catch (err) {
        console.error("  FAIL: Test 2 failed:", err);
        failed++;
    }

    // Test 3: API network timeout (> 3 seconds)
    try {
        console.log("\n[Test 3] Testing 3-second AbortController timeout resilience...");
        const state = new MockKanaKanjiInputState();
        state.inputKana('さくら');

        const mockFetchTimeout = async (url, options) => {
            return new Promise((resolve, reject) => {
                const signal = options.signal;
                if (signal) {
                    signal.addEventListener('abort', () => {
                        const err = new Error('The operation was aborted');
                        err.name = 'AbortError';
                        reject(err);
                    });
                }
                // Simulate slow server (> 3.5 seconds)
                setTimeout(() => {
                    resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ candidatos: ['桜', 'さくら'] })
                    });
                }, 3500);
            });
        };

        const startTime = Date.now();
        await state.fetchKanjiCandidates('さくら', mockFetchTimeout);
        const duration = Date.now() - startTime;

        console.log(`  Fetch duration before timeout abort: ${duration}ms`);
        assert(duration >= 2950 && duration <= 3500, `Timeout should abort at ~3000ms (got ${duration}ms)`);
        assert.strictEqual(state.showCandidates, false, "Popup should close automatically after 3s timeout");
        assert.deepStrictEqual(state.candidates, [], "Candidates cleared on timeout");
        assert.strictEqual(state.loadingCandidates, false, "Loading state reset");
        assert.strictEqual(state.value, 'さくら', "Raw Kana composition buffer intact");

        const action = state.pressEnter();
        assert.strictEqual(action, 'message_sent');
        assert.strictEqual(state.sentMessages[0], 'さくら');

        console.log("  PASS: 3s AbortController timeout aborted request and triggered silent fallback.");
        passed++;
    } catch (err) {
        console.error("  FAIL: Test 3 failed:", err);
        failed++;
    }

    // Test 4: Verify global unhandled rejections count
    console.log("\n[Test 4] Checking for unhandled promise rejections...");
    if (globalRejections.length === 0) {
        console.log("  PASS: 0 unhandled promise rejections detected.");
        passed++;
    } else {
        console.error(`  FAIL: Detected ${globalRejections.length} unhandled rejections!`, globalRejections);
        failed++;
    }

    console.log(`\n=== Summary: ${passed} Passed, ${failed} Failed ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
