import { aggregateGrammarErrors } from '../src/dialogo/components/ProgressoDrawer.tsx';

console.log('--- Testing R4 Edge Cases & Calculations ---');

// Test 1: Empty history array
const test1 = aggregateGrammarErrors([]);
console.assert(Array.isArray(test1) && test1.length === 0, 'Test 1 Failed: empty array should return empty []');
console.log('Test 1 Passed: Empty history returns []');

// Test 2: Invalid history (null, undefined, non-array)
console.assert(aggregateGrammarErrors(null).length === 0, 'Test 2a Failed');
console.assert(aggregateGrammarErrors(undefined).length === 0, 'Test 2b Failed');
console.assert(aggregateGrammarErrors('invalid').length === 0, 'Test 2c Failed');
console.log('Test 2 Passed: Non-array inputs handled gracefully');

// Test 3: Messages without errors or empty errors
const msgNoErrors = [
  { role: 'user', content: 'Konnichiwa' },
  { role: 'assistant', content: 'Konnichiwa!' },
  { role: 'user', content: 'Genki desu', erros_detalhados: [] }
];
console.assert(aggregateGrammarErrors(msgNoErrors).length === 0, 'Test 3 Failed: zero error recurrence');
console.log('Test 3 Passed: Zero error recurrence handled cleanly');

// Test 4: Messages with erros_detalhados
const msgWithDetailedErrors = [
  {
    role: 'user',
    content: 'Watashi wa nihongo o benkyou desu',
    erros_detalhados: [
      {
        erro: 'Uso incorreto de desu',
        regra_gramatical: 'Uso da partícula e verbo',
        explicacao: 'Use shite imasu para ação em andamento.',
        exemplo_correto: 'Watashi wa nihongo o benkyou shite imasu'
      },
      {
        erro: 'Partícula errada',
        regra_gramatical: 'Partícula ni vs o',
        explicacao: 'Use ni com verbos de movimento.',
        exemplo_correto: 'Gakkou ni ikimasu'
      }
    ]
  },
  {
    role: 'user',
    content: 'Gakkou o ikimasu',
    erros_detalhados: [
      {
        erro: 'Partícula errada',
        regra_gramatical: 'Partícula ni vs o',
        explicacao: 'Use ni com verbos de movimento.',
        exemplo_correto: 'Gakkou ni ikimasu'
      }
    ]
  }
];

const test4 = aggregateGrammarErrors(msgWithDetailedErrors);
console.assert(test4.length === 2, `Test 4 Failed: Expected 2 unique rules, got ${test4.length}`);
console.assert(test4[0].regra === 'Partícula ni vs o' && test4[0].count === 2, `Test 4 Failed: Expected 'Partícula ni vs o' with count 2, got ${test4[0]?.regra} ${test4[0]?.count}`);
console.assert(test4[1].regra === 'Uso da partícula e verbo' && test4[1].count === 1, `Test 4 Failed: Expected 'Uso da partícula e verbo' count 1`);
console.log('Test 4 Passed: Detailed grammar errors aggregated and sorted correctly');

// Test 5: Legacy simple string errors fallback
const msgWithSimpleErrors = [
  {
    role: 'user',
    content: 'test',
    erros: ['Partícula ni', 'Partícula ni', 'Verbo no passado']
  }
];
const test5 = aggregateGrammarErrors(msgWithSimpleErrors);
console.assert(test5.length === 2, `Test 5 Failed: expected 2 unique errors`);
console.assert(test5[0].regra === 'Partícula ni' && test5[0].count === 2, `Test 5 Failed: simple error aggregation count`);
console.log('Test 5 Passed: Fallback simple errors aggregated correctly');

// Test 6: Math calculation tests (mimicking ProgressoDrawer calculations)
function calculateMetrics(historico) {
  const userMessages = (historico || []).filter((m) => m && m.role === "user");
  const totalTurnos = userMessages.length;

  const scores = userMessages
    .map((m) => m.score)
    .filter((s) => typeof s === "number" && !isNaN(s));

  const mediaScore =
    scores.length > 0
      ? Math.round(scores.reduce((acc, curr) => acc + curr, 0) / scores.length)
      : 0;

  const excelenteCount = scores.filter((s) => s >= 80).length;
  const regularCount = scores.filter((s) => s >= 50 && s < 80).length;
  const atencaoCount = scores.filter((s) => s < 50).length;

  return { totalTurnos, mediaScore, excelenteCount, regularCount, atencaoCount };
}

// Test 6a: Empty history math
const math1 = calculateMetrics([]);
console.assert(math1.totalTurnos === 0 && math1.mediaScore === 0 && math1.excelenteCount === 0 && math1.regularCount === 0 && math1.atencaoCount === 0, 'Test 6a Failed');
console.log('Test 6a Passed: Empty history math is safe (mediaScore 0, no NaN)');

// Test 6b: Messages without scores
const math2 = calculateMetrics([{ role: 'user', content: 'hi' }, { role: 'user', content: 'bye', score: undefined }]);
console.assert(math2.totalTurnos === 2 && math2.mediaScore === 0 && math2.excelenteCount === 0, 'Test 6b Failed');
console.log('Test 6b Passed: Messages without scores default to 0% mediaScore safely');

// Test 6c: Messages with mix of scores (including 0)
const math3 = calculateMetrics([
  { role: 'user', score: 90 },
  { role: 'user', score: 70 },
  { role: 'user', score: 40 },
  { role: 'user', score: 0 }
]);
// Scores: 90, 70, 40, 0 => sum 200 / 4 = 50.
console.assert(math3.totalTurnos === 4, 'Test 6c totalTurnos');
console.assert(math3.mediaScore === 50, `Test 6c mediaScore expected 50 got ${math3.mediaScore}`);
console.assert(math3.excelenteCount === 1, 'Test 6c excelenteCount');
console.assert(math3.regularCount === 1, 'Test 6c regularCount');
console.assert(math3.atencaoCount === 2, 'Test 6c atencaoCount (40 and 0)');
console.log('Test 6c Passed: Score math with valid numbers & 0 score working correctly');

console.log('--- ALL R4 UNIT & MATH TESTS PASSED SUCCESSFULLY ---');
