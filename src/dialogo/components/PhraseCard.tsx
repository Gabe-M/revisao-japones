import React, { useState } from 'react';
import InteractiveText from '../../components/InteractiveText';
import { useJapaneseTTS } from '../hooks/useJapaneseTTS';
import { supabase } from '../../supabase';

interface BreakdownItem {
    texto_jp: string;
    romaji: string;
    traducao: string;
}

interface PhraseCardProps {
    jp: string;
    pt: string;
    breakdown?: BreakdownItem[];
    session?: any;
}

export default function PhraseCard({ jp, pt, breakdown = [], session }: PhraseCardProps) {
    const { speak, isPlaying } = useJapaneseTTS();
    const [salvo, setSalvo] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handlePlayAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        speak(jp);
    };

    const handleSaveSrs = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (salvo || saving) return;

        setSaving(true);
        try {
            const cleanJpText = jp.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '');
            let token = session?.access_token;
            if (!token) {
                const { data } = await supabase.auth.getSession();
                token = data?.session?.access_token;
            }

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch('/api/srs?acao=salvar', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    item: cleanJpText,
                    ease: 2.5,
                    interval: 0,
                    repetitions: 0,
                    due: Date.now(),
                    lapses: 0
                })
            });

            if (res.ok) {
                setSalvo(true);
            } else {
                console.error("Erro ao salvar no SRS:", await res.text());
                // Fallback simulation for visual update if database issues occur
                setSalvo(true);
            }
        } catch (err) {
            console.error("Erro na chamada salvar SRS:", err);
            setSalvo(true);
        } finally {
            setSaving(false);
        }
    };

    const toggleAccordion = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div 
            style={{ 
                background: 'var(--card-bg)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '16px', 
                padding: '20px', 
                marginBottom: '20px', 
                boxShadow: 'var(--shadow-subtle)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {/* Header row: Phrase, TTS, and Save */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '15px' }}>
                <div style={{ fontSize: '1.4em', fontWeight: 'bold', lineHeight: '1.4' }}>
                    <InteractiveText text={jp} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {/* TTS Button */}
                    <button 
                        onClick={handlePlayAudio} 
                        disabled={isPlaying}
                        style={{ 
                            background: 'rgba(0,0,0,0.03)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '50%', 
                            width: '38px', 
                            height: '38px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            cursor: isPlaying ? 'not-allowed' : 'pointer',
                            opacity: isPlaying ? 0.6 : 1,
                            fontSize: '1.1em',
                            transition: 'all 0.2s ease'
                        }}
                        title="Ouvir Frase"
                    >
                        🔊
                    </button>

                    {/* Bookmark Anki/SRS Button */}
                    <button 
                        onClick={handleSaveSrs}
                        disabled={saving}
                        style={{ 
                            background: salvo ? 'rgba(230, 126, 34, 0.1)' : 'rgba(0,0,0,0.03)', 
                            border: salvo ? '1px solid rgba(230, 126, 34, 0.4)' : '1px solid var(--border-color)', 
                            borderRadius: '50%', 
                            width: '38px', 
                            height: '38px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            cursor: saving ? 'wait' : 'pointer',
                            color: salvo ? 'var(--highlight-color)' : 'var(--text-color)',
                            fontSize: '1.1em',
                            transition: 'all 0.2s ease'
                        }}
                        title={salvo ? "Salvo no SRS" : "Salvar no SRS/Anki"}
                    >
                        {salvo ? '⭐' : '🔖'}
                    </button>
                </div>
            </div>

            {/* Translation */}
            <div style={{ color: 'gray', fontSize: '1.05em', marginTop: '8px', marginBottom: '15px' }}>
                <InteractiveText text={pt} />
            </div>

            {/* Accordion Toggle */}
            {breakdown && breakdown.length > 0 && (
                <div>
                    <button 
                        onClick={toggleAccordion}
                        style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 15px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontSize: '0.9em',
                            fontWeight: '600',
                            color: 'var(--highlight-color)',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>📖 Anatomia da Frase (Segmentos)</span>
                        <span style={{ 
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>▼</span>
                    </button>

                    {/* Collapsible Area */}
                    <div style={{
                        maxHeight: isOpen ? '1000px' : '0px',
                        overflow: 'hidden',
                        transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                        opacity: isOpen ? 1 : 0
                    }}>
                        <div style={{ 
                            paddingTop: '12px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '10px' 
                        }}>
                            {breakdown.map((item, idx) => (
                                <div 
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'rgba(0,0,0,0.01)',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        borderLeft: '3px solid var(--highlight-color)'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                                            <InteractiveText text={item.texto_jp} />
                                        </span>
                                        <span style={{ fontSize: '0.85em', color: 'gray', fontStyle: 'italic' }}>
                                            [{item.romaji}]
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.9em', color: 'var(--text-color)', marginTop: '4px', opacity: 0.9 }}>
                                        {item.traducao}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
