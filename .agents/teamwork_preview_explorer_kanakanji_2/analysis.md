# Controlled React IME Architecture Analysis & Implementation Plan

## 1. Executive Summary

This report presents a thorough investigation of the current input field handling in `src/dialogo/DialoGoPanel.tsx` and details the architectural specification for a dedicated, controlled React component (`src/dialogo/components/KanaKanjiInput.tsx`). The new component eliminates the issues caused by `wanakana.bind()`, introduces controlled state management with Wanakana utility calls inside `onChange`, and provides buffer segmentation and candidate selection logic for Romaji -> Kana -> Kanji conversion.

---

## 2. Current Implementation Analysis (`DialoGoPanel.tsx`)

### 2.1 Inspection Findings

1. **Package Dependency Verification (`package.json`)**:
   - `wanakana` dependency: `"wanakana": "^5.3.1"` (line 48)
   - `@types/wanakana` devDependency: `"@types/wanakana": "^4.0.6"` (line 54)
   - Wanakana is imported as a module in `DialoGoPanel.tsx`: `import * as wanakana from 'wanakana';` (line 4).

2. **Imperative DOM Binding**:
   - In `DialoGoPanel.tsx` lines 72–82:
     ```tsx
     useEffect(() => {
         const inputEl = inputRef.current;
         if (!loading && inputEl) {
             wanakana.bind(inputEl);
         }
         return () => {
             if (inputEl) {
                 wanakana.unbind(inputEl);
             }
         };
     }, [loading]);
     ```
   - Input element rendered at lines 494–502:
     ```tsx
     <Input
         ref={inputRef}
         type="text"
         value={inputUser}
         onChange={e => setInputUser(e.target.value)}
         placeholder="Digite em romaji (será convertido para hiragana/katakana automaticamente)..."
         disabled={enviando}
         className="flex-1 text-base h-12 border-2 border-input bg-card text-foreground"
     />
     ```

3. **Message Submission Flow (`enviarMensagem`)**:
   - Lines 148–278: `enviarMensagem(e?: React.FormEvent, targetProvider = ..., textToSend?: string)`
   - Triggers optimistic state update (`setHistorico`), posts message to `/api/dialogo`, handles AI response and fallback popups, resets input via `setInputUser('')`.

### 2.2 Why `wanakana.bind()` Fails in Controlled React Components

- **Direct DOM Mutation vs Virtual DOM Reconciliation**: `wanakana.bind()` listens to native `input` events and imperatively overwrites `HTMLInputElement.value`. React controlled inputs (`value={inputUser}`) re-render whenever state updates. When `onChange` sets `inputUser`, React forces `inputEl.value = inputUser`, fighting Wanakana's imperative edits.
- **Side Effects**: Cursor position reset to end of input, duplicated letters (e.g. typing `ka` producing `かk` or `かa`), broken backspace behavior, and inability to handle composition states.
- **No Kanji Conversion**: `wanakana.bind()` only supports Romaji to Hiragana/Katakana conversion. It does not handle IME buffer segmentation or Kanji conversion candidate menus.

---

## 3. Architecture Specification for `KanaKanjiInput.tsx`

### 3.1 Controlled React State (NO `wanakana.bind()`)

Instead of imperative binding, `KanaKanjiInput` handles input interceptively inside React's `onChange` event:
1. User types characters into standard HTML `<input>` or `<textarea>`.
2. `onChange` receives raw string `val`.
3. Interceptor runs `wanakana.toKana(val, { IMEMode: true })` (or `toHiragana` / `toKatakana` depending on active mode).
4. `IMEMode: true` preserves pending single `'n'` keystrokes so typing `nihon` correctly transitions from `に` -> `にh` -> `にほ` -> `にほん`.
5. Transformed value is stored in React state and propagated via `props.onChange`.

### 3.2 Buffer Segmentation & IME Composition Strategy

To support Kanji conversion alongside Kana typing, `KanaKanjiInput` maintains buffer segmentation:

```
[ Full Text Value ] = [ Committed Text ] + [ Active Composition Buffer ]
```

1. **Committed Text (`committedText`)**: Confirmed hiragana/katakana/kanji/english that is finalized and will not change when space or conversion is pressed.
2. **Composition Buffer (`compositionBuffer`)**: Active segment currently being typed in Romaji/Kana that can be converted into Kanji candidates.

#### State Machine & Workflow:
- **Typing**: Keystrokes convert Romaji to Hiragana in `compositionBuffer`.
- **Space Key (Conversion Trigger)**:
  - If `compositionBuffer` is active (non-empty): Intercepts `Space` default, queries Kanji dictionary / Jisho API for candidates matching `compositionBuffer`. Opens floating Candidate Dropdown.
  - If Candidates Dropdown is open: Pressing `Space` or `ArrowDown` cycles to the next Kanji candidate.
  - If `compositionBuffer` is empty: Inserts standard space `' '`.
- **Enter Key (Commit / Send)**:
  - If Candidate Dropdown is open: Confirms selected Kanji candidate, appends it to `committedText`, clears `compositionBuffer`, and closes candidate box.
  - If `compositionBuffer` is active (without candidate dropdown open): Commits `compositionBuffer` as Kana into `committedText`.
  - If no active composition and full input string is non-empty: Triggers `onSendMessage(value)`.
- **Escape Key (Cancel Conversion)**: Closes candidate dropdown, leaving `compositionBuffer` as plain Kana.
- **Backspace**: Deletes last character from `compositionBuffer` first, then from `committedText` if buffer is empty.

### 3.3 Props Contract (`KanaKanjiInputProps`)

```typescript
export interface KanaKanjiInputProps {
    /** Controlled input value */
    value: string;
    /** Callback fired when input value changes */
    onChange: (value: string) => void;
    /** Callback fired to submit message */
    onSendMessage: (text?: string) => void;
    /** Input placeholder text */
    placeholder?: string;
    /** Disabled state during network submission */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Auto focus on mount */
    autoFocus?: boolean;
    /** Active script mode: 'hiragana' (default), 'katakana', or 'direct' (romaji/english) */
    mode?: 'hiragana' | 'katakana' | 'direct';
    /** Mode change callback */
    onModeChange?: (mode: 'hiragana' | 'katakana' | 'direct') => void;
}
```

---

## 4. Implementation Design & Component Sketches

### 4.1 Component Implementation (`src/dialogo/components/KanaKanjiInput.tsx`)

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as wanakana from 'wanakana';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface KanjiCandidate {
    kanji: string;
    reading: string;
    meaning?: string;
}

export interface KanaKanjiInputProps {
    value: string;
    onChange: (value: string) => void;
    onSendMessage: (text?: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    autoFocus?: boolean;
    mode?: 'hiragana' | 'katakana' | 'direct';
    onModeChange?: (mode: 'hiragana' | 'katakana' | 'direct') => void;
}

export default function KanaKanjiInput({
    value,
    onChange,
    onSendMessage,
    placeholder = "Digite em romaji...",
    disabled = false,
    className = "",
    autoFocus = false,
    mode = 'hiragana',
    onModeChange
}: KanaKanjiInputProps) {
    const [inputMode, setInputMode] = useState<'hiragana' | 'katakana' | 'direct'>(mode);
    const [candidates, setCandidates] = useState<KanjiCandidate[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showCandidates, setShowCandidates] = useState(false);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    
    // Internal composition tracking
    const [compositionBuffer, setCompositionBuffer] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleModeToggle = (newMode: 'hiragana' | 'katakana' | 'direct') => {
        setInputMode(newMode);
        if (onModeChange) onModeChange(newMode);
    };

    // Convert incoming input based on active mode
    const convertText = (rawText: string): string => {
        if (inputMode === 'direct') return rawText;
        if (inputMode === 'katakana') {
            return wanakana.toKatakana(rawText, { IMEMode: true });
        }
        return wanakana.toKana(rawText, { IMEMode: true });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const converted = convertText(raw);
        onChange(converted);
        setCompositionBuffer(converted);
        if (showCandidates) setShowCandidates(false);
    };

    // Kanji lookup fetcher (integrates with /api/jisho or local common kanji dictionary)
    const fetchKanjiCandidates = async (reading: string) => {
        if (!reading.trim()) return;
        setLoadingCandidates(true);
        try {
            const res = await fetch(`/api/jisho?termo=${encodeURIComponent(reading)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.data && Array.isArray(data.data)) {
                    const extracted: KanjiCandidate[] = data.data.slice(0, 8).map((item: any) => ({
                        kanji: item.japanese[0]?.word || item.japanese[0]?.reading || reading,
                        reading: item.japanese[0]?.reading || reading,
                        meaning: item.senses[0]?.english_definitions?.slice(0, 2).join(', ')
                    }));
                    setCandidates(extracted);
                    setSelectedIndex(0);
                    setShowCandidates(extracted.length > 0);
                }
            }
        } catch (err) {
            console.error("Error fetching Kanji candidates:", err);
        } finally {
            setLoadingCandidates(false);
        }
    };

    const commitCandidate = (candidate: KanjiCandidate) => {
        // Replace current composition reading with selected Kanji
        if (compositionBuffer) {
            const newValue = value.replace(new RegExp(compositionBuffer + '$'), candidate.kanji);
            onChange(newValue);
        } else {
            onChange(value + candidate.kanji);
        }
        setShowCandidates(false);
        setCompositionBuffer('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showCandidates && candidates.length > 0) {
            if (e.key === 'ArrowDown' || (e.key === ' ' && e.shiftKey === false)) {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % candidates.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + candidates.length) % candidates.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                commitCandidate(candidates[selectedIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowCandidates(false);
                return;
            }
        }

        if (e.key === ' ' && compositionBuffer && !showCandidates) {
            e.preventDefault();
            fetchKanjiCandidates(compositionBuffer);
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                onSendMessage(value);
            }
        }
    };

    return (
        <div className="relative flex flex-col w-full gap-1">
            {/* Mode Selector Chips */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <button
                    type="button"
                    onClick={() => handleModeToggle('hiragana')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        inputMode === 'hiragana' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                    }`}
                >
                    あ ひらがな
                </button>
                <button
                    type="button"
                    onClick={() => handleModeToggle('katakana')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        inputMode === 'katakana' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                    }`}
                >
                    ア カタカナ
                </button>
                <button
                    type="button"
                    onClick={() => handleModeToggle('direct')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        inputMode === 'direct' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                    }`}
                >
                    A Direct / English
                </button>
            </div>

            {/* Input Field */}
            <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                className={className}
            />

            {/* Kanji Candidate Popover */}
            {showCandidates && candidates.length > 0 && (
                <Card className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-popover border border-border shadow-xl p-1 flex flex-col gap-1 max-h-48 overflow-y-auto">
                    <div className="px-2 py-1 text-[0.7rem] font-bold text-muted-foreground uppercase border-b border-border">
                        Candidatos Kanji (Espaço/Setas para navegar, Enter para confirmar)
                    </div>
                    {candidates.map((cand, idx) => (
                        <div
                            key={idx}
                            onClick={() => commitCandidate(cand)}
                            className={`flex items-center justify-between px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                                idx === selectedIndex ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-accent'
                            }`}
                        >
                            <span className="text-base">{cand.kanji}</span>
                            <span className="text-xs opacity-80">{cand.reading}</span>
                        </div>
                    ))}
                </Card>
            )}
        </div>
    );
}
```

---

## 5. Refactoring Plan for `DialoGoPanel.tsx`

1. **Remove Wanakana Imperative Effect**:
   Delete lines 72–82 from `DialoGoPanel.tsx`:
   ```tsx
   // REMOVE:
   useEffect(() => {
       const inputEl = inputRef.current;
       if (!loading && inputEl) {
           wanakana.bind(inputEl);
       }
       return () => {
           if (inputEl) {
               wanakana.unbind(inputEl);
           }
       };
   }, [loading]);
   ```

2. **Import `KanaKanjiInput`**:
   Add import at top of `DialoGoPanel.tsx`:
   ```tsx
   import KanaKanjiInput from './components/KanaKanjiInput';
   ```

3. **Update Render Section**:
   Replace current form input (lines 490–511) with:
   ```tsx
   <form
       onSubmit={(e) => enviarMensagem(e, provider || context.provider || 'groq')}
       className="flex gap-2 items-end"
   >
       <div className="flex-1">
           <KanaKanjiInput
               value={inputUser}
               onChange={setInputUser}
               onSendMessage={() => enviarMensagem(undefined, provider || context.provider || 'groq')}
               placeholder="Digite em romaji (ex: nihon)... Espaço para Kanji"
               disabled={enviando}
               className="text-base h-12 border-2 border-input bg-card text-foreground"
           />
       </div>
       <Button
           type="submit"
           disabled={enviando || !inputUser.trim()}
           className="h-12 px-7 text-base font-bold"
       >
           Enviar
       </Button>
   </form>
   ```

---

## 6. Verification & Test Plan

1. **Controlled React Verification**:
   - Verify typing romaji (`watashi`) produces `わたし` in `inputUser` state without dropping characters or jumping cursor.
   - Verify typing `'n'` does not produce `'ん'` prematurely until next consonant/vowel or `'n'` keypress (owing to `IMEMode: true`).
2. **Mode Switching Verification**:
   - Verify clicking `ひらがな` produces Hiragana (`にほん`).
   - Verify clicking `カタカナ` produces Katakana (`ニホン`).
   - Verify clicking `Direct / English` allows typing raw English characters without conversion.
3. **Kanji Conversion Verification**:
   - Type `nihon`, press `Space`, verify Kanji dropdown appears with `日本`.
   - Press `Enter`, verify text becomes `日本` and dropdown closes.
4. **Message Submission Verification**:
   - Pressing `Enter` when candidates dropdown is closed submits message optimistic update to `historico` and calls `/api/dialogo`.
