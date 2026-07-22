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
} from "lucide-react";

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

export default function ProgressoDrawer({
  isOpen,
  onClose,
  historico = [],
  session,
  currentSessionId,
  tema,
}: ProgressoDrawerProps) {
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Real-time Session Calculations
  const userMessages = historico.filter((m) => m.role === "user");
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl">
        <SheetHeader className="p-6 pb-4 border-b border-border text-left">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <BarChart2 className="w-4 h-4" /> Desempenho e Estatísticas
          </div>
          <SheetTitle className="text-xl font-bold text-foreground">
            📊 Progresso da Sessão
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {tema ? `Cenário atual: ${tema}` : "Acompanhe seu progresso e histórico em tempo real."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
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
                <BookOpen className="w-4 h-4 text-primary" /> 🚨 Recorrência de Erros Gramaticais
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
