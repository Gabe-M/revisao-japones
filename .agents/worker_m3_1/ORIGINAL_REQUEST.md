## 2026-07-22T11:00:59Z
You are Worker 1 for Milestone 3 (R3 - AnkiConnect Integration `src/dialogo/services/ankiService.ts`).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m3_1

Tasks:
1. Initialize your working directory `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m3_1` with BRIEFING.md and progress.md.
2. Create `src/dialogo/services/ankiService.ts` with clean, strongly typed TypeScript:
   - Define export interface `EnrichedCard`:
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
     ```
   - Implement helper `invokeAnkiConnect(action: string, version?: number, params?: any)` to POST to `http://127.0.0.1:8765`.
   - Implement `adicionarAoAnki(card: EnrichedCard): Promise<number>`:
     a. Execute `createDeck` with name `"DialoGo::Vocabulario"`.
     b. Execute `modelNames`. If `"DialoGo Japones"` does NOT exist in the list, execute `createModel` with `modelName: "DialoGo Japones"`, `inOrderFields: ["Item", "Leitura", "Significado", "Categoria", "JLPT", "Exemplo_JP", "Exemplo_PT"]`, and standard card template.
     c. Execute `addNote` mapping `card` fields to note fields: `Item`, `Leitura`, `Significado`, `Categoria`, `JLPT`, `Exemplo_JP`, `Exemplo_PT` in deck `"DialoGo::Vocabulario"`.
     d. Error Handling: Catch network errors/fetch failures (`ERR_CONNECTION_REFUSED`, `Failed to fetch`). Throw an Error with message `"Anki não está aberto ou AnkiConnect falhou"` so UI components can display this exact toast message on failure.
3. Verify compilation by running `npx tsc --noEmit` using run_command tool.
4. Write your handoff report to `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m3_1\handoff.md`.
