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
      if (!response.ok) throw new Error(`Sync falhou: ${response.status}`);
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['anki'] }),
  });
}
