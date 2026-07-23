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
              : t.variant === "success"
              ? "bg-emerald-900/90 border-emerald-700 text-emerald-100"
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
