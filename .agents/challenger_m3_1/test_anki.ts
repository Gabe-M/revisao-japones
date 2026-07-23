import { invokeAnkiConnect, adicionarAoAnki, EnrichedCard } from '../../src/dialogo/services/ankiService.ts';

// Test suite for ankiService.ts
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

function assertRejects(fn: () => Promise<any>, expectedErrorSubstring: string, testName: string): Promise<void> {
  return fn()
    .then(() => {
      console.error(`❌ FAIL: ${testName} - Expected rejection but resolved`);
      failedTests++;
    })
    .catch((err) => {
      if (err && err.message && err.message.includes(expectedErrorSubstring)) {
        console.log(`✅ PASS: ${testName} (caught expected: "${err.message}")`);
        passedTests++;
      } else {
        console.error(`❌ FAIL: ${testName} - Unexpected error: "${err?.message}" (expected substring "${expectedErrorSubstring}")`);
        failedTests++;
      }
    });
}

// Mocking helper for fetch
let fetchCalls: { url: string; options: any }[] = [];
let mockFetchHandler: (url: string, options: any) => Promise<Response> = async () => {
  throw new Error('Default mock fetch');
};

// Global fetch override
(globalThis as any).fetch = async (url: string, options: any) => {
  fetchCalls.push({ url, options });
  return mockFetchHandler(url, options);
};

function resetFetchMock() {
  fetchCalls = [];
}

async function runTests() {
  console.log('--- STARTING ANKI SERVICE ADVERSARIAL TEST SUITE ---\n');

  // TEST 1: invokeAnkiConnect - successful request payload and response parsing
  {
    resetFetchMock();
    mockFetchHandler = async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === 'version') {
        return new Response(JSON.stringify({ result: 6, error: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: null, error: 'Unknown action' }), { status: 200 });
    };

    const version = await invokeAnkiConnect('version');
    assert(version === 6, 'invokeAnkiConnect returns data.result on success');
    assert(fetchCalls.length === 1, 'fetch called once');
    assert(fetchCalls[0].url === 'http://127.0.0.1:8765', 'fetch targets default AnkiConnect URL');
    assert(fetchCalls[0].options.method === 'POST', 'fetch uses POST method');
    assert(fetchCalls[0].options.headers['Content-Type'] === 'application/json', 'Content-Type is application/json');
    const sentBody = JSON.parse(fetchCalls[0].options.body);
    assert(sentBody.action === 'version' && sentBody.version === 6, 'default action and version=6 sent in payload');
  }

  // TEST 2: invokeAnkiConnect - network failure (Anki closed)
  {
    resetFetchMock();
    mockFetchHandler = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assertRejects(
      () => invokeAnkiConnect('deckNames'),
      'Anki não está aberto ou AnkiConnect falhou',
      'invokeAnkiConnect handles network connection error'
    );
  }

  // TEST 3: invokeAnkiConnect - HTTP error response (e.g., 500 Internal Server Error)
  {
    resetFetchMock();
    mockFetchHandler = async () => {
      return new Response('Internal Error', { status: 500 });
    };

    await assertRejects(
      () => invokeAnkiConnect('deckNames'),
      'Anki não está aberto ou AnkiConnect falhou',
      'invokeAnkiConnect handles non-ok HTTP status code'
    );
  }

  // TEST 4: invokeAnkiConnect - AnkiConnect API returned error message
  {
    resetFetchMock();
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ result: null, error: 'model "DialoGo Japones" not found' }), { status: 200 });
    };

    await assertRejects(
      () => invokeAnkiConnect('modelFieldNames'),
      'model "DialoGo Japones" not found',
      'invokeAnkiConnect throws error returned by AnkiConnect data.error'
    );
  }

  // TEST 5: adicionarAoAnki - full workflow when model does NOT exist (creates deck, creates model, adds note)
  {
    resetFetchMock();
    const createdActions: string[] = [];

    mockFetchHandler = async (url, options) => {
      const body = JSON.parse(options.body);
      createdActions.push(body.action);

      if (body.action === 'createDeck') {
        assert(body.params.deck === 'DialoGo::Vocabulario', 'createDeck requested for DialoGo::Vocabulario');
        return new Response(JSON.stringify({ result: null, error: null }), { status: 200 });
      }

      if (body.action === 'modelNames') {
        // Return list without DialoGo Japones
        return new Response(JSON.stringify({ result: ['Basic', 'Cloze'], error: null }), { status: 200 });
      }

      if (body.action === 'createModel') {
        assert(body.params.modelName === 'DialoGo Japones', 'createModel specifies DialoGo Japones');
        assert(Array.isArray(body.params.inOrderFields), 'inOrderFields is an array');
        assert(body.params.inOrderFields.length === 7, 'inOrderFields has 7 fields');
        assert(body.params.inOrderFields[0] === 'Item', 'First field is Item');
        assert(body.params.inOrderFields[1] === 'Leitura', 'Second field is Leitura');
        assert(body.params.inOrderFields[2] === 'Significado', 'Third field is Significado');
        assert(body.params.inOrderFields[3] === 'Categoria', 'Fourth field is Categoria');
        assert(body.params.inOrderFields[4] === 'JLPT', 'Fifth field is JLPT');
        assert(body.params.inOrderFields[5] === 'Exemplo_JP', 'Sixth field is Exemplo_JP');
        assert(body.params.inOrderFields[6] === 'Exemplo_PT', 'Seventh field is Exemplo_PT');

        assert(Array.isArray(body.params.cardTemplates), 'cardTemplates is an array');
        assert(body.params.cardTemplates[0].Front.includes('{{Item}}'), 'Template includes {{Item}} front field');
        assert(body.params.cardTemplates[0].Back.includes('{{Significado}}'), 'Template includes {{Significado}} back field');

        return new Response(JSON.stringify({ result: { sortf: 0 }, error: null }), { status: 200 });
      }

      if (body.action === 'addNote') {
        assert(body.params.note.deckName === 'DialoGo::Vocabulario', 'addNote specifies deckName DialoGo::Vocabulario');
        assert(body.params.note.modelName === 'DialoGo Japones', 'addNote specifies modelName DialoGo Japones');
        assert(body.params.note.options.allowDuplicate === false, 'allowDuplicate is false');
        assert(body.params.note.options.duplicateScope === 'deck', 'duplicateScope is deck');

        // Check fields mapping
        const f = body.params.note.fields;
        assert(f.Item === '食べる', 'fields.Item matches card.item');
        assert(f.Leitura === 'たべる', 'fields.Leitura matches card.leitura');
        assert(f.Significado === 'Comer', 'fields.Significado matches card.significado');
        assert(f.Categoria === 'Verbo', 'fields.Categoria matches card.categoria');
        assert(f.JLPT === 'N5', 'fields.JLPT matches card.jlpt');
        assert(f.Exemplo_JP === 'りんごを食べる。', 'fields.Exemplo_JP matches card.exemplo_jp');
        assert(f.Exemplo_PT === 'Comer uma maçã.', 'fields.Exemplo_PT matches card.exemplo_pt');

        return new Response(JSON.stringify({ result: 1712345678901, error: null }), { status: 200 });
      }

      return new Response(JSON.stringify({ result: null, error: 'Unexpected action' }), { status: 200 });
    };

    const testCard: EnrichedCard = {
      item: '食べる',
      leitura: 'たべる',
      significado: 'Comer',
      categoria: 'Verbo',
      jlpt: 'N5',
      exemplo_jp: 'りんごを食べる。',
      exemplo_pt: 'Comer uma maçã.',
    };

    const noteId = await adicionarAoAnki(testCard);
    assert(noteId === 1712345678901, 'adicionarAoAnki returns created note ID');
    assert(createdActions.join(',') === 'createDeck,modelNames,createModel,addNote', 'Executed expected sequence: createDeck, modelNames, createModel, addNote');
  }

  // TEST 6: adicionarAoAnki - model ALREADY EXISTS (should skip createModel)
  {
    resetFetchMock();
    const createdActions: string[] = [];

    mockFetchHandler = async (url, options) => {
      const body = JSON.parse(options.body);
      createdActions.push(body.action);

      if (body.action === 'createDeck') {
        return new Response(JSON.stringify({ result: null, error: null }), { status: 200 });
      }

      if (body.action === 'modelNames') {
        // Model DialoGo Japones exists
        return new Response(JSON.stringify({ result: ['Basic', 'DialoGo Japones'], error: null }), { status: 200 });
      }

      if (body.action === 'addNote') {
        return new Response(JSON.stringify({ result: 999999, error: null }), { status: 200 });
      }

      return new Response(JSON.stringify({ result: null, error: 'Unexpected action' }), { status: 200 });
    };

    const testCard: EnrichedCard = {
      item: '水',
      leitura: 'みず',
      significado: 'Água',
      categoria: 'Substantivo',
      jlpt: 'N5',
      exemplo_jp: null,
      exemplo_pt: null,
    };

    const noteId = await adicionarAoAnki(testCard);
    assert(noteId === 999999, 'adicionarAoAnki returns note ID when model exists');
    assert(createdActions.join(',') === 'createDeck,modelNames,addNote', 'Skipped createModel when model already exists');
  }

  // TEST 7: Nullish values handling for optional fields (exemplo_jp, exemplo_pt)
  {
    resetFetchMock();

    mockFetchHandler = async (url, options) => {
      const body = JSON.parse(options.body);

      if (body.action === 'createDeck') return new Response(JSON.stringify({ result: null, error: null }), { status: 200 });
      if (body.action === 'modelNames') return new Response(JSON.stringify({ result: ['DialoGo Japones'], error: null }), { status: 200 });
      if (body.action === 'addNote') {
        const f = body.params.note.fields;
        assert(f.Exemplo_JP === '', 'exemplo_jp=null resolves to empty string');
        assert(f.Exemplo_PT === '', 'exemplo_pt=undefined resolves to empty string');
        return new Response(JSON.stringify({ result: 12345, error: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: null, error: 'Unexpected' }), { status: 200 });
    };

    const testCard: EnrichedCard = {
      item: '本',
      leitura: 'ほん',
      significado: 'Livro',
      categoria: 'Substantivo',
      jlpt: 'N5',
      exemplo_jp: null,
      exemplo_pt: undefined,
    };

    await adicionarAoAnki(testCard);
  }

  // TEST 8: Error propagation when Anki returns duplicate note error
  {
    resetFetchMock();

    mockFetchHandler = async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === 'createDeck') return new Response(JSON.stringify({ result: null, error: null }), { status: 200 });
      if (body.action === 'modelNames') return new Response(JSON.stringify({ result: ['DialoGo Japones'], error: null }), { status: 200 });
      if (body.action === 'addNote') {
        return new Response(JSON.stringify({ result: null, error: 'cannot create note because it is a duplicate' }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: null, error: 'Unexpected' }), { status: 200 });
    };

    const testCard: EnrichedCard = {
      item: '猫',
      leitura: 'ねこ',
      significado: 'Gato',
      categoria: 'Substantivo',
      jlpt: 'N5',
    };

    await assertRejects(
      () => adicionarAoAnki(testCard),
      'cannot create note because it is a duplicate',
      'adicionarAoAnki rethrows duplicate note error from AnkiConnect'
    );
  }

  // TEST 9: Error propagation when Anki fails during createDeck
  {
    resetFetchMock();

    mockFetchHandler = async () => {
      throw new TypeError('Failed to fetch');
    };

    const testCard: EnrichedCard = {
      item: '犬',
      leitura: 'いぬ',
      significado: 'Cão',
      categoria: 'Substantivo',
      jlpt: 'N5',
    };

    await assertRejects(
      () => adicionarAoAnki(testCard),
      'Anki não está aberto ou AnkiConnect falhou',
      'adicionarAoAnki rethrows network error when Anki is closed'
    );
  }

  console.log(`\n--- TEST RESULTS ---`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.error('❌ SUITE FAILED');
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED');
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
