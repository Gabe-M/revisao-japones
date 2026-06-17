import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  checkAnkiConnection,
  fetchDeckNames,
  fetchAllCardsFromDeck,
} from './ankiService';

// Hook: status da conexão (atualiza manualmente via refetch)
export function useAnkiConnection() {
  return useQuery({
    queryKey: ['anki', 'connection'],
    queryFn: checkAnkiConnection,
    staleTime: 0,
    retry: false,
  });
}

// Hook: lista de baralhos
export function useAnkiDecks(enabled: boolean) {
  return useQuery({
    queryKey: ['anki', 'decks'],
    queryFn: fetchDeckNames,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

// Hook: cartões de um baralho específico (dispara manualmente)
export function useAnkiCards(deckName: string | null) {
  return useQuery({
    queryKey: ['anki', 'cards', deckName],
    queryFn: () => fetchAllCardsFromDeck(deckName!),
    enabled: false, // Nunca auto-executa — apenas via refetch()
    staleTime: 0,
    retry: false,
  });
}

// Mutation: sincronizar com Supabase via endpoint /api/anki
export function useSyncToSupabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { cards: unknown[]; authToken: string }) => {
      const response = await fetch('/api/anki?acao=sincronizar', {
        method: 'POST',
        headers: {
          'Authorization': payload.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload.cards),
      });
      if (!response.ok) {
        let errDetails = '';
        try {
          const errData = await response.json();
          errDetails = errData.detalhes ? JSON.stringify(errData.detalhes) : (errData.error || response.statusText);
        } catch {
          errDetails = response.statusText;
        }
        throw new Error(`Sync falhou (${response.status}): ${errDetails}`);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['anki'] }),
  });
}

// Hook: buscar cartões já sincronizados no Supabase
export function useSyncedCards(authToken: string | null) {
  return useQuery({
    queryKey: ['anki', 'synced'],
    queryFn: async () => {
      const response = await fetch('/api/anki?acao=listar', {
        headers: { 'Authorization': authToken! }
      });
      if (!response.ok) throw new Error(`Falha ao buscar sincronizados: ${response.status}`);
      return response.json();
    },
    enabled: !!authToken,
    staleTime: 60_000,
  });
}
