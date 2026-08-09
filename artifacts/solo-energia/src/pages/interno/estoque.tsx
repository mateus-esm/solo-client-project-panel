import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, AlertTriangle, Trash2 } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  STOCK_CATEGORIAS,
  STOCK_CATEGORIA_LABELS,
  type StockCategoria,
  type StockItem,
} from "@/lib/internal-api";

const EMPTY = {
  name: "",
  sku: "",
  categoria: "outro" as string,
  unidade: "un",
  quantidade: "0",
  custoUnitario: "",
  estoqueMinimo: "",
  localizacao: "",
  observacoes: "",
};

function ItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: StockItem | null;
}) {
  const [form, setForm] = useState({ ...EMPTY });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            name: item.name,
            sku: item.sku ?? "",
            categoria: item.categoria,
            unidade: item.unidade,
            quantidade: String(item.quantidade ?? 0),
            custoUnitario: item.custoUnitario != null ? String(item.custoUnitario) : "",
            estoqueMinimo: item.estoqueMinimo != null ? String(item.estoqueMinimo) : "",
            localizacao: item.localizacao ?? "",
            observacoes: item.observacoes ?? "",
          }
        : { ...EMPTY },
    );
  }, [open, item]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        sku: form.sku || null,
        categoria: form.categoria,
        unidade: form.unidade || "un",
        quantidade: Number(form.quantidade) || 0,
        custoUnitario: form.custoUnitario ? Number(form.custoUnitario) : null,
        estoqueMinimo: form.estoqueMinimo ? Number(form.estoqueMinimo) : null,
        localizacao: form.localizacao || null,
        observacoes: form.observacoes || null,
      };
      return item
        ? api.patch<StockItem>(`/internal/stock/${item.id}`, body)
        : api.post<StockItem>("/internal/stock", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-stock"] });
      toast({ title: item ? "Item atualizado" : "Item criado" });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item de estoque"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Ex.: Módulo 620W" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku} onChange={set("sku")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {STOCK_CATEGORIA_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unidade} onChange={set("unidade")} placeholder="un" />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={form.quantidade} onChange={set("quantidade")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Custo unitário</Label>
              <Input type="number" value={form.custoUnitario} onChange={set("custoUnitario")} />
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <Input type="number" value={form.estoqueMinimo} onChange={set("estoqueMinimo")} />
            </div>
            <div>
              <Label>Localização</Label>
              <Input value={form.localizacao} onChange={set("localizacao")} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={set("observacoes")} />
          </div>
          <Button className="w-full" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EstoquePage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items, isLoading } = useQuery<StockItem[]>({
    queryKey: ["internal-stock"],
    queryFn: () => api.get<StockItem[]>("/internal/stock"),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/internal/stock/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-stock"] }),
    onError: (err: Error) =>
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });

  const valorTotal = (items ?? []).reduce(
    (n, i) => n + (i.custoUnitario ?? 0) * (i.quantidade ?? 0),
    0,
  );
  const abaixoMinimo = (items ?? []).filter(
    (i) => i.estoqueMinimo != null && i.quantidade <= i.estoqueMinimo,
  );

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Estoque
          </h1>
          <p className="text-sm text-muted-foreground">
            {items?.length ?? 0} itens · {formatBRL(valorTotal)} em estoque
            {abaixoMinimo.length > 0 && ` · ${abaixoMinimo.length} abaixo do mínimo`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Novo item
        </Button>
      </div>

      {isLoading ? (
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      ) : (items ?? []).length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-1">Estoque vazio.</p>
          <p className="text-xs text-muted-foreground">
            Cadastre os itens que a equipe usa nas instalações — módulos, inversores, estrutura, cabo.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-right">Qtd</th>
                  <th className="px-4 py-3 font-medium text-right">Custo un.</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Local</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((i) => {
                  const baixo = i.estoqueMinimo != null && i.quantidade <= i.estoqueMinimo;
                  return (
                    <tr
                      key={i.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer group"
                      onClick={() => {
                        setEditing(i);
                        setOpen(true);
                      }}
                    >
                      <td className="px-4 py-3 text-foreground">
                        {i.name}
                        {i.sku && <span className="text-xs text-muted-foreground ml-2">{i.sku}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {STOCK_CATEGORIA_LABELS[i.categoria as StockCategoria] ?? i.categoria}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={baixo ? "text-primary inline-flex items-center gap-1" : "text-foreground"}>
                          {baixo && <AlertTriangle className="w-3 h-3" />}
                          {i.quantidade} {i.unidade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatBRL(i.custoUnitario)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatBRL((i.custoUnitario ?? 0) * i.quantidade)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{i.localizacao ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            del.mutate(i.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ItemDialog open={open} onOpenChange={setOpen} item={editing} />
    </InternalLayout>
  );
}
