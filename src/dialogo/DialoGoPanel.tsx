import React, { useState, useEffect, useRef, useCallback } from 'react';
import InteractiveText from '../components/InteractiveText';
import ScoreBadge from './components/ScoreBadge';
import KanaKanjiInput from './components/KanaKanjiInput';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';
import AjudaModal from './components/AjudaModal';
import ProgressoDrawer from './components/ProgressoDrawer';
import PalavraNovaPopover, { PalavraAdaptativa, StatusAdaptativo } from './components/PalavraNovaPopover';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DialoGoPanelProps {
    context: any;
    session?: any;
    onBack: () => void;
    onUpdateContext: (data: Partial<any>) => void;
}

export default function DialoGoPanel({ context, session, onBack, onUpdateContext }: DialoGoPanelProps) {
    const [loading, setLoading] = useState(true);
    const [contextoDialogo, setContextoDialogo] = useState('');
    const [historico, setHistorico] = useState<any[]>([]);
    const [inputUser, setInputUser] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(context.provider || (localStorage.getItem('selected_provider') as any) || 'groq');
    const [fallbackOpen, setFallbackOpen] = useState(false);
    const [fallbackError, setFallbackError] = useState('');
    const [pendingAction, setPendingAction] = useState<'iniciar' | 'continuar' | null>(null);
    const [pendingMessage, setPendingMessage] = useState('');
    const [ajudaModal, setAjudaModal] = useState<{isOpen: boolean, mensagem: string}>({isOpen: false, mensagem: ''});
    const [progressoOpen, setProgressoOpen] = useState(false);

    // Vocabulário Adaptativo
    const [vocabularioAdaptativo, setVocabularioAdaptativo] = useState<PalavraAdaptativa[]>([]);
    // Map de msgIndex -> set de itens novos introduzidos naquela mensagem
    const [novasPorMensagem, setNovasPorMensagem] = useState<Record<number, string[]>>({});
    // Popover da palavra nova
    const [popoverPalavra, setPopoverPalavra] = useState<{ info: PalavraAdaptativa; x: number; y: number } | null>(null);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const stateRef = useRef({ contextoDialogo, historico, inputUser });
    useEffect(() => {
        stateRef.current = { contextoDialogo, historico, inputUser };
    }, [contextoDialogo, historico, inputUser]);

    useEffect(() => {
        if (context.dialogoDados) {
            setContextoDialogo(context.dialogoDados.contexto || '');
            setHistorico(context.dialogoDados.historico || []);
            setInputUser(context.dialogoDados.inputUser || '');
            setLoading(false);
        } else {
            iniciarDialogo(context.provider);
        }

        return () => {
            onUpdateContext({
                dialogoDados: {
                    contexto: stateRef.current.contextoDialogo,
                    historico: stateRef.current.historico,
                    inputUser: stateRef.current.inputUser
                }
            });
        };
    }, []);

    useEffect(() => {
        // Auto scroll to bottom
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [historico, enviando]);

    const iniciarDialogo = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = context.provider || 'groq') => {
        setLoading(true);
        setProvider(targetProvider);
        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) {
                headers['X-Gemini-Key'] = userKey;
            }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    provider: targetProvider,
                    acao: 'iniciar_dialogo',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();
            
            setContextoDialogo(data.contexto);
            if (data.historico && data.historico.length > 0) {
                setHistorico(data.historico);
            } else {
                setHistorico([
                    {
                        role: 'assistant',
                        jp: data.mensagem_ia_jp,
                        pt: data.mensagem_ia_pt,
                        content: data.mensagem_ia_jp
                    }
                ]);
            }
        } catch (e: any) {
            console.error(e);
            if (targetProvider === 'gemini') {
                setPendingAction('iniciar');
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao iniciar diálogo com ${targetProvider}: ${e.message || e}`);
            }
        }
        setLoading(false);
    };

    const enviarMensagem = async (e?: React.FormEvent, targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = context.provider || 'groq', textToSend?: string) => {
        if (e) e.preventDefault();
        const textoJp = textToSend !== undefined ? textToSend : inputUser.trim();
        if (!textoJp) return;

        setEnviando(true);
        setProvider(targetProvider);
        if (textToSend === undefined) {
            setInputUser('');
        }
        
        // Add user message optimistically (only on first attempt, not retry)
        let novoHistorico = [...historico];
        if (textToSend === undefined) {
            novoHistorico.push({ role: 'user', content: textoJp, jp: textoJp });
            setHistorico(novoHistorico);
        }

        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) {
                headers['X-Gemini-Key'] = userKey;
            }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    provider: targetProvider,
                    acao: 'continuar_dialogo',
                    historico: novoHistorico.map(m => ({ role: m.role, content: m.content })),
                    resposta_usuario_jp: textoJp,
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId,
                    palavras_aprendendo: vocabularioAdaptativo.filter(p =>
                        p.status === 'aprendendo_medio' || p.status === 'aprendendo_dificil'
                    )
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();

            // Processa palavras novas introduzidas pela IA
            const novasIntroducidas: PalavraAdaptativa[] = (data.palavras_novas_introducidas || []).map((p: any) => ({
                item: p.item,
                leitura: p.leitura || '',
                significado: p.significado || '',
                tipo: p.tipo || '',
                status: 'novo' as StatusAdaptativo,
                vezesUsadaPeloAluno: 0,
                vezesIntroducida: 1
            }));

            if (novasIntroducidas.length > 0) {
                setVocabularioAdaptativo(prev => {
                    const existentes = new Set(prev.map(p => p.item));
                    const reaisNovas = novasIntroducidas.filter(p => !existentes.has(p.item));
                    return [...prev, ...reaisNovas];
                });
            }

            // Verifica se o aluno usou palavras em aprendizado na resposta
            if (textoJp) {
                setVocabularioAdaptativo(prev => prev.map(p => {
                    if ((p.status === 'aprendendo_medio' || p.status === 'aprendendo_dificil') &&
                        textoJp.includes(p.item)) {
                        const novasVezes = p.vezesUsadaPeloAluno + 1;
                        let novoStatus = p.status;
                        if (p.status === 'aprendendo_dificil' && novasVezes >= 2) novoStatus = 'aprendendo_medio';
                        else if (p.status === 'aprendendo_medio' && novasVezes >= 3) novoStatus = 'aprendido';
                        return { ...p, vezesUsadaPeloAluno: novasVezes, status: novoStatus };
                    }
                    return p;
                }));
            }

            if (data.historico && data.historico.length > 0) {
                const newHist = data.historico;
                setHistorico(newHist);
                // Registra quais palavras novas foram na última mensagem da IA
                if (novasIntroducidas.length > 0) {
                    const lastIdx = newHist.length - 1;
                    setNovasPorMensagem(prev => ({
                        ...prev,
                        [lastIdx]: novasIntroducidas.map(p => p.item)
                    }));
                }
            } else {
                const updateHistorico = [...novoHistorico];
                updateHistorico[updateHistorico.length - 1].analise = data.analise;
                updateHistorico[updateHistorico.length - 1].score = data.score;
                updateHistorico.push({
                    role: 'assistant',
                    jp: data.mensagem_ia_jp,
                    pt: data.mensagem_ia_pt,
                    content: data.mensagem_ia_jp
                });
                setHistorico(updateHistorico);
                if (novasIntroducidas.length > 0) {
                    const lastIdx = updateHistorico.length - 1;
                    setNovasPorMensagem(prev => ({
                        ...prev,
                        [lastIdx]: novasIntroducidas.map(p => p.item)
                    }));
                }
            }
        } catch (error: any) {
            console.error(error);
            if (targetProvider === 'gemini') {
                setPendingAction('continuar');
                setPendingMessage(textoJp);
                setFallbackError(error.message || String(error));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao enviar mensagem com ${targetProvider}: ${error.message || error}`);
                setInputUser(textoJp); // restore input
            }
        }
        setEnviando(false);
    };

    const tocarAudio = (texto: string) => {
        const textoPuro = texto
            .replace(/<rt>.*?<\/rt>/g, '')
            .replace(/<[^>]*>/g, '');
        
        const utterance = new SpeechSynthesisUtterance(textoPuro);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
    };

    // Handler para avaliação de dificuldade de palavra nova
    const handleAvaliarPalavra = useCallback(async (item: string, dificuldade: 'facil' | 'medio' | 'dificil') => {
        const novoStatus: StatusAdaptativo =
            dificuldade === 'facil' ? 'aprendido' :
            dificuldade === 'medio' ? 'aprendendo_medio' : 'aprendendo_dificil';

        const palavraInfo = vocabularioAdaptativo.find(p => p.item === item);
        if (!palavraInfo) return;

        setVocabularioAdaptativo(prev =>
            prev.map(p => p.item === item ? { ...p, status: novoStatus, avaliadaEm: new Date().toISOString() } : p)
        );
        setPopoverPalavra(null);

        if (!session?.access_token) return;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        };
        const srsRepetitions = dificuldade === 'facil' ? 2 : dificuldade === 'medio' ? 1 : 0;

        try {
            // Salva no banco de vocabulário (jisho)
            if (dificuldade === 'facil') {
                await fetch('/api/jisho?acao=salvar', {
                    method: 'POST', headers,
                    body: JSON.stringify({
                        item: palavraInfo.item,
                        leitura: palavraInfo.leitura,
                        significado: palavraInfo.significado,
                        categoria: palavraInfo.tipo || 'Vocabulário',
                        jlpt: context.jlpt || 'N5',
                        conjuntos: context.conjuntoDestino ? [context.conjuntoDestino] : ['Geral'],
                        baralhos: context.baralhoDestino ? [context.baralhoDestino] : []
                    })
                });
            }
            // Inicializa no SRS
            await fetch('/api/srs?acao=salvar', {
                method: 'POST', headers,
                body: JSON.stringify({
                    item: palavraInfo.item,
                    leitura: palavraInfo.leitura,
                    significado: palavraInfo.significado,
                    repetitions: srsRepetitions,
                    due: Date.now()
                })
            });
        } catch (e) {
            console.error('Erro ao persistir palavra adaptativa:', e);
        }
    }, [vocabularioAdaptativo, session, context]);

    // Handler para clique em palavra nova/aprendendo no chat
    const handlePalavraNovaClick = useCallback((item: string, x: number, y: number) => {
        const info = vocabularioAdaptativo.find(p => p.item === item);
        if (info) setPopoverPalavra({ info, x, y });
    }, [vocabularioAdaptativo]);

    if (loading) {
        return (
            <div className="p-5">
                <AiLoader 
                    provider={provider} 
                    message={`${provider.charAt(0).toUpperCase() + provider.slice(1)} está preparando o Cenário`} 
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-3xl mx-auto h-[calc(100vh-220px)] min-h-[500px]">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-5">
                <Button
                    variant="outline"
                    onClick={onBack}
                    className="text-sm"
                >
                    ← Voltar à Tradução
                </Button>
                <h2 className="text-lg font-bold text-foreground m-0">Diálogo</h2>
                <Button
                    variant="outline"
                    onClick={() => setProgressoOpen(true)}
                    className="text-sm flex items-center gap-1.5 font-semibold hover:bg-accent"
                >
                    📊 Progresso
                </Button>
            </div>

            {/* Banner do cenário */}
            {contextoDialogo && (
                <div className="bg-primary text-primary-foreground px-4 py-3 rounded-xl mb-5 text-center text-sm">
                    <strong>Cenário:</strong> {contextoDialogo}
                </div>
            )}

            {/* Área de mensagens com ScrollArea do Radix */}
            <Card className="flex-1 min-h-0 mb-5 overflow-hidden border border-border bg-card shadow-sm">
                <ScrollArea className="h-full w-full">
                    <div className="flex flex-col gap-5 p-5">
                        {historico.map((msg, i) => {
                            const isIA = msg.role === 'assistant';
                            return (
                                <div
                                    key={i}
                                    className={`flex flex-col w-full ${isIA ? 'items-start' : 'items-end'}`}
                                >
                                    {/* Balão de mensagem */}
                                    <div
                                        className={[
                                            'max-w-[80%] px-4 py-3 rounded-2xl',
                                            isIA
                                                ? 'rounded-bl-none bg-muted text-foreground'
                                                : 'rounded-br-none bg-primary text-primary-foreground',
                                        ].join(' ')}
                                    >
                                        <div className="text-lg flex items-center gap-2 flex-wrap">
                                            <InteractiveText
                                                text={msg.jp}
                                                palavrasNovas={isIA ? new Set(novasPorMensagem[i] || []) : undefined}
                                                palavrasAprendendo={isIA ? Object.fromEntries(
                                                    vocabularioAdaptativo
                                                        .filter(p => p.status === 'aprendendo_medio' || p.status === 'aprendendo_dificil')
                                                        .map(p => [p.item, p.status === 'aprendendo_medio' ? 'medio' : 'dificil' as 'medio' | 'dificil'])
                                                ) : undefined}
                                                onPalavraAdaptativaClick={isIA ? handlePalavraNovaClick : undefined}
                                            />
                                            {isIA && (
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => tocarAudio(msg.jp)}
                                                        title="Ouvir"
                                                        className="h-7 w-7 text-muted-foreground"
                                                    >
                                                        🔊
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setAjudaModal({isOpen: true, mensagem: msg.jp})}
                                                        className="h-7 px-2 text-xs font-bold border-accent-foreground/30 bg-accent/10 text-foreground"
                                                    >
                                                        💬 Ajuda
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {isIA && msg.pt && (
                                            <details className="mt-2 text-sm text-muted-foreground">
                                                <summary className="cursor-pointer">Tradução</summary>
                                                <p className="mt-1 mb-0"><InteractiveText text={msg.pt} /></p>
                                            </details>
                                        )}
                                    </div>

                                    {/* Caixa de análise para mensagem do usuário */}
                                    {!isIA && msg.analise && (
                                        <div className="max-w-[80%] mt-2 p-4 rounded-xl bg-card border border-border flex gap-4 items-center">
                                            <ScoreBadge score={msg.score || 0} />
                                            <div className="text-sm">
                                                <strong>Feedback do Sensei:</strong>
                                                <p className="mt-1 mb-0"><InteractiveText text={msg.analise} /></p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Indicador "digitando..." */}
                        {enviando && (
                            <div className="self-start max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-none bg-muted text-foreground flex items-center gap-2">
                                <img
                                    src={
                                        provider === 'gemini'
                                            ? 'https://cdnl.iconscout.com/lottie/premium/thumb/gemini-logo-animation-gif-download-10900314.gif'
                                            : provider === 'groq'
                                            ? 'https://raw.githubusercontent.com/lobehub/lobe-icons/main/icons/groq.svg'
                                            : 'https://cdnl.iconscout.com/lottie/premium/thumb/chatgpt-animation-gif-download-6633794.gif'
                                    }
                                    alt={provider}
                                    className={`w-7 h-7 object-contain ${provider === 'groq' ? 'groqPulse' : ''}`}
                                />
                                <span className="text-sm italic text-muted-foreground">
                                    {`${provider.charAt(0).toUpperCase() + provider.slice(1)} está digitando...`}
                                </span>
                            </div>
                        )}

                        {/* Sentinela de autoscroll — deve ser o último elemento da lista */}
                        <div ref={chatEndRef} />
                    </div>
                </ScrollArea>
            </Card>

            {/* Formulário de envio */}
            <form
                onSubmit={(e) => enviarMensagem(e, provider || context.provider || 'groq')}
                className="flex gap-2 items-end"
            >
                <div className="flex-1">
                    <KanaKanjiInput
                        value={inputUser}
                        onChange={setInputUser}
                        onSendMessage={() => enviarMensagem(undefined, provider || context.provider || 'groq')}
                        placeholder="Digite em romaji... Espaço para Kanji"
                        disabled={enviando}
                        className="text-base h-12 border-2 border-input bg-card text-foreground"
                    />
                </div>
                <Button
                    type="submit"
                    disabled={enviando || !inputUser.trim()}
                    className="h-12 px-7 text-base font-bold"
                >
                    Enviar
                </Button>
            </form>

            <AiFallbackPopup 
                isOpen={fallbackOpen} 
                errorMessage={fallbackError}
                onRetryGemini={() => {
                    setFallbackOpen(false);
                    if (pendingAction === 'iniciar') iniciarDialogo(provider || context.provider || 'groq');
                    else if (pendingAction === 'continuar') enviarMensagem(undefined, provider || context.provider || 'groq', pendingMessage);
                }}
                onFallbackPollinations={() => {
                    setFallbackOpen(false);
                    if (pendingAction === 'iniciar') iniciarDialogo('pollinations');
                    else if (pendingAction === 'continuar') enviarMensagem(undefined, 'pollinations', pendingMessage);
                }}
                onCancel={() => setFallbackOpen(false)}
            />

            <AjudaModal
                isOpen={ajudaModal.isOpen}
                onClose={() => setAjudaModal({isOpen: false, mensagem: ''})}
                mensagem={ajudaModal.mensagem}
                context={context}
                session={session}
                onUsarResposta={(texto) => { setInputUser(texto); setAjudaModal({isOpen: false, mensagem: ''}); }}
            />

            <ProgressoDrawer
                isOpen={progressoOpen}
                onClose={() => setProgressoOpen(false)}
                historico={historico}
                session={session}
                currentSessionId={context.sessionId}
                tema={context.tema}
            />

            {/* Popover de palavra nova/aprendendo */}
            {popoverPalavra && (
                <PalavraNovaPopover
                    palavra={popoverPalavra.info}
                    x={popoverPalavra.x}
                    y={popoverPalavra.y}
                    onAvaliar={handleAvaliarPalavra}
                    onClose={() => setPopoverPalavra(null)}
                />
            )}
        </div>
    );
}
