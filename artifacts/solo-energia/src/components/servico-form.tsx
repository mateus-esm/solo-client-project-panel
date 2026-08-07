import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  SERVICE_TIPOS,
  SERVICE_STATUS,
  SERVICE_STATUS_PAGAMENTO,
  type InternalProject,
  type ServiceItem,
} from "@/lib/internal-api";

const NONE = "__none__";

// Converts an ISO timestamp to the value shape <input type="datetime-local"> expects.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FormState {
  name: string;
  tipoServico: string;
  projectId: string;
  valorServico: string;
  status: string;
  statusPagamento: string;
  pagamentoRealizado: boolean;
  dataExecucao: string;
  dataInicio: string;
  dataTermino: string;
  equipeExecucao: string;
  endereco: string;
  responsavelEmail: string;
  observacoes: string;
}

const EMPTY: FormState = {
  name: "",
  tipoServico: SERVICE_TIPOS[0],
  projectId: NONE,
  valorServico: "",
  status: SERVICE_STATUS[0],
  statusPagamento: SERVICE_STATUS_PAGAMENTO[0],
  pagamentoRealizado: false,
  dataExecucao: "",
  dataInicio: "",
  dataTermino: "",
  equipeExecucao: "",
  endereco: "",
  responsavelEmail: "",
  observacoes: "",
};

function FileSection({
  service,
  kind,
  title,
}: {
  service: ServiceItem;
  kind: "contrato_escopo" | "imagens_documentacao";
  title: string;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const files = service.files.filter((f) => f.kind === kind);

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/internal/services/${service.id}/files`, { kind, name: name || url, url }),
    onSuccess: () => {
      setUrl("");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["internal-services"] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao anexar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => api.del(`/internal/files/${fileId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-services"] }),
  });

  return (
    <div className="bg-background/50 rounded-xl p-4">
      <Label className="text-xs">{title}</Label>
      <div className="space-y-2 mt-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline truncate flex-1"
            >
              {f.name ?? f.url}
            </a>
            <button
              className="text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate(f.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {files.length === 0 && <p className="text-xs text-muted-foreground">Nenhum arquivo.</p>}
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="h-8 text-sm w-32"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (Drive, etc.)"
          className="h-8 text-sm flex-1"
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          disabled={!url || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ServicoFormDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceItem | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery<InternalProject[]>({
    queryKey: ["internal-projects"],
    queryFn: () => api.get<InternalProject[]>("/internal/projects"),
  });

  useEffect(() => {
    if (!open) return;
    if (service) {
      setForm({
        name: service.name,
        tipoServico: service.tipoServico ?? SERVICE_TIPOS[0],
        projectId: service.projectId ? String(service.projectId) : NONE,
        valorServico: service.valorServico != null ? String(service.valorServico) : "",
        status: service.status,
        statusPagamento: service.statusPagamento,
        pagamentoRealizado: service.pagamentoRealizado,
        dataExecucao: toLocalInput(service.dataExecucao),
        dataInicio: toLocalInput(service.dataInicio),
        dataTermino: toLocalInput(service.dataTermino),
        equipeExecucao: service.equipeExecucao ?? "",
        endereco: service.endereco ?? "",
        responsavelEmail: service.responsavelEmail ?? "",
        observacoes: service.observacoes ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, service]);

  const payload = () => ({
    name: form.name,
    tipoServico: form.tipoServico,
    projectId: form.projectId === NONE ? null : Number(form.projectId),
    valorServico: form.valorServico ? Number(form.valorServico) : null,
    status: form.status,
    statusPagamento: form.statusPagamento,
    pagamentoRealizado: form.pagamentoRealizado,
    dataExecucao: form.dataExecucao ? new Date(form.dataExecucao).toISOString() : null,
    dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : null,
    dataTermino: form.dataTermino ? new Date(form.dataTermino).toISOString() : null,
    equipeExecucao: form.equipeExecucao || null,
    endereco: form.endereco || null,
    responsavelEmail: form.responsavelEmail || null,
    observacoes: form.observacoes || null,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      service
        ? api.patch<ServiceItem>(`/internal/services/${service.id}`, payload())
        : api.post<ServiceItem>("/internal/services", payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-services"] });
      toast({ title: service ? "Serviço atualizado" : "Serviço criado" });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const set =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Formulário de Serviço" : "Novo Serviço"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Serviço</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Ex.: Instalação 8,5 kWp" />
            </div>
            <div>
              <Label>Tipo de serviço</Label>
              <Select
                value={form.tipoServico}
                onValueChange={(v) => setForm((f) => ({ ...f, tipoServico: v }))}
              >
                <SelectTrigger>
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
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Projeto</Label>
              <Select
                value={form.projectId}
                onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem projeto</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor do serviço (R$)</Label>
              <Input type="number" value={form.valorServico} onChange={set("valorServico")} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Data de execução</Label>
              <Input type="datetime-local" value={form.dataExecucao} onChange={set("dataExecucao")} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="datetime-local" value={form.dataInicio} onChange={set("dataInicio")} />
            </div>
            <div>
              <Label>Término</Label>
              <Input type="datetime-local" value={form.dataTermino} onChange={set("dataTermino")} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Equipe de execução</Label>
              <Input value={form.equipeExecucao} onChange={set("equipeExecucao")} />
            </div>
            <div>
              <Label>Responsável (e-mail)</Label>
              <Input value={form.responsavelEmail} onChange={set("responsavelEmail")} />
            </div>
          </div>

          <div>
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={set("endereco")} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status do pagamento</Label>
              <Select
                value={form.statusPagamento}
                onValueChange={(v) => setForm((f) => ({ ...f, statusPagamento: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUS_PAGAMENTO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between bg-background/50 rounded-xl px-4 py-3">
            <Label className="mb-0">Pagamento realizado</Label>
            <Switch
              checked={form.pagamentoRealizado}
              onCheckedChange={(v) => setForm((f) => ({ ...f, pagamentoRealizado: v }))}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={set("observacoes")} rows={3} />
          </div>

          {service ? (
            <div className="grid md:grid-cols-2 gap-3">
              <FileSection service={service} kind="contrato_escopo" title="Contrato e Escopo" />
              <FileSection
                service={service}
                kind="imagens_documentacao"
                title="Imagens e Documentação"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Salve o serviço para anexar contrato, imagens e documentação.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!form.name || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
