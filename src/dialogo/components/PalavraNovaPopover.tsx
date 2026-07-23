import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { adicionarAoAnki } from '../services/ankiService';
import { toast } from '../../components/ui/use-toast';
import AnkiPreviewModal from './AnkiPreviewModal';

export type StatusAdaptativo = 'novo' | 'aprendendo_medio' | 'aprendendo_dificil' | 'aprendido';

export interface PalavraAdaptativa {
    item: string;
    leitura: string;
    significado: string;
    tipo?: string;
    status: StatusAdaptativo;
    vezesUsadaPeloAluno: number;
    vezesIntroducida: number;
    avaliadaEm?: string;
}

interface PalavraNovaPopoverProps {
    palavra: PalavraAdaptativa;
    x: number;
    y: number;
    onAvaliar: (item: string, dificuldade: 'facil' | 'medio' | 'dificil') => void;
    onClose: () => void;
}

export default function PalavraNovaPopover({ palavra, x, y, onAvaliar, onClose }: PalavraNovaPopoverProps) {
    const [adicionandoAnki, setAdicionandoAnki] = useState(false);
    const [ankiModalOpen, setAnkiModalOpen] = useState(false);

    // Position the popover: try to keep it within viewport
    const popoverWidth = 260;
    const popoverHeight = 250;
    const margin = 12;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let left = x - popoverWidth / 2;
    let top = y + margin + 8;

    // Clamp horizontally
    if (left < margin) left = margin;
    if (left + popoverWidth > vpW - margin) left = vpW - popoverWidth - margin;

    // Flip above if not enough space below
    if (top + popoverHeight > vpH - margin) {
        top = y - popoverHeight - margin;
    }

    const jaAvaliada = palavra.status !== 'novo';

    const handleAdicionarAnki = () => {
        if (!palavra?.item) return;
        setAnkiModalOpen(true);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[998]"
                onClick={onClose}
            />

            {/* Popover */}
            <div
                className="fixed z-[999] bg-card border border-border rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
                style={{ left, top, width: popoverWidth }}
            >
                {/* Header: word + reading */}
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">{palavra.item}</span>
                        {palavra.leitura && (
                            <span className="text-sm text-muted-foreground font-medium">
                                【{palavra.leitura}】
                            </span>
                        )}
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                            Novo
                        </span>
                    </div>
                    {palavra.tipo && (
                        <span className="text-xs text-muted-foreground capitalize">{palavra.tipo}</span>
                    )}
                    <p className="text-sm text-foreground/80 font-medium mt-1 leading-snug">
                        {palavra.significado}
                    </p>
                </div>

                {/* Button: Adicionar ao Anki */}
                <Button
                    size="sm"
                    variant="outline"
                    disabled={adicionandoAnki}
                    onClick={handleAdicionarAnki}
                    className="w-full h-8 text-xs font-semibold border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-400 flex items-center justify-center gap-1.5"
                >
                    {adicionandoAnki ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Enviando ao Anki...</span>
                        </>
                    ) : (
                        <span>🎴 Adicionar ao Anki</span>
                    )}
                </Button>

                {/* Difficulty buttons */}
                {!jaAvaliada ? (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[0.7rem] text-muted-foreground uppercase tracking-wider font-semibold">
                            Qual é sua dificuldade com esta palavra?
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAvaliar(palavra.item, 'facil')}
                                className="h-9 text-xs font-bold border-green-500/30 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/50 flex flex-col gap-0.5 px-1"
                            >
                                <span className="text-base leading-none">😊</span>
                                <span>Fácil</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAvaliar(palavra.item, 'medio')}
                                className="h-9 text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/50 flex flex-col gap-0.5 px-1"
                            >
                                <span className="text-base leading-none">🤔</span>
                                <span>Médio</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAvaliar(palavra.item, 'dificil')}
                                className="h-9 text-xs font-bold border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50 flex flex-col gap-0.5 px-1"
                            >
                                <span className="text-base leading-none">😰</span>
                                <span>Difícil</span>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className={`text-xs font-semibold text-center py-1.5 rounded-lg ${
                        palavra.status === 'aprendido'
                            ? 'bg-green-500/10 text-green-500'
                            : palavra.status === 'aprendendo_medio'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-rose-500/10 text-rose-400'
                    }`}>
                        {palavra.status === 'aprendido' ? '✅ Marcada como aprendida' :
                         palavra.status === 'aprendendo_medio' ? '🤔 Em aprendizado (médio)' :
                         '😰 Em aprendizado (difícil)'}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
                    aria-label="Fechar"
                >×</button>
            </div>
            {/* Modal de Preview Anki */}
            {ankiModalOpen && (
                <AnkiPreviewModal
                    isOpen={ankiModalOpen}
                    onClose={() => setAnkiModalOpen(false)}
                    cardInicial={{
                        item: palavra.item,
                        leitura: palavra.leitura || '',
                        significado: palavra.significado || '',
                        categoria: palavra.tipo || 'Vocabulário'
                    }}
                    modulo="Vocabulario"
                />
            )}
        </>
    );
}

