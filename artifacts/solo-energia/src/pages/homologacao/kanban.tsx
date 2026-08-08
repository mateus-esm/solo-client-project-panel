import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Columns3, Loader2, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { HomologacaoLayout } from "@/components/homologacao-layout";
import { useToast } from "@/hooks/use-toast";
import {
  KANBAN_STAGES,
  KANBAN_LABELS,
  homologacaoGet,
  homologacaoPatch,
  type KanbanProject,
  type KanbanStage,
} from "@/lib/homologacao-api";

export default function HomologacaoKanbanPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery<KanbanProject[]>({
    queryKey: ["homologacao-kanban"],
    queryFn: () => homologacaoGet<KanbanProject[]>("/homologacao/kanban"),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, kanbanStage }: { id: number; kanbanStage: KanbanStage }) =>
      homologacaoPatch(`/homologacao/projects/${id}/processo`, { kanbanStage }),
    // Optimistic move so the card slides immediately.
    onMutate: async ({ id, kanbanStage }) => {
      await queryClient.cancelQueries({ queryKey: ["homologacao-kanban"] });
      const prev = queryClient.getQueryData<KanbanProject[]>(["homologacao-kanban"]);
      queryClient.setQueryData<KanbanProject[]>(["homologacao-kanban"], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, kanbanStage } : p))
      );
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["homologacao-kanban"], ctx.prev);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["homologacao-kanban"] }),
  });

  function move(p: KanbanProject, dir: -1 | 1) {
    const idx = KANBAN_STAGES.indexOf(p.kanbanStage);
    const next = KANBAN_STAGES[idx + dir];
    if (next) moveMutation.mutate({ id: p.id, kanbanStage: next });
  }

  return (
    <HomologacaoLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
          <Columns3 className="w-5 h-5 text-primary" /> Kanban
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Etapas internas do processo de homologação
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
          {KANBAN_STAGES.map((stage, stageIdx) => {
            const cards = (projects ?? []).filter((p) => p.kanbanStage === stage);
            return (
              <div key={stage} className="w-64 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {KANBAN_LABELS[stage]}
                  </p>
                  <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-24 bg-white/[0.02] rounded-2xl p-2">
                  {cards.map((p) => (
                    <div
                      key={p.id}
                      className="bg-card border border-white/5 rounded-xl p-3 group"
                    >
                      <Link href={`/homologacao/projetos/${p.id}`} className="block">
                          <p className="text-sm text-foreground font-medium truncate hover:text-primary transition-colors">
                            {p.clientName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-primary" /> {p.systemPower} kWp
                            </span>
                            <span>
                              {p.city}/{p.state}
                            </span>
                          </p>
                                              </Link>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            p.artPaga
                              ? "bg-green-500/10 text-green-400"
                              : "bg-yellow-500/10 text-yellow-400"
                          }`}
                        >
                          ART {p.artPaga ? "paga" : "pendente"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => move(p, -1)}
                            disabled={stageIdx === 0 || moveMutation.isPending}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-20"
                            title="Etapa anterior"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => move(p, 1)}
                            disabled={stageIdx === KANBAN_STAGES.length - 1 || moveMutation.isPending}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-20"
                            title="Próxima etapa"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HomologacaoLayout>
  );
}
