import React, { useState, useEffect } from 'react';

interface ConfiguracaoPanelProps {
    onStart: (config: any) => void;
    session: any;
}

export default function ConfiguracaoPanel({ onStart, session }: ConfiguracaoPanelProps) {
    const [tema, setTema] = useState('');
    const [jlpt, setJlpt] = useState('N5');
    const [conjuntosDisp, setConjuntosDisp] = useState<string[]>([]);
    const [conjuntoSelecionado, setConjuntoSelecionado] = useState('');
    const [useConjuntos, setUseConjuntos] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Novos estados para baralhos e filtros SRS
    const [bancoTipo, setBancoTipo] = useState<'conjuntos' | 'baralhos' | 'ambos'>('conjuntos');
    const [baralhosDisp, setBaralhosDisp] = useState<string[]>([]);
    const [baralhoSelecionado, setBaralhoSelecionado] = useState('');
    const [srsFiltro, setSrsFiltro] = useState<'Todos' | 'Aprendidos' | 'Novos'>('Todos');
    const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>('gemini');

    const temasRapidos = ['Me apresentar', 'Fazer compras', 'Pedir direções', 'No restaurante', 'Em uma entrevista'];

    useEffect(() => {
        if (session) {
            carregarDadosBanco();
        }
    }, [session]);

    const carregarDadosBanco = async () => {
        if (!session) return;
        try {
            // Busca dados do vocabulário (jisho)
            const resJisho = await fetch('/api/jisho?acao=listar', {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });
            if (!resJisho.ok) throw new Error(`HTTP error ${resJisho.status} loading jisho`);
            const dataJisho = await resJisho.json();

            // Busca dados dos baralhos do Anki
            let dataAnki = [];
            try {
                const resAnki = await fetch('/api/anki?acao=listar', {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`
                    }
                });
                if (resAnki.ok) {
                    dataAnki = await resAnki.json();
                }
            } catch (ankiErr) {
                console.error("Erro ao carregar baralhos do Anki", ankiErr);
            }
            
            const todosConjuntos = new Set<string>(['Geral']);
            const todosBaralhos = new Set<string>(['Geral']);
            
            if (dataJisho && Array.isArray(dataJisho)) {
                dataJisho.forEach((item: any) => {
                    // Extrai conjuntos das notas e do campo conjunto
                    if (item.conjuntos && Array.isArray(item.conjuntos)) {
                        item.conjuntos.forEach((c: string) => todosConjuntos.add(c));
                    }
                    if (item.notas) {
                        const match = item.notas.match(/\[Conjuntos:\s*([^\]]+)\]/);
                        if (match) {
                            match[1].split(',').map((s: string) => s.trim()).filter(Boolean).forEach((c: string) => todosConjuntos.add(c));
                        }
                    }
                    
                    // Extrai baralhos
                    if (item.baralhos && Array.isArray(item.baralhos)) {
                        item.baralhos.forEach((b: string) => todosBaralhos.add(b));
                    }
                });
            }

            if (dataAnki && Array.isArray(dataAnki)) {
                dataAnki.forEach((item: any) => {
                    if (item.deck_name) {
                        todosBaralhos.add(item.deck_name);
                    }
                });
            }
            
            const listaConjuntos = Array.from(todosConjuntos).sort();
            setConjuntosDisp(listaConjuntos);
            if (listaConjuntos.length > 0) setConjuntoSelecionado(listaConjuntos[0]);
            
            const listaBaralhos = Array.from(todosBaralhos).sort();
            setBaralhosDisp(listaBaralhos);
            if (listaBaralhos.length > 0) setBaralhoSelecionado(listaBaralhos[0]);
        } catch (error) {
            console.error("Erro ao carregar dados do banco", error);
        }
    };

    const handleStart = () => {
        if (!tema.trim()) {
            alert('Por favor, digite ou selecione um tema.');
            return;
        }
        onStart({
            tema,
            useBanco: useConjuntos,
            bancoTipo,
            conjuntoSelecionado: conjuntoSelecionado || 'Geral',
            baralhoSelecionado: baralhoSelecionado || 'Geral',
            srsFiltro,
            jlpt: useConjuntos ? null : jlpt,
            provider: selectedProvider
        });
    };

    return (
        <div style={{ 
            maxWidth: '600px', 
            margin: '0 auto', 
            background: 'var(--card-bg)', 
            padding: '35px 30px', 
            borderRadius: '16px', 
            boxShadow: 'var(--shadow-subtle)', 
            border: '1px solid var(--border-color)',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
        }}>
            <h2 style={{ 
                marginTop: 0, 
                fontWeight: 800, 
                letterSpacing: '-0.5px', 
                fontSize: '1.8em',
                textAlign: 'center',
                background: 'linear-gradient(90deg, var(--primary-color), var(--highlight-color))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                borderBottom: '2px solid var(--border-color)', 
                paddingBottom: '15px',
                marginBottom: '25px'
            }}>
                💬 Configurar Diálogo
            </h2>
            
            <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-color)', fontSize: '0.95em' }}>
                    Tema da Conversa:
                </label>
                <input 
                    type="text" 
                    value={tema} 
                    onChange={e => setTema(e.target.value)} 
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Ex: Como pedir comida num restaurante..."
                    style={{ 
                        width: '100%', 
                        padding: '14px 18px', 
                        borderRadius: '12px', 
                        border: isFocused ? '2px solid var(--highlight-color)' : '2px solid var(--border-color)', 
                        background: 'var(--bg-color)', 
                        color: 'var(--text-color)', 
                        fontSize: '1.05em',
                        boxSizing: 'border-box', 
                        outline: 'none', 
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        boxShadow: isFocused ? '0 0 0 4px rgba(230, 126, 34, 0.15)' : 'none',
                        transform: isFocused ? 'translateY(-2px)' : 'none'
                    }}
                />
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {temasRapidos.map(t => (
                        <button 
                            key={t} 
                            type="button"
                            onClick={() => setTema(t)}
                            style={{ 
                                padding: '8px 16px', 
                                borderRadius: '20px', 
                                border: '1px solid var(--border-color)', 
                                background: tema === t ? 'var(--highlight-color)' : 'transparent', 
                                color: tema === t ? '#fff' : 'var(--text-color)', 
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.88em',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: tema === t ? '0 4px 10px rgba(230, 126, 34, 0.3)' : 'none',
                                transform: tema === t ? 'scale(1.03)' : 'scale(1)'
                            }}
                            onMouseOver={(e) => {
                                if (tema !== t) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (tema !== t) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-color)', fontSize: '0.95em' }}>
                    Fonte de Vocabulário:
                </label>
                
                <div style={{
                    display: 'flex',
                    background: 'rgba(0, 0, 0, 0.03)',
                    borderRadius: '24px',
                    padding: '4px',
                    gap: '4px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '20px',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    <button 
                        type="button"
                        onClick={() => setUseConjuntos(false)} 
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: '0.92em',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            background: !useConjuntos ? 'var(--card-bg)' : 'transparent',
                            color: 'var(--text-color)',
                            opacity: !useConjuntos ? 1 : 0.6,
                            boxShadow: !useConjuntos ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        🌐 Qualquer palavra (Livre)
                    </button>
                    <button 
                        type="button"
                        onClick={() => {
                            if (session) setUseConjuntos(true);
                        }} 
                        disabled={!session}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: '0.92em',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: '20px',
                            cursor: session ? 'pointer' : 'not-allowed',
                            background: useConjuntos ? 'var(--card-bg)' : 'transparent',
                            color: 'var(--text-color)',
                            opacity: useConjuntos ? 1 : (session ? 0.6 : 0.35),
                            boxShadow: useConjuntos ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        📁 Meu Banco {session ? '' : '(Requer Login)'}
                    </button>
                </div>

                {!useConjuntos ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-color)', opacity: 0.85 }}>
                            Nível de dificuldade máximo (JLPT):
                        </label>
                        <select 
                            value={jlpt} 
                            onChange={e => setJlpt(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '12px 16px', 
                                borderRadius: '10px', 
                                background: 'var(--bg-color)', 
                                color: 'var(--text-color)', 
                                border: '2px solid var(--border-color)', 
                                fontSize: '1em',
                                fontWeight: '600',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: 'var(--shadow-subtle)'
                            }}
                        >
                            <option value="N5">🟢 N5 (Iniciante)</option>
                            <option value="N4">🔵 N4 (Básico)</option>
                            <option value="N3">🟡 N3 (Intermediário)</option>
                            <option value="N2">🟠 N2 (Avançado)</option>
                            <option value="N1">🔴 N1 (Fluente)</option>
                        </select>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-color)', opacity: 0.85, marginBottom: '8px' }}>
                                Filtrar banco por:
                            </label>
                            <div style={{
                                display: 'flex',
                                background: 'rgba(0, 0, 0, 0.03)',
                                borderRadius: '24px',
                                padding: '4px',
                                gap: '4px',
                                border: '1px solid var(--border-color)',
                                width: '100%',
                                boxSizing: 'border-box'
                            }}>
                                <button 
                                    type="button"
                                    onClick={() => setBancoTipo('conjuntos')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '0.85em',
                                        fontWeight: 700,
                                        border: 'none',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        background: bancoTipo === 'conjuntos' ? 'var(--card-bg)' : 'transparent',
                                        color: 'var(--text-color)',
                                        opacity: bancoTipo === 'conjuntos' ? 1 : 0.6,
                                        boxShadow: bancoTipo === 'conjuntos' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    📁 Conjuntos
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setBancoTipo('baralhos')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '0.85em',
                                        fontWeight: 700,
                                        border: 'none',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        background: bancoTipo === 'baralhos' ? 'var(--card-bg)' : 'transparent',
                                        color: 'var(--text-color)',
                                        opacity: bancoTipo === 'baralhos' ? 1 : 0.6,
                                        boxShadow: bancoTipo === 'baralhos' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    🎴 Baralhos
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setBancoTipo('ambos')}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '0.85em',
                                        fontWeight: 700,
                                        border: 'none',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        background: bancoTipo === 'ambos' ? 'var(--card-bg)' : 'transparent',
                                        color: 'var(--text-color)',
                                        opacity: bancoTipo === 'ambos' ? 1 : 0.6,
                                        boxShadow: bancoTipo === 'ambos' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    🌀 Ambos
                                </button>
                            </div>
                        </div>

                        {(bancoTipo === 'conjuntos' || bancoTipo === 'ambos') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-color)', opacity: 0.85 }}>
                                    Escolha um conjunto:
                                </label>
                                <select 
                                    value={conjuntoSelecionado} 
                                    onChange={e => setConjuntoSelecionado(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px 16px', 
                                        borderRadius: '10px', 
                                        background: 'var(--bg-color)', 
                                        color: 'var(--text-color)', 
                                        border: '2px solid var(--border-color)', 
                                        fontSize: '1em',
                                        fontWeight: '600',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: 'var(--shadow-subtle)'
                                    }}
                                >
                                    {conjuntosDisp.map(c => (
                                        <option key={c} value={c}>📁 {c}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(bancoTipo === 'baralhos' || bancoTipo === 'ambos') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-color)', opacity: 0.85 }}>
                                    Escolha um baralho (Anki):
                                </label>
                                <select 
                                    value={baralhoSelecionado} 
                                    onChange={e => setBaralhoSelecionado(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px 16px', 
                                        borderRadius: '10px', 
                                        background: 'var(--bg-color)', 
                                        color: 'var(--text-color)', 
                                        border: '2px solid var(--border-color)', 
                                        fontSize: '1em',
                                        fontWeight: '600',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: 'var(--shadow-subtle)'
                                    }}
                                >
                                    {baralhosDisp.map(b => (
                                        <option key={b} value={b}>🎴 {b}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(bancoTipo === 'baralhos' || bancoTipo === 'ambos') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-color)', opacity: 0.85 }}>
                                    Filtro de Progresso SRS:
                                </label>
                                <div style={{
                                    display: 'flex',
                                    background: 'rgba(0, 0, 0, 0.03)',
                                    borderRadius: '24px',
                                    padding: '4px',
                                    gap: '4px',
                                    border: '1px solid var(--border-color)',
                                    width: '100%',
                                    boxSizing: 'border-box'
                                }}>
                                    <button 
                                        type="button"
                                        onClick={() => setSrsFiltro('Todos')}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            fontSize: '0.82em',
                                            fontWeight: 700,
                                            border: 'none',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            background: srsFiltro === 'Todos' ? 'var(--card-bg)' : 'transparent',
                                            color: 'var(--text-color)',
                                            opacity: srsFiltro === 'Todos' ? 1 : 0.6,
                                            boxShadow: srsFiltro === 'Todos' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        🧠 Todos
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setSrsFiltro('Aprendidos')} /* normal placeholder but let's use Aprendidos */
                                        style={{
                                            display: 'none'
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setSrsFiltro('Aprendidos')}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            fontSize: '0.82em',
                                            fontWeight: 700,
                                            border: 'none',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            background: srsFiltro === 'Aprendidos' ? 'var(--card-bg)' : 'transparent',
                                            color: 'var(--text-color)',
                                            opacity: srsFiltro === 'Aprendidos' ? 1 : 0.6,
                                            boxShadow: srsFiltro === 'Aprendidos' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        🔵 Aprendidos
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setSrsFiltro('Novos')}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            fontSize: '0.82em',
                                            fontWeight: 700,
                                            border: 'none',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            background: srsFiltro === 'Novos' ? 'var(--card-bg)' : 'transparent',
                                            color: 'var(--text-color)',
                                            opacity: srsFiltro === 'Novos' ? 1 : 0.6,
                                            boxShadow: srsFiltro === 'Novos' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        🟡 Novos
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '25px', marginTop: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-color)', fontSize: '0.95em' }}>
                    🤖 Provedor de Inteligência Artificial:
                </label>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    background: 'rgba(0, 0, 0, 0.03)',
                    borderRadius: '16px',
                    padding: '4px',
                    gap: '4px',
                    border: '1px solid var(--border-color)',
                }}>
                    <button 
                        type="button"
                        onClick={() => setSelectedProvider('gemini')}
                        style={{
                            padding: '10px 8px',
                            fontSize: '0.82em',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: selectedProvider === 'gemini' ? 'var(--card-bg)' : 'transparent',
                            color: 'var(--text-color)',
                            opacity: selectedProvider === 'gemini' ? 1 : 0.6,
                            boxShadow: selectedProvider === 'gemini' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>✨ Gemini</span>
                        <span style={{ fontSize: '0.75em', fontWeight: 'normal', color: 'gray' }}>Grátis (Instável)</span>
                    </button>
                    
                    <button 
                        type="button"
                        onClick={() => setSelectedProvider('pollinations')}
                        style={{
                            padding: '10px 8px',
                            fontSize: '0.82em',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: selectedProvider === 'pollinations' ? 'var(--card-bg)' : 'transparent',
                            color: 'var(--text-color)',
                            opacity: selectedProvider === 'pollinations' ? 1 : 0.6,
                            boxShadow: selectedProvider === 'pollinations' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>🪐 Pollinations</span>
                        <span style={{ fontSize: '0.75em', fontWeight: 'normal', color: 'gray' }}>Grátis (Sem Chave)</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setSelectedProvider('groq')}
                        style={{
                            padding: '10px 8px',
                            fontSize: '0.82em',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: selectedProvider === 'groq' ? 'var(--card-bg)' : 'transparent',
                            color: 'var(--text-color)',
                            opacity: selectedProvider === 'groq' ? 1 : 0.6,
                            boxShadow: selectedProvider === 'groq' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>⚡ Groq</span>
                        <span style={{ fontSize: '0.75em', fontWeight: 'normal', color: 'gray' }}>Llama 3.3 (Grátis)</span>
                    </button>
                </div>
            </div>

            <button 
                onClick={handleStart}
                style={{ 
                    width: '100%', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    border: 'none', 
                    background: 'linear-gradient(135deg, var(--highlight-color) 0%, #d35400 100%)', 
                    color: '#fff', 
                    fontSize: '1.15em', 
                    fontWeight: '800', 
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 15px rgba(230, 126, 34, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '15px'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(230, 126, 34, 0.45)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(230, 126, 34, 0.3)';
                }}
            >
                🚀 Iniciar Diálogo
            </button>
        </div>
    );
}
