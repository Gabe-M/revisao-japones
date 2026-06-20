import React, { useState, useEffect } from 'react';
import InteractiveText from '../components/InteractiveText';
import VocabularioChip from './components/VocabularioChip';
import DraggableCard from './components/DraggableCard';
import AiLoader from './components/AiLoader';
import AiFallbackPopup from './components/AiFallbackPopup';
import PhraseCard from './components/PhraseCard';
import AdvancedAddModal from './components/AdvancedAddModal';

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
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(context.provider || 'gemini');
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

    const handleWordClick = (word: string, leitura: string, fraseOriginal?: string) => {
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
        
        if (foundVocab) {
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

    const carregarGuia = async (targetProvider: 'gemini' | 'openai' | 'groq' | 'pollinations' = 'gemini') => {
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
            
            novosTermos.forEach((nt: any) => {
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
                        newDados.vocabulario.push({
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
                        vocabArray.push(catObj);
                    }
                    if (!catObj.termos) {
                        catObj.termos = [];
                    }
                    if (!catObj.termos.some((t: any) => (t.termo || t.item) === itemJp)) {
                        catObj.termos.push({
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
            <div style={{ padding: '20px' }}>
                <AiLoader 
                    provider={provider} 
                    message={provider === 'gemini' ? "O Gemini está gerando seu Guia de Estudos" : "A OpenAI está gerando seu Guia de Estudos"} 
                />
            </div>
        );
    }

    if (!dados) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
                {fallbackOpen ? (
                    <AiFallbackPopup 
                        isOpen={fallbackOpen} 
                        errorMessage={fallbackError}
                        onRetryGemini={() => {
                            setFallbackOpen(false);
                            carregarGuia('gemini');
                        }}
                        onFallbackPollinations={() => {
                            setFallbackOpen(false);
                            carregarGuia('pollinations');
                        }}
                        onCancel={() => setFallbackOpen(false)}
                    />
                ) : (
                    <div>
                        <h2 style={{ color: 'var(--text-color)' }}>Ocorreu um erro ao gerar o Guia</h2>
                        <button 
                            onClick={() => carregarGuia('gemini')} 
                            style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--highlight-color)', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                            Tentar Novamente
                        </button>
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>← Voltar</button>
                <h2 style={{ margin: 0 }}>Guia: {context.tema}</h2>
                <button onClick={onNext} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--highlight-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Praticar Tradução →</button>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <div 
                    onClick={() => setIsVocabOpen(!isVocabOpen)}
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        userSelect: 'none',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        margin: '-4px -8px',
                        transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <h3 style={{ margin: 0, color: 'var(--highlight-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📚 Vocabulário Chave
                    </h3>
                    <div style={{ 
                        transform: isVocabOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.03)',
                        color: 'var(--highlight-color)',
                        fontWeight: 'bold'
                    }}>
                        ▼
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateRows: isVocabOpen ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: isVocabOpen ? 1 : 0,
                    overflow: 'hidden'
                }}>
                    <div style={{ minHeight: 0, paddingTop: '15px' }}>
                        {/* Tab Bar */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            paddingBottom: '12px',
                            marginBottom: '15px',
                            borderBottom: '1px solid var(--border-color)',
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}>
                            {uniqueCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    style={activeCategory === cat 
                                        ? {
                                            background: 'var(--highlight-color)',
                                            color: 'white',
                                            borderRadius: '20px',
                                            padding: '8px 16px',
                                            fontSize: '0.88em',
                                            fontWeight: '600',
                                            border: 'none',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            boxShadow: '0 4px 10px rgba(230, 126, 34, 0.3)',
                                            transition: 'all 0.2s ease',
                                            outline: 'none'
                                        } 
                                        : {
                                            background: 'rgba(0, 0, 0, 0.02)',
                                            color: 'var(--text-color)',
                                            borderRadius: '20px',
                                            padding: '8px 16px',
                                            fontSize: '0.88em',
                                            border: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            opacity: 0.75,
                                            transition: 'all 0.2s ease',
                                            outline: 'none'
                                        }
                                    }
                                    onMouseOver={(e) => {
                                        if (activeCategory !== cat) {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                                            e.currentTarget.style.opacity = '1';
                                        }
                                    }}
                                    onMouseOut={(e) => {
                                        if (activeCategory !== cat) {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                                            e.currentTarget.style.opacity = '0.75';
                                        }
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                            <button
                                onClick={() => alert("Função para criar novo tópico personalizado estará disponível em breve!")}
                                style={{
                                    background: 'transparent',
                                    color: 'var(--highlight-color)',
                                    borderRadius: '20px',
                                    padding: '8px 16px',
                                    fontSize: '0.88em',
                                    border: '1px dashed var(--highlight-color)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    transition: 'all 0.2s ease',
                                    outline: 'none'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(230, 126, 34, 0.08)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                + Tópico
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                            marginBottom: '20px'
                        }}>
                            <input 
                                type="text"
                                placeholder="Buscar termo, leitura ou tradução..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    flex: '1 1 200px',
                                    maxWidth: '300px',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-color)',
                                    color: 'var(--text-color)',
                                    fontSize: '0.9em',
                                    outline: 'none',
                                    transition: 'all 0.2s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--highlight-color)';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(230, 126, 34, 0.15)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-color)';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />

                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-color)',
                                    color: 'var(--text-color)',
                                    fontSize: '0.9em',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--highlight-color)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-color)';
                                }}
                            >
                                <option value="Todos">👁️ Mostrar Todos</option>
                                <option value="Aprendidos">🟢 Já Aprendidos</option>
                                <option value="Novos">🟡 Palavras Novas</option>
                            </select>
                        </div>

                        {/* Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))',
                            gap: '12px'
                        }}>
                            {/* Card de Adição */}
                            {currentPage === 1 && (
                                <div 
                                    style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        background: 'transparent',
                                        borderRadius: '12px',
                                        border: '1px dashed var(--highlight-color)',
                                        minHeight: '62px',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s ease',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <button 
                                        type="button"
                                        onClick={handleGerarLote}
                                        disabled={isGeneratingLote}
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--highlight-color)',
                                            fontWeight: 'bold',
                                            fontSize: '0.95em',
                                            cursor: isGeneratingLote ? 'not-allowed' : 'pointer',
                                            padding: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseOver={(e) => {
                                            if (!isGeneratingLote) e.currentTarget.style.background = 'rgba(230, 126, 34, 0.05)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        {isGeneratingLote ? (
                                            <>⏳ Gerando...</>
                                        ) : (
                                            <>✨ Gerar Palavras Aqui</>
                                        )}
                                    </button>
                                    <div style={{ width: '1px', background: 'var(--border-color)' }} />
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvancedModalOpen(true)}
                                        disabled={isGeneratingLote}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-color)',
                                            opacity: 0.7,
                                            cursor: isGeneratingLote ? 'not-allowed' : 'pointer',
                                            padding: '0 16px',
                                            fontSize: '1.1em',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => {
                                            if (!isGeneratingLote) {
                                                e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
                                                e.currentTarget.style.opacity = '1';
                                            }
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.opacity = '0.7';
                                        }}
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

                        {/* Pagination Navigation Controls */}
                        {totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '16px',
                                marginTop: '24px',
                                paddingTop: '16px',
                                borderTop: '1px solid var(--border-color)'
                            }}>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    style={{
                                        background: currentPage === 1 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                        color: currentPage === 1 ? 'gray' : 'var(--text-color)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '8px 16px',
                                        fontSize: '0.85em',
                                        fontWeight: '600',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === 1 ? 0.4 : 1,
                                        transition: 'all 0.2s ease',
                                        outline: 'none'
                                    }}
                                    onMouseOver={(e) => {
                                        if (currentPage !== 1) {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                                        }
                                    }}
                                    onMouseOut={(e) => {
                                        if (currentPage !== 1) {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                                        }
                                    }}
                                >
                                    Anterior
                                </button>
                                <span style={{
                                    fontSize: '0.9em',
                                    color: 'var(--text-color)',
                                    opacity: 0.8,
                                    fontWeight: '500'
                                }}>
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        background: currentPage === totalPages ? 'transparent' : 'rgba(0,0,0,0.02)',
                                        color: currentPage === totalPages ? 'gray' : 'var(--text-color)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '8px 16px',
                                        fontSize: '0.85em',
                                        fontWeight: '600',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === totalPages ? 0.4 : 1,
                                        transition: 'all 0.2s ease',
                                        outline: 'none'
                                    }}
                                    onMouseOver={(e) => {
                                        if (currentPage !== totalPages) {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                                        }
                                    }}
                                    onMouseOut={(e) => {
                                        if (currentPage !== totalPages) {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                                        }
                                    }}
                                >
                                    Próximo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)' }}>🧠 Regras Gramaticais Úteis</h3>
                {dados.regras?.map((r: any, i: number) => (
                    <div 
                        key={i} 
                        style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: i < dados.regras.length - 1 ? '1px solid var(--border-color)' : 'none', borderRadius: '8px', padding: '10px' }}
                    >
                        <strong style={{ fontSize: '1.1em' }}><InteractiveText text={r.titulo} /></strong>
                        <p style={{ margin: '8px 0' }}><InteractiveText text={r.explicacao} /></p>
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2em' }}><InteractiveText text={r.exemplo_jp} /></div>
                            <div style={{ color: 'gray', fontSize: '0.9em' }}><InteractiveText text={r.exemplo_pt} /></div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-subtle)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--highlight-color)', marginBottom: '20px' }}>💬 Frases Prontas</h3>
                {dados.frases_uteis?.map((f: any, i: number) => (
                    <PhraseCard 
                        key={i}
                        jp={f.jp}
                        pt={f.pt}
                        breakdown={f.breakdown}
                        session={session}
                    />
                ))}
            </div>

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
                    carregarGuia('gemini');
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
