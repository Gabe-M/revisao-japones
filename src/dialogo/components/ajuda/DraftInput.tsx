import React, { useRef, useEffect } from 'react';
import { Sparkles, CheckCircle, HelpCircle, X } from 'lucide-react';
import * as wanakana from 'wanakana';
import InteractiveText from '../../../components/InteractiveText';
import AiLoader from '../AiLoader';

interface DraftInputProps {
    praticaInput: string;
    setPraticaInput: (val: string) => void;
    modoAtivo: 'analisar' | 'sugestao' | 'duvida' | null;
    onAnalisar: () => void;
    onSugestao: () => void;
    onDuvida: () => void;

    // Lacuna props
    lacunaAtiva: { termoPt: string; raw: string } | null;
    setLacunaAtiva: (val: { termoPt: string; raw: string } | null) => void;
    sugestoesLacuna: any[];
    loadingLacuna: boolean;
    onSugerirLacuna: (termoPt: string, raw: string) => void;
    onSelecionarSugestao: (textoPuro: string) => void;

    provider: string;
}

export default function DraftInput({
    praticaInput,
    setPraticaInput,
    modoAtivo,
    onAnalisar,
    onSugestao,
    onDuvida,
    lacunaAtiva,
    setLacunaAtiva,
    sugestoesLacuna,
    loadingLacuna,
    onSugerirLacuna,
    onSelecionarSugestao,
    provider
}: DraftInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize the textarea as content grows
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [praticaInput]);

    // Romanji → Hiragana with bracket passthrough and cursor preservation
    const handlePraticaInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const rawVal = e.target.value;
        const selectionStart = e.target.selectionStart || 0;
        const prefix = rawVal.substring(0, selectionStart);
        const lastOpenBracket = prefix.lastIndexOf('[');
        const lastCloseBracket = prefix.lastIndexOf(']');
        const isInsideBracket = lastOpenBracket > lastCloseBracket;

        if (isInsideBracket) {
            setPraticaInput(rawVal);
        } else {
            const regex = /(\[.*?\])/g;
            const parts = rawVal.split(regex);
            const convertedParts = parts.map(part => {
                if (part.startsWith('[') && part.endsWith(']')) return part;
                return wanakana.toHiragana(part, { IMEMode: true });
            });
            const convertedVal = convertedParts.join('');
            setPraticaInput(convertedVal);

            const prefixParts = prefix.split(regex);
            const convertedPrefix = prefixParts.map(part => {
                if (part.startsWith('[') && part.endsWith(']')) return part;
                return wanakana.toHiragana(part, { IMEMode: true });
            }).join('');
            const newCursorPos = convertedPrefix.length;
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
    };

    // Ghost Kana preview — only shown when there are [lacuna] brackets
    // Rendered as floating ghost text with zero bounding box (no background, no border)
    const renderKanaPreview = () => {
        if (!praticaInput) return null;
        const hasLacuna = praticaInput.includes('[') && praticaInput.includes(']');
        if (!hasLacuna) return null;

        return (
            // text-gray-400 text-lg — zero bounding box ghost overlay
            <div className="text-gray-400 text-lg leading-relaxed mt-1 select-none pointer-events-none-except-chips">
                {praticaInput.split(/(\[.*?\])/g).map((parte, index) => {
                    if (parte.startsWith('[') && parte.endsWith(']')) {
                        const termoLimpo = parte.slice(1, -1);
                        // Re-enable pointer events only on interactive chips
                        return (
                            <button
                                key={index}
                                type="button"
                                onClick={() => onSugerirLacuna(termoLimpo, parte)}
                                className={`
                                    inline-block font-semibold text-sm px-2 py-0.5 rounded-md border-none cursor-pointer mx-0.5
                                    transition-all duration-150
                                    ${lacunaAtiva?.raw === parte
                                        ? 'text-white scale-105'
                                        : 'text-white hover:brightness-110 hover:-translate-y-px'
                                    }
                                `}
                                style={{
                                    pointerEvents: 'auto',
                                    background: lacunaAtiva?.raw === parte
                                        ? 'linear-gradient(135deg, #ff8c42, #e55a1c)'
                                        : 'linear-gradient(135deg, rgba(255,107,107,0.8), rgba(192,57,43,0.8))',
                                    boxShadow: lacunaAtiva?.raw === parte
                                        ? '0 4px 12px rgba(229,90,28,0.45)'
                                        : '0 2px 8px rgba(220,53,69,0.3)',
                                }}
                            >
                                {termoLimpo}
                            </button>
                        );
                    }
                    // Plain ghost text — text-gray-400, no box
                    return <span key={index} className="text-gray-400">{parte}</span>;
                })}
            </div>
        );
    };

    // Lacuna suggestion popover
    const renderLacunaPopover = () => {
        if (!lacunaAtiva) return null;
        return (
            <div className="mt-2.5 p-3.5 rounded-2xl border border-[rgba(255,107,107,0.28)] bg-[rgba(12,12,18,0.97)] shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-[var(--text-color)] opacity-65">
                        Sugestões para &ldquo;{lacunaAtiva.termoPt}&rdquo;
                    </span>
                    <button
                        type="button"
                        onClick={() => setLacunaAtiva(null)}
                        className="p-1 rounded-md text-[var(--text-color)] opacity-45 hover:opacity-90 transition-opacity border-none bg-transparent cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                </div>
                {loadingLacuna ? (
                    <div className="py-4 flex justify-center">
                        <AiLoader provider={provider} message="Buscando traduções..." />
                    </div>
                ) : sugestoesLacuna.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {sugestoesLacuna.map((s, idx) => (
                            <div
                                key={idx}
                                onClick={() => onSelecionarSugestao(s.texto_puro)}
                                className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] cursor-pointer transition-all duration-200 hover:border-[rgba(255,107,107,0.4)] hover:bg-[rgba(255,107,107,0.08)]"
                            >
                                <div className="text-[1.1em] mb-0.5">
                                    <InteractiveText text={s.termo_jp} />
                                </div>
                                <p className="m-0 text-[0.82em] opacity-60">{s.explicacao_curta}</p>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    };

    const isOverLimit = praticaInput.length > 60;

    return (
        <>
            {/*
             * ── Floating Canvas ──
             * Uses CSS :focus-within (native, no JS state needed) to activate the
             * highlight ring on the container when the textarea receives focus.
             * backdrop-blur-md + bg-glass + border-glass per spec.
             */}
            <div
                className="relative group shrink-0 p-[18px] px-5 pb-[14px] min-h-[100px] flex flex-col justify-end w-full backdrop-blur-[16px] border rounded-[20px] transition-[border-color,box-shadow] duration-250 ease-out focus-within:border-[var(--highlight-color)] focus-within:shadow-[0_0_0_3px_rgba(211,84,0,0.12),0_8px_32px_rgba(0,0,0,0.25)]"
                style={{
                    backgroundColor: 'var(--glass-bg, rgba(255,255,255,0.05))',
                    borderColor: 'var(--glass-border, rgba(255,255,255,0.10))'
                }}
            >
                {/* Tiny label */}
                <div
                    className="text-[0.7rem] font-bold uppercase tracking-widest mb-2.5 opacity-70"
                    style={{ color: 'var(--highlight-color)' }}
                >
                    Sua resposta
                </div>

                {/*
                 * THE TEXTAREA
                 * Spec: border-none outline-none ring-0 bg-transparent resize-none text-2xl
                 * All applied as Tailwind utility classes directly on the element.
                 */}
                <textarea
                    ref={textareaRef}
                    value={praticaInput}
                    onChange={handlePraticaInputChange}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (praticaInput.trim()) onAnalisar();
                        }
                    }}
                    placeholder="Digite em romaji…"
                    autoFocus
                    rows={1}
                    className="block w-full border-none outline-none ring-0 bg-transparent resize-none text-2xl font-normal leading-relaxed text-[var(--text-color)] placeholder:text-[var(--text-color)] placeholder:opacity-25 min-h-[2.5rem] overflow-hidden p-0 [caret-color:var(--highlight-color)] transition-none"
                />

                {/*
                 * LIVE KANA PREVIEW (Ghost Text)
                 * Spec: text-gray-400 text-lg, zero bounding box
                 * Rendered as an unbounded inline flow directly below the last line.
                 */}
                {renderKanaPreview()}

                {/* Character counter */}
                <div className={`text-right text-[0.7rem] font-medium mt-1.5 transition-colors duration-200
                    ${isOverLimit
                        ? 'text-red-500 font-bold opacity-100'
                        : 'text-[var(--text-color)] opacity-30'
                    }`}>
                    {isOverLimit && <span>⚠ Frase longa · </span>}
                    {praticaInput.length}/60
                </div>

                {/*
                 * FLOATING ACTION BAR (FAB)
                 */}
                <div className="flex flex-row justify-center gap-4 bg-slate-800/80 backdrop-blur-md rounded-full mx-auto p-2 w-max mt-2">
                    {/* PRIMARY: Verificar — CheckCircle */}
                    <button
                        type="button"
                        onClick={onAnalisar}
                        disabled={!praticaInput.trim()}
                        title="Verificar minha resposta com IA"
                        className={`
                            inline-flex items-center gap-1.5 px-4 py-2
                            text-[0.82rem] font-semibold font-[inherit]
                            border-none cursor-pointer whitespace-nowrap
                            transition-all duration-150 active:scale-95
                            disabled:opacity-35 disabled:cursor-not-allowed
                            ${modoAtivo === 'analisar'
                                ? 'bg-[var(--highlight-color)] text-white'
                                : 'bg-transparent text-[var(--highlight-color)] hover:bg-[rgba(211,84,0,0.12)]'
                            }
                        `}
                    >
                        <CheckCircle size={16} aria-hidden="true" />
                        <span>Verificar</span>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-[var(--glass-border,rgba(255,255,255,0.12))] flex-shrink-0" />

                    {/* SECONDARY: Sugestão — Sparkles */}
                    <button
                        type="button"
                        onClick={onSugestao}
                        title="Sugerir uma resposta adequada ao contexto"
                        className={`
                            inline-flex items-center gap-1.5 px-4 py-2
                            text-[0.82rem] font-semibold font-[inherit]
                            border-none cursor-pointer whitespace-nowrap
                            transition-all duration-150 active:scale-95
                            ${modoAtivo === 'sugestao'
                                ? 'bg-[rgba(211,84,0,0.08)] text-[var(--highlight-color)] opacity-100'
                                : 'bg-transparent text-[var(--text-color)] opacity-75 hover:opacity-100 hover:bg-white/[0.06]'
                            }
                        `}
                    >
                        <Sparkles size={15} aria-hidden="true" />
                        <span>Sugestão</span>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-[var(--glass-border,rgba(255,255,255,0.12))] flex-shrink-0" />

                    {/* GHOST: Dúvida — HelpCircle */}
                    <button
                        type="button"
                        onClick={onDuvida}
                        title="Tirar uma dúvida de gramática ou vocabulário"
                        className={`
                            inline-flex items-center gap-1.5 px-4 py-2
                            text-[0.82rem] font-semibold font-[inherit]
                            border-none cursor-pointer whitespace-nowrap
                            transition-all duration-150 active:scale-95
                            ${modoAtivo === 'duvida'
                                ? 'bg-[rgba(211,84,0,0.06)] text-[var(--highlight-color)] opacity-100'
                                : 'bg-transparent text-[var(--text-color)] opacity-45 hover:opacity-85 hover:bg-white/[0.04]'
                            }
                        `}
                    >
                        <HelpCircle size={15} aria-hidden="true" />
                        <span>Dúvida</span>
                    </button>
                </div>
            </div>

            {/* Lacuna popover — outside the canvas so it doesn't shift layout */}
            {renderLacunaPopover()}
        </>
    );
}
