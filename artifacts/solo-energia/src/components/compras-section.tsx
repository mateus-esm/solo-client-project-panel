import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShoppingCart, Truck, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  formatBRL,
  SUPPLIER_TIPO_LABELS,
  PURCHASE_STATUS_LABELS,
  type Supplier,
  type Purchase,
} from "@/lib/internal-api";

const fmtDate = (v: string | null) =>
  v ? new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR") : null;

// ─── Nova compra / cotação ────────────────────────────────────────────────────

function NewPurchaseDialog({
  projectId,
  open,
  onOpenChange,
  invalidateKeys,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invalidateKeys: unknown[][];
}) {
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["internal-suppliers"],
    queryFn: () => api.get<Supplier[]>("/internal/suppliers"),
  });
  const [form, setForm] = useState({
    supplierId: "",
    descricao: "",
    valorCotacao: "",
    observacoes: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Purchase>(`/internal/projects/${projectId}/purchases`, {
        supplierId: Number(form.supplierId),
        descricao: form.descricao.trim(),
        valorCotacao: form.valorCotacao ? Number(form.valorCotacao) : null,
        observacoes: form.observacoes.trim() || null,
      }),
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: "Cotação registrada" });
      setForm({ supplierId: "", descricao: "", valorCotacao: "", observacoes: "" });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" }),
  });

  const selected = (suppliers ?? []).find((s) => String(s.id) === form.supplierId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Nova cotação / compra</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Fornecedor *</Label>
            <Select value={form.supplierId} onValueChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecionar fornecedor..." />
              </SelectTrigger>
              <SelectContent>
                {(suppliers ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} — {SUPPLIER_TIPO_LABELS[s.tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(suppliers ?? []).length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Nenhum fornecedor cadastrado — cadastre em Fornecedores no menu lateral.
              </p>
            )}
            {selected && (
              <p className="text-[11px] text-primary/90 mt-1">
                {selected.tipo === "equipamentos"
                  ? "Compra de equipamentos: o valor alimenta o capex do projeto."
                  : "Materiais avulsos: o valor alimenta o custo de materiais do projeto."}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: Kit 8.5 kWp — painéis + inversor"
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Valor da cotação (R$)</Label>
            <Input
              type="number"
              value={form.valorCotacao}
              onChange={(e) => setForm((f) => ({ ...f, valorCotacao: e.target.value }))}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Input
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              className="h-9"
            />
          </div>
          <Button
            className="w-full"
            disabled={!form.supplierId || !form.descricao.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Registrando..." : "Registrar cotação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ações por status (comprar / logística / recebimento) ────────────────────

type ActionKind = "comprar" | "logistica" | "receber";

function PurchaseActionDialog({
  purchase,
  action,
  onClose,
  invalidateKeys,
}: {
  purchase: Purchase;
  action: ActionKind;
  onClose: () => void;
  invalidateKeys: unknown[][];
}) {
  const [form, setForm] = useState<Record<string, string>>((): Record<string, string> =>
    action === "comprar"
      ? {
          valor: purchase.valor != null ? String(purchase.valor) : purchase.valorCotacao != null ? String(purchase.valorCotacao) : "",
          dataCompra: purchase.dataCompra ?? "",
          numeroNfe: purchase.numeroNfe ?? "",
          formaPagamento: purchase.formaPagamento ?? "",
        }
      : action === "logistica"
        ? {
            transportadora: purchase.transportadora ?? "",
            codigoRastreio: purchase.codigoRastreio ?? "",
            previsaoEntrega: purchase.previsaoEntrega ?? "",
          }
        : {
            dataRecebimento: purchase.dataRecebimento ?? "",
            recebidoPor: purchase.recebidoPor ?? "",
          },
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const titles: Record<ActionKind, string> = {
    comprar: "Registrar compra",
    logistica: "Programar logística",
    receber: "Confirmar recebimento",
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> =
        action === "comprar"
          ? {
              status: "comprada",
              valor: form.valor ? Number(form.valor) : null,
              dataCompra: form.dataCompra || null,
              numeroNfe: form.numeroNfe || null,
              formaPagamento: form.formaPagamento || null,
            }
          : action === "logistica"
            ? {
                status: "logistica_programada",
                transportadora: form.transportadora || null,
                codigoRastreio: form.codigoRastreio || null,
                previsaoEntrega: form.previsaoEntrega || null,
              }
            : {
                status: "recebida",
                dataRecebimento: form.dataRecebimento || null,
                recebidoPor: form.recebidoPor || null,
              };
      return api.patch<Purchase>(`/internal/purchases/${purchase.id}`, body);
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: titles[action] + " — ok" });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const fields: { key: string; label: string; type?: string; required?: boolean }[] =
    action === "comprar"
      ? [
          { key: "valor", label: "Valor da compra (R$) *", type: "number", required: true },
          { key: "dataCompra", label: "Data da compra", type: "date" },
          { key: "numeroNfe", label: "Número da NF-e" },
          { key: "formaPagamento", label: "Forma de pagamento" },
        ]
      : action === "logistica"
        ? [
            { key: "transportadora", label: "Transportadora *", required: true },
            { key: "codigoRastreio", label: "Código de rastreio" },
            { key: "previsaoEntrega", label: "Previsão de entrega", type: "date" },
          ]
        : [
            { key: "dataRecebimento", label: "Data de recebimento *", type: "date", required: true },
            { key: "recebidoPor", label: "Recebido por" },
          ];

  const missingRequired = fields.some((f) => f.required && !form[f.key]?.trim());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{titles[action]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {purchase.descricao} · {purchase.supplierName}
          </p>
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type ?? "text"}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                className="h-9"
              />
            </div>
          ))}
          <Button
            className="w-full"
            disabled={missingRequired || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Seção principal ──────────────────────────────────────────────────────────

export function ComprasSection({
  projectId,
  invalidateKeys,
}: {
  projectId: number;
  invalidateKeys: unknown[][];
}) {
  const purchasesKey = ["internal-purchases", projectId];
  const allKeys = [...invalidateKeys, purchasesKey];
  const { data: purchases } = useQuery<Purchase[]>({
    queryKey: purchasesKey,
    queryFn: () => api.get<Purchase[]>(`/internal/projects/${projectId}/purchases`),
  });
  const [newOpen, setNewOpen] = useState(false);
  const [action, setAction] = useState<{ purchase: Purchase; kind: ActionKind } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/internal/purchases/${id}`),
    onSuccess: () => allKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
    onError: (err: Error) =>
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });

  const list = purchases ?? [];
  const efetivadas = list.filter((p) => p.status !== "cotacao");
  const capexTotal = efetivadas.filter((p) => p.categoria === "equipamentos").reduce((a, p) => a + (p.valor ?? 0), 0);
  const materiaisTotal = efetivadas.filter((p) => p.categoria === "materiais").reduce((a, p) => a + (p.valor ?? 0), 0);
  const pendenteLogistica = efetivadas.filter((p) => p.status === "comprada").length;

  const statusBadge = (p: Purchase) => {
    const cls =
      p.status === "recebida"
        ? "bg-primary/15 text-primary"
        : p.status === "cotacao"
          ? "bg-white/5 text-muted-foreground"
          : "bg-amber-500/15 text-amber-400";
    return <span className={`text-[10px] rounded-full px-2 py-0.5 ${cls}`}>{PURCHASE_STATUS_LABELS[p.status]}</span>;
  };

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" /> Compras e Logística
        </h2>
        <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova cotação
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-background/50 rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground">Equipamentos (capex)</p>
          <p className="text-sm text-foreground font-medium">{formatBRL(capexTotal || null)}</p>
        </div>
        <div className="bg-background/50 rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground">Outros materiais</p>
          <p className="text-sm text-foreground font-medium">{formatBRL(materiaisTotal || null)}</p>
        </div>
        <div className="bg-background/50 rounded-xl px-4 py-3 col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground">Logística pendente</p>
          <p className="text-sm text-foreground font-medium">
            {pendenteLogistica === 0 ? "Em dia" : `${pendenteLogistica} compra(s)`}
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-2xl p-4 text-center">
          Nenhuma cotação ou compra registrada. A Pré-execução só é liberada com compras e logística registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <div key={p.id} className="bg-background/50 rounded-xl px-4 py-3 group">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-foreground">{p.descricao}</p>
                    {statusBadge(p)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.supplierName} · {SUPPLIER_TIPO_LABELS[p.categoria]}
                    {p.valor != null
                      ? ` · ${formatBRL(p.valor)}`
                      : p.valorCotacao != null
                        ? ` · cotação ${formatBRL(p.valorCotacao)}`
                        : ""}
                  </p>
                  {(p.transportadora || p.previsaoEntrega) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <Truck className="w-3 h-3 inline mr-1" />
                      {[p.transportadora, p.codigoRastreio, fmtDate(p.previsaoEntrega) && `entrega ${fmtDate(p.previsaoEntrega)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {p.dataRecebimento && (
                    <p className="text-[11px] text-primary/90 mt-0.5">
                      <PackageCheck className="w-3 h-3 inline mr-1" />
                      Recebida em {fmtDate(p.dataRecebimento)}
                      {p.recebidoPor ? ` por ${p.recebidoPor}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.status === "cotacao" && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setAction({ purchase: p, kind: "comprar" })}>
                      Registrar compra
                    </Button>
                  )}
                  {p.status === "comprada" && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setAction({ purchase: p, kind: "logistica" })}>
                      Programar logística
                    </Button>
                  )}
                  {p.status === "logistica_programada" && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setAction({ purchase: p, kind: "receber" })}>
                      Confirmar recebimento
                    </Button>
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => deleteMutation.mutate(p.id)}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewPurchaseDialog projectId={projectId} open={newOpen} onOpenChange={setNewOpen} invalidateKeys={allKeys} />
      {action && (
        <PurchaseActionDialog
          purchase={action.purchase}
          action={action.kind}
          onClose={() => setAction(null)}
          invalidateKeys={allKeys}
        />
      )}
    </div>
  );
}
