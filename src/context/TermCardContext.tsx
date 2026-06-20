import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Posicao {
  x: number;
  y: number;
}

interface TermCardContextData {
  isOpen: boolean;
  termo: string;
  fraseContexto: string;
  posicao: Posicao;
  tipo?: string;
  openCard: (termo: string, fraseContexto: string, x: number, y: number, tipo?: string) => void;
  closeCard: () => void;
}

const TermCardContext = createContext<TermCardContextData | undefined>(undefined);

export function TermCardProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [termo, setTermo] = useState('');
  const [fraseContexto, setFraseContexto] = useState('');
  const [posicao, setPosicao] = useState<Posicao>({ x: 0, y: 0 });
  const [tipo, setTipo] = useState('Vocabulario');

  const openCard = (novoTermo: string, contexto: string, x: number, y: number, novoTipo: string = 'Vocabulario') => {
    setTermo(novoTermo);
    setFraseContexto(contexto);
    setPosicao({ x, y });
    setTipo(novoTipo);
    setIsOpen(true);
  };

  const closeCard = () => {
    setIsOpen(false);
    setTermo('');
    setFraseContexto('');
    setTipo('Vocabulario');
  };

  return (
    <TermCardContext.Provider value={{ isOpen, termo, fraseContexto, posicao, tipo, openCard, closeCard }}>
      {children}
    </TermCardContext.Provider>
  );
}

export function useTermCard() {
  const context = useContext(TermCardContext);
  if (!context) {
    throw new Error('useTermCard must be used within a TermCardProvider');
  }
  return context;
}
