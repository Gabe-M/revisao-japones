import React, { useState, useEffect, useRef } from 'react';
import InteractiveText from '../../components/InteractiveText';
import AiLoader from './AiLoader';
import ScoreBadge from './ScoreBadge';
import * as wanakana from 'wanakana';
import { Book, MessageCircle, HelpCircle, Dumbbell, Check, Send, Play, ChevronDown, ChevronUp, Sparkles, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { adicionarAoAnki } from '../services/ankiService';
import { buscarExemploETradução } from '../utils/sentenceMining';
import { toast } from '../../components/ui/use-toast';

interface AjudaModalProps {
    isOpen: boolean;
    onClose: () => void;
    mensagem: string; // raw JP string with ruby tags
    context: any; // tema, jlpt, vocabularioBanco, provider
    session?: any;
    onUsarResposta: (texto: string) => void;
}

type ModoAtivo = 'analisar' | 'sugestao' | 'duvida' | null;

export default function AjudaModal({ isOpen, onClose, mensagem, context, session, onUsarResposta }: AjudaModalProps) {
    // Vocabulário (automático)
    const [vocabTab, setVocabTab] = useState<'extraido' | 'relacionado'>('extraido');
    const [vocabulario, setVocabulario] = useState<any[]>([]);
    const [loadingVocab, setLoadingVocab] = useState(false);
    const [vocabularioRelacionado, setVocabularioRelacionado] = useState<any[]>([]);
    const [loadingVocabRel, setLoadingVocabRel] = useState(false);
    const [vocabAberto, setVocabAberto] = useState(true);

    // Vocabulário Extraído - Salvamento (R3)
    const [salvandoMap, setSalvandoMap] = useState<Record<string, boolean>>({});
    const [salvosMap, setSalvosMap] = useState<Record<string, boolean>>({});
    const [adicionandoAnkiMap, setAdicionandoAnkiMap] = useState<Record<string, boolean>>({});

    // Campo de prática
    const [praticaInput, setPraticaInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Modo ativo (qual seção de resultado mostrar)
    const [modoAtivo, setModoAtivo] = useState<ModoAtivo>(null);

    // Análise de prática (R1)
    const [analisePratica, setAnalisePratica] = useState<any>(null);
    const [loadingPratica, setLoadingPratica] = useState(false);

    // Sugestões de resposta - 3 Cards (R2)
    const [sugestoes, setSugestoes] = useState<any[]>([]);
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
            setSugestoes([]);
            setDuvidaInput('');
            setRespostaDuvida('');
            setModoAtivo(null);
            setLacunaAtiva(null);
            setSugestoesLacuna([]);
            setVocabAberto(true);
            setVocabTab('extraido');
            setSalvandoMap({});
            setSalvosMap({});
            carregarVocabulario();
            carregarVocabularioRelacionado();
        }
    }, [isOpen, mensagem]);

    // Scroll para resultado quando modoAtivo muda e resultado aparece
    useEffect(() => {
        if (modoAtivo && resultadoRef.current) {
            setTimeout(() => {
                resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }, [analisePratica, sugestoes, respostaDuvida]);

    const handlePraticaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawVal = e.target.value;
        const selectionStart = e.target.selectionStart || 0;
        const prefix = rawVal.substring(0, selectionStart);
        const lastOpenBracket = prefix.lastIndexOf('[');
        const lastCloseBracket = prefix.lastIndexOf(']');
        const isInsideBracket = lastOpenBracket > lastCloseBracket;

        if (isInsideBracket) {
            setPraticaInput(rawVal);
        } else {
            const regex = /(\[.*?\])/g;
            const parts = rawVal.split(regex);
            const convertedParts = parts.map(part => {
                if (part.startsWith('[') && part.endsWith(']')) return part;
                return wanakana.toHiragana(part, { IMEMode: true });
            });
            const convertedVal = convertedParts.join('');
            setPraticaInput(convertedVal);

            const prefixParts = prefix.split(regex);
            const convertedPrefix = prefixParts.map(part => {
                if (part.startsWith('[') && part.endsWith(']')) return part;
                return wanakana.toHiragana(part, { IMEMode: true });
            }).join('');
            const newCursorPos = convertedPrefix.length;
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
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
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers['Authorization'] = 'Bearer ' + session.access_token;
        }
        const response = await fetch('/api/dialogo', {
            method: 'POST',
            headers,
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
            if (data.vocabulario && Array.isArray(data.vocabulario)) {
                const punctuationRegex = /^[.,\/#!$%\^&\*;:{}=\-_`~()!?\s、。！?？]+$/;
                const filtered = data.vocabulario.filter((v: any) => {
                    if (!v || !v.item) return false;
                    const itemClean = v.item.trim();
                    if (itemClean === '') return false;
                    if (punctuationRegex.test(itemClean)) return false;
                    return true;
                });
                setVocabulario(filtered);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingVocab(false);
        }
    };

    const carregarVocabularioRelacionado = async () => {
        setLoadingVocabRel(true);
        try {
            const data = await callEndpoint('obter_vocabulario_relacionado');
            if (data.vocabulario && Array.isArray(data.vocabulario)) {
                const punctuationRegex = /^[.,\/#!$%\^&\*;:{}=\-_`~()!?\s、。！?？]+$/;
                const msgLimpa = mensagem.replace(/<[^>]*>/g, '');
                const kanjisInMsg = new Set(msgLimpa.match(/[\u4E00-\u9FFF]/g) || []);

                const filtered = data.vocabulario.filter((v: any) => {
                    if (!v || !v.item) return false;
                    const itemClean = v.item.trim().replace(/<[^>]*>/g, '');
                    if (itemClean === '') return false;
                    if (itemClean.length > 10) return false; // Rejeita frases longas
                    if (/[。！!？?\n,]/.test(itemClean)) return false; // Rejeita pontuações de frases
                    if (punctuationRegex.test(itemClean)) return false;
                    if (msgLimpa.includes(itemClean)) return false;

                    // Rejeita se for apenas a recombinação de Kanjis que já apareceram na mensagem
                    const kanjisInItem = itemClean.match(/[\u4E00-\u9FFF]/g) || [];
                    if (kanjisInItem.length > 0) {
                        const allKanjisExist = kanjisInItem.every((k: string) => kanjisInMsg.has(k));
                        if (allKanjisExist) return false;
                    }

                    return true;
                });
                setVocabularioRelacionado(filtered);
            }
        } catch (e) {
            console.error('Erro ao carregar vocabulário relacionado:', e);
        } finally {
            setLoadingVocabRel(false);
        }
    };

    const handleSalvarVocabulario = async (itemVocab: any) => {
        const key = itemVocab.item;
        if (!session?.access_token) {
            alert("Sessão não autenticada. Por favor, faça login.");
            return;
        }
        setSalvandoMap(prev => ({ ...prev, [key]: true }));
        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            };

            // Dual HTTP POST 1: Jisho API
            const resJisho = await fetch('/api/jisho?acao=salvar', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    item: itemVocab.item,
                    leitura: itemVocab.leitura || '',
                    significado: itemVocab.significado || '',
                    categoria: itemVocab.tipo || 'Vocabulário',
                    jlpt: context?.jlpt || 'N5'
                })
            });
            if (!resJisho.ok) {
                const err = await resJisho.json().catch(() => ({}));
                throw new Error(err.error || `Erro Jisho (${resJisho.status})`);
            }

            // Dual HTTP POST 2: SRS API
            const resSrs = await fetch('/api/srs?acao=salvar', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    item: itemVocab.item,
                    leitura: itemVocab.leitura || '',
                    significado: itemVocab.significado || '',
                    repetitions: 0,
                    due: new Date().toISOString()
                })
            });
            if (!resSrs.ok) {
                const err = await resSrs.json().catch(() => ({}));
                throw new Error(err.error || `Erro SRS (${resSrs.status})`);
            }

            setSalvosMap(prev => ({ ...prev, [key]: true }));
        } catch (e: any) {
            console.error("Erro ao salvar vocabulário:", e);
            alert(`Falha ao salvar "${itemVocab.item}": ${e.message || e}`);
        } finally {
            setSalvandoMap(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleAdicionarAnki = async (itemStr: string) => {
        if (!itemStr) return;
        setAdicionandoAnkiMap(prev => ({ ...prev, [itemStr]: true }));
        try {
            const historico = context?.dialogoDados?.historico || context?.historico || [{ jp: mensagem }];
            const { exemplo_jp, exemplo_pt } = buscarExemploETradução(historico, itemStr);

            const body: Record<string, any> = {
                acao: 'enriquecer_card',
                item: itemStr,
                exemplo_jp: exemplo_jp || null,
                exemplo_pt: exemplo_pt || null,
                provider: context?.provider || 'groq'
            };

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch('/api/dialogo', {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('Anki não está aberto ou AnkiConnect falhou');
            }

            const enrichedItem = await response.json();
            await adicionarAoAnki(enrichedItem);

            toast({
                title: "Anki",
                description: "Card adicionado ao Anki com sucesso!",
                variant: "default"
            });
        } catch (err: any) {
            console.error("Erro ao adicionar ao Anki:", err);
            toast({
                title: "Anki não está aberto ou AnkiConnect falhou",
                variant: "destructive"
            });
        } finally {
            setAdicionandoAnkiMap(prev => ({ ...prev, [itemStr]: false }));
        }
    };

    const handleInserirVocabularioNaResposta = (item: string) => {
        const itemLimpo = item.replace(/<[^>]*>/g, '').trim();
        if (!itemLimpo) return;
        setPraticaInput(prev => prev ? `${prev} ${itemLimpo}` : itemLimpo);
        setTimeout(() => inputRef.current?.focus(), 50);
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
        setSugestoes([]);
        setLoadingSugestao(true);
        try {
            const data = await callEndpoint('sugerir_multiplas_respostas');
            if (data.sugestoes && Array.isArray(data.sugestoes)) {
                setSugestoes(data.sugestoes);
            } else {
                setSugestoes([]);
            }
        } catch (e) {
            console.error('Erro ao carregar sugestões:', e);
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

    const usarSugestaoNoCampo = (textoJp: string) => {
        const textoPuro = textoJp.replace(/<[^>]*>/g, '');
        setPraticaInput(textoPuro);
        setModoAtivo(null);
        setSugestoes([]);
        setTimeout(() => inputRef.current?.focus(), 50);
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

    const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

    const renderLivePreview = () => {
        if (!praticaInput) return null;
        return (
            <>
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-[0.75rem] text-muted-foreground block mb-2 font-semibold uppercase tracking-wider">Visualização</span>
                    <div className="text-[1.1em] leading-relaxed">
                        {praticaInput.split(/(\[.*?\])/g).map((parte, index) => {
                            if (parte.startsWith('[') && parte.endsWith(']')) {
                                const termoLimpo = parte.slice(1, -1);
                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => sugerirLacuna(termoLimpo, parte)}
                                        className={`text-white px-2.5 py-0.5 rounded-md cursor-pointer border-none font-semibold mx-1 shadow-sm transition-all duration-200 ${
                                            lacunaAtiva?.raw === parte
                                                ? 'bg-gradient-to-br from-orange-500 to-amber-600 scale-[1.08]'
                                                : 'bg-gradient-to-br from-red-500 to-rose-600 scale-100 hover:opacity-95'
                                        }`}
                                    >
                                        {termoLimpo}
                                    </button>
                                );
                            }
                            return <span key={index}>{parte}</span>;
                        })}
                    </div>
                </div>

                {lacunaAtiva && (
                    <div className="p-4 bg-card border border-rose-500/30 rounded-xl shadow-lg">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-semibold text-muted-foreground">
                                Sugestões para "{lacunaAtiva.termoPt}"
                            </span>
                            <button
                                type="button"
                                onClick={() => setLacunaAtiva(null)}
                                className="bg-transparent border-none text-muted-foreground cursor-pointer p-1 hover:text-foreground transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {loadingLacuna ? (
                            <div className="py-4 text-center">
                                <AiLoader provider={context.provider || 'groq'} message="Buscando traduções..." />
                            </div>
                        ) : sugestoesLacuna.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {sugestoesLacuna.map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelecionarSugestao(s.texto_puro)}
                                        className="p-3 rounded-lg bg-muted/50 cursor-pointer border border-border/50 transition-all duration-200 hover:border-rose-500/50 hover:bg-rose-500/10"
                                    >
                                        <div className="text-[1.15em] mb-1">
                                            <InteractiveText text={s.termo_jp} />
                                        </div>
                                        <p className="m-0 text-xs text-muted-foreground">{s.explicacao_curta}</p>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}
            </>
        );
    };

    const renderResultado = () => {
        if (!modoAtivo) return null;

        return (
            <div ref={resultadoRef} className="transition-all">
                {/* Analisar (R1) */}
                {modoAtivo === 'analisar' && (
                    <div>
                        {loadingPratica ? (
                            <div className="text-center py-6">
                                <AiLoader provider={context.provider || 'groq'} message="Avaliando sua resposta..." />
                            </div>
                        ) : analisePratica ? (
                            <div className="flex flex-col gap-3.5">
                                <div className="relative bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="absolute top-4 right-4">
                                        <ScoreBadge score={analisePratica.score || 0} />
                                    </div>
                                    <div className="pr-[60px]">
                                        <div className={`font-bold text-sm mb-3 ${analisePratica.correto ? 'text-green-500' : 'text-rose-500'}`}>
                                            {analisePratica.correto ? '✨ Resposta adequada' : '⚠️ Precisa de revisão'}
                                        </div>

                                        {/* R1: Accordion para erros_detalhados */}
                                        {analisePratica.erros_detalhados && analisePratica.erros_detalhados.length > 0 ? (
                                            <div className="mb-3.5">
                                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                    Erros encontrados ({analisePratica.erros_detalhados.length})
                                                </div>
                                                <Accordion type="single" collapsible className="w-full space-y-2">
                                                    {analisePratica.erros_detalhados.map((item: any, i: number) => (
                                                        <AccordionItem key={i} value={`erro-${i}`} className="border border-rose-500/20 rounded-lg bg-rose-500/5 px-3">
                                                            <AccordionTrigger className="text-rose-400 font-semibold hover:no-underline py-2.5 text-sm">
                                                                <span>{item.erro || `Erro ${i + 1}`}</span>
                                                            </AccordionTrigger>
                                                            <AccordionContent className="pt-1 pb-3 text-xs space-y-2 text-foreground/90">
                                                                {item.regra_gramatical && (
                                                                    <div>
                                                                        <span className="font-semibold text-amber-400">Regra Gramatical: </span>
                                                                        <span className="text-foreground font-medium">{item.regra_gramatical}</span>
                                                                    </div>
                                                                )}
                                                                {item.explicacao && (
                                                                    <div>
                                                                        <span className="font-semibold text-muted-foreground">Explicação: </span>
                                                                        <p className="mt-0.5 text-muted-foreground leading-relaxed">{item.explicacao}</p>
                                                                    </div>
                                                                )}
                                                                {item.exemplo_correto && (
                                                                    <div className="mt-2 p-2 rounded bg-background/80 border border-border/60">
                                                                        <span className="font-semibold text-green-400 block mb-1 text-[0.7rem] uppercase tracking-wide">Exemplo Correto:</span>
                                                                        <div className="text-sm font-bold text-foreground">
                                                                            <InteractiveText text={item.exemplo_correto} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            </div>
                                        ) : analisePratica.erros?.length > 0 ? (
                                            <div className="mb-3.5">
                                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Erros encontrados</div>
                                                <ul className="text-rose-500 pl-5 my-1 text-sm space-y-1">
                                                    {analisePratica.erros.map((err: string, i: number) => <li key={i}>{err}</li>)}
                                                </ul>
                                            </div>
                                        ) : null}

                                        {analisePratica.dica && (
                                            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 text-sm">
                                                <strong className="text-purple-400">Dica:</strong> {analisePratica.dica}
                                            </div>
                                        )}
                                        {analisePratica.traducao_correta && (
                                            <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                                <div className="text-xs font-semibold text-green-500/90 uppercase tracking-wider mb-1">Como soaria mais natural</div>
                                                <div className="text-lg font-bold"><InteractiveText text={analisePratica.traducao_correta} /></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    onClick={() => onUsarResposta(stripTags(analisePratica.traducao_correta || praticaInput))}
                                    className="w-full flex items-center justify-center gap-2 h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-sm"
                                >
                                    <Play size={16} className="fill-current" />
                                    Usar {analisePratica.traducao_correta ? 'versão corrigida' : 'como resposta'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleAnalisar}
                                    className="self-start text-xs font-semibold"
                                >
                                    Analisar novamente
                                </Button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Sugestão (R2: 3 Cards) */}
                {modoAtivo === 'sugestao' && (
                    <div>
                        {loadingSugestao ? (
                            <div className="text-center py-6">
                                <AiLoader provider={context.provider || 'groq'} message="Gerando 3 opções de resposta..." />
                            </div>
                        ) : sugestoes && sugestoes.length > 0 ? (
                            <div className="flex flex-col gap-3.5">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    💡 Sugestões Contextuais de Resposta
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {sugestoes.map((s: any, idx: number) => {
                                        const intencao = s.intencao || s.tipo || 'Sugestão';
                                        const emoji = s.emoji || (intencao.toLowerCase().includes('concordar') ? '✅' : intencao.toLowerCase().includes('discordar') ? '🙅' : '🤔');
                                        const jpText = s.jp || s.texto_jp || '';
                                        const ptText = s.pt || s.traducao_pt || '';
                                        const dicaText = s.dica || '';

                                        let borderStyle = "border-border";
                                        let bgBadge = "bg-muted text-muted-foreground";
                                        if (intencao.toLowerCase().includes('concordar')) {
                                            borderStyle = "border-green-500/30 hover:border-green-500/50";
                                            bgBadge = "bg-green-500/10 text-green-500 border-green-500/20";
                                        } else if (intencao.toLowerCase().includes('discordar')) {
                                            borderStyle = "border-rose-500/30 hover:border-rose-500/50";
                                            bgBadge = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                                        } else if (intencao.toLowerCase().includes('perguntar')) {
                                            borderStyle = "border-amber-500/30 hover:border-amber-500/50";
                                            bgBadge = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                                        }

                                        return (
                                            <Card key={idx} className={`p-4 bg-card border ${borderStyle} transition-all shadow-sm flex flex-col gap-2.5`}>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${bgBadge}`}>
                                                        {emoji} {intencao}
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-foreground">
                                                    <InteractiveText text={jpText} />
                                                </div>
                                                <div className="text-sm text-muted-foreground font-medium">
                                                    {ptText}
                                                </div>
                                                {dicaText && (
                                                    <div className="flex gap-2 items-start p-2.5 bg-muted/40 border border-border/50 rounded-lg text-xs text-muted-foreground">
                                                        <MessageCircle size={14} className="shrink-0 mt-0.5 text-primary" />
                                                        <span>{dicaText}</span>
                                                    </div>
                                                )}
                                                <div className="flex gap-2 pt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => usarSugestaoNoCampo(jpText)}
                                                        className="flex-1 h-9 text-xs font-semibold"
                                                        title="Copia para o campo de prática para você editar"
                                                    >
                                                        ✏️ Praticar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => onUsarResposta(stripTags(jpText))}
                                                        className="flex-1 flex items-center justify-center gap-1 h-9 bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm"
                                                    >
                                                        <Check size={14} /> ✅ Usar direto
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleSugestao}
                                    className="self-start text-xs font-semibold mt-1"
                                >
                                    Gerar novas sugestões
                                </Button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Dúvida */}
                {modoAtivo === 'duvida' && (
                    <div className="flex flex-col gap-3.5">
                        <div className="text-xs text-muted-foreground mb-1">
                            Pergunte sobre gramática, contexto ou vocabulário da fala atual.
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                value={duvidaInput}
                                onChange={e => setDuvidaInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && enviarDuvida()}
                                placeholder="Qual é a sua dúvida?"
                                className="flex-1 text-sm bg-background"
                                autoFocus
                            />
                            <Button
                                onClick={enviarDuvida}
                                disabled={!duvidaInput.trim() || loadingDuvida}
                                className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm"
                            >
                                <Send size={16} />
                            </Button>
                        </div>
                        {loadingDuvida ? (
                            <div className="text-center py-6">
                                <AiLoader provider={context.provider || 'groq'} message="Pensando..." />
                            </div>
                        ) : respostaDuvida ? (
                            <div className="flex gap-3 items-start bg-card p-4 rounded-xl border border-border border-l-4 border-l-amber-500 shadow-sm">
                                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                                    <Book size={20} />
                                </div>
                                <div className="flex-1 text-sm leading-relaxed">
                                    <InteractiveText text={respostaDuvida} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className="z-50 flex flex-col w-[95vw] max-w-5xl h-[85vh] p-0 gap-0 bg-background bg-[#0b0e17] opacity-100 border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* ── Header ── */}
                <DialogHeader className="flex-row items-center justify-between px-6 py-[18px] border-b border-border flex-shrink-0 space-y-0">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground m-0">
                        <Sparkles size={18} className="text-primary" />
                        Assistente de Prática
                    </DialogTitle>
                    {/* DialogDescription obrigatório para acessibilidade */}
                    <DialogDescription className="sr-only">
                        Modal de ajuda para prática de diálogo em japonês
                    </DialogDescription>
                </DialogHeader>

                {/* ── Grid Principal de Duas Colunas (Split-View) ── */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 flex-1 min-h-0 overflow-hidden">
                    
                    {/* ── Coluna Esquerda: Contexto (5 Colunas) ── */}
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-4 min-h-0 overflow-hidden">
                        {/* Mensagem Atual */}
                        <div className="w-full shrink-0">
                            <div className="bg-muted/30 p-4 rounded-lg border border-border/60">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    MENSAGEM ATUAL
                                </div>
                                <div className="text-lg font-semibold text-foreground leading-snug">
                                    <InteractiveText text={mensagem} />
                                </div>
                            </div>
                        </div>

                        {/* Vocabulário (Tabs: Extraído / Relacionado) */}
                        <div className="w-full flex-1 flex flex-col min-h-0 gap-2">
                            <div className="flex items-center justify-between py-1 shrink-0 border-b border-border/40 pb-2">
                                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs font-semibold w-full">
                                    <button
                                        type="button"
                                        onClick={() => setVocabTab('extraido')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                            vocabTab === 'extraido'
                                                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                        }`}
                                    >
                                        <Book size={13} /> Extraído
                                        {!loadingVocab && vocabulario.length > 0 && (
                                            <span className={`rounded-full px-1.5 py-0.2 text-[0.65rem] font-bold ${
                                                vocabTab === 'extraido' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                                            }`}>
                                                {vocabulario.length}
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setVocabTab('relacionado')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                            vocabTab === 'relacionado'
                                                ? 'bg-rose-600 text-white font-bold shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                        }`}
                                    >
                                        <Sparkles size={13} /> Relacionado
                                        {!loadingVocabRel && vocabularioRelacionado.length > 0 && (
                                            <span className={`rounded-full px-1.5 py-0.2 text-[0.65rem] font-bold ${
                                                vocabTab === 'relacionado' ? 'bg-white/20 text-white' : 'bg-muted-foreground/20 text-muted-foreground'
                                            }`}>
                                                {vocabularioRelacionado.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 min-h-0 pr-3">
                                {vocabTab === 'extraido' ? (
                                    loadingVocab ? (
                                        <div className="py-6 text-center">
                                            <AiLoader provider={context.provider || 'groq'} message="Analisando vocabulário..." />
                                        </div>
                                    ) : vocabulario.length > 0 ? (
                                        <div className="flex flex-col gap-2.5">
                                            {vocabulario.map((v, idx) => (
                                                <div key={idx} className="bg-card p-3.5 rounded-xl border border-border shadow-sm flex flex-col gap-1.5 relative overflow-hidden transition-all hover:border-border/80">
                                                    <div className="flex justify-between items-start gap-2 pr-16">
                                                        <div className="text-base font-bold text-foreground">
                                                            <InteractiveText text={`<ruby>${v.item}<rt>${v.leitura}</rt></ruby>`} />
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-medium">{v.significado}</div>
                                                    {v.tipo && (
                                                        <div className="absolute top-2.5 right-2.5 text-[0.65rem] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                                                            {v.tipo}
                                                        </div>
                                                    )}
                                                    {/* R3: Botão Salvar (Jisho + SRS) & Anki */}
                                                    <div className="flex items-center justify-end mt-1 pt-2 border-t border-border/40 gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={adicionandoAnkiMap[v.item]}
                                                            onClick={() => handleAdicionarAnki(v.item)}
                                                            className="h-7 px-2.5 text-xs font-semibold hover:bg-purple-500/10 hover:text-purple-400 border-purple-500/30"
                                                        >
                                                            {adicionandoAnkiMap[v.item] ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Loader2 className="h-3 w-3 animate-spin" /> Adicionando...
                                                                </span>
                                                            ) : (
                                                                '🎴 Adicionar ao Anki'
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={salvandoMap[v.item] || salvosMap[v.item]}
                                                            onClick={() => handleSalvarVocabulario(v)}
                                                            className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                                                                salvosMap[v.item]
                                                                    ? 'bg-green-500/10 text-green-500 border-green-500/30 opacity-100 cursor-default font-bold'
                                                                    : 'hover:bg-primary/10 hover:text-primary'
                                                            }`}
                                                        >
                                                            {salvandoMap[v.item] ? (
                                                                <span className="animate-pulse">Salvando...</span>
                                                            ) : salvosMap[v.item] ? (
                                                                '✅ Salvo'
                                                            ) : (
                                                                '💾 Salvar'
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground py-4 text-xs">
                                            Nenhum vocabulário extraído.
                                        </div>
                                    )
                                ) : (
                                    loadingVocabRel ? (
                                        <div className="py-6 text-center">
                                            <AiLoader provider={context.provider || 'groq'} message="Buscando vocabulário para resposta..." />
                                        </div>
                                    ) : vocabularioRelacionado.length > 0 ? (
                                        <div className="flex flex-col gap-2.5">
                                            {vocabularioRelacionado.map((v, idx) => (
                                                <div key={idx} className="bg-card p-3.5 rounded-xl border border-rose-500/20 shadow-sm flex flex-col gap-1.5 relative overflow-hidden transition-all hover:border-rose-500/50 group">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="text-base font-bold text-foreground">
                                                            <InteractiveText text={`<ruby>${v.item}<rt>${v.leitura}</rt></ruby>`} />
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={adicionandoAnkiMap[v.item]}
                                                                onClick={() => handleAdicionarAnki(v.item)}
                                                                className="h-7 px-2 text-[0.7rem] font-semibold border-purple-500/20 text-purple-400 hover:bg-purple-600 hover:text-white"
                                                            >
                                                                {adicionandoAnkiMap[v.item] ? (
                                                                    <span className="flex items-center gap-1">
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    </span>
                                                                ) : (
                                                                    '🎴 Adicionar ao Anki'
                                                                )}
                                                            </Button>
                                                            {v.tipo && (
                                                                <span className="text-[0.65rem] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                                    {v.tipo}
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleInserirVocabularioNaResposta(v.item)}
                                                                className="text-[0.7rem] font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white px-2 py-0.5 rounded-md transition-all cursor-pointer border border-rose-500/20"
                                                                title="Inserir palavra na sua resposta"
                                                            >
                                                                + Usar
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-medium">{v.significado}</div>
                                                    {v.dica_uso && (
                                                        <div className="text-[0.75rem] text-rose-400/90 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 font-normal">
                                                            💡 {v.dica_uso}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground py-4 text-xs">
                                            Nenhum vocabulário relacionado encontrado.
                                        </div>
                                    )
                                )}
                            </ScrollArea>
                        </div>
                    </div>

                    {/* ── Coluna Direita: Workspace Ativo (7 Colunas) ── */}
                    <div className="col-span-12 md:col-span-7 flex flex-col gap-4 min-h-0 overflow-hidden">
                        
                        {/* Bloco Unificado: Input + Live Preview */}
                        <div className="bg-card p-4 rounded-xl border border-border flex flex-col gap-3 shadow-sm shrink-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <Dumbbell size={14} /> Sua Resposta
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={praticaInput}
                                    onChange={handlePraticaInputChange}
                                    onKeyDown={e => e.key === 'Enter' && modoAtivo === 'analisar' && handleAnalisar()}
                                    placeholder="Digite em romaji (converte para hiragana automaticamente)..."
                                    className="flex-1 bg-background border border-border focus-visible:ring-2 focus-visible:ring-ring text-foreground rounded-xl py-3 px-4 text-base shadow-sm transition-all"
                                    autoFocus
                                />
                            </div>

                            {renderLivePreview()}
                        </div>

                        {/* Barra de Ferramentas Simétrica */}
                        <div className="grid grid-cols-3 gap-2 w-full shrink-0">
                            <button
                                className={`flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                                    modoAtivo === 'analisar'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                        : 'bg-card border-border text-foreground hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-500'
                                }`}
                                onClick={handleAnalisar}
                                disabled={!praticaInput.trim()}
                                title="A IA analisa sua resposta e dá feedback detalhado"
                            >
                                <Dumbbell size={14} /> Analisar
                            </button>
                            <button
                                className={`flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                                    modoAtivo === 'sugestao'
                                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                        : 'bg-card border-border text-foreground hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-500'
                                }`}
                                onClick={handleSugestao}
                                title="A IA sugere uma resposta adequada ao contexto"
                            >
                                <MessageCircle size={14} /> Sugestão
                            </button>
                            <button
                                className={`flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                                    modoAtivo === 'duvida'
                                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                        : 'bg-card border-border text-foreground hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-500'
                                }`}
                                onClick={handleDuvida}
                                title="Tire uma dúvida de gramática ou vocabulário"
                            >
                                <HelpCircle size={14} /> Dúvida
                            </button>
                        </div>

                        {/* Área de Resultados em Container Fixo com Scroll */}
                        <div className="flex-1 min-h-[200px] bg-muted/10 border border-border/80 rounded-xl overflow-hidden min-h-0 flex flex-col">
                            <ScrollArea className="flex-1">
                                <div className="p-4">
                                    {modoAtivo ? (
                                        renderResultado()
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center text-muted-foreground text-xs py-8 gap-2">
                                            <Sparkles size={24} className="opacity-30 mb-1" />
                                            <p className="font-medium">Selecione uma ação acima</p>
                                            <p className="text-[0.75rem] opacity-70 max-w-xs">
                                                Analise sua resposta em japonês, gere sugestões contextuais ou tire dúvidas de gramática.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
