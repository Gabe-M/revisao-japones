# Analysis & Architecture Design: Candidate Suggestions Popup UI & Keyboard Navigation (`KanaKanjiInput`)

## Executive Summary
This document defines the complete UI layout, Tailwind CSS v4 styling, component architecture, keyboard event handling (`onKeyDown`), and resilient network execution for the **Candidate Suggestions Popup** in `KanaKanjiInput.tsx`. 

The component enables real-time Japanese Romaji → Kana → Kanji conversion inside `DialoGoPanel.tsx` using a controlled React IME pattern, Shadcn UI (`Card`, `ScrollArea`), Tailwind CSS v4 variables, and an `AbortController`-backed 3-second timeout mechanism.

---

## 1. UI Environment & Existing Component Inventory

### 1.1 Installed UI Components (`src/components/ui/`)
- **`Card`** (`src/components/ui/card.tsx`): Radix/Shadcn card container supporting semantic background (`bg-card`, `bg-popover`), rounded borders (`rounded-xl border border-border`), and floating shadows (`shadow-2xl`).
- **`ScrollArea`** (`src/components/ui/scroll-area.tsx`): Radix-based custom scroll area with styled scrollbars (`ScrollAreaPrimitive.Viewport`), preventing layout shifts during candidate list navigation.
- **`Input`** (`src/components/ui/input.tsx`): Base text field styled with `border-2 border-input bg-card text-foreground h-12 text-base`.
- **`Button`** (`src/components/ui/button.tsx`): Variant-aware button component.
- **Class Merging Utility**: `cn` from `@/lib/utils` (`clsx` + `tailwind-merge`).

### 1.2 Theme & Styling Tokens (Tailwind CSS v4)
`DialoGoPanel.tsx` relies on semantic Tailwind tokens:
- `bg-popover` / `text-popover-foreground`: Floating popover surface and text colors.
- `bg-accent` / `text-accent-foreground`: Highlighted item state during keyboard navigation (`selectedIndex`).
- `border-border`: Subtle container divider color matching light/dark themes.
- `bg-muted` / `text-muted-foreground`: Secondary text, index badges, and keyboard shortcuts legend.
- `ring-ring` / `ring-primary`: Keyboard focus indicators.

---

## 2. Floating Popover UI Design (`CandidatePopup`)

### 2.1 Layout & Positioning Strategy
To prevent position drift and layout distortion inside `DialoGoPanel.tsx`, the popup container is anchored directly relative to the input field wrapper:

```tsx
/* Outer Input Wrapper in KanaKanjiInput.tsx */
<div className="relative flex-1">
  {/* Candidate Suggestions Popup */}
  {isPopupOpen && (
    <CandidatePopup
      candidates={candidates}
      selectedIndex={selectedIndex}
      isLoading={isLoading}
      compositionBuffer={compositionBuffer}
      onSelectCandidate={handleSelectCandidate}
    />
  )}
  <Input ... />
</div>
```

- **Positioning**: `absolute bottom-full left-0 mb-2 w-72 sm:w-80 z-50`
- **Elevation**: `shadow-2xl border border-border bg-popover/95 backdrop-blur-md rounded-xl overflow-hidden`
- **Animation**: `animate-in fade-in slide-in-from-bottom-2 duration-150`

### 2.2 Visual Component Hierarchy

```
┌────────────────────────────────────────────────────────┐
│ CandidatePopup (Card)                                  │
├────────────────────────────────────────────────────────┤
│ Header: [Kanji Conversion]  【にほん】      (1/8)       │
├────────────────────────────────────────────────────────┤
│ ScrollArea (max-h-56)                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. 日本       [Selected - bg-accent border-l-4] │  │
│  │ 2. にほん     [Default - hover:bg-muted/60]      │  │
│  │ 3. 二本       [Default]                          │  │
│  │ 4. 日本       [Default]                          │  │
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│ Footer (Keyboard Legend):                              │
│  [Space/↑↓] Navegar  [Enter] Confirmar  [Esc] Fechar   │
└────────────────────────────────────────────────────────┘
```

### 2.3 Proposed Popup Component Code (`CandidatePopup.tsx` / internal)

```tsx
import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';

interface CandidatePopupProps {
  candidates: string[];
  selectedIndex: number;
  isLoading: boolean;
  compositionBuffer: string;
  onSelectCandidate: (candidate: string) => void;
}

export const CandidatePopup: React.FC<CandidatePopupProps> = ({
  candidates,
  selectedIndex,
  isLoading,
  compositionBuffer,
  onSelectCandidate,
}) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll selected item into view inside ScrollArea
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  return (
    <Card className="absolute bottom-full left-0 mb-2 w-72 sm:w-86 z-50 shadow-2xl border border-border bg-popover/95 backdrop-blur-md rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Conversão Kanji</span>
          {compositionBuffer && (
            <span className="font-mono text-foreground font-semibold">
              【{compositionBuffer}】
            </span>
          )}
        </div>
        {candidates.length > 0 && !isLoading && (
          <span className="text-[11px] font-mono opacity-80">
            {selectedIndex + 1}/{candidates.length}
          </span>
        )}
      </div>

      {/* Body / Loading state */}
      {isLoading ? (
        <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Buscando candidatos...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-3 text-center text-xs text-muted-foreground italic">
          Nenhuma conversão encontrada
        </div>
      ) : (
        <ScrollArea className="max-h-56 overflow-y-auto">
          <div className="p-1 flex flex-col gap-0.5">
            {candidates.map((cand, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${cand}-${idx}`}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onClick={() => onSelectCandidate(cand)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm flex items-center justify-between cursor-pointer transition-all duration-100",
                    isSelected
                      ? "bg-accent text-accent-foreground font-bold border-l-4 border-primary pl-2.5 shadow-sm"
                      : "text-popover-foreground hover:bg-muted/60 hover:pl-3"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-4">
                      {idx + 1}.
                    </span>
                    <span className="text-base font-japanese leading-none">
                      {cand}
                    </span>
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                      Sugestão
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Footer Legend */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/40 text-[10px] text-muted-foreground flex items-center justify-between">
        <span><kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">Espaço</kbd> / <kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">↑↓</kbd> Navegar</span>
        <span><kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">Enter</kbd> Confirmar</span>
        <span><kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">Esc</kbd> Sair</span>
      </div>
    </Card>
  );
};
```

---

## 3. Key Events Logic (`onKeyDown`)

The `onKeyDown` handler manages keyboard interaction states cleanly.

### 3.1 Decision Matrix & Event Rules

| Key | Popup State | Action | `e.preventDefault()` | Effect |
|---|---|---|---|---|
| **`Space`** | Closed (`!isPopupOpen`) | Intercept key, fetch candidates via `converter_kanji` for `compositionBuffer` | **Yes** | Opens popup, fetches candidates, sets `selectedIndex = 0` |
| **`Space`** | Open (`isPopupOpen`) | Cycle to next candidate (`(idx + 1) % len`) | **Yes** | Advances highlight in candidate list |
| **`ArrowDown`** | Open (`isPopupOpen`) | Increment `selectedIndex` (`(idx + 1) % len`) | **Yes** | Navigates down in candidate list |
| **`ArrowUp`** | Open (`isPopupOpen`) | Decrement `selectedIndex` (`(idx - 1 + len) % len`) | **Yes** | Navigates up in candidate list |
| **`Enter`** | Open (`isPopupOpen`) | Confirm candidate, replace composition, append to `committedText`, close popup | **Yes** | **Prevents outer chat form submission!** Updates React input state |
| **`Enter`** | Closed (`!isPopupOpen`) | Pass through to outer form `onSubmit` | **No** | Sends chat message to DialoGo Sensei |
| **`Escape`** | Open (`isPopupOpen`) | Abort fetch if pending, close popup, retain raw kana buffer | **Yes** | Restores normal typing mode without changing text |
| **`1`..`9`** | Open (`isPopupOpen`) | Direct selection of candidate at index `N-1` | **Yes** | Fast selection shortcut for top candidates |

### 3.2 Key Down Implementation Spec

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  // 1. SPACE KEY: Open popup OR Cycle candidates
  if (e.key === ' ' || e.code === 'Space') {
    if (compositionBuffer.trim().length > 0) {
      e.preventDefault();
      if (!isPopupOpen) {
        // Trigger conversion fetch
        fetchKanjiCandidates(compositionBuffer);
      } else if (candidates.length > 0) {
        // Cycle candidate index forward
        setSelectedIndex((prev) => (prev + 1) % candidates.length);
      }
      return;
    }
  }

  // 2. ARROW DOWN: Navigate next candidate
  if (e.key === 'ArrowDown') {
    if (isPopupOpen && candidates.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % candidates.length);
      return;
    }
  }

  // 3. ARROW UP: Navigate previous candidate
  if (e.key === 'ArrowUp') {
    if (isPopupOpen && candidates.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
      return;
    }
  }

  // 4. ENTER KEY: Select candidate OR submit form
  if (e.key === 'Enter') {
    if (isPopupOpen) {
      e.preventDefault(); // CRITICAL: Prevents chat form submission!
      const selected = candidates[selectedIndex] || compositionBuffer;
      confirmCandidateSelection(selected);
      return;
    }
    // If popup is closed, do NOT prevent default; allow form onSubmit to handle message send
  }

  // 5. ESCAPE KEY: Close popup & keep raw buffer
  if (e.key === 'Escape') {
    if (isPopupOpen) {
      e.preventDefault();
      cancelCandidatePopup();
      return;
    }
  }

  // 6. NUMBER KEYS 1-9: Direct selection shortcut
  if (isPopupOpen && /^[1-9]$/.test(e.key)) {
    const targetIdx = parseInt(e.key, 10) - 1;
    if (targetIdx < candidates.length) {
      e.preventDefault();
      confirmCandidateSelection(candidates[targetIdx]);
      return;
    }
  }
};
```

---

## 4. Resilience & Timeout Mechanism (3-second `AbortController`)

Network calls to backend proxy endpoints can hang or fail due to network instability. To preserve UX fluidness, we implement an `AbortController` timeout pattern.

### 4.1 Specification
1. **Timeout**: 3000ms (3 seconds).
2. **Cancellation**: If a new conversion request is triggered before the prior completes, or if the user presses `Escape`, the prior request is aborted immediately via `controller.abort()`.
3. **Fallback Behavior**: On timeout or fetch failure (e.g. 500 error from API), the error is caught silently in `try/catch`. The popup closes, `isLoading` is set to `false`, and the user's raw Kana buffer is retained intact so typing is never interrupted.

### 4.2 Network Fetch Implementation Spec

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const fetchKanjiCandidates = async (textToConvert: string) => {
  // Cancel previous pending request if active
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  const controller = new AbortController();
  abortControllerRef.current = controller;
  
  setIsLoading(true);
  setIsPopupOpen(true);
  setSelectedIndex(0);

  const timeoutId = setTimeout(() => {
    controller.abort('TIMEOUT');
  }, 3000);

  try {
    const res = await fetch('/api/dialogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'converter_kanji',
        texto: textToConvert,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.status === 'SUCCESS' && Array.isArray(data.candidates) && data.candidates.length > 0) {
      setCandidates(data.candidates);
      setSelectedIndex(0);
    } else {
      // No candidates found, close popup silently and fallback to raw kana
      closePopupAndCommitRaw();
    }
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError' || err === 'TIMEOUT') {
      console.warn('[KanaKanjiInput] Conversion request timed out (3s) or was aborted.');
    } else {
      console.error('[KanaKanjiInput] Conversion error:', err);
    }

    // Silent fallback: close popup and commit/retain raw kana buffer
    closePopupAndCommitRaw();
  } finally {
    setIsLoading(false);
    abortControllerRef.current = null;
  }
};

const closePopupAndCommitRaw = () => {
  setIsPopupOpen(false);
  setCandidates([]);
  setSelectedIndex(0);
  setIsLoading(false);
};
```

---

## 5. Integration Verification Plan

1. **Space Key Interception**: Verify pressing `Space` when typing `nihon` converts to `にほん`, fetches candidates `["日本", "にほん", "二本"]`, opens popover above input, and highlights `1. 日本`.
2. **Arrow Key Navigation**: Verify pressing `ArrowDown` moves highlight to `2. にほん`, and `ArrowUp` returns to `1. 日本` with `scrollIntoView` functioning seamlessly.
3. **Enter Key Protection**: Verify pressing `Enter` with popover active confirms `日本`, inserts it into input, closes popover, and **does not submit the chat form**.
4. **Enter Key Chat Submit**: Verify pressing `Enter` when popover is closed submits the chat message to DialoGo Sensei.
5. **Escape Key Cancellation**: Verify pressing `Escape` closes popover without altering raw Kana text.
6. **3s Timeout Resilience**: Simulate backend timeout (>3s) or offline state; verify popover closes silently, leaving raw Kana buffer ready without throwing unhandled UI errors.
