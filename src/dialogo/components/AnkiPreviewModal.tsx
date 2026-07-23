import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { adicionarAoAnki, EnrichedCard } from '../services/ankiService';
import { toast } from '../../components/ui/use-toast';

interface AnkiPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardInicial: Partial<EnrichedCard>;
    modulo?: string;
    session?: any;
    provider?: string;
}

export default function AnkiPreviewModal({
    isOpen,
    onClose,
    cardInicial,
    modulo = 'Vocabulario',
    session,
    provider = 'groq'
}: AnkiPreviewModalProps) {
    const [card, setCard] = useState<EnrichedCard>({
        item: cardInicial?.item || '',
        leitura: cardInicial?.leitura || '',
        significado: cardInicial?.significado || '',
        categoria: cardInicial?.categoria || 'Geral',
        jlpt: cardInicial?.jlpt || 'N5',
        exemplo_jp: cardInicial?.exemplo_jp || '',
        exemplo_pt: cardInicial?.exemplo_pt || ''
    });

    const [deckModulo, setDeckModulo] = useState<string>(modulo);
    const [loadingEnrich, setLoadingEnrich] = useState(false);
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'editar'>('preview');

    useEffect(() => {
        if (!isOpen) return;

        setDeckModulo(modulo);
        const itemStr = cardInicial?.item || '';

        setCard({
            item: itemStr,
            leitura: cardInicial?.leitura || '',
            significado: cardInicial?.significado || '',
            categoria: cardInicial?.categoria || 'Geral',
            jlpt: cardInicial?.jlpt || 'N5',
            exemplo_jp: cardInicial?.exemplo_jp || '',
            exemplo_pt: cardInicial?.exemplo_pt || ''
        });

        // Se o card não tem significado completo ou leitura, auto-enriquece via API
        if (itemStr && (!cardInicial?.significado || !cardInicial?.leitura)) {
            enriquecerCard(itemStr, cardInicial);
        }
    }, [isOpen, cardInicial, modulo]);

    const enriquecerCard = async (itemStr: string, base: Partial<EnrichedCard>) => {
        setLoadingEnrich(true);
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch('/api/dialogo', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    acao: 'enriquecer_card',
                    item: itemStr,
                    leitura: base.leitura || '',
                    significado: base.significado || '',
                    categoria: base.categoria || '',
                    jlpt: base.jlpt || '',
                    exemplo_jp: base.exemplo_jp || '',
                    exemplo_pt: base.exemplo_pt || '',
                    provider
                })
            });

            if (response.ok) {
                const enriched = await response.json();
                setCard(prev => ({
                    ...prev,
                    leitura: enriched.leitura || prev.leitura,
                    significado: enriched.significado || prev.significado,
                    categoria: enriched.categoria || prev.categoria,
                    jlpt: enriched.jlpt || prev.jlpt,
                    exemplo_jp: enriched.exemplo_jp || prev.exemplo_jp,
                    exemplo_pt: enriched.exemplo_pt || prev.exemplo_pt
                }));
            }
        } catch (e) {
            console.warn('Falha ao enriquecer card automaticamente:', e);
        } finally {
            setLoadingEnrich(false);
        }
    };

    const handleSalvarNoAnki = async () => {
        if (!card.item) return;
        setSending(true);
        try {
            // 1. Envia para o Anki via AnkiConnect
            const noteId = await adicionarAoAnki(card, deckModulo);

            // 2. Tenta sincronizar com o Supabase (tabela anki_cards)
            if (session?.access_token) {
                try {
                    await fetch('/api/anki?acao=sincronizar', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify([{
                            noteId: noteId || Date.now(),
                            deckName: `DialoGo::${deckModulo}`,
                            status: 'novo',
                            vocabulary: card.item,
                            reading: card.leitura,
                            meaning: card.significado,
                            sentence: card.exemplo_jp || '',
                            tags: [card.categoria, card.jlpt].filter(Boolean)
                        }])
                    });
                } catch (subErr) {
                    console.warn('Aviso: Não foi possível registrar sync no Supabase:', subErr);
                }
            }

            toast({
                title: '🎴 Card exportado com sucesso!',
                description: `Adicionado ao baralho DialoGo::${deckModulo}`,
                variant: 'default'
            });

            onClose();
        } catch (err: any) {
            console.error('Erro ao adicionar ao Anki:', err);
            toast({
                title: 'Anki não está aberto ou AnkiConnect falhou',
                description: err?.message || 'Certifique-se de que o Anki está aberto com o plugin AnkiConnect (porta 8765).',
                variant: 'destructive'
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-card border-border sm:rounded-2xl shadow-2xl" style={{ zIndex: 100050 }}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <span className="text-xl">🎴</span> Exportar para o Anki
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Visualize e ajuste o cartão antes de enviá-lo para o baralho <span className="font-semibold text-primary">DialoGo::{deckModulo}</span>.
                    </DialogDescription>
                </DialogHeader>

                {/* Tabs Preview vs Editar */}
                <div className="flex border-b border-border my-1">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex-1 py-1.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        👁️ Card Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('editar')}
                        className={`flex-1 py-1.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'editar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        ✏️ Editar Campos
                    </button>
                </div>

                {loadingEnrich ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs animate-pulse">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Enriquecendo informações via IA e Jisho...</span>
                    </div>
                ) : activeTab === 'preview' ? (
                    /* PREVIEW DO CARD ESTILO ANKI */
                    <div className="flex flex-col gap-3 py-2">
                        {/* Frente */}
                        <div className="bg-background border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-xs">
                            <span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider mb-1">FRENTE</span>
                            <span className="text-2xl font-bold text-foreground">{card.item}</span>
                            {card.leitura && (
                                <span className="text-xs text-muted-foreground font-medium mt-0.5">
                                    【{card.leitura}】
                                </span>
                            )}
                        </div>

                        {/* Verso */}
                        <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-2 shadow-xs text-xs">
                            <span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider text-center border-b border-border pb-1">VERSO</span>
                            
                            <div>
                                <span className="font-bold text-muted-foreground">Significado:</span>
                                <p className="text-sm font-medium text-foreground mt-0.5">{card.significado || '—'}</p>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span><strong className="text-foreground">Categoria:</strong> {card.categoria}</span>
                                <span>•</span>
                                <span><strong className="text-foreground">JLPT:</strong> {card.jlpt}</span>
                            </div>

                            {(card.exemplo_jp || card.exemplo_pt) && (
                                <div className="mt-1 pt-2 border-t border-border/60 flex flex-col gap-0.5 bg-primary/5 p-2 rounded-lg">
                                    <span className="font-bold text-[10px] text-primary">EXEMPLO DE USO</span>
                                    {card.exemplo_jp && <p className="text-foreground font-medium">{card.exemplo_jp}</p>}
                                    {card.exemplo_pt && <p className="text-muted-foreground">{card.exemplo_pt}</p>}
                                </div>
                            )}
                        </div>

                        {/* Deck Selector */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0 font-medium">Baralho:</span>
                            <Input
                                value={deckModulo}
                                onChange={e => setDeckModulo(e.target.value)}
                                className="h-8 text-xs font-semibold text-primary"
                                placeholder="Nome do subdeck..."
                            />
                        </div>
                    </div>
                ) : (
                    /* FORMULÁRIO DE EDIÇÃO */
                    <div className="flex flex-col gap-2.5 py-2 text-xs">
                        <div>
                            <label className="font-semibold text-muted-foreground">Item (Japonês):</label>
                            <Input
                                value={card.item}
                                onChange={e => setCard({ ...card, item: e.target.value })}
                                className="h-8 text-xs mt-1"
                            />
                        </div>
                        <div>
                            <label className="font-semibold text-muted-foreground">Leitura (Furigana / Hiragana):</label>
                            <Input
                                value={card.leitura}
                                onChange={e => setCard({ ...card, leitura: e.target.value })}
                                className="h-8 text-xs mt-1"
                            />
                        </div>
                        <div>
                            <label className="font-semibold text-muted-foreground">Significado (Português):</label>
                            <Input
                                value={card.significado}
                                onChange={e => setCard({ ...card, significado: e.target.value })}
                                className="h-8 text-xs mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="font-semibold text-muted-foreground">Categoria:</label>
                                <Input
                                    value={card.categoria}
                                    onChange={e => setCard({ ...card, categoria: e.target.value })}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                            <div>
                                <label className="font-semibold text-muted-foreground">Nível JLPT:</label>
                                <Input
                                    value={card.jlpt}
                                    onChange={e => setCard({ ...card, jlpt: e.target.value })}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="font-semibold text-muted-foreground">Exemplo (JP):</label>
                            <Input
                                value={card.exemplo_jp || ''}
                                onChange={e => setCard({ ...card, exemplo_jp: e.target.value })}
                                className="h-8 text-xs mt-1"
                            />
                        </div>
                        <div>
                            <label className="font-semibold text-muted-foreground">Exemplo (PT):</label>
                            <Input
                                value={card.exemplo_pt || ''}
                                onChange={e => setCard({ ...card, exemplo_pt: e.target.value })}
                                className="h-8 text-xs mt-1"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2 sm:justify-between">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={sending} className="text-xs">
                        Cancelar
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSalvarNoAnki}
                        disabled={sending || loadingEnrich || !card.item}
                        className="text-xs font-bold gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Exportando...</span>
                            </>
                        ) : (
                            <>
                                <span>🎴 Confirmar & Exportar ao Anki</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
