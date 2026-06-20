import React, { useState, useEffect } from 'react';
import InteractiveText from '../components/InteractiveText';
import VocabularioChip from './components/VocabularioChip';
import DraggableCard from './components/DraggableCard';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';

interface GuiaPanelProps {
    context: any;
    session?: any;
    onNext: () => void;
    onBack: () => void;
}

export default function GuiaPanel({ context, session, onNext, onBack }: GuiaPanelProps) {
    const [loading, setLoading] = useState(true);
    const [dados, setDados] = useState<any>(null);
    const [activeCards, setActiveCards] = useState<any[]>([]);
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(context.provider || 'gemini');
    const [fallbackOpen, setFallbackOpen] = useState(false);
    const [fallbackError, setFallbackError] = useState('');
    const [isVocabOpen, setIsVocabOpen] = useState(true);

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

    const handleWordClick = (word: string, leitura: string, fraseOriginal?: string) => {
        let item = word.trim();
        let reading = leitura.trim();
        if (!item) return;

        const foundVocab = 
            dados?.vocabulario?.find((v: any) => v.item === item) ||
            context.vocabularioBanco?.find((b: any) => b.item === item);
        
        if (foundVocab) {
            addCard({
                item: foundVocab.item,
                leitura: foundVocab.leitura || reading,
                significado: foundVocab.significado,
                jlpt: foundVocab.jlpt,
                tipo: 'Vocabulário',
                fraseOriginal: fraseOriginal || ''
            });
        } else {
            const tempCardId = item;
            addCard({
                item: item,
                leitura: reading,
                significado: 'Buscando significado...',
                tipo: 'Dicionário',
                fraseOriginal: fraseOriginal || ''
            });
            
            fetch(`/api/jisho?termo=${encodeURIComponent(item)}`)
                .then(res => res.json())
                .then(apiData => {
                    const def = apiData?.data?.[0]?.senses?.[0]?.english_definitions;
                    const meaning = def ? def.join(', ') : 'Significado não encontrado';
                    
                    setActiveCards(prev => prev.map(c => 
                        c.item === tempCardId 
                            ? { ...c, significado: meaning } 
                            : c
                    ));
                })
                .catch(err => {
                    console.error(err);
                    setActiveCards(prev => prev.map(c => 
                        c.item === tempCardId 
                            ? { ...c, significado: 'Erro ao buscar significado.' } 
                            : c
                    ));
                });
        }
    };

    const handleTermClick = (e: React.MouseEvent, fallbackCard: any, fraseOriginal?: string) => {
        const rubyElement = (e.target as HTMLElement).closest('ruby');
        if (rubyElement) {
            e.stopPropagation();
            
            let item = '';
            let leitura = '';
            
            rubyElement.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    item += node.textContent || '';
                } else if (node.nodeName.toLowerCase() === 'rt') {
                    leitura += node.textContent || '';
                } else {
                    item += node.textContent || '';
                }
            });
            
            handleWordClick(item, leitura, fraseOriginal);
        } else {
            addCard({ ...fallbackCard, fraseOriginal });
        }
    };

    useEffect(() => {
        carregarGuia(context.provider);
    }, []);

    const carregarGuia = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = 'gemini') => {
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
                    acao: 'gerar_guia',
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
            setDados(data);
        } catch (e: any) {
            console.error("Erro ao gerar guia", e);
            if (targetProvider === 'gemini') {
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao gerar o guia com ${targetProvider}: ${e.message || e}`);
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
                        onFallbackPollinations={() => {
                            setFallbackOpen(false);
                            carregarGuia('pollinations');
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
                <div 
                    onClick={() => setIsVocabOpen(!isVocabOpen)}
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        userSelect: 'none',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        margin: '-4px -8px',
                        transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <h3 style={{ margin: 0, color: 'var(--highlight-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📚 Vocabulário Chave
                    </h3>
                    <div style={{ 
                        transform: isVocabOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.03)',
                        color: 'var(--highlight-color)',
                        fontWeight: 'bold'
                    }}>
                        ▼
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateRows: isVocabOpen ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: isVocabOpen ? 1 : 0,
                    overflow: 'hidden'
                }}>
                    <div style={{ minHeight: 0 }}>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                            gap: '10px',
                            paddingTop: '15px'
                        }}>
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
                </div>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>🧠 Regras Gramaticais Úteis</h3>
                {dados.regras?.map((r: any, i: number) => (
                    <div 
                        key={i} 
                        style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: i < dados.regras.length - 1 ? '1px solid var(--border-color)' : 'none', borderRadius: '8px', padding: '10px' }}
                    >
                        <strong style={{ fontSize: '1.1em' }}><InteractiveText text={r.titulo} /></strong>
                        <p style={{ margin: '8px 0' }}><InteractiveText text={r.explicacao} /></p>
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2em' }}><InteractiveText text={r.exemplo_jp} /></div>
                            <div style={{ color: 'gray', fontSize: '0.9em' }}><InteractiveText text={r.exemplo_pt} /></div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>💬 Frases Prontas</h3>
                {dados.frases_uteis?.map((f: any, i: number) => (
                    <div 
                        key={i} 
                        style={{ marginBottom: '10px', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}
                    >
                        <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}><InteractiveText text={f.jp} /></div>
                        <div style={{ color: 'gray' }}><InteractiveText text={f.pt} /></div>
                    </div>
                ))}
            </div>

            {activeCards.map((card, index) => (
                <DraggableCard 
                    key={card.item}
                    card={card}
                    initialIndex={index}
                    onClose={() => removeCard(card.item)}
                    tema={context.tema}
                    provider={provider}
                    onUpdateSignificado={(item, novoSignificado) => {
                        setActiveCards(prev => prev.map(c => 
                            c.item === item ? { ...c, significado: novoSignificado } : c
                        ));
                    }}
                />
            ))}

            <AiFallbackPopup 
                isOpen={fallbackOpen} 
                errorMessage={fallbackError}
                onRetryGemini={() => {
                    setFallbackOpen(false);
                    carregarGuia('gemini');
                }}
                onFallbackPollinations={() => {
                    setFallbackOpen(false);
                    carregarGuia('pollinations');
                }}
                onCancel={() => setFallbackOpen(false)}
            />
        </div>
    );
}
