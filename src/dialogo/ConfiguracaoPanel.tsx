import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AvatarIcon from './components/AvatarIcon';

interface ConfiguracaoPanelProps {
    onStart: (config: any) => void;
    session: any;
}

export interface PersonagemItem {
    id?: string;
    nome: string;
    obra?: string;
    avatar: string;
    personalidade: string;
    historia: string;
    relacao: string;
    tomVoz: string;
}

const PRESET_PERSONAGENS: PersonagemItem[] = [
    {
        id: 'kenji',
        nome: 'Kenji Takahashi',
        obra: 'Original DialoGo',
        avatar: '☕',
        personalidade: 'Animado, casual, jovem e descontraído.',
        historia: 'Barista em um café moderno em Shibuya, adora música indie e conversar sobre o cotidiano.',
        relacao: 'Amigo casual de conversa',
        tomVoz: 'Informal (Tameguchi com gírias jovens, usa ore/boku)'
    },
    {
        id: 'sakura',
        nome: 'Sakura Sensei',
        obra: 'Original DialoGo',
        avatar: '🌸',
        personalidade: 'Gentil, paciente, altamente encorajadora e estruturada.',
        historia: 'Professora nativa de japonês em Tóquio especializada em alunos iniciantes e intermediários.',
        relacao: 'Professora e tutora de japonês',
        tomVoz: 'Formal polido (Keigo clássico / Desu-Masu, fala clara, usa watashi)'
    },
    {
        id: 'yuki',
        nome: 'Yuki',
        obra: 'Original DialoGo',
        avatar: '🍣',
        personalidade: 'Extrovertida, amante da culinária tradicional, alegre e muito curiosa.',
        historia: 'Estudante de história e literatura da Universidade de Kyoto, adora indicar restaurantes e passeios.',
        relacao: 'Colega de universidade',
        tomVoz: 'Amigável e levemente polido (Dialeto sutil de Kansai, tom caloroso)'
    },
    {
        id: 'ryota',
        nome: 'Ryota',
        obra: 'Original DialoGo',
        avatar: '🎮',
        personalidade: 'Entusiasta de games, animes e robótica, muito empolgado.',
        historia: 'Atendente de loja de eletrônicos em Akihabara e gamer ávido no tempo livre.',
        relacao: 'Parceiro de jogos',
        tomVoz: 'Casual rápido e animado (Bordões casuais de otaku/gaming, usa ore)'
    }
];

const PRESET_AVATARES = ['☕', '🌸', '🍣', '🎮', '🦊', '⚔️', '🧙‍♀️', '🐱', '🍙', '🌟', '🎋', '⛩️'];

export default function ConfiguracaoPanel({ onStart, session }: ConfiguracaoPanelProps) {
    // Aba principal de configuração (Estudo vs Personagem)
    const [configTab, setConfigTab] = useState<'estudo' | 'personagem'>('estudo');

    // Estados de estudo/sessão
    const [tema, setTema] = useState('');
    const [jlpt, setJlpt] = useState('N5');
    const [conjuntosDisp, setConjuntosDisp] = useState<string[]>([]);
    const [conjuntoSelecionado, setConjuntoSelecionado] = useState('');
    const [useConjuntos, setUseConjuntos] = useState(false);

    // Filtros de banco / SRS
    const [bancoTipo, setBancoTipo] = useState<'conjuntos' | 'baralhos' | 'ambos'>('conjuntos');
    const [baralhosDisp, setBaralhosDisp] = useState<string[]>([]);
    const [baralhoSelecionado, setBaralhoSelecionado] = useState('');
    const [srsFiltro, setSrsFiltro] = useState<'Todos' | 'Aprendidos' | 'Novos'>('Todos');
    const [baralhoDestino, setBaralhoDestino] = useState('');
    const [conjuntoDestino, setConjuntoDestino] = useState('Geral');
    const [novoConjuntoNome, setNovoConjuntoNome] = useState('');
    const [novoBaralhoNome, setNovoBaralhoNome] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(
        () => (localStorage.getItem('selected_provider') as any) || 'groq'
    );

    useEffect(() => {
        localStorage.setItem('selected_provider', selectedProvider);
    }, [selectedProvider]);

    // Sessões
    const [tipoExibicaoSessao, setTipoExibicaoSessao] = useState<'nova' | 'existente'>('nova');
    const [nomeSessao, setNomeSessao] = useState('');
    const [sessoesExistentes, setSessoesExistentes] = useState<any[]>([]);
    const [sessaoSelecionadaId, setSessaoSelecionadaId] = useState('');
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);

    // Estados do Personagem
    const [selectedPresetId, setSelectedPresetId] = useState<string>('kenji');
    const [charNome, setCharNome] = useState(PRESET_PERSONAGENS[0].nome);
    const [charObra, setCharObra] = useState(PRESET_PERSONAGENS[0].obra || '');
    const [charAvatar, setCharAvatar] = useState(PRESET_PERSONAGENS[0].avatar);
    const [charPersonalidade, setCharPersonalidade] = useState(PRESET_PERSONAGENS[0].personalidade);
    const [charHistoria, setCharHistoria] = useState(PRESET_PERSONAGENS[0].historia);
    const [charRelacao, setCharRelacao] = useState(PRESET_PERSONAGENS[0].relacao);
    const [charTomVoz, setCharTomVoz] = useState(PRESET_PERSONAGENS[0].tomVoz);

    // Busca de Personagens por IA
    const [searchCharQuery, setSearchCharQuery] = useState('');
    const [isSearchingChar, setIsSearchingChar] = useState(false);
    const [searchCharError, setSearchCharError] = useState<string | null>(null);
    const [searchResultsChar, setSearchResultsChar] = useState<Array<{ nome: string; obra: string; descricao_curta: string }>>([]);
    const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
    const [generatingCharName, setGeneratingCharName] = useState('');

    // Personagens salvos no LocalStorage
    const [savedCustomChars, setSavedCustomChars] = useState<PersonagemItem[]>(() => {
        try {
            const raw = localStorage.getItem('saved_personagens');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    });

    // Modal Config
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        tipo: 'confirm' | 'alert';
        mensagem: string;
        onConfirm?: () => void;
    }>({
        isOpen: false,
        tipo: 'alert',
        mensagem: ''
    });

    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const modalStart = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('select')) return;

        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        modalStart.current = { x: modalPosition.x, y: modalPosition.y };
        e.preventDefault();
    };

    useEffect(() => {
        if (modalConfig.isOpen) {
            setModalPosition({ x: 0, y: 0 });
        }
    }, [modalConfig.isOpen]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setModalPosition({
                x: modalStart.current.x + dx,
                y: modalStart.current.y + dy
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const temasRapidos = ['Me apresentar', 'Fazer compras', 'Pedir direções', 'No restaurante', 'Em uma entrevista'];

    useEffect(() => {
        if (session) {
            carregarDadosBanco();
            carregarSessoes();
        } else {
            setIsLoadingSessions(false);
        }
    }, [session]);

    const carregarSessoes = async () => {
        if (!session) {
            setIsLoadingSessions(false);
            return;
        }
        setIsLoadingSessions(true);
        try {
            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ acao: 'listar_sessoes' })
            });
            if (res.ok) {
                const data = await res.json();
                setSessoesExistentes(data || []);
                if (data && data.length > 0) {
                    setSessaoSelecionadaId(data[0].id);
                }
            }
        } catch (e) {
            console.error("Erro ao carregar sessões:", e);
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const handleDeletarSessao = async () => {
        if (!sessaoSelecionadaId || !session) return;
        
        setModalConfig({
            isOpen: true,
            tipo: 'confirm',
            mensagem: 'Tem certeza que deseja apagar esta sessão permanentemente?',
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch('/api/dialogo', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            acao: 'apagar_sessao',
                            idParaApagar: sessaoSelecionadaId
                        })
                    });

                    if (res.ok) {
                        const novasSessoes = sessoesExistentes.filter(s => s.id !== sessaoSelecionadaId);
                        setSessoesExistentes(novasSessoes);
                        if (novasSessoes.length > 0) {
                            setSessaoSelecionadaId(novasSessoes[0].id);
                        } else {
                            setSessaoSelecionadaId('');
                            setTema('');
                            setJlpt('N5');
                            setUseConjuntos(false);
                        }
                        setModalConfig({
                            isOpen: true,
                            tipo: 'alert',
                            mensagem: 'Sessão apagada com sucesso!'
                        });
                    } else {
                        const errData = await res.json();
                        setModalConfig({
                            isOpen: true,
                            tipo: 'alert',
                            mensagem: `Erro ao apagar sessão: ${errData.error || 'Erro desconhecido'}`
                        });
                    }
                } catch (e: any) {
                    console.error("Erro ao apagar sessão:", e);
                    setModalConfig({
                        isOpen: true,
                        tipo: 'alert',
                        mensagem: `Erro ao apagar sessão: ${e.message}`
                    });
                }
            }
        });
    };

    useEffect(() => {
        if (sessaoSelecionadaId) {
            const selected = sessoesExistentes.find(s => s.id === sessaoSelecionadaId);
            if (selected && selected.config) {
                const conf = selected.config;
                if (conf.tema) setTema(conf.tema);
                if (conf.jlpt) setJlpt(conf.jlpt || 'N5');
                if (conf.provider) setSelectedProvider(conf.provider || 'gemini');
                if (conf.useBanco !== undefined) setUseConjuntos(conf.useBanco);
                if (conf.bancoTipo) setBancoTipo(conf.bancoTipo);
                if (conf.conjuntoSelecionado) setConjuntoSelecionado(conf.conjuntoSelecionado);
                if (conf.baralhoSelecionado) setBaralhoSelecionado(conf.baralhoSelecionado);
                if (conf.srsFiltro) setSrsFiltro(conf.srsFiltro);
                if (conf.baralhoDestino) setBaralhoDestino(conf.baralhoDestino);
                if (conf.conjuntoDestino) setConjuntoDestino(conf.conjuntoDestino);

                if (conf.personagem) {
                    setCharNome(conf.personagem.nome || '');
                    setCharObra(conf.personagem.obra || '');
                    setCharAvatar(conf.personagem.avatar || '💬');
                    setCharPersonalidade(conf.personagem.personalidade || '');
                    setCharHistoria(conf.personagem.historia || '');
                    setCharRelacao(conf.personagem.relacao || '');
                    setCharTomVoz(conf.personagem.tomVoz || '');
                    setSelectedPresetId('custom');
                }
            }
        }
    }, [sessaoSelecionadaId, sessoesExistentes]);

    const carregarDadosBanco = async () => {
        if (!session) return;
        try {
            const resJisho = await fetch('/api/jisho?acao=listar', {
                headers: { "Authorization": `Bearer ${session.access_token}` }
            });
            if (!resJisho.ok) throw new Error(`HTTP error ${resJisho.status} loading jisho`);
            const dataJisho = await resJisho.json();

            let dataAnki = [];
            try {
                const resAnki = await fetch('/api/anki?acao=listar', {
                    headers: { "Authorization": `Bearer ${session.access_token}` }
                });
                if (resAnki.ok) dataAnki = await resAnki.json();
            } catch (ankiErr) {
                console.error("Erro ao carregar baralhos do Anki", ankiErr);
            }
            
            const todosConjuntos = new Set<string>(['Geral']);
            const todosBaralhos = new Set<string>(['Geral']);
            
            if (dataJisho && Array.isArray(dataJisho)) {
                dataJisho.forEach((item: any) => {
                    if (item.conjuntos && Array.isArray(item.conjuntos)) {
                        item.conjuntos.forEach((c: string) => todosConjuntos.add(c));
                    }
                    if (item.notas) {
                        const match = item.notas.match(/\[Conjuntos:\s*([^\]]+)\]/);
                        if (match) {
                            match[1].split(',').map((s: string) => s.trim()).filter(Boolean).forEach((c: string) => todosConjuntos.add(c));
                        }
                    }
                    if (item.baralhos && Array.isArray(item.baralhos)) {
                        item.baralhos.forEach((b: string) => todosBaralhos.add(b));
                    }
                });
            }

            if (dataAnki && Array.isArray(dataAnki)) {
                dataAnki.forEach((item: any) => {
                    if (item.deck_name) todosBaralhos.add(item.deck_name);
                });
            }
            
            const listaConjuntos = Array.from(todosConjuntos).sort();
            setConjuntosDisp(listaConjuntos);
            if (listaConjuntos.length > 0) {
                setConjuntoSelecionado(listaConjuntos[0]);
                setConjuntoDestino(prev => prev || listaConjuntos[0]);
            }
            
            const listaBaralhos = Array.from(todosBaralhos).sort();
            setBaralhosDisp(listaBaralhos);
            if (listaBaralhos.length > 0) {
                setBaralhoSelecionado(listaBaralhos[0]);
                const defaultDeck = listaBaralhos.find(b => b !== 'Geral') || listaBaralhos[0] || '';
                setBaralhoDestino(prev => prev || defaultDeck);
            }
        } catch (error) {
            console.error("Erro ao carregar dados do banco", error);
        }
    };

    // Ação: Seleção de Preset de Personagem
    const handleSelectPreset = (preset: PersonagemItem) => {
        setSelectedPresetId(preset.id || 'custom');
        setCharNome(preset.nome);
        setCharObra(preset.obra || '');
        setCharAvatar(preset.avatar);
        setCharPersonalidade(preset.personalidade);
        setCharHistoria(preset.historia);
        setCharRelacao(preset.relacao);
        setCharTomVoz(preset.tomVoz);
    };

    // Ação: Buscar personagens via IA
    const handleSearchCharacters = async () => {
        const query = searchCharQuery.trim();
        if (!query) {
            setSearchCharError("Por favor, digite o nome de um personagem para buscar.");
            return;
        }

        setIsSearchingChar(true);
        setSearchCharError(null);
        setSearchResultsChar([]);

        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) headers['X-Gemini-Key'] = userKey;
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    acao: 'buscar_personagens_conhecidos',
                    nome_query: query,
                    provider: selectedProvider
                })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || errJson.error || `Erro HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.personagens && Array.isArray(data.personagens) && data.personagens.length > 0) {
                setSearchResultsChar(data.personagens);
            } else {
                setSearchCharError(`Nenhum personagem famoso foi encontrado com o nome "${query}". Tente outro termo.`);
            }
        } catch (err: any) {
            console.error("Erro ao buscar personagens:", err);
            setSearchCharError(err.message || "Erro ao conectar com a IA para buscar personagens.");
        } finally {
            setIsSearchingChar(false);
        }
    };

    // Ação: Selecionar um resultado de busca para gerar ficha e auto-preencher
    const handleSelectSearchResult = async (item: { nome: string; obra: string }) => {
        setIsGeneratingProfile(true);
        setGeneratingCharName(item.nome);
        setSearchCharError(null);

        try {
            const userKey = localStorage.getItem('gemini_api_key') || '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (userKey) headers['X-Gemini-Key'] = userKey;
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

            const res = await fetch('/api/dialogo', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    acao: 'gerar_perfil_personagem',
                    nome: item.nome,
                    obra: item.obra,
                    provider: selectedProvider
                })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || errJson.error || `Erro HTTP ${res.status}`);
            }

            const profile = await res.json();
            
            // Preenchimento automático dos campos
            setCharNome(profile.nome || item.nome);
            setCharObra(profile.obra || item.obra || '');
            if (profile.personalidade) setCharPersonalidade(profile.personalidade);
            if (profile.historia) setCharHistoria(profile.historia);
            if (profile.tomVoz) setCharTomVoz(profile.tomVoz);
            if (!charRelacao) setCharRelacao('Conhecido em diálogo');

            if (!charAvatar || charAvatar === '💬') {
                setCharAvatar('🌟');
            }

            setSelectedPresetId('custom');
            setSearchResultsChar([]);
        } catch (err: any) {
            console.error("Erro ao gerar perfil do personagem:", err);
            setSearchCharError(`Falha ao carregar detalhes de ${item.nome}: ${err.message}`);
        } finally {
            setIsGeneratingProfile(false);
            setGeneratingCharName('');
        }
    };

    // Salvar personagem atual no localStorage
    const handleSaveCustomCharacter = () => {
        if (!charNome.trim()) {
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: 'O personagem precisa ter um nome para ser salvo.'
            });
            return;
        }

        const newChar: PersonagemItem = {
            id: `custom_${Date.now()}`,
            nome: charNome.trim(),
            obra: charObra.trim(),
            avatar: charAvatar,
            personalidade: charPersonalidade.trim(),
            historia: charHistoria.trim(),
            relacao: charRelacao.trim(),
            tomVoz: charTomVoz.trim()
        };

        const updated = [...savedCustomChars.filter(c => c.nome !== newChar.nome), newChar];
        setSavedCustomChars(updated);
        try {
            localStorage.setItem('saved_personagens', JSON.stringify(updated));
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: `Personagem "${newChar.nome}" salvo com sucesso nos seus favoritos!`
            });
        } catch (e) {
            console.error("Erro ao salvar personagem no localStorage:", e);
        }
    };

    // Finalizar configuração e iniciar
    const handleStart = () => {
        if (tipoExibicaoSessao === 'nova' && !tema.trim()) {
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: 'Por favor, digite ou selecione um tema de conversa.'
            });
            setConfigTab('estudo');
            return;
        }

        if (tipoExibicaoSessao === 'existente' && !sessaoSelecionadaId) {
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: 'Por favor, selecione uma sessão existente.'
            });
            setConfigTab('estudo');
            return;
        }

        if (!charNome.trim()) {
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: 'Por favor, defina o nome do seu personagem na aba Personagem.'
            });
            setConfigTab('personagem');
            return;
        }

        let conjuntoFinal = conjuntoDestino;
        if (conjuntoDestino === 'novo_conjunto') {
            const nomeLimpado = novoConjuntoNome.trim();
            if (!nomeLimpado) {
                setModalConfig({
                    isOpen: true,
                    tipo: 'alert',
                    mensagem: 'Por favor, digite o nome do novo conjunto.'
                });
                return;
            }
            conjuntoFinal = nomeLimpado;
        }

        let baralhoFinal = baralhoDestino;
        if (baralhoDestino === 'novo_baralho') {
            const nomeLimpado = novoBaralhoNome.trim();
            if (!nomeLimpado) {
                setModalConfig({
                    isOpen: true,
                    tipo: 'alert',
                    mensagem: 'Por favor, digite o nome do novo baralho no Anki.'
                });
                return;
            }
            baralhoFinal = nomeLimpado;
        }

        const finalPersonagem: PersonagemItem = {
            id: selectedPresetId,
            nome: charNome.trim() || 'Tutor de Japonês',
            obra: charObra.trim(),
            avatar: charAvatar || '💬',
            personalidade: charPersonalidade.trim() || 'Amigável, paciente e encorajador',
            historia: charHistoria.trim() || 'Um tutor nativo ajudando a praticar japonês no cotidiano',
            relacao: charRelacao.trim() || 'Tutor e parceiro de conversa',
            tomVoz: charTomVoz.trim() || 'Polido e gentil (Keigo / Desu-Masu)'
        };

        onStart({
            tema,
            useBanco: useConjuntos,
            bancoTipo,
            conjuntoSelecionado: conjuntoSelecionado || 'Geral',
            baralhoSelecionado: baralhoSelecionado || 'Geral',
            srsFiltro,
            jlpt: useConjuntos ? null : jlpt,
            provider: selectedProvider,
            criarNovaSessao: session ? (tipoExibicaoSessao === 'nova') : false,
            nomeSessao: nomeSessao || `${finalPersonagem.nome}: ${tema}`,
            sessionId: session ? (tipoExibicaoSessao === 'existente' ? sessaoSelecionadaId : null) : null,
            baralhoDestino: baralhoFinal,
            conjuntoDestino: conjuntoFinal,
            personagem: finalPersonagem
        });
    };

    /* Botão de Tab Segmentado */
    const SegTab = ({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200',
                active
                    ? 'bg-card text-foreground shadow-md opacity-100'
                    : 'bg-transparent text-foreground opacity-60 hover:opacity-80',
                disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'
            ].join(' ')}
        >
            {children}
        </button>
    );

    return (
        <Card className="max-w-[640px] mx-auto backdrop-blur-sm shadow-xl border border-border/80">
            <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-center text-[1.8em] font-extrabold tracking-tight bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">
                    💬 Configuração do Diálogo
                </CardTitle>

                {/* Abas Superiores de Configuração (Estudo vs Personagem) */}
                <div className="flex gap-1.5 p-1.5 mt-3 rounded-2xl border border-border bg-black/[0.04] w-full">
                    <SegTab active={configTab === 'estudo'} onClick={() => setConfigTab('estudo')}>
                        🎯 Estudo & Sessão
                    </SegTab>
                    <SegTab active={configTab === 'personagem'} onClick={() => setConfigTab('personagem')}>
                        <div className="flex items-center gap-1.5">
                            <AvatarIcon avatar={charAvatar} size="sm" />
                            <span>Personagem ({charNome})</span>
                        </div>
                    </SegTab>
                </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 pt-6">

                {/* ════════════════ ABA 1: ESTUDO E SESSÃO ════════════════ */}
                {configTab === 'estudo' && (
                    <>
                        {/* Escolha de Sessão */}
                        {session && (
                            <div className="flex flex-col gap-2.5">
                                <label className="font-bold text-foreground text-[0.95em]">Modo de Sessão:</label>
                                <div className="flex gap-1 p-1 rounded-full border border-border bg-black/[0.03] w-full">
                                    <SegTab active={tipoExibicaoSessao === 'nova'} onClick={() => setTipoExibicaoSessao('nova')}>
                                        ➕ Nova Sessão
                                    </SegTab>
                                    <SegTab active={tipoExibicaoSessao === 'existente'} onClick={() => setTipoExibicaoSessao('existente')}>
                                        📂 Sessão Existente
                                    </SegTab>
                                </div>
                            </div>
                        )}

                        {tipoExibicaoSessao === 'existente' && session && (
                            <div className="flex flex-col gap-2.5">
                                <label className="font-bold text-foreground text-[0.95em]">Selecione a Sessão:</label>
                                <div className="flex gap-2.5">
                                    <select
                                        value={sessaoSelecionadaId}
                                        onChange={e => setSessaoSelecionadaId(e.target.value)}
                                        disabled={isLoadingSessions}
                                        className="flex-1 px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold text-[1.05em] outline-none transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {isLoadingSessions ? (
                                            <option>Carregando sessões...</option>
                                        ) : sessoesExistentes.length === 0 ? (
                                            <option value="">Nenhuma sessão encontrada</option>
                                        ) : (
                                            sessoesExistentes.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.nome} ({s.config?.tema || s.tema}) - {new Date(s.created_at).toLocaleDateString()}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                    {sessaoSelecionadaId && sessoesExistentes.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={handleDeletarSessao}
                                            className="px-5 gap-1.5"
                                        >
                                            🗑️ Apagar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {tipoExibicaoSessao === 'nova' && session && (
                            <div className="flex flex-col gap-2.5">
                                <label className="font-bold text-foreground text-[0.95em]">Nome da Sessão (Opcional):</label>
                                <Input
                                    type="text"
                                    placeholder="Ex: Conversa no Restaurante..."
                                    value={nomeSessao}
                                    onChange={e => setNomeSessao(e.target.value)}
                                    className="px-4 py-3 rounded-xl border-2 border-border text-[1em]"
                                />
                            </div>
                        )}

                        {/* Tema */}
                        <div className="flex flex-col gap-2.5">
                            <label className="font-bold text-foreground text-[0.95em]">🎯 Tema da Conversa:</label>
                            <Input
                                type="text"
                                placeholder="Digite um tema (ex: Fazer pedidos no restaurante...)"
                                value={tema}
                                onChange={e => setTema(e.target.value)}
                                className="px-4 py-3 rounded-xl border-2 border-border text-[1em]"
                            />
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {temasRapidos.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setTema(t)}
                                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/80 text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-150"
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Origem do Vocabulário */}
                        <div className="flex flex-col gap-2.5">
                            <label className="font-bold text-foreground text-[0.95em]">📚 Fonte de Vocabulário:</label>
                            <div className="flex gap-1 p-1 rounded-full border border-border bg-black/[0.03] w-full mb-2">
                                <SegTab active={!useConjuntos} onClick={() => setUseConjuntos(false)}>
                                    🌐 Qualquer palavra (Livre)
                                </SegTab>
                                <SegTab
                                    active={useConjuntos}
                                    onClick={() => { if (session) setUseConjuntos(true); }}
                                    disabled={!session}
                                >
                                    📁 Meu Banco {session ? '' : '(Requer Login)'}
                                </SegTab>
                            </div>

                            {!useConjuntos ? (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[0.9em] text-muted-foreground">Nível de dificuldade máximo (JLPT):</label>
                                    <select
                                        value={jlpt}
                                        onChange={e => setJlpt(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold text-[1em] outline-none cursor-pointer transition-all shadow-sm"
                                    >
                                        <option value="N5">🟢 N5 (Iniciante)</option>
                                        <option value="N4">🔵 N4 (Básico)</option>
                                        <option value="N3">🟡 N3 (Intermediário)</option>
                                        <option value="N2">🟠 N2 (Avançado)</option>
                                        <option value="N1">🔴 N1 (Fluente)</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-[0.9em] text-muted-foreground mb-2">Filtrar banco por:</label>
                                        <div className="flex gap-1 p-1 rounded-full border border-border bg-black/[0.03] w-full">
                                            <SegTab active={bancoTipo === 'conjuntos'} onClick={() => setBancoTipo('conjuntos')}>📁 Conjuntos</SegTab>
                                            <SegTab active={bancoTipo === 'baralhos'} onClick={() => setBancoTipo('baralhos')}>🎴 Baralhos</SegTab>
                                            <SegTab active={bancoTipo === 'ambos'} onClick={() => setBancoTipo('ambos')}>🌀 Ambos</SegTab>
                                        </div>
                                    </div>

                                    {(bancoTipo === 'conjuntos' || bancoTipo === 'ambos') && (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[0.9em] text-muted-foreground">Escolha um conjunto:</label>
                                            <select
                                                value={conjuntoSelecionado}
                                                onChange={e => setConjuntoSelecionado(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold text-[1em] outline-none cursor-pointer transition-all shadow-sm"
                                            >
                                                {conjuntosDisp.map(c => (
                                                    <option key={c} value={c}>📁 {c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {(bancoTipo === 'baralhos' || bancoTipo === 'ambos') && (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[0.9em] text-muted-foreground">Escolha um baralho (Anki):</label>
                                            <select
                                                value={baralhoSelecionado}
                                                onChange={e => setBaralhoSelecionado(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold text-[1em] outline-none cursor-pointer transition-all shadow-sm"
                                            >
                                                {baralhosDisp.map(b => (
                                                    <option key={b} value={b}>🎴 {b}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {(bancoTipo === 'baralhos' || bancoTipo === 'ambos') && (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[0.9em] text-muted-foreground">Filtro de Progresso SRS:</label>
                                            <div className="flex gap-1 p-1 rounded-full border border-border bg-black/[0.03] w-full">
                                                <SegTab active={srsFiltro === 'Todos'} onClick={() => setSrsFiltro('Todos')}>🧠 Todos</SegTab>
                                                <SegTab active={srsFiltro === 'Aprendidos'} onClick={() => setSrsFiltro('Aprendidos')}>🔵 Aprendidos</SegTab>
                                                <SegTab active={srsFiltro === 'Novos'} onClick={() => setSrsFiltro('Novos')}>🟡 Novos</SegTab>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Provedor de IA */}
                        <div className="flex flex-col gap-2.5">
                            <label className="font-bold text-foreground text-[0.95em]">🤖 Provedor de Inteligência Artificial:</label>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-1 p-1 rounded-2xl border border-border bg-black/[0.03]">
                                {([
                                    { key: 'gemini', label: '✨ Gemini', sub: 'Grátis' },
                                    { key: 'openai', label: '🧠 OpenAI', sub: 'GPT-4o (Pago)' },
                                    { key: 'pollinations', label: '🪐 Pollinations', sub: 'Sem Chave' },
                                    { key: 'groq', label: '⚡ Groq', sub: 'Llama 3.3 (Grátis)' },
                                ] as { key: typeof selectedProvider; label: string; sub: string }[]).map(p => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => setSelectedProvider(p.key)}
                                        className={[
                                            'flex flex-col items-center gap-1 px-2 py-2.5 text-[0.82em] font-bold rounded-xl transition-all duration-200',
                                            selectedProvider === p.key
                                                ? 'bg-card text-foreground shadow-md opacity-100'
                                                : 'bg-transparent text-foreground opacity-60 hover:opacity-80'
                                        ].join(' ')}
                                    >
                                        <span>{p.label}</span>
                                        <span className="text-[0.75em] font-normal text-muted-foreground">{p.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Destino de novas palavras */}
                        <div className="flex flex-col gap-4 p-4 rounded-2xl border border-border bg-card/50">
                            <label className="font-bold text-foreground text-[0.95em]">📥 Destino das palavras novas aprendidas:</label>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-muted-foreground">📁 Conjunto de Vocabulário (Local/Supabase):</span>
                                <select
                                    value={conjuntoDestino}
                                    onChange={e => {
                                        setConjuntoDestino(e.target.value);
                                        if (e.target.value !== 'novo_conjunto') setNovoConjuntoNome('');
                                    }}
                                    className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-background text-foreground font-semibold text-[1em] outline-none shadow-sm focus:border-primary"
                                >
                                    {conjuntosDisp.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    {!conjuntosDisp.includes('DialoGo') && <option value="DialoGo">🎌 DialoGo</option>}
                                    <option value="novo_conjunto">➕ Criar Novo Conjunto...</option>
                                </select>
                                
                                {conjuntoDestino === 'novo_conjunto' && (
                                    <Input
                                        type="text"
                                        placeholder="Nome do novo conjunto..."
                                        value={novoConjuntoNome}
                                        onChange={e => setNovoConjuntoNome(e.target.value)}
                                        className="mt-2 w-full rounded-xl border-2 border-border"
                                    />
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-muted-foreground">🎴 Baralho do Anki (AnkiConnect):</span>
                                <select
                                    value={baralhoDestino}
                                    onChange={e => {
                                        setBaralhoDestino(e.target.value);
                                        if (e.target.value !== 'novo_baralho') setNovoBaralhoNome('');
                                    }}
                                    className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-background text-foreground font-semibold text-[1em] outline-none shadow-sm focus:border-primary"
                                >
                                    <option value="">🚫 Nenhum (Não salvar no Anki)</option>
                                    {baralhosDisp.filter(b => b !== 'Geral').map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                    <option value="novo_baralho">➕ Criar Novo Baralho...</option>
                                </select>

                                {baralhoDestino === 'novo_baralho' && (
                                    <Input
                                        type="text"
                                        placeholder="Nome do novo baralho no Anki..."
                                        value={novoBaralhoNome}
                                        onChange={e => setNovoBaralhoNome(e.target.value)}
                                        className="mt-2 w-full rounded-xl border-2 border-border"
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ════════════════ ABA 2: CONFIGURAÇÃO DO PERSONAGEM ════════════════ */}
                {configTab === 'personagem' && (
                    <div className="flex flex-col gap-6">

                        {/* Presets Rápidos */}
                        <div className="flex flex-col gap-3">
                            <label className="font-bold text-foreground text-[0.95em]">🎭 Escolha um Personagem Preset ou Customizado:</label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {PRESET_PERSONAGENS.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectPreset(p)}
                                        className={[
                                            'flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all duration-200',
                                            selectedPresetId === p.id && charNome === p.nome
                                                ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                                                : 'border-border bg-card/60 hover:border-primary/50'
                                        ].join(' ')}
                                    >
                                         <AvatarIcon avatar={p.avatar} size="lg" />
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold text-sm text-foreground truncate">{p.nome}</span>
                                            <span className="text-xs text-muted-foreground truncate">{p.relacao}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Personagens salvos no LocalStorage pelo usuário */}
                            {savedCustomChars.length > 0 && (
                                <div className="flex flex-col gap-2 mt-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Favoritos Salvos:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {savedCustomChars.map(sc => (
                                            <button
                                                key={sc.id}
                                                type="button"
                                                onClick={() => handleSelectPreset(sc)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-primary/40 bg-primary/5 hover:bg-primary/20 transition-all"
                                            >
                                                <AvatarIcon avatar={sc.avatar} size="sm" />
                                                <span>{sc.nome}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Busca de Personagens de Animes / Cultura Pop por IA */}
                        <div className="flex flex-col gap-3 p-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/[0.02]">
                            <div className="flex items-center justify-between">
                                <label className="font-bold text-foreground text-[0.95em] flex items-center gap-2">
                                    <span>✨ Importar de Anime / Obra Famosa</span>
                                </label>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Preenchimento IA</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Digite o nome de qualquer personagem (ex: Gojo, Naruto, Frieren, Luffy) para a IA buscar a obra e preencher a ficha automaticamente!
                            </p>

                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="Ex: Gojo Satoru, Naruto, Frieren..."
                                    value={searchCharQuery}
                                    onChange={e => setSearchCharQuery(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCharacters(); } }}
                                    className="flex-1 rounded-xl"
                                />
                                <Button
                                    type="button"
                                    onClick={handleSearchCharacters}
                                    disabled={isSearchingChar || isGeneratingProfile}
                                    className="px-4 font-bold gap-1.5"
                                >
                                    {isSearchingChar ? '🔍 Buscando...' : '🔍 Buscar na IA'}
                                </Button>
                            </div>

                            {/* Banner de Erro na Busca */}
                            {searchCharError && (
                                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive text-destructive text-xs font-semibold animate-in fade-in">
                                    ⚠️ {searchCharError}
                                </div>
                            )}

                            {/* Indicator de Loading / Gerando perfil */}
                            {isGeneratingProfile && (
                                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card border border-border animate-pulse">
                                    <span className="text-2xl animate-spin">🌀</span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-xs text-primary">Gerando perfil detalhado de {generatingCharName}...</span>
                                        <span className="text-[0.75em] text-muted-foreground">Coletando personalidade, história e traços do japonês...</span>
                                    </div>
                                </div>
                            )}

                            {/* Resultados de Busca */}
                            {searchResultsChar.length > 0 && !isGeneratingProfile && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <span className="text-xs font-bold text-foreground">Personagens encontrados (Clique para preencher):</span>
                                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                        {searchResultsChar.map((res, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSelectSearchResult(res)}
                                                className="flex flex-col text-left p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-sm text-foreground group-hover:text-primary">{res.nome}</span>
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{res.obra}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{res.descricao_curta}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Formulário de Edição do Personagem */}
                        <div className="flex flex-col gap-4 p-4 rounded-2xl border border-border bg-card/60">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground text-[0.95em]">✏️ Detalhes da Ficha do Personagem:</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSaveCustomCharacter}
                                    className="text-xs font-bold gap-1 rounded-xl"
                                >
                                    💾 Salvar nos Favoritos
                                </Button>
                            </div>

                            {/* Nome e Obra */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Nome do Personagem:*</label>
                                    <Input
                                        type="text"
                                        value={charNome}
                                        onChange={e => { setCharNome(e.target.value); setSelectedPresetId('custom'); }}
                                        placeholder="Ex: Satoru Gojo"
                                        className="rounded-xl font-bold"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Obra / Origem (Opcional):</label>
                                    <Input
                                        type="text"
                                        value={charObra}
                                        onChange={e => setCharObra(e.target.value)}
                                        placeholder="Ex: Jujutsu Kaisen"
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Avatar Picker */}
                            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-card border border-border">
                                <label className="text-xs font-bold text-foreground">Avatar / Foto do Personagem:</label>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {/* Preview do Avatar Atual */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border-2 border-primary/40 bg-primary/5 shadow-xs">
                                        <AvatarIcon avatar={charAvatar} size="lg" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-extrabold text-foreground">Foto Ativa</span>
                                            <span className="text-[0.7em] text-muted-foreground">
                                                {charAvatar.startsWith('data:image') ? '📷 Imagem de Arquivo' : charAvatar.startsWith('http') ? '🌐 Imagem da Web' : '😊 Emoji'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Upload de Arquivo de Imagem */}
                                    <label className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer transition-all shadow-xs">
                                        <span>📷 Enviar Foto do Seu Dispositivo</span>
                                        <input
                                            type="text"
                                            readOnly
                                            className="hidden"
                                        />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (evt) => {
                                                        if (evt.target?.result) {
                                                            setCharAvatar(evt.target.result as string);
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col gap-1.5 mt-1">
                                    <span className="text-[0.75em] font-semibold text-muted-foreground">Ou escolha um dos avatares predefinidos:</span>
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {PRESET_AVATARES.map(av => (
                                            <button
                                                key={av}
                                                type="button"
                                                onClick={() => setCharAvatar(av)}
                                                className={[
                                                    'w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all',
                                                    charAvatar === av ? 'bg-primary/20 border-2 border-primary scale-105' : 'bg-black/5 hover:bg-black/10'
                                                ].join(' ')}
                                            >
                                                {av}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-semibold text-muted-foreground">Ou insira a URL da foto:</span>
                                    <Input
                                        type="text"
                                        value={charAvatar.startsWith('data:image') ? '[Foto enviada do dispositivo]' : charAvatar}
                                        onChange={e => {
                                            if (e.target.value !== '[Foto enviada do dispositivo]') setCharAvatar(e.target.value);
                                        }}
                                        placeholder="URL de imagem (http...)"
                                        className="flex-1 rounded-xl text-xs font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Relação com o Usuário */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Sua Relação com este Personagem:</label>
                                <Input
                                    type="text"
                                    value={charRelacao}
                                    onChange={e => setCharRelacao(e.target.value)}
                                    placeholder="Ex: Amigo de infância, Seu tutor, Atendente de loja, Rival..."
                                    className="rounded-xl"
                                />
                            </div>

                            {/* Personalidade */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Personalidade (Português):</label>
                                <textarea
                                    value={charPersonalidade}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharPersonalidade(e.target.value)}
                                    placeholder="Como ele se comporta, traços de humor, reação ao falar..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border-2 border-border bg-background text-foreground text-sm font-normal outline-none focus:border-primary transition-all resize-y shadow-xs"
                                />
                            </div>

                            {/* História & Background */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">História & Background (Português):</label>
                                <textarea
                                    value={charHistoria}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharHistoria(e.target.value)}
                                    placeholder="Onde vive, o que faz da vida, seus objetivos..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border-2 border-border bg-background text-foreground text-sm font-normal outline-none focus:border-primary transition-all resize-y shadow-xs"
                                />
                            </div>

                            {/* Tom de Voz / Estilo Linguístico em Japonês */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Estilo de Fala & Tom de Voz (Traços Linguísticos do Japonês):</label>
                                <textarea
                                    value={charTomVoz}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharTomVoz(e.target.value)}
                                    placeholder="Ex: Usa 'ore' para 'eu', fala em Tameguchi casual com bordão 'dattebayo'..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border-2 border-border bg-background text-foreground text-sm font-normal outline-none focus:border-primary transition-all resize-y shadow-xs"
                                />
                            </div>
                        </div>

                    </div>
                )}

                {/* Botão de Ação Principal (Visível em ambas as abas) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
                    <Button
                        onClick={handleStart}
                        disabled={isLoadingSessions && !!session}
                        className="w-full py-6 text-[1.15em] font-extrabold bg-gradient-to-br from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90 hover:-translate-y-0.5 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                    >
                        {isLoadingSessions && !!session ? '⏳ Carregando...' : `🚀 Iniciar Diálogo com ${charNome}`}
                    </Button>
                </div>

            </CardContent>

            {/* Modal de confirmação/alerta */}
            <Dialog open={modalConfig.isOpen} onOpenChange={(open) => { if (!open) setModalConfig(prev => ({ ...prev, isOpen: false })); }}>
                <DialogContent
                    className="max-w-[400px] text-center z-[11000]"
                    onMouseDown={handleMouseDown}
                    style={{ transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
                >
                    <DialogHeader>
                        <DialogTitle className="text-center">
                            <span className="text-4xl block mb-2">{modalConfig.tipo === 'confirm' ? '🗑️' : '🔔'}</span>
                            {modalConfig.tipo === 'confirm' ? 'Confirmar Ação' : 'Aviso'}
                        </DialogTitle>
                        <DialogDescription className="text-[0.95em] leading-relaxed opacity-90 text-center">
                            {modalConfig.mensagem}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2.5 justify-center mt-2">
                        {modalConfig.tipo === 'confirm' ? (
                            <>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={modalConfig.onConfirm}
                                >
                                    Confirmar
                                </Button>
                            </>
                        ) : (
                            <Button
                                className="min-w-[120px]"
                                onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                            >
                                OK
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
