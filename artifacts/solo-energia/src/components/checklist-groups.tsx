import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ClipboardList, Users, CalendarClock, Pencil, Check, ArrowRight, History, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  acoesFor,
  ACAO_CTA,
  CHECKLIST_TEMPLATE,
  CHECKLIST_FIELD_DEFS,
  SERVICE_TIPOS,
  type ChecklistItem,
  type ChecklistFieldDef,
  type StageId,
  type ChecklistAcao,
} from "@/lib/internal-api";

// ─── Small helpers ────────────────────────────────────────────────────────────

function fieldInput(
  def: ChecklistFieldDef,
  value: string,
  onChange: (v: string) => void,
) {
  if (def.type === "select" && def.options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {def.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  const type =
    def.type === "date" ? "date" : def.type === "currency" ? "number" : def.type === "phone" ? "tel" : "text";
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9"
    />
  );
}

function metadataSummary(item: ChecklistItem): string | null {
  if (!item.metadata) return null;
  const defs = CHECKLIST_FIELD_DEFS[item.checklistSlug];
  if (!defs) {
    // service/client_notify summaries
    const m = item.metadata as Record<string, unknown>;
    if (m.equipeExecucao) return `Equipe: ${m.equipeExecucao}`;
    if (m.data) return `Agendado: ${new Date(`${m.data}T00:00:00`).toLocaleDateString("pt-BR")}${m.hora ? ` às ${m.hora}` : ""}`;
    return null;
  }
  const parts = defs
    .map((d) => {
      const v = item.metadata?.[d.key];
      if (v === undefined || v === null || v === "") return null;
      const shown = d.type === "date" ? new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR") : String(v);
      return `${d.label}: ${shown}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// ─── Form item dialog ─────────────────────────────────────────────────────────

function FormItemDialog({
  item,
  open,
  onOpenChange,
  invalidateKeys,
}: {
  item: ChecklistItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invalidateKeys: unknown[][];
}) {
  const defs = CHECKLIST_FIELD_DEFS[item.checklistSlug] ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      defs.forEach((d) => {
        const v = item.metadata?.[d.key];
        initial[d.key] = v === undefined || v === null ? "" : String(v);
      });
      setValues(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.id]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const metadata: Record<string, unknown> = {};
      defs.forEach((d) => {
        const raw = values[d.key]?.trim();
        if (!raw) return;
        metadata[d.key] = d.type === "currency" ? Number(raw) : raw;
      });
      return api.patch<ChecklistItem>(`/internal/checklist/${item.id}`, {
        done: true,
        metadata,
      });
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: "Dados salvos" });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{item.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {defs.map((d) => (
            <div key={d.key}>
              <Label className="text-xs">{d.label}</Label>
              {fieldInput(d, values[d.key] ?? "", (v) => setValues((s) => ({ ...s, [d.key]: v })))}
            </div>
          ))}
          <Button
            className="w-full"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar e concluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Service (team assignment) dialog ─────────────────────────────────────────

function ServiceItemDialog({
  item,
  open,
  onOpenChange,
  invalidateKeys,
}: {
  item: ChecklistItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invalidateKeys: unknown[][];
}) {
  const [form, setForm] = useState({
    equipeExecucao: "",
    telefoneEquipe: "",
    tipoServico: "Instalação",
    valorServico: "",
    dataInicio: "",
    dataTermino: "",
    endereco: "",
    observacoes: "",
    notify: true,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const assignMutation = useMutation({
    mutationFn: () =>
      api.post(`/internal/checklist/${item.id}/assign-service`, {
        equipeExecucao: form.equipeExecucao,
        telefoneEquipe: form.telefoneEquipe || undefined,
        tipoServico: form.tipoServico,
        valorServico: form.valorServico ? Number(form.valorServico) : null,
        dataInicio: form.dataInicio || null,
        dataTermino: form.dataTermino || null,
        endereco: form.endereco || undefined,
        observacoes: form.observacoes || undefined,
        notify: form.notify,
      }),
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      queryClient.invalidateQueries({ queryKey: ["internal-services"] });
      toast({
        title: "Serviço criado e equipe designada",
        description: form.notify && form.telefoneEquipe ? "A equipe foi notificada via WhatsApp." : undefined,
      });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao designar equipe", description: err.message, variant: "destructive" }),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Designar equipe e criar serviço
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Equipe / responsável *</Label>
            <Input value={form.equipeExecucao} onChange={set("equipeExecucao")} placeholder="Ex.: SL01 - Equipe Fortaleza" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">WhatsApp da equipe</Label>
            <Input type="tel" value={form.telefoneEquipe} onChange={set("telefoneEquipe")} placeholder="85 99999-9999" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de serviço</Label>
              <Select value={form.tipoServico} onValueChange={(v) => setForm((f) => ({ ...f, tipoServico: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" value={form.valorServico} onChange={set("valorServico")} placeholder="1500" className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="datetime-local" value={form.dataInicio} onChange={set("dataInicio")} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Término</Label>
              <Input type="datetime-local" value={form.dataTermino} onChange={set("dataTermino")} className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Endereço (vazio = cidade do projeto)</Label>
            <Input value={form.endereco} onChange={set("endereco")} placeholder="Rua, número, bairro" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Input value={form.observacoes} onChange={set("observacoes")} className="h-9" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox
              checked={form.notify}
              onCheckedChange={(c) => setForm((f) => ({ ...f, notify: c === true }))}
            />
            Notificar equipe via WhatsApp
          </label>
          <Button
            className="w-full"
            disabled={!form.equipeExecucao.trim() || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            {assignMutation.isPending ? "Criando..." : "Criar serviço e designar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client scheduling dialog ─────────────────────────────────────────────────

function ClientNotifyDialog({
  item,
  open,
  onOpenChange,
  invalidateKeys,
}: {
  item: ChecklistItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invalidateKeys: unknown[][];
}) {
  const [form, setForm] = useState({ data: "", hora: "", observacao: "", notify: true });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const scheduleMutation = useMutation({
    mutationFn: () =>
      api.post(`/internal/checklist/${item.id}/schedule-client`, {
        data: form.data,
        hora: form.hora || undefined,
        observacao: form.observacao || undefined,
        notify: form.notify,
      }),
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({
        title: "Agendamento registrado",
        description: form.notify ? "O cliente foi notificado no portal e WhatsApp." : undefined,
      });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao agendar", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> {item.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Input value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} placeholder="Ex.: equipe chega pela manhã" className="h-9" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox
              checked={form.notify}
              onCheckedChange={(c) => setForm((f) => ({ ...f, notify: c === true }))}
            />
            Notificar cliente (portal + WhatsApp)
          </label>
          <Button
            className="w-full"
            disabled={!form.data || scheduleMutation.isPending}
            onClick={() => scheduleMutation.mutate()}
          >
            {scheduleMutation.isPending ? "Agendando..." : "Confirmar agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  invalidateKeys,
}: {
  item: ChecklistItem;
  invalidateKeys: unknown[][];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const summary = metadataSummary(item);
  const isActionKind = item.kind === "form" || item.kind === "service" || item.kind === "client_notify";

  const kindIcon =
    item.kind === "service" ? (
      <Users className="w-3.5 h-3.5" />
    ) : item.kind === "client_notify" ? (
      <CalendarClock className="w-3.5 h-3.5" />
    ) : (
      <ClipboardList className="w-3.5 h-3.5" />
    );

  return (
    <div className="flex items-start gap-2 group">
      {item.kind === "check" ? (
        <Checkbox
          checked={item.done}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ id: item.id, done: checked === true })
          }
          className="mt-0.5"
        />
      ) : (
        <span className={`mt-0.5 ${item.done ? "text-primary" : "text-muted-foreground"}`}>{kindIcon}</span>
      )}
      <div className="flex-1 min-w-0">
        <p
          className={
            item.done && item.kind === "check"
              ? "text-sm text-muted-foreground line-through"
              : "text-sm text-foreground"
          }
        >
          {item.label}
        </p>
        {summary && <p className="text-[11px] text-primary/90 mt-0.5">{summary}</p>}
        {item.done && item.doneBy && (
          <p className="text-[10px] text-muted-foreground">
            {item.doneBy}
            {item.doneAt && ` · ${new Date(item.doneAt).toLocaleDateString("pt-BR")}`}
          </p>
        )}
        {isActionKind && (
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {item.done ? (
              <>
                <Pencil className="w-3 h-3" /> Editar
              </>
            ) : item.kind === "service" ? (
              "Designar equipe →"
            ) : item.kind === "client_notify" ? (
              "Agendar →"
            ) : (
              "Preencher →"
            )}
          </button>
        )}
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        onClick={() => deleteMutation.mutate(item.id)}
        title="Remover"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {item.kind === "form" && (
        <FormItemDialog item={item} open={dialogOpen} onOpenChange={setDialogOpen} invalidateKeys={invalidateKeys} />
      )}
      {item.kind === "service" && (
        <ServiceItemDialog item={item} open={dialogOpen} onOpenChange={setDialogOpen} invalidateKeys={invalidateKeys} />
      )}
      {item.kind === "client_notify" && (
        <ClientNotifyDialog item={item} open={dialogOpen} onOpenChange={setDialogOpen} invalidateKeys={invalidateKeys} />
      )}
    </div>
  );
}

// ─── Add item + groups ────────────────────────────────────────────────────────

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
        sortOrder: 99,
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

/**
 * Item-ação: não é caixinha. O estado vem derivado do dado real (acoesCumpridas)
 * e o botão leva direto para onde a ação acontece.
 */
function AcaoRow({
  label,
  acao,
  cumprida,
  onAtalho,
}: {
  label: string;
  acao: ChecklistAcao;
  cumprida: boolean;
  onAtalho: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={
          cumprida
            ? "w-4 h-4 mt-0.5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0"
            : "w-4 h-4 mt-0.5 rounded-full border border-white/20 shrink-0"
        }
        title={cumprida ? "Cumprido pela ação no sistema" : "Pendente"}
      >
        {cumprida && <Check className="w-2.5 h-2.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cumprida ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
          {label}
        </p>
        {!cumprida && (
          <button
            onClick={onAtalho}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
          >
            {ACAO_CTA[acao]} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Itens importados do Jestor: histórico, somente leitura, recolhido. */
function HistoricoJestor({ items }: { items: ChecklistItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const feitos = items.filter((i) => i.done).length;
  return (
    <div className="md:col-span-2 bg-background/40 border border-white/5 rounded-2xl p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <History className="w-3.5 h-3.5" />
          Histórico do Jestor — {items.length} itens, {feitos} concluídos
        </span>
        <ChevronDown
          className={open ? "w-4 h-4 text-muted-foreground rotate-180 transition-transform" : "w-4 h-4 text-muted-foreground transition-transform"}
        />
      </button>
      {open && (
        <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
          {items.map((i) => (
            <p key={i.id} className="text-xs text-muted-foreground">
              <span className={i.done ? "text-primary/70" : "text-muted-foreground/60"}>
                {i.done ? "✓" : "○"}
              </span>{" "}
              {i.label}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChecklistGroups({
  projectId,
  stage,
  items,
  invalidateKeys,
  groupSlugPrefix,
  acoesCumpridas,
  onAtalho,
}: {
  projectId: number;
  stage: StageId;
  items: ChecklistItem[];
  invalidateKeys: unknown[][];
  /** Ações já cumpridas, derivadas do dado real pelo backend. */
  acoesCumpridas?: ChecklistAcao[];
  /** Leva o usuário para onde a ação acontece. */
  onAtalho?: (atalho: { tipo: "rota" | "aba"; destino: string }) => void;
  /** Optional filter to show only groups whose slug starts with this prefix
   *  (e.g. "homologacao_" on the internal Homologação page). */
  groupSlugPrefix?: string;
}) {
  const queryClient = useQueryClient();
  const groups = groupSlugPrefix
    ? CHECKLIST_TEMPLATE[stage].filter((g) => g.slug.startsWith(groupSlugPrefix))
    : CHECKLIST_TEMPLATE[stage];
  const seedAttempted = useRef<Set<string>>(new Set());

  const seedMutation = useMutation({
    mutationFn: (s: StageId) => api.post(`/internal/projects/${projectId}/checklist/seed`, { stage: s }),
    onSuccess: () =>
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
  });

  // Auto-seed default typed items when a stage tab is opened and any template group
  // has no items yet (the server skips groups that already have items, so this also
  // reconciles new template groups on existing projects).
  const hasMissingGroup = groups.some((g) => !items.some((i) => i.checklistSlug === g.slug));
  useEffect(() => {
    const key = `${projectId}:${stage}`;
    if (groups.length > 0 && hasMissingGroup && !seedAttempted.current.has(key)) {
      seedAttempted.current.add(key);
      seedMutation.mutate(stage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stage, hasMissingGroup, groups.length]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-2xl p-6 text-center">
        Esta etapa não possui checklists padrão.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => {
        const todos = items.filter((i) => i.checklistSlug === group.slug);
        const groupItems = todos.filter((i) => i.origem !== "jestor");
        const acoes = acoesFor(group.slug);
        const acoesOk = acoes.filter((a) => (acoesCumpridas ?? []).includes(a.acao)).length;
        const doneCount = groupItems.filter((i) => i.done).length + acoesOk;
        const totalCount = groupItems.length + acoes.length;
        return (
          <div key={group.slug} className="bg-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
              <span className="text-xs text-muted-foreground">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="space-y-2">
              {acoes.map((a) => (
                <AcaoRow
                  key={a.acao}
                  label={a.label}
                  acao={a.acao}
                  cumprida={(acoesCumpridas ?? []).includes(a.acao)}
                  onAtalho={() => onAtalho?.(a.atalho)}
                />
              ))}
              {groupItems.map((item) => (
                <ItemRow key={item.id} item={item} invalidateKeys={invalidateKeys} />
              ))}
              {groupItems.length === 0 && acoes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {seedMutation.isPending ? "Criando itens padrão..." : "Nenhum item ainda."}
                </p>
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
      <HistoricoJestor items={items.filter((i) => i.origem === "jestor")} />
    </div>
  );
}
