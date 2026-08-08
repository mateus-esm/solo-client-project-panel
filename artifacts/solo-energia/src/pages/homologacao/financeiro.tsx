import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Wallet, Loader2, CheckCircle2, Clock } from "lucide-react";
import { HomologacaoLayout } from "@/components/homologacao-layout";
import { homologacaoGet, type FinanceiroData } from "@/lib/homologacao-api";

const formatBRL = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STAGE_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  projeto_tecnico_homologacao: "Projeto Técnico e Homologação",
  planejamento_execucao: "Planej. de Execução",
  execucao: "Execução",
  ativacao: "Ativação",
  comissionamento_treinamento: "Comissionamento",
  concluido: "Concluído",
  pendencias: "Pendências",
  pausado: "Pausado",
};

export default function HomologacaoFinanceiroPage() {
  const { data, isLoading } = useQuery<FinanceiroData>({
    queryKey: ["homologacao-financeiro"],
    queryFn: () => homologacaoGet<FinanceiroData>("/homologacao/financeiro"),
  });

  return (
    <HomologacaoLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Financeiro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seus honorários de homologação — recebidos e a receber
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-card border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Recebido</p>
              <p className="text-2xl font-display text-green-400">
                {formatBRL(data.totals.recebido)}
              </p>
            </div>
            <div className="bg-card border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-muted-foreground mb-1">A receber</p>
              <p className="text-2xl font-display text-yellow-400">
                {formatBRL(data.totals.aReceber)}
              </p>
            </div>
            <div className="bg-card border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-2xl font-display text-foreground">
                {formatBRL(data.totals.total)}
              </p>
            </div>
          </div>

          <div className="bg-card border border-white/5 rounded-3xl p-6">
            <h2 className="text-sm font-medium text-foreground mb-4">Por projeto</h2>
            {data.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum projeto atribuído.</p>
            ) : (
              <div className="space-y-2">
                {data.projects.map((p) => (
                  <Link key={p.id} href={`/homologacao/projetos/${p.id}`} className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3 hover:bg-background/80 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{p.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {STAGE_LABELS[p.stage] ?? p.stage}
                          {p.formaPagamento ? ` · ${p.formaPagamento}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-foreground font-medium">{formatBRL(p.valor)}</p>
                        <p
                          className={`text-xs flex items-center gap-1 justify-end ${
                            p.pago ? "text-green-400" : "text-yellow-400"
                          }`}
                        >
                          {p.pago ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Pago
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> A receber
                            </>
                          )}
                        </p>
                      </div>
                                      </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </HomologacaoLayout>
  );
}
