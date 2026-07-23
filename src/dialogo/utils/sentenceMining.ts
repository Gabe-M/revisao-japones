export interface SentenceMiningResult {
  exemplo_jp: string | null;
  exemplo_pt: string | null;
}

/**
 * Cleans Japanese text by stripping <rt> and <rp> blocks (including furigana content),
 * stripping remaining HTML tags, decoding standard HTML entities, and trimming whitespace.
 */
export function cleanJapaneseText(rawText: any): string {
  if (typeof rawText !== 'string' || !rawText) return '';

  return rawText
    .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '')
    .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Finds a sentence example containing the specified word from the conversation history,
 * searching backwards from the most recent message.
 */
export function findSentenceExample(historico: any[], palavra: string): SentenceMiningResult {
  if (!Array.isArray(historico) || typeof palavra !== 'string' || !palavra.trim()) {
    return { exemplo_jp: null, exemplo_pt: null };
  }

  const target = palavra.trim();

  for (let i = historico.length - 1; i >= 0; i--) {
    const item = historico[i];
    const rawJp = typeof item?.jp === 'string' ? item.jp : typeof item?.content === 'string' ? item.content : '';
    const cleanJp = cleanJapaneseText(rawJp);

    if (cleanJp.includes(target)) {
      return {
        exemplo_jp: cleanJp || null,
        exemplo_pt: typeof item?.pt === 'string' && item.pt.trim() ? item.pt.trim() : null,
      };
    }
  }

  return { exemplo_jp: null, exemplo_pt: null };
}

export const buscarExemploETradução = findSentenceExample;

