import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { cn } from "@/lib/utils";
import { api, formatBRL, type FinanceSummary } from "@/lib/internal-api";

const FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "a_vencer", label: "A vencer" },
  { id: "atrasadas", label: "Atrasadas" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function FinanceiroGeralPage() {
  const [filter, setFilter] = useState<FilterId>("todas");

  const { data, isLoading } = useQuery<FinanceSummary>({
    queryKey: ["internal-finance-summary"],
    queryFn: () => api.get<FinanceSummary>("/internal/finance/summary"),
  });

  const totals = data?.totals;
  const installments = (data?.openInstallments ?? []).filter((i) =>
    filter === "todas" ? true : filter === "atrasadas" ? i.overdue : !i.overdue,
  );

  const cards = [
    { label: "Receita bruta", value: totals?.receitaBruta, icon: TrendingUp, className: "text-foreground" },
    { label: "Custos", value: totals?.custos, icon: TrendingDown, className: "text-foreground" },
    {
      label: "Receita líquida",
      value: totals?.receitaLiquida,
      icon: Wallet,
      className: (totals?.receitaLiquida ?? 0) >= 0 ? "text-green-400" : "text-red-400",
    },
    { label: "Recebido", value: totals?.recebido, icon: CheckCircle2, className: "text-green-400" },
    { label: "A receber", value: totals?.aReceber, icon: Clock, className: "text-primary" },
    { label: "Atrasado", value: totals?.atrasado, icon: AlertTriangle, className: "text-red-400" },
  ];

  return (
    <InternalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de {data?.projectCount ?? "—"} projetos
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Icon className="w-3.5 h-3.5" /> {c.label}
              </div>
              {isLoading ? (
                <div className="h-6 w-24 bg-white/5 rounded animate-pulse" />
              ) : (
                <p className={cn("text-lg font-semibold tabular-nums", c.className)}>
                  {formatBRL(c.value ?? 0)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-display text-foreground">Parcelas em aberto</h2>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs transition-colors",
                filter === f.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground bg-white/5",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      ) : installments.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Nenhuma parcela em aberto.</p>
        </div>
      ) : (
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Projeto</th>
                  <th className="px-4 py-3 font-medium">Parcela</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => (
                  <tr key={i.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/interno/projetos/${i.projectId}`}>
                        <span className="text-foreground hover:text-primary cursor-pointer">
                          {i.clientName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {i.description ?? `Parcela ${i.installmentNumber}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(i.dueDate)}</td>
                    <td className="px-4 py-3 text-foreground tabular-nums">{formatBRL(i.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                          i.overdue
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-primary/15 text-primary border-primary/30",
                        )}
                      >
                        {i.overdue ? "Atrasada" : "A vencer"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </InternalLayout>
  );
}
