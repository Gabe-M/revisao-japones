import React, { useState, useEffect, useRef } from 'react';
import InteractiveText from '../../components/InteractiveText';
import AiLoader from './AiLoader';
import ScoreBadge from './ScoreBadge';
import * as wanakana from 'wanakana';
import { X, Book, MessageCircle, HelpCircle, Dumbbell, Check, Send, Play, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

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
    const [vocabAberto, setVocabAberto] = useState(true);

    // Campo de prática
    const [praticaInput, setPraticaInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Modo ativo (qual seção de resultado mostrar)
    const [modoAtivo, setModoAtivo] = useState<ModoAtivo>(null);

    // Análise de prática
    const [analisePratica, setAnalisePratica] = useState<any>(null);
    const [loadingPratica, setLoadingPratica] = useState(false);

    // Sugestão de resposta
    const [sugestao, setSugestao] = useState<{ jp: string; pt: string; dica: string } | null>(null);
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
            setVocabAberto(true);
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
            setSugestao({ jp: data.sugestao_jp, pt: data.sugestao_pt, dica: data.dica });
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

    const usarSugestaoNoCampo = (textoJp: string) => {
        const textoPuro = textoJp.replace(/<[^>]*>/g, '');
        setPraticaInput(textoPuro);
        setModoAtivo(null);
        setSugestao(null);
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
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.78em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visualização</span>
                    <div style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
                        {praticaInput.split(/(\[.*?\])/g).map((parte, index) => {
                            if (parte.startsWith('[') && parte.endsWith(']')) {
                                const termoLimpo = parte.slice(1, -1);
                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => sugerirLacuna(termoLimpo, parte)}
                                        style={{
                                            background: lacunaAtiva?.raw === parte ? 'linear-gradient(135deg, #ff8c42, #e55a1c)' : 'linear-gradient(135deg, #ff6b6b, #c0392b)',
                                            color: '#ffffff',
                                            padding: '2px 10px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            fontWeight: '600',
                                            margin: '0 3px',
                                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.35)',
                                            transform: lacunaAtiva?.raw === parte ? 'scale(1.08)' : 'scale(1)',
                                            transition: 'all 0.2s ease'
                                        }}
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
                    <div style={{
                        marginTop: '10px',
                        padding: '15px',
                        background: 'rgba(15, 15, 20, 0.97)',
                        border: '1px solid rgba(255, 107, 107, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Sugestões para "{lacunaAtiva.termoPt}"
                            </span>
                            <button type="button" onClick={() => setLacunaAtiva(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                                <X size={16} />
                            </button>
                        </div>
                        {loadingLacuna ? (
                            <div style={{ padding: '16px 0', textAlign: 'center' }}>
                                <AiLoader provider={context.provider || 'groq'} message="Buscando traduções..." />
                            </div>
                        ) : sugestoesLacuna.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {sugestoesLacuna.map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelecionarSugestao(s.texto_puro)}
                                        style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff6b6b'; e.currentTarget.style.background = 'rgba(255,107,107,0.1)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(0,0,0,0.25)'; }}
                                    >
                                        <div style={{ fontSize: '1.15em', marginBottom: '4px' }}>
                                            <InteractiveText text={s.termo_jp} />
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>{s.explicacao_curta}</p>
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
            <div ref={resultadoRef} style={{ marginTop: '20px' }}>
                {/* Analisar */}
                {modoAtivo === 'analisar' && (
                    <div>
                        {loadingPratica ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <AiLoader provider={context.provider || 'groq'} message="Avaliando sua resposta..." />
                            </div>
                        ) : analisePratica ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="ajuda-pratica-box">
                                    <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                        <ScoreBadge score={analisePratica.score || 0} />
                                    </div>
                                    <div style={{ paddingRight: '60px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95em', marginBottom: '12px', color: analisePratica.correto ? '#2ecc71' : '#e74c3c' }}>
                                            {analisePratica.correto ? '✨ Resposta adequada' : '⚠️ Precisa de revisão'}
                                        </div>
                                        {analisePratica.erros?.length > 0 && (
                                            <div style={{ marginBottom: '14px' }}>
                                                <div style={{ fontSize: '0.75em', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', marginBottom: '4px' }}>Erros encontrados</div>
                                                <ul style={{ color: '#e74c3c', paddingLeft: '20px', margin: '4px 0', fontSize: '0.9em' }}>
                                                    {analisePratica.erros.map((err: string, i: number) => <li key={i}>{err}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="ajuda-dica-box">
                                            <strong style={{ color: '#9b59b6' }}>Dica:</strong> {analisePratica.dica}
                                        </div>
                                        {analisePratica.traducao_correta && (
                                            <div className="ajuda-natural-box" style={{ marginTop: '12px' }}>
                                                <div className="natural-label">Como soaria mais natural</div>
                                                <div className="natural-text"><InteractiveText text={analisePratica.traducao_correta} /></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onUsarResposta(stripTags(analisePratica.traducao_correta || praticaInput))}
                                    className="ajuda-btn-primary"
                                    style={{ background: '#9b59b6', boxShadow: '0 4px 12px rgba(155,89,182,0.25)' }}
                                >
                                    <Play size={16} style={{ fill: 'currentColor' }} />
                                    Usar {analisePratica.traducao_correta ? 'versão corrigida' : 'como resposta'}
                                </button>
                                <button onClick={handleAnalisar} className="ajuda-btn-secondary" style={{ alignSelf: 'flex-start' }}>
                                    Analisar novamente
                                </button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Sugestão */}
                {modoAtivo === 'sugestao' && (
                    <div>
                        {loadingSugestao ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <AiLoader provider={context.provider || 'groq'} message="Gerando sugestão de resposta..." />
                            </div>
                        ) : sugestao ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="ajuda-sugestao-box">
                                    <div className="sugestao-label">💡 Sugestão de Resposta</div>
                                    <div className="sugestao-jp"><InteractiveText text={sugestao.jp} /></div>
                                    <div className="sugestao-pt">{sugestao.pt}</div>
                                    <div className="sugestao-dica">
                                        <MessageCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <span>{sugestao.dica}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => usarSugestaoNoCampo(sugestao.jp)}
                                        className="ajuda-btn-secondary"
                                        style={{ flex: 1 }}
                                        title="Copia para o campo de prática para você editar"
                                    >
                                        ✏️ Praticar esta resposta
                                    </button>
                                    <button
                                        onClick={() => onUsarResposta(stripTags(sugestao.jp))}
                                        className="ajuda-btn-primary"
                                        style={{ flex: 1, background: '#2ecc71', boxShadow: '0 4px 12px rgba(46,204,113,0.2)' }}
                                    >
                                        <Check size={16} /> Usar direto
                                    </button>
                                </div>
                                <button onClick={handleSugestao} className="ajuda-btn-secondary" style={{ alignSelf: 'flex-start' }}>
                                    Gerar outra sugestão
                                </button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Dúvida */}
                {modoAtivo === 'duvida' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ fontSize: '0.88em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Pergunte sobre gramática, contexto ou vocabulário da fala atual.
                        </div>
                        <div className="ajuda-input-row">
                            <input
                                type="text"
                                value={duvidaInput}
                                onChange={e => setDuvidaInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && enviarDuvida()}
                                placeholder="Qual é a sua dúvida?"
                                className="ajuda-input-text"
                                autoFocus
                            />
                            <button
                                onClick={enviarDuvida}
                                disabled={!duvidaInput.trim() || loadingDuvida}
                                className="ajuda-btn-primary"
                                style={{ background: '#f39c12', boxShadow: '0 4px 12px rgba(243,156,18,0.2)', padding: '14px 20px' }}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        {loadingDuvida ? (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <AiLoader provider={context.provider || 'groq'} message="Pensando..." />
                            </div>
                        ) : respostaDuvida ? (
                            <div className="ajuda-vocab-card" style={{ borderLeft: '4px solid #f39c12', flexDirection: 'row', gap: '12px', alignItems: 'start' }}>
                                <div style={{ padding: '8px', background: 'rgba(243,156,18,0.1)', borderRadius: '8px', color: '#f39c12', flexShrink: 0 }}>
                                    <Book size={20} />
                                </div>
                                <div style={{ flex: 1, lineHeight: '1.65' }}>
                                    <InteractiveText text={respostaDuvida} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div onClick={handleOverlayClick} className="ajuda-modal-overlay">
            <style dangerouslySetInnerHTML={{ __html: `
                .ajuda-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 16px;
                    animation: ajudaFadeInBg 0.2s ease-out;
                }
                .ajuda-modal-container {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
                    width: 100%;
                    max-width: 680px;
                    max-height: 88vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    color: var(--text-color);
                    animation: ajudaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                }
                .ajuda-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 24px;
                    border-bottom: 1px solid var(--border-color);
                    flex-shrink: 0;
                }
                .ajuda-modal-title {
                    margin: 0;
                    font-size: 1.05em;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-color);
                }
                .ajuda-modal-close {
                    background: transparent;
                    border: none;
                    color: var(--text-color);
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.55;
                    transition: all 0.2s ease;
                }
                .ajuda-modal-close:hover {
                    opacity: 1;
                    background: rgba(255,255,255,0.07);
                    transform: scale(1.08);
                }
                .ajuda-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 24px 28px;
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }
                .ajuda-section {
                    margin-bottom: 20px;
                }
                .ajuda-section-divider {
                    border: none;
                    border-top: 1px solid var(--border-color);
                    margin: 20px 0;
                    opacity: 0.5;
                }
                .ajuda-context-banner {
                    background: rgba(0, 0, 0, 0.04);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 14px 16px;
                }
                .ajuda-context-banner .banner-label {
                    font-size: 0.73em;
                    font-weight: 700;
                    color: var(--text-color);
                    opacity: 0.55;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    margin-bottom: 8px;
                }
                .ajuda-context-banner .banner-text {
                    font-size: 1.1em;
                    line-height: 1.55;
                }
                .ajuda-vocab-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    padding: 8px 4px;
                    border-radius: 8px;
                    transition: background 0.2s ease;
                    user-select: none;
                }
                .ajuda-vocab-toggle:hover {
                    background: rgba(255,255,255,0.04);
                }
                .ajuda-vocab-toggle-title {
                    font-size: 0.82em;
                    font-weight: 700;
                    color: var(--highlight-color);
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .ajuda-vocab-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    margin-top: 12px;
                }
                .ajuda-vocab-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    padding: 12px 14px;
                    transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: var(--shadow-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .ajuda-vocab-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover);
                    border-color: var(--highlight-color);
                }
                .ajuda-vocab-card .vocab-kana { font-size: 1.15em; font-weight: 700; }
                .ajuda-vocab-card .vocab-meaning { font-size: 0.9em; opacity: 0.82; }
                .ajuda-vocab-card .vocab-tag {
                    align-self: flex-start;
                    font-size: 0.72em;
                    font-weight: 700;
                    color: var(--highlight-color);
                    background: rgba(230, 126, 34, 0.1);
                    padding: 2px 8px;
                    border-radius: 20px;
                    margin-top: 4px;
                }
                .ajuda-pratica-section {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--border-color);
                    border-radius: 14px;
                    padding: 18px;
                }
                .ajuda-pratica-label {
                    font-size: 0.78em;
                    font-weight: 700;
                    color: var(--text-color);
                    opacity: 0.55;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .ajuda-input-row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .ajuda-input-text {
                    flex: 1;
                    padding: 13px 16px;
                    border-radius: 10px;
                    border: 2px solid var(--border-color);
                    background: var(--card-bg);
                    color: var(--text-color);
                    font-size: 1.05em;
                    outline: none;
                    transition: all 0.25s ease;
                    font-family: inherit;
                }
                .ajuda-input-text:focus {
                    border-color: var(--highlight-color);
                    box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.15);
                }
                .ajuda-action-toolbar {
                    display: flex;
                    gap: 8px;
                    margin-top: 14px;
                    flex-wrap: wrap;
                }
                .ajuda-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 9px 16px;
                    border-radius: 10px;
                    font-size: 0.88em;
                    font-weight: 600;
                    border: 1px solid var(--border-color);
                    background: rgba(255,255,255,0.03);
                    color: var(--text-color);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .ajuda-action-btn:hover {
                    background: rgba(255,255,255,0.07);
                    border-color: var(--highlight-color);
                    color: var(--highlight-color);
                    transform: translateY(-1px);
                }
                .ajuda-action-btn.active {
                    background: rgba(230, 126, 34, 0.12);
                    border-color: var(--highlight-color);
                    color: var(--highlight-color);
                }
                .ajuda-action-btn-analisar { }
                .ajuda-action-btn-sugestao { }
                .ajuda-action-btn-duvida { }
                .ajuda-btn-primary {
                    background: var(--highlight-color);
                    color: white;
                    padding: 12px 22px;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 0.92em;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 4px 12px rgba(230, 126, 34, 0.2);
                    font-family: inherit;
                    width: 100%;
                }
                .ajuda-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.08); }
                .ajuda-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
                .ajuda-btn-secondary {
                    background: rgba(255,255,255,0.04);
                    color: var(--text-color);
                    border: 1px solid var(--border-color);
                    padding: 10px 18px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 0.88em;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-family: inherit;
                }
                .ajuda-btn-secondary:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
                .ajuda-pratica-box {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 18px;
                    box-shadow: var(--shadow-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    position: relative;
                }
                .ajuda-dica-box {
                    background: rgba(0,0,0,0.03);
                    border-left: 4px solid var(--highlight-color);
                    padding: 11px 14px;
                    border-radius: 0 8px 8px 0;
                    font-size: 0.92em;
                    line-height: 1.5;
                }
                .ajuda-natural-box .natural-label {
                    font-size: 0.73em;
                    font-weight: 700;
                    opacity: 0.55;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                    letter-spacing: 0.5px;
                }
                .ajuda-natural-box .natural-text {
                    font-size: 1.2em;
                    font-weight: 700;
                    color: #2ecc71;
                }
                .ajuda-sugestao-box {
                    background: rgba(46, 204, 113, 0.05);
                    border: 1px solid rgba(46, 204, 113, 0.22);
                    border-radius: 12px;
                    padding: 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 11px;
                    box-shadow: var(--shadow-subtle);
                }
                .ajuda-sugestao-box .sugestao-label {
                    font-size: 0.73em;
                    font-weight: 700;
                    color: #2ecc71;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .ajuda-sugestao-box .sugestao-jp { font-size: 1.3em; font-weight: 700; }
                .ajuda-sugestao-box .sugestao-pt {
                    font-size: 0.98em;
                    opacity: 0.82;
                    border-bottom: 1px solid rgba(46,204,113,0.15);
                    padding-bottom: 10px;
                }
                .ajuda-sugestao-box .sugestao-dica {
                    display: flex;
                    gap: 8px;
                    font-size: 0.9em;
                    color: #2ecc71;
                    line-height: 1.45;
                }
                @keyframes ajudaFadeInBg {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes ajudaSlideUp {
                    from { transform: translateY(28px) scale(0.98); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            ` }} />

            <div className="ajuda-modal-container">

                {/* ── Header ── */}
                <div className="ajuda-modal-header">
                    <h2 className="ajuda-modal-title">
                        <Sparkles size={18} style={{ color: 'var(--highlight-color)' }} />
                        Assistente de Prática
                    </h2>
                    <button onClick={onClose} className="ajuda-modal-close">
                        <X size={20} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="ajuda-modal-body">

                    {/* 1. Banner da mensagem */}
                    <div className="ajuda-section">
                        <div className="ajuda-context-banner">
                            <div className="banner-label">Mensagem atual</div>
                            <div className="banner-text">
                                <InteractiveText text={mensagem} />
                            </div>
                        </div>
                    </div>

                    {/* 2. Vocabulário colapsível */}
                    <div className="ajuda-section">
                        <div className="ajuda-vocab-toggle" onClick={() => setVocabAberto(v => !v)}>
                            <span className="ajuda-vocab-toggle-title">
                                <Book size={13} /> Vocabulário
                                {!loadingVocab && vocabulario.length > 0 && (
                                    <span style={{ background: 'var(--highlight-color)', color: 'white', borderRadius: '20px', padding: '1px 7px', fontSize: '0.85em', fontWeight: 700 }}>
                                        {vocabulario.length}
                                    </span>
                                )}
                            </span>
                            {vocabAberto ? <ChevronUp size={15} style={{ opacity: 0.5 }} /> : <ChevronDown size={15} style={{ opacity: 0.5 }} />}
                        </div>

                        {vocabAberto && (
                            loadingVocab ? (
                                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                    <AiLoader provider={context.provider || 'groq'} message="Analisando vocabulário..." />
                                </div>
                            ) : vocabulario.length > 0 ? (
                                <div className="ajuda-vocab-grid">
                                    {vocabulario.map((v, idx) => (
                                        <div key={idx} className="ajuda-vocab-card">
                                            <div className="vocab-kana">
                                                <InteractiveText text={`<ruby>${v.item}<rt>${v.leitura}</rt></ruby>`} />
                                            </div>
                                            <div className="vocab-meaning">{v.significado}</div>
                                            {v.tipo && <div className="vocab-tag">{v.tipo}</div>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'gray', padding: '20px 0', fontSize: '0.9em' }}>
                                    Nenhum vocabulário extraído.
                                </div>
                            )
                        )}
                    </div>

                    <hr className="ajuda-section-divider" />

                    {/* 3. Campo de prática */}
                    <div className="ajuda-section">
                        <div className="ajuda-pratica-section">
                            <div className="ajuda-pratica-label">
                                <Dumbbell size={13} /> Sua resposta
                            </div>
                            <div className="ajuda-input-row">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={praticaInput}
                                    onChange={handlePraticaInputChange}
                                    onKeyDown={e => e.key === 'Enter' && modoAtivo === 'analisar' && handleAnalisar()}
                                    placeholder="Digite em romaji (converte para hiragana automaticamente)..."
                                    className="ajuda-input-text"
                                    style={{ fontSize: '1.05em' }}
                                    autoFocus
                                />
                            </div>

                            {renderLivePreview()}

                            {/* Toolbar de ações */}
                            <div className="ajuda-action-toolbar">
                                <button
                                    className={`ajuda-action-btn ajuda-action-btn-analisar ${modoAtivo === 'analisar' ? 'active' : ''}`}
                                    onClick={handleAnalisar}
                                    disabled={!praticaInput.trim()}
                                    title="A IA analisa sua resposta e dá feedback detalhado"
                                >
                                    <Dumbbell size={14} /> Analisar
                                </button>
                                <button
                                    className={`ajuda-action-btn ajuda-action-btn-sugestao ${modoAtivo === 'sugestao' ? 'active' : ''}`}
                                    onClick={handleSugestao}
                                    title="A IA sugere uma resposta adequada ao contexto"
                                >
                                    <MessageCircle size={14} /> Sugestão de Resposta
                                </button>
                                <button
                                    className={`ajuda-action-btn ajuda-action-btn-duvida ${modoAtivo === 'duvida' ? 'active' : ''}`}
                                    onClick={handleDuvida}
                                    title="Tire uma dúvida de gramática ou vocabulário"
                                >
                                    <HelpCircle size={14} /> Dúvida
                                </button>
                            </div>
                        </div>

                        {/* 4. Área de resultado dinâmico */}
                        {renderResultado()}
                    </div>

                </div>
            </div>
        </div>
    );
}
