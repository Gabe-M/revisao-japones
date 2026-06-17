import React, { useState, useEffect } from 'react';

const coresCategorias = {
  'Kanji': '#9b59b6',
  'Verbo': '#e74c3c',
  'Partícula': '#3498db',
  'Demonstrativo': '#f1c40f',
  'Vocabulário': '#2ecc71',
  'Outros': '#95a5a6'
};

export default function EstatisticasTab({ session, active }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nivelSelecionado, setNivelSelecionado] = useState('Todos');

  useEffect(() => {
    if (!active || dados.length > 0) return; // Only fetch if active and no data

    async function fetchStats() {
      try {
        const tokenDeAcesso = `Bearer ${session.access_token}`;
        const response = await fetch('/api/jisho?acao=listar', {
          headers: { "Authorization": tokenDeAcesso }
        });

        if (!response.ok) throw new Error("Erro ao buscar dados da API.");
        const json = await response.json();
        setDados(json);
      } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
        setError("Erro ao carregar estatísticas de estudo.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [active, session, dados.length]);

  const niveis = ['Todos', 'N5', 'N4', 'N3', 'N2', 'N1'];

  const dadosFiltrados = nivelSelecionado === 'Todos' 
    ? dados 
    : dados.filter(d => d.jlpt === nivelSelecionado);

  const total = dadosFiltrados.length;

  const contagem = {};
  dadosFiltrados.forEach(item => {
    const cat = item.categoria || 'Outros';
    contagem[cat] = (contagem[cat] || 0) + 1;
  });

  const sortedCategories = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3em', textAlign: 'center' }}>📊 Estatísticas de Estudo</h3>
      
      <div className="level-selector-container">
        {niveis.map(nivel => (
          <button 
            key={nivel}
            className={`level-select-btn ${nivelSelecionado === nivel ? 'active' : ''}`}
            onClick={() => setNivelSelecionado(nivel)}
          >
            {nivel}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '25px' }}>
        <div style={{ background: 'rgba(39, 174, 96, 0.1)', padding: '15px 30px', borderRadius: '12px', border: '1px solid rgba(39, 174, 96, 0.2)', minWidth: '150px' }}>
          <div className="info-label" style={{ margin: 0, color: '#27ae60', textAlign: 'center' }}>Total de Palavras</div>
          <div id="stats-total" style={{ fontSize: '2.5em', fontWeight: 800, color: '#27ae60', marginTop: '5px', textAlign: 'center' }}>
            {total}
          </div>
        </div>
      </div>
      
      <div id="stats-categories-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', maxWidth: '450px', margin: '0 auto' }}>
        {loading && <p style={{ textAlign: 'center', opacity: 0.7 }}>Carregando estatísticas...</p>}
        {error && <p style={{ textAlign: 'center', color: '#e74c3c' }}>{error}</p>}
        {!loading && !error && total === 0 && (
          <p style={{ textAlign: 'center', opacity: 0.7 }}>Nenhum termo encontrado.</p>
        )}
        {!loading && !error && sortedCategories.map(([cat, qtd]) => {
          const porcentagem = ((qtd / total) * 100).toFixed(0);
          const cor = coresCategorias[cat] || coresCategorias['Outros'];
          
          return (
            <div key={cat}>
              <div className="category-row">
                <span>{cat}</span>
                <span style={{ color: cor }}>{qtd} ({porcentagem}%)</span>
              </div>
              <div className="stats-bar-bg">
                <div 
                  className="stats-bar-fill" 
                  style={{ backgroundColor: cor, width: `${porcentagem}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
