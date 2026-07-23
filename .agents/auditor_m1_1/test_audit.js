import { cleanJapaneseText, findSentenceExample } from '../../src/dialogo/utils/sentenceMining.ts';
import { cleanJapaneseText as cleanFromIndex, findSentenceExample as findFromIndex } from '../../src/dialogo/utils/index.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

function assertEquals(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}\n  Expected: ${expectedStr}\n  Actual:   ${actualStr}`);
    failed++;
  }
}

console.log("=== 1. Testing cleanJapaneseText ===");
assertEquals(cleanJapaneseText("こんにちは"), "こんにちは", "Plain text remains unchanged");
assertEquals(cleanJapaneseText("<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>"), "漢字", "Strips rt and rp tags and furigana content");
assertEquals(
  cleanJapaneseText("<div><p><span><ruby>私<rt>わたし</rt></ruby>は<b>学生</b>です。</span></p></div>"),
  "私は学生です。",
  "Strips nested HTML tags and rt contents"
);
assertEquals(cleanJapaneseText("&lt;tag&gt; &amp; &quot;quote&quot; &#39;single&#39;"), "<tag> & \"quote\" 'single'", "Decodes standard HTML entities");
assertEquals(cleanJapaneseText("   <p>  テスト  </p>   "), "テスト", "Trims leading and trailing whitespace");
assertEquals(cleanJapaneseText(""), "", "Empty string returns empty string");
assertEquals(cleanJapaneseText(null), "", "Null input returns empty string");

console.log("\n=== 2. Testing findSentenceExample ===");
const testHistorico = [
  { jp: "<ruby>猫<rt>ねこ</rt></ruby>が好きです", pt: "Gosto de gatos." }, // index 0 (oldest)
  { jp: "<ruby>猫<rt>ねこ</rt></ruby>を飼っています", pt: "Tenho um gato." }, // index 1
  { content: "犬が好きです", pt: "Gosto de cães." }, // index 2 (content field fallback)
  { jp: "<ruby>猫<rt>ねこ</rt></ruby>が走る", pt: "" }, // index 3 (empty pt)
  { jp: "<ruby>魚<rt>さかな</rt></ruby>を食べる" } // index 4 (no pt)
];

// Backward iteration check: searching for "猫" should find index 3 ("猫が走る") which is the last matching item!
const matchNeko = findSentenceExample(testHistorico, "猫");
assertEquals(matchNeko, { exemplo_jp: "猫が走る", exemplo_pt: null }, "Backward iteration returns latest item with matching keyword");

// Test search for "飼っています": matches index 1
const matchKatte = findSentenceExample(testHistorico, "飼っています");
assertEquals(matchKatte, { exemplo_jp: "猫を飼っています", exemplo_pt: "Tenho um gato." }, "Matches word present in cleaned text and includes Portuguese translation");

// Test content field fallback: searching for "犬"
const matchInu = findSentenceExample(testHistorico, "犬");
assertEquals(matchInu, { exemplo_jp: "犬が好きです", exemplo_pt: "Gosto de cães." }, "Matches item using 'content' property fallback");

// Test search for non-existent word
const matchTori = findSentenceExample(testHistorico, "鳥");
assertEquals(matchTori, { exemplo_jp: null, exemplo_pt: null }, "Returns null values when word is not found");

// Test invalid inputs
assertEquals(findSentenceExample(null, "猫"), { exemplo_jp: null, exemplo_pt: null }, "Handles null historico");
assertEquals(findSentenceExample(testHistorico, ""), { exemplo_jp: null, exemplo_pt: null }, "Handles empty keyword");
assertEquals(findSentenceExample(testHistorico, "   "), { exemplo_jp: null, exemplo_pt: null }, "Handles whitespace keyword");

console.log("\n=== 3. Testing Re-exports from index.ts ===");
assertEquals(cleanFromIndex("<rt>test</rt>abc"), "abc", "cleanJapaneseText exported via index.ts");
assertEquals(findFromIndex(testHistorico, "犬"), { exemplo_jp: "犬が好きです", exemplo_pt: "Gosto de cães." }, "findSentenceExample exported via index.ts");

console.log(`\n=== Audit Execution Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
