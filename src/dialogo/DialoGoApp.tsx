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
}

export default function DialoGoApp() {
    const [mode, setMode] = useState<DialogoMode>('config');
    const [contextData, setContextData] = useState<DialogoContextData>({
        tema: '',
        jlpt: 'N5',
        conjuntos: [],
        vocabularioBanco: []
    });

    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        const sessaoSalva = localStorage.getItem('supabase_session');
        if (sessaoSalva) {
            setSession(JSON.parse(sessaoSalva));
        } else {
            // Check Se tem sessão supabase auth
            supabase.auth.getSession().then(({ data }) => {
                if (data.session) {
                    setSession(data.session);
                    localStorage.setItem('supabase_session', JSON.stringify(data.session));
                }
            });
        }
    }, []);

    const fetchVocabulario = async (conjuntos: string[]) => {
        if (!session) return;
        try {
            let query = supabase.from('vocabulario').select('item,leitura,significado,jlpt,conjuntos').eq('user_id', session.user.id);
            // We'll just fetch all or filter by conjuntos in the client for simplicity if it's small, 
            // or use contains if supported. Let's just fetch all and filter to ensure we can highlight "Already in DB".
            const { data, error } = await query;
            if (error) throw error;
            
            // update context
            setContextData(prev => ({
                ...prev,
                vocabularioBanco: data || []
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
            conjuntos: config.conjuntos
        }));
        await fetchVocabulario(config.conjuntos);
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
