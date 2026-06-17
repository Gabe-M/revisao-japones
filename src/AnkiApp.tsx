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

  // 1. Verificar Conexão
  const { data: conn, isFetching: isCheckingConn, refetch: checkConn } = useAnkiConnection();
  const isConnected = conn?.connected;

  // 2. Buscar Baralhos (só se estiver conectado)
  const { data: decks, isLoading: isLoadingDecks } = useAnkiDecks(!!isConnected);

  // 3. Buscar Cartões do Baralho Selecionado
  const {
    data: cardsData,
    isFetching: isFetchingCards,
    refetch: fetchCards,
  } = useAnkiCards(selectedDeck || null);

  // 4. Sincronizar com Supabase
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
      alert('Erro ao sincronizar. Veja o console.');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e8eaf0] p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex justify-between items-center bg-[#1a1d27] p-4 rounded-xl border border-[#2e3347] shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">🎴</span> AnkiConnect Sync
            </h1>
            <p className="text-[#7b8099] text-sm mt-1">Sincronize seu progresso do Anki com o Kaishi.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => checkConn()}
              disabled={isCheckingConn}
              className="px-4 py-2 bg-[#22263a] hover:bg-[#2e3347] border border-[#2e3347] rounded-lg text-sm font-medium transition-colors"
            >
              {isCheckingConn ? 'Verificando...' : 'Atualizar Conexão'}
            </button>
            <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${isConnected ? 'bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30' : 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></div>
              {isConnected ? `Anki Conectado (v${conn?.version})` : 'Anki Offline'}
            </div>
          </div>
        </header>

        {/* Alerta de erro de conexão */}
        {!isConnected && !isCheckingConn && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 p-4 rounded-xl text-[#ef4444]">
            <p className="font-semibold">Não foi possível conectar ao AnkiConnect.</p>
            <p className="text-sm opacity-90 mt-1">Certifique-se de que o Anki está aberto e que você configurou o CORS para incluir <code className="bg-black/20 px-1 py-0.5 rounded">http://localhost:5173</code>.</p>
          </div>
        )}

        {/* Controles Principais */}
        {isConnected && (
          <div className="bg-[#1a1d27] p-6 rounded-xl border border-[#2e3347] shadow-lg space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-semibold text-[#7b8099] mb-2 uppercase tracking-wider">
                  Selecione o Baralho
                </label>
                <select
                  className="w-full bg-[#22263a] border border-[#2e3347] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#6c63ff] transition-colors"
                  value={selectedDeck}
                  onChange={(e) => setSelectedDeck(e.target.value)}
                  disabled={isLoadingDecks}
                >
                  <option value="">-- Escolha um baralho --</option>
                  {decks?.map((deck) => (
                    <option key={deck} value={deck}>{deck}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleFetchCards}
                disabled={!selectedDeck || isFetchingCards}
                className="w-full md:w-auto px-8 py-3 bg-[#6c63ff] hover:bg-[#5a52d5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all shadow-[0_4px_20px_rgba(108,99,255,0.3)] hover:shadow-[0_4px_25px_rgba(108,99,255,0.5)] hover:-translate-y-0.5"
              >
                {isFetchingCards ? 'Buscando...' : '⬇ Buscar Cartões'}
              </button>
            </div>

            {/* Sync Action */}
            {cardsData && (
              <div className="pt-6 border-t border-[#2e3347] flex justify-between items-center">
                <div className="text-[#e8eaf0]">
                  Cartões prontos: <span className="font-bold text-[#6c63ff]">{cardsData.learned.length + cardsData.newCards.length}</span> totais
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#22c55e] to-[#1ea34d] hover:from-[#1ea34d] hover:to-[#166534] disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-[0_4px_15px_rgba(34,197,94,0.3)]"
                >
                  {syncMutation.isPending ? 'Sincronizando...' : '☁ Sincronizar com Supabase'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabelas de Resultados */}
        {cardsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Aprendidos / Revisão */}
            <div className="bg-[#1a1d27] rounded-xl border border-[#2e3347] overflow-hidden flex flex-col h-[600px]">
              <div className="p-4 border-b border-[#2e3347] flex justify-between items-center bg-[#22263a]">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#22c55e]"></span>
                  Aprendidos / Revisão
                </h2>
                <span className="bg-[#2e3347] px-3 py-1 rounded-full text-sm font-bold">{cardsData.learned.length}</span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#1a1d27] sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-3 text-[#7b8099] font-semibold border-b border-[#2e3347]">Vocabulário</th>
                      <th className="p-3 text-[#7b8099] font-semibold border-b border-[#2e3347]">Leitura</th>
                      <th className="p-3 text-[#7b8099] font-semibold border-b border-[#2e3347]">Significado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardsData.learned.map(card => (
                      <tr key={card.cardId} className="hover:bg-[#22263a] border-b border-[#2e3347]/50 transition-colors">
                        <td className="p-3 font-bold text-lg">{card.vocabulary}</td>
                        <td className="p-3 text-[#7b8099]">{card.reading}</td>
                        <td className="p-3 text-[#3b82f6]">{card.meaning}</td>
                      </tr>
                    ))}
                    {cardsData.learned.length === 0 && (
                      <tr key="empty-learned">
                        <td colSpan={3} className="p-8 text-center text-[#7b8099]">Nenhum cartão encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Novos */}
            <div className="bg-[#1a1d27] rounded-xl border border-[#2e3347] overflow-hidden flex flex-col h-[600px]">
              <div className="p-4 border-b border-[#2e3347] flex justify-between items-center bg-[#22263a]">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#3b82f6]"></span>
                  Novos
                </h2>
                <span className="bg-[#2e3347] px-3 py-1 rounded-full text-sm font-bold">{cardsData.newCards.length}</span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#1a1d27] sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-3 text-[#7b8099] font-semibold border-b border-[#2e3347]">Vocabulário</th>
                      <th className="p-3 text-[#7b8099] font-semibold border-b border-[#2e3347]">Leitura</th>
                      <th className="p-3 text-[#7b8099] font-semibold border-b border-[#2e3347]">Significado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardsData.newCards.map(card => (
                      <tr key={card.cardId} className="hover:bg-[#22263a] border-b border-[#2e3347]/50 transition-colors">
                        <td className="p-3 font-bold text-lg">{card.vocabulary}</td>
                        <td className="p-3 text-[#7b8099]">{card.reading}</td>
                        <td className="p-3 text-[#3b82f6]">{card.meaning}</td>
                      </tr>
                    ))}
                    {cardsData.newCards.length === 0 && (
                      <tr key="empty-new">
                        <td colSpan={3} className="p-8 text-center text-[#7b8099]">Nenhum cartão encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
