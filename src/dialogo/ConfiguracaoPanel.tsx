import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface ConfiguracaoPanelProps {
    onStart: (config: any) => void;
    session: any;
}

export default function ConfiguracaoPanel({ onStart, session }: ConfiguracaoPanelProps) {
    const [tema, setTema] = useState('');
    const [jlpt, setJlpt] = useState('N5');
    const [conjuntosDisp, setConjuntosDisp] = useState<string[]>([]);
    const [useConjuntos, setUseConjuntos] = useState(false);
    const [conjuntoSelecionado, setConjuntoSelecionado] = useState('');

    const temasRapidos = ['Me apresentar', 'Fazer compras', 'Pedir direções', 'No restaurante', 'Em uma entrevista'];

    useEffect(() => {
        if (session) {
            carregarConjuntos();
        }
    }, [session]);

    const carregarConjuntos = async () => {
        try {
            const { data, error } = await supabase.from('vocabulario').select('conjuntos').eq('user_id', session.user.id);
            if (error) throw error;
            if (data) {
                const todosConjuntos = new Set<string>();
                data.forEach(item => {
                    if (item.conjuntos && Array.isArray(item.conjuntos)) {
                        item.conjuntos.forEach((c: string) => todosConjuntos.add(c));
                    }
                });
                const lista = Array.from(todosConjuntos).sort();
                setConjuntosDisp(lista);
                if (lista.length > 0) setConjuntoSelecionado(lista[0]);
            }
        } catch (error) {
            console.error("Erro ao carregar conjuntos", error);
        }
    };

    const handleStart = () => {
        if (!tema.trim()) {
            alert('Por favor, digite ou selecione um tema.');
            return;
        }
        onStart({
            tema,
            jlpt: useConjuntos ? null : jlpt,
            conjuntos: useConjuntos && conjuntoSelecionado ? [conjuntoSelecionado] : []
        });
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--card-bg)', padding: '30px', borderRadius: '16px', boxShadow: 'var(--shadow-subtle)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ marginTop: 0, borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>Configurar Diálogo</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Tema da Conversa:</label>
                <input 
                    type="text" 
                    value={tema} 
                    onChange={e => setTema(e.target.value)} 
                    placeholder="Ex: Como pedir comida num restaurante"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', boxSizing: 'border-box' }}
                />
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {temasRapidos.map(t => (
                        <button 
                            key={t} 
                            onClick={() => setTema(t)}
                            style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', background: tema === t ? 'var(--highlight-color)' : 'transparent', color: tema === t ? '#fff' : 'var(--text-color)', cursor: 'pointer' }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Fonte de Vocabulário:</label>
                
                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" checked={!useConjuntos} onChange={() => setUseConjuntos(false)} />
                        Qualquer palavra (Livre)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" checked={useConjuntos} onChange={() => setUseConjuntos(true)} disabled={!session} />
                        Meu Banco de Palavras {!session && '(Requer Login)'}
                    </label>
                </div>

                {!useConjuntos ? (
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '5px' }}>Nível de dificuldade máximo (JLPT):</label>
                        <select 
                            value={jlpt} 
                            onChange={e => setJlpt(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                        >
                            <option value="N5">N5 (Iniciante)</option>
                            <option value="N4">N4 (Básico)</option>
                            <option value="N3">N3 (Intermediário)</option>
                            <option value="N2">N2 (Avançado)</option>
                            <option value="N1">N1 (Fluente)</option>
                        </select>
                    </div>
                ) : (
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '5px' }}>Escolha um conjunto:</label>
                        <select 
                            value={conjuntoSelecionado} 
                            onChange={e => setConjuntoSelecionado(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)', width: '100%' }}
                        >
                            <option value="">Selecione...</option>
                            {conjuntosDisp.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <button 
                onClick={handleStart}
                style={{ width: '100%', padding: '15px', borderRadius: '8px', border: 'none', background: 'var(--highlight-color)', color: '#fff', fontSize: '1.1em', fontWeight: 'bold', cursor: 'pointer' }}
            >
                Começar →
            </button>
        </div>
    );
}
