import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  api,
  CHECKLIST_TEMPLATE,
  type ChecklistItem,
  type StageId,
} from "@/lib/internal-api";

function AddItemInput({
  projectId,
  stage,
  checklistSlug,
  invalidateKeys,
}: {
  projectId: number;
  stage: StageId;
  checklistSlug: string;
  invalidateKeys: unknown[][];
}) {
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: () =>
      api.post<ChecklistItem>(`/internal/projects/${projectId}/checklist`, {
        stage,
        checklistSlug,
        label,
        sortOrder: 0,
      }),
    onSuccess: () => {
      setLabel("");
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao adicionar item", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex gap-2 mt-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Novo item..."
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && label.trim()) addMutation.mutate();
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        className="h-8"
        disabled={!label.trim() || addMutation.isPending}
        onClick={() => addMutation.mutate()}
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export function ChecklistGroups({
  projectId,
  stage,
  items,
  invalidateKeys,
}: {
  projectId: number;
  stage: StageId;
  items: ChecklistItem[];
  invalidateKeys: unknown[][];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const groups = CHECKLIST_TEMPLATE[stage];

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      api.patch<ChecklistItem>(`/internal/checklist/${id}`, { done }),
    onSuccess: () =>
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
    onError: (err: Error) =>
      toast({ title: "Erro ao atualizar item", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/internal/checklist/${id}`),
    onSuccess: () =>
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
    onError: (err: Error) =>
      toast({ title: "Erro ao remover item", description: err.message, variant: "destructive" }),
  });

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-2xl p-6 text-center">
        Esta etapa não possui checklists padrão. Os itens podem ser gerenciados nas etapas com
        checklist (Homologação, Planejamento, Execução, Ativação, Concluído, Pausado).
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => {
        const groupItems = items.filter((i) => i.checklistSlug === group.slug);
        const doneCount = groupItems.filter((i) => i.done).length;
        return (
          <div key={group.slug} className="bg-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
              <span className="text-xs text-muted-foreground">
                {doneCount}/{groupItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {groupItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2 group">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: item.id, done: checked === true })
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={
                        item.done
                          ? "text-sm text-muted-foreground line-through"
                          : "text-sm text-foreground"
                      }
                    >
                      {item.label}
                    </p>
                    {item.done && item.doneBy && (
                      <p className="text-[10px] text-muted-foreground">
                        {item.doneBy}
                        {item.doneAt &&
                          ` · ${new Date(item.doneAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    )}
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => deleteMutation.mutate(item.id)}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {groupItems.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum item ainda.</p>
              )}
            </div>
            <AddItemInput
              projectId={projectId}
              stage={stage}
              checklistSlug={group.slug}
              invalidateKeys={invalidateKeys}
            />
          </div>
        );
      })}
    </div>
  );
}
