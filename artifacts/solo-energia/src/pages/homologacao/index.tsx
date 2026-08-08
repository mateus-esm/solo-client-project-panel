import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ClipboardCheck,
  Zap,
  MapPin,
  Calendar,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { HomologacaoLayout } from "@/components/homologacao-layout";
import type { InternalProject } from "@/lib/internal-api";

const STAGE_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  projeto_homologacao: "Projeto Técnico e Homologação",
  planejamento_execucao: "Pré-execução",
  execucao: "Execução",
  ativacao: "Ativação",
  comissionamento_treinamento: "Comissionamento",
  concluido: "Concluído",
  pendencias: "Pendências",
  pausado: "Pausado",
};

async function fetchProjects(): Promise<InternalProject[]> {
  const res = await fetch("/api/homologacao/projects", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

function deadlineLabel(project: InternalProject): string | null {
  const raw =
    project.estimatedActivation ??
    (project as any).dataConclusaoPrevista ??
    (project as any).estimatedDate;
  if (!raw) return null;
  return raw;
}

function isOverdue(dateStr: string): boolean {
  try {
    return new Date(dateStr) < new Date();
  } catch {
    return false;
  }
}

export default function HomologacaoProjectsPage() {
  const { data: projects, isLoading, error } = useQuery<InternalProject[]>({
    queryKey: ["homologacao-projects"],
    queryFn: fetchProjects,
    retry: false,
  });

  return (
    <HomologacaoLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" /> Projetos em Homologação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Projetos elétricos em trâmite com a concessionária
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-card rounded-2xl border border-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="border border-dashed border-destructive/30 rounded-3xl p-12 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Erro ao carregar projetos.</p>
        </div>
      ) : (projects ?? []).length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-muted-foreground">Nenhum projeto em homologação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(projects ?? []).map((p) => {
            const deadline = deadlineLabel(p);
            const overdue = deadline ? isOverdue(deadline) : false;
            return (
              <Link key={p.id} href={`/homologacao/projetos/${p.id}`} className="block bg-card border border-white/5 rounded-2xl px-5 py-4 hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
                        {p.clientName}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-primary" />
                          {p.systemPower} kWp
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {p.city}/{p.state}
                        </span>
                        {deadline && (
                          <span
                            className={`flex items-center gap-1 ${
                              overdue ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {overdue ? "Vencido · " : ""}
                            {deadline}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        {STAGE_LABELS[p.stage] ?? p.stage}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                              </Link>
            );
          })}
        </div>
      )}
    </HomologacaoLayout>
  );
}
