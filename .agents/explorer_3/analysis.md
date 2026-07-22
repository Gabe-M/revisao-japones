# Analysis Report: Requirement R4 (Session Progress & Statistics Sheet/Drawer)

## Executive Summary
This document presents the detailed UI, state management, data calculation, and Supabase integration analysis for Requirement R4 (**Session Progress Stats Drawer**). 

R4 introduces a "📊 Progresso" button in `DialoGoPanel.tsx` that opens a Shadcn UI `Sheet` or `Drawer` panel displaying real-time metrics of the active chat session, a history of past user sessions fetched from Supabase (`dialogo_sessoes`), and an aggregated breakdown of recurring grammar errors based on Requirement R1 (`regra_gramatical` / `erros_detalhados`).

---

## 1. Inspection of Existing Shadcn UI Components (`src/components/ui/`)

A full directory inspection of `src/components/ui/` revealed the following:

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| `button.tsx` | `src/components/ui/button.tsx` | ✅ Existing | Used across all panels |
| `card.tsx` | `src/components/ui/card.tsx` | ✅ Existing | Used for chat area and panels |
| `dialog.tsx` | `src/components/ui/dialog.tsx` | ✅ Existing | Used for `AjudaModal` & `ConfiguracaoPanel` |
| `input.tsx` | `src/components/ui/input.tsx` | ✅ Existing | Input fields |
| `scroll-area.tsx` | `src/components/ui/scroll-area.tsx` | ✅ Existing | Radix ScrollArea wrapper |
| `select.tsx` | `src/components/ui/select.tsx` | ✅ Existing | Select dropdowns |
| `tabs.tsx` | `src/components/ui/tabs.tsx` | ✅ Existing | Navigation tabs |
| `accordion.tsx` | `src/components/ui/accordion.tsx` | ❌ Missing | Required for R1 grammar breakdown |
| `sheet.tsx` | `src/components/ui/sheet.tsx` | ❌ Missing | Required for R4 side drawer |
| `drawer.tsx` | `src/components/ui/drawer.tsx` | ❌ Missing | Alternative bottom sheet/drawer |

### Installation / Component Creation Commands
To supply `sheet.tsx` (and `accordion.tsx` / `drawer.tsx` if needed):

1. **Standard Shadcn CLI**:
   ```bash
   npx shadcn@latest add sheet
   npx shadcn@latest add accordion
   ```
2. **Built-in Radix Fallback**:
   Because `@radix-ui/react-dialog` is **already installed** in `package.json` (`"@radix-ui/react-dialog": "^1.1.20"`), `sheet.tsx` can be created directly in `src/components/ui/sheet.tsx` wrapping `@radix-ui/react-dialog` primitives with Tailwind slide-in panel animations (right/side drawer).

---

## 2. Placement of the "📊 Progresso" Button in `DialoGoPanel.tsx`

### Current Header Code (Lines 244–255 of `DialoGoPanel.tsx`):
```tsx
{/* Cabeçalho */}
<div className="flex items-center justify-between mb-5">
    <Button
        variant="outline"
        onClick={onBack}
        className="text-sm"
    >
        ← Voltar à Tradução
    </Button>
    <h2 className="text-lg font-bold text-foreground m-0">Diálogo</h2>
    <div className="w-[130px]" /> {/* spacer for centering */}
</div>
```

### Proposed Modification:
Replace the placeholder `<div className="w-[130px]" />` with the "📊 Progresso" button:
```tsx
<Button
    variant="outline"
    onClick={() => setProgressoOpen(true)}
    className="text-sm flex items-center gap-1.5 font-semibold hover:bg-accent"
>
    📊 Progresso
</Button>
```

### Layout Rationale:
- The placeholder `div` with `w-[130px]` was originally hardcoded specifically to match the width of `← Voltar à Tradução` and balance the `justify-between` flex header.
- Replacing it with the `📊 Progresso` button preserves header symmetry, maintains exact centering of the `"Diálogo"` title, and provides intuitive, top-level access to progress metrics.

---

## 3. State Management & Non-Destructive Drawer Mounting

### Independence from Chat & `AjudaModal` State:
- `DialoGoPanel.tsx` maintains active chat state using `historico` (`any[]`), `inputUser` (`string`), `enviando` (`boolean`), and `ajudaModal` (`{ isOpen, mensagem }`).
- We introduce a dedicated state for the progress panel:
  ```tsx
  const [progressoOpen, setProgressoOpen] = useState(false);
  ```
- When `progressoOpen` is toggled to `true`, the `Sheet` component opens as a Radix Dialog Portal over the viewport.
- Opening or closing the `Sheet` does **not** trigger any re-initialization of `historico`, `inputUser`, or `ajudaModal`.
- No state in `AjudaModal` is reset or unmounted when opening `Sheet`, allowing users to open session stats at any time during dialogue practice without loss of conversation history or scroll position.

---

## 4. Session Statistics Calculation Logic

Session statistics will be calculated in real-time from the active `historico` array in `DialoGoPanel.tsx`.

### Data Extraction Rules:
1. **Total Interações / Turnos (`totalTurnos`)**:
   Count of user messages in `historico`:
   ```ts
   const userMessages = historico.filter(msg => msg.role === 'user');
   const totalTurnos = userMessages.length;
   ```

2. **Pontuação Média % (`mediaScore`)**:
   Average score across all scored user messages:
   ```ts
   const userScores = userMessages
       .map(m => m.score)
       .filter((s): s is number => typeof s === 'number' && !isNaN(s));
   
   const mediaScore = userScores.length > 0 
       ? Math.round(userScores.reduce((acc, curr) => acc + curr, 0) / userScores.length) 
       : 0;
   ```

3. **Qualidade das Respostas (Score Distribution)**:
   - **Excelente (>= 80%)**: `userScores.filter(s => s >= 80).length`
   - **Regular (50% - 79%)**: `userScores.filter(s => s >= 50 && s < 80).length`
   - **Atenção (< 50%)**: `userScores.filter(s => s < 50).length`

4. **Mensagens da IA / Turnos Totais**:
   ```ts
   const totalIaMessages = historico.filter(msg => msg.role === 'assistant').length;
   ```

---

## 5. Fetching Past Sessions from Supabase (`dialogo_sessoes`)

Past user sessions are stored in the `dialogo_sessoes` Supabase table and accessible via the existing backend API endpoint in `api/dialogo.js`.

### API Protocol:
- **Endpoint**: `POST /api/dialogo`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer ${session.access_token}`
- **Payload**: `{ acao: 'listar_sessoes' }`
- **Response Format**:
  ```json
  [
    {
      "id": "uuid-1234",
      "nome": "Minha conversa no restaurante",
      "config": {
        "tema": "No restaurante",
        "jlpt": "N5",
        "provider": "groq"
      },
      "created_at": "2026-07-21T20:00:00Z"
    }
  ]
  ```

### Integration in Progress Drawer:
When `ProgressoDrawer` opens (or when `session?.access_token` is available), it calls `/api/dialogo` with `acao: 'listar_sessoes'`.
The drawer presents a list of all user sessions with:
- Session Name & Theme badge
- Date of creation (formatted via `toLocaleDateString()`)
- "Sessão Atual" badge if `s.id === context.sessionId`.

---

## 6. Aggregation & Frequency Display of R1 Grammar Errors

Requirement R1 (M1 milestone) supplies structured grammar error analysis in responses (`erros_detalhados: Array<{ erro, regra_gramatical, explicacao, exemplo_correto }>`) or string array (`erros`).

### Aggregation Algorithm:
```ts
export interface ErrorFrequency {
    regra: string;
    count: number;
    explicacao?: string;
    exemploCorreto?: string;
}

export function aggregateGrammarErrors(historico: any[]): ErrorFrequency[] {
    const frequencyMap: Record<string, ErrorFrequency> = {};

    historico.forEach(msg => {
        if (msg.role !== 'user') return;

        // Structured R1 detailed errors
        if (Array.isArray(msg.erros_detalhados)) {
            msg.erros_detalhados.forEach((item: any) => {
                const key = item.regra_gramatical || item.erro || 'Erro Gramatical';
                if (!frequencyMap[key]) {
                    frequencyMap[key] = {
                        regra: key,
                        count: 0,
                        explicacao: item.explicacao,
                        exemploCorreto: item.exemplo_correto
                    };
                }
                frequencyMap[key].count += 1;
            });
        } 
        // Simple string array errors
        else if (Array.isArray(msg.erros)) {
            msg.erros.forEach((errStr: string) => {
                const key = errStr;
                if (!frequencyMap[key]) {
                    frequencyMap[key] = {
                        regra: key,
                        count: 0
                    };
                }
                frequencyMap[key].count += 1;
            });
        }
    });

    return Object.values(frequencyMap).sort((a, b) => b.count - a.count);
}
```

### UI Presentation:
In the Progress Sheet, render a **"🚨 Recorrência de Erros Gramaticais"** card:
- Displays each aggregated rule sorted by highest frequency.
- Includes a count badge (`3x`, `2x`, `1x`).
- Shows `explicacao` and `exemploCorreto` if available from R1 analysis.
- Displays an encouraging empty state ("Nenhum erro gramatical registrado nesta sessão! 🎉") if no errors are present.

---

## 7. Step-by-Step Implementation Plan for Implementer

### Step 1: Create `src/components/ui/sheet.tsx`
Implement standard Shadcn `Sheet` component using `@radix-ui/react-dialog` (which is already installed in `package.json`).
Exports: `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetClose`.

### Step 2: Create `src/dialogo/components/ProgressoDrawer.tsx`
Build the main progress drawer component containing:
- **Header**: "📊 Progresso da Sessão" & theme info.
- **Section 1: Real-Time Session Metrics**:
  - Turn Count (`totalTurnos`)
  - Average Score (`mediaScore`) with color-coded badge/bar.
  - Response Quality distribution (Excelente, Regular, Atenção).
- **Section 2: R1 Grammar Error Frequency**:
  - Aggregated list of `regra_gramatical` with count badges and tips.
- **Section 3: Past Sessions History**:
  - List of sessions fetched from Supabase `dialogo_sessoes`.

### Step 3: Integrate `ProgressoDrawer` in `DialoGoPanel.tsx`
- Add `const [progressoOpen, setProgressoOpen] = useState(false);`
- Replace header spacer `<div className="w-[130px]" />` with `Button` "📊 Progresso".
- Render `<ProgressoDrawer isOpen={progressoOpen} onClose={() => setProgressoOpen(false)} historico={historico} session={session} currentSessionId={context.sessionId} tema={context.tema} />`.

---

## 8. Summary & Verification Instructions

### How to Verify Implementation:
1. Check that `src/components/ui/sheet.tsx` exists and compiles without errors.
2. Open the Diálogo tab in the browser. Click "📊 Progresso" in the header.
3. Confirm the Sheet slides in from the side without clearing or unmounting the active chat.
4. Send messages in the chat and verify that turn count, score %, and error frequencies update accurately in real-time inside the Sheet.
5. Confirm past sessions load from Supabase when logged in.
