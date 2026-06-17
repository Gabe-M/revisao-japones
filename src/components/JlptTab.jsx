import React, { useState, useEffect } from 'react';

const coresJLPT = {
  'N5': '#27ae60',
  'N4': '#2980b9',
  'N3': '#f39c12',
  'N2': '#e67e22',
  'N1': '#c0392b'
};

const metasJLPT = {
  'N5': 800,   
  'N4': 700,   
  'N3': 1500,  
  'N2': 3000,  
  'N1': 4000   
};

export default function JlptTab({ session, active }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        console.error("Erro ao carregar JLPT:", err);
        setError("Erro ao carregar dados do JLPT.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [active, session, dados.length]);

  const contagemJLPT = { 'N5': 0, 'N4': 0, 'N3': 0, 'N2': 0, 'N1': 0 };
  dados.forEach(item => {
    if (item.jlpt && contagemJLPT[item.jlpt] !== undefined) {
      contagemJLPT[item.jlpt]++;
    }
  });

  return (
    <>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '1.3em', textAlign: 'center' }}>🏆 Progresso do Caminho JLPT</h3>
      <div id="stats-jlpt-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', maxWidth: '450px', margin: '0 auto' }}>
        {loading && <p style={{ textAlign: 'center', opacity: 0.7 }}>Carregando níveis JLPT...</p>}
        {error && <p style={{ textAlign: 'center', color: '#e74c3c' }}>{error}</p>}
        
        {!loading && !error && ['N5', 'N4', 'N3', 'N2', 'N1'].map(nivel => {
          const qtd = contagemJLPT[nivel];
          const meta = metasJLPT[nivel];
          
          let porcentagem = ((qtd / meta) * 100);
          if (porcentagem > 100) porcentagem = 100;
          
          const faltam = meta - qtd;
          const cor = coresJLPT[nivel];

          return (
            <div key={nivel} style={{ marginBottom: '8px' }}>
              <div className="category-row" style={{ marginBottom: '4px' }}>
                <span>
                  {nivel}
                  {faltam > 0 ? (
                    <span style={{ fontSize: '0.85em', opacity: 0.7, fontWeight: 'normal', marginLeft: '8px' }}>
                      (Faltam {faltam})
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.85em', color: cor, marginLeft: '8px' }}>
                      (Completo! 🎉)
                    </span>
                  )}
                </span>
                <span style={{ color: cor }}>{qtd} / {meta}</span>
              </div>
              <div className="stats-bar-bg" style={{ height: '12px' }}>
                <div 
                  className="stats-bar-fill" 
                  style={{ backgroundColor: cor, width: `${porcentagem.toFixed(1)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
