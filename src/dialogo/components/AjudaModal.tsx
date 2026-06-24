import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import VocabularyRibbon from './ajuda/VocabularyRibbon';
import DraftInput from './ajuda/DraftInput';
import DynamicResultArea from './ajuda/DynamicResultArea';
import ModalHeader from './ajuda/ModalHeader';
import ChatBubble from './ajuda/ChatBubble';

interface AjudaModalProps {
    isOpen: boolean;
    onClose: () => void;
    mensagem: string; // raw JP string with ruby tags
    context: any; // tema, jlpt, vocabularioBanco, provider
    onUsarResposta: (texto: string) => void;
}

type ModoAtivo = 'analisar' | 'sugestao' | 'duvida' | null;

export default function AjudaModal({ isOpen, onClose, mensagem, context, onUsarResposta }: AjudaModalProps) {
    // Vocabulário (automático)
    const [vocabulario, setVocabulario] = useState<any[]>([]);
    const [loadingVocab, setLoadingVocab] = useState(false);

    // Campo de prática
    const [praticaInput, setPraticaInput] = useState('');

    // Modo ativo (qual seção de resultado mostrar)
    const [modoAtivo, setModoAtivo] = useState<ModoAtivo>(null);

    // Análise de prática
    const [analisePratica, setAnalisePratica] = useState<any>(null);
    const [loadingPratica, setLoadingPratica] = useState(false);

    // Sugestão de resposta
    const [sugestao, setSugestao] = useState<{ opcoes: Array<{ tom: string; sugestao_jp: string; sugestao_pt: string; dica: string }> } | null>(null);
    const [loadingSugestao, setLoadingSugestao] = useState(false);

    // Dúvida
    const [duvidaInput, setDuvidaInput] = useState('');
    const [respostaDuvida, setRespostaDuvida] = useState('');
    const [loadingDuvida, setLoadingDuvida] = useState(false);

    // Lacuna assistida
    const [lacunaAtiva, setLacunaAtiva] = useState<{ termoPt: string; raw: string } | null>(null);
    const [sugestoesLacuna, setSugestoesLacuna] = useState<any[]>([]);
    const [loadingLacuna, setLoadingLacuna] = useState(false);

    // Área de resultado (scroll ref)
    const resultadoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPraticaInput('');
            setAnalisePratica(null);
            setSugestao(null);
            setDuvidaInput('');
            setRespostaDuvida('');
            setModoAtivo(null);
            setLacunaAtiva(null);
            setSugestoesLacuna([]);
            carregarVocabulario();
        }
    }, [isOpen, mensagem]);

    // Scroll para resultado quando modoAtivo muda e resultado aparece
    useEffect(() => {
        if (modoAtivo && resultadoRef.current) {
            setTimeout(() => {
                resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }, [analisePratica, sugestao, respostaDuvida]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const callEndpoint = async (acao: string, extraBody: any = {}) => {
        const body = {
            acao,
            provider: context.provider || 'groq',
            tema: context.tema,
            jlpt: context.jlpt,
            vocabulario: context.vocabularioBanco,
            mensagem_ia_jp: mensagem,
            ...extraBody
        };
        const response = await fetch('/api/dialogo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro na API');
        }
        return await response.json();
    };

    const carregarVocabulario = async () => {
        setLoadingVocab(true);
        try {
            const data = await callEndpoint('analisar_mensagem');
            if (data.vocabulario) setVocabulario(data.vocabulario);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingVocab(false);
        }
    };

    const handleAnalisar = async () => {
        if (!praticaInput.trim()) return;
        setModoAtivo('analisar');
        setAnalisePratica(null);
        setLoadingPratica(true);
        try {
            const data = await callEndpoint('analisar_pratica', { resposta_usuario_jp: praticaInput });
            setAnalisePratica(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPratica(false);
        }
    };

    const handleSugestao = async () => {
        setModoAtivo('sugestao');
        setSugestao(null);
        setLoadingSugestao(true);
        try {
            const data = await callEndpoint('sugerir_resposta');
            setSugestao(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSugestao(false);
        }
    };

    const handleDuvida = () => {
        setModoAtivo('duvida');
    };

    const enviarDuvida = async () => {
        if (!duvidaInput.trim()) return;
        setLoadingDuvida(true);
        setRespostaDuvida('');
        try {
            const data = await callEndpoint('tirar_duvida', { duvida_usuario: duvidaInput });
            setRespostaDuvida(data.resposta);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDuvida(false);
        }
    };

    const sugerirLacuna = async (termoPt: string, raw: string) => {
        setLacunaAtiva({ termoPt, raw });
        setSugestoesLacuna([]);
        setLoadingLacuna(true);
        try {
            const data = await callEndpoint('sugerir_lacuna', {
                frase_contexto: praticaInput,
                termo_pt: termoPt
            });
            if (data?.sugestoes) setSugestoesLacuna(data.sugestoes);
        } catch (e) {
            console.error('Erro ao sugerir lacuna:', e);
        } finally {
            setLoadingLacuna(false);
        }
    };

    const handleSelecionarSugestao = (textoPuro: string) => {
        if (!lacunaAtiva) return;
        const novoTexto = praticaInput.replace(lacunaAtiva.raw, textoPuro);
        setPraticaInput(novoTexto);
        setLacunaAtiva(null);
        setSugestoesLacuna([]);
    };

    if (!isOpen) return null;

    return (
        <div
            onClick={handleOverlayClick}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
        >
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] w-full max-w-[680px] h-[80vh] max-h-[85vh] flex flex-col overflow-hidden text-[var(--text-color)] font-sans">

                {/* ── Header ── */}
                <ModalHeader
                    title="Assistente de Prática"
                    onClose={onClose}
                    icon={<Sparkles size={18} style={{ color: 'var(--highlight-color)' }} />}
                />

                {/* ── Body ── */}
                <div className="flex flex-col flex-1 overflow-hidden p-0 gap-0">
                    
                    {/* Middle area (Chat Bubble + Vocabulary + Results) */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-4 pb-0 flex flex-col gap-4">
                        {/* 1. AI Message Chat Bubble */}
                        <ChatBubble mensagem={mensagem} />

                        {/* 2. Vocabulário colapsível */}
                        <VocabularyRibbon
                            vocabulario={vocabulario}
                            loadingVocab={loadingVocab}
                            provider={context.provider || 'groq'}
                        />

                        {/* 4. Área de resultado dinâmico */}
                        <DynamicResultArea
                            modoAtivo={modoAtivo}
                            praticaInput={praticaInput}
                            analisePratica={analisePratica}
                            loadingPratica={loadingPratica}
                            onAnalisar={handleAnalisar}
                            sugestao={sugestao}
                            loadingSugestao={loadingSugestao}
                            onSugestao={handleSugestao}
                            onPraticarSugestao={(textoJp) => {
                                const textoPuro = textoJp.replace(/<[^>]*>/g, '');
                                setPraticaInput(textoPuro);
                                setModoAtivo(null);
                                setSugestao(null);
                            }}
                            duvidaInput={duvidaInput}
                            setDuvidaInput={setDuvidaInput}
                            respostaDuvida={respostaDuvida}
                            loadingDuvida={loadingDuvida}
                            onEnviarDuvida={enviarDuvida}
                            onUsarResposta={onUsarResposta}
                            provider={context.provider || 'groq'}
                            resultadoRef={resultadoRef}
                        />
                    </div>

                    {/* 3. Campo de prática (Rigidly docked to the bottom) */}
                    <div className="mt-auto shrink-0">
                        <DraftInput
                            praticaInput={praticaInput}
                            setPraticaInput={setPraticaInput}
                            modoAtivo={modoAtivo}
                            onAnalisar={handleAnalisar}
                            onSugestao={handleSugestao}
                            onDuvida={handleDuvida}
                            lacunaAtiva={lacunaAtiva}
                            setLacunaAtiva={setLacunaAtiva}
                            sugestoesLacuna={sugestoesLacuna}
                            loadingLacuna={loadingLacuna}
                            onSugerirLacuna={sugerirLacuna}
                            onSelecionarSugestao={handleSelecionarSugestao}
                            provider={context.provider || 'groq'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
