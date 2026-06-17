/**
 * Remove tags HTML e códigos de áudio do AnkiConnect
 * Ex: "<b>いい</b>" → "いい"
 *     "[sound:audio.mp3]" → ""
 */
export function cleanAnkiString(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[sound:[^\]]+\]/g, '')      // Remove [sound:arquivo.mp3]
    .replace(/<img[^>]*>/gi, '')           // Remove tags <img>
    .replace(/<[^>]+>/g, '')              // Remove todas as tags HTML restantes
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Extrai o nome do arquivo de áudio de um campo Anki
 * Ex: "[sound:あ.mp3]" → "あ.mp3"
 */
export function extractAudioFile(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/\[sound:([^\]]+)\]/);
  return match ? match[1] : '';
}

/**
 * Extrai o src de uma tag <img> de um campo Anki
 * Ex: '<img src="image.jpg">' → "image.jpg"
 */
export function extractImageSrc(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : '';
}

/**
 * Mapeia o queue/type do AnkiConnect para status legível
 * queue: 0=new, 1=learning, 2=review, 3=dayLearn
 */
export function mapCardStatus(queue: number): 'new' | 'learning' | 'review' {
  if (queue === 0) return 'new';
  if (queue === 2) return 'review';
  return 'learning'; // 1, 3, e qualquer outro = em aprendizado
}
