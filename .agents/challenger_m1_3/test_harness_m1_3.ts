import { cleanJapaneseText, findSentenceExample } from '../../src/dialogo/utils/sentenceMining.ts';

let total = 0;
let passed = 0;
let failed = 0;

function assertTest(name: string, condition: boolean, got: any, expected: any) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}`);
    console.error(`       Got:      ${JSON.stringify(got)}`);
    console.error(`       Expected: ${JSON.stringify(expected)}`);
  }
}

console.log("================================================================");
console.log("      EMPIRICAL CHALLENGE HARNESS - MILESTONE 1 RE-EVALUATION   ");
console.log("================================================================");

// Case 1: <rt class="..."> tags stripping & attributes
const rtCase1 = cleanJapaneseText('<ruby>日<rp class="rp-open">(</rp><rt class="furi-class">に</rt><rp class="rp-close">)</rp>本</ruby>');
assertTest('1.1 <rt class="..."> tags stripping with attributes', rtCase1 === '日本', rtCase1, '日本');

const rtCase2 = cleanJapaneseText('<div\n class="container"\n style="color:red">\n<ruby>漢<rt\n class="furi">かん</rt>字</ruby></div>');
assertTest('1.2 Line breaks inside tags and attributes', rtCase2 === '漢字', rtCase2, '漢字');

// Case 2: Non-string jp/content inputs
let nonStringNoCrash = true;
let nonStringResult: any = null;
try {
  nonStringResult = findSentenceExample([{ jp: 12345, content: 999 }, { jp: null }, { content: {} }], '123');
} catch (e) {
  nonStringNoCrash = false;
}
assertTest('2.1 Non-string jp/content handling in findSentenceExample (no crash)', nonStringNoCrash && nonStringResult.exemplo_jp === null, nonStringResult, { exemplo_jp: null, exemplo_pt: null });

const directNonString = cleanJapaneseText(12345);
assertTest('2.2 Non-string input directly to cleanJapaneseText', directNonString === '', directNonString, '');

// Case 3: False positive prevention
// Case 3a: Word in stripped furigana <rt> but NOT in cleanJp
const fpFuriganaRes = findSentenceExample([{ jp: '<ruby>猫<rt>ねこ</rt></ruby>が好き' }], 'ねこ');
assertTest('3.1 False positive prevention - word in stripped <rt>', fpFuriganaRes.exemplo_jp === null, fpFuriganaRes.exemplo_jp, null);

// Case 3b: Word in HTML attribute but NOT in cleanJp
const fpAttrRes = findSentenceExample([{ jp: '<span class="highlight">日本語の勉強</span>' }], 'highlight');
assertTest('3.2 False positive prevention - word in HTML tag attribute', fpAttrRes.exemplo_jp === null, fpAttrRes.exemplo_jp, null);

// Case 4: HTML entity unescaping & double entity unescaping protection
const entityCase1 = cleanJapaneseText('&lt;script&gt;');
assertTest('4.1 Standard HTML entity unescaping (&lt; &gt;)', entityCase1 === '<script>', entityCase1, '<script>');

const entityCase2 = cleanJapaneseText('&amp;lt;script&amp;gt;');
assertTest('4.2 Double entity unescaping protection (&amp;lt; -> &lt;)', entityCase2 === '&lt;script&gt;', entityCase2, '&lt;script&gt;');

const entityCase3 = cleanJapaneseText('Tom &amp; Jerry');
assertTest('4.3 Standard &amp; entity unescaping', entityCase3 === 'Tom & Jerry', entityCase3, 'Tom & Jerry');

console.log("================================================================");
console.log(`SUMMARY: ${passed} PASSED / ${failed} FAILED / ${total} TOTAL`);
console.log("================================================================");

process.exit(failed > 0 ? 1 : 0);
