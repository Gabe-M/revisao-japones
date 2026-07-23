import React, { useState, useEffect, useRef, useCallback } from 'react';
import InteractiveText from '../../components/InteractiveText';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Puzzle, BookOpen, MessageSquare, Plus, Check } from 'lucide-react';
import { adicionarAoAnki } from '../services/ankiService';
import AnkiPreviewModal from './AnkiPreviewModal';

interface GuiaLateralProps {
    context: any;
    session?: any;
    isOpen: boolean;
    onToggle: () => void;
    historico?: any[];
    onInjetarResposta?: (texto: string) => void;
    width?: number;
    onWidthChange?: (w: number) => void;
    onIsResizingChange?: (isResizing: boolean) => void;
}

// Helper to call API
const callApi = async (acao: string, bodyData: any, context: any, session: any) => {
    const userKey = localStorage.getItem('gemini_api_key') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userKey) headers['X-Gemini-Key'] = userKey;
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const body = {
        acao,
        provider: context.provider || 'groq',
        tema: context.tema,
        jlpt: context.jlpt,
        ...bodyData
    };

    const res = await fetch('/api/dialogo', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return await res.json();
};

export default function GuiaLateral({
    context,
    session,
    isOpen,
    onToggle,
    historico = [],
    onInjetarResposta,
    width = 380,
    onWidthChange,
    onIsResizingChange
}: GuiaLateralProps) {
    const [activeTab, setActiveTab] = useState<'explorar' | 'gramatica' | 'vocab' | 'frases' | 'chat'>('explorar');
    const [contextoAtivo, setContextoAtivo] = useState<any>(null); // Shared context to pass to chat

    // Drag handle resize handler (left border)
    const handleMouseDownResize = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onIsResizingChange) onIsResizingChange(true);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const maxW = Math.floor(window.innerWidth * 0.5);
            const newW = Math.min(maxW, Math.max(320, window.innerWidth - moveEvent.clientX));
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
            if (onWidthChange) onWidthChange(380);
        } else {
            if (onWidthChange) onWidthChange(half);
        }
    };

    // Fecha o painel no mobile após usar
    const handleUsar = (texto: string) => {
        if (onInjetarResposta) onInjetarResposta(texto);
        if (window.innerWidth < 768) {
            onToggle();
        }
    };

    return (
        <>
            <button
                onClick={onToggle}
                title={isOpen ? 'Fechar' : 'Abrir Guia'}
                className={[
                    'fixed z-40 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1',
                    'w-9 h-28 rounded-l-xl border border-r-0 border-border bg-card shadow-lg',
                    'text-primary font-bold text-[0.65em] leading-tight transition-all duration-300',
                    'hover:bg-accent hover:text-accent-foreground select-none'
                ].join(' ')}
                style={{
                    right: isOpen ? `${width}px` : '0px',
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed'
                }}
            >
                <span className="text-base">🛠️</span>
                <span>{isOpen ? '◀ Fechar' : 'Kit ▶'}</span>
            </button>

            <div
                className={[
                    'fixed right-0 top-0 h-full z-30 flex flex-col',
                    'bg-card border-l border-border shadow-2xl overflow-hidden'
                ].join(' ')}
                style={{
                    width: isOpen ? `${width}px` : '0px',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none'
                }}
                aria-hidden={!isOpen}
            >
                {/* Drag handle no lado esquerdo */}
                <div
                    onMouseDown={handleMouseDownResize}
                    title="Arraste para redimensionar (até 50% da tela)"
                    className="absolute left-0 top-0 w-2.5 h-full cursor-ew-resize hover:bg-primary/40 transition-colors z-50 flex items-center justify-center group"
                >
                    <div className="w-1 h-10 rounded-full bg-muted-foreground/30 group-hover:bg-primary" />
                </div>
                <div className="flex flex-col border-b border-border bg-card shrink-0">
                    <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
                        <div className="flex flex-col">
                            <span className="font-bold text-foreground text-[0.95em]">🛠️ Kit de Exploração</span>
                            <span className="text-muted-foreground text-[0.75em]">{context.tema} • {context.jlpt}</span>
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
                            <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Fechar">✕</Button>
                        </div>
                    </div>
                    {/* Tabs */}
                    <div className="flex w-full">
                        <TabButton active={activeTab === 'explorar'} onClick={() => setActiveTab('explorar')} icon={<Search size={14} />} label="Explorar" />
                        <TabButton active={activeTab === 'gramatica'} onClick={() => setActiveTab('gramatica')} icon={<Puzzle size={14} />} label="Gramática" />
                        <TabButton active={activeTab === 'vocab'} onClick={() => setActiveTab('vocab')} icon={<BookOpen size={14} />} label="Vocab" />
                        <TabButton active={activeTab === 'frases'} onClick={() => setActiveTab('frases')} icon={<span className="text-xs">💬</span>} label="Frases" />
                        <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={14} />} label="Chat" />
                    </div>
                </div>

                <ScrollArea className="flex-1 w-full bg-black/[0.01]">
                    <div className="p-4 pb-8 min-h-full">
                        {activeTab === 'explorar' && <AbaExplorar context={context} session={session} onUsar={handleUsar} onSetContexto={setContextoAtivo} />}
                        {activeTab === 'gramatica' && <AbaGramatica context={context} session={session} onUsar={handleUsar} onSetContexto={setContextoAtivo} />}
                        {activeTab === 'vocab' && <AbaVocab context={context} session={session} onUsar={handleUsar} historico={historico} />}
                        {activeTab === 'frases' && <AbaFrases context={context} session={session} onUsar={handleUsar} />}
                        {activeTab === 'chat' && <AbaChat context={context} session={session} historico={historico} contextoAtivo={contextoAtivo} onUsar={handleUsar} />}
                    </div>
                </ScrollArea>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden" onClick={onToggle} />
            )}
        </>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={[
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[0.7em] font-bold border-b-2 transition-colors',
                active ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:bg-black/5 hover:text-foreground'
            ].join(' ')}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

// ==========================================
// ABA 1: EXPLORAR
// ==========================================
function AbaExplorar({ context, session, onUsar, onSetContexto }: any) {
    const [termo, setTermo] = useState('');
    const [modo, setModo] = useState<'rapida' | 'profunda'>('rapida');
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState<any>(null);

    const handleBuscar = async () => {
        if (!termo.trim()) return;
        setLoading(true);
        setResultado(null);
        try {
            const data = await callApi('explorar_palavra', { termo, modo }, context, session);
            setResultado(data);
            onSetContexto({ tipo: 'explorar', termo: data.termo_jp || termo, detalhe: data.significados?.[0] });
        } catch (e: any) {
            alert(e.message);
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <Input 
                        placeholder="Digite em JP ou PT..." 
                        value={termo} 
                        onChange={e => setTermo(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                    />
                    <Button onClick={handleBuscar} disabled={loading}>{loading ? '...' : 'Buscar'}</Button>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={modo === 'rapida'} onChange={() => setModo('rapida')} /> Rápida
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={modo === 'profunda'} onChange={() => setModo('profunda')} /> Profunda (com kanjis)
                    </label>
                </div>
            </div>

            {loading && <div className="text-center py-4 text-muted-foreground animate-pulse">Explorando palavra...</div>}
            
            {resultado && !loading && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                    {/* Header */}
                    <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center text-center shadow-sm">
                        <span className="text-sm font-bold text-muted-foreground">{resultado.romaji}</span>
                        <div className="text-3xl font-bold my-2 text-foreground">
                            <InteractiveText text={resultado.termo_jp} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {resultado.jlpt && <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">{resultado.jlpt}</span>}
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{resultado.classe_gramatical}</span>
                        </div>
                        <div className="mt-3 text-lg font-medium">
                            {resultado.significados?.join(', ')}
                        </div>
                    </div>

                    {/* Partículas */}
                    {resultado.particulas_comuns && resultado.particulas_comuns.length > 0 && (
                        <div>
                            <h4 className="font-bold text-sm mb-2">Partículas Comuns</h4>
                            <div className="flex flex-col gap-2">
                                {resultado.particulas_comuns.map((p: any, i: number) => (
                                    <div key={i} className="bg-background border border-border rounded-lg p-3 text-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-lg text-primary">{p.particula}</span>
                                            <span className="text-muted-foreground text-xs">{p.funcao}</span>
                                        </div>
                                        <div>
                                            <InteractiveText text={p.exemplo_jp} />
                                            <div className="text-muted-foreground text-xs mt-0.5">{p.exemplo_pt}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Exemplos */}
                    {resultado.exemplos && resultado.exemplos.length > 0 && (
                        <div>
                            <h4 className="font-bold text-sm mb-2">Frases de Exemplo</h4>
                            <div className="flex flex-col gap-2">
                                {resultado.exemplos.map((ex: any, i: number) => (
                                    <div key={i} className="bg-background border border-border rounded-lg p-3 text-sm relative group">
                                        <div className="pr-16">
                                            <InteractiveText text={ex.jp} />
                                            <div className="text-muted-foreground text-xs mt-1">{ex.pt}</div>
                                        </div>
                                        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => onUsar(ex.texto_puro)} title="Usar no chat">▶</Button>
                                            <AnkiButton card={{ item: ex.texto_puro, leitura: resultado.furigana, significado: ex.pt, categoria: 'Exemplo', jlpt: resultado.jlpt }} modulo="Explorar" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Kanjis (Busca Profunda) */}
                    {modo === 'profunda' && resultado.kanjis && (
                        <div>
                            <h4 className="font-bold text-sm mb-2">Kanjis</h4>
                            <div className="grid gap-2">
                                {resultado.kanjis.map((k: any, i: number) => (
                                    <div key={i} className="bg-card border border-border flex gap-3 p-3 rounded-lg">
                                        <div className="text-4xl font-black text-foreground flex items-center justify-center w-12">{k.kanji}</div>
                                        <div className="flex-1 flex flex-col justify-center text-xs gap-1">
                                            <div><span className="font-bold text-muted-foreground">Significado:</span> {k.significado}</div>
                                            <div><span className="font-bold text-muted-foreground">Radical:</span> {k.radical}</div>
                                            <div><span className="font-bold text-muted-foreground">Kun:</span> {k.leitura_kun} | <span className="font-bold text-muted-foreground">On:</span> {k.leitura_on}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ==========================================
// ABA 2: GRAMÁTICA
// ==========================================
function AbaGramatica({ context, session, onUsar, onSetContexto }: any) {
    const [ferramenta, setFerramenta] = useState<'particulas' | 'tom' | 'verbo' | null>(null);

    return (
        <div className="flex flex-col gap-4">
            {!ferramenta && (
                <div className="flex flex-col gap-3">
                    <button onClick={() => setFerramenta('particulas')} className="text-left bg-card border border-border p-4 rounded-xl hover:border-primary transition-all shadow-sm">
                        <h4 className="font-bold text-primary mb-1">⚖️ Analisador de Partículas</h4>
                        <p className="text-xs text-muted-foreground">Compara duas partículas no contexto de uma frase e explica qual usar.</p>
                    </button>
                    <button onClick={() => setFerramenta('tom')} className="text-left bg-card border border-border p-4 rounded-xl hover:border-primary transition-all shadow-sm">
                        <h4 className="font-bold text-primary mb-1">🎭 Ajuste de Tom</h4>
                        <p className="text-xs text-muted-foreground">Transforma uma frase casual em formal ou honorífica (Keigo).</p>
                    </button>
                    <button onClick={() => setFerramenta('verbo')} className="text-left bg-card border border-border p-4 rounded-xl hover:border-primary transition-all shadow-sm">
                        <h4 className="font-bold text-primary mb-1">🔪 Desmontador de Verbos</h4>
                        <p className="text-xs text-muted-foreground">Gera uma tabela visual com as conjugações essenciais de qualquer verbo.</p>
                    </button>
                </div>
            )}
            
            {ferramenta && (
                <div>
                    <Button variant="ghost" size="sm" onClick={() => setFerramenta(null)} className="mb-4 -ml-2 text-xs">← Voltar às ferramentas</Button>
                    {ferramenta === 'particulas' && <ToolParticulas context={context} session={session} onSetContexto={onSetContexto} />}
                    {ferramenta === 'tom' && <ToolTom context={context} session={session} onUsar={onUsar} onSetContexto={onSetContexto} />}
                    {ferramenta === 'verbo' && <ToolVerbo context={context} session={session} onUsar={onUsar} onSetContexto={onSetContexto} />}
                </div>
            )}
        </div>
    );
}

function ToolParticulas({ context, session, onSetContexto }: any) {
    const [frase, setFrase] = useState('');
    const [pa, setPa] = useState('は');
    const [pb, setPb] = useState('が');
    const [loading, setLoading] = useState(false);
    const [res, setRes] = useState<any>(null);

    const handleRun = async () => {
        if (!frase.trim()) return;
        setLoading(true); setRes(null);
        try {
            const data = await callApi('analisar_particulas', { particula_a: pa, particula_b: pb, frase_contexto: frase }, context, session);
            setRes(data);
            onSetContexto({ tipo: 'particulas', frase, vencedora: data.vencedora });
        } catch (e: any) { alert(e.message); }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in">
            <Input placeholder="Ex: 私___学生です" value={frase} onChange={e => setFrase(e.target.value)} />
            <div className="flex items-center gap-2">
                <Input className="w-16 text-center" value={pa} onChange={e => setPa(e.target.value)} placeholder="は" />
                <span className="text-xs text-muted-foreground">vs</span>
                <Input className="w-16 text-center" value={pb} onChange={e => setPb(e.target.value)} placeholder="が" />
                <Button className="flex-1" onClick={handleRun} disabled={loading}>{loading ? '...' : 'Analisar'}</Button>
            </div>
            
            {res && !loading && (
                <div className="mt-2 flex flex-col gap-3">
                    <div className="bg-primary/10 border-l-4 border-primary p-3 rounded-r-lg">
                        <div className="font-bold text-primary mb-1">Vencedora: {res.vencedora}</div>
                        <div className="text-sm">{res.por_que_nesta_frase}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div className={`p-3 rounded-lg border ${res.vencedora === pa ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                            <div className="font-bold text-center text-lg mb-1">{pa}</div>
                            <div className="text-xs text-muted-foreground mb-2">{res.regra_geral_a}</div>
                            {res.exemplos_a?.[0] && <div className="text-xs bg-background p-1.5 rounded"><InteractiveText text={res.exemplos_a[0].jp} /></div>}
                        </div>
                        <div className={`p-3 rounded-lg border ${res.vencedora === pb ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                            <div className="font-bold text-center text-lg mb-1">{pb}</div>
                            <div className="text-xs text-muted-foreground mb-2">{res.regra_geral_b}</div>
                            {res.exemplos_b?.[0] && <div className="text-xs bg-background p-1.5 rounded"><InteractiveText text={res.exemplos_b[0].jp} /></div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToolTom({ context, session, onUsar, onSetContexto }: any) {
    const [frase, setFrase] = useState('');
    const [tom, setTom] = useState('casual');
    const [loading, setLoading] = useState(false);
    const [res, setRes] = useState<any>(null);

    const handleRun = async () => {
        if (!frase.trim()) return;
        setLoading(true); setRes(null);
        try {
            const data = await callApi('ajustar_tom', { frase_jp: frase, tom_origem: tom }, context, session);
            setRes(data);
            onSetContexto({ tipo: 'tom', original: frase, alvo: data.transformacoes?.[0]?.tom });
        } catch (e: any) { alert(e.message); }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in">
            <Input placeholder="Cole uma frase aqui..." value={frase} onChange={e => setFrase(e.target.value)} />
            <div className="flex gap-2">
                <select value={tom} onChange={e => setTom(e.target.value)} className="flex-1 bg-card border border-border rounded-md px-3 text-sm outline-none">
                    <option value="casual">Origem: Casual</option>
                    <option value="formal">Origem: Formal (Masu)</option>
                </select>
                <Button onClick={handleRun} disabled={loading}>{loading ? '...' : 'Ajustar'}</Button>
            </div>
            
            {res && !loading && (
                <div className="mt-2 flex flex-col gap-2">
                    {res.transformacoes?.map((t: any, i: number) => (
                        <div key={i} className="bg-card border border-border p-3 rounded-lg relative group">
                            <div className="font-bold text-xs text-primary mb-1 uppercase tracking-wider">{t.tom}</div>
                            <div className="text-lg pr-12"><InteractiveText text={t.jp} /></div>
                            <div className="text-xs text-muted-foreground mt-1">{t.pt}</div>
                            <div className="text-xs bg-secondary p-1.5 rounded mt-2">{t.dica}</div>
                            <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => onUsar(t.texto_puro)} title="Usar no chat">▶</Button>
                                <AnkiButton card={{ item: t.texto_puro, leitura: '', significado: t.pt, categoria: 'Gramática - Tom', jlpt: context.jlpt }} modulo="Gramatica" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ToolVerbo({ context, session, onUsar, onSetContexto }: any) {
    const [verbo, setVerbo] = useState('');
    const [loading, setLoading] = useState(false);
    const [res, setRes] = useState<any>(null);

    const handleRun = async () => {
        if (!verbo.trim()) return;
        setLoading(true); setRes(null);
        try {
            const data = await callApi('desmontar_verbo', { verbo }, context, session);
            setRes(data);
            onSetContexto({ tipo: 'verbo', verbo: data.verbo_base });
        } catch (e: any) { alert(e.message); }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in">
            <div className="flex gap-2">
                <Input placeholder="Ex: 食べる, 行く" value={verbo} onChange={e => setVerbo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRun()} />
                <Button onClick={handleRun} disabled={loading}>{loading ? '...' : 'Desmontar'}</Button>
            </div>
            
            {res && !loading && (
                <div className="mt-2">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl font-bold">{res.verbo_base}</span>
                        <span className="text-sm bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{res.grupo}</span>
                    </div>
                    
                    <div className="flex flex-col gap-1 border border-border rounded-lg overflow-hidden bg-card text-sm">
                        {res.conjugacoes?.map((c: any, i: number) => (
                            <div key={i} className="flex border-b border-border last:border-0 relative group items-center">
                                <div className="w-[85px] p-2 bg-muted/30 font-semibold text-xs border-r border-border shrink-0 text-center flex items-center justify-center">
                                    {c.forma}
                                </div>
                                <div className="p-2 flex-1 pr-12">
                                    <div className="font-medium text-[1.1em]">{c.jp}</div>
                                    <div className="text-xs text-muted-foreground">{c.pt}</div>
                                </div>
                                <div className="absolute right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card shadow-sm rounded-md p-0.5 border border-border">
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-xs hover:text-primary" onClick={() => onUsar(c.jp)}>▶</Button>
                                    <AnkiButton card={{ item: c.jp, leitura: '', significado: c.pt, categoria: `Verbo - ${c.forma}`, jlpt: context.jlpt }} modulo="Gramatica" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// ABA 3: VOCABULÁRIO
// ==========================================
function AbaVocab({ context, session, historico, onUsar }: any) {
    const [loading, setLoading] = useState(false);
    const [modo, setModo] = useState<'auto' | 'manual'>('auto');
    const [temaManual, setTemaManual] = useState('');
    const [resultado, setResultado] = useState<any>(null);

    const handleAuto = async () => {
        setLoading(true); setResultado(null); setModo('auto');
        try {
            const histResumido = historico.slice(-5).map((h: any) => ({ role: h.tipo === 'user' ? 'user' : 'assistant', content: h.texto }));
            const data = await callApi('gerar_vocab_contexto', { historico_resumido: histResumido }, context, session);
            setResultado(data);
        } catch (e: any) { alert(e.message); }
        setLoading(false);
    };

    const handleManual = async () => {
        if (!temaManual.trim()) return;
        setLoading(true); setResultado(null); setModo('manual');
        try {
            const data = await callApi('gerar_vocabulario_lote', { categoriaAlvo: temaManual, blacklist: context.vocabularioBanco?.map((v:any) => v.item) || [] }, context, session);
            if (data.novos_termos) {
                setResultado({ categorias: [{ categoria: temaManual, termos: data.novos_termos }] });
            }
        } catch (e: any) { alert(e.message); }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
                <Button onClick={handleAuto} disabled={loading || historico.length === 0} className="w-full flex gap-2">
                    <SparkleIcon /> Gerar do Contexto Atual
                </Button>
                
                <div className="flex items-center gap-2">
                    <div className="h-px bg-border flex-1" />
                    <span className="text-xs text-muted-foreground uppercase">ou</span>
                    <div className="h-px bg-border flex-1" />
                </div>
                
                <div className="flex gap-2">
                    <Input placeholder="Ex: aeroporto, família" value={temaManual} onChange={e => setTemaManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManual()} />
                    <Button variant="secondary" onClick={handleManual} disabled={loading || !temaManual.trim()}>{loading && modo === 'manual' ? '...' : 'Gerar'}</Button>
                </div>
            </div>

            {loading && <div className="text-center py-6 text-muted-foreground animate-pulse">Gerando vocabulário...</div>}
            
            {resultado && !loading && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                    {resultado.categorias?.map((cat: any, i: number) => (
                        <div key={i}>
                            <h4 className="font-bold text-sm mb-2 text-primary">{cat.categoria}</h4>
                            <div className="grid gap-2">
                                {cat.termos?.map((t: any, j: number) => (
                                    <div key={j} className="bg-card border border-border p-3 rounded-lg flex flex-col gap-1 relative group hover:border-primary/50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-lg"><InteractiveText text={t.termo} /></div>
                                                <div className="text-muted-foreground text-xs">{t.furigana || t.romaji}</div>
                                            </div>
                                            {t.jlpt && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold text-muted-foreground">{t.jlpt}</span>}
                                        </div>
                                        <div className="font-medium mt-1">{t.traducao}</div>
                                        {(t.exemplo_jp || t.exemplo_pt) && (
                                            <div className="mt-2 text-xs bg-background p-2 rounded border border-border/50">
                                                {t.exemplo_jp && <div><InteractiveText text={t.exemplo_jp} /></div>}
                                                {t.exemplo_pt && <div className="text-muted-foreground mt-0.5">{t.exemplo_pt}</div>}
                                            </div>
                                        )}
                                        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="icon" variant="secondary" className="h-6 w-6 shadow-sm" onClick={() => onUsar(t.texto_puro || t.termo?.replace(/<[^>]*>/g, ''))} title="Usar no chat">▶</Button>
                                            <AnkiButton card={{ item: t.termo, leitura: t.furigana, significado: t.traducao, categoria: cat.categoria, jlpt: t.jlpt, exemplo_jp: t.exemplo_jp, exemplo_pt: t.exemplo_pt }} modulo="Vocabulario" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const SparkleIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg>;

// ==========================================
// ABA 4: FRASES
// ==========================================
function AbaFrases({ context, session, onUsar }: any) {
    const [loading, setLoading] = useState(false);
    const [dados, setDados] = useState<any>(null);

    useEffect(() => {
        if (!dados && !loading) {
            setLoading(true);
            callApi('gerar_guia', {}, context, session)
                .then(setDados)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [context.sessionId]);

    const frases = dados?.frases_uteis || [];

    return (
        <div className="flex flex-col gap-3">
            {loading && <div className="text-center py-6 text-muted-foreground animate-pulse">Carregando guia da sessão...</div>}
            
            {!loading && frases.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">Nenhuma frase encontrada para esta sessão.</div>
            )}

            {!loading && frases.map((f: any, i: number) => {
                const textoPuro = f.jp?.replace(/<[^>]*>/g, '');
                return (
                    <div key={i} className="bg-card border border-border p-3 rounded-lg relative group shadow-sm">
                        <div className="text-[1.1em] font-semibold pr-10 mb-1"><InteractiveText text={f.jp} /></div>
                        <div className="text-sm text-muted-foreground">{f.pt}</div>
                        
                        {f.breakdown && (
                            <div className="mt-3 flex flex-wrap gap-1.5 bg-black/5 p-2 rounded">
                                {f.breakdown.map((b: any, j: number) => (
                                    <div key={j} className="text-[0.7em] bg-background border border-border px-1.5 py-0.5 rounded flex flex-col items-center">
                                        <span className="font-bold">{b.texto_jp?.replace(/<[^>]*>/g, '')}</span>
                                        <span className="text-muted-foreground">{b.traducao}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="secondary" className="h-6 w-6 shadow-sm" onClick={() => onUsar(textoPuro)} title="Usar no chat">▶</Button>
                            <AnkiButton card={{ item: f.jp, leitura: '', significado: f.pt, categoria: 'Frase Útil', jlpt: context.jlpt }} modulo="Frases" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ==========================================
// ABA 5: CHAT
// ==========================================
function AbaChat({ context, session, historico, contextoAtivo, onUsar }: any) {
    const [mensagens, setMensagens] = useState<{role: 'user'|'assistant', content: string}[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [mensagens, loading]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        
        const userMsg = input.trim();
        setInput('');
        const newHistory = [...mensagens, { role: 'user' as const, content: userMsg }];
        setMensagens(newHistory);
        setLoading(true);

        try {
            // Get last 4 turns from main dialogue history
            const histPrincipal = historico.slice(-4).map((h:any) => ({
                role: h.tipo === 'user' ? 'user' : 'assistant',
                content: h.texto
            }));

            const data = await callApi('tirar_duvida', { 
                duvida_usuario: userMsg,
                mensagem_ia_jp: historico[historico.length - 1]?.texto || '',
                historico: [...histPrincipal, ...newHistory.slice(0, -1)],
                contexto_ativo: contextoAtivo
            }, context, session);

            setMensagens([...newHistory, { role: 'assistant', content: data.resposta || 'Sem resposta.' }]);
        } catch (e: any) {
            setMensagens([...newHistory, { role: 'assistant', content: `Erro: ${e.message}` }]);
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full absolute inset-0 pt-4 pb-4 px-4">
            {contextoAtivo && (
                <div className="bg-primary/10 text-primary text-xs p-2 rounded-lg mb-3 shrink-0 flex items-start gap-2 border border-primary/20">
                    <span className="shrink-0 mt-0.5">🧠</span>
                    <div>
                        <strong>Contexto ativo:</strong> {contextoAtivo.tipo === 'explorar' ? contextoAtivo.termo : 
                                                          contextoAtivo.tipo === 'verbo' ? contextoAtivo.verbo : 
                                                          contextoAtivo.tipo === 'tom' ? contextoAtivo.original : ''}
                        <div className="opacity-80">A IA sabe o que você estava olhando nas outras abas.</div>
                    </div>
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto mb-3 pr-2 flex flex-col gap-3" ref={scrollRef}>
                {mensagens.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground my-auto opacity-60 flex flex-col items-center">
                        <MessageSquare size={32} className="mb-2 opacity-30" />
                        Tire dúvidas gramaticais, pergunte diferenças culturais ou peça para a IA formular uma frase pra você.
                    </div>
                ) : (
                    mensagens.map((m, i) => (
                        <div key={i} className={`text-sm p-3 rounded-lg max-w-[90%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground self-end rounded-br-sm' : 'bg-card border border-border text-foreground self-start rounded-bl-sm'}`}>
                            {m.content}
                        </div>
                    ))
                )}
                {loading && <div className="bg-card border border-border text-foreground self-start rounded-bl-sm p-3 text-sm rounded-lg animate-pulse">Digitando...</div>}
            </div>

            <div className="shrink-0 flex gap-2">
                <Input placeholder="Pergunte algo..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading} className="bg-card" />
                <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}><span className="text-xs">▶</span></Button>
            </div>
        </div>
    );
}

// ==========================================
// Botão ANKI UNIVERSAL
// ==========================================
function AnkiButton({ card, modulo }: { card: any, modulo: string }) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [modalOpen, setModalOpen] = useState(false);

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        setModalOpen(true);
    };

    return (
        <>
            <Button 
                size="icon" 
                variant="outline" 
                className={`h-6 w-6 bg-background shadow-sm ${status === 'success' ? 'border-green-500 text-green-500' : status === 'error' ? 'border-red-500 text-red-500' : ''}`}
                onClick={handleAdd}
                title={`Adicionar ao Anki com Preview (DialoGo::${modulo})`}
            >
                {status === 'idle' && <Plus size={12} />}
                {status === 'loading' && <span className="animate-spin text-[10px]">⏳</span>}
                {status === 'success' && <Check size={12} />}
                {status === 'error' && <span className="text-[10px]">✕</span>}
            </Button>
            {modalOpen && (
                <AnkiPreviewModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    cardInicial={card}
                    modulo={modulo}
                />
            )}
        </>
    );
}
