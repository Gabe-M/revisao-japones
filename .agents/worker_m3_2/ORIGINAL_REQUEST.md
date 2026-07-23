## 2026-07-22T11:01:15Z

<USER_REQUEST>
You are Worker 2 (Replacement Worker) for Milestone 3 (R3 - AnkiConnect Integration `src/dialogo/services/ankiService.ts`).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m3_2

Tasks:
1. Initialize directory `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m3_2` with BRIEFING.md and progress.md.
2. Create file `c:\Users\Fabiano\Downloads\sites\japones\src\dialogo\services\ankiService.ts` using write_to_file tool (set Overwrite: true).
   Code contents:
   ```typescript
   export interface EnrichedCard {
     item: string;
     leitura: string;
     significado: string;
     categoria: string;
     jlpt: string;
     exemplo_jp?: string | null;
     exemplo_pt?: string | null;
   }

   interface AnkiConnectResponse<T = any> {
     result: T;
     error: string | null;
   }

   async function invokeAnkiConnect<T = any>(action: string, version = 6, params: Record<string, any> = {}): Promise<T> {
     let response: Response;
     try {
       response = await fetch('http://127.0.0.1:8765', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({ action, version, params }),
       });
     } catch (err: any) {
       throw new Error('Anki não está aberto ou AnkiConnect falhou');
     }

     if (!response.ok) {
       throw new Error('Anki não está aberto ou AnkiConnect falhou');
     }

     const data: AnkiConnectResponse<T> = await response.json();
     if (data.error) {
       throw new Error(`AnkiConnect Error: ${data.error}`);
     }

     return data.result;
   }

   export async function adicionarAoAnki(card: EnrichedCard): Promise<number> {
     const DECK_NAME = 'DialoGo::Vocabulario';
     const MODEL_NAME = 'DialoGo Japones';

     // 1. Criar / Garantir existência do Baralho (createDeck)
     await invokeAnkiConnect('createDeck', 6, { deck: DECK_NAME });

     // 2. Verificar se o Modelo de Nota existe (modelNames)
     const modelNames = await invokeAnkiConnect<string[]>('modelNames', 6);
     if (!Array.isArray(modelNames) || !modelNames.includes(MODEL_NAME)) {
       await invokeAnkiConnect('createModel', 6, {
         modelName: MODEL_NAME,
         inOrderFields: [
           'Item',
           'Leitura',
           'Significado',
           'Categoria',
           'JLPT',
           'Exemplo_JP',
           'Exemplo_PT',
         ],
         cardTemplates: [
           {
             Name: 'Card 1',
             Front: '<div style="font-size: 24px; text-align: center;">{{Item}}<br><span style="font-size: 16px; color: #666;">{{Leitura}}</span></div>',
             Back: '{{FrontSide}}<hr id="answer"><div style="font-size: 18px;">{{Significado}}</div><br><div style="font-size: 14px; color: #888;">{{Categoria}} | {{JLPT}}</div><br><div><b>Exemplo:</b> {{Exemplo_JP}}</div><div>{{Exemplo_PT}}</div>',
           },
         ],
       });
     }

     // 3. Adicionar Nota (addNote)
     const noteId = await invokeAnkiConnect<number>('addNote', 6, {
       note: {
         deckName: DECK_NAME,
         modelName: MODEL_NAME,
         fields: {
           Item: card.item || '',
           Leitura: card.leitura || '',
           Significado: card.significado || '',
           Categoria: card.categoria || '',
           JLPT: card.jlpt || '',
           Exemplo_JP: card.exemplo_jp || '',
           Exemplo_PT: card.exemplo_pt || '',
         },
         options: {
           allowDuplicate: false,
         },
         tags: ['DialoGo'],
       },
     });

     return noteId;
   }
   ```
3. Run `npx tsc --noEmit` using run_command to verify TypeScript compilation.
4. Write your handoff report to `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m3_2\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
</USER_REQUEST>
