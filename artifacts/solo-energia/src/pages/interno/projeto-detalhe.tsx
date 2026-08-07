import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Zap, MapPin, Wallet, TrendingUp, Wrench } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { ChecklistGroups } from "@/components/checklist-groups";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  api,
  STAGES,
  STAGE_LABELS,
  CHECKLIST_TEMPLATE,
  formatBRL,
  type ProjectDetail,
  type StageId,
} from "@/lib/internal-api";

const STAGES_WITH_CHECKLIST = STAGES.filter((s) => CHECKLIST_TEMPLATE[s].length > 0);

export default function ProjetoDetalhePage() {
  const [, params] = useRoute("/interno/projetos/:id");
  const projectId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["internal-project", projectId];

  const { data, isLoading } = useQuery<ProjectDetail>({
    queryKey,
    queryFn: () => api.get<ProjectDetail>(`/internal/projects/${projectId}`),
    enabled: Number.isFinite(projectId),
  });

  const [checklistStage, setChecklistStage] = useState<StageId | null>(null);

  const stageMutation = useMutation({
    mutationFn: (stage: StageId) => api.patch(`/internal/projects/${projectId}`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["internal-projects"] });
      toast({ title: "Etapa atualizada", description: "O cliente foi notificado no portal." });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao mudar etapa", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return (
      <InternalLayout>
        <div className="space-y-4">
          <div className="h-32 bg-card rounded-2xl border border-white/5 animate-pulse" />
          <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
        </div>
      </InternalLayout>
    );
  }

  const { project, checklist, services } = data;
  const activeStage = checklistStage ?? project.stage;

  return (
    <InternalLayout>
      <Link href="/interno/pipeline">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao pipeline
        </span>
      </Link>

      <div className="bg-card border border-white/5 rounded-3xl p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display text-foreground mb-1">{project.clientName}</h1>
            <p className="text-sm text-muted-foreground">{project.clientEmail}</p>
          </div>
          <div className="w-full md:w-64">
            <label className="text-xs text-muted-foreground mb-1 block">Etapa do pipeline</label>
            <Select
              value={project.stage}
              onValueChange={(v) => stageMutation.mutate(v as StageId)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-background/50 rounded-2xl p-4">
            <Zap className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Potência</p>
            <p className="text-foreground font-medium">{project.systemPower} kWp</p>
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <MapPin className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Local</p>
            <p className="text-foreground font-medium">
              {project.city}/{project.state}
            </p>
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <Wallet className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Capex</p>
            <p className="text-foreground font-medium">{formatBRL(project.capex)}</p>
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <TrendingUp className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Receita bruta</p>
            <p className="text-foreground font-medium">{formatBRL(project.receitaBruta)}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
          {STAGES_WITH_CHECKLIST.map((s) => (
            <button
              key={s}
              onClick={() => setChecklistStage(s)}
              className={
                s === activeStage
                  ? "px-3 py-1.5 rounded-full text-xs whitespace-nowrap bg-primary/15 text-primary"
                  : "px-3 py-1.5 rounded-full text-xs whitespace-nowrap text-muted-foreground hover:text-foreground"
              }
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        <ChecklistGroups
          projectId={project.id}
          stage={activeStage}
          items={checklist.filter((i) => i.stage === activeStage)}
          invalidateKeys={[queryKey]}
        />
      </div>

      <div className="bg-card border border-white/5 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" /> Serviços vinculados
          </h2>
          <Link href="/interno/servicos">
            <Button variant="outline" size="sm">
              Ver todos
            </Button>
          </Link>
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço vinculado a este projeto.</p>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 bg-background/50 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.tipoServico ?? "—"} · {formatBRL(s.valorServico)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-foreground">{s.status}</p>
                  <p className="text-xs text-muted-foreground">{s.statusPagamento}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </InternalLayout>
  );
}
