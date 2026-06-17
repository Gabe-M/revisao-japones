import axios from 'axios';
import type { AnkiResponse, AnkiCardInfo, AnkiConnectionStatus } from './ankiTypes';
import { cleanAnkiString, extractAudioFile, extractImageSrc, mapCardStatus } from './ankiUtils';
import type { AnkiCardNormalized } from './ankiTypes';

const ANKI_URL = 'http://localhost:8765';
const ANKI_VERSION = 6;

// Função base para disparar ações no AnkiConnect
async function ankiAction<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data } = await axios.post<AnkiResponse<T>>(ANKI_URL, {
    action,
    version: ANKI_VERSION,
    params,
  });
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
  if (data.result === null && !data.error) throw new Error('AnkiConnect: resultado nulo inesperado');
  return data.result as T;
}

// Verificar versão (confirma conexão)
export async function checkAnkiConnection(): Promise<AnkiConnectionStatus> {
  try {
    const version = await ankiAction<number>('version');
    return { connected: true, version };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Anki offline ou CORS não configurado';
    return { connected: false, error: msg };
  }
}

// Listar todos os baralhos disponíveis
export async function fetchDeckNames(): Promise<string[]> {
  return ankiAction<string[]>('deckNames');
}

// Buscar IDs de cartões aprendidos/revisão de um baralho
export async function findLearnedCards(deckName: string): Promise<number[]> {
  const query = `deck:"${deckName}" (is:review OR is:learn)`;
  return ankiAction<number[]>('findCards', { query });
}

// Buscar IDs de cartões novos de um baralho
export async function findNewCards(deckName: string): Promise<number[]> {
  const query = `deck:"${deckName}" is:new`;
  return ankiAction<number[]>('findCards', { query });
}

// Buscar detalhes dos cartões por IDs
export async function fetchCardsInfo(cardIds: number[]): Promise<AnkiCardInfo[]> {
  if (cardIds.length === 0) return [];
  // AnkiConnect limita a batches — processar em grupos de 100
  const BATCH_SIZE = 100;
  const results: AnkiCardInfo[] = [];
  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE);
    const batchResult = await ankiAction<AnkiCardInfo[]>('cardsInfo', { cards: batch });
    results.push(...batchResult);
  }
  return results;
}

// Função principal: buscar e normalizar todos os cartões de um baralho
export async function fetchAllCardsFromDeck(deckName: string): Promise<{
  learned: AnkiCardNormalized[];
  newCards: AnkiCardNormalized[];
}> {
  const [learnedIds, newIds] = await Promise.all([
    findLearnedCards(deckName),
    findNewCards(deckName),
  ]);

  const [learnedRaw, newRaw] = await Promise.all([
    fetchCardsInfo(learnedIds),
    fetchCardsInfo(newIds),
  ]);

  const normalize = (cards: AnkiCardInfo[]): AnkiCardNormalized[] =>
    cards.map((card) => {
      const fieldValues = Object.values(card.fields);
      // Mapeamento por índice (resiliente a variações de nome de campo)
      const rawVocab   = fieldValues[0]?.value ?? '';
      const rawReading = fieldValues[1]?.value ?? '';
      const rawMeaning = fieldValues[2]?.value ?? '';
      const rawSentence= fieldValues[3]?.value ?? '';
      const rawAudio   = fieldValues[4]?.value ?? '';
      const rawImage   = fieldValues[5]?.value ?? '';

      return {
        noteId:     card.noteId,
        cardId:     card.cardId,
        deckName:   card.deckName,
        status:     mapCardStatus(card.queue),
        vocabulary: cleanAnkiString(rawVocab),
        reading:    cleanAnkiString(rawReading),
        meaning:    cleanAnkiString(rawMeaning),
        sentence:   cleanAnkiString(rawSentence),
        audio:      extractAudioFile(rawAudio),
        image:      extractImageSrc(rawImage),
        tags:       card.tags,
      };
    });

  return {
    learned: normalize(learnedRaw),
    newCards: normalize(newRaw),
  };
}
