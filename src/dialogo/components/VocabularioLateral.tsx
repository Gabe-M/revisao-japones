import React, { useState, useMemo } from 'react';
import InteractiveText from '../../components/InteractiveText';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, Volume2, Plus, Check, Sparkles, Filter, Brain } from 'lucide-react';
import { PalavraAdaptativa, StatusAdaptativo } from './PalavraNovaPopover';
import AnkiPreviewModal from './AnkiPreviewModal';

interface VocabularioLateralProps {
    context: any;
    session?: any;
    isOpen: boolean;
    onToggle: () => void;
    vocabularioAdaptativo: PalavraAdaptativa[];
    onAvaliarPalavra: (item: string, dificuldade: 'facil' | 'medio' | 'dificil') => void;
    onInjetarResposta?: (texto: string) => void;
    width?: number;
    onWidthChange?: (w: number) => void;
    onIsResizingChange?: (isResizing: boolean) => void;
}

export default function VocabularioLateral({
    context,
    session,
    isOpen,
    onToggle,
    vocabularioAdaptativo = [],
    onAvaliarPalavra,
    onInjetarResposta,
    width = 360,
    onWidthChange,
    onIsResizingChange
}: VocabularioLateralProps) {
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'aprendendo' | 'aprendido' | 'novo'>('todos');
    const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
    const [filtroJlpt, setFiltroJlpt] = useState<string>('todos');
    const [filtroEscrita, setFiltroEscrita] = useState<'todos' | 'kanji' | 'kana'>('todos');
    const [ordem, setOrdem] = useState<'recentes' | 'mais_usadas' | 'alfabetica'>('recentes');
    const [searchQuery, setSearchQuery] = useState('');
    const [ankiModalState, setAnkiModalState] = useState<{ isOpen: boolean; card: any }>({ isOpen: false, card: {} });

    // Drag handle resize handler
    const handleMouseDownResize = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onIsResizingChange) onIsResizingChange(true);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const maxW = Math.floor(window.innerWidth * 0.5);
            const newW = Math.min(maxW, Math.max(320, moveEvent.clientX));
            if (onWidthChange) onWidthChange(newW);
        };

        const handleMouseUp = () => {
            if (onIsResizingChange) onIsResizingChange(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const toggleMetadeTela = () => {
        const half = Math.floor(window.innerWidth * 0.5);
        if (width > window.innerWidth * 0.4) {
            if (onWidthChange) onWidthChange(360);
        } else {
            if (onWidthChange) onWidthChange(half);
        }
    };

    // Consolida vocabularioBanco (do banco do usuário) + vocabularioAdaptativo (da sessão)
    const listaConsolidada = useMemo(() => {
        const map = new Map<string, any>();

        // 1. Palavras do banco de vocabulário do usuário (já aprendidas)
        if (Array.isArray(context?.vocabularioBanco)) {
            context.vocabularioBanco.forEach((b: any) => {
                const item = b.item || b.termo || '';
                if (!item) return;
                map.set(item, {
                    item,
                    leitura: b.leitura || '',
                    significado: b.significado || b.traducao || '',
                    tipo: b.categoria || b.tipo || 'Vocabulário',
                    status: 'aprendido' as StatusAdaptativo,
                    vezesUsadaPeloAluno: 0,
                    vezesIntroducida: 0,
                    origem: 'banco'
                });
            });
        }

        // 2. Palavras do vocabulário adaptativo do diálogo atual (sobrepõe com status atual)
        if (Array.isArray(vocabularioAdaptativo)) {
            vocabularioAdaptativo.forEach((p: PalavraAdaptativa) => {
                if (!p.item) return;
                const existing = map.get(p.item);
                map.set(p.item, {
                    item: p.item,
                    leitura: p.leitura || existing?.leitura || '',
                    significado: p.significado || existing?.significado || '',
                    tipo: p.tipo || existing?.tipo || 'Vocabulário',
                    status: p.status || 'novo',
                    vezesUsadaPeloAluno: p.vezesUsadaPeloAluno || 0,
                    vezesIntroducida: p.vezesIntroducida || 0,
                    origem: 'adaptativo'
                });
            });
        }

        return Array.from(map.values());
    }, [context?.vocabularioBanco, vocabularioAdaptativo]);

    // Estatísticas
    const totalAprendidos = listaConsolidada.filter(p => p.status === 'aprendido').length;
    const totalAprendendo = listaConsolidada.filter(p => p.status === 'aprendendo_medio' || p.status === 'aprendendo_dificil').length;
    const totalNovos = listaConsolidada.filter(p => p.status === 'novo').length;

    const temFiltroAtivo = filtroStatus !== 'todos' || filtroCategoria !== 'todas' || filtroJlpt !== 'todos' || filtroEscrita !== 'todos' || searchQuery.trim() !== '';

    const limparFiltros = () => {
        setFiltroStatus('todos');
        setFiltroCategoria('todas');
        setFiltroJlpt('todos');
        setFiltroEscrita('todos');
        setSearchQuery('');
    };

    // Filtros e Ordenação Consolidados
    const listaFiltrada = useMemo(() => {
        let result = listaConsolidada.filter(p => {
            // 1. Filtro por status
            if (filtroStatus === 'aprendido' && p.status !== 'aprendido' && p.origem !== 'banco') return false;
            if (filtroStatus === 'aprendendo' && p.status !== 'aprendendo_medio' && p.status !== 'aprendendo_dificil' && p.status !== 'novo') return false;
            if (filtroStatus === 'novo' && p.status !== 'novo') return false;

            // 2. Filtro por categoria
            if (filtroCategoria !== 'todas') {
                const catLower = (p.tipo || p.categoria || '').toLowerCase();
                if (filtroCategoria === 'substantivo') {
                    const isSubst = catLower.includes('substantiv') || catLower.includes('nome') || catLower.includes('noun') || catLower === 'vocabulário' || catLower === '';
                    if (!isSubst) return false;
                } else if (filtroCategoria === 'verbo') {
                    if (!catLower.includes('verb')) return false;
                } else if (filtroCategoria === 'adjetivo') {
                    if (!catLower.includes('adjetiv') && !catLower.includes('adj')) return false;
                } else if (filtroCategoria === 'expressao') {
                    if (!catLower.includes('express') && !catLower.includes('partícula') && !catLower.includes('frase') && !catLower.includes('greeting')) return false;
                }
            }

            // 3. Filtro por JLPT (ex: N5, N4, N3)
            if (filtroJlpt !== 'todos') {
                const itemJlpt = (p.jlpt || context?.jlpt || 'N5').toString().toUpperCase();
                const targetJlpt = filtroJlpt.toUpperCase();
                if (!itemJlpt.includes(targetJlpt)) return false;
            }

            // 4. Filtro por tipo de escrita (Kanji vs Kana)
            const rawItem = p.item.replace(/<[^>]*>/g, '');
            const hasKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(rawItem);
            if (filtroEscrita === 'kanji' && !hasKanji) return false;
            if (filtroEscrita === 'kana' && hasKanji) return false;

            // 5. Busca por texto
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const itemPuro = rawItem.toLowerCase();
                const leituraPura = (p.leitura || '').replace(/<[^>]*>/g, '').toLowerCase();
                const sigPuro = (p.significado || '').toLowerCase();

                const itemMatch = itemPuro.includes(q);
                const leituraMatch = leituraPura.includes(q);
                const sigMatch = sigPuro.includes(q);
                if (!itemMatch && !leituraMatch && !sigMatch) return false;
            }

            return true;
        });

        // Ordenação
        if (ordem === 'mais_usadas') {
            result.sort((a, b) => (b.vezesUsadaPeloAluno || 0) - (a.vezesUsadaPeloAluno || 0));
        } else if (ordem === 'alfabetica') {
            result.sort((a, b) => {
                const strA = (a.leitura || a.item || '').replace(/<[^>]*>/g, '');
                const strB = (b.leitura || b.item || '').replace(/<[^>]*>/g, '');
                return strA.localeCompare(strB);
            });
        }

        return result;
    }, [listaConsolidada, filtroStatus, filtroCategoria, filtroJlpt, filtroEscrita, ordem, searchQuery, context?.jlpt]);

    const tocarAudio = (texto: string) => {
        const textoPuro = texto.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]*>/g, '');
        const utterance = new SpeechSynthesisUtterance(textoPuro);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
    };

    const handleUsar = (item: string) => {
        const textoPuro = item.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]*>/g, '');
        if (onInjetarResposta) onInjetarResposta(textoPuro);
        if (window.innerWidth < 768) {
            onToggle();
        }
    };

    return (
        <>
            {/* ── Botão Flutuante Esquerdo ── */}
            <button
                onClick={onToggle}
                title={isOpen ? 'Fechar Vocabulário' : 'Abrir Vocabulário'}
                className={[
                    'fixed z-40 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1',
                    'w-9 h-28 rounded-r-xl border border-l-0 border-border bg-card shadow-lg',
                    'text-primary font-bold text-[0.65em] leading-tight transition-all duration-300',
                    'hover:bg-accent hover:text-accent-foreground select-none'
                ].join(' ')}
                style={{
                    left: isOpen ? `${width}px` : '0px',
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed'
                }}
            >
                <span className="text-base">📚</span>
                <span>{isOpen ? '◀ Fechar' : 'Vocab ▶'}</span>
            </button>

            {/* ── Painel Lateral Esquerdo ── */}
            <div
                className={[
                    'fixed left-0 top-0 h-full z-30 flex flex-col',
                    'bg-card border-r border-border shadow-2xl overflow-hidden'
                ].join(' ')}
                style={{
                    width: isOpen ? `${width}px` : '0px',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none'
                }}
                aria-hidden={!isOpen}
            >
                {/* Drag handle no lado direito */}
                <div
                    onMouseDown={handleMouseDownResize}
                    title="Arraste para redimensionar (até 50% da tela)"
                    className="absolute right-0 top-0 w-2.5 h-full cursor-ew-resize hover:bg-primary/40 transition-colors z-50 flex items-center justify-center group"
                >
                    <div className="w-1 h-10 rounded-full bg-muted-foreground/30 group-hover:bg-primary" />
                </div>
                {/* Header */}
                <div className="flex flex-col border-b border-border bg-card shrink-0">
                    <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
                        <div className="flex flex-col">
                            <span className="font-bold text-foreground text-[0.95em]">📚 Vocabulário do Aluno</span>
                            <span className="text-muted-foreground text-[0.75em]">Acompanhamento de Palavras</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleMetadeTela}
                                className="h-7 px-2 text-[0.7rem] font-semibold text-muted-foreground hover:text-foreground"
                                title={width > window.innerWidth * 0.4 ? 'Restaurar largura padrão' : 'Esticar até a metade da tela (50%)'}
                            >
                                {width > window.innerWidth * 0.4 ? '↔ Padrão' : '↔ 50% Tela'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggle}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Fechar"
                            >
                                ✕
                            </Button>
                        </div>
                    </div>

                    {/* Resumo de Estatísticas */}
                    <div className="grid grid-cols-3 gap-1.5 px-3 py-2 bg-muted/20 border-t border-border text-center text-xs">
                        <div className="flex flex-col items-center bg-card p-1.5 rounded-lg border border-border/60">
                            <span className="text-emerald-500 font-bold text-sm">{totalAprendidos}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">🟢 Aprendidos</span>
                        </div>
                        <div className="flex flex-col items-center bg-card p-1.5 rounded-lg border border-border/60">
                            <span className="text-amber-500 font-bold text-sm">{totalAprendendo}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">🟡 Aprendendo</span>
                        </div>
                        <div className="flex flex-col items-center bg-card p-1.5 rounded-lg border border-border/60">
                            <span className="text-rose-500 font-bold text-sm">{totalNovos}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">🆕 Novas</span>
                        </div>
                    </div>

                    {/* Barra de Busca e Filtros Padrões */}
                    <div className="p-3 flex flex-col gap-2 bg-card">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Filtrar palavra, furigana ou tradução..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-xs"
                            />
                        </div>

                        {/* Abas de Filtro de Status */}
                        <div className="flex gap-1 overflow-x-auto text-[0.7rem] font-bold pb-1">
                            <button
                                onClick={() => setFiltroStatus('todos')}
                                className={`px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${filtroStatus === 'todos' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                            >
                                Todos ({listaConsolidada.length})
                            </button>
                            <button
                                onClick={() => setFiltroStatus('aprendendo')}
                                className={`px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${filtroStatus === 'aprendendo' ? 'bg-amber-500 text-white border-amber-500' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                            >
                                🟡 Aprendendo ({totalAprendendo})
                            </button>
                            <button
                                onClick={() => setFiltroStatus('aprendido')}
                                className={`px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${filtroStatus === 'aprendido' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                            >
                                🟢 Aprendidos ({totalAprendidos})
                            </button>
                            <button
                                onClick={() => setFiltroStatus('novo')}
                                className={`px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${filtroStatus === 'novo' ? 'bg-rose-500 text-white border-rose-500' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                            >
                                🆕 Novas ({totalNovos})
                            </button>
                        </div>

                        {/* Filtros Padrões Adicionais (Categoria, JLPT, Escrita, Ordem) */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/60 text-[0.7rem]">
                            {/* Categoria */}
                            <select
                                value={filtroCategoria}
                                onChange={e => setFiltroCategoria(e.target.value)}
                                className="h-7 px-2 rounded-md border border-border outline-none font-semibold cursor-pointer"
                                style={{ backgroundColor: '#18181b', color: '#ffffff' }}
                            >
                                <option value="todas" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🏷️ Categorias: Todas</option>
                                <option value="substantivo" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>📦 Substantivos</option>
                                <option value="verbo" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>⚡ Verbos</option>
                                <option value="adjetivo" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🎨 Adjetivos</option>
                                <option value="expressao" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>💬 Expressões / Partículas</option>
                            </select>

                            {/* Nível JLPT */}
                            <select
                                value={filtroJlpt}
                                onChange={e => setFiltroJlpt(e.target.value)}
                                className="h-7 px-2 rounded-md border border-border outline-none font-semibold cursor-pointer"
                                style={{ backgroundColor: '#18181b', color: '#ffffff' }}
                            >
                                <option value="todos" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>📊 JLPT: Todos</option>
                                <option value="N5" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🟢 JLPT N5</option>
                                <option value="N4" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🔵 JLPT N4</option>
                                <option value="N3" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🟣 JLPT N3</option>
                            </select>

                            {/* Tipo de Escrita (Kanji / Kana) */}
                            <select
                                value={filtroEscrita}
                                onChange={e => setFiltroEscrita(e.target.value as any)}
                                className="h-7 px-2 rounded-md border border-border outline-none font-semibold cursor-pointer"
                                style={{ backgroundColor: '#18181b', color: '#ffffff' }}
                            >
                                <option value="todos" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>✍️ Escrita: Todos</option>
                                <option value="kanji" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>漢字 Apenas Kanji</option>
                                <option value="kana" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>あ Apenas Kana</option>
                            </select>

                            {/* Ordenação */}
                            <select
                                value={ordem}
                                onChange={e => setOrdem(e.target.value as any)}
                                className="h-7 px-2 rounded-md border border-border outline-none font-semibold cursor-pointer"
                                style={{ backgroundColor: '#18181b', color: '#ffffff' }}
                            >
                                <option value="recentes" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🕒 Ordem: Recentes</option>
                                <option value="mais_usadas" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>📈 Mais Usadas</option>
                                <option value="alfabetica" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>🔤 Ordem A-Z</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Lista de Palavras */}
                <ScrollArea className="flex-1 w-full bg-black/[0.01]">
                    <div className={width > 500 ? "p-3 grid grid-cols-2 gap-2.5 pb-8" : "p-3 flex flex-col gap-2.5 pb-8"}>
                        {listaFiltrada.length === 0 ? (
                            <div className="text-center py-10 px-4 flex flex-col items-center gap-3 text-xs text-muted-foreground">
                                <p>Nenhuma palavra encontrada com os filtros selecionados.</p>
                                {temFiltroAtivo && (
                                    <button
                                        onClick={limparFiltros}
                                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
                                    >
                                        🧹 Limpar Todos os Filtros
                                    </button>
                                )}
                            </div>
                        ) : (
                            listaFiltrada.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2 shadow-xs hover:border-primary/40 transition-all relative group"
                                >
                                    {/* Header do Card */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-lg font-bold text-foreground">
                                                    <InteractiveText text={item.item} />
                                                </span>
                                                {item.leitura && (
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        【{item.leitura}】
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-medium text-foreground/80 mt-0.5">
                                                {item.significado || 'Sem tradução'}
                                            </p>
                                        </div>

                                        {/* Status Badge */}
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                            item.status === 'aprendido' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                            item.status === 'aprendendo_dificil' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                            item.status === 'aprendendo_medio' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                            'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                        }`}>
                                            {item.status === 'aprendido' ? '🟢 Aprendido' :
                                             item.status === 'aprendendo_dificil' ? '🔴 Difícil' :
                                             item.status === 'aprendendo_medio' ? '🟡 Médio' : '🆕 Nova'}
                                        </span>
                                    </div>

                                    {/* Footer com Ações */}
                                    <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                                        {/* Botões de Alteração de Dificuldade */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => onAvaliarPalavra(item.item, 'facil')}
                                                title="Marcar como Fácil / Aprendido"
                                                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                                            >
                                                🟢 Fácil
                                            </button>
                                            <button
                                                onClick={() => onAvaliarPalavra(item.item, 'medio')}
                                                title="Marcar como Dificuldade Média"
                                                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                                            >
                                                🟡 Médio
                                            </button>
                                            <button
                                                onClick={() => onAvaliarPalavra(item.item, 'dificil')}
                                                title="Marcar como Difícil"
                                                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors"
                                            >
                                                🔴 Difícil
                                            </button>
                                        </div>

                                        {/* Botões de Utilidade: Audio, Usar, Anki */}
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                onClick={() => tocarAudio(item.item)}
                                                title="Ouvir Pronúncia"
                                            >
                                                <Volume2 size={12} />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                className="h-6 w-6 text-xs font-bold"
                                                onClick={() => handleUsar(item.item)}
                                                title="Injetar no Chat"
                                            >
                                                ▶
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-6 w-6 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                                                onClick={() => setAnkiModalState({
                                                    isOpen: true,
                                                    card: {
                                                        item: item.item,
                                                        leitura: item.leitura,
                                                        significado: item.significado,
                                                        categoria: item.tipo || 'Vocabulário',
                                                        jlpt: context?.jlpt || 'N5'
                                                    }
                                                })}
                                                title="Exportar para o Anki"
                                            >
                                                🎴
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Modal de Preview do Anki */}
            {ankiModalState.isOpen && (
                <AnkiPreviewModal
                    isOpen={ankiModalState.isOpen}
                    onClose={() => setAnkiModalState(prev => ({ ...prev, isOpen: false }))}
                    cardInicial={ankiModalState.card}
                    session={session}
                    provider={context?.provider || 'groq'}
                    modulo="Vocabulario"
                />
            )}

            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/40 backdrop-blur-xs md:hidden"
                    onClick={onToggle}
                />
            )}
        </>
    );
}
