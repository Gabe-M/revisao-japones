import React, { useState, useEffect, useRef } from 'react';
import InteractiveText from '../components/InteractiveText';
import ScoreBadge from './components/ScoreBadge';
import * as wanakana from 'wanakana';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';
import AjudaModal from './components/AjudaModal';

interface DialoGoPanelProps {
    context: any;
    session?: any;
    onBack: () => void;
    onUpdateContext: (data: Partial<any>) => void;
}

export default function DialoGoPanel({ context, session, onBack, onUpdateContext }: DialoGoPanelProps) {
    const [loading, setLoading] = useState(true);
    const [contextoDialogo, setContextoDialogo] = useState('');
    const [historico, setHistorico] = useState<any[]>([]);
    const [inputUser, setInputUser] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(context.provider || 'gemini');
    const [fallbackOpen, setFallbackOpen] = useState(false);
    const [fallbackError, setFallbackError] = useState('');
    const [pendingAction, setPendingAction] = useState<'iniciar' | 'continuar' | null>(null);
    const [pendingMessage, setPendingMessage] = useState('');
    const [ajudaModal, setAjudaModal] = useState<{isOpen: boolean, mensagem: string}>({isOpen: false, mensagem: ''});
    
    const inputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const stateRef = useRef({ contextoDialogo, historico, inputUser });
    useEffect(() => {
        stateRef.current = { contextoDialogo, historico, inputUser };
    }, [contextoDialogo, historico, inputUser]);

    useEffect(() => {
        if (context.dialogoDados) {
            setContextoDialogo(context.dialogoDados.contexto || '');
            setHistorico(context.dialogoDados.historico || []);
            setInputUser(context.dialogoDados.inputUser || '');
            setLoading(false);
        } else {
            iniciarDialogo(context.provider);
        }

        return () => {
            onUpdateContext({
                dialogoDados: {
                    contexto: stateRef.current.contextoDialogo,
                    historico: stateRef.current.historico,
                    inputUser: stateRef.current.inputUser
                }
            });
        };
    }, []);

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

    useEffect(() => {
        // Auto scroll to bottom
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [historico, enviando]);

    const iniciarDialogo = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = 'gemini') => {
        setLoading(true);
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
                    acao: 'iniciar_dialogo',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();
            
            setContextoDialogo(data.contexto);
            if (data.historico && data.historico.length > 0) {
                setHistorico(data.historico);
            } else {
                setHistorico([
                    {
                        role: 'assistant',
                        jp: data.mensagem_ia_jp,
                        pt: data.mensagem_ia_pt,
                        content: data.mensagem_ia_jp
                    }
                ]);
            }
        } catch (e: any) {
            console.error(e);
            if (targetProvider === 'gemini') {
                setPendingAction('iniciar');
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao iniciar diálogo com ${targetProvider}: ${e.message || e}`);
            }
        }
        setLoading(false);
    };

    const enviarMensagem = async (e?: React.FormEvent, targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = 'gemini', textToSend?: string) => {
        if (e) e.preventDefault();
        const textoJp = textToSend !== undefined ? textToSend : inputUser.trim();
        if (!textoJp) return;

        setEnviando(true);
        setProvider(targetProvider);
        if (textToSend === undefined) {
            setInputUser('');
        }
        
        // Add user message optimistically (only on first attempt, not retry)
        let novoHistorico = [...historico];
        if (textToSend === undefined) {
            novoHistorico.push({ role: 'user', content: textoJp, jp: textoJp });
            setHistorico(novoHistorico);
        }

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
                    acao: 'continuar_dialogo',
                    historico: novoHistorico.map(m => ({ role: m.role, content: m.content })),
                    resposta_usuario_jp: textoJp,
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();

            if (data.historico && data.historico.length > 0) {
                setHistorico(data.historico);
            } else {
                // Atualiza a ultima msg do user com a analise
                const updateHistorico = [...novoHistorico];
                updateHistorico[updateHistorico.length - 1].analise = data.analise;
                updateHistorico[updateHistorico.length - 1].score = data.score;
                
                // Adiciona a resposta da IA
                updateHistorico.push({
                    role: 'assistant',
                    jp: data.mensagem_ia_jp,
                    pt: data.mensagem_ia_pt,
                    content: data.mensagem_ia_jp
                });
                
                setHistorico(updateHistorico);
            }
        } catch (error: any) {
            console.error(error);
            if (targetProvider === 'gemini') {
                setPendingAction('continuar');
                setPendingMessage(textoJp);
                setFallbackError(error.message || String(error));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao enviar mensagem com ${targetProvider}: ${error.message || error}`);
                setInputUser(textoJp); // restore input
            }
        }
        setEnviando(false);
    };

    const tocarAudio = (texto: string) => {
        const textoPuro = texto
            .replace(/<rt>.*?<\/rt>/g, '')
            .replace(/<[^>]*>/g, '');
        
        const utterance = new SpeechSynthesisUtterance(textoPuro);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
    };

    if (loading) {
        return (
            <div style={{ padding: '20px' }}>
                <AiLoader 
                    provider={provider} 
                    message={provider === 'gemini' ? "O Gemini está preparando o Cenário" : "A OpenAI está preparando o Cenário"} 
                />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>← Voltar à Tradução</button>
                <h2 style={{ margin: 0 }}>Diálogo</h2>
                <div style={{ width: '130px' }}></div> {/* spacer for centering */}
            </div>

            {contextoDialogo && (
                <div style={{ background: 'var(--primary-color)', color: 'white', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9em' }}>
                    <strong>Cenário:</strong> {contextoDialogo}
                </div>
            )}

            <div style={{ flex: 1, background: 'var(--card-bg)', borderRadius: '16px', padding: '20px', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-subtle)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {historico.map((msg, i) => {
                    const isIA = msg.role === 'assistant';
                    return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isIA ? 'flex-start' : 'flex-end', width: '100%' }}>
                            <div style={{ 
                                maxWidth: '80%', 
                                padding: '15px', 
                                borderRadius: '16px', 
                                borderBottomLeftRadius: isIA ? 0 : '16px',
                                borderBottomRightRadius: isIA ? '16px' : 0,
                                background: isIA ? 'rgba(0,0,0,0.05)' : 'var(--highlight-color)', 
                                color: isIA ? 'var(--text-color)' : 'white' 
                            }}>
                                <div style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <InteractiveText text={msg.jp} />
                                    {isIA && (
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button onClick={() => tocarAudio(msg.jp)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'gray', padding: '5px' }} title="Ouvir">🔊</button>
                                            <button onClick={() => setAjudaModal({isOpen: true, mensagem: msg.jp})} style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', cursor: 'pointer', color: 'var(--text-color)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                💬 Ajuda
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isIA && msg.pt && (
                                    <details style={{ marginTop: '10px', fontSize: '0.9em', color: 'gray' }}>
                                        <summary style={{ cursor: 'pointer' }}>Tradução</summary>
                                        <p style={{ margin: '5px 0 0 0' }}><InteractiveText text={msg.pt} /></p>
                                    </details>
                                )}
                            </div>
                            
                            {/* Analysis box for user msg */}
                            {!isIA && msg.analise && (
                                <div style={{ maxWidth: '80%', marginTop: '10px', padding: '15px', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <ScoreBadge score={msg.score || 0} />
                                    <div style={{ fontSize: '0.9em' }}>
                                        <strong>Feedback do Sensei:</strong>
                                        <p style={{ margin: '5px 0 0 0' }}><InteractiveText text={msg.analise} /></p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {enviando && (
                    <div style={{ 
                        alignSelf: 'flex-start',
                        maxWidth: '80%', 
                        padding: '12px 18px', 
                        borderRadius: '16px', 
                        borderBottomLeftRadius: 0,
                        background: 'rgba(0,0,0,0.05)', 
                        color: 'var(--text-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <img 
                            src={provider === 'gemini' ? "https://cdnl.iconscout.com/lottie/premium/thumb/gemini-logo-animation-gif-download-10900314.gif" : "https://cdnl.iconscout.com/lottie/premium/thumb/chatgpt-animation-gif-download-6633794.gif"} 
                            alt={provider} 
                            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                        />
                        <span style={{ fontSize: '0.9em', fontStyle: 'italic', color: 'gray' }}>
                            {provider === 'gemini' ? "Gemini está digitando..." : "ChatGPT está digitando..."}
                        </span>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={(e) => enviarMensagem(e, 'gemini')} style={{ display: 'flex', gap: '10px' }}>
                <input 
                    ref={inputRef}
                    type="text" 
                    value={inputUser}
                    onChange={e => setInputUser(e.target.value)}
                    placeholder="Digite em romaji (será convertido para hiragana/katakana automaticamente)..."
                    disabled={enviando}
                    style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '2px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '1.1em' }}
                />
                <button 
                    type="submit" 
                    disabled={enviando || !inputUser.trim()}
                    style={{ padding: '0 30px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', border: 'none', fontSize: '1.1em', fontWeight: 'bold', cursor: enviando ? 'not-allowed' : 'pointer' }}
                >
                    Enviar
                </button>
            </form>

            <AiFallbackPopup 
                isOpen={fallbackOpen} 
                errorMessage={fallbackError}
                onRetryGemini={() => {
                    setFallbackOpen(false);
                    if (pendingAction === 'iniciar') iniciarDialogo('gemini');
                    else if (pendingAction === 'continuar') enviarMensagem(undefined, 'gemini', pendingMessage);
                }}
                onFallbackPollinations={() => {
                    setFallbackOpen(false);
                    if (pendingAction === 'iniciar') iniciarDialogo('pollinations');
                    else if (pendingAction === 'continuar') enviarMensagem(undefined, 'pollinations', pendingMessage);
                }}
                onCancel={() => setFallbackOpen(false)}
            />

            <AjudaModal
                isOpen={ajudaModal.isOpen}
                onClose={() => setAjudaModal({isOpen: false, mensagem: ''})}
                mensagem={ajudaModal.mensagem}
                context={context}
                onUsarResposta={(texto) => { setInputUser(texto); setAjudaModal({isOpen: false, mensagem: ''}); }}
            />
        </div>
    );
}
