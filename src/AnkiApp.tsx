import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAnkiConnection,
  useAnkiDecks,
  useAnkiCards,
  useSyncToSupabase,
} from './anki/useAnkiQuery';
import './anki/anki.css';

export default function AnkiApp() {
  const queryClient = useQueryClient();
  const [selectedDeck, setSelectedDeck] = useState<string>('');

  const { data: conn, isFetching: isCheckingConn, refetch: checkConn } = useAnkiConnection();
  const isConnected = conn?.connected;
  const { data: decks, isLoading: isLoadingDecks } = useAnkiDecks(!!isConnected);
  const { data: cardsData, isFetching: isFetchingCards, refetch: fetchCards } = useAnkiCards(selectedDeck || null);
  const syncMutation = useSyncToSupabase();

  const handleFetchCards = () => {
    if (!selectedDeck) return;
    fetchCards();
  };

  const handleSync = async () => {
    if (!cardsData) return;
    try {
      const sessaoLocalStorage = localStorage.getItem('supabase_session');
      if (!sessaoLocalStorage) {
        alert('Você não está logado! Faça login primeiro.');
        window.location.href = 'login.html';
        return;
      }
      const sessao = JSON.parse(sessaoLocalStorage);
      const authToken = `Bearer ${sessao.access_token}`;

      const allCards = [...cardsData.learned, ...cardsData.newCards];
      
      await syncMutation.mutateAsync({ cards: allCards, authToken });
      alert(`Sincronizados ${allCards.length} cartões com sucesso!`);
    } catch (err) {
      alert('Erro ao sincronizar. Verifique o console.');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f2335] via-[#0f111a] to-[#0a0b10] text-[#e8eaf0] p-4 md:p-8 font-sans selection:bg-[#6c63ff]/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header - Glassmorphism */}
        <header className="relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6c63ff] via-[#3b82f6] to-[#22c55e]"></div>
          <div className="mb-4 md:mb-0">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 flex items-center gap-3">
              <span className="text-4xl drop-shadow-[0_0_15px_rgba(108,99,255,0.5)]">🎴</span> 
              AnkiConnect Sync
            </h1>
            <p className="text-[#a0a5b1] text-sm mt-2 font-medium">Extraia seu progresso local e sincronize com a nuvem Kaishi.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => checkConn()}
              disabled={isCheckingConn}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] active:scale-95"
            >
              {isCheckingConn ? 'Verificando...' : '🔄 Atualizar'}
            </button>
            <div className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-3 shadow-lg ${isConnected ? 'bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/20' : 'bg-[#ef4444]/10 text-[#f87171] border border-[#ef4444]/20'}`}>
              <div className="relative flex h-3 w-3">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></span>
              </div>
              {isConnected ? `Online (v${conn?.version})` : 'Offline'}
            </div>
          </div>
        </header>

        {/* Status Error */}
        {!isConnected && !isCheckingConn && (
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-red-400 flex items-start gap-4 animate-pulse">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-lg">Falha na conexão com o AnkiConnect</p>
              <p className="text-sm mt-1 opacity-80">Abra o Anki Desktop, vá em Ferramentas &gt; Complementos &gt; AnkiConnect &gt; Config e certifique-se de que <code className="bg-black/30 px-1.5 py-0.5 rounded text-red-300">http://localhost:5173</code> está na lista <code className="bg-black/30 px-1.5 py-0.5 rounded text-red-300">webCorsOriginList</code>.</p>
            </div>
          </div>
        )}

        {/* Main Controls Panel */}
        {isConnected && (
          <div className="bg-white/[0.03] backdrop-blur-md p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
            {/* Decoration */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#6c63ff] rounded-full blur-[100px] opacity-20"></div>
            
            <div className="flex flex-col md:flex-row gap-6 items-end relative z-10">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-[#8b92a5] mb-3 uppercase tracking-widest">
                  📚 Selecione o Baralho de Origem
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-black/40 border border-white/10 text-white rounded-xl pl-5 pr-12 py-4 focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-all text-lg font-medium cursor-pointer"
                    value={selectedDeck}
                    onChange={(e) => setSelectedDeck(e.target.value)}
                    disabled={isLoadingDecks}
                  >
                    <option value="" disabled>-- Escolha um baralho --</option>
                    {decks?.map((deck) => (
                      <option key={deck} value={deck}>{deck}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-gray-400">
                    ▼
                  </div>
                </div>
              </div>
              <button
                onClick={handleFetchCards}
                disabled={!selectedDeck || isFetchingCards}
                className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-[#6c63ff] to-[#4b45bd] hover:from-[#5a52d5] hover:to-[#3e399c] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:shadow-[0_0_30px_rgba(108,99,255,0.6)] active:scale-95 flex items-center justify-center gap-3"
              >
                {isFetchingCards ? (
                  <><span className="animate-spin text-xl">⏳</span> Buscando...</>
                ) : (
                  <><span className="text-xl">📥</span> Buscar Cartões</>
                )}
              </button>
            </div>

            {/* Sync Summary Section */}
            {cardsData && (
              <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-3xl font-black text-white">{cardsData.learned.length + cardsData.newCards.length}</div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Total de Cartões</div>
                  </div>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] disabled:opacity-50 text-white rounded-xl font-black text-lg transition-all shadow-[0_0_25px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] active:scale-95 flex items-center justify-center gap-3"
                >
                  {syncMutation.isPending ? 'Sincronizando com a Nuvem...' : '☁️ Iniciar Sincronização'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Data Visualization Grid */}
        {cardsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Coluna Aprendidos */}
            <div className="flex flex-col bg-white/[0.02] rounded-3xl border border-white/5 overflow-hidden shadow-2xl h-[700px]">
              <div className="p-6 bg-gradient-to-r from-[#22c55e]/10 to-transparent border-b border-white/5 flex justify-between items-center backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h2 className="font-black text-xl text-white flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#4ade80] to-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                    Aprendidos / Revisão
                  </h2>
                  <p className="text-sm text-gray-400 mt-1 font-medium">Cartões já introduzidos</p>
                </div>
                <span className="bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/30 px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
                  {cardsData.learned.length}
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
                {cardsData.learned.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                    <span className="text-5xl opacity-50">👻</span>
                    <p className="font-medium text-lg">Nenhum cartão aprendido</p>
                  </div>
                ) : (
                  <>
                    {cardsData.learned.slice(0, 100).map(card => (
                      <div key={card.cardId} className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-default">
                        <div className="flex items-baseline justify-between mb-2 gap-4">
                          <h3 className="text-2xl font-black text-white group-hover:text-[#4ade80] transition-colors">{card.vocabulary}</h3>
                          <span className="text-xs font-bold text-gray-400 bg-black/40 px-3 py-1 rounded-lg shrink-0">
                            {card.reading}
                          </span>
                        </div>
                        <p className="text-[#a0a5b1] font-medium text-sm line-clamp-2 leading-relaxed">
                          {card.meaning}
                        </p>
                      </div>
                    ))}
                    {cardsData.learned.length > 100 && (
                      <div className="text-center p-4 text-gray-500 font-bold text-sm">
                        + {cardsData.learned.length - 100} outros cartões ocultos (sincronização os inclui)
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Coluna Novos */}
            <div className="flex flex-col bg-white/[0.02] rounded-3xl border border-white/5 overflow-hidden shadow-2xl h-[700px]">
              <div className="p-6 bg-gradient-to-r from-[#3b82f6]/10 to-transparent border-b border-white/5 flex justify-between items-center backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h2 className="font-black text-xl text-white flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#60a5fa] to-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    Cartões Novos
                  </h2>
                  <p className="text-sm text-gray-400 mt-1 font-medium">Cartões na fila de aprendizado</p>
                </div>
                <span className="bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30 px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
                  {cardsData.newCards.length}
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
                {cardsData.newCards.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                    <span className="text-5xl opacity-50">📭</span>
                    <p className="font-medium text-lg">Fila de novos vazia</p>
                  </div>
                ) : (
                  <>
                    {cardsData.newCards.slice(0, 100).map(card => (
                      <div key={card.cardId} className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-default">
                        <div className="flex items-baseline justify-between mb-2 gap-4">
                          <h3 className="text-2xl font-black text-white group-hover:text-[#60a5fa] transition-colors">{card.vocabulary}</h3>
                          <span className="text-xs font-bold text-gray-400 bg-black/40 px-3 py-1 rounded-lg shrink-0">
                            {card.reading}
                          </span>
                        </div>
                        <p className="text-[#a0a5b1] font-medium text-sm line-clamp-2 leading-relaxed">
                          {card.meaning}
                        </p>
                      </div>
                    ))}
                    {cardsData.newCards.length > 100 && (
                      <div className="text-center p-4 text-gray-500 font-bold text-sm">
                        + {cardsData.newCards.length - 100} outros cartões ocultos (sincronização os inclui)
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
      
      {/* Estilos Globais Auxiliares embutidos temporariamente para o Scrollbar e text-selection */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}
