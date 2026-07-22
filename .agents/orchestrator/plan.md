# Execution Plan: DialoGo Feature Implementation

## Overview
Implement 4 key feature requirements (R1, R2, R3, R4) in the DialoGo application and ensure TypeScript compilation (`npm run build`) passes with full resilience and proper authentication.

## Execution Steps

### Phase 1: Investigation & Setup
- Step 1.1: Initialize orchestrator tracking files (`BRIEFING.md`, `PROJECT.md`, `plan.md`, `progress.md`, `context.md`).
- Step 1.2: Dispatch Explorer to inspect `api/dialogo.js`, `AjudaModal.tsx`, `DialoGoPanel.tsx`, `DialoGoApp.tsx`, and existing Shadcn UI components (check if `accordion`, `drawer`/`sheet`, `card` are installed).

### Phase 2: Milestone Execution
- **Milestone 1 (R1: Structured Grammar Explanations)**:
  - Worker updates `api/dialogo.js` prompt for `analisar_pratica` to return `erros_detalhados` array & safe JSON parse.
  - Worker refactors `AjudaModal.tsx` to render errors using Shadcn Accordion.
  - Reviewer & Challenger verify R1 correctness & handle empty error array gracefully.
  - Forensic Auditor performs integrity check.

- **Milestone 2 (R2: Contextual Response Suggestions)**:
  - Worker updates `AjudaModal.tsx` "Sugestão" flow to call `sugerir_multiplas_respostas`.
  - Worker renders 3 Shadcn Cards (Concordar, Discordar, Perguntar) with "✏️ Praticar" and "✅ Usar direto".
  - Reviewer & Challenger verify button actions and error boundaries.
  - Forensic Auditor performs integrity check.

- **Milestone 3 (R3: Vocabulary & SRS Dual Persistence)**:
  - Worker updates "Vocabulário Extraído" tab in `AjudaModal.tsx` with "💾 Salvar" button.
  - Worker implements dual fetch (`/api/jisho?acao=salvar` and `/api/srs?acao=salvar`) with `session.access_token`.
  - Loading state + button text changes to "✅ Salvo" and disabled upon success.
  - Reviewer & Challenger verify dual persistence, auth headers, and error handling.
  - Forensic Auditor performs integrity check.

- **Milestone 4 (R4: Session Progress Stats Drawer)**:
  - Ensure Shadcn `Sheet` or `Drawer` component is available (Worker installs via `npx shadcn@latest add ...` if missing).
  - Worker adds "📊 Progresso" button in `DialoGoPanel.tsx` that opens Sheet/Drawer without unmounting `AjudaModal` or resetting chat.
  - Worker implements local stats calculations, Supabase `dialogo_sessoes` fetch for past sessions, and grouped error breakdown.
  - Reviewer & Challenger verify state persistence, drawer opening, and error handling.
  - Forensic Auditor performs integrity check.

### Phase 3: Final Verification & Delivery
- Run `npm run build` verification via Worker.
- Final code review & audit checks.
- Produce Handoff Report and send victory claim.
