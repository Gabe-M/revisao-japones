import React, { useState, useRef, useEffect } from 'react';
import * as wanakana from 'wanakana';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';

export interface KanaKanjiInputProps {
    /** Controlled input value */
    value: string;
    /** Callback fired when input value changes */
    onChange: (value: string) => void;
    /** Callback fired to submit message */
    onSendMessage?: (text?: string) => void;
    /** Input placeholder text */
    placeholder?: string;
    /** Disabled state during network submission */
    disabled?: boolean;
    /** Additional CSS classes for input */
    className?: string;
    /** Auto focus on mount */
    autoFocus?: boolean;
    /** Active script mode: 'hiragana' (default), 'katakana', or 'direct' */
    mode?: 'hiragana' | 'katakana' | 'direct';
    /** Mode change callback */
    onModeChange?: (mode: 'hiragana' | 'katakana' | 'direct') => void;
}

const getActiveSegment = (text: string, cursorPos: number): { start: number; end: number; text: string } => {
    if (cursorPos <= 0) return { start: 0, end: 0, text: "" };
    
    let start = cursorPos;
    const isWordChar = (char: string) => {
        return /^[\u3040-\u309f\u30a0-\u30ff\u30fc\u3099-\u309ca-zA-Z]$/.test(char);
    };

    while (start > 0 && isWordChar(text[start - 1])) {
        start--;
    }
    
    return {
        start,
        end: cursorPos,
        text: text.slice(start, cursorPos)
    };
};

export default function KanaKanjiInput({
    value,
    onChange,
    onSendMessage,
    placeholder = "Digite em romaji... Espaço para Kanji",
    disabled = false,
    className = "",
    autoFocus = false,
    mode = 'hiragana',
    onModeChange
}: KanaKanjiInputProps) {
    const [inputMode, setInputMode] = useState<'hiragana' | 'katakana' | 'direct'>(mode);
    const [candidates, setCandidates] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showCandidates, setShowCandidates] = useState(false);
    const [loadingCandidates, setLoadingCandidates] = useState(false);

    // IME active segment tracking
    const [activeSegment, setActiveSegment] = useState<{ start: number; end: number; text: string } | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Sync input mode if prop changes
    useEffect(() => {
        if (mode && mode !== inputMode) {
            setInputMode(mode);
        }
    }, [mode]);

    // Clear active segment if parent resets value to empty string
    useEffect(() => {
        if (value === '') {
            setActiveSegment(null);
            setShowCandidates(false);
            setCandidates([]);
        }
    }, [value]);

    // Auto-scroll selected candidate into view in ScrollArea
    useEffect(() => {
        if (showCandidates && itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [selectedIndex, showCandidates]);

    const handleModeToggle = (newMode: 'hiragana' | 'katakana' | 'direct') => {
        setInputMode(newMode);
        if (onModeChange) onModeChange(newMode);
    };

    // Convert text using wanakana based on active mode
    const convertText = (rawText: string, currentMode: 'hiragana' | 'katakana' | 'direct'): string => {
        if (currentMode === 'direct') return rawText;
        if (currentMode === 'katakana') {
            return wanakana.toKatakana(rawText, { IMEMode: true });
        }
        return wanakana.toKana(rawText, { IMEMode: true });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const converted = convertText(raw, inputMode);

        onChange(converted);

        if (showCandidates) {
            setShowCandidates(false);
            setCandidates([]);
            setActiveSegment(null);
        }
    };

    const fetchKanjiCandidates = async (textToConvert: string) => {
        if (!textToConvert.trim()) return;

        // Cancel previous request if active
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoadingCandidates(true);
        setShowCandidates(true);
        setSelectedIndex(0);

        const timeoutId = setTimeout(() => {
            controller.abort('TIMEOUT');
        }, 3000);

        try {
            const res = await fetch(`/api/dialogo?acao=converter_kanji&texto=${encodeURIComponent(textToConvert)}`, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            let extracted: string[] = [];

            if (data && Array.isArray(data.candidatos)) {
                extracted = data.candidatos;
            } else if (data && Array.isArray(data.candidates)) {
                extracted = data.candidates;
            } else if (data && Array.isArray(data.data)) {
                extracted = data.data.map((item: any) => item.japanese?.[0]?.word || item.japanese?.[0]?.reading).filter(Boolean);
            }

            const uniqueList = Array.from(new Set(extracted.filter(Boolean)));
            if (!uniqueList.includes(textToConvert)) {
                uniqueList.push(textToConvert);
            }

            if (uniqueList.length > 0) {
                setCandidates(uniqueList);
                setSelectedIndex(0);
                setShowCandidates(true);
            } else {
                setShowCandidates(false);
                setCandidates([]);
            }
        } catch (err: any) {
            clearTimeout(timeoutId);
            // Frontend resilience: silent fallback to raw Kana composition buffer
            setShowCandidates(false);
            setCandidates([]);
        } finally {
            setLoadingCandidates(false);
            abortControllerRef.current = null;
        }
    };

    const commitCandidate = (candidate: string) => {
        if (activeSegment) {
            const before = value.slice(0, activeSegment.start);
            const after = value.slice(activeSegment.end);
            const newTotal = before + candidate + after;
            onChange(newTotal);
            setShowCandidates(false);
            setCandidates([]);
            setActiveSegment(null);

            // Update cursor position in the input after rendering
            const newCursorPos = activeSegment.start + candidate.length;
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // 1. Space Key: Open candidate popup OR Cycle candidate selection
        if (e.key === ' ' || e.code === 'Space') {
            if (showCandidates) {
                if (candidates.length > 0) {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev + 1) % candidates.length);
                }
                return;
            }

            const selectionStart = inputRef.current?.selectionStart || 0;
            const segment = getActiveSegment(value, selectionStart);
            if (segment.text.trim().length > 0) {
                e.preventDefault();
                setActiveSegment(segment);
                fetchKanjiCandidates(segment.text);
                return;
            }
        }

        // 2. ArrowDown Key: Move highlight down in candidate list
        if (e.key === 'ArrowDown') {
            if (showCandidates && candidates.length > 0) {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % candidates.length);
                return;
            }
        }

        // 3. ArrowUp Key: Move highlight up in candidate list
        if (e.key === 'ArrowUp') {
            if (showCandidates && candidates.length > 0) {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + candidates.length) % candidates.length);
                return;
            }
        }

        // 4. Enter Key: Confirm selected candidate OR submit message
        if (e.key === 'Enter') {
            if (showCandidates) {
                e.preventDefault(); // MUST PREVENT CHAT SEND!
                const selected = candidates[selectedIndex] || (activeSegment ? activeSegment.text : '');
                commitCandidate(selected);
                return;
            }

            if (!showCandidates && onSendMessage && value.trim()) {
                e.preventDefault();
                onSendMessage(value);
                return;
            }
        }

        // 5. Escape Key: Close candidate popup without altering raw Kana
        if (e.key === 'Escape') {
            if (showCandidates) {
                e.preventDefault();
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }
                setShowCandidates(false);
                setCandidates([]);
                setActiveSegment(null);
                return;
            }
        }

        // 6. Number Keys 1-9: Quick candidate index shortcut
        if (showCandidates && candidates.length > 0 && /^[1-9]$/.test(e.key)) {
            const targetIdx = parseInt(e.key, 10) - 1;
            if (targetIdx < candidates.length) {
                e.preventDefault();
                commitCandidate(candidates[targetIdx]);
                return;
            }
        }
    };

    return (
        <div className="relative flex flex-col w-full gap-1.5">
            {/* IME Script Mode Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                <button
                    type="button"
                    onClick={() => handleModeToggle('hiragana')}
                    className={cn(
                        "px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-colors border",
                        inputMode === 'hiragana'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                >
                    あ Hiragana
                </button>
                <button
                    type="button"
                    onClick={() => handleModeToggle('katakana')}
                    className={cn(
                        "px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-colors border",
                        inputMode === 'katakana'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                >
                    ア Katakana
                </button>
                <button
                    type="button"
                    onClick={() => handleModeToggle('direct')}
                    className={cn(
                        "px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-colors border",
                        inputMode === 'direct'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                >
                    A Direct
                </button>
            </div>

            {/* Input Element & Floating Popover Anchor Container */}
            <div className="relative w-full">
                {/* Floating Candidate Suggestions Popover */}
                {showCandidates && (
                    <Card className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 z-50 shadow-2xl border border-border bg-popover text-popover-foreground rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
                        {/* Popover Header */}
                        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span>Conversão Kanji</span>
                                {activeSegment?.text && (
                                    <span className="font-mono text-foreground font-semibold">
                                        【{activeSegment.text}】
                                    </span>
                                )}
                            </div>
                            {candidates.length > 0 && !loadingCandidates && (
                                <span className="text-[11px] font-mono opacity-80">
                                    {selectedIndex + 1}/{candidates.length}
                                </span>
                            )}
                        </div>

                        {/* Popover Content */}
                        {loadingCandidates ? (
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
                                                ref={(el) => { itemRefs.current[idx] = el; }}
                                                onClick={() => commitCandidate(cand)}
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
                                                    <span className="text-base leading-none font-japanese">
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

                        {/* Keyboard Navigation Footer Legend */}
                        <div className="px-3 py-1.5 border-t border-border bg-muted/40 text-[10px] text-muted-foreground flex items-center justify-between">
                            <span><kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">Espaço</kbd> / <kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">↑↓</kbd> Navegar</span>
                            <span><kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">Enter</kbd> Confirmar</span>
                            <span><kbd className="font-mono bg-background px-1 py-0.5 rounded border border-border">Esc</kbd> Sair</span>
                        </div>
                    </Card>
                )}

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
            </div>
        </div>
    );
}
