import React, { useState, useEffect } from 'react';
import ConfiguracaoPanel from './ConfiguracaoPanel';
import GuiaPanel from './GuiaPanel';
import TraducaoPanel from './TraducaoPanel';
import DialoGoPanel from './DialoGoPanel';
import { supabase } from '../supabase';

export type DialogoMode = 'config' | 'guia' | 'traducao' | 'dialogo';

export interface DialogoContextData {
    tema: string;
    jlpt: string;
    conjuntos: string[];
    vocabularioBanco: any[];
    provider: 'gemini' | 'openai' | 'groq' | 'pollinations';
    sessionId?: string | null;
    traducaoDados?: {
        frase: any;
        resposta: string;
        analise: any;
    } | null;
    dialogoDados?: {
        contexto: string;
        historico: any[];
        inputUser: string;
    } | null;
}

export default function DialoGoApp() {
    const [mode, setMode] = useState<DialogoMode>('config');
    const [contextData, setContextData] = useState<DialogoContextData>({
        tema: '',
        jlpt: 'N5',
        conjuntos: [],
        vocabularioBanco: [],
        provider: 'gemini',
        sessionId: null,
        traducaoDados: null,
        dialogoDados: null
    });

    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setSession(data.session);
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (newSession) {
                setSession(newSession);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const fetchVocabulario = async (config: any) => {
        if (!session) return;
        try {
            // Fetch de vocabulario
            const resJisho = await fetch('/api/jisho?acao=listar', {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });
            if (!resJisho.ok) throw new Error(`HTTP error ${resJisho.status} loading jisho`);
            const vocabData = await resJisho.json();

            // Fetch de baralhos do Anki
            let ankiData = [];
            try {
                const resAnki = await fetch('/api/anki?acao=listar', {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`
                    }
                });
                if (resAnki.ok) {
                    ankiData = await resAnki.json();
                }
            } catch (ankiErr) {
                console.error("Erro ao buscar cartões do Anki no DialoGo", ankiErr);
            }

            // Normaliza dados do Anki para o formato do Vocabulário
            const normalizedAnki = (ankiData || []).map((card: any) => ({
                item: card.vocabulary,
                leitura: card.reading,
                significado: card.meaning,
                jlpt: null,
                conjuntos: ['Geral'],
                baralhos: card.deck_name ? [card.deck_name] : ['Geral'],
                campos_anki: { queue: card.card_status === 'review' ? 2 : 0 },
                notas: card.sentence || ''
            }));

            const allItems = [...(vocabData || []), ...normalizedAnki];

            const srsItems = new Set<string>();
            if (config.srsFiltro !== 'Todos') {
                const resSrs = await fetch('/api/srs?acao=listar', {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`
                    }
                });
                if (resSrs.ok) {
                    const srsData = await resSrs.json();
                    if (Array.isArray(srsData)) {
                        srsData.forEach((s: any) => srsItems.add(s.item));
                    }
                }
            }
            
            const filtered = allItems.filter(item => {
                // a. Filtro de Conjunto
                let matchesConjunto = true;
                if (config.bancoTipo === 'conjuntos' || config.bancoTipo === 'ambos') {
                    if (config.conjuntoSelecionado) {
                        const itemConjuntos = new Set<string>(['Geral']);
                        if (item.conjuntos && Array.isArray(item.conjuntos)) {
                            item.conjuntos.forEach((c: string) => itemConjuntos.add(c));
                        }
                        if (item.notas) {
                            const match = item.notas.match(/\[Conjuntos:\s*([^\]]+)\]/);
                            if (match) {
                                match[1].split(',').map((s: string) => s.trim()).filter(Boolean).forEach((c: string) => itemConjuntos.add(c));
                            }
                        }
                        matchesConjunto = itemConjuntos.has(config.conjuntoSelecionado);
                    }
                }
                
                // b. Filtro de Baralho
                let matchesBaralho = true;
                if (config.bancoTipo === 'baralhos' || config.bancoTipo === 'ambos') {
                    if (config.baralhoSelecionado) {
                        const itemBaralhos = Array.isArray(item.baralhos) ? item.baralhos : [];
                        if (config.baralhoSelecionado === 'Geral') {
                            matchesBaralho = true; // Geral inclui tudo
                        } else {
                            matchesBaralho = itemBaralhos.includes(config.baralhoSelecionado);
                        }
                    }
                }
                
                // c. Filtro SRS
                let matchesSRS = true;
                if (config.srsFiltro !== 'Todos') {
                    let temProgresso = srsItems.has(item.item);
                    if (!temProgresso && item.campos_anki && item.campos_anki.queue !== undefined) {
                        const q = parseInt(item.campos_anki.queue);
                        if (!isNaN(q) && q > 0) temProgresso = true;
                    }
                    
                    if (config.srsFiltro === 'Aprendidos') {
                        matchesSRS = temProgresso;
                    } else if (config.srsFiltro === 'Novos') {
                        matchesSRS = !temProgresso;
                    }
                }
                
                return matchesConjunto && matchesBaralho && matchesSRS;
            });
            
            setContextData(prev => ({
                ...prev,
                vocabularioBanco: filtered
            }));
        } catch (e) {
            console.error('Erro ao buscar vocabulário', e);
        }
    };

    const handleStart = async (config: any) => {
        let activeSessionId = config.sessionId;
        
        if (config.criarNovaSessao && session) {
            try {
                const res = await fetch('/api/dialogo', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        acao: 'criar_sessao',
                        nome: config.nomeSessao,
                        config: {
                            tema: config.tema,
                            jlpt: config.jlpt,
                            provider: config.provider,
                            useBanco: config.useBanco,
                            bancoTipo: config.bancoTipo,
                            conjuntoSelecionado: config.conjuntoSelecionado,
                            baralhoSelecionado: config.baralhoSelecionado,
                            srsFiltro: config.srsFiltro
                        }
                    })
                });
                if (res.ok) {
                    const sessionData = await res.json();
                    activeSessionId = sessionData.id;
                } else {
                    console.error("Falha ao criar sessão:", await res.text());
                }
            } catch (err) {
                console.error("Erro ao criar sessão no backend:", err);
            }
        }

        setContextData(prev => ({
            ...prev,
            tema: config.tema,
            jlpt: config.jlpt,
            provider: config.provider || 'gemini',
            conjuntos: config.useBanco ? (config.bancoTipo === 'conjuntos' || config.bancoTipo === 'ambos' ? [config.conjuntoSelecionado] : []) : [],
            sessionId: activeSessionId,
            traducaoDados: null,
            dialogoDados: null
        }));

        if (config.useBanco) {
            await fetchVocabulario(config);
        } else {
            setContextData(prev => ({
                ...prev,
                vocabularioBanco: []
            }));
        }
        setMode('guia');
    };

    const renderSubNav = () => {
        if (mode === 'config') return null;
        return (
            <div 
                className="dialogo-sub-nav"
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '25px',
                    background: 'var(--card-bg)',
                    padding: '8px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-subtle)',
                    backdropFilter: 'blur(10px)',
                    maxWidth: '800px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    flexWrap: 'wrap'
                }}
            >
                <button 
                    onClick={() => setMode('config')} 
                    style={{ opacity: 0.8 }}
                >
                    ⚙️ Configuração
                </button>
                <div style={{ width: '1px', background: 'var(--border-color)', margin: '4px 0' }} className="hidden sm:block" />
                <button 
                    onClick={() => setMode('guia')} 
                    className={mode === 'guia' ? 'active' : ''}
                >
                    📖 Guia
                </button>
                <button 
                    onClick={() => setMode('traducao')} 
                    className={mode === 'traducao' ? 'active' : ''}
                >
                    ✍️ Praticar
                </button>
                <button 
                    onClick={() => setMode('dialogo')} 
                    className={mode === 'dialogo' ? 'active' : ''}
                >
                    💬 Diálogo
                </button>
            </div>
        );
    };

    return (
        <div style={{ paddingBottom: '60px' }}>
            {renderSubNav()}
            {mode === 'config' && (
                <ConfiguracaoPanel 
                    onStart={handleStart} 
                    session={session} 
                />
            )}
            {mode === 'guia' && (
                <GuiaPanel 
                    context={contextData} 
                    session={session}
                    onNext={() => setMode('traducao')}
                    onBack={() => setMode('config')}
                />
            )}
            {mode === 'traducao' && (
                <TraducaoPanel 
                    context={contextData} 
                    session={session}
                    onNext={() => setMode('dialogo')}
                    onBack={() => setMode('guia')}
                    onUpdateContext={(newData) => setContextData(prev => ({ ...prev, ...newData }))}
                />
            )}
            {mode === 'dialogo' && (
                <DialoGoPanel 
                    context={contextData} 
                    session={session}
                    onBack={() => setMode('traducao')}
                    onUpdateContext={(newData) => setContextData(prev => ({ ...prev, ...newData }))}
                />
            )}
        </div>
    );
}
