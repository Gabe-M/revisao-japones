import React, { useState, useEffect } from 'react';
import InteractiveText from '../components/InteractiveText';
import ScoreBadge from './components/ScoreBadge';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import KanaKanjiInput from './components/KanaKanjiInput';

interface TraducaoPanelProps {
    context: any;
    session?: any;
    onNext: () => void;
    onBack: () => void;
    onUpdateContext: (data: Partial<any>) => void;
}

export default function TraducaoPanel({ context, session, onNext, onBack, onUpdateContext }: TraducaoPanelProps) {
    const [loading, setLoading] = useState(true);
    const [frase, setFrase] = useState<any>(null);
    const [resposta, setResposta] = useState('');
    const [analise, setAnalise] = useState<any>(null);
    const [analisando, setAnalisando] = useState(false);
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(context.provider || (localStorage.getItem('selected_provider') as any) || 'groq');
    const [fallbackOpen, setFallbackOpen] = useState(false);
    const [fallbackError, setFallbackError] = useState('');
    const [pendingAction, setPendingAction] = useState<'carregar' | 'analisar' | null>(null);
    const [direcao, setDirecao] = useState<'jp_pt' | 'pt_jp'>((localStorage.getItem('direcao_traducao') as any) || 'jp_pt');

    const stateRef = React.useRef({ frase, resposta, analise });
    useEffect(() => {
        stateRef.current = { frase, resposta, analise };
    }, [frase, resposta, analise]);

    useEffect(() => {
        if (context.traducaoDados) {
            setFrase(context.traducaoDados.frase);
            setResposta(context.traducaoDados.resposta || '');
            setAnalise(context.traducaoDados.analise || null);
            setLoading(false);
        } else {
            carregarFrase(context.provider, false);
        }

        return () => {
            onUpdateContext({
                traducaoDados: {
                    frase: stateRef.current.frase,
                    resposta: stateRef.current.resposta,
                    analise: stateRef.current.analise
                }
            });
        };
    }, []);

    const carregarFrase = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = context.provider || 'groq', isNew: boolean = false) => {
        setLoading(true);
        setProvider(targetProvider);
        setAnalise(null);
        setResposta('');
        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) {
                headers['X-Gemini-Key'] = userKey;
            }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    provider: targetProvider,
                    acao: 'gerar_traducao',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId,
                    novaFrase: isNew
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();
            setFrase(data);
            if (data.resposta_aluno) {
                setResposta(data.resposta_aluno);
            }
            if (data.analise) {
                setAnalise(data.analise);
            }
        } catch (e: any) {
            console.error(e);
            if (targetProvider === 'gemini') {
                setPendingAction('carregar');
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao buscar frase para tradução com ${targetProvider}: ${e.message || e}`);
            }
        }
        setLoading(false);
    };

    const verificarTraducao = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = context.provider || 'groq') => {
        if (!resposta.trim()) return;
        setAnalisando(true);
        setProvider(targetProvider);
        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) {
                headers['X-Gemini-Key'] = userKey;
            }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    provider: targetProvider,
                    acao: 'analisar_traducao',
                    frase_jp: frase.frase_jp,
                    frase_pt: frase.frase_pt,
                    resposta_pt: resposta,
                    direcao: direcao,
                    sessionId: context.sessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();
            setAnalise(data);
        } catch (e: any) {
            console.error(e);
            if (targetProvider === 'gemini') {
                setPendingAction('analisar');
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao analisar a tradução com ${targetProvider}: ${e.message || e}`);
            }
        }
        setAnalisando(false);
    };

    const tocarAudio = () => {
        if (!frase?.frase_jp) return;
        const textoPuro = frase.frase_jp
            .replace(/<rt>.*?<\/rt>/g, '')
            .replace(/<[^>]*>/g, '');
        
        const utterance = new SpeechSynthesisUtterance(textoPuro);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const revelarResposta = async () => {
        if (!frase) return;
        const mockAnalise = {
            revelado: true,
            correto: false,
            score: 0,
            traducao_correta: direcao === 'pt_jp' ? frase.frase_jp : frase.frase_pt,
            explicacao: frase.explicacao || 'Nenhuma explicação detalhada disponível.',
            dica: frase.dica,
            erros: []
        };
        setAnalise(mockAnalise);

        if (session && context.sessionId) {
            try {
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (session.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }
                await fetch('/api/dialogo', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        acao: 'salvar_traducao_dados',
                        sessionId: context.sessionId,
                        traducao_dados: {
                            ...frase,
                            resposta_aluno: resposta,
                            analise: mockAnalise
                        }
                    })
                });
            } catch (e) {
                console.error("Erro ao salvar revelação da tradução no banco:", e);
            }
        }
    };

    if (loading) {
        return (
            <div className="p-5">
                <AiLoader 
                    provider={provider} 
                    message={`${provider.charAt(0).toUpperCase() + provider.slice(1)} está gerando sua Frase`} 
                />
            </div>
        );
    }

    if (!frase) {
        return (
            <div className="max-w-[800px] mx-auto p-5 text-center">
                {fallbackOpen ? (
                    <AiFallbackPopup 
                        isOpen={fallbackOpen} 
                        errorMessage={fallbackError}
                        onRetryGemini={() => {
                            setFallbackOpen(false);
                            if (pendingAction === 'carregar') carregarFrase(provider || context.provider || 'groq');
                            else if (pendingAction === 'analisar') verificarTraducao(provider || context.provider || 'groq');
                        }}
                        onFallbackPollinations={() => {
                            setFallbackOpen(false);
                            if (pendingAction === 'carregar') carregarFrase('pollinations');
                            else if (pendingAction === 'analisar') verificarTraducao('pollinations');
                        }}
                        onCancel={() => setFallbackOpen(false)}
                    />
                ) : (
                    <div>
                        <h2 className="text-foreground">Ocorreu um erro ao carregar a Frase</h2>
                        <Button 
                            onClick={() => carregarFrase(provider || context.provider || 'groq')}
                            className="mt-4"
                        >
                            Tentar Novamente
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-[800px] mx-auto">
            {/* Top navigation */}
            <div className="flex justify-between items-center mb-5">
                <Button variant="outline" onClick={onBack}>← Voltar ao Guia</Button>
                <Button onClick={onNext} className="font-bold">Ir para Diálogo →</Button>
            </div>

            {/* Card de tradução */}
            <Card className="mb-5">
                <CardContent className="p-7 text-center">
                    {/* Direção da Tradução */}
                    <div className="flex justify-center gap-2 mb-6 bg-black/[0.03] dark:bg-white/[0.03] p-1.5 rounded-xl w-fit mx-auto border border-border/40">
                        <Button 
                            variant={direcao === 'jp_pt' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => {
                                setDirecao('jp_pt');
                                localStorage.setItem('direcao_traducao', 'jp_pt');
                                setResposta('');
                                setAnalise(null);
                            }}
                            className="rounded-lg font-semibold text-xs py-1.5 h-auto"
                        >
                            🇯🇵 ➔ 🇧🇷 Japonês para Português
                        </Button>
                        <Button 
                            variant={direcao === 'pt_jp' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => {
                                setDirecao('pt_jp');
                                localStorage.setItem('direcao_traducao', 'pt_jp');
                                setResposta('');
                                setAnalise(null);
                            }}
                            className="rounded-lg font-semibold text-xs py-1.5 h-auto"
                        >
                            🇧🇷 ➔ 🇯🇵 Português para Japonês
                        </Button>
                    </div>

                    <h3 className="mt-0 text-muted-foreground font-normal text-[1em]">
                        {direcao === 'jp_pt' ? 'Traduza esta frase para o português:' : 'Traduza esta frase para o japonês:'}
                    </h3>

                    <div className="text-[2em] font-bold my-5 flex items-center justify-center gap-4 flex-wrap">
                        {direcao === 'jp_pt' ? (
                            <>
                                <InteractiveText text={frase.frase_jp} />
                                <button
                                    onClick={tocarAudio}
                                    className="border-none text-[1.2em] cursor-pointer p-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.05] hover:bg-black/[0.1] dark:hover:bg-white/[0.1] transition-colors flex items-center justify-center w-12 h-12"
                                    title="Ouvir Japonês"
                                >
                                    🔊
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[0.7em] font-semibold text-foreground px-4 py-2 bg-black/[0.01] dark:bg-white/[0.01] rounded-xl leading-relaxed">
                                    {frase.frase_pt}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={tocarAudio}
                                    className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1.5"
                                >
                                    🔊 Ouvir áudio de referência
                                </Button>
                            </div>
                        )}
                    </div>

                    {direcao === 'jp_pt' ? (
                        <textarea
                            value={resposta}
                            onChange={e => setResposta(e.target.value)}
                            placeholder="Sua tradução para o português aqui..."
                            disabled={!!analise}
                            className="w-full min-h-[100px] p-4 rounded-xl border-2 border-border bg-background text-foreground text-[1.1em] box-border mb-4 resize-y outline-none transition-all focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                    ) : (
                        <div className="text-left w-full mb-4">
                            <KanaKanjiInput
                                value={resposta}
                                onChange={setResposta}
                                placeholder="Digite em romaji... Espaço para Kanji/Katakana"
                                disabled={!!analise}
                                className="text-[1.1em] h-14 bg-background text-foreground border-2 border-border focus:border-primary"
                                onSendMessage={() => {
                                    if (resposta.trim() && !analisando && !analise) {
                                        verificarTraducao(provider);
                                    }
                                }}
                            />
                        </div>
                    )}

                    {!analise ? (
                        analisando ? (
                            <div className="mt-5">
                                <AiLoader provider={provider} message={`${provider.charAt(0).toUpperCase() + provider.slice(1)} está analisando sua tradução`} />
                            </div>
                        ) : (
                            <div className="flex justify-center gap-4 flex-wrap">
                                <Button
                                    onClick={() => verificarTraducao(provider)}
                                    disabled={!resposta.trim()}
                                    className="px-8 py-3 text-[1.1em] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    Verificar Tradução
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={revelarResposta}
                                    className="px-5 py-3 text-[1.1em] font-bold"
                                >
                                    🤷 Revelar Resposta & Explicação
                                </Button>
                            </div>
                        )
                    ) : (
                        <div className={[
                            'rounded-xl border-2 p-5 text-left mt-5',
                            analise.revelado
                                ? 'bg-blue-500/[0.08] border-blue-500'
                                : analise.correto
                                    ? 'bg-green-500/10 border-green-500'
                                    : 'bg-red-500/10 border-red-500'
                        ].join(' ')}>
                            {analise.revelado ? (
                                <div>
                                    <h3 className="m-0 text-blue-500 mb-2.5 flex items-center gap-2 font-bold">
                                        💡 Resposta Revelada
                                    </h3>
                                    <p className="my-1 mb-4 text-[1.1em] font-bold">
                                        Tradução correta:{' '}
                                        <span className="text-foreground font-semibold">
                                            <InteractiveText text={analise.traducao_correta} />
                                        </span>
                                    </p>
                                    {analise.explicacao && (
                                        <div className="mb-4 bg-black/[0.02] p-4 rounded-lg border-l-[3px] border-blue-500">
                                            <strong>📖 Explicação Estrutural:</strong>
                                            <p className="mt-2 mb-0 leading-relaxed text-[0.95em] whitespace-pre-line">
                                                <InteractiveText text={analise.explicacao} />
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-5 mb-4">
                                    <ScoreBadge score={analise.score} />
                                    <div>
                                        <h3 className={['m-0 font-bold', analise.correto ? 'text-green-600' : 'text-red-600'].join(' ')}>
                                            {analise.correto ? 'Muito bem!' : 'Precisa melhorar'}
                                        </h3>
                                        <p className="mt-1.5 mb-0 font-bold">
                                            Correção ideal: <InteractiveText text={analise.traducao_correta} />
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!analise.revelado && analise.erros && analise.erros.length > 0 && (
                                <div className="mb-2.5">
                                    <strong>Pontos de atenção:</strong>
                                    <ul className="mt-1 mb-0 pl-5">
                                        {analise.erros.map((erro: string, i: number) => <li key={i}>{erro}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="bg-black/[0.05] p-2.5 rounded-lg text-[0.9em] mb-4">
                                <strong>💡 Dica Rápida:</strong>{' '}
                                <InteractiveText text={analise.dica || frase.dica} />
                            </div>

                            <div className="mt-5 text-center">
                                <Button
                                    onClick={() => carregarFrase(provider || context.provider || 'groq', true)}
                                    className="font-bold"
                                >
                                    Nova Frase
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AiFallbackPopup 
                isOpen={fallbackOpen} 
                errorMessage={fallbackError}
                onRetryGemini={() => {
                    setFallbackOpen(false);
                    if (pendingAction === 'carregar') carregarFrase(provider || context.provider || 'groq');
                    else if (pendingAction === 'analisar') verificarTraducao(provider || context.provider || 'groq');
                }}
                onFallbackPollinations={() => {
                    setFallbackOpen(false);
                    if (pendingAction === 'carregar') carregarFrase('pollinations');
                    else if (pendingAction === 'analisar') verificarTraducao('pollinations');
                }}
                onCancel={() => setFallbackOpen(false)}
            />
        </div>
    );
}
