import React, { useState, useEffect } from 'react';
import FuriganaText from './components/FuriganaText';
import VocabularioChip from './components/VocabularioChip';

interface GuiaPanelProps {
    context: any;
    onNext: () => void;
    onBack: () => void;
}

export default function GuiaPanel({ context, onNext, onBack }: GuiaPanelProps) {
    const [loading, setLoading] = useState(true);
    const [dados, setDados] = useState<any>(null);

    useEffect(() => {
        carregarGuia();
    }, []);

    const carregarGuia = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: 'gerar_guia',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco?.map((v:any) => v.item) || []
                })
            });
            const data = await res.json();
            setDados(data);
        } catch (e) {
            console.error("Erro ao gerar guia", e);
            alert("Erro ao gerar o guia com a IA.");
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
        return <div style={{ textAlign: 'center', padding: '50px' }}>Carregando Guia de Estudos... ⏳</div>;
    }

    if (!dados) return null;

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
                            />
                        );
                    })}
                </div>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>🧠 Regras Gramaticais Úteis</h3>
                {dados.regras?.map((r: any, i: number) => (
                    <div key={i} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: i < dados.regras.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
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
                    <div key={i} style={{ marginBottom: '10px', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}><FuriganaText text={f.jp} /></div>
                        <div style={{ color: 'gray' }}>{f.pt}</div>
                    </div>
                ))}
            </div>

        </div>
    );
}
