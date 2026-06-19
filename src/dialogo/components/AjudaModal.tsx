import React, { useState, useEffect, useRef } from 'react';
import FuriganaText from './FuriganaText';
import AiLoader from './AiLoader';
import ScoreBadge from './ScoreBadge';
import * as wanakana from 'wanakana';
import { X, Book, MessageCircle, HelpCircle, Dumbbell, Check, Send, Play } from 'lucide-react';

interface AjudaModalProps {
    isOpen: boolean;
    onClose: () => void;
    mensagem: string; // raw JP string with ruby tags
    context: any; // tema, jlpt, vocabularioBanco, provider
    onUsarResposta: (texto: string) => void;
}

type TabType = 'vocab' | 'sugestao' | 'duvida' | 'praticar';

export default function AjudaModal({ isOpen, onClose, mensagem, context, onUsarResposta }: AjudaModalProps) {
    const [abaAtiva, setAbaAtiva] = useState<TabType>('vocab');
    
    // Vocab
    const [vocabulario, setVocabulario] = useState<any[]>([]);
    const [loadingVocab, setLoadingVocab] = useState(false);
    
    // Sugestão
    const [sugestao, setSugestao] = useState<{jp: string, pt: string, dica: string} | null>(null);
    const [loadingSugestao, setLoadingSugestao] = useState(false);
    
    // Dúvida
    const [duvidaInput, setDuvidaInput] = useState('');
    const [respostaDuvida, setRespostaDuvida] = useState('');
    const [loadingDuvida, setLoadingDuvida] = useState(false);
    
    // Praticar
    const [praticaInput, setPraticaInput] = useState('');
    const [analisePratica, setAnalisePratica] = useState<any>(null);
    const [loadingPratica, setLoadingPratica] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Lacuna Assistida
    const [lacunaAtiva, setLacunaAtiva] = useState<{ termoPt: string, raw: string } | null>(null);
    const [sugestoesLacuna, setSugestoesLacuna] = useState<any[]>([]);
    const [loadingLacuna, setLoadingLacuna] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAbaAtiva('vocab');
            setVocabulario([]);
            setSugestao(null);
            setDuvidaInput('');
            setRespostaDuvida('');
            setPraticaInput('');
            setAnalisePratica(null);
            setLacunaAtiva(null);
            setSugestoesLacuna([]);
            setLoadingLacuna(false);
            carregarVocabulario();
        }
    }, [isOpen, mensagem]);

    const handlePraticaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawVal = e.target.value;
        const selectionStart = e.target.selectionStart || 0;

        const regex = /(\[.*?\])/g;
        const parts = rawVal.split(regex);

        const convertedParts = parts.map(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                return part;
            }
            return wanakana.toHiragana(part, { IMEMode: true });
        });

        const convertedVal = convertedParts.join('');

        const prefix = rawVal.substring(0, selectionStart);
        const prefixParts = prefix.split(regex);
        const convertedPrefixParts = prefixParts.map(part => {
            if (part.startsWith('[')) {
                return part;
            }
            return wanakana.toHiragana(part, { IMEMode: true });
        });
        const newCursorPos = convertedPrefixParts.join('').length;

        setPraticaInput(convertedVal);

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const callEndpoint = async (acao: string, extraBody: any = {}) => {
        const body = {
            acao,
            provider: context.provider || 'gemini',
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

    const gerarSugestao = async () => {
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

    const enviarDuvida = async () => {
        if (!duvidaInput.trim()) return;
        setLoadingDuvida(true);
        try {
            const data = await callEndpoint('tirar_duvida', { duvida_usuario: duvidaInput });
            setRespostaDuvida(data.resposta);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDuvida(false);
        }
    };

    const enviarPratica = async () => {
        if (!praticaInput.trim()) return;
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

    const sugerirLacuna = async (termoPt: string, raw: string) => {
        setLacunaAtiva({ termoPt, raw });
        setSugestoesLacuna([]);
        setLoadingLacuna(true);
        try {
            const data = await callEndpoint('sugerir_lacuna', {
                frase_contexto: praticaInput,
                termo_pt: termoPt
            });
            if (data && data.sugestoes) {
                setSugestoesLacuna(data.sugestoes);
            }
        } catch (e) {
            console.error("Erro ao sugerir lacuna:", e);
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

    const renderLivePreview = () => {
        if (!praticaInput) return null;

        return (
            <>
                <div className="live-preview-container" style={{ marginTop: '15px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Visualização:</span>
                  
                  <div style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
                    {praticaInput.split(/(\[.*?\])/g).map((parte, index) => {
                      if (parte.startsWith('[') && parte.endsWith(']')) {
                        const termoLimpo = parte.slice(1, -1);
                        return (
                          <button
                            key={index}
                            type="button" /* CRÍTICO: Previne submit acidental da página */
                            onClick={() => sugerirLacuna(termoLimpo, parte)}
                            style={{
                              background: 'linear-gradient(135deg, #ff6b6b, #c0392b)',
                              color: '#ffffff',
                              padding: '2px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: 'none',
                              fontWeight: '600',
                              margin: '0 4px',
                              boxShadow: '0 2px 4px rgba(220, 53, 69, 0.3)',
                              transform: lacunaAtiva?.raw === parte ? 'scale(1.05)' : 'scale(1)',
                              transition: 'transform 0.2s ease'
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
                  <div className="lacuna-popover" style={{
                    marginTop: '10px',
                    padding: '15px',
                    background: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                    animation: 'ajudaSlideUp 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Sugestões para "{lacunaAtiva.termoPt}"
                      </span>
                      <button 
                        type="button"
                        onClick={() => setLacunaAtiva(null)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {loadingLacuna && (
                      <div style={{ padding: '20px 0', textAlign: 'center' }}>
                        <AiLoader provider={context.provider || 'gemini'} message="Buscando traduções..." />
                      </div>
                    )}

                    {!loadingLacuna && sugestoesLacuna.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sugestoesLacuna.map((sugestao, index) => (
                          <div 
                            key={index}
                            onClick={() => handleSelecionarSugestao(sugestao.texto_puro)}
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              background: 'rgba(0, 0, 0, 0.2)',
                              cursor: 'pointer',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#ff6b6b';
                              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)';
                            }}
                          >
                            <div style={{ fontSize: '1.2em', marginBottom: '4px' }}>
                              <FuriganaText text={sugestao.termo_jp}/>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--text-muted)' }}>
                              {sugestao.explicacao_curta}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </>
        );
    };

    if (!isOpen) return null;

    const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

    return (
        <div 
            onClick={handleOverlayClick}
            className="ajuda-modal-overlay"
        >
            <style dangerouslySetInnerHTML={{ __html: `
                .ajuda-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.55);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 16px;
                    animation: ajudaFadeInBg 0.25s ease-out;
                }

                .ajuda-modal-container {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    box-shadow: var(--shadow-hover);
                    width: 100%;
                    max-width: 750px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    color: var(--text-color);
                    animation: ajudaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .ajuda-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 24px;
                    border-bottom: 1px solid var(--border-color);
                    background: rgba(0, 0, 0, 0.02);
                }

                .ajuda-modal-title {
                    margin: 0;
                    font-size: 1.15em;
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
                    opacity: 0.6;
                    transition: all 0.2s ease;
                }
                .ajuda-modal-close:hover {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.05);
                    transform: scale(1.05);
                }

                .ajuda-modal-tabs {
                    display: flex;
                    overflow-x: auto;
                    border-bottom: 1px solid var(--border-color);
                    background: rgba(0, 0, 0, 0.01);
                    scrollbar-width: none;
                }
                .ajuda-modal-tabs::-webkit-scrollbar {
                    display: none;
                }

                .ajuda-modal-tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 14px 24px;
                    font-size: 0.9em;
                    font-weight: 600;
                    border: none;
                    border-bottom: 3px solid transparent;
                    background: transparent;
                    color: var(--text-color);
                    cursor: pointer;
                    opacity: 0.65;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .ajuda-modal-tab-btn:hover {
                    opacity: 0.9;
                    background: rgba(0, 0, 0, 0.02);
                }
                .ajuda-modal-tab-btn.active {
                    opacity: 1;
                    color: var(--highlight-color);
                    border-bottom-color: var(--highlight-color);
                }

                .ajuda-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    background: rgba(0, 0, 0, 0.01);
                }

                .ajuda-context-banner {
                    background: rgba(0, 0, 0, 0.02);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 16px;
                }
                .ajuda-context-banner .banner-label {
                    font-size: 0.75em;
                    font-weight: 700;
                    color: var(--text-color);
                    opacity: 0.6;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                .ajuda-context-banner .banner-text {
                    font-size: 1.15em;
                    line-height: 1.5;
                    color: var(--text-color);
                }

                .ajuda-vocab-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 16px;
                }

                .ajuda-vocab-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 16px;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: var(--shadow-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .ajuda-vocab-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover);
                    border-color: var(--highlight-color);
                }
                .ajuda-vocab-card .vocab-kana {
                    font-size: 1.25em;
                    font-weight: 700;
                }
                .ajuda-vocab-card .vocab-meaning {
                    font-size: 0.95em;
                    opacity: 0.85;
                }
                .ajuda-vocab-card .vocab-tag {
                    align-self: flex-start;
                    font-size: 0.75em;
                    font-weight: 700;
                    color: var(--highlight-color);
                    background: rgba(230, 126, 34, 0.1);
                    padding: 3px 8px;
                    border-radius: 20px;
                    margin-top: 6px;
                }

                .ajuda-sugestao-box {
                    background: rgba(46, 204, 113, 0.05);
                    border: 1px solid rgba(46, 204, 113, 0.2);
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    box-shadow: var(--shadow-subtle);
                }
                .ajuda-sugestao-box .sugestao-label {
                    font-size: 0.75em;
                    font-weight: 700;
                    color: #2ecc71;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .ajuda-sugestao-box .sugestao-jp {
                    font-size: 1.35em;
                    font-weight: 700;
                }
                .ajuda-sugestao-box .sugestao-pt {
                    font-size: 1em;
                    opacity: 0.85;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 12px;
                }
                .ajuda-sugestao-box .sugestao-dica {
                    display: flex;
                    gap: 8px;
                    font-size: 0.9em;
                    color: #2ecc71;
                    line-height: 1.4;
                }

                .ajuda-input-row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .ajuda-input-text {
                    flex: 1;
                    padding: 14px 18px;
                    border-radius: 10px;
                    border: 2px solid var(--border-color);
                    background: var(--card-bg);
                    color: var(--text-color);
                    font-size: 1.05em;
                    outline: none;
                    transition: all 0.25s ease;
                }
                .ajuda-input-text:focus {
                    border-color: var(--highlight-color);
                    box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.15);
                }

                .ajuda-btn-primary {
                    background: var(--highlight-color);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 0.95em;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 4px 12px rgba(230, 126, 34, 0.2);
                }
                .ajuda-btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(230, 126, 34, 0.35);
                    filter: brightness(1.05);
                }
                .ajuda-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .ajuda-btn-secondary {
                    background: rgba(0, 0, 0, 0.05);
                    color: var(--text-color);
                    border: 1px solid var(--border-color);
                    padding: 12px 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .ajuda-btn-secondary:hover {
                    background: rgba(0, 0, 0, 0.08);
                    transform: translateY(-1px);
                }

                .ajuda-pratica-box {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: var(--shadow-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    position: relative;
                }
                .ajuda-pratica-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .ajuda-pratica-badge {
                    font-weight: 700;
                    font-size: 0.85em;
                }

                .ajuda-dica-box {
                    background: rgba(0, 0, 0, 0.02);
                    border-left: 4px solid var(--highlight-color);
                    padding: 12px 16px;
                    border-radius: 0 8px 8px 0;
                    font-size: 0.92em;
                    line-height: 1.45;
                }

                .ajuda-natural-box {
                    margin-top: 8px;
                }
                .ajuda-natural-box .natural-label {
                    font-size: 0.75em;
                    font-weight: 700;
                    opacity: 0.6;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                .ajuda-natural-box .natural-text {
                    font-size: 1.25em;
                    font-weight: 700;
                    color: #2ecc71;
                }

                @keyframes ajudaFadeInBg {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes ajudaSlideUp {
                    from { transform: translateY(24px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            ` }} />
            <div className="ajuda-modal-container">
                
                {/* Header */}
                <div className="ajuda-modal-header">
                    <h2 className="ajuda-modal-title">
                        <MessageCircle className="w-5 h-5" style={{ color: 'var(--highlight-color)' }} />
                        Assistente de Diálogo
                    </h2>
                    <button onClick={onClose} className="ajuda-modal-close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="ajuda-modal-tabs">
                    <button 
                        onClick={() => setAbaAtiva('vocab')}
                        className={`ajuda-modal-tab-btn ${abaAtiva === 'vocab' ? 'active' : ''}`}
                    >
                        <Book className="w-4 h-4" /> Vocabulário
                    </button>
                    <button 
                        onClick={() => setAbaAtiva('sugestao')}
                        className={`ajuda-modal-tab-btn ${abaAtiva === 'sugestao' ? 'active' : ''}`}
                    >
                        <MessageCircle className="w-4 h-4" /> Sugerir Resposta
                    </button>
                    <button 
                        onClick={() => setAbaAtiva('duvida')}
                        className={`ajuda-modal-tab-btn ${abaAtiva === 'duvida' ? 'active' : ''}`}
                    >
                        <HelpCircle className="w-4 h-4" /> Tirar Dúvida
                    </button>
                    <button 
                        onClick={() => setAbaAtiva('praticar')}
                        className={`ajuda-modal-tab-btn ${abaAtiva === 'praticar' ? 'active' : ''}`}
                    >
                        <Dumbbell className="w-4 h-4" /> Praticar
                    </button>
                </div>

                {/* Content */}
                <div className="ajuda-modal-body">
                    
                    {/* Mensagem Contexto */}
                    <div className="ajuda-context-banner">
                        <div className="banner-label">Mensagem atual</div>
                        <div className="banner-text">
                            <FuriganaText text={mensagem} />
                        </div>
                    </div>

                    {abaAtiva === 'vocab' && (
                        <div>
                            {loadingVocab ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <AiLoader provider={context.provider || 'gemini'} message="Analisando vocabulário..." />
                                </div>
                            ) : vocabulario.length > 0 ? (
                                <div className="ajuda-vocab-grid">
                                    {vocabulario.map((v, idx) => (
                                        <div key={idx} className="ajuda-vocab-card">
                                            <div className="vocab-kana">
                                                <FuriganaText text={`<ruby>${v.item}<rt>${v.leitura}</rt></ruby>`} />
                                            </div>
                                            <div className="vocab-meaning">{v.significado}</div>
                                            {v.tipo && <div className="vocab-tag">{v.tipo}</div>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'gray', padding: '40px 0' }}>
                                    Nenhum vocabulário extraído da fala atual.
                                </div>
                            )}
                        </div>
                    )}

                    {abaAtiva === 'sugestao' && (
                        <div>
                            {!sugestao && !loadingSugestao && (
                                <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ opacity: 0.8 }}>Não sabe o que responder?</div>
                                    <button 
                                        onClick={gerarSugestao}
                                        className="ajuda-btn-primary"
                                        style={{ background: '#2ecc71', boxShadow: '0 4px 12px rgba(46, 204, 113, 0.2)' }}
                                    >
                                        Gerar Sugestão de Resposta
                                    </button>
                                </div>
                            )}
                            
                            {loadingSugestao && (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <AiLoader provider={context.provider || 'gemini'} message="Criando sugestão..." />
                                </div>
                            )}
                            
                            {sugestao && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className="ajuda-sugestao-box">
                                        <div className="sugestao-label">Sugestão</div>
                                        <div className="sugestao-jp"><FuriganaText text={sugestao.jp} /></div>
                                        <div className="sugestao-pt">{sugestao.pt}</div>
                                        <div className="sugestao-dica">
                                            <MessageCircle className="w-4 h-4" style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <span>{sugestao.dica}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                        <button 
                                            onClick={gerarSugestao}
                                            className="ajuda-btn-secondary"
                                        >
                                            Gerar Outra
                                        </button>
                                        <button 
                                            onClick={() => onUsarResposta(stripTags(sugestao.jp))}
                                            className="ajuda-btn-primary"
                                            style={{ flex: 1, background: '#2ecc71', boxShadow: '0 4px 12px rgba(46, 204, 113, 0.2)' }}
                                        >
                                            <Check className="w-4 h-4" /> Usar Resposta
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {abaAtiva === 'duvida' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="ajuda-input-row">
                                <input 
                                    type="text"
                                    value={duvidaInput}
                                    onChange={(e) => setDuvidaInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && enviarDuvida()}
                                    placeholder="Qual é a sua dúvida?"
                                    className="ajuda-input-text"
                                />
                                <button 
                                    onClick={enviarDuvida}
                                    disabled={!duvidaInput.trim() || loadingDuvida}
                                    className="ajuda-btn-primary"
                                    style={{ background: '#f39c12', boxShadow: '0 4px 12px rgba(243, 156, 18, 0.2)', padding: '14px 20px' }}
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div style={{ marginTop: '8px' }}>
                                {loadingDuvida ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <AiLoader provider={context.provider || 'gemini'} message="Pensando..." />
                                    </div>
                                ) : respostaDuvida ? (
                                    <div className="ajuda-vocab-card" style={{ borderLeft: '4px solid #f39c12', display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'start' }}>
                                        <div style={{ padding: '8px', background: 'rgba(243, 156, 18, 0.1)', borderRadius: '8px', color: '#f39c12' }}>
                                            <Book className="w-5 h-5" />
                                        </div>
                                        <div style={{ flex: 1, lineHeight: '1.6' }}>
                                            <FuriganaText text={respostaDuvida} />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'gray', padding: '40px 0' }}>
                                        Pergunte sobre gramática, contexto ou vocabulário da fala atual.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {abaAtiva === 'praticar' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ opacity: 0.8, fontSize: '0.9em', marginBottom: '8px' }}>
                                Teste uma resposta em japonês antes de enviar (romaji será convertido para hiragana automaticamente).
                            </div>
                            <div className="ajuda-input-row">
                                <input 
                                    ref={inputRef}
                                    type="text"
                                    value={praticaInput}
                                    onChange={handlePraticaInputChange}
                                    onKeyDown={(e) => e.key === 'Enter' && enviarPratica()}
                                    placeholder="Digite sua resposta..."
                                    className="ajuda-input-text"
                                    style={{ fontSize: '1.1em' }}
                                />
                                <button 
                                    onClick={enviarPratica}
                                    disabled={!praticaInput.trim() || loadingPratica}
                                    className="ajuda-btn-primary"
                                    style={{ background: '#9b59b6', boxShadow: '0 4px 12px rgba(155, 89, 182, 0.2)', padding: '14px 20px' }}
                                >
                                    Analisar
                                </button>
                            </div>

                            {renderLivePreview()}

                            <div style={{ marginTop: '8px' }}>
                                {loadingPratica ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <AiLoader provider={context.provider || 'gemini'} message="Avaliando resposta..." />
                                    </div>
                                ) : analisePratica ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div className="ajuda-pratica-box">
                                            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                                <ScoreBadge score={analisePratica.score || 0} />
                                            </div>
                                            <div style={{ paddingRight: '60px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95em', marginBottom: '12px', color: analisePratica.correto ? '#2ecc71' : '#e74c3c' }}>
                                                    {analisePratica.correto ? '✨ Resposta adequada' : '⚠️ Precisa de revisão'}
                                                </div>
                                                
                                                {analisePratica.erros && analisePratica.erros.length > 0 && (
                                                    <div style={{ marginBottom: '16px' }}>
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
                                                    <div className="ajuda-natural-box">
                                                        <div className="natural-label">Como soaria mais natural</div>
                                                        <div className="natural-text"><FuriganaText text={analisePratica.traducao_correta} /></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => onUsarResposta(stripTags(analisePratica.traducao_correta || praticaInput))}
                                            className="ajuda-btn-primary"
                                            style={{ width: '100%', background: '#9b59b6', boxShadow: '0 4px 12px rgba(155, 89, 182, 0.2)', marginTop: '16px' }}
                                        >
                                            <Play className="w-4 h-4" style={{ fill: 'currentColor' }} /> Usar {analisePratica.traducao_correta ? 'versão corrigida' : 'como resposta'}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
