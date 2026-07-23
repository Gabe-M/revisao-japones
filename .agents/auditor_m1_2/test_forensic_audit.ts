import { cleanJapaneseText, findSentenceExample } from '../../src/dialogo/utils/sentenceMining';
import * as indexExports from '../../src/dialogo/utils/index';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${description}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${description}`);
  }
}

console.log("================================================================");
console.log("   FORENSIC INTEGRITY AUDIT - SENTENCE MINING UTILITY (M1_2)    ");
console.log("================================================================");

// --- 1. Re-export Verification ---
console.log("\n--- 1. Re-export Verification ---");
assert(typeof indexExports.cleanJapaneseText === 'function', "cleanJapaneseText re-exported from index.ts");
assert(typeof indexExports.findSentenceExample === 'function', "findSentenceExample re-exported from index.ts");

// --- 2. cleanJapaneseText Non-String Guards ---
console.log("\n--- 2. cleanJapaneseText Non-String Guards ---");
assert(cleanJapaneseText(null) === '', "cleanJapaneseText(null) returns empty string");
assert(cleanJapaneseText(undefined) === '', "cleanJapaneseText(undefined) returns empty string");
assert(cleanJapaneseText(123 as any) === '', "cleanJapaneseText(number) returns empty string");
assert(cleanJapaneseText(false as any) === '', "cleanJapaneseText(boolean) returns empty string");
assert(cleanJapaneseText({} as any) === '', "cleanJapaneseText(object) returns empty string");
assert(cleanJapaneseText([] as any) === '', "cleanJapaneseText(array) returns empty string");
assert(cleanJapaneseText('') === '', "cleanJapaneseText('') returns empty string");

// --- 3. Attribute-Aware Regex & HTML Tag Stripping ---
console.log("\n--- 3. Attribute-Aware Regex & HTML Tag Stripping ---");
assert(
  cleanJapaneseText('<ruby>漢字<rt>かんじ</rt></ruby>') === '漢字',
  "Strips standard <rt> tags"
);
assert(
  cleanJapaneseText('<ruby>猫<rp>(</rp><rt>ねこ</rt><rp>)</rp></ruby>') === '猫',
  "Strips standard <rt> and <rp> tags"
);
assert(
  cleanJapaneseText('<ruby>猫<rp class="rp-open">(</rp><rt class="furigana-text" data-lang="ja">ねこ</rt><rp class="rp-close">)</rp></ruby>') === '猫',
  "Strips attribute-bearing <rt class=\"...\"> and <rp class=\"...\"> tags"
);
assert(
  cleanJapaneseText('<RUBY>犬<RP CLASS="RP">(</RP><RT CLASS="FURI" STYLE="COLOR:RED">いぬ</RT><RP CLASS="RP">)</RP></RUBY>') === '犬',
  "Case-insensitive attribute-bearing tag stripping (<RT CLASS=\"...\">)"
);
assert(
  cleanJapaneseText('<ruby>学<rt>\n  まな\n</rt>ぶ</ruby>') === '学ぶ',
  "Strips multiline <rt> blocks with internal whitespace/newlines"
);
assert(
  cleanJapaneseText('<div><p><span><b>日本語</b></span>の勉強</p></div>') === '日本語の勉強',
  "Strips nested general HTML markup"
);

// --- 4. Entity Decoding & Trimming ---
console.log("\n--- 4. Entity Decoding & Trimming ---");
assert(
  cleanJapaneseText('  &lt;本&gt; &amp; &quot;ペン&mn;&#39;  ') === '<本> & "ペン&mn;\'',
  "Decodes &lt;, &gt;, &amp;, &quot;, &#39; and trims leading/trailing whitespace"
);

// --- 5. findSentenceExample Non-String & Non-Array Guards ---
console.log("\n--- 5. findSentenceExample Non-String & Non-Array Guards ---");
assert(
  JSON.stringify(findSentenceExample(null as any, '猫')) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(null historico) returns null values"
);
assert(
  JSON.stringify(findSentenceExample(undefined as any, '猫')) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(undefined historico) returns null values"
);
assert(
  JSON.stringify(findSentenceExample("invalid" as any, '猫')) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(string historico) returns null values"
);
assert(
  JSON.stringify(findSentenceExample([], null as any)) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(null palavra) returns null values"
);
assert(
  JSON.stringify(findSentenceExample([], undefined as any)) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(undefined palavra) returns null values"
);
assert(
  JSON.stringify(findSentenceExample([], '')) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(empty string palavra) returns null values"
);
assert(
  JSON.stringify(findSentenceExample([], '   ')) === JSON.stringify({ exemplo_jp: null, exemplo_pt: null }),
  "findSentenceExample(whitespace palavra) returns null values"
);

// --- 6. Backward Iteration & Authentic Logic Matching ---
console.log("\n--- 6. Backward Iteration & Authentic Logic Matching ---");

const mockHistory = [
  { jp: '<ruby>猫<rt>ねこ</rt></ruby>が好きです。', pt: 'Eu gosto de gatos.' }, // Index 0: older match for 猫
  { jp: '犬も可愛いです。', pt: 'Cães também são fofos.' }, // Index 1
  { content: '<ruby>猫<rt>ねこ</rt></ruby>が走っています。', pt: 'O gato está correndo.' }, // Index 2: newer match for 猫 using 'content'
  { jp: '鳥が飛んでいる。', pt: '' } // Index 3: empty pt
];

const matchCat = findSentenceExample(mockHistory, '猫');
assert(
  matchCat.exemplo_jp === '猫が走っています。' && matchCat.exemplo_pt === 'O gato está correndo.',
  "Backward search finds latest matching item (Index 2) and fallback property 'content'"
);

const matchDog = findSentenceExample(mockHistory, '犬');
assert(
  matchDog.exemplo_jp === '犬も可愛いです。' && matchDog.exemplo_pt === 'Cães também são fofos.',
  "Matches item with 'jp' property"
);

const matchFuriganaOnly = findSentenceExample(mockHistory, 'ねこ');
assert(
  matchFuriganaOnly.exemplo_jp === null && matchFuriganaOnly.exemplo_pt === null,
  "Furigana reading inside stripped <rt> does NOT match when searching for reading 'ねこ'"
);

const mockHistoryDefensive = [
  null,
  undefined,
  { jp: 12345, pt: 'Invalid' },
  { jp: '<b>本</b>を読む。', pt: '  ' }, // whitespace pt
  { jp: '<b>本</b>を買う。', pt: 'Comprar livro.' }
];

const matchBook = findSentenceExample(mockHistoryDefensive, '本');
assert(
  matchBook.exemplo_jp === '本を買う。' && matchBook.exemplo_pt === 'Comprar livro.',
  "Defensive handling of null/undefined/non-string items in history and whitespace pt"
);

const matchWhitespacePt = findSentenceExample(mockHistoryDefensive.slice(0, 4), '本');
assert(
  matchWhitespacePt.exemplo_jp === '本を読む。' && matchWhitespacePt.exemplo_pt === null,
  "Returns null exemplo_pt when pt is whitespace only"
);

console.log("\n================================================================");
console.log(`SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log("================================================================");

if (failedTests > 0) {
  process.exit(1);
}
