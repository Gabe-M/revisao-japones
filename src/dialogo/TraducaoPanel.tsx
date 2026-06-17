import React, { useState, useEffect } from 'react';
import FuriganaText from './components/FuriganaText';
import ScoreBadge from './components/ScoreBadge';

interface TraducaoPanelProps {
    context: any;
    onNext: () => void;
    onBack: () => void;
}

export default function TraducaoPanel({ context, onNext, onBack }: TraducaoPanelProps) {
    const [loading, setLoading] = useState(true);
    const [frase, setFrase] = useState<any>(null);
    const [resposta, setResposta] = useState('');
    const [analise, setAnalise] = useState<any>(null);
    const [analisando, setAnalisando] = useState(false);

    useEffect(() => {
        carregarFrase();
    }, []);

    const carregarFrase = async () => {
        setLoading(true);
        setAnalise(null);
        setResposta('');
        try {
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: 'gerar_traducao',
                    tema: context.tema,
                    jlpt: context.jlpt
                })
            });
            const data = await res.json();
            setFrase(data);
        } catch (e) {
            console.error(e);
            alert("Erro ao buscar frase para tradução.");
        }
        setLoading(false);
    };

    const verificarTraducao = async () => {
        if (!resposta.trim()) return;
        setAnalisando(true);
        try {
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: 'analisar_traducao',
                    frase_jp: frase.frase_jp,
                    resposta_pt: resposta
                })
            });
            const data = await res.json();
            setAnalise(data);
        } catch (e) {
            console.error(e);
            alert("Erro ao analisar a tradução.");
        }
        setAnalisando(false);
    };

    const tocarAudio = () => {
        if (!frase?.frase_jp) return;
        // Limpa a string de tags HTML (ruby) para tocar apenas o texto
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = frase.frase_jp;
        const textoPuro = tempDiv.textContent || tempDiv.innerText || "";
        
        const utterance = new SpeechSynthesisUtterance(textoPuro);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Gerando frase... ⏳</div>;
    if (!frase) return null;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>← Voltar ao Guia</button>
                <button onClick={onNext} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--highlight-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Ir para Diálogo →</button>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '16px', boxShadow: 'var(--shadow-subtle)', textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: 'gray', fontWeight: 'normal', fontSize: '1em' }}>Traduza esta frase para o português:</h3>
                
                <div style={{ fontSize: '2em', fontWeight: 'bold', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                    <FuriganaText text={frase.frase_jp} />
                    <button onClick={tocarAudio} style={{ background: 'transparent', border: 'none', fontSize: '1.2em', cursor: 'pointer', padding: '10px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)' }}>🔊</button>
                </div>

                <textarea 
                    value={resposta}
                    onChange={e => setResposta(e.target.value)}
                    placeholder="Sua tradução aqui..."
                    disabled={!!analise}
                    style={{ width: '100%', minHeight: '100px', padding: '15px', borderRadius: '12px', border: '2px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '1.1em', boxSizing: 'border-box', marginBottom: '15px', resize: 'vertical' }}
                />

                {!analise ? (
                    <button 
                        onClick={verificarTraducao} 
                        disabled={analisando || !resposta.trim()}
                        style={{ padding: '12px 30px', fontSize: '1.1em', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none', cursor: analisando ? 'not-allowed' : 'pointer', opacity: analisando ? 0.7 : 1 }}
                    >
                        {analisando ? 'Analisando...' : 'Verificar Tradução'}
                    </button>
                ) : (
                    <div style={{ background: analise.correto ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)', padding: '20px', borderRadius: '12px', border: `2px solid ${analise.correto ? '#2ecc71' : '#e74c3c'}`, textAlign: 'left', marginTop: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                            <ScoreBadge score={analise.score} />
                            <div>
                                <h3 style={{ margin: 0, color: analise.correto ? '#27ae60' : '#c0392b' }}>
                                    {analise.correto ? 'Muito bem!' : 'Precisa melhorar'}
                                </h3>
                                <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Correção ideal: {analise.traducao_correta}</p>
                            </div>
                        </div>

                        {analise.erros && analise.erros.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                                <strong>Pontos de atenção:</strong>
                                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                                    {analise.erros.map((erro: string, i: number) => <li key={i}>{erro}</li>)}
                                </ul>
                            </div>
                        )}
                        
                        <div style={{ background: 'rgba(0,0,0,0.05)', padding: '10px', borderRadius: '8px', fontSize: '0.9em' }}>
                            <strong>💡 Dica:</strong> {analise.dica || frase.dica}
                        </div>

                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <button onClick={carregarFrase} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--highlight-color)', color: 'white', border: 'none', cursor: 'pointer' }}>Nova Frase</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
