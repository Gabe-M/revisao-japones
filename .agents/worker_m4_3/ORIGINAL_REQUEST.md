## 2026-07-22T11:02:30Z

<USER_REQUEST>
You are Worker 3 for Milestone 4 (R4 UI Integration & Toast Notifications).
Your working directory is: c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m4_3

CRITICAL DIRECTIVE: You MUST execute actual tool calls (`write_to_file`, `replace_file_content`, `run_command`) to modify the codebase files on disk. Do NOT just write text in your final message; you MUST call the file-editing tools.

Instructions:
1. Initialize directory `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m4_3` with BRIEFING.md and progress.md.
2. Call `write_to_file` to create `c:\Users\Fabiano\Downloads\sites\japones\src\components\ui\use-toast.ts` with Overwrite: true:
   ```typescript
   import * as React from "react"

   export interface ToastProps {
     id?: string
     title?: React.ReactNode
     description?: React.ReactNode
     action?: React.ReactNode
     variant?: "default" | "destructive"
   }

   type Listener = (toasts: ToastProps[]) => void
   const listeners: Listener[] = []
   let memoryState: ToastProps[] = []

   function dispatch(toastItem: ToastProps) {
     memoryState = [...memoryState, toastItem]
     listeners.forEach((listener) => listener(memoryState))
     setTimeout(() => {
       memoryState = memoryState.filter((t) => t !== toastItem)
       listeners.forEach((listener) => listener(memoryState))
     }, 4000)
   }

   export function toast(props: ToastProps) {
     dispatch(props)
   }

   export function useToast() {
     const [toasts, setToasts] = React.useState<ToastProps[]>(memoryState)

     React.useEffect(() => {
       listeners.push(setToasts)
       return () => {
         const index = listeners.indexOf(setToasts)
         if (index > -1) listeners.splice(index, 1)
       }
     }, [])

     return {
       toasts,
       toast,
       dismiss: () => {
         memoryState = []
         listeners.forEach((l) => l(memoryState))
       },
     }
   }
   ```
3. Call `write_to_file` to create `c:\Users\Fabiano\Downloads\sites\japones\src\components\ui\toaster.tsx` with Overwrite: true:
   ```tsx
   import React from "react"
   import { useToast } from "./use-toast"

   export function Toaster() {
     const { toasts } = useToast()

     if (!toasts.length) return null

     return (
       <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
         {toasts.map((t, i) => (
           <div
             key={t.id || i}
             className={`p-4 rounded-xl shadow-lg border text-sm font-medium transition-all pointer-events-auto ${
               t.variant === "destructive"
                 ? "bg-red-900/90 border-red-700 text-red-100"
                 : "bg-zinc-900/90 border-zinc-700 text-zinc-100"
             }`}
           >
             {t.title && <div className="font-bold mb-1">{t.title}</div>}
             {t.description && <div>{t.description}</div>}
           </div>
         ))}
       </div>
     )
   }
   ```
4. View `src/dialogo/DialoGoApp.tsx` and call `replace_file_content` to import `<Toaster />` from `../components/ui/toaster` and render it near root of component.
5. View `src/dialogo/components/AjudaModal.tsx` and call `replace_file_content` to import `adicionarAoAnki` from `../services/ankiService`, `buscarExemploETradução` from `../utils/sentenceMining`, `toast` from `../../components/ui/use-toast`, add `handleAdicionarAnki(palavraItem: string)` and add "🎴 Adicionar ao Anki" button next to vocabulary items.
6. View `src/dialogo/components/PalavraNovaPopover.tsx` and call `replace_file_content` to import `adicionarAoAnki` from `../services/ankiService`, `toast` from `../../components/ui/use-toast`, add `handleAdicionarAnki()`, and add "🎴 Adicionar ao Anki" button.
7. Run `npx tsc --noEmit` using `run_command` to verify TypeScript compilation passes with 0 errors.
8. Write your handoff report to `c:\Users\Fabiano\Downloads\sites\japones\.agents\worker_m4_3\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
</USER_REQUEST>
