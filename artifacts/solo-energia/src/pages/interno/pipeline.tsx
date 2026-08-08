import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Zap, MapPin, ShoppingCart } from "lucide-react";
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
  SUB_STAGES,
  supplyBadge,
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

  const subStageMutation = useMutation({
    mutationFn: ({ id, subStage }: { id: number; subStage: string | null }) =>
      api.patch<InternalProject>(`/internal/projects/${id}`, { subStage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-projects"] }),
    onError: (err: Error) =>
      toast({ title: "Erro ao mudar sub-etapa", description: err.message, variant: "destructive" }),
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
          {STAGES.map((stage) => {
            const items = (projects ?? []).filter((p) => p.stage === stage);
            const subs = SUB_STAGES[stage];
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-sm font-medium text-foreground">{STAGE_LABELS[stage]}</h2>
                  <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3 min-h-24">
                  {items.map((p) => {
                    const badge = supplyBadge(p.supply);
                    return (
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
                          {badge && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5">
                              <ShoppingCart className="w-3 h-3" /> Suprimentos: {badge}
                            </span>
                          )}
                          <div className="space-y-2" onClick={(e) => e.preventDefault()}>
                            <StageSelect
                              value={p.stage}
                              onChange={(newStage) => stageMutation.mutate({ id: p.id, stage: newStage })}
                            />
                            {subs.length > 0 && (
                              <Select
                                value={p.subStage ?? "__inicio__"}
                                onValueChange={(v) =>
                                  subStageMutation.mutate({ id: p.id, subStage: v === "__inicio__" ? null : v })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                  <SelectValue placeholder="Sub-etapa" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__inicio__">Sub-etapa: início</SelectItem>
                                  {subs.map((g) => (
                                    <SelectItem key={g.slug} value={g.slug}>
                                      {g.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="border border-dashed border-white/10 rounded-2xl p-4 text-center text-xs text-muted-foreground">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </InternalLayout>
  );
}
