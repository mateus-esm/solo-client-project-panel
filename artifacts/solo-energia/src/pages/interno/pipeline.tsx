import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Zap, MapPin } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  STAGE_GROUPS,
  formatBRL,
  type InternalProject,
  type StageId,
} from "@/lib/internal-api";

function StageSelect({
  value,
  onChange,
  className,
}: {
  value: StageId;
  onChange: (stage: StageId) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StageId)}>
      <SelectTrigger className={className ?? "h-8 text-xs"} onClick={(e) => e.stopPropagation()}>
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
  );
}

function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    city: "",
    state: "",
    systemPower: "",
    capex: "",
    stage: "onboarding" as StageId,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<InternalProject>("/internal/projects", {
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        city: form.city,
        state: form.state,
        systemPower: Number(form.systemPower) || 0,
        capex: form.capex ? Number(form.capex) : null,
        stage: form.stage,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-projects"] });
      toast({ title: "Projeto criado" });
      setOpen(false);
      setForm({ clientName: "", clientEmail: "", city: "", state: "", systemPower: "", capex: "", stage: "onboarding" });
    },
    onError: (err: Error) => toast({ title: "Erro ao criar projeto", description: err.message, variant: "destructive" }),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Novo Projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do cliente</Label>
            <Input value={form.clientName} onChange={set("clientName")} placeholder="Ex.: Haras BS Chica Doce" />
          </div>
          <div>
            <Label>E-mail do cliente</Label>
            <Input type="email" value={form.clientEmail} onChange={set("clientEmail")} placeholder="cliente@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cidade</Label>
              <Input value={form.city} onChange={set("city")} placeholder="Fortaleza" />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={form.state} onChange={set("state")} maxLength={2} placeholder="CE" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Potência (kWp)</Label>
              <Input type="number" value={form.systemPower} onChange={set("systemPower")} placeholder="8.5" />
            </div>
            <div>
              <Label>Capex (R$)</Label>
              <Input type="number" value={form.capex} onChange={set("capex")} placeholder="45000" />
            </div>
          </div>
          <div>
            <Label>Etapa inicial</Label>
            <StageSelect value={form.stage} onChange={(stage) => setForm((f) => ({ ...f, stage }))} className="h-10" />
          </div>
          <Button
            className="w-full"
            disabled={!form.clientName || !form.clientEmail || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Criando..." : "Criar projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PipelinePage() {
  const { data: projects, isLoading } = useQuery<InternalProject[]>({
    queryKey: ["internal-projects"],
    queryFn: () => api.get<InternalProject[]>("/internal/projects"),
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: StageId }) =>
      api.patch<InternalProject>(`/internal/projects/${id}`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-projects"] }),
    onError: (err: Error) =>
      toast({ title: "Erro ao mover projeto", description: err.message, variant: "destructive" }),
  });

  return (
    <InternalLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground">Pipeline de Projetos</h1>
          <p className="text-sm text-muted-foreground">
            {projects?.length ?? 0} projetos no funil
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-72 h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 md:-mx-8 md:px-8 items-stretch">
          {STAGE_GROUPS.map((group) => {
            const columns = group.stages.map((stage) => ({
              stage,
              items: (projects ?? []).filter((p) => p.stage === stage),
            }));
            const content = (
              <div className="flex gap-4">
                {columns.map(({ stage, items }) => (
                  <div key={stage} className="w-72 shrink-0">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h2 className="text-sm font-medium text-foreground">{STAGE_LABELS[stage]}</h2>
                      <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-3 min-h-24">
                      {items.map((p) => (
                        <Link key={p.id} href={`/interno/projetos/${p.id}`}>
                          <div className="bg-card border border-white/5 rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors space-y-3">
                            <p className="font-medium text-foreground leading-tight">{p.clientName}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-primary" /> {p.systemPower} kWp
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {p.city}/{p.state}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">Capex: {formatBRL(p.capex)}</p>
                            <div onClick={(e) => e.preventDefault()}>
                              <StageSelect
                                value={p.stage}
                                onChange={(newStage) => stageMutation.mutate({ id: p.id, stage: newStage })}
                              />
                            </div>
                          </div>
                        </Link>
                      ))}
                      {items.length === 0 && (
                        <div className="border border-dashed border-white/10 rounded-2xl p-4 text-center text-xs text-muted-foreground">
                          Vazio
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
            if (!group.title) {
              return <div key={group.id} className="shrink-0">{content}</div>;
            }
            return (
              <div key={group.id} className="shrink-0 rounded-3xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-primary mb-2 px-1">
                  {group.title} <span className="text-muted-foreground normal-case tracking-normal">· subetapas em paralelo</span>
                </p>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </InternalLayout>
  );
}
