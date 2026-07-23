export interface EnrichedCard {
  item: string;
  leitura: string;
  significado: string;
  categoria: string;
  jlpt: string;
  exemplo_jp?: string | null;
  exemplo_pt?: string | null;
}

export async function invokeAnkiConnect(
  action: string,
  version: number = 6,
  params: any = {}
): Promise<any> {
  let response: Response;
  try {
    response = await fetch('http://127.0.0.1:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, version, params }),
    });
  } catch (netErr) {
    throw new Error('Anki não está aberto ou AnkiConnect falhou');
  }

  if (!response.ok) {
    throw new Error('Anki não está aberto ou AnkiConnect falhou');
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}

export async function adicionarAoAnki(card: EnrichedCard): Promise<number> {
  try {
    // a. Execute createDeck with name "DialoGo::Vocabulario"
    await invokeAnkiConnect('createDeck', 6, { deck: 'DialoGo::Vocabulario' });

    // b. Execute modelNames and create model if "DialoGo Japones" doesn't exist
    const modelNames: string[] = await invokeAnkiConnect('modelNames', 6);
    if (!Array.isArray(modelNames) || !modelNames.includes('DialoGo Japones')) {
      await invokeAnkiConnect('createModel', 6, {
        modelName: 'DialoGo Japones',
        inOrderFields: [
          'Item',
          'Leitura',
          'Significado',
          'Categoria',
          'JLPT',
          'Exemplo_JP',
          'Exemplo_PT',
        ],
        css: `.card {
 font-family: arial;
 font-size: 20px;
 text-align: center;
 color: black;
 background-color: white;
}`,
        cardTemplates: [
          {
            Name: 'Card 1',
            Front: '{{Item}}<br><br>{{Leitura}}',
            Back: '{{FrontSide}}<hr id=answer>{{Significado}}<br><br><small>{{Categoria}} | {{JLPT}}</small><br><br>{{Exemplo_JP}}<br>{{Exemplo_PT}}',
          },
        ],
      });
    }

    // c. Execute addNote mapping card fields to note fields
    const noteId: number = await invokeAnkiConnect('addNote', 6, {
      note: {
        deckName: 'DialoGo::Vocabulario',
        modelName: 'DialoGo Japones',
        fields: {
          Item: card.item ?? '',
          Leitura: card.leitura ?? '',
          Significado: card.significado ?? '',
          Categoria: card.categoria ?? '',
          JLPT: card.jlpt ?? '',
          Exemplo_JP: card.exemplo_jp ?? '',
          Exemplo_PT: card.exemplo_pt ?? '',
        },
        options: {
          allowDuplicate: false,
          duplicateScope: 'deck',
        },
      },
    });

    return noteId;
  } catch (error: any) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error('Anki não está aberto ou AnkiConnect falhou');
  }
}
