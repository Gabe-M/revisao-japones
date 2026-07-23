import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import InteractiveText from "@/components/InteractiveText";
import {
  BarChart2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  History,
  Award,
  BookOpen,
  Share2,
  Activity,
  Flame,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { adicionarAoAnki } from "../services/ankiService";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

export interface ProgressoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  historico: any[];
  session?: any;
  currentSessionId?: string;
  tema?: string;
}

export interface GrammarErrorAggregated {
  regra: string;
  count: number;
  explicacao?: string;
  exemploCorreto?: string;
}

export function aggregateGrammarErrors(historico: any[]): GrammarErrorAggregated[] {
  const map: Record<string, GrammarErrorAggregated> = {};

  if (!Array.isArray(historico)) return [];

  historico.forEach((msg) => {
    const detailed = msg.erros_detalhados || msg.analisePratica?.erros_detalhados;
    const simple = msg.erros || msg.analisePratica?.erros;

    if (Array.isArray(detailed) && detailed.length > 0) {
      detailed.forEach((item: any) => {
        const key = item.regra_gramatical || item.erro || "Erro Gramatical";
        if (!map[key]) {
          map[key] = {
            regra: key,
            count: 0,
            explicacao: item.explicacao,
            exemploCorreto: item.exemplo_correto || item.exemploCorreto,
          };
        }
        map[key].count += 1;
        if (!map[key].explicacao && item.explicacao) {
          map[key].explicacao = item.explicacao;
        }
        if (
          !map[key].exemploCorreto &&
          (item.exemplo_correto || item.exemploCorreto)
        ) {
          map[key].exemploCorreto = item.exemplo_correto || item.exemploCorreto;
        }
      });
    } else if (Array.isArray(simple) && simple.length > 0) {
      simple.forEach((err: any) => {
        if (typeof err === "string" && err.trim()) {
          const key = err.trim();
          if (!map[key]) {
            map[key] = {
              regra: key,
              count: 0,
            };
          }
          map[key].count += 1;
        }
      });
    }
  });

  return Object.values(map).sort((a, b) => b.count - a.count);
}

// ----------------------------------------------------
// Longitudinal Stats & Chart Helper Functions
// ----------------------------------------------------
function calculateLongitudinalStats(pastSessions: any[], currentHistorico: any[]) {
  const allHistories: any[] = [];

  if (Array.isArray(currentHistorico) && currentHistorico.length > 0) {
    allHistories.push({ historico: currentHistorico, created_at: new Date().toISOString(), tema: 'Sessão Ativa' });
  }

  if (Array.isArray(pastSessions)) {
    pastSessions.forEach(s => {
      if (Array.isArray(s.historico) && s.historico.length > 0) {
        allHistories.push(s);
      }
    });
  }

  const allUserMsgs: any[] = [];
  const sessionPoints: { label: string; date: string; score: number; turns: number }[] = [];

  allHistories.forEach((sess, idx) => {
    const msgs = (sess.historico || []).filter((m: any) => m.role === 'user' || m.tipo === 'user');
    const validScores = msgs.map((m: any) => m.score).filter((s: any): s is number => typeof s === 'number' && !isNaN(s));
    
    if (validScores.length > 0) {
      const avg = Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length);
      sessionPoints.push({
        label: sess.nome || sess.config?.tema || sess.tema || `Sessão ${idx + 1}`,
        date: sess.created_at || '',
        score: avg,
        turns: msgs.length
      });
    }

    msgs.forEach((m: any) => allUserMsgs.push(m));
  });

  const allScores = allUserMsgs.map(m => m.score).filter((s): s is number => typeof s === 'number' && !isNaN(s));
  const globalMedia = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

  let trend = 0;
  if (allScores.length >= 4) {
    const half = Math.floor(allScores.length / 2);
    const firstHalfAvg = allScores.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondHalfAvg = allScores.slice(half).reduce((a, b) => a + b, 0) / (allScores.length - half);
    trend = Math.round(secondHalfAvg - firstHalfAvg);
  }

  const longitudinalErrors = aggregateGrammarErrors(allUserMsgs);

  return {
    totalSessionsCount: Math.max(allHistories.length, pastSessions.length),
    totalTurnsCount: allUserMsgs.length,
    globalMedia,
    trend,
    sessionPoints: sessionPoints.reverse(),
    longitudinalErrors
  };
}

function ScoreTrendChart({ points }: { points: { label: string; date: string; score: number; turns: number }[] }) {
  if (!points || points.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-xs text-muted-foreground bg-muted/20 rounded-xl">
        Poucos dados para gerar gráfico longitudinal. Continue praticando!
      </div>
    );
  }

  const width = 340;
  const height = 110;
  const padding = 20;

  const minScore = 0;
  const maxScore = 100;

  const pointCoords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.score - minScore) / (maxScore - minScore)) * (height - 2 * padding);
    return { x, y, point: p };
  });

  const pathD = pointCoords.reduce((acc, coord, i) => {
    return i === 0 ? `M ${coord.x} ${coord.y}` : `${acc} L ${coord.x} ${coord.y}`;
  }, "");

  const areaD = pointCoords.length > 0
    ? `${pathD} L ${pointCoords[pointCoords.length - 1].x} ${height - padding} L ${pointCoords[0].x} ${height - padding} Z`
    : "";

  return (
    <Card className="p-3.5 bg-card border border-border shadow-xs flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" /> Curva de Aprendizado (Scores %)
        </span>
        <span className="font-bold text-primary">{points.length} sessões</span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.15" />

          <path d={areaD} fill="currentColor" className="text-primary/10" />
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary" />

          {pointCoords.map((c, i) => (
            <g key={i} className="group cursor-pointer">
              <circle cx={c.x} cy={c.y} r="4" className="fill-primary stroke-background stroke-2 transition-all group-hover:r-6" />
              <title>{`${c.point.label}: ${c.point.score}% (${c.point.turns} turnos)`}</title>
            </g>
          ))}
        </svg>
      </div>
    </Card>
  );
}

export default function ProgressoDrawer({
  isOpen,
  onClose,
  historico = [],
  session,
  currentSessionId,
  tema,
}: ProgressoDrawerProps) {
  const [viewTab, setViewTab] = useState<'ativa' | 'longitudinal'>('ativa');
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [syncingAnki, setSyncingAnki] = useState(false);
  const [ankiSyncedCount, setAnkiSyncedCount] = useState<number | null>(null);

  // Real-time Session Calculations
  const userMessages = historico.filter((m) => m.role === "user" || m.tipo === "user");
  const totalTurnos = userMessages.length;

  const scores = userMessages
    .map((m) => m.score)
    .filter((s): s is number => typeof s === "number" && !isNaN(s));

  const mediaScore =
    scores.length > 0
      ? Math.round(scores.reduce((acc, curr) => acc + curr, 0) / scores.length)
      : 0;

  const excelenteCount = scores.filter((s) => s >= 80).length;
  const regularCount = scores.filter((s) => s >= 50 && s < 80).length;
  const atencaoCount = scores.filter((s) => s < 50).length;

  const aggregatedErrors = aggregateGrammarErrors(historico);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSessions = async () => {
      if (!session?.access_token) {
        setPastSessions([]);
        return;
      }

      setLoadingSessions(true);
      setSessionError(null);
      try {
        const res = await fetch("/api/dialogo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ acao: "listar_sessoes" }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Erro ${res.status}`);
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          setPastSessions(data);
        }
      } catch (err: any) {
        console.error("Erro ao carregar sessões anteriores:", err);
        setSessionError(err.message || "Erro ao carregar histórico");
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [isOpen, session?.access_token]);

  const longitudinal = calculateLongitudinalStats(pastSessions, historico);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl">
        <SheetHeader className="p-6 pb-3 border-b border-border text-left">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <BarChart2 className="w-4 h-4" /> Desempenho e Estatísticas
          </div>
          <SheetTitle className="text-xl font-bold text-foreground">
            📊 Progresso pedagógico
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {tema ? `Cenário: ${tema}` : "Acompanhe suas estatísticas de aprendizado."}
          </SheetDescription>

          {/* Toggle Tab Sessão Ativa vs Longitudinal */}
          <div className="flex border border-border rounded-xl p-1 bg-muted/30 mt-3">
            <button
              onClick={() => setViewTab('ativa')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${viewTab === 'ativa' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              📊 Sessão Ativa
            </button>
            <button
              onClick={() => setViewTab('longitudinal')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${viewTab === 'longitudinal' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              📈 Progresso Longitudinal
            </button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {viewTab === 'ativa' ? (
            <div className="flex flex-col gap-6 pr-1">
              {/* Section 1: Session Performance Overview */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" /> Resumo da Sessão Ativa
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Card className="p-4 bg-muted/30 border border-border flex flex-col justify-center">
                    <span className="text-xs text-muted-foreground font-medium">Total de Turnos</span>
                    <span className="text-2xl font-bold text-foreground mt-1">
                      {totalTurnos} <span className="text-xs font-normal text-muted-foreground">interações</span>
                    </span>
                  </Card>
                  <Card className="p-4 bg-muted/30 border border-border flex flex-col justify-center">
                    <span className="text-xs text-muted-foreground font-medium">Pontuação Média</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span
                        className={`text-2xl font-bold ${
                          mediaScore >= 80
                            ? "text-emerald-500"
                            : mediaScore >= 50
                            ? "text-amber-500"
                            : "text-rose-500"
                        }`}
                      >
                        {mediaScore}%
                      </span>
                    </div>
                  </Card>
                </div>

                {/* Quality Distribution Breakdown */}
                <Card className="p-4 bg-muted/20 border border-border">
                  <span className="text-xs font-semibold text-muted-foreground block mb-2">
                    Qualidade das Respostas
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Excelente (≥80%)
                      </span>
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        {excelenteCount}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col items-center">
                      <TrendingUp className="w-4 h-4 text-amber-500 mb-1" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Regular (50-79%)
                      </span>
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        {regularCount}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 flex flex-col items-center">
                      <AlertTriangle className="w-4 h-4 text-rose-500 mb-1" />
                      <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        Atenção (&lt;50%)
                      </span>
                      <span className="text-lg font-bold text-rose-700 dark:text-rose-300">
                        {atencaoCount}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Section 2: Grammar Errors Recurrence */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> 🚨 Recorrência de Erros na Sessão
                </h3>
                {aggregatedErrors.length === 0 ? (
                  <Card className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium m-0 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Nenhum erro gramatical registrado nesta sessão! 🎉
                    </p>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {aggregatedErrors.map((item, idx) => (
                      <Card key={idx} className="p-3.5 bg-card border border-border shadow-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            {item.regra}
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold shrink-0">
                            {item.count}x
                          </span>
                        </div>

                        {item.explicacao && (
                          <p className="text-xs text-muted-foreground mt-1.5 mb-1 pl-4 border-l-2 border-primary/30">
                            {item.explicacao}
                          </p>
                        )}

                        {item.exemploCorreto && (
                          <div className="mt-2 text-xs bg-muted/40 p-2 rounded-md font-mono text-foreground flex items-center gap-1.5">
                            <span className="text-emerald-500 font-bold">✓ Correto:</span>
                            <InteractiveText text={item.exemploCorreto} />
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2.5: Anki Export & Sync */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-purple-500" /> Exportação & Sincronização Anki
                </h3>
                <Card className="p-3.5 bg-card border border-border shadow-xs flex flex-col gap-2.5">
                  <p className="text-xs text-muted-foreground m-0">
                    Exporte erros recorrentes desta sessão ou sincronize seus cartões com o baralho <span className="font-semibold text-foreground">DialoGo::Erros</span> no Anki.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncingAnki || aggregatedErrors.length === 0}
                      onClick={async () => {
                        setSyncingAnki(true);
                        let successCount = 0;
                        try {
                          for (const errItem of aggregatedErrors) {
                            if (errItem.exemploCorreto) {
                              await adicionarAoAnki({
                                item: errItem.regra,
                                leitura: '',
                                significado: errItem.explicacao || 'Regra Gramatical',
                                categoria: 'Gramática',
                                jlpt: 'N5',
                                exemplo_jp: errItem.exemploCorreto,
                                exemplo_pt: errItem.regra
                              }, 'Erros');
                              successCount++;
                            }
                          }
                          toast({
                            title: "🎴 Exportação Concluída",
                            description: `${successCount} erros exportados para o Anki (DialoGo::Erros)!`,
                          });
                        } catch (err: any) {
                          toast({
                            title: "Erro na Exportação Anki",
                            description: "Certifique-se de que o Anki está aberto com o AnkiConnect habilitado.",
                            variant: "destructive",
                          });
                        } finally {
                          setSyncingAnki(false);
                        }
                      }}
                      className="text-xs font-semibold h-8 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      {syncingAnki ? 'Exportando Erros...' : '🎴 Exportar Erros para o Anki'}
                    </Button>

                    {session?.access_token && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={syncingAnki}
                        onClick={async () => {
                          setSyncingAnki(true);
                          try {
                            const res = await fetch('/api/anki?acao=listar', {
                              headers: { Authorization: `Bearer ${session.access_token}` }
                            });
                            if (res.ok) {
                              const cards = await res.json();
                              setAnkiSyncedCount(Array.isArray(cards) ? cards.length : 0);
                              toast({
                                title: "Nuvem Anki",
                                description: `${Array.isArray(cards) ? cards.length : 0} cartões sincronizados no Supabase.`,
                              });
                            }
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setSyncingAnki(false);
                          }
                        }}
                        className="text-xs h-8"
                      >
                        ☁️ Sincronizar Nuvem
                      </Button>
                    )}
                  </div>
                  {ankiSyncedCount !== null && (
                    <span className="text-[11px] text-emerald-500 font-medium">
                      ✓ {ankiSyncedCount} cartões sincronizados na nuvem Supabase.
                    </span>
                  )}
                </Card>
              </div>

              {/* Section 3: Supabase Past User Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Histórico de Sessões
                </h3>

                {!session?.access_token ? (
                  <Card className="p-4 bg-muted/20 border border-border text-center">
                    <p className="text-xs text-muted-foreground m-0">
                      Faça login para salvar e visualizar seu histórico de sessões anteriores no Supabase.
                    </p>
                  </Card>
                ) : loadingSessions ? (
                  <Card className="p-4 bg-muted/20 border border-border text-center">
                    <p className="text-xs text-muted-foreground m-0 animate-pulse flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-spin" /> Carregando histórico de sessões...
                    </p>
                  </Card>
                ) : sessionError ? (
                  <Card className="p-4 bg-rose-500/10 border border-rose-500/20 text-center">
                    <p className="text-xs text-rose-500 font-medium m-0">{sessionError}</p>
                  </Card>
                ) : pastSessions.length === 0 ? (
                  <Card className="p-4 bg-muted/20 border border-border text-center">
                    <p className="text-xs text-muted-foreground m-0">Nenhuma sessão anterior encontrada.</p>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pastSessions.map((sess) => {
                      const isCurrent = sess.id === currentSessionId;
                      const dateStr = sess.created_at
                        ? new Date(sess.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";

                      return (
                        <Card
                          key={sess.id}
                          className={`p-3 bg-card border ${
                            isCurrent
                              ? "border-primary bg-primary/5 shadow-xs"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground truncate max-w-[200px]">
                              {sess.nome || sess.config?.tema || "Sessão de Diálogo"}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase">
                                Sessão Atual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                            <span>JLPT: {sess.config?.jlpt || "N/A"}</span>
                            <span>{dateStr}</span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* LONGITUDINAL PROGRESS TAB */
            <div className="flex flex-col gap-6 pr-1">
              {/* Longitudinal Overview Cards */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" /> Estatísticas Globais Acumuladas
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Card className="p-4 bg-muted/30 border border-border flex flex-col justify-center">
                    <span className="text-xs text-muted-foreground font-medium">Sessões Totais</span>
                    <span className="text-2xl font-bold text-foreground mt-1">
                      {longitudinal.totalSessionsCount} <span className="text-xs font-normal text-muted-foreground">praticadas</span>
                    </span>
                  </Card>
                  <Card className="p-4 bg-muted/30 border border-border flex flex-col justify-center">
                    <span className="text-xs text-muted-foreground font-medium">Média Geral Longitudinal</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-primary">
                        {longitudinal.globalMedia}%
                      </span>
                      {longitudinal.trend !== 0 && (
                        <span className={`text-xs font-bold flex items-center ${longitudinal.trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {longitudinal.trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {longitudinal.trend > 0 ? `+${longitudinal.trend}%` : `${longitudinal.trend}%`}
                        </span>
                      )}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Longitudinal Score Evolution Chart */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Tendência de Evolução das Notas
                </h3>
                <ScoreTrendChart points={longitudinal.sessionPoints} />
              </div>

              {/* Mapa de Calor de Erros Recorrentes Longitudinais */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Mapa de Erros Recorrentes (Todas as Sessões)
                </h3>

                {longitudinal.longitudinalErrors.length === 0 ? (
                  <Card className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium m-0 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Histórico limpo! Nenhum erro gramatical recorrente acumulado. 🎉
                    </p>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {longitudinal.longitudinalErrors.map((item, idx) => {
                      const totalErrCount = longitudinal.longitudinalErrors.reduce((acc, curr) => acc + curr.count, 0);
                      const percent = totalErrCount > 0 ? Math.round((item.count / totalErrCount) * 100) : 0;

                      return (
                        <Card key={idx} className="p-3.5 bg-card border border-border shadow-xs flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground truncate max-w-[240px]">
                              {item.regra}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold">
                                {item.count}x
                              </span>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                ({percent}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar heatmap */}
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full transition-all"
                              style={{ width: `${Math.min(percent * 2, 100)}%` }}
                            />
                          </div>

                          {item.explicacao && (
                            <p className="text-xs text-muted-foreground mt-1 pl-3 border-l-2 border-primary/30">
                              {item.explicacao}
                            </p>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
