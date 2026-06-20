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
  openCard: (termo: string, fraseContexto: string, x: number, y: number) => void;
  closeCard: () => void;
}

const TermCardContext = createContext<TermCardContextData | undefined>(undefined);

export function TermCardProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [termo, setTermo] = useState('');
  const [fraseContexto, setFraseContexto] = useState('');
  const [posicao, setPosicao] = useState<Posicao>({ x: 0, y: 0 });

  const openCard = (novoTermo: string, contexto: string, x: number, y: number) => {
    setTermo(novoTermo);
    setFraseContexto(contexto);
    setPosicao({ x, y });
    setIsOpen(true);
  };

  const closeCard = () => {
    setIsOpen(false);
    setTermo('');
    setFraseContexto('');
  };

  return (
    <TermCardContext.Provider value={{ isOpen, termo, fraseContexto, posicao, openCard, closeCard }}>
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
