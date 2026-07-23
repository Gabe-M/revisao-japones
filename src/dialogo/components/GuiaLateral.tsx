import React, { useState, useEffect, useCallback } from 'react';
import InteractiveText from '../../components/InteractiveText';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface GuiaLateralProps {
    context: any;
    session?: any;
    /** Whether the panel is open */
    isOpen: boolean;
    /** Called when the user clicks the toggle button */
    onToggle: () => void;
}

const normalizarVocabulario = (vocab: any) => {
    if (!Array.isArray(vocab) || vocab.length === 0) return [];
    if (vocab[0]?.categoria) return vocab;
    return [{ categoria: 'Vocabulário', termos: vocab }];
};

export default function GuiaLateral({ context, session, isOpen, onToggle }: GuiaLateralProps) {
    const [dados, setDados] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Sections open/close state
    const [regrasOpen, setRegrasOpen] = useState(true);
    const [vocabOpen, setVocabOpen] = useState(true);
    const [frasesOpen, setFrasesOpen] = useState(false);

    const carregarGuia = useCallback(async () => {
        if (dados) return; // already loaded
        setLoading(true);
        setErro('');
        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) headers['X-Gemini-Key'] = userKey;
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    provider: context.provider || 'groq',
                    acao: 'gerar_guia',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setDados(data);
        } catch (e: any) {
            console.error('GuiaLateral: erro ao carregar guia', e);
            setErro(e.message || String(e));
        }
        setLoading(false);
    }, [context, session, dados]);

    // Load guide when panel opens for the first time
    useEffect(() => {
        if (isOpen && !dados && !loading) {
            carregarGuia();
        }
    }, [isOpen]);

    const vocabCategorias = normalizarVocabulario(
        dados?.vocabulario_chave || dados?.vocabulario || []
    );

    const allTerms = vocabCategorias.flatMap((cat: any) =>
        (cat.termos || []).map((t: any) => ({ ...t, _cat: cat.categoria }))
    );

    return (
        <>
            {/* ── Toggle button (always visible, even when closed) ── */}
            <button
                onClick={onToggle}
                title={isOpen ? 'Fechar Guia' : 'Abrir Guia da Sessão'}
                className={[
                    'fixed z-40 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1',
                    'w-9 h-28 rounded-l-xl border border-r-0 border-border bg-card shadow-lg',
                    'text-primary font-bold text-[0.65em] leading-tight transition-all duration-300',
                    'hover:bg-accent hover:text-accent-foreground select-none',
                    isOpen ? 'right-[340px]' : 'right-0'
                ].join(' ')}
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
                <span className="text-base">📖</span>
                <span>{isOpen ? '◀ Fechar' : 'Guia ▶'}</span>
            </button>

            {/* ── Side panel ── */}
            <div
                className={[
                    'fixed right-0 top-0 h-full z-30 flex flex-col',
                    'bg-card border-l border-border shadow-2xl',
                    'transition-all duration-300 ease-in-out',
                    isOpen ? 'w-[340px] pointer-events-auto' : 'w-0 pointer-events-none overflow-hidden'
                ].join(' ')}
                style={{ opacity: isOpen ? 1 : 0 }}
                aria-hidden={!isOpen}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-primary/5">
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground text-[0.95em]">📖 Guia da Sessão</span>
                        <span className="text-muted-foreground text-[0.75em]">{context.tema}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Fechar"
                    >
                        ✕
                    </Button>
                </div>

                {/* Body */}
                <ScrollArea className="flex-1 min-h-0 w-full">
                    <div className="p-4 flex flex-col gap-4 pb-8">

                        {loading && (
                            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                                <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                <span className="text-sm">Carregando guia...</span>
                            </div>
                        )}

                        {erro && !loading && (
                            <div className="flex flex-col gap-2 items-center py-6 text-center">
                                <p className="text-destructive text-sm">{erro}</p>
                                <Button variant="outline" size="sm" onClick={() => { setDados(null); carregarGuia(); }}>
                                    Tentar Novamente
                                </Button>
                            </div>
                        )}

                        {dados && !loading && (
                            <>
                                {/* ── Regras Gramaticais ── */}
                                {Array.isArray(dados.regras) && dados.regras.length > 0 && (
                                    <section>
                                        <button
                                            onClick={() => setRegrasOpen(v => !v)}
                                            className="w-full flex justify-between items-center text-left font-bold text-primary text-[0.9em] mb-2 hover:opacity-80 transition-opacity"
                                        >
                                            <span>🧠 Regras Gramaticais</span>
                                            <span className="text-xs transition-transform duration-200" style={{ transform: regrasOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                        </button>
                                        <div
                                            className="overflow-hidden transition-all duration-300"
                                            style={{ maxHeight: regrasOpen ? '9999px' : '0px', opacity: regrasOpen ? 1 : 0 }}
                                        >
                                            <div className="flex flex-col gap-3">
                                                {dados.regras.map((r: any, i: number) => (
                                                    <div key={i} className="rounded-xl border border-border bg-background p-3 text-[0.85em]">
                                                        <div className="font-semibold text-foreground mb-1">
                                                            <InteractiveText text={r.titulo} />
                                                        </div>
                                                        <div className="text-muted-foreground leading-relaxed mb-2">
                                                            <InteractiveText text={r.explicacao} />
                                                        </div>
                                                        {r.exemplo_jp && (
                                                            <div className="bg-primary/5 rounded-lg p-2 border-l-2 border-primary">
                                                                <div className="text-[1.05em] text-foreground">
                                                                    <InteractiveText text={r.exemplo_jp} />
                                                                </div>
                                                                {r.exemplo_pt && (
                                                                    <div className="text-muted-foreground text-[0.9em] mt-0.5">
                                                                        <InteractiveText text={r.exemplo_pt} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* ── Vocabulário Chave ── */}
                                {allTerms.length > 0 && (
                                    <section>
                                        <button
                                            onClick={() => setVocabOpen(v => !v)}
                                            className="w-full flex justify-between items-center text-left font-bold text-primary text-[0.9em] mb-2 hover:opacity-80 transition-opacity"
                                        >
                                            <span>📚 Vocabulário ({allTerms.length})</span>
                                            <span className="text-xs transition-transform duration-200" style={{ transform: vocabOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                        </button>
                                        <div
                                            className="overflow-hidden transition-all duration-300"
                                            style={{ maxHeight: vocabOpen ? '9999px' : '0px', opacity: vocabOpen ? 1 : 0 }}
                                        >
                                            <div className="flex flex-wrap gap-2">
                                                {allTerms.map((t: any, i: number) => {
                                                    const jp = t.termo || t.item || '';
                                                    const leit = t.leitura || '';
                                                    const trad = t.traducao || t.significado || '';
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="group relative flex flex-col items-center bg-background border border-border rounded-xl px-2.5 py-1.5 cursor-default hover:border-primary hover:bg-primary/5 transition-all"
                                                            title={`${leit} — ${trad}`}
                                                        >
                                                            <span className="text-foreground font-semibold text-[0.9em] leading-tight">
                                                                <InteractiveText text={jp} />
                                                            </span>
                                                            {leit && (
                                                                <span className="text-muted-foreground text-[0.7em] leading-none">
                                                                    {leit}
                                                                </span>
                                                            )}
                                                            {/* Tooltip on hover */}
                                                            {trad && (
                                                                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-foreground text-background text-[0.72em] font-medium rounded-lg px-2 py-1 whitespace-nowrap shadow-md z-50 pointer-events-none">
                                                                    {trad}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-foreground" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* ── Frases Úteis ── */}
                                {Array.isArray(dados.frases_uteis) && dados.frases_uteis.length > 0 && (
                                    <section>
                                        <button
                                            onClick={() => setFrasesOpen(v => !v)}
                                            className="w-full flex justify-between items-center text-left font-bold text-primary text-[0.9em] mb-2 hover:opacity-80 transition-opacity"
                                        >
                                            <span>💬 Frases Úteis</span>
                                            <span className="text-xs transition-transform duration-200" style={{ transform: frasesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                        </button>
                                        <div
                                            className="overflow-hidden transition-all duration-300"
                                            style={{ maxHeight: frasesOpen ? '9999px' : '0px', opacity: frasesOpen ? 1 : 0 }}
                                        >
                                            <div className="flex flex-col gap-2">
                                                {dados.frases_uteis.map((f: any, i: number) => (
                                                    <div key={i} className="rounded-xl border border-border bg-background p-3 text-[0.85em]">
                                                        <div className="text-[1.05em] font-semibold text-foreground">
                                                            <InteractiveText text={f.jp} />
                                                        </div>
                                                        {f.pt && (
                                                            <div className="text-muted-foreground text-[0.85em] mt-0.5">
                                                                {f.pt}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Backdrop overlay (mobile) */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px] sm:hidden"
                    onClick={onToggle}
                />
            )}
        </>
    );
}
