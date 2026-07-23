import * as React from "react"

export type ToastVariant = "default" | "destructive" | "success"

export interface ToastProps {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: ToastVariant
}

export type ToastInput = string | ToastProps

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

export function toast(input: ToastInput) {
  const props: ToastProps = typeof input === "string" ? { title: input } : input
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
