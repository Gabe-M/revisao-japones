import React, { useEffect, useState, useRef } from 'react';
import { useTermCard } from '../context/TermCardContext';
import { X } from 'lucide-react';
import AiLoader from '../dialogo/components/AiLoader';

export default function TermCardModal() {
  const { isOpen, termo, fraseContexto, posicao, closeCard } = useTermCard();
  
  const [resultadoIA, setResultadoIA] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });

  // Boundary checking
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

  // Fetch logic with AbortController
  useEffect(() => {
    if (!isOpen || !termo) return;

    setResultadoIA(null);
    setIsLoading(true);

    const controller = new AbortController();
    
    const fetchExplicacao = async () => {
      try {
        const res = await fetch('/api/dialogo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'explicar_termo_contextual',
            termo,
            fraseContexto,
            provider: 'gemini'
          }),
          signal: controller.signal
        });
        
        if (!res.ok) throw new Error('Falha ao buscar explicação');
        
        const data = await res.json();
        if (!controller.signal.aborted) {
          setResultadoIA(data);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          console.error(err);
          setResultadoIA({ error: 'Não foi possível carregar a explicação.' });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchExplicacao();

    return () => {
      controller.abort();
    };
  }, [isOpen, termo, fraseContexto]);

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRef}
      style={{
        position: 'fixed',
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
        zIndex: 99999,
        background: 'var(--card-bg, #1e1e1e)',
        color: 'var(--text-color, #ffffff)',
        border: '1px solid var(--border-color, #333)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        padding: '16px',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'ajudaSlideUp 0.2s ease-out'
      }}
    >
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

      <div style={{ minHeight: '80px' }}>
        {isLoading ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <AiLoader provider="gemini" message="Buscando dicionário..." />
          </div>
        ) : resultadoIA ? (
           resultadoIA.error ? (
              <div style={{ color: '#e74c3c' }}>{resultadoIA.error}</div>
           ) : (
              <div>
                {resultadoIA.leitura && (
                    <div style={{ opacity: 0.8, marginBottom: '6px' }}>{resultadoIA.leitura}</div>
                )}
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{resultadoIA.classe_gramatical}</div>
                <div style={{ lineHeight: '1.5', fontSize: '0.95em' }}>{resultadoIA.significado}</div>
                {resultadoIA.funcao_no_contexto && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.9em' }}>
                    <strong style={{ color: 'var(--highlight-color, #ff6b6b)' }}>No contexto:</strong> {resultadoIA.funcao_no_contexto}
                  </div>
                )}
              </div>
           )
        ) : null}
      </div>
    </div>
  );
}
