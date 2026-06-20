import React, { useEffect, useState, useRef } from 'react';
import { useTermCard } from '../context/TermCardContext';
import { X } from 'lucide-react';
import AiLoader from '../dialogo/components/AiLoader';

export default function TermCardModal() {
  const { isOpen, termo, fraseContexto, posicao, closeCard } = useTermCard();
  
  const [translation, setTranslation] = useState<string>('');
  const [reading, setReading] = useState<string>('');
  const [pos, setPos] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  
  const [explicacaoIA, setExplicacaoIA] = useState<any>(null);
  const [isLoadingIA, setIsLoadingIA] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>('gemini');

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

  // Fetch logic for translation + reading (No AI)
  useEffect(() => {
    if (!isOpen || !termo) return;

    setTranslation('');
    setReading('');
    setPos('');
    setExplicacaoIA(null);
    setIsTranslating(true);

    const controller = new AbortController();

    const loadData = async () => {
      try {
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
  }, [isOpen, termo]);

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
        body: JSON.stringify({
          acao: 'explicar_termo_contextual',
          termo,
          fraseContexto,
          provider: selectedProvider
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setExplicacaoIA(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setExplicacaoIA({ error: errData.error || 'Erro ao carregar o contexto da IA.' });
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
        background: 'var(--card-bg, rgba(30, 30, 30, 0.85))',
        color: 'var(--text-color, #ffffff)',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        padding: '16px',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'ajudaSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
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
            <AiLoader provider="gemini" message="Buscando dicionário..." />
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
          </div>
        )}
      </div>
    </div>
  );
}

