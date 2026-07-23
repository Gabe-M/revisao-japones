import React, { useEffect, useState, useRef } from 'react';
import { useTermCard } from '../context/TermCardContext';
import { X } from 'lucide-react';
import AiLoader from '../dialogo/components/AiLoader';
import AnkiPreviewModal from '../dialogo/components/AnkiPreviewModal';
import { toast } from './ui/use-toast';

export default function TermCardModal() {
  const { isOpen, termo, fraseContexto, posicao, tipo, closeCard } = useTermCard();
  
  const [translation, setTranslation] = useState<string>('');
  const [reading, setReading] = useState<string>('');
  const [pos, setPos] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  
  const [explicacaoIA, setExplicacaoIA] = useState<any>(null);
  const [isLoadingIA, setIsLoadingIA] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(
    () => (localStorage.getItem('selected_provider') as any) || 'groq'
  );

  // Status adaptativo, conjunto e modal Anki
  const [status, setStatus] = useState<'aprendido' | 'aprendendo_medio' | 'aprendendo_dificil' | 'novo'>('novo');
  const [conjunto, setConjunto] = useState('Geral');
  const [ankiModalOpen, setAnkiModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('selected_provider', selectedProvider);
  }, [selectedProvider]);

  const modalRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Boundary checking on open/reposition
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      let newX = posicao.x;
      let newY = posicao.y + 15; // little offset from cursor

      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 20;
      }
      if (newY + rect.height > window.innerHeight) {
        newY = posicao.y - rect.height - 15; // show above cursor
      }
      
      setAdjustedPos({ x: Math.max(10, newX), y: Math.max(10, newY) });
    }
  }, [isOpen, posicao]);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('select')) return;

    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - adjustedPos.x,
      y: e.clientY - adjustedPos.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setAdjustedPos({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Fetch logic for translation + reading (No AI, or free selection analysis)
  useEffect(() => {
    if (!isOpen || !termo) return;

    const storedProvider = localStorage.getItem('selected_provider') as any;
    if (storedProvider && storedProvider !== selectedProvider) {
      setSelectedProvider(storedProvider);
    }

    setTranslation('');
    setReading('');
    setPos('');
    setExplicacaoIA(null);
    setIsTranslating(true);

    const controller = new AbortController();

    const loadData = async () => {
      try {
        if (tipo === 'SelecaoLivre') {
          const userKey = localStorage.getItem('gemini_api_key') || '';
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (userKey) {
            headers['X-Gemini-Key'] = userKey;
          }

          const res = await fetch('/api/dialogo', {
            method: 'POST',
            headers: headers,
            signal: controller.signal,
            body: JSON.stringify({
              acao: 'analisar_selecao_livre',
              texto_selecionado: termo,
              frase_contexto: fraseContexto,
              provider: selectedProvider
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (!controller.signal.aborted) {
              setExplicacaoIA(data);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            if (!controller.signal.aborted) {
              setExplicacaoIA({ error: errData.error || 'Erro ao analisar a seleção livre.' });
            }
          }
          return;
        }

        // 1. Fetch translation via Google Translate (Free, client-side, non-AI)
        let ptTranslation = '';
        try {
          const res = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=pt&dt=t&q=${encodeURIComponent(termo)}`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const data = await res.json();
            ptTranslation = data?.[0]?.[0]?.[0] || '';
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            console.error("Translation fetch error:", e);
          }
        }

        // 2. Fetch reading/pronunciation via Jisho API (Free, non-AI)
        let jishoReading = '';
        let jishoPos = '';
        try {
          const resJisho = await fetch(
            `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(termo)}`,
            { signal: controller.signal }
          );
          if (resJisho.ok) {
            const dataJisho = await resJisho.json();
            if (dataJisho?.data?.[0]) {
              const firstWord = dataJisho.data[0];
              jishoReading = firstWord.japanese?.[0]?.reading || '';
              const posArray = firstWord.senses?.[0]?.parts_of_speech;
              if (Array.isArray(posArray) && posArray.length > 0) {
                jishoPos = posArray.join(', ');
              }
            }
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            console.error("Jisho fetch error:", e);
          }
        }

        if (!controller.signal.aborted) {
          setTranslation(ptTranslation || 'Tradução não encontrada.');
          setReading(jishoReading);
          setPos(jishoPos);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          console.error(err);
          setTranslation('Erro ao carregar tradução.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsTranslating(false);
        }
      }
    };

    loadData();

    return () => {
      controller.abort();
    };
  }, [isOpen, termo, tipo]);

  const handleFetchContextoIA = async () => {
    setIsLoadingIA(true);
    setExplicacaoIA(null);
    try {
      const userKey = localStorage.getItem('gemini_api_key') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userKey) {
        headers['X-Gemini-Key'] = userKey;
      }

      const res = await fetch('/api/dialogo', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(
          tipo === 'SelecaoLivre'
            ? {
                acao: 'analisar_selecao_livre',
                texto_selecionado: termo,
                frase_contexto: fraseContexto,
                provider: selectedProvider
              }
            : {
                acao: 'explicar_termo_contextual',
                termo,
                fraseContexto,
                provider: selectedProvider
              }
        )
      });
      
      if (res.ok) {
        const data = await res.json();
        setExplicacaoIA(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setExplicacaoIA({ error: errData.error || 'Erro ao processar requisição da IA.' });
      }
    } catch (e: any) {
      console.error(e);
      setExplicacaoIA({ error: `Erro de conexão: ${e.message}` });
    } finally {
      setIsLoadingIA(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
        zIndex: 99999,
        background: 'var(--card-bg, rgba(22, 22, 26, 0.95))',
        color: 'var(--text-color, #ffffff)',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
        borderRadius: '16px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
        padding: '16px',
        width: '340px',
        maxWidth: '92vw',
        boxSizing: 'border-box',
        display: ankiModalOpen ? 'none' : 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'ajudaSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
    >
      <style>
        {`
          @keyframes ajudaSlideUp {
            from { transform: translateY(10px) scale(0.98); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}
      </style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.2em', color: 'var(--highlight-color, #ff6b6b)' }}>
          {termo}
        </h3>
        <button 
          onClick={closeCard}
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ fontSize: '0.85em', opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        Contexto: {fraseContexto || 'Nenhum contexto'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isTranslating ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <AiLoader provider={selectedProvider} message={tipo === 'SelecaoLivre' ? "Analisando seleção..." : "Buscando dicionário..."} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tipo === 'SelecaoLivre' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {explicacaoIA?.error ? (
                  <div style={{ color: '#e74c3c', fontSize: '0.9em', padding: '10px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '8px', borderLeft: '3px solid #e74c3c' }}>
                    {explicacaoIA.error}
                  </div>
                ) : explicacaoIA?.valido === false ? (
                  <div style={{ 
                    color: '#ff6b6b', 
                    fontSize: '0.92em', 
                    padding: '12px', 
                    background: 'rgba(231, 76, 60, 0.15)', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255, 107, 107, 0.25)',
                    borderLeft: '4px solid #ff6b6b',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#ff6b6b' }}>⚠️ Seleção Inválida:</strong>
                    {explicacaoIA?.erro || 'Esta seleção não forma um bloco pedagógico ou semântico válido.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {explicacaoIA?.leitura && (
                      <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
                        <strong>Leitura:</strong> {explicacaoIA.leitura}
                      </div>
                    )}
                    <div style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Tradução (PT/BR):</div>
                    <div style={{ 
                      lineHeight: '1.4', 
                      fontSize: '0.95em', 
                      background: 'rgba(255,255,255,0.03)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {explicacaoIA?.traducao || 'Nenhuma tradução disponível.'}
                    </div>
                    {explicacaoIA?.explicacao && (
                      <div style={{ 
                        marginTop: '4px', 
                        padding: '10px', 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '8px', 
                        fontSize: '0.9em', 
                        borderLeft: '3px solid var(--highlight-color, #ff6b6b)',
                        lineHeight: '1.4'
                      }}>
                        <strong>Explicação Contextual:</strong>
                        <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>{explicacaoIA.explicacao}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{ 
                  marginTop: '10px', 
                  borderTop: '1px solid rgba(255,255,255,0.1)', 
                  paddingTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <label style={{ fontSize: '0.82em', opacity: 0.8, fontWeight: 'bold' }}>
                    🧠 Analisar com outro Provedor:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={selectedProvider}
                      onChange={e => setSelectedProvider(e.target.value as any)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-color, #ffffff)',
                        border: '1px solid var(--border-color, #333)',
                        fontSize: '0.85em',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="gemini">✨ Gemini</option>
                      <option value="openai">🟢 OpenAI</option>
                      <option value="groq">⚡ Groq</option>
                      <option value="pollinations">🪐 Pollinations</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleFetchContextoIA}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--highlight-color, #ff6b6b)',
                        color: 'white',
                        fontSize: '0.85em',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={e => e.currentTarget.style.opacity = '1'}
                    >
                      Analisar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reading && (
                  <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
                    <strong>Leitura:</strong> {reading}
                  </div>
                )}
                {pos && (
                  <div style={{ fontSize: '0.85em', opacity: 0.7 }}>
                    <strong>Classe:</strong> {pos}
                  </div>
                )}
                <div style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Tradução (PT/BR):</div>
                <div style={{ 
                  lineHeight: '1.4', 
                  fontSize: '0.95em', 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '10px', 
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {translation}
                </div>

                {/* IA Context Section */}
                {isLoadingIA ? (
                  <div style={{ padding: '15px 0', textAlign: 'center' }}>
                    <AiLoader provider={selectedProvider} message="Obtendo contexto com IA..." />
                  </div>
                ) : explicacaoIA ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {explicacaoIA.error ? (
                      <div style={{ color: '#e74c3c', fontSize: '0.9em', marginTop: '4px' }}>
                        {explicacaoIA.error}
                      </div>
                    ) : (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '10px', 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '8px', 
                        fontSize: '0.9em', 
                        borderLeft: '3px solid var(--highlight-color, #ff6b6b)' 
                      }}>
                        <strong style={{ display: 'block', color: 'var(--highlight-color, #ff6b6b)', marginBottom: '6px' }}>
                          Contexto ({selectedProvider.toUpperCase()}):
                        </strong>
                        {typeof explicacaoIA === 'string' ? (
                          <div style={{ lineHeight: '1.4' }}>{explicacaoIA}</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.4' }}>
                            {explicacaoIA.leitura && (
                              <div><strong>Leitura (IA):</strong> {explicacaoIA.leitura}</div>
                            )}
                            {explicacaoIA.classe_gramatical && (
                              <div><strong>Gramática:</strong> {explicacaoIA.classe_gramatical}</div>
                            )}
                            {explicacaoIA.significado && (
                              <div><strong>Significado:</strong> {explicacaoIA.significado}</div>
                            )}
                            {explicacaoIA.funcao_no_contexto && (
                              <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                                <strong>Função no Contexto:</strong>
                                <p style={{ margin: '2px 0 0 0', opacity: 0.9 }}>{explicacaoIA.funcao_no_contexto}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setExplicacaoIA(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--highlight-color, #ff6b6b)',
                        fontSize: '0.8em',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        alignSelf: 'flex-start',
                        padding: 0
                      }}
                    >
                      Refazer consulta ou trocar Provedor
                    </button>
                  </div>
                ) : (
                  <div style={{ 
                    marginTop: '10px', 
                    borderTop: '1px solid rgba(255,255,255,0.1)', 
                    paddingTop: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <label style={{ fontSize: '0.82em', opacity: 0.8, fontWeight: 'bold' }}>
                      🧠 Obter contexto detalhado via IA:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={selectedProvider}
                        onChange={e => setSelectedProvider(e.target.value as any)}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'var(--text-color, #ffffff)',
                          border: '1px solid var(--border-color, #333)',
                          fontSize: '0.85em',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="gemini">✨ Gemini</option>
                        <option value="openai">🟢 OpenAI</option>
                        <option value="groq">⚡ Groq</option>
                        <option value="pollinations">🪐 Pollinations</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleFetchContextoIA}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'var(--highlight-color, #ff6b6b)',
                          color: 'white',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}
                      >
                        Pedir Contexto
                      </button>
                    </div>
                  </div>
                )}

                {/* Seção de Status / Dificuldade & Conjunto & Anki */}
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78em', fontWeight: 'bold' }}>
                    <span style={{ opacity: 0.8 }}>Classificação / Dificuldade:</span>
                    <span style={{ fontSize: '0.9em', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)' }}>
                      {status === 'aprendido' ? '🟢 Aprendido' : status === 'aprendendo_dificil' ? '🔴 Difícil' : status === 'aprendendo_medio' ? '🟡 Médio' : '🆕 Nova'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus('aprendido');
                        toast({ title: '🟢 Marcado como Aprendido', description: `Palavra '${termo}' salva como aprendida.` });
                      }}
                      style={{
                        padding: '7px 4px',
                        fontSize: '0.75em',
                        fontWeight: 'bold',
                        background: status === 'aprendido' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(46, 204, 113, 0.12)',
                        color: '#2ecc71',
                        border: status === 'aprendido' ? '1.5px solid #2ecc71' : '1px solid rgba(46, 204, 113, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      🟢 Fácil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus('aprendendo_medio');
                        toast({ title: '🟡 Marcado em Aprendizado (Médio)', description: `Palavra '${termo}' em reforço médio.` });
                      }}
                      style={{
                        padding: '7px 4px',
                        fontSize: '0.75em',
                        fontWeight: 'bold',
                        background: status === 'aprendendo_medio' ? 'rgba(241, 196, 15, 0.3)' : 'rgba(241, 196, 15, 0.12)',
                        color: '#f39c12',
                        border: status === 'aprendendo_medio' ? '1.5px solid #f39c12' : '1px solid rgba(241, 196, 15, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      🟡 Médio
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus('aprendendo_dificil');
                        toast({ title: '🔴 Marcado em Aprendizado (Difícil)', description: `Palavra '${termo}' priorizada para reforço.` });
                      }}
                      style={{
                        padding: '7px 4px',
                        fontSize: '0.75em',
                        fontWeight: 'bold',
                        background: status === 'aprendendo_dificil' ? 'rgba(231, 76, 60, 0.3)' : 'rgba(231, 76, 60, 0.12)',
                        color: '#e74c3c',
                        border: status === 'aprendendo_dificil' ? '1.5px solid #e74c3c' : '1px solid rgba(231, 76, 60, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      🔴 Difícil
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', width: '100%', boxSizing: 'border-box' }}>
                    <span style={{ fontSize: '0.75em', opacity: 0.8, fontWeight: 600, flexShrink: 0 }}>Conjunto:</span>
                    <input
                      value={conjunto}
                      onChange={e => setConjunto(e.target.value)}
                      placeholder="Nome do conjunto..."
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '30px',
                        padding: '4px 8px',
                        fontSize: '0.75em',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        color: 'white',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setAnkiModalOpen(true)}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        fontSize: '0.75em',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #8e44ad, #9b59b6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(142, 68, 173, 0.4)',
                        transition: 'transform 0.15s'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Salvar no Baralho Anki"
                    >
                      🎴 Salvar Anki
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Preview do Anki */}
      {ankiModalOpen && (
        <AnkiPreviewModal
          isOpen={ankiModalOpen}
          onClose={() => { setAnkiModalOpen(false); closeCard(); }}
          cardInicial={{
            item: termo,
            leitura: reading || explicacaoIA?.leitura || '',
            significado: translation || explicacaoIA?.significado || '',
            categoria: pos || explicacaoIA?.classe_gramatical || 'Vocabulário',
            jlpt: 'N5',
            exemplo_jp: fraseContexto || '',
            exemplo_pt: ''
          }}
          modulo={conjunto || 'Vocabulario'}
        />
      )}
    </div>
  );
}

