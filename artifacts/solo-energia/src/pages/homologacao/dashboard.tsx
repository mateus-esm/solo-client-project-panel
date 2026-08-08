import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  LayoutDashboard,
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Calendar,
  ChevronRight,
  Zap,
  MapPin,
} from "lucide-react";
import { HomologacaoLayout } from "@/components/homologacao-layout";
import { homologacaoGet, type DashboardData, KANBAN_LABELS } from "@/lib/homologacao-api";

const STAGE_LABELS: Record<string, string> = {
  homologacao: "Homologação",
  pendencias: "Pendências",
  pausado: "Pausado",
};

const DEADLINE_LABELS: Record<string, string> = {
  ...KANBAN_LABELS,
  conclusao: "Conclusão prevista",
};

function formatDate(d: string): string {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <div className="bg-card border border-white/5 rounded-2xl p-4">
      <Icon className={`w-4 h-4 mb-2 ${tone ?? "text-primary"}`} />
      <p className="text-2xl font-display text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function HomologacaoDashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["homologacao-dashboard"],
    queryFn: () => homologacaoGet<DashboardData>("/homologacao/dashboard"),
  });

  return (
    <HomologacaoLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" /> Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral dos seus projetos de homologação
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="Total atribuídos" value={data.totals.total} icon={ClipboardCheck} />
            <StatCard label="Em andamento" value={data.totals.emAndamento} icon={Loader2} />
            <StatCard
              label="Com pendências"
              value={data.totals.comPendencias}
              icon={AlertTriangle}
              tone="text-yellow-400"
            />
            <StatCard
              label="Concluídos"
              value={data.totals.concluidos}
              icon={CheckCircle2}
              tone="text-green-400"
            />
            <StatCard
              label="ART pendente"
              value={data.totals.artPendentes}
              icon={FileWarning}
              tone="text-orange-400"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-card border border-white/5 rounded-3xl p-6">
              <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-primary" /> Próximos prazos
              </h2>
              {data.upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum prazo cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {data.upcomingDeadlines.map((d, i) => {
                    const overdue = new Date(`${d.date}T23:59:59`) < new Date();
                    return (
                      <Link key={i} href={`/homologacao/projetos/${d.projectId}`}>
                        <a className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3 hover:bg-background/80 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{d.clientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {DEADLINE_LABELS[d.label] ?? d.label}
                            </p>
                          </div>
                          <span
                            className={`text-xs shrink-0 ${
                              overdue ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {overdue ? "Vencido · " : ""}
                            {formatDate(d.date)}
                          </span>
                        </a>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-card border border-white/5 rounded-3xl p-6">
              <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-4 h-4 text-primary" /> Projetos ativos
              </h2>
              {data.recentProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum projeto ativo.</p>
              ) : (
                <div className="space-y-2">
                  {data.recentProjects.map((p) => (
                    <Link key={p.id} href={`/homologacao/projetos/${p.id}`}>
                      <a className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3 hover:bg-background/80 transition-colors group">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{p.clientName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-primary" /> {p.systemPower} kWp
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {p.city}/{p.state}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {STAGE_LABELS[p.stage] ?? p.stage}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </HomologacaoLayout>
  );
}
