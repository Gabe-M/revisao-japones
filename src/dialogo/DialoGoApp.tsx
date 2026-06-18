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
}

export default function DialoGoApp() {
    const [mode, setMode] = useState<DialogoMode>('config');
    const [contextData, setContextData] = useState<DialogoContextData>({
        tema: '',
        jlpt: 'N5',
        conjuntos: [],
        vocabularioBanco: [],
        provider: 'gemini'
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
        setContextData(prev => ({
            ...prev,
            tema: config.tema,
            jlpt: config.jlpt,
            provider: config.provider || 'gemini',
            conjuntos: config.useBanco ? (config.bancoTipo === 'conjuntos' || config.bancoTipo === 'ambos' ? [config.conjuntoSelecionado] : []) : []
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

    return (
        <div style={{ paddingBottom: '60px' }}>
            {mode === 'config' && (
                <ConfiguracaoPanel 
                    onStart={handleStart} 
                    session={session} 
                />
            )}
            {mode === 'guia' && (
                <GuiaPanel 
                    context={contextData} 
                    onNext={() => setMode('traducao')}
                    onBack={() => setMode('config')}
                />
            )}
            {mode === 'traducao' && (
                <TraducaoPanel 
                    context={contextData} 
                    onNext={() => setMode('dialogo')}
                    onBack={() => setMode('guia')}
                />
            )}
            {mode === 'dialogo' && (
                <DialoGoPanel 
                    context={contextData} 
                    onBack={() => setMode('traducao')}
                />
            )}
        </div>
    );
}
