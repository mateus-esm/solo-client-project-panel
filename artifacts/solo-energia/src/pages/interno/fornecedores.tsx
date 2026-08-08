import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Truck, Package } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
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
  SUPPLIER_TIPOS,
  SUPPLIER_TIPO_LABELS,
  type Supplier,
  type SupplierTipo,
} from "@/lib/internal-api";

const EMPTY = {
  name: "",
  tipo: "equipamentos" as SupplierTipo,
  contatoNome: "",
  telefone: "",
  email: "",
  observacoes: "",
};

function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier: Supplier | null;
}) {
  const [form, setForm] = useState(EMPTY);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form whenever the dialog opens for a different supplier
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = open ? `${supplier?.id ?? "new"}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key !== null) {
      setForm(
        supplier
          ? {
              name: supplier.name,
              tipo: supplier.tipo,
              contatoNome: supplier.contatoNome ?? "",
              telefone: supplier.telefone ?? "",
              email: supplier.email ?? "",
              observacoes: supplier.observacoes ?? "",
            }
          : EMPTY,
      );
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        tipo: form.tipo,
        contatoNome: form.contatoNome.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      return supplier
        ? api.patch<Supplier>(`/internal/suppliers/${supplier.id}`, body)
        : api.post<Supplier>("/internal/suppliers", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-suppliers"] });
      // Nome do fornecedor aparece nas compras dos projetos (join no backend)
      queryClient.invalidateQueries({ queryKey: ["internal-purchases"] });
      toast({ title: supplier ? "Fornecedor atualizado" : "Fornecedor cadastrado" });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar fornecedor", description: err.message, variant: "destructive" }),
  });

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {supplier ? "Editar fornecedor" : "Novo fornecedor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="Ex.: Aldo Solar" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as SupplierTipo }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPLIER_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{SUPPLIER_TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contato</Label>
              <Input value={form.contatoNome} onChange={set("contatoNome")} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input type="tel" value={form.telefone} onChange={set("telefone")} className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={form.email} onChange={set("email")} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Input value={form.observacoes} onChange={set("observacoes")} className="h-9" />
          </div>
          <Button
            className="w-full"
            disabled={!form.name.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar fornecedor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FornecedoresPage() {
  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["internal-suppliers"],
    queryFn: () => api.get<Supplier[]>("/internal/suppliers"),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/internal/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-suppliers"] });
      toast({ title: "Fornecedor removido" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });

  const byTipo = (tipo: SupplierTipo) => (suppliers ?? []).filter((s) => s.tipo === tipo);

  return (
    <InternalLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Equipamentos (capex) e materiais avulsos para as compras dos projetos
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-card rounded-2xl border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {SUPPLIER_TIPOS.map((tipo) => {
            const list = byTipo(tipo);
            const Icon = tipo === "equipamentos" ? Package : Truck;
            return (
              <div key={tipo} className="bg-card border border-white/5 rounded-3xl p-6">
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
                  <Icon className="w-4 h-4 text-primary" /> {SUPPLIER_TIPO_LABELS[tipo]}
                  <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5 ml-auto">
                    {list.length}
                  </span>
                </h2>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-2xl p-4 text-center">
                    Nenhum fornecedor cadastrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((s) => (
                      <div key={s.id} className="flex items-start justify-between gap-3 bg-background/50 rounded-xl px-4 py-3 group">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[s.contatoNome, s.telefone, s.email].filter(Boolean).join(" · ") || "Sem contato"}
                          </p>
                          {s.observacoes && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{s.observacoes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditing(s); setDialogOpen(true); }}
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(s.id)}
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editing} />
    </InternalLayout>
  );
}
