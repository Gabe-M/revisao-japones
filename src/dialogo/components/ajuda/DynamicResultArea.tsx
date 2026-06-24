import React, { useState, useRef, useEffect } from 'react';
import { Play, Check, Send, Book, MessageCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InteractiveText from '../../../components/InteractiveText';
import AiLoader from '../AiLoader';
import ScoreBadge from '../ScoreBadge';

export interface GrammarError {
    trecho_errado: string;
    correcao: string;
    regra_gramatical: string;
}

export interface AnalisePraticaResult {
    correto: boolean;
    score: number;
    dica: string;
    traducao_correta?: string;
    erros?: GrammarError[];
}

interface DynamicResultAreaProps {
    modoAtivo: 'analisar' | 'sugestao' | 'duvida' | null;
    praticaInput: string;
    
    // Analisar states
    analisePratica: AnalisePraticaResult | null;
    loadingPratica: boolean;
    onAnalisar: () => void;
    
    // Sugestão states
    sugestao: { opcoes: Array<{ tom: string; sugestao_jp: string; sugestao_pt: string; dica: string }> } | null;
    loadingSugestao: boolean;
    onSugestao: () => void;
    onPraticarSugestao: (textoJp: string) => void;
    
    // Dúvida states
    duvidaInput: string;
    setDuvidaInput: (val: string) => void;
    respostaDuvida: string;
    loadingDuvida: boolean;
    onEnviarDuvida: () => void;
    
    // Shared actions
    onUsarResposta: (texto: string) => void;
    provider: string;
    resultadoRef: React.RefObject<HTMLDivElement>;
}

export default function DynamicResultArea({
    modoAtivo,
    praticaInput,
    analisePratica,
    loadingPratica,
    onAnalisar,
    sugestao,
    loadingSugestao,
    onSugestao,
    onPraticarSugestao,
    duvidaInput,
    setDuvidaInput,
    respostaDuvida,
    loadingDuvida,
    onEnviarDuvida,
    onUsarResposta,
    provider,
    resultadoRef
}: DynamicResultAreaProps) {
    if (!modoAtivo) return null;

    const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

    const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');
    const contentRef = useRef<HTMLDivElement>(null);

    // Smoothly update height when content changes
    useEffect(() => {
        if (!contentRef.current) return;
        const observer = new ResizeObserver((entries) => {
            setContentHeight(entries[0].contentRect.height);
        });
        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [modoAtivo, loadingPratica, loadingSugestao, loadingDuvida]);

    return (
        <div ref={resultadoRef} className="mt-5">
            <motion.div
                initial={false}
                animate={{ height: contentHeight }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ overflow: 'hidden', position: 'relative' }}
            >
                <AnimatePresence mode="wait">
                    {/* 1. Modo Analisar */}
                    {modoAtivo === 'analisar' && (
                        <motion.div
                            key="analisar"
                            ref={contentRef}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute w-full top-0 left-0"
                        >
                            {loadingPratica ? (
                                <div className="text-center py-8">
                                    <AiLoader provider={provider} message="Avaliando sua resposta..." />
                                </div>
                            ) : analisePratica ? (
                                <div className="flex flex-col gap-3.5 pb-2.5">
                                    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-[18px] shadow-[var(--shadow-subtle)] flex flex-col gap-[14px] relative">
                                        <div className="absolute top-4 right-4">
                                            <ScoreBadge score={analisePratica.score || 0} />
                                        </div>
                                        <div className="pr-[60px]">
                                            <div
                                                className="font-bold text-[0.95em] mb-3"
                                                style={{ color: analisePratica.correto ? '#2ecc71' : '#e74c3c' }}
                                            >
                                                {analisePratica.correto ? '✨ Resposta adequada' : '⚠️ Precisa de revisão'}
                                            </div>
                                            {analisePratica.erros && analisePratica.erros.length > 0 && (
                                                <div className="mb-3.5">
                                                    <div className="text-[0.75em] font-bold opacity-60 uppercase mb-2">Pontos de Atenção (Erros)</div>
                                                    <div className="flex flex-col gap-2.5">
                                                        {analisePratica.erros.map((err: GrammarError, i: number) => (
                                                            <div key={i} className="flex flex-col gap-1.5 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                                                                <div className="flex items-center gap-2 flex-wrap text-sm">
                                                                    <span className="line-through text-red-500 bg-red-50/70 dark:bg-red-900/30 rounded px-1.5 font-mono text-sm">
                                                                        <InteractiveText text={err.trecho_errado} />
                                                                    </span>
                                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                    <span className="text-green-600 bg-green-50/90 dark:bg-green-900/40 rounded px-2 py-0.5 font-medium">
                                                                        <InteractiveText text={err.correcao} />
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                                                                    {err.regra_gramatical}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="bg-black/5 dark:bg-white/5 border-l-4 border-[var(--highlight-color)] p-3 px-[14px] rounded-r-lg text-[0.92em] leading-relaxed">
                                                <strong style={{ color: '#9b59b6' }}>Dica:</strong> <InteractiveText text={analisePratica.dica} />
                                            </div>
                                            {analisePratica.traducao_correta && (
                                                <div className="flex flex-col gap-1 mt-3">
                                                    <div className="text-[0.73em] font-bold opacity-55 uppercase mb-1 tracking-[0.5px]">Como soaria mais natural</div>
                                                    <div className="text-[1.2em] font-bold text-[#2ecc71]"><InteractiveText text={analisePratica.traducao_correta} /></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onUsarResposta(stripTags(analisePratica.traducao_correta || praticaInput))}
                                        className="bg-[var(--highlight-color)] text-white p-3 px-[22px] rounded-xl font-bold text-[0.92em] border-none cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 w-full hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                        style={{ background: '#9b59b6', boxShadow: '0 4px 12px rgba(155,89,182,0.25)' }}
                                    >
                                        <Play size={16} className="fill-current" />
                                        Usar {analisePratica.traducao_correta ? 'versão corrigida' : 'como resposta'}
                                    </button>
                                    <button
                                        onClick={onAnalisar}
                                        className="bg-white/[0.04] text-[var(--text-color)] border border-[var(--border-color)] p-2.5 px-[18px] rounded-xl font-semibold text-[0.88em] cursor-pointer transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:bg-white/[0.08] hover:-translate-y-0.5 self-start"
                                    >
                                        Analisar novamente
                                    </button>
                                </div>
                            ) : null}
                        </motion.div>
                    )}

                    {/* 2. Modo Sugestão */}
                    {modoAtivo === 'sugestao' && (
                        <motion.div
                            key="sugestao"
                            ref={contentRef}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute w-full top-0 left-0"
                        >
                            {loadingSugestao ? (
                                <div className="text-center py-8">
                                    <AiLoader provider={provider} message="Gerando sugestão de resposta..." />
                                </div>
                            ) : sugestao?.opcoes?.length > 0 ? (
                                <div className="flex flex-col gap-3.5 pb-2.5">
                                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Opções de Resposta sugeridas</div>
                                    <div className="flex flex-col gap-3">
                                        {sugestao.opcoes.map((opcao: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="bg-[rgba(46,204,113,0.05)] border border-[rgba(46,204,113,0.22)] rounded-xl p-[18px] flex flex-col gap-[11px] shadow-[var(--shadow-subtle)]"
                                                style={{ borderLeft: '4px solid #2ecc71', paddingLeft: '14px', paddingRight: '14px' }}
                                            >
                                                <div className="text-[0.73em] font-bold text-[#2ecc71] uppercase tracking-[0.5px] mb-1">
                                                    💡 {opcao.tom || 'Sugestão'}
                                                </div>
                                                <div className="text-[1.25em] font-bold my-1.5">
                                                    <InteractiveText text={opcao.sugestao_jp} />
                                                </div>
                                                <div className="text-[0.92em] opacity-85 pb-2 border-b border-[rgba(46,204,113,0.15)]">
                                                    {opcao.sugestao_pt}
                                                </div>
                                                <div className="flex gap-2 text-[0.88em] text-[#2ecc71] mt-2">
                                                    <MessageCircle size={14} className="shrink-0 mt-0.5" />
                                                    <span><InteractiveText text={opcao.dica} /></span>
                                                </div>
                                                
                                                {/* Action buttons inside each option card */}
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => onPraticarSugestao(opcao.sugestao_jp)}
                                                        className="bg-white/[0.04] text-[var(--text-color)] border border-[var(--border-color)] p-2 px-3 rounded-xl font-semibold text-[0.85em] cursor-pointer transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:bg-white/[0.08] hover:-translate-y-0.5 flex-1"
                                                        title="Copia para o campo de prática"
                                                    >
                                                        ✏️ Praticar
                                                    </button>
                                                    <button
                                                        onClick={() => onUsarResposta(stripTags(opcao.sugestao_jp))}
                                                        className="text-white p-2 px-3 rounded-xl font-semibold text-[0.85em] border-none cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 flex-1"
                                                        style={{ background: '#2ecc71' }}
                                                    >
                                                        <Check size={14} /> Usar Direto
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={onSugestao}
                                        className="bg-white/[0.04] text-[var(--text-color)] border border-[var(--border-color)] p-2.5 px-[18px] rounded-xl font-semibold text-[0.88em] cursor-pointer transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:bg-white/[0.08] hover:-translate-y-0.5 self-start mt-1"
                                    >
                                        Gerar outras sugestões
                                    </button>
                                </div>
                            ) : null}
                        </motion.div>
                    )}

                    {/* 3. Modo Dúvida */}
                    {modoAtivo === 'duvida' && (
                        <motion.div
                            key="duvida"
                            ref={contentRef}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute w-full top-0 left-0"
                        >
                            <div className="flex flex-col gap-3.5 pb-2.5">
                                <div className="text-[0.88em] text-[var(--text-muted)] mb-1">
                                    Pergunte sobre gramática, contexto ou vocabulário da fala atual.
                                </div>
                                <div className="flex gap-2.5 items-center">
                                    <input
                                        type="text"
                                        value={duvidaInput}
                                        onChange={e => setDuvidaInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && onEnviarDuvida()}
                                        placeholder="Qual é a sua dúvida?"
                                        className="flex-1 p-3 px-4 rounded-xl border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] text-[1.05em] outline-none transition-all duration-250 font-[inherit] focus:border-[var(--highlight-color)] focus:shadow-[0_0_0_3px_rgba(230,126,34,0.15)]"
                                        autoFocus
                                    />
                                    <button
                                        onClick={onEnviarDuvida}
                                        disabled={!duvidaInput.trim() || loadingDuvida}
                                        className="bg-[var(--highlight-color)] text-white p-3.5 px-5 rounded-xl font-bold text-[0.92em] border-none cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                        style={{ background: '#f39c12', boxShadow: '0 4px 12px rgba(243,156,18,0.2)' }}
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                                {loadingDuvida ? (
                                    <div className="text-center py-6">
                                        <AiLoader provider={provider} message="Pensando..." />
                                    </div>
                                ) : respostaDuvida ? (
                                    <div
                                        className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-3 px-3.5 transition-all duration-200 shadow-[var(--shadow-subtle)] flex flex-row gap-3 items-start hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] hover:border-[var(--highlight-color)]"
                                        style={{ borderLeft: '4px solid #f39c12' }}
                                    >
                                        <div className="p-2 bg-[rgba(243,156,18,0.1)] rounded-lg text-[#f39c12] shrink-0">
                                            <Book size={20} />
                                        </div>
                                        <div className="flex-1 leading-[1.65]">
                                            <InteractiveText text={respostaDuvida} />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
