import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Download, RefreshCw, Layers, CheckCircle2, Circle } from 'lucide-react';
import {
  useAnkiConnection,
  useAnkiDecks,
  useAnkiCards,
  useSyncToSupabase,
  useSyncedCards,
} from './anki/useAnkiQuery';
import './anki/anki.css';

export default function AnkiApp() {
  const queryClient = useQueryClient();
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'learned' | 'new' | 'cloud'>('learned');

  // Recuperar Token
  const sessaoLocalStorage = localStorage.getItem('supabase_session');
  const sessao = sessaoLocalStorage ? JSON.parse(sessaoLocalStorage) : null;
  const authToken = sessao ? `Bearer ${sessao.access_token}` : null;

  const { data: conn, isFetching: isCheckingConn, refetch: checkConn } = useAnkiConnection();
  const isConnected = conn?.connected;
  const { data: decks, isLoading: isLoadingDecks } = useAnkiDecks(!!isConnected);
  const { data: cardsData, isFetching: isFetchingCards, refetch: fetchCards } = useAnkiCards(selectedDeck || null);
  const syncMutation = useSyncToSupabase();
  const { data: syncedCards, isFetching: isFetchingSynced, isError: isErrorSynced } = useSyncedCards(authToken);

  // Group synced cards by deck
  const syncedDecks = React.useMemo(() => {
    if (!syncedCards) return [];
    const decksMap = new Map<string, { count: number; latestSync: string }>();
    for (const card of syncedCards) {
      if (!decksMap.has(card.deck_name)) decksMap.set(card.deck_name, { count: 0, latestSync: card.synced_at });
      const stats = decksMap.get(card.deck_name)!;
      stats.count++;
      if (new Date(card.synced_at) > new Date(stats.latestSync)) stats.latestSync = card.synced_at;
    }
    return Array.from(decksMap.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [syncedCards]);

  const handleFetchCards = () => { if (selectedDeck) fetchCards(); };

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

  const displayCards = activeTab === 'learned' ? cardsData?.learned : cardsData?.newCards;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Soft glowing ambient background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-5xl mx-auto p-6 md:p-12 relative z-10 flex flex-col h-screen">
        
        {/* Top Navigation / Status */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Anki Connect</h1>
              <p className="text-zinc-500 text-sm font-medium">Integração de Progresso Kaishi</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => checkConn()}
              className="p-3 rounded-full hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <RefreshCw size={20} className={isCheckingConn ? 'animate-spin' : ''} />
            </button>
            <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <div className="relative flex h-2 w-2">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </div>
              {isConnected ? 'Online' : 'Offline'}
            </div>
          </div>
        </header>

        {/* Action Center - Soft pill shape */}
        {isConnected && (
          <div className="flex flex-col md:flex-row gap-4 items-center bg-zinc-900/50 p-3 rounded-[2.5rem] backdrop-blur-md shadow-xl mb-12 border border-white/5">
            <div className="flex-1 w-full relative">
              <select
                className="w-full appearance-none bg-transparent text-zinc-200 pl-6 pr-12 py-4 focus:outline-none text-lg font-medium cursor-pointer rounded-full"
                value={selectedDeck}
                onChange={(e) => setSelectedDeck(e.target.value)}
                disabled={isLoadingDecks}
              >
                <option value="" disabled className="bg-zinc-900">Selecione o Baralho...</option>
                {decks?.map((deck) => (
                  <option key={deck} value={deck} className="bg-zinc-900">{deck}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none text-zinc-500">
                ▼
              </div>
            </div>
            
            <button
              onClick={handleFetchCards}
              disabled={!selectedDeck || isFetchingCards}
              className="w-full md:w-auto px-10 py-4 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold transition-all flex items-center justify-center gap-2"
            >
              {isFetchingCards ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
              <span>Extrair</span>
            </button>
            
            {cardsData && (
              <button
                onClick={handleSync}
                disabled={syncMutation.isPending}
                className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-emerald-950 disabled:opacity-50 rounded-full font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {syncMutation.isPending ? <RefreshCw className="animate-spin" size={20} /> : <Cloud size={20} />}
                <span>Sincronizar {cardsData.learned.length + cardsData.newCards.length} Cartões</span>
              </button>
            )}
          </div>
        )}

        {/* Main Content Areas Split */}
        <div className="flex flex-col xl:flex-row gap-8 flex-1 min-h-0 pb-8">
          
          {/* Left Column: Local Cards Area */}
          {cardsData && (
            <div className="flex-[2] flex flex-col min-h-[500px] xl:min-h-0 bg-zinc-900/20 rounded-[3rem] p-6 backdrop-blur-sm border border-white/5 relative">
              {/* Tabs for Local Cards */}
              <div className="flex flex-wrap gap-4 md:gap-8 mb-6 px-4 shrink-0">
                <button 
                  onClick={() => setActiveTab('learned')}
                  className={`text-lg font-bold transition-colors relative pb-2 flex items-center gap-3 ${activeTab === 'learned' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Revisão <span className="px-3 py-1 rounded-full bg-zinc-800 text-xs text-zinc-300">{cardsData.learned.length}</span>
                  {activeTab === 'learned' && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </button>
                <button 
                  onClick={() => setActiveTab('new')}
                  className={`text-lg font-bold transition-colors relative pb-2 flex items-center gap-3 ${activeTab === 'new' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Novos <span className="px-3 py-1 rounded-full bg-zinc-800 text-xs text-zinc-300">{cardsData.newCards.length}</span>
                  {activeTab === 'new' && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
              </div>

              {/* Local Cards List */}
              <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar px-2" style={{ maskImage: 'linear-gradient(to bottom, black 90%, transparent)' }}>
                <div className="flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {displayCards?.slice(0, 100).map((card, index) => (
                      <motion.div
                        key={card.cardId}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.2 }}
                        className="group flex flex-col md:flex-row md:items-center justify-between p-5 md:px-8 rounded-full bg-zinc-800/20 hover:bg-zinc-800/50 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-6 shrink-0">
                          {activeTab === 'learned' ? (
                            <CheckCircle2 size={24} className="text-emerald-500/50 shrink-0" />
                          ) : (
                            <Circle size={24} className="text-blue-500/50 shrink-0" />
                          )}
                          <div className="flex items-baseline gap-4">
                            <span className="text-2xl font-bold text-white tracking-wide">{card.vocabulary}</span>
                            <span className="text-sm font-medium text-zinc-400 bg-black/20 px-4 py-1.5 rounded-full shrink-0">
                              {card.reading}
                            </span>
                          </div>
                        </div>
                        
                        <div className="md:w-1/2 flex justify-end">
                          <p className="text-zinc-400 text-sm font-medium text-left md:text-right truncate leading-relaxed">
                            {card.meaning}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {displayCards && displayCards.length > 100 && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-center p-8 text-zinc-600 font-medium"
                    >
                      + {displayCards.length - 100} cartões adicionais ocultos
                    </motion.div>
                  )}
                  
                  {displayCards && displayCards.length === 0 && (
                    <div className="text-center p-20 text-zinc-600 font-medium text-lg">
                      Nenhum cartão encontrado nesta lista.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Right Column: Cloud / Synced Decks Area */}
          <div className="flex-1 flex flex-col min-h-[400px] xl:min-h-0 bg-sky-900/5 rounded-[3rem] p-6 backdrop-blur-sm border border-sky-500/10">
            <div className="flex items-center gap-3 mb-6 px-4 shrink-0">
              <Cloud className="text-sky-400" size={28} />
              <h2 className="text-xl font-bold text-white">Nuvem Sincronizada</h2>
              <span className="ml-auto px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
                {syncedDecks.length} Baralhos
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar px-2" style={{ maskImage: 'linear-gradient(to bottom, black 90%, transparent)' }}>
              <div className="flex flex-col gap-4">
                {isFetchingSynced && !syncedDecks.length && (
                  <div className="flex flex-col items-center justify-center p-12 text-sky-500 gap-3">
                    <RefreshCw className="animate-spin" size={24} />
                    <span className="font-bold text-sm">Carregando nuvem...</span>
                  </div>
                )}
                
                {isErrorSynced && (
                  <div className="text-center p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 font-medium">
                    Erro ao listar cartões da nuvem. Verifique o console ou as permissões do Supabase (RLS).
                  </div>
                )}

                {!isFetchingSynced && !isErrorSynced && syncedDecks.length === 0 && (
                  <div className="text-center p-12 text-zinc-600 font-medium">
                    Nenhum baralho encontrado. Se você acabou de sincronizar, verifique a política de SELECT (RLS) no Supabase!
                  </div>
                )}

                {!isErrorSynced && syncedDecks.map((deck, index) => (
                  <motion.div
                    key={deck.name}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.2 }}
                    className="group flex flex-col p-6 rounded-[2rem] bg-sky-900/10 hover:bg-sky-900/20 border border-sky-500/10 transition-colors gap-3"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-lg font-bold text-white tracking-wide break-words">{deck.name}</span>
                      <div className="bg-sky-500/10 text-sky-400 px-4 py-1.5 rounded-full font-bold text-xs border border-sky-500/20 shrink-0">
                        {deck.count} cartões
                      </div>
                    </div>
                    <p className="text-zinc-500 text-xs font-medium">
                      Atualizado em {new Date(deck.latestSync).toLocaleString('pt-BR')}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}
