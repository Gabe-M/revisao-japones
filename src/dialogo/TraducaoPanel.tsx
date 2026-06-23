import React, { useState, useEffect } from 'react';
import InteractiveText from '../components/InteractiveText';
import ScoreBadge from './components/ScoreBadge';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';

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
                    resposta_pt: resposta,
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
            traducao_correta: frase.frase_pt,
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
            <div style={{ padding: '20px' }}>
                <AiLoader 
                    provider={provider} 
                    message={`${provider.charAt(0).toUpperCase() + provider.slice(1)} está gerando sua Frase`} 
                />
            </div>
        );
    }
    if (!frase) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
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
                        <h2 style={{ color: 'var(--text-color)' }}>Ocorreu um erro ao carregar a Frase</h2>
                        <button 
                            onClick={() => carregarFrase(provider || context.provider || 'groq')} 
                            style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--highlight-color)', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                            Tentar Novamente
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>← Voltar ao Guia</button>
                <button onClick={onNext} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--highlight-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Ir para Diálogo →</button>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '16px', boxShadow: 'var(--shadow-subtle)', textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: 'gray', fontWeight: 'normal', fontSize: '1em' }}>Traduza esta frase para o português:</h3>
                
                <div style={{ fontSize: '2em', fontWeight: 'bold', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                    <InteractiveText text={frase.frase_jp} />
                    <button onClick={tocarAudio} style={{ border: 'none', fontSize: '1.2em', cursor: 'pointer', padding: '10px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)' }}>🔊</button>
                </div>

                <textarea 
                    value={resposta}
                    onChange={e => setResposta(e.target.value)}
                    placeholder="Sua tradução aqui..."
                    disabled={!!analise}
                    style={{ width: '100%', minHeight: '100px', padding: '15px', borderRadius: '12px', border: '2px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '1.1em', boxSizing: 'border-box', marginBottom: '15px', resize: 'vertical' }}
                />

                {!analise ? (
                    analisando ? (
                        <div style={{ marginTop: '20px' }}>
                            <AiLoader provider={provider} message={`${provider.charAt(0).toUpperCase() + provider.slice(1)} está analisando sua tradução`} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                            <button 
                                onClick={() => verificarTraducao(provider)} 
                                disabled={!resposta.trim()}
                                style={{ padding: '12px 30px', fontSize: '1.1em', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none', cursor: resposta.trim() ? 'pointer' : 'not-allowed', opacity: resposta.trim() ? 1 : 0.6, fontWeight: 'bold' }}
                            >
                                Verificar Tradução
                            </button>
                            <button 
                                onClick={revelarResposta}
                                style={{ padding: '12px 20px', fontSize: '1.1em', borderRadius: '8px', background: 'transparent', color: 'var(--secondary-color)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 'bold' }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                🤷 Revelar Resposta & Explicação
                            </button>
                        </div>
                    )
                ) : (
                    <div style={{ 
                        background: analise.revelado ? 'rgba(52, 152, 219, 0.08)' : (analise.correto ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)'), 
                        padding: '20px', 
                        borderRadius: '12px', 
                        border: `2px solid ${analise.revelado ? '#3498db' : (analise.correto ? '#2ecc71' : '#e74c3c')}`, 
                        textAlign: 'left', 
                        marginTop: '20px' 
                    }}>
                        {analise.revelado ? (
                            <div>
                                <h3 style={{ margin: 0, color: '#2980b9', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    💡 Resposta Revelada
                                </h3>
                                <p style={{ margin: '5px 0 15px 0', fontSize: '1.1em', fontWeight: 'bold' }}>Tradução correta: <span style={{ color: 'var(--text-color)', fontWeight: 600 }}><InteractiveText text={analise.traducao_correta} /></span></p>
                                
                                {analise.explicacao && (
                                    <div style={{ marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #3498db' }}>
                                        <strong>📖 Explicação Estrutural:</strong>
                                        <p style={{ margin: '8px 0 0 0', lineHeight: '1.5em', fontSize: '0.95em', whiteSpace: 'pre-line' }}><InteractiveText text={analise.explicacao} /></p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                                <ScoreBadge score={analise.score} />
                                <div>
                                    <h3 style={{ margin: 0, color: analise.correto ? '#27ae60' : '#c0392b' }}>
                                        {analise.correto ? 'Muito bem!' : 'Precisa melhorar'}
                                    </h3>
                                    <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Correção ideal: <InteractiveText text={analise.traducao_correta} /></p>
                                </div>
                            </div>
                        )}

                        {!analise.revelado && analise.erros && analise.erros.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                                <strong>Pontos de atenção:</strong>
                                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                                    {analise.erros.map((erro: string, i: number) => <li key={i}><InteractiveText text={erro} /></li>)}
                                </ul>
                            </div>
                        )}
                        
                        <div style={{ background: 'rgba(0,0,0,0.05)', padding: '10px', borderRadius: '8px', fontSize: '0.9em', marginBottom: '15px' }}>
                            <strong>💡 Dica Rápida:</strong> <InteractiveText text={analise.dica || frase.dica} />
                        </div>

                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <button onClick={() => carregarFrase(provider || context.provider || 'groq', true)} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--highlight-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Nova Frase</button>
                        </div>
                    </div>
                )}
            </div>

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
