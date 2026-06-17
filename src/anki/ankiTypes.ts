// Resposta genérica da API AnkiConnect
export interface AnkiResponse<T> {
  result: T | null;
  error: string | null;
}

// Campo de nota retornado por cardsInfo / notesInfo
export interface AnkiField {
  value: string;
  order: number;
}

// Nota completa retornada pelo AnkiConnect
export interface AnkiNoteInfo {
  noteId: number;
  tags: string[];
  fields: Record<string, AnkiField>;
  modelName: string;
}

// Card retornado por cardsInfo (inclui dados da nota + estado do card)
export interface AnkiCardInfo {
  cardId: number;
  noteId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, AnkiField>;
  tags: string[];
  queue: number;   // -1=suspended, 0=new, 1=learning, 2=review, 3=dayLearn
  type: number;    // 0=new, 1=learning, 2=review, 3=relearning
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
}

// Card normalizado após processamento
export interface AnkiCardNormalized {
  noteId: number;
  cardId: number;
  deckName: string;
  status: 'new' | 'learning' | 'review';
  vocabulary: string;
  reading: string;
  meaning: string;
  sentence: string;
  audio: string;
  image: string;
  tags: string[];
}

// Status da conexão
export interface AnkiConnectionStatus {
  connected: boolean;
  version?: number;
  error?: string;
}
