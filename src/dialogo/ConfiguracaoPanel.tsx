import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ConfiguracaoPanelProps {
    onStart: (config: any) => void;
    session: any;
}

export default function ConfiguracaoPanel({ onStart, session }: ConfiguracaoPanelProps) {
    const [tema, setTema] = useState('');
    const [jlpt, setJlpt] = useState('N5');
    const [conjuntosDisp, setConjuntosDisp] = useState<string[]>([]);
    const [conjuntoSelecionado, setConjuntoSelecionado] = useState('');
    const [useConjuntos, setUseConjuntos] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Novos estados para baralhos e filtros SRS
    const [bancoTipo, setBancoTipo] = useState<'conjuntos' | 'baralhos' | 'ambos'>('conjuntos');
    const [baralhosDisp, setBaralhosDisp] = useState<string[]>([]);
    const [baralhoSelecionado, setBaralhoSelecionado] = useState('');
    const [srsFiltro, setSrsFiltro] = useState<'Todos' | 'Aprendidos' | 'Novos'>('Todos');
    const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'groq' | 'pollinations'>(
        () => (localStorage.getItem('selected_provider') as any) || 'groq'
    );

    useEffect(() => {
        localStorage.setItem('selected_provider', selectedProvider);
    }, [selectedProvider]);

    // Estados de sessões
    const [tipoExibicaoSessao, setTipoExibicaoSessao] = useState<'nova' | 'existente'>('nova');
    const [nomeSessao, setNomeSessao] = useState('');
    const [sessoesExistentes, setSessoesExistentes] = useState<any[]>([]);
    const [sessaoSelecionadaId, setSessaoSelecionadaId] = useState('');
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);

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
                        // Remove da lista local e atualiza seleção
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

            }
        }
    }, [sessaoSelecionadaId, sessoesExistentes]);

    const carregarDadosBanco = async () => {
        if (!session) return;
        try {
            // Busca dados do vocabulário (jisho)
            const resJisho = await fetch('/api/jisho?acao=listar', {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });
            if (!resJisho.ok) throw new Error(`HTTP error ${resJisho.status} loading jisho`);
            const dataJisho = await resJisho.json();

            // Busca dados dos baralhos do Anki
            let dataAnki = [];
            try {
                const resAnki = await fetch('/api/anki?acao=listar', {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`
                    }
                });
                if (resAnki.ok) {
                    dataAnki = await resAnki.json();
                }
            } catch (ankiErr) {
                console.error("Erro ao carregar baralhos do Anki", ankiErr);
            }
            
            const todosConjuntos = new Set<string>(['Geral']);
            const todosBaralhos = new Set<string>(['Geral']);
            
            if (dataJisho && Array.isArray(dataJisho)) {
                dataJisho.forEach((item: any) => {
                    // Extrai conjuntos das notas e do campo conjunto
                    if (item.conjuntos && Array.isArray(item.conjuntos)) {
                        item.conjuntos.forEach((c: string) => todosConjuntos.add(c));
                    }
                    if (item.notas) {
                        const match = item.notas.match(/\[Conjuntos:\s*([^\]]+)\]/);
                        if (match) {
                            match[1].split(',').map((s: string) => s.trim()).filter(Boolean).forEach((c: string) => todosConjuntos.add(c));
                        }
                    }
                    
                    // Extrai baralhos
                    if (item.baralhos && Array.isArray(item.baralhos)) {
                        item.baralhos.forEach((b: string) => todosBaralhos.add(b));
                    }
                });
            }

            if (dataAnki && Array.isArray(dataAnki)) {
                dataAnki.forEach((item: any) => {
                    if (item.deck_name) {
                        todosBaralhos.add(item.deck_name);
                    }
                });
            }
            
            const listaConjuntos = Array.from(todosConjuntos).sort();
            setConjuntosDisp(listaConjuntos);
            if (listaConjuntos.length > 0) setConjuntoSelecionado(listaConjuntos[0]);
            
            const listaBaralhos = Array.from(todosBaralhos).sort();
            setBaralhosDisp(listaBaralhos);
            if (listaBaralhos.length > 0) setBaralhoSelecionado(listaBaralhos[0]);
        } catch (error) {
            console.error("Erro ao carregar dados do banco", error);
        }
    };

    const handleStart = () => {
        if (tipoExibicaoSessao === 'nova' && !tema.trim()) {
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: 'Por favor, digite ou selecione um tema.'
            });
            return;
        }
        if (tipoExibicaoSessao === 'existente' && !sessaoSelecionadaId) {
            setModalConfig({
                isOpen: true,
                tipo: 'alert',
                mensagem: 'Por favor, selecione uma sessão existente.'
            });
            return;
        }

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
            nomeSessao: nomeSessao || tema,
            sessionId: session ? (tipoExibicaoSessao === 'existente' ? sessaoSelecionadaId : null) : null,

        });
    };

    /* ── helper: botão de tab segmentado ── */
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
        <Card className="max-w-[600px] mx-auto backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-center text-[1.8em] font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                    💬 Configurar Diálogo
                </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 pt-6">

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
                            value={nomeSessao}
                            onChange={e => setNomeSessao(e.target.value)}
                            placeholder="Ex: Minha conversa no restaurante"
                            className="w-full text-[1.05em]"
                        />
                    </div>
                )}

                {/* Tema */}
                <div className="flex flex-col gap-2.5">
                    <label className="font-bold text-foreground text-[0.95em]">Tema da Conversa:</label>
                    <Input
                        type="text"
                        value={tema}
                        onChange={e => setTema(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Ex: Como pedir comida num restaurante..."
                        disabled={tipoExibicaoSessao === 'existente'}
                        className={[
                            'w-full text-[1.05em] transition-all duration-300',
                            tipoExibicaoSessao === 'existente' ? 'cursor-not-allowed opacity-70' : ''
                        ].join(' ')}
                    />
                    <div className="flex flex-wrap gap-2 mt-1">
                        {temasRapidos.map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTema(t)}
                                disabled={tipoExibicaoSessao === 'existente'}
                                className={[
                                    'px-4 py-2 rounded-full border border-border text-[0.88em] font-semibold transition-all duration-200',
                                    tema === t
                                        ? 'bg-primary text-primary-foreground shadow-md scale-[1.03] border-primary'
                                        : 'bg-transparent text-foreground hover:bg-black/[0.03] hover:-translate-y-0.5',
                                    tipoExibicaoSessao === 'existente' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                ].join(' ')}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fonte de Vocabulário */}
                <div className="flex flex-col gap-2.5">
                    <label className="font-bold text-foreground text-[0.95em]">Fonte de Vocabulário:</label>

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
                            { key: 'gemini', label: '✨ Gemini', sub: 'Grátis (Instável)' },
                            { key: 'openai', label: '🧠 OpenAI', sub: 'GPT-4o (Pago)' },
                            { key: 'pollinations', label: '🪐 Pollinations', sub: 'Grátis (Sem Chave)' },
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

                {/* Botão Iniciar */}
                <Button
                    onClick={handleStart}
                    disabled={isLoadingSessions && !!session}
                    className="w-full py-6 text-[1.15em] font-extrabold mt-2 bg-gradient-to-br from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90 hover:-translate-y-0.5 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                    {isLoadingSessions && !!session ? '⏳ Carregando Sessões...' : '🚀 Iniciar Diálogo'}
                </Button>

            </CardContent>

            {/* Modal de confirmação/alerta (Dialog shadcn) */}
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
