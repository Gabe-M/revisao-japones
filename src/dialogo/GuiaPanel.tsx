import React, { useState, useEffect } from 'react';
import FuriganaText from './components/FuriganaText';
import VocabularioChip from './components/VocabularioChip';
import DraggableCard from './components/DraggableCard';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';

interface GuiaPanelProps {
    context: any;
    onNext: () => void;
    onBack: () => void;
}

export default function GuiaPanel({ context, onNext, onBack }: GuiaPanelProps) {
    const [loading, setLoading] = useState(true);
    const [dados, setDados] = useState<any>(null);
    const [activeCards, setActiveCards] = useState<any[]>([]);
    const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini');
    const [fallbackOpen, setFallbackOpen] = useState(false);
    const [fallbackError, setFallbackError] = useState('');

    const addCard = (newCard: any) => {
        setActiveCards(prev => {
            if (prev.some(c => c.item === newCard.item)) return prev;
            const next = [...prev, newCard];
            if (next.length > 5) next.shift();
            return next;
        });
    };

    const removeCard = (itemToRemove: string) => {
        setActiveCards(prev => prev.filter(c => c.item !== itemToRemove));
    };

    useEffect(() => {
        carregarGuia();
    }, []);

    const carregarGuia = async (targetProvider: 'gemini' | 'openai' = 'gemini') => {
        setLoading(true);
        setProvider(targetProvider);
        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) {
                headers['X-Gemini-Key'] = userKey;
            }

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    provider: targetProvider,
                    acao: 'gerar_guia',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco?.map((v:any) => v.item) || []
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();
            setDados(data);
        } catch (e: any) {
            console.error("Erro ao gerar guia", e);
            if (targetProvider === 'gemini') {
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao gerar o guia com a OpenAI: ${e.message || e}`);
            }
        }
        setLoading(false);
    };

    const adicionarAoBanco = async (item: any) => {
        try {
            await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        role: 'user', 
                        content: `Adicione a palavra ${item.item} (${item.leitura}) que significa "${item.significado}" da categoria Vocabulário para o conjunto Geral no JLPT ${item.jlpt || 'N5'}`
                    }]
                })
            });
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '20px' }}>
                <AiLoader 
                    provider={provider} 
                    message={provider === 'gemini' ? "O Gemini está gerando seu Guia de Estudos" : "A OpenAI está gerando seu Guia de Estudos"} 
                />
            </div>
        );
    }

    if (!dados) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
                {fallbackOpen ? (
                    <AiFallbackPopup 
                        isOpen={fallbackOpen} 
                        errorMessage={fallbackError}
                        onRetryGemini={() => {
                            setFallbackOpen(false);
                            carregarGuia('gemini');
                        }}
                        onFallbackOpenAI={() => {
                            setFallbackOpen(false);
                            carregarGuia('openai');
                        }}
                        onCancel={() => setFallbackOpen(false)}
                    />
                ) : (
                    <div>
                        <h2 style={{ color: 'var(--text-color)' }}>Ocorreu um erro ao gerar o Guia</h2>
                        <button 
                            onClick={() => carregarGuia('gemini')} 
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
                <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>← Voltar</button>
                <h2 style={{ margin: 0 }}>Guia: {context.tema}</h2>
                <button onClick={onNext} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--highlight-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Praticar Tradução →</button>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>📚 Vocabulário Chave</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                    {dados.vocabulario?.map((v: any, i: number) => {
                        const jaPossui = context.vocabularioBanco.some((b:any) => b.item === v.item);
                        return (
                            <VocabularioChip 
                                key={i}
                                item={v.item}
                                leitura={v.leitura}
                                significado={v.significado}
                                jlpt={v.jlpt}
                                jaPossui={jaPossui}
                                onAdd={() => adicionarAoBanco(v)}
                                onClickCard={() => addCard({ ...v, tipo: 'Vocabulário' })}
                            />
                        );
                    })}
                </div>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>🧠 Regras Gramaticais Úteis</h3>
                {dados.regras?.map((r: any, i: number) => (
                    <div 
                        key={i} 
                        style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: i < dados.regras.length - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', transition: 'background 0.2s', borderRadius: '8px', padding: '10px' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => addCard({ item: r.exemplo_jp, leitura: '', significado: r.exemplo_pt, tipo: 'Regra/Exemplo' })}
                    >
                        <strong style={{ fontSize: '1.1em' }}>{r.titulo}</strong>
                        <p style={{ margin: '8px 0' }}>{r.explicacao}</p>
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2em' }}><FuriganaText text={r.exemplo_jp} /></div>
                            <div style={{ color: 'gray', fontSize: '0.9em' }}>{r.exemplo_pt}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>💬 Frases Prontas</h3>
                {dados.frases_uteis?.map((f: any, i: number) => (
                    <div 
                        key={i} 
                        style={{ marginBottom: '10px', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                        onClick={() => addCard({ item: f.jp, leitura: '', significado: f.pt, tipo: 'Frase Pronta' })}
                    >
                        <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}><FuriganaText text={f.jp} /></div>
                        <div style={{ color: 'gray' }}>{f.pt}</div>
                    </div>
                ))}
            </div>

            {activeCards.map((card, index) => (
                <DraggableCard 
                    key={card.item}
                    card={card}
                    initialIndex={index}
                    onClose={() => removeCard(card.item)}
                />
            ))}

            <AiFallbackPopup 
                isOpen={fallbackOpen} 
                errorMessage={fallbackError}
                onRetryGemini={() => {
                    setFallbackOpen(false);
                    carregarGuia('gemini');
                }}
                onFallbackOpenAI={() => {
                    setFallbackOpen(false);
                    carregarGuia('openai');
                }}
                onCancel={() => setFallbackOpen(false)}
            />
        </div>
    );
}
