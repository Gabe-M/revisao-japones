import React, { useState, useEffect, useRef } from 'react';
import FuriganaText from './components/FuriganaText';
import ScoreBadge from './components/ScoreBadge';
import * as wanakana from 'wanakana';

interface DialoGoPanelProps {
    context: any;
    onBack: () => void;
}

export default function DialoGoPanel({ context, onBack }: DialoGoPanelProps) {
    const [loading, setLoading] = useState(true);
    const [contextoDialogo, setContextoDialogo] = useState('');
    const [historico, setHistorico] = useState<any[]>([]);
    const [inputUser, setInputUser] = useState('');
    const [enviando, setEnviando] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        iniciarDialogo();
        
        // Ativar wanakana se o input existir
        if (inputRef.current) {
            wanakana.bind(inputRef.current);
        }
        return () => {
            if (inputRef.current) wanakana.unbind(inputRef.current);
        };
    }, []);

    useEffect(() => {
        // Auto scroll to bottom
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [historico, enviando]);

    const iniciarDialogo = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: 'iniciar_dialogo',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco?.map((v:any) => v.item) || []
                })
            });
            const data = await res.json();
            
            setContextoDialogo(data.contexto);
            setHistorico([
                {
                    role: 'assistant',
                    jp: data.mensagem_ia_jp,
                    pt: data.mensagem_ia_pt,
                    content: data.mensagem_ia_jp
                }
            ]);
        } catch (e) {
            console.error(e);
            alert("Erro ao iniciar diálogo.");
        }
        setLoading(false);
    };

    const enviarMensagem = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const textoJp = inputUser.trim();
        if (!textoJp) return;

        setEnviando(true);
        setInputUser('');
        
        // Add user message optimistically
        const novoHistorico = [...historico, { role: 'user', content: textoJp, jp: textoJp }];
        setHistorico(novoHistorico);

        try {
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: 'continuar_dialogo',
                    historico: historico.map(m => ({ role: m.role, content: m.content })),
                    resposta_usuario_jp: textoJp
                })
            });
            const data = await res.json();

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
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar mensagem.");
            setInputUser(textoJp); // restore input
            setHistorico(historico); // revert
        }
        setEnviando(false);
    };

    const tocarAudio = (texto: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = texto;
        const textoPuro = tempDiv.textContent || tempDiv.innerText || "";
        
        const utterance = new SpeechSynthesisUtterance(textoPuro);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Preparando cenário do diálogo... ⏳</div>;

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
                                <div style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FuriganaText text={msg.jp} />
                                    {isIA && (
                                        <button onClick={() => tocarAudio(msg.jp)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'gray' }}>🔊</button>
                                    )}
                                </div>
                                {isIA && msg.pt && (
                                    <details style={{ marginTop: '10px', fontSize: '0.9em', color: 'gray' }}>
                                        <summary style={{ cursor: 'pointer' }}>Tradução</summary>
                                        <p style={{ margin: '5px 0 0 0' }}>{msg.pt}</p>
                                    </details>
                                )}
                            </div>
                            
                            {/* Analysis box for user msg */}
                            {!isIA && msg.analise && (
                                <div style={{ maxWidth: '80%', marginTop: '10px', padding: '15px', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <ScoreBadge score={msg.score || 0} />
                                    <div style={{ fontSize: '0.9em' }}>
                                        <strong>Feedback do Sensei:</strong>
                                        <p style={{ margin: '5px 0 0 0' }}>{msg.analise}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {enviando && <div style={{ fontStyle: 'italic', color: 'gray' }}>A IA está digitando...</div>}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={enviarMensagem} style={{ display: 'flex', gap: '10px' }}>
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
        </div>
    );
}
