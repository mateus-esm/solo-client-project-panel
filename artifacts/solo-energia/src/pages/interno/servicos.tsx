import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { ServicoFormDialog } from "@/components/servico-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  SERVICE_STATUS,
  SERVICE_STATUS_PAGAMENTO,
  formatBRL,
  type InternalProject,
  type ServiceItem,
} from "@/lib/internal-api";

const ALL = "__all__";

function statusVariant(status: string) {
  if (status === "Concluído") return "default" as const;
  if (status === "Cancelado") return "destructive" as const;
  return "secondary" as const;
}

function pagamentoClass(status: string) {
  if (status === "Pago") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (status === "Aprovado") return "bg-primary/15 text-primary border-primary/30";
  if (status === "Aguardando Aprovação") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return "bg-white/5 text-muted-foreground border-white/10";
}

export default function ServicosPage() {
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [pagamentoFilter, setPagamentoFilter] = useState<string>(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);

  const { data: services, isLoading } = useQuery<ServiceItem[]>({
    queryKey: ["internal-services"],
    queryFn: () => api.get<ServiceItem[]>("/internal/services"),
  });

  const { data: projects } = useQuery<InternalProject[]>({
    queryKey: ["internal-projects"],
    queryFn: () => api.get<InternalProject[]>("/internal/projects"),
  });

  const projectName = (id: number | null) =>
    id == null ? "—" : (projects ?? []).find((p) => p.id === id)?.clientName ?? `#${id}`;

  const filtered = (services ?? []).filter(
    (s) =>
      (statusFilter === ALL || s.status === statusFilter) &&
      (pagamentoFilter === ALL || s.statusPagamento === pagamentoFilter),
  );

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (service: ServiceItem) => {
    setEditing(service);
    setDialogOpen(true);
  };

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {services?.length ?? 0} serviços
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {SERVICE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pagamentoFilter} onValueChange={setPagamentoFilter}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os pagamentos</SelectItem>
              {SERVICE_STATUS_PAGAMENTO.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Novo Serviço
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Nenhum serviço encontrado.</p>
        </div>
      ) : (
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Serviço</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Projeto</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Execução</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
                    onClick={() => openEdit(s)}
                  >
                    <td className="px-4 py-3 text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.tipoServico ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{projectName(s.projectId)}</td>
                    <td className="px-4 py-3 text-foreground">{formatBRL(s.valorServico)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.dataExecucao ? new Date(s.dataExecucao).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${pagamentoClass(s.statusPagamento)}`}
                      >
                        {s.statusPagamento}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.responsavelEmail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ServicoFormDialog open={dialogOpen} onOpenChange={setDialogOpen} service={editing} />
    </InternalLayout>
  );
}
