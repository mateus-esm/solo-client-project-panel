import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Upload, FileSignature, CheckCircle2, Receipt } from "lucide-react";
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
  type InstallerAccount,
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
  valorProposto: string;
  valorFechado: string;
  custoLogistica: string;
  outrosCustos: string;
  formaPagamento: string;
  pixConta: string;
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
  valorProposto: "",
  valorFechado: "",
  custoLogistica: "",
  outrosCustos: "",
  formaPagamento: "",
  pixConta: "",
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

// Uploads a contract or comprovante file to the service via object storage.
function UploadSection({
  service,
  target,
  title,
  icon: Icon,
}: {
  service: ServiceItem;
  target: "contract" | "comprovante";
  title: string;
  icon: typeof Upload;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const url = target === "contract" ? service.contratoUrl : service.comprovanteUrl;

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/internal/services/${service.id}/${target}/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Falha no upload");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-services"] });
      toast({ title: "Arquivo enviado" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-background/50 rounded-xl p-4">
      <Label className="text-xs flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {title}</Label>
      <div className="mt-2 flex items-center gap-2">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm truncate flex-1">
            Ver arquivo
          </a>
        ) : (
          <span className="text-xs text-muted-foreground flex-1">Nenhum arquivo.</span>
        )}
        {target === "contract" && service.contratoStatus === "aceito" && (
          <span className="text-xs text-energy-green flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aceito
          </span>
        )}
        {target === "contract" && service.contratoStatus === "enviado" && (
          <span className="text-xs text-chart-3">Aguardando aceite</span>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        <Button size="sm" variant="secondary" className="h-8" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <Upload className="w-3.5 h-3.5" />
        </Button>
      </div>
      {target === "contract" && service.contratoAceitoPor && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Aceito por {service.contratoAceitoPor}
          {service.contratoAceitoEm ? ` em ${new Date(service.contratoAceitoEm).toLocaleString("pt-BR")}` : ""}
        </p>
      )}
    </div>
  );
}

// Assigns which team members go to a service, filtered by the selected team.
function MembersPicker({ service, teamName }: { service: ServiceItem; teamName: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: accounts } = useQuery<InstallerAccount[]>({
    queryKey: ["internal-installers"],
    queryFn: () => api.get<InstallerAccount[]>("/internal/installers"),
  });
  const account = (accounts ?? []).find((a) => a.teamName === teamName);
  const assignedIds = new Set((service.members ?? []).map((m) => m.id));

  const save = useMutation({
    mutationFn: (memberIds: number[]) =>
      api.put(`/internal/services/${service.id}/members`, { memberIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-services"] }),
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggle = (id: number) => {
    const next = assignedIds.has(id)
      ? [...assignedIds].filter((x) => x !== id)
      : [...assignedIds, id];
    save.mutate(next);
  };

  const decide = useMutation({
    mutationFn: (decision: "aprovada" | "recusada") =>
      api.post(`/internal/services/${service.id}/escalacao/decision`, { decision }),
    onSuccess: (_data, decision) => {
      toast({
        title: decision === "aprovada" ? "Escalação aprovada" : "Escalação recusada",
      });
      queryClient.invalidateQueries({ queryKey: ["internal-services"] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-background/50 rounded-xl p-4">
      <Label className="text-xs">Membros no serviço</Label>
      {service.escalacaoStatus === "pendente" && (
        <div className="mt-2 mb-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Escalação proposta pelo instalador
            {service.escalacaoEnviadaPor ? ` (${service.escalacaoEnviadaPor})` : ""}
            {" — "}os membros selecionados abaixo aguardam sua aprovação.
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={decide.isPending}
              onClick={() => decide.mutate("aprovada")}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aceitar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              disabled={decide.isPending}
              onClick={() => decide.mutate("recusada")}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Recusar
            </Button>
          </div>
        </div>
      )}
      {service.escalacaoStatus === "aprovada" && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
          Escalação aprovada
          {service.escalacaoDecididaEm
            ? ` em ${new Date(service.escalacaoDecididaEm).toLocaleDateString("pt-BR")}`
            : ""}
          .
        </p>
      )}
      {service.escalacaoStatus === "recusada" && (
        <p className="text-xs text-destructive mt-2">
          Escalação recusada — o instalador pode enviar uma nova proposta.
        </p>
      )}
      {!account ? (
        <p className="text-xs text-muted-foreground mt-2">
          Selecione uma equipe cadastrada em "Equipe de execução" para escolher os membros.
        </p>
      ) : account.members.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">Esta equipe não tem membros cadastrados.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2">
          {account.members.map((m) => {
            const active = assignedIds.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={
                  "px-3 py-1.5 rounded-full text-xs border transition-colors " +
                  (active
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-white/10 hover:bg-white/5")
                }
              >
                {m.name}
              </button>
            );
          })}
        </div>
      )}
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

  const { data: installers } = useQuery<InstallerAccount[]>({
    queryKey: ["internal-installers"],
    queryFn: () => api.get<InstallerAccount[]>("/internal/installers"),
  });

  // Nome composto: "Tipo de serviço | Nome do projeto - Potência".
  // Sem projeto resolvido, mantém o nome salvo (edição) e bloqueia salvar em serviço novo.
  const selectedProject =
    form.projectId !== NONE ? (projects ?? []).find((p) => String(p.id) === form.projectId) : undefined;
  const composedName = selectedProject
    ? `${form.tipoServico} | ${selectedProject.clientName} - ${selectedProject.systemPower} kWp`
    : service
      ? form.name
      : "";

  // Valores legados que não existem mais nas listas atuais continuam visíveis/selecionáveis.
  const tipoOptions: string[] =
    form.tipoServico && !SERVICE_TIPOS.includes(form.tipoServico as (typeof SERVICE_TIPOS)[number])
      ? [form.tipoServico, ...SERVICE_TIPOS]
      : [...SERVICE_TIPOS];
  const teamNames = (installers ?? []).map((acc) => acc.teamName);
  const legacyTeam = form.equipeExecucao && !teamNames.includes(form.equipeExecucao) ? form.equipeExecucao : null;

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
        valorProposto: service.valorProposto != null ? String(service.valorProposto) : "",
        valorFechado: service.valorFechado != null ? String(service.valorFechado) : "",
        custoLogistica: service.custoLogistica != null ? String(service.custoLogistica) : "",
        outrosCustos: service.outrosCustos != null ? String(service.outrosCustos) : "",
        formaPagamento: service.formaPagamento ?? "",
        pixConta: service.pixConta ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, service]);

  const payload = () => ({
    name: composedName,
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
    valorProposto: form.valorProposto ? Number(form.valorProposto) : null,
    valorFechado: form.valorFechado ? Number(form.valorFechado) : null,
    custoLogistica: form.custoLogistica ? Number(form.custoLogistica) : null,
    outrosCustos: form.outrosCustos ? Number(form.outrosCustos) : null,
    formaPagamento: form.formaPagamento || null,
    pixConta: form.pixConta || null,
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
              <Label>Serviço (nome gerado automaticamente)</Label>
              <Input
                value={composedName}
                readOnly
                disabled
                className="opacity-80"
                placeholder="Selecione um projeto"
              />
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
                  {tipoOptions.map((t) => (
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
              <Select
                value={form.equipeExecucao || NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, equipeExecucao: v === NONE ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem equipe</SelectItem>
                  {legacyTeam && (
                    <SelectItem value={legacyTeam}>{legacyTeam} (equipe removida)</SelectItem>
                  )}
                  {(installers ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.teamName}>
                      {acc.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="border border-white/5 rounded-xl p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Financeiro</Label>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Valor proposto (R$)</Label>
                <Input type="number" value={form.valorProposto} onChange={set("valorProposto")} />
              </div>
              <div>
                <Label>Valor fechado (R$)</Label>
                <Input type="number" value={form.valorFechado} onChange={set("valorFechado")} />
              </div>
              <div>
                <Label>Custo de logística (R$)</Label>
                <Input type="number" value={form.custoLogistica} onChange={set("custoLogistica")} />
              </div>
              <div>
                <Label>Outros custos (R$)</Label>
                <Input type="number" value={form.outrosCustos} onChange={set("outrosCustos")} />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Input value={form.formaPagamento} onChange={set("formaPagamento")} placeholder="PIX, transferência..." />
              </div>
              <div>
                <Label>Conta / chave PIX</Label>
                <Input value={form.pixConta} onChange={set("pixConta")} />
              </div>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={set("observacoes")} rows={3} />
          </div>

          {service ? (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <UploadSection service={service} target="contract" title="Contrato de prestação (assinatura)" icon={FileSignature} />
                <UploadSection service={service} target="comprovante" title="Comprovante de pagamento" icon={Receipt} />
              </div>
              <MembersPicker service={service} teamName={form.equipeExecucao} />
              <div className="grid md:grid-cols-2 gap-3">
                <FileSection service={service} kind="contrato_escopo" title="Contrato e Escopo (links)" />
                <FileSection
                  service={service}
                  kind="imagens_documentacao"
                  title="Imagens e Documentação"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Salve o serviço para anexar contrato, comprovante, membros e documentação.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!composedName || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
