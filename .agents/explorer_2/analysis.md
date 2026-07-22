# Detailed Technical Analysis: AjudaModal Frontend Requirements (R1, R2, R3)

## 1. Overview & Scope

This document provides a comprehensive technical analysis of `src/dialogo/components/AjudaModal.tsx`, `src/dialogo/DialoGoPanel.tsx`, and `src/dialogo/DialoGoApp.tsx` for implementing requirements R1, R2, and R3 in the DialoGo module.

### Core Objectives:
1. **R1 (Structured Grammar Explanations)**: Replace string error rendering in `AjudaModal.tsx` with Shadcn `Accordion` mapping the `erros_detalhados` structure (`erro`, `regra_gramatical`, `explicacao`, `exemplo_correto`).
2. **R2 (Contextual Response Suggestions)**: Change the "Sugestão" button flow to execute `sugerir_multiplas_respostas` and display 3 distinct Shadcn `Card` components (Concordar, Discordar, Perguntar) with "✏️ Praticar" and "✅ Usar direto" interactive controls.
3. **R3 (Vocabulary & SRS Dual Persistence)**: Add a "💾 Salvar" button to each item in the "Vocabulário Extraído" tab that performs dual HTTP POST calls (`/api/jisho?acao=salvar` and `/api/srs?acao=salvar`) using `session.access_token` authentication header, with loading spinner/text and permanent "✅ Salvo" disabled state on success.

---

## 2. Component Hierarchy & Auth/Session Flow

### Current Data & Auth Flow
1. **`DialoGoApp.tsx`**: Obtains Supabase auth session (`session`) via `supabase.auth.getSession()` and `onAuthStateChange()` listener. Passes `session` to child tab panels (`ConfiguracaoPanel`, `GuiaPanel`, `TraducaoPanel`, `DialoGoPanel`).
2. **`DialoGoPanel.tsx`**: Receives `session` prop (line 20).
   - At lines 88-90 and 162-164, `DialoGoPanel` attaches `Authorization: Bearer ${session.access_token}` to `/api/dialogo` fetch requests.
   - At line 395, `DialoGoPanel` renders `<AjudaModal>` but currently **does NOT pass `session` prop** to `AjudaModal`.
3. **`AjudaModal.tsx`**:
   - `AjudaModalProps` (lines 12-18) currently defines: `isOpen`, `onClose`, `mensagem`, `context`, `onUsarResposta`.
   - `callEndpoint` (lines 119-139) currently sends requests to `/api/dialogo` without setting the `Authorization` header.

### Required Auth & Prop Modifications:
- **`DialoGoPanel.tsx`**: Update line 395 to pass `session={session}`:
  ```tsx
  <AjudaModal
      isOpen={ajudaModal.isOpen}
      onClose={() => setAjudaModal({isOpen: false, mensagem: ''})}
      mensagem={ajudaModal.mensagem}
      context={context}
      session={session}
      onUsarResposta={(texto) => { setInputUser(texto); setAjudaModal({isOpen: false, mensagem: ''}); }}
  />
  ```
- **`AjudaModal.tsx`**: Update `AjudaModalProps` interface (line 12):
  ```tsx
  interface AjudaModalProps {
      isOpen: boolean;
      onClose: () => void;
      mensagem: string;
      context: any;
      session?: any;
      onUsarResposta: (texto: string) => void;
  }
  ```
- Update `callEndpoint` in `AjudaModal.tsx` (line 129):
  ```tsx
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  const response = await fetch('/api/dialogo', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
  });
  ```

---

## 3. Requirement R1: Structured Grammar Explanations

### Current Code Analysis
- In `AjudaModal.tsx` (lines 380-386):
  ```tsx
  {analisePratica.erros?.length > 0 && (
      <div className="mb-3.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Erros encontrados</div>
          <ul className="text-rose-500 pl-5 my-1 text-sm space-y-1">
              {analisePratica.erros.map((err: string, i: number) => <li key={i}>{err}</li>)}
          </ul>
      </div>
  )}
  ```

### New Contract & Backend Payload Structure
The backend `analisar_pratica` action will return `analisePratica` containing:
```json
{
  "correto": false,
  "score": 65,
  "dica": "Explicação geral...",
  "traducao_correta": "Frase corrigida",
  "erros_detalhados": [
    {
      "erro": "Partícula に incorreta em ...",
      "regra_gramatical": "Uso da partícula で para local de ação",
      "explicacao": "A partícula に indica destino/direção, enquanto で indica o local onde a ação ocorre.",
      "exemplo_correto": "図書館で勉強します"
    }
  ]
}
```

### UI Component Requirements for R1
1. **Shadcn Accordion Component**:
   - Check if `@/components/ui/accordion` exists. (Currently absent in `src/components/ui/`).
   - The implementer must create `src/components/ui/accordion.tsx` using Radix UI primitives (`@radix-ui/react-accordion`) or standard Tailwind components styled to match Shadcn specifications.
2. **`AjudaModal.tsx` Rendering Logic**:
   - Import `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion`.
   - Render `analisePratica.erros_detalhados` using `Accordion`.
   - Support backward compatibility: if `erros_detalhados` is undefined but `erros` (string array) exists, fallback to rendering the string array.
   - Accordion Layout:
     - `AccordionTrigger`: Display `item.erro` styled with text-rose-400 / text-sm font-semibold.
     - `AccordionContent`:
       - **Regra Gramatical**: `<span className="font-semibold text-amber-400">Regra:</span> {item.regra_gramatical}`
       - **Explicação**: `<p className="text-muted-foreground text-sm">{item.explicacao}</p>`
       - **Exemplo Correto**: `<div className="bg-muted/50 p-2 rounded text-sm font-bold"><InteractiveText text={item.exemplo_correto} /></div>`

---

## 4. Requirement R2: Refactored Response Suggestions (3 Cards)

### Current Code Analysis
- In `AjudaModal.tsx`:
  - Line 43: `const [sugestao, setSugestao] = useState<{ jp: string; pt: string; dica: string } | null>(null);`
  - Lines 221-233: `handleSugestao` invokes `callEndpoint('sugerir_resposta')`.
  - Lines 419-462: `modoAtivo === 'sugestao'` renders a single suggestion box.

### New Contract & Backend Payload Structure
The backend `sugerir_multiplas_respostas` action returns:
```json
{
  "sugestoes": [
    {
      "intencao": "Concordar",
      "emoji": "✅",
      "jp": "<ruby>はい<rt>はい</rt></ruby>、<ruby>行<rt>い</rt></ruby>きましょう。",
      "pt": "Sim, vamos.",
      "dica": "Resposta afirmativa direta e natural."
    },
    {
      "intencao": "Discordar",
      "emoji": "🙅",
      "jp": "すみません、<ruby>今日<rt>きょう</rt></ruby>はちょっと...",
      "pt": "Desculpe, hoje é um pouco inconveniente...",
      "dica": "Forma educada e indireta de recusar em japonês."
    },
    {
      "intencao": "Perguntar",
      "emoji": "🤔",
      "jp": "<ruby>何時<rt>なんじ</rt></ruby>に<ruby>行<rt>い</rt></ruby>きますか？",
      "pt": "A que horas vamos?",
      "dica": "Mantém a conversa ativa fazendo uma pergunta de retorno."
    }
  ]
}
```

### UI Component Requirements for R2
1. **State Update**:
   - Change `sugestao` state to `sugestoes`:
     `const [sugestoes, setSugestoes] = useState<any[]>([]);`
2. **`handleSugestao` Function Update**:
   - Change endpoint action from `'sugerir_resposta'` to `'sugerir_multiplas_respostas'`.
   - Set `sugestoes(data.sugestoes || [])`.
3. **Card Grid UI**:
   - Import `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card`.
   - Render a vertical or grid list of 3 Shadcn `Card` components for Concordar, Discordar, Perguntar.
   - Visual Styling per Card:
     - Distinct badge or border tint (e.g. Concordar: green-500/20, Discordar: rose-500/20, Perguntar: amber-500/20).
     - Title: `{s.emoji} {s.intencao || s.tipo}`
     - Japanese Text: `<InteractiveText text={s.jp || s.texto_jp} />` (text-xl font-bold)
     - Translation: `{s.pt || s.traducao_pt}` (text-sm text-muted-foreground)
     - Tip/Dica: `{s.dica}` in a small alert box inside the card.
   - Action Buttons inside each Card:
     - **"✏️ Praticar"**: `onClick={() => usarSugestaoNoCampo(s.jp || s.texto_jp)}`
       - Fills `praticaInput` with un-tagged Japanese text and focuses the input.
     - **"✅ Usar direto"**: `onClick={() => onUsarResposta(stripTags(s.jp || s.texto_jp))}`
       - Immediately sends the message to the chat panel and closes the modal.

---

## 5. Requirement R3: Vocabulary & SRS Dual Persistence

### Current Code Analysis
- In `AjudaModal.tsx`:
  - Lines 587-612: Renders `vocabTab === 'extraido'` list:
    ```tsx
    {vocabulario.map((v, idx) => (
        <div key={idx} className="bg-card p-3.5 rounded-xl border border-border shadow-sm flex flex-col gap-1 relative overflow-hidden transition-all hover:border-border/80">
            <div className="text-base font-bold text-foreground">
                <InteractiveText text={`<ruby>${v.item}<rt>${v.leitura}</rt></ruby>`} />
            </div>
            <div className="text-xs text-muted-foreground font-medium">{v.significado}</div>
            {v.tipo && (
                <div className="absolute top-2.5 right-2.5 text-[0.65rem] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                    {v.tipo}
                </div>
            )}
        </div>
    ))}
    ```
  - Currently no "Salvar" button exists in the extracted vocabulary tab.

### Dual API Persistence Protocol for R3
When the user clicks "💾 Salvar" on an extracted vocabulary item `v`:

1. **API Call 1 — Jisho Vocab Table**:
   - `POST /api/jisho?acao=salvar`
   - Headers: `{ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token }`
   - Body:
     ```json
     {
       "item": "v.item",
       "leitura": "v.leitura",
       "significado": "v.significado",
       "categoria": "v.tipo || 'Vocabulário'",
       "jlpt": "context.jlpt || 'N5'"
     }
     ```
2. **API Call 2 — SRS Progress Table**:
   - `POST /api/srs?acao=salvar`
   - Headers: `{ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token }`
   - Body:
     ```json
     {
       "item": "v.item",
       "leitura": "v.leitura",
       "significado": "v.significado",
       "repetitions": 0,
       "interval": 0,
       "ease_factor": 2.5,
       "due": new Date().toISOString()
     }
     ```

### State & Interaction Requirements for R3
1. **State Tracking**:
   - Track saving status per word: `const [salvandoMap, setSalvandoMap] = useState<Record<string, boolean>>({});`
   - Track saved status per word: `const [salvosMap, setSalvosMap] = useState<Record<string, boolean>>({});`
2. **Execution Logic (`handleSalvarVocabulario`)**:
   ```tsx
   const handleSalvarVocabulario = async (itemVocab: any) => {
       const key = itemVocab.item;
       if (!session?.access_token) {
           alert("Sessão não autenticada.");
           return;
       }
       setSalvandoMap(prev => ({ ...prev, [key]: true }));
       try {
           const headers = {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${session.access_token}`
           };

           // Call 1: Jisho
           const resJisho = await fetch('/api/jisho?acao=salvar', {
               method: 'POST',
               headers,
               body: JSON.stringify({
                   item: itemVocab.item,
                   leitura: itemVocab.leitura || '',
                   significado: itemVocab.significado || '',
                   categoria: itemVocab.tipo || 'Vocabulário',
                   jlpt: context.jlpt || 'N5'
               })
           });
           if (!resJisho.ok) {
               const err = await resJisho.json().catch(() => ({}));
               throw new Error(err.error || `Erro Jisho (${resJisho.status})`);
           }

           // Call 2: SRS
           const resSrs = await fetch('/api/srs?acao=salvar', {
               method: 'POST',
               headers,
               body: JSON.stringify({
                   item: itemVocab.item,
                   leitura: itemVocab.leitura || '',
                   significado: itemVocab.significado || '',
                   repetitions: 0,
                   due: new Date().toISOString()
               })
           });
           if (!resSrs.ok) {
               const err = await resSrs.json().catch(() => ({}));
               throw new Error(err.error || `Erro SRS (${resSrs.status})`);
           }

           setSalvosMap(prev => ({ ...prev, [key]: true }));
       } catch (e: any) {
           console.error("Erro ao salvar vocabulário:", e);
           alert(`Falha ao salvar "${itemVocab.item}": ${e.message || e}`);
       } finally {
           setSalvandoMap(prev => ({ ...prev, [key]: false }));
       }
   };
   ```
3. **UI Button Rendering**:
   - Add button inside extracted vocabulary card:
     ```tsx
     <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
         <Button
             variant="outline"
             size="sm"
             disabled={salvandoMap[v.item] || salvosMap[v.item]}
             onClick={() => handleSalvarVocabulario(v)}
             className={`h-7 px-2.5 text-xs font-semibold ${
                 salvosMap[v.item]
                     ? 'bg-green-500/10 text-green-500 border-green-500/30 cursor-default'
                     : 'hover:bg-primary/10 hover:text-primary'
             }`}
         >
             {salvandoMap[v.item] ? (
                 <span className="animate-pulse">Salvando...</span>
             ) : salvosMap[v.item] ? (
                 '✅ Salvo'
             ) : (
                 '💾 Salvar'
             )}
         </Button>
     </div>
     ```

---

## 6. Target Line References & File Modification Checklist

| File | Exact Location | Modification Description |
|------|---------------|--------------------------|
| `src/components/ui/accordion.tsx` | New File | Implement Shadcn UI Accordion components (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`) |
| `src/dialogo/DialoGoPanel.tsx` | Line 395 | Pass `session={session}` prop to `<AjudaModal ... session={session} />` |
| `src/dialogo/components/AjudaModal.tsx` | Lines 12-18 | Add `session?: any;` to `AjudaModalProps` |
| `AjudaModal.tsx` | Lines 119-139 | Update `callEndpoint` to send `Authorization: Bearer ${session.access_token}` header |
| `AjudaModal.tsx` | Lines 43, 221-233 | Update `sugestao` state to `sugestoes` array, and update `handleSugestao` to call `sugerir_multiplas_respostas` |
| `AjudaModal.tsx` | Lines 380-387 | Replace string error list with Shadcn `Accordion` mapping `analisePratica.erros_detalhados` |
| `AjudaModal.tsx` | Lines 418-462 | Replace single suggestion block with 3 Shadcn `Card`s (Concordar, Discordar, Perguntar) containing "✏️ Praticar" and "✅ Usar direto" buttons |
| `AjudaModal.tsx` | Lines 587-612 | Add `salvandoMap` & `salvosMap` states, `handleSalvarVocabulario` dual fetch function, and "💾 Salvar" / "✅ Salvo" button inside extracted vocabulary items |

---

## 7. Verification Steps for Implementer

1. Run `npx tsc --noEmit` or `npm run build` to verify there are no TypeScript interface or JSX type errors.
2. Open DialoGo chat and open AjudaModal on an AI message.
3. Test **R1**: Provide an incorrect answer in the "Sua Resposta" input and click "Analisar". Verify error items expand/collapse via Shadcn `Accordion` with detailed rules, explanations, and correct examples.
4. Test **R2**: Click "Sugestão". Verify 3 cards appear for Concordar, Discordar, Perguntar. Test clicking "✏️ Praticar" (fills input field) and "✅ Usar direto" (sends message directly to chat).
5. Test **R3**: In "Vocabulário Extraído" tab, click "💾 Salvar" on a word. Confirm dual network requests (`/api/jisho?acao=salvar` and `/api/srs?acao=salvar`) are sent with `Authorization: Bearer <token>` header, loading state displays, and button transitions to disabled "✅ Salvo".
