import React, { useState, useRef, useEffect } from 'react';
import InteractiveText from '../../components/InteractiveText';
import AnkiPreviewModal from './AnkiPreviewModal';
import { toast } from '../../components/ui/use-toast';

interface DraggableCardProps {
    card: any;
    onClose: () => void;
    initialIndex: number;
    tema?: string;
    provider?: 'gemini' | 'openai' | 'groq' | 'pollinations';
    onUpdateSignificado?: (item: string, novoSignificado: string) => void;
    session?: any;
}

export default function DraggableCard({ card, onClose, initialIndex, tema, provider, onUpdateSignificado }: DraggableCardProps) {
    const [pos, setPos] = useState({ x: Math.max(50, window.innerWidth / 2 - 150 + initialIndex * 30), y: Math.max(50, 100 + initialIndex * 30) });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number, startY: number, startPosX: number, startPosY: number } | null>(null);

    const [significado, setSignificado] = useState(card.significado);
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [cardProvider, setCardProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(provider || 'gemini');
    
    // Status adaptativo & Conjunto
    const [status, setStatus] = useState<'aprendido' | 'aprendendo_medio' | 'aprendendo_dificil' | 'novo'>(card.status || 'novo');
    const [conjunto, setConjunto] = useState(card.conjunto || tema || 'Geral');
    const [ankiModalOpen, setAnkiModalOpen] = useState(false);

    useEffect(() => {
        setSignificado(card.significado);
    }, [card.significado]);

    useEffect(() => {
        if (provider) {
            setCardProvider(provider);
        }
    }, [provider]);

    const ajustarNotaComIA = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = cardProvider) => {
        if (isAdjusting) return;
        setIsAdjusting(true);
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
                    acao: 'ajustar_nota',
                    termo: card.item,
                    leitura: card.leitura || '',
                    tema: tema || '',
                    fraseOriginal: card.fraseOriginal || ''
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Falha ao ajustar nota');
            }

            const data = await res.json();
            if (data && data.significado) {
                setSignificado(data.significado);
                if (onUpdateSignificado) {
                    onUpdateSignificado(card.item, data.significado);
                }
            }
        } catch (err: any) {
            console.error(err);
            alert(`Erro ao obter nova tradução do contexto via IA (${targetProvider}): ${err.message || err}`);
        } finally {
            setIsAdjusting(false);
        }
    };

    const onPointerDown = (e: React.PointerEvent) => {
        // Only trigger drag if it's not the close button
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
        
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pos.x,
            startPosY: pos.y
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({
            x: dragRef.current.startPosX + dx,
            y: dragRef.current.startPosY + dy
        });
    };

    const onPointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        dragRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div 
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                zIndex: 10000 + initialIndex,
                background: 'var(--card-bg)', 
                border: '2px solid var(--highlight-color)', 
                borderRadius: '16px', 
                padding: '20px', 
                width: '300px', 
                boxShadow: isDragging ? '0 15px 35px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.2)', 
                display: ankiModalOpen ? 'none' : 'flex', 
                flexDirection: 'column',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                transition: isDragging ? 'none' : 'box-shadow 0.2s',
                animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
            }}
        >
            <style>
                {`
                    @keyframes popIn {
                        0% { transform: scale(0.9) translateY(10px); opacity: 0; }
                        100% { transform: scale(1) translateY(0); opacity: 1; }
                    }
                `}
            </style>
            <button 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-color)', fontSize: '1.2em', cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform='scale(1.2)'} 
                onMouseOut={e => e.currentTarget.style.transform='scale(1)'}
            >
                &times;
            </button>
            <div style={{ fontFamily: '"Noto Sans JP", sans-serif', fontSize: '2em', textAlign: 'center', margin: '5px 0', fontWeight: 800, color: 'var(--text-color)' }}>
                <InteractiveText text={card.item} fallbackLeitura={card.leitura} />
            </div>
            {card.leitura && (
                <div style={{ textAlign: 'center', fontSize: '1em', color: 'gray', fontWeight: 600, letterSpacing: '1px', marginBottom: '10px' }}>
                    {card.leitura}
                </div>
            )}
            
            {card.tipo === 'SelecaoLivre' ? (
                <div style={{ marginBottom: '15px' }}>
                    {card.valido === false ? (
                        <div style={{
                            color: '#ff6b6b',
                            fontSize: '0.9em',
                            padding: '12px',
                            background: 'rgba(231, 76, 60, 0.15)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            borderLeft: '4px solid #ff6b6b',
                            lineHeight: '1.4'
                        }}>
                            <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ Seleção Inválida:</strong>
                            {card.erro || 'Esta seleção não forma um bloco pedagógico ou semântico válido.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--highlight-color)' }}>
                                <div style={{ fontSize: '0.75em', textTransform: 'uppercase', color: 'gray', fontWeight: 700, marginBottom: '4px' }}>Tradução (PT/BR):</div>
                                <div style={{ fontWeight: 600, fontSize: '1em', color: 'var(--text-color)' }}>
                                    {card.traducao || significado}
                                </div>
                            </div>
                            {card.explicacao && (
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', fontSize: '0.9em', borderLeft: '3px solid var(--highlight-color)' }}>
                                    <strong>Explicação Contextual:</strong>
                                    <p style={{ margin: '4px 0 0 0', opacity: 0.9, lineHeight: '1.4' }}>{card.explicacao}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--highlight-color)', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '5px' }}>
                        <div style={{ fontSize: '0.75em', textTransform: 'uppercase', color: 'gray', fontWeight: 700 }}>Descrição / Significado:</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <select
                                onPointerDown={(e) => e.stopPropagation()}
                                value={cardProvider}
                                onChange={(e) => setCardProvider(e.target.value as any)}
                                disabled={isAdjusting}
                                style={{
                                    background: 'var(--card-bg)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-color)',
                                    fontSize: '0.7em',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            >
                                <option value="gemini">Gemini</option>
                                <option value="pollinations">Pollinations</option>
                                <option value="groq">Groq</option>
                            </select>
                            <button 
                                onPointerDown={(e) => e.stopPropagation()} 
                                onClick={() => ajustarNotaComIA(cardProvider)}
                                disabled={isAdjusting}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--highlight-color)',
                                    fontSize: '0.75em',
                                    fontWeight: 'bold',
                                    cursor: isAdjusting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s',
                                    opacity: isAdjusting ? 0.6 : 0.8
                                }}
                                onMouseEnter={(e) => !isAdjusting && (e.currentTarget.style.backgroundColor = 'rgba(230, 126, 34, 0.1)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                title="Ajustar significado para o contexto do diálogo atual"
                            >
                                {isAdjusting ? '⌛...' : '🪄 Contexto'}
                            </button>
                        </div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '1em', color: 'var(--text-color)' }}>
                        <InteractiveText text={significado} />
                    </div>
                </div>
            )}
            
            {/* Dificuldade & Status Adaptativo */}
            <div style={{ margin: '10px 0', padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75em', fontWeight: 700, color: 'var(--text-color)' }}>
                    <span>Marcar como Aprendendo / Dificuldade:</span>
                    <span style={{ fontSize: '0.9em' }}>
                        {status === 'aprendido' ? '🟢 Aprendido' : status === 'aprendendo_dificil' ? '🔴 Difícil' : status === 'aprendendo_medio' ? '🟡 Médio' : '🆕 Nova'}
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={async () => {
                            setStatus('aprendido');
                            toast({ title: '🟢 Marcado como Aprendido', description: `Palavra '${card.item}' salva como aprendida.` });
                        }}
                        style={{ padding: '6px', fontSize: '0.75em', fontWeight: 'bold', background: 'rgba(46, 204, 113, 0.15)', color: '#27ae60', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        🟢 Fácil
                    </button>
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={async () => {
                            setStatus('aprendendo_medio');
                            toast({ title: '🟡 Marcado em Aprendizado (Médio)', description: `Palavra '${card.item}' em reforço médio.` });
                        }}
                        style={{ padding: '6px', fontSize: '0.75em', fontWeight: 'bold', background: 'rgba(241, 196, 15, 0.15)', color: '#d35400', border: '1px solid rgba(241, 196, 15, 0.3)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        🟡 Médio
                    </button>
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={async () => {
                            setStatus('aprendendo_dificil');
                            toast({ title: '🔴 Marcado em Aprendizado (Difícil)', description: `Palavra '${card.item}' priorizada para reforço urgente.` });
                        }}
                        style={{ padding: '6px', fontSize: '0.75em', fontWeight: 'bold', background: 'rgba(231, 76, 60, 0.15)', color: '#c0392b', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        🔴 Difícil
                    </button>
                </div>

                {/* Seletor de Conjunto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.75em', color: 'gray', fontWeight: 600 }}>Conjunto:</span>
                    <input
                        onPointerDown={e => e.stopPropagation()}
                        value={conjunto}
                        onChange={e => setConjunto(e.target.value)}
                        placeholder="Nome do conjunto..."
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.75em', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-color)' }}
                    />
                </div>
            </div>

            {/* Ações Inferiores & Anki */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: 'rgba(52, 73, 94, 0.1)', color: 'var(--secondary-color)', padding: '4px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '0.7em', textTransform: 'uppercase' }}>
                        {card.tipo || 'Vocabulário'}
                    </span>
                    {card.jlpt && (
                        <span style={{ backgroundColor: 'rgba(230, 126, 34, 0.12)', color: 'var(--highlight-color)', padding: '4px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '0.7em' }}>
                            {card.jlpt}
                        </span>
                    )}
                </div>

                <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => setAnkiModalOpen(true)}
                    style={{ padding: '6px 12px', fontSize: '0.75em', fontWeight: 'bold', background: '#8e44ad', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Exportar para o Baralho Anki"
                >
                    🎴 Salvar no Anki
                </button>
            </div>

            {/* Modal de Preview do Anki */}
            {ankiModalOpen && (
                <AnkiPreviewModal
                    isOpen={ankiModalOpen}
                    onClose={() => { setAnkiModalOpen(false); onClose(); }}
                    cardInicial={{
                        item: card.item,
                        leitura: card.leitura || '',
                        significado: significado || card.significado || '',
                        categoria: card.tipo || 'Vocabulário',
                        jlpt: card.jlpt || 'N5',
                        exemplo_jp: card.fraseOriginal || card.exemplo_jp || '',
                        exemplo_pt: card.exemplo_pt || ''
                    }}
                    modulo={conjunto || 'Vocabulario'}
                />
            )}
        </div>
    );
}
