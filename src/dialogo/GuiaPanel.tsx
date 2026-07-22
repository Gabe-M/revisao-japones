import React, { useState, useEffect } from 'react';
import InteractiveText from '../components/InteractiveText';
import VocabularioChip from './components/VocabularioChip';
import DraggableCard from './components/DraggableCard';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';
import PhraseCard from './components/PhraseCard';
import AdvancedAddModal from './components/AdvancedAddModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GuiaPanelProps {
    context: any;
    session?: any;
    onNext: () => void;
    onBack: () => void;
    onUpdateContext: (newData: any) => void;
}

const normalizarVocabulario = (vocab: any) => {
    if (!Array.isArray(vocab) || vocab.length === 0) return [];
    if (vocab[0].categoria) return vocab;
    return [{ categoria: "Vocabulário Geral", termos: vocab }];
};

export default function GuiaPanel({ context, session, onNext, onBack, onUpdateContext }: GuiaPanelProps) {
    const [loading, setLoading] = useState(true);
    const [dados, setDados] = useState<any>(null);
    const [activeCards, setActiveCards] = useState<any[]>([]);
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(context.provider || (localStorage.getItem('selected_provider') as any) || 'groq');
    const [fallbackOpen, setFallbackOpen] = useState(false);
    const [fallbackError, setFallbackError] = useState('');
    const [isVocabOpen, setIsVocabOpen] = useState(true);
    const [isGeneratingLote, setIsGeneratingLote] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);

    const [activeCategory, setActiveCategory] = useState('Todos');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeCategory, searchQuery, filterStatus]);

    const addCard = (newCard: any) => {
        setActiveCards(prev => {
            if (prev.some(c => c.item === newCard.item)) return prev;
            const next = [...prev, newCard];
            if (next.length > 5) next.shift();
            return next;
        });
    };

    const removeCard = (itemToRemove: string) => {
        setActiveCards(prev => prev.filter(c => c.item !== itemToRemove));
    };

    const handleWordClick = (word: string, leitura: string, fraseOriginal?: string, tipo: string = 'Dicionário') => {
        let item = word.trim();
        let reading = leitura.trim();
        if (!item) return;

        // Find in legacy or new categorized vocabulary structure
        let foundVocab = null;
        if (dados?.vocabulario) {
            foundVocab = dados.vocabulario.find((v: any) => v.item === item);
        }
        if (!foundVocab && dados?.vocabulario_chave) {
            for (const cat of dados.vocabulario_chave) {
                const term = cat.termos?.find((t: any) => (t.termo || t.item) === item);
                if (term) {
                    foundVocab = {
                        item: term.termo || term.item,
                        leitura: term.leitura,
                        significado: term.traducao || term.significado,
                        jlpt: term.jlpt
                    };
                    break;
                }
            }
        }
        if (!foundVocab && context.vocabularioBanco) {
            foundVocab = context.vocabularioBanco.find((b: any) => b.item === item);
        }
        
        if (foundVocab && tipo !== 'SelecaoLivre') {
            addCard({
                item: foundVocab.item,
                leitura: foundVocab.leitura || reading,
                significado: foundVocab.significado,
                jlpt: foundVocab.jlpt,
                tipo: 'Vocabulário',
                fraseOriginal: fraseOriginal || ''
            });
        } else {
            const tempCardId = item;
            
            if (tipo === 'SelecaoLivre') {
                addCard({
                    item: item,
                    leitura: reading,
                    significado: 'Analisando seleção...',
                    tipo: 'SelecaoLivre',
                    fraseOriginal: fraseOriginal || '',
                    valido: undefined
                });

                const userKey = localStorage.getItem('gemini_api_key') || '';
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (userKey) {
                    headers['X-Gemini-Key'] = userKey;
                }

                fetch('/api/dialogo', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        acao: 'analisar_selecao_livre',
                        texto_selecionado: item,
                        frase_contexto: fraseOriginal || '',
                        provider: provider
                    })
                })
                .then(res => res.json())
                .then(data => {
                    setActiveCards(prev => prev.map(c => 
                        c.item === tempCardId 
                            ? { 
                                ...c, 
                                valido: data.valido, 
                                erro: data.erro, 
                                traducao: data.traducao, 
                                explicacao: data.explicacao, 
                                leitura: data.leitura || c.leitura,
                                significado: data.valido ? data.traducao : (data.erro || 'Seleção inválida') 
                              } 
                            : c
                    ));
                })
                .catch(err => {
                    console.error(err);
                    setActiveCards(prev => prev.map(c => 
                        c.item === tempCardId 
                            ? { ...c, significado: 'Erro ao analisar seleção.' } 
                            : c
                    ));
                });
                return;
            }

            addCard({
                item: item,
                leitura: reading,
                significado: 'Buscando significado...',
                tipo: 'Dicionário',
                fraseOriginal: fraseOriginal || ''
            });
            
            fetch(`/api/jisho?termo=${encodeURIComponent(item)}`)
                .then(res => res.json())
                .then(apiData => {
                    const def = apiData?.data?.[0]?.senses?.[0]?.english_definitions;
                    const meaning = def ? def.join(', ') : 'Significado não encontrado';
                    
                    setActiveCards(prev => prev.map(c => 
                        c.item === tempCardId 
                            ? { ...c, significado: meaning } 
                            : c
                    ));
                })
                .catch(err => {
                    console.error(err);
                    setActiveCards(prev => prev.map(c => 
                        c.item === tempCardId 
                            ? { ...c, significado: 'Erro ao buscar significado.' } 
                            : c
                    ));
                });
        }
    };

    const handleTermClick = (e: React.MouseEvent, fallbackCard: any, fraseOriginal?: string) => {
        const rubyElement = (e.target as HTMLElement).closest('ruby');
        if (rubyElement) {
            e.stopPropagation();
            
            let item = '';
            let leitura = '';
            
            rubyElement.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    item += node.textContent || '';
                } else if (node.nodeName.toLowerCase() === 'rt') {
                    leitura += node.textContent || '';
                } else {
                    item += node.textContent || '';
                }
            });
            
            handleWordClick(item, leitura, fraseOriginal);
        } else {
            addCard({ ...fallbackCard, fraseOriginal });
        }
    };

    useEffect(() => {
        carregarGuia(context.provider);
    }, []);

    const carregarGuia = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = context.provider || 'groq') => {
        setLoading(true);
        setProvider(targetProvider);
        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) {
                headers['X-Gemini-Key'] = userKey;
            }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    provider: targetProvider,
                    acao: 'gerar_guia',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    vocabulario: context.vocabularioBanco || [],
                    sessionId: context.sessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }

            const data = await res.json();
            setDados(data);
        } catch (e: any) {
            console.error("Erro ao gerar guia", e);
            if (targetProvider === 'gemini') {
                setFallbackError(e.message || String(e));
                setFallbackOpen(true);
            } else {
                alert(`Erro ao gerar o guia com ${targetProvider}: ${e.message || e}`);
            }
        }
        setLoading(false);
    };

    const adicionarAoBanco = async (item: any) => {
        try {
            await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        role: 'user', 
                        content: `Adicione a palavra ${item.item} (${item.leitura}) que significa "${item.significado}" da categoria Vocabulário para o conjunto Geral no JLPT ${item.jlpt || 'N5'}`
                    }]
                })
            });
        } catch (e) {
            console.error(e);
        }
    };

    const atualizarEstadoVocabulario = (novosTermos: any[]) => {
        setDados((prev: any) => {
            if (!prev) return prev;
            const newDados = { ...prev };
            
            let vocabArray = newDados.vocabulario_chave;
            let isLegacy = false;
            
            if (!vocabArray && newDados.vocabulario) {
                if (Array.isArray(newDados.vocabulario) && newDados.vocabulario.length > 0 && newDados.vocabulario[0].categoria) {
                    vocabArray = newDados.vocabulario;
                } else {
                    isLegacy = true;
                }
            }
            
            if (!vocabArray && !isLegacy) {
                vocabArray = [];
                newDados.vocabulario_chave = vocabArray;
            }
            
            [...novosTermos].reverse().forEach((nt: any) => {
                const itemJp = nt.termo || nt.item || '';
                const leitura = nt.leitura || '';
                const romaji = nt.romaji || '';
                const traducao = nt.traducao || nt.significado || '';
                const catSugerida = nt.categoria_sugerida || 'Geral';
                
                if (isLegacy) {
                    if (!Array.isArray(newDados.vocabulario)) {
                        newDados.vocabulario = [];
                    }
                    if (!newDados.vocabulario.some((x: any) => (x.item || x.termo) === itemJp)) {
                        newDados.vocabulario.unshift({
                            item: itemJp,
                            termo: itemJp,
                            leitura,
                            romaji,
                            significado: traducao,
                            traducao,
                            jlpt: context.jlpt || 'N5'
                        });
                    }
                } else {
                    let catObj = vocabArray.find((c: any) => c.categoria === catSugerida);
                    if (!catObj) {
                        catObj = { categoria: catSugerida, termos: [] };
                        vocabArray.unshift(catObj);
                    } else {
                        const idx = vocabArray.indexOf(catObj);
                        if (idx > 0) {
                            vocabArray.splice(idx, 1);
                            vocabArray.unshift(catObj);
                        }
                    }
                    if (!catObj.termos) {
                        catObj.termos = [];
                    }
                    if (!catObj.termos.some((t: any) => (t.termo || t.item) === itemJp)) {
                        catObj.termos.unshift({
                            termo: itemJp,
                            item: itemJp,
                            leitura,
                            romaji,
                            traducao,
                            significado: traducao,
                            jlpt: context.jlpt || 'N5'
                        });
                    }
                }
            });
            
            if (!isLegacy) {
                newDados.vocabulario_chave = vocabArray;
            }
            
            return newDados;
        });

        setCurrentPage(1);

        const normalizedNewTerms = novosTermos.map(nt => ({
            item: nt.termo || nt.item || '',
            leitura: nt.leitura || '',
            significado: nt.traducao || nt.significado || '',
            jlpt: context.jlpt || 'N5',
            conjuntos: ['Geral'],
            baralhos: ['Geral'],
            campos_anki: {},
            notas: ''
        }));
        
        if (onUpdateContext) {
            onUpdateContext({
                vocabularioBanco: [...(context.vocabularioBanco || []), ...normalizedNewTerms]
            });
        }
    };

    const handleGerarLote = async () => {
        if (isGeneratingLote) return;
        setIsGeneratingLote(true);
        try {
            const blacklist = allTerms.map((t: any) => t.termo || t.item).filter(Boolean);
            
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    acao: 'gerar_vocabulario_lote',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    blacklist,
                    sessionId: context.sessionId,
                    categoriaAlvo: activeCategory === 'Todos' ? 'Geral' : activeCategory,
                    provider: context.provider || 'gemini'
                })
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }
            
            const data = await res.json();
            if (data.novos_termos && Array.isArray(data.novos_termos)) {
                atualizarEstadoVocabulario(data.novos_termos);
            } else {
                throw new Error("Resposta inválida da IA.");
            }
        } catch (e: any) {
            console.error("Erro ao gerar vocabulário em lote", e);
            alert(`Erro ao gerar palavras: ${e.message || e}`);
        } finally {
            setIsGeneratingLote(false);
        }
    };

    const handleAdvancedGenerate = async (textoPalavras: string, quantidade: number) => {
        setIsAdvancedModalOpen(false);
        setIsGeneratingLote(true);
        try {
            const categoriasExistentes = uniqueCategories.filter(c => c !== 'Todos');
            
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    acao: 'processar_personalizadas',
                    tema: context.tema,
                    jlpt: context.jlpt,
                    texto: textoPalavras,
                    categoriasExistentes,
                    sessionId: context.sessionId,
                    quantidade,
                    provider: context.provider || 'gemini'
                })
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP error ${res.status}`);
            }
            
            const data = await res.json();
            if (data.novos_termos && Array.isArray(data.novos_termos)) {
                atualizarEstadoVocabulario(data.novos_termos);
            } else {
                throw new Error("Resposta inválida da IA.");
            }
        } catch (e: any) {
            console.error("Erro ao processar palavras personalizadas", e);
            alert(`Erro ao adicionar palavras: ${e.message || e}`);
        } finally {
            setIsGeneratingLote(false);
        }
    };

    if (loading) {
        return (
            <div className="p-5">
                <AiLoader 
                    provider={provider} 
                    message={`${provider.charAt(0).toUpperCase() + provider.slice(1)} está gerando seu Guia de Estudos`} 
                />
            </div>
        );
    }

    if (!dados) {
        return (
            <div className="max-w-[800px] mx-auto p-5 text-center">
                {fallbackOpen ? (
                    <AiFallbackPopup 
                        isOpen={fallbackOpen} 
                        errorMessage={fallbackError}
                        onRetryGemini={() => {
                            setFallbackOpen(false);
                            carregarGuia(provider || context.provider || 'groq');
                        }}
                        onFallbackPollinations={() => {
                            setFallbackOpen(false);
                            carregarGuia('pollinations');
                        }}
                        onCancel={() => setFallbackOpen(false)}
                    />
                ) : (
                    <div>
                        <h2 className="text-foreground">Ocorreu um erro ao carregar o Guia</h2>
                        <Button 
                            onClick={() => carregarGuia(provider || context.provider || 'groq')}
                            className="mt-4"
                        >
                            Tentar Novamente
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // 1. Normalização do vocabulário
    const vocabCategorias = normalizarVocabulario(dados?.vocabulario_chave || dados?.vocabulario || []);

    // 2. Extração de todas as categorias únicas para o Tab Bar
    const uniqueCategories = ['Todos', ...Array.from(new Set(vocabCategorias.map((c: any) => c.categoria).filter(Boolean)))];

    // 3. Pipeline de filtragem
    // a. Agrupa e filtra por categoria ativa
    const allTerms = vocabCategorias.flatMap((cat: any) => 
        (cat.termos || []).map((t: any) => ({
            ...t,
            categoria: cat.categoria
        }))
    );

    let filteredVocab = activeCategory === 'Todos'
        ? allTerms
        : allTerms.filter((t: any) => t.categoria === activeCategory);

    // b. Filtro de busca (searchQuery) resiliente
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredVocab = filteredVocab.filter((t: any) => {
            const term = (t.termo || t.item || '').toLowerCase();
            const leitura = (t.leitura || '').toLowerCase();
            const romaji = (t.romaji || '').toLowerCase();
            const translation = (t.traducao || t.significado || '').toLowerCase();
            return term.includes(query) || leitura.includes(query) || romaji.includes(query) || translation.includes(query);
        });
    }

    // c. Filtro de status (filterStatus) contra context.vocabularioBanco
    if (filterStatus !== 'Todos') {
        filteredVocab = filteredVocab.filter((t: any) => {
            const itemJp = t.termo || t.item || '';
            const jaPossui = context.vocabularioBanco.some((b: any) => b.item === itemJp);
            if (filterStatus === 'Aprendidos') {
                return jaPossui;
            } else if (filterStatus === 'Novos') {
                return !jaPossui;
            }
            return true;
        });
    }

    const itemsPerPageFirstPage = 5;
    const itemsPerPageSubsequent = 6;
    
    const totalPages = filteredVocab.length <= itemsPerPageFirstPage 
      ? 1 
      : 1 + Math.ceil((filteredVocab.length - itemsPerPageFirstPage) / itemsPerPageSubsequent);

    const getPaginatedItems = () => {
      if (currentPage === 1) {
        return filteredVocab.slice(0, itemsPerPageFirstPage);
      }
      const offset = itemsPerPageFirstPage + (currentPage - 2) * itemsPerPageSubsequent;
      return filteredVocab.slice(offset, offset + itemsPerPageSubsequent);
    };
    
    const paginatedVocab = getPaginatedItems();

    return (
        <div className="max-w-[800px] mx-auto">
            {/* Top navigation */}
            <div className="flex justify-between items-center mb-5">
                <Button variant="outline" onClick={onBack}>← Voltar</Button>
                <h2 className="text-foreground font-bold m-0">Guia: {context.tema}</h2>
                <Button onClick={onNext} className="font-bold">Praticar Tradução →</Button>
            </div>

            {/* Vocabulário chave */}
            <Card className="mb-5">
                <CardContent className="p-5">
                    {/* Header colapsível */}
                    <div
                        onClick={() => setIsVocabOpen(!isVocabOpen)}
                        className="flex justify-between items-center cursor-pointer select-none p-1 rounded-lg -mx-1 transition-colors hover:bg-black/[0.04]"
                    >
                        <h3 className="m-0 text-primary flex items-center gap-2 font-bold">
                            📚 Vocabulário Chave
                        </h3>
                        <div
                            className="flex items-center justify-center w-7 h-7 rounded-full bg-black/[0.03] text-primary font-bold transition-transform duration-300"
                            style={{ transform: isVocabOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                            ▼
                        </div>
                    </div>

                    {/* Conteúdo colapsível via grid-rows */}
                    <div
                        className="grid overflow-hidden transition-all duration-300"
                        style={{
                            gridTemplateRows: isVocabOpen ? '1fr' : '0fr',
                            opacity: isVocabOpen ? 1 : 0,
                        }}
                    >
                        <div className="min-h-0 pt-4">
                            {/* Tab Bar de categorias */}
                            <div className="flex gap-2 pb-3 mb-4 border-b border-border overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
                                {uniqueCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={[
                                            'shrink-0 rounded-full px-4 py-2 text-[0.88em] font-semibold whitespace-nowrap outline-none transition-all duration-200',
                                            activeCategory === cat
                                                ? 'bg-primary text-primary-foreground shadow-md border-none'
                                                : 'bg-black/[0.02] text-foreground border border-border opacity-75 hover:bg-black/[0.05] hover:opacity-100'
                                        ].join(' ')}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                <button
                                    onClick={() => alert("Função para criar novo tópico personalizado estará disponível em breve!")}
                                    className="shrink-0 rounded-full px-4 py-2 text-[0.88em] text-primary border border-dashed border-primary bg-transparent whitespace-nowrap outline-none transition-all hover:bg-primary/[0.08] cursor-pointer"
                                >
                                    + Tópico
                                </button>
                            </div>

                            {/* Toolbar de busca e filtro */}
                            <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
                                <Input
                                    type="text"
                                    placeholder="Buscar termo, leitura ou tradução..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="flex-[1_1_200px] max-w-[300px] text-[0.9em]"
                                />
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-[0.9em] outline-none cursor-pointer transition-all"
                                >
                                    <option value="Todos">👁️ Mostrar Todos</option>
                                    <option value="Aprendidos">🟢 Já Aprendidos</option>
                                    <option value="Novos">🟡 Palavras Novas</option>
                                </select>
                            </div>

                            {/* Grid de chips */}
                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))' }}>
                                {/* Card de Adição */}
                                {currentPage === 1 && (
                                    <div className="flex items-stretch bg-transparent rounded-xl border border-dashed border-primary min-h-[62px] overflow-hidden transition-all">
                                        <button
                                            type="button"
                                            onClick={handleGerarLote}
                                            disabled={isGeneratingLote}
                                            className="flex-1 bg-transparent border-none text-primary font-bold text-[0.95em] cursor-pointer disabled:cursor-not-allowed p-3 flex items-center justify-center gap-2 transition-colors hover:bg-primary/[0.05]"
                                        >
                                            {isGeneratingLote ? <>⏳ Gerando...</> : <>✨ Gerar Palavras Aqui</>}
                                        </button>
                                        <div className="w-px bg-border" />
                                        <button
                                            type="button"
                                            onClick={() => setIsAdvancedModalOpen(true)}
                                            disabled={isGeneratingLote}
                                            className="bg-transparent border-none text-foreground opacity-70 cursor-pointer disabled:cursor-not-allowed px-4 text-[1.1em] flex items-center justify-center transition-all hover:bg-black/[0.03] hover:opacity-100"
                                            title="Adição Avançada"
                                        >
                                            ⚙️
                                        </button>
                                    </div>
                                )}

                                {/* Dynamic Chips rendering */}
                                {paginatedVocab.map((t: any, i: number) => {
                                    const normalizedTerm = {
                                        item: t.termo || t.item || '',
                                        leitura: t.leitura || '',
                                        significado: t.traducao || t.significado || '',
                                        jlpt: t.jlpt
                                    };
                                    const jaPossui = context.vocabularioBanco.some((b: any) => b.item === normalizedTerm.item);
                                    return (
                                        <VocabularioChip 
                                            key={i}
                                            item={normalizedTerm.item}
                                            leitura={normalizedTerm.leitura}
                                            significado={normalizedTerm.significado}
                                            jlpt={normalizedTerm.jlpt}
                                            jaPossui={jaPossui}
                                            onAdd={() => adicionarAoBanco(normalizedTerm)}
                                            onClickCard={() => addCard({ ...normalizedTerm, tipo: 'Vocabulário' })}
                                        />
                                    );
                                })}
                            </div>

                            {/* Paginação */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-border">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="text-[0.85em] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-[0.9em] text-muted-foreground font-medium">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="text-[0.85em] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Próximo
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Regras Gramaticais */}
            <Card className="mb-5">
                <CardContent className="p-5">
                    <h3 className="mt-0 mb-4 text-primary font-bold">🧠 Regras Gramaticais Úteis</h3>
                    {dados.regras?.map((r: any, i: number) => (
                        <div
                            key={i}
                            className={[
                                'p-2.5 rounded-lg',
                                i < dados.regras.length - 1 ? 'mb-4 pb-4 border-b border-border' : ''
                            ].join(' ')}
                        >
                            <strong className="text-[1.1em]"><InteractiveText text={r.titulo} /></strong>
                            <div className="my-2 leading-relaxed"><InteractiveText text={r.explicacao} /></div>
                            <div className="bg-black/[0.03] p-2.5 rounded-lg">
                                <div className="text-[1.2em]"><InteractiveText text={r.exemplo_jp} /></div>
                                <div className="text-muted-foreground text-[0.9em]"><InteractiveText text={r.exemplo_pt} /></div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Frases Prontas */}
            <Card className="mb-5">
                <CardContent className="p-5">
                    <h3 className="mt-0 mb-5 text-primary font-bold">💬 Frases Prontas</h3>
                    {dados.frases_uteis?.map((f: any, i: number) => (
                        <PhraseCard 
                            key={i}
                            jp={f.jp}
                            pt={f.pt}
                            breakdown={f.breakdown}
                            session={session}
                        />
                    ))}
                </CardContent>
            </Card>

            {activeCards.map((card, index) => (
                <DraggableCard 
                    key={card.item}
                    card={card}
                    initialIndex={index}
                    onClose={() => removeCard(card.item)}
                    tema={context.tema}
                    provider={provider}
                    onUpdateSignificado={(item, novoSignificado) => {
                        setActiveCards(prev => prev.map(c => 
                            c.item === item ? { ...c, significado: novoSignificado } : c
                        ));
                    }}
                />
            ))}

            <AiFallbackPopup 
                isOpen={fallbackOpen} 
                errorMessage={fallbackError}
                onRetryGemini={() => {
                    setFallbackOpen(false);
                    carregarGuia(provider || context.provider || 'groq');
                }}
                onFallbackPollinations={() => {
                    setFallbackOpen(false);
                    carregarGuia('pollinations');
                }}
                onCancel={() => setFallbackOpen(false)}
            />

            {isAdvancedModalOpen && (
                <AdvancedAddModal
                    isOpen={isAdvancedModalOpen}
                    onClose={() => setIsAdvancedModalOpen(false)}
                    onGenerate={handleAdvancedGenerate}
                />
            )}
        </div>
    );
}
