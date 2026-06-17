import React, { useState } from 'react';
import ContaTab from './ContaTab';
import EstatisticasTab from './EstatisticasTab';
import JlptTab from './JlptTab';

export default function PerfilCard({ session }) {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="card-perfil">
      <div className="tab-control-container">
        <button 
          className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`} 
          onClick={() => setActiveTab('account')}
        >
          👤 Conta
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} 
          onClick={() => setActiveTab('stats')}
        >
          📊 Estatísticas
        </button>
        <button 
          className={`tab-btn ${activeTab === 'jlpt' ? 'active' : ''}`} 
          onClick={() => setActiveTab('jlpt')}
        >
          🏆 Caminho JLPT
        </button>
      </div>

      <div className="tab-content" style={{ display: activeTab === 'account' ? 'block' : 'none' }}>
        <ContaTab session={session} />
      </div>

      <div className="tab-content" style={{ display: activeTab === 'stats' ? 'block' : 'none' }}>
        <EstatisticasTab session={session} active={activeTab === 'stats'} />
      </div>

      <div className="tab-content" style={{ display: activeTab === 'jlpt' ? 'block' : 'none' }}>
        <JlptTab session={session} active={activeTab === 'jlpt'} />
      </div>
    </div>
  );
}
