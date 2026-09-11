import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Zap, MapPin, Wallet, TrendingUp, Wrench, FileCheck2, Package, ClipboardList, Mail, MessageCircle, Loader2, CheckCircle2, Send } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { ProcessoFicha } from "@/components/processo-ficha";
import { ChecklistGroups } from "@/components/checklist-groups";
import { PlantCard } from "@/components/plant-card";
import { ComprasSection } from "@/components/compras-section";
import { FinanceiroSection } from "@/components/financeiro-section";
import { NotificarWhatsApp } from "@/components/notificar-whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  CHECKLIST_TEMPLATE,
  subStagesFor,
  supplyBadge,
  formatBRL,
  type ProjectDetail,
  type InternalProject,
  type Technician,
  type StageId,
  type ProjectDocument,
} from "@/lib/internal-api";

const STAGES_WITH_CHECKLIST = STAGES.filter((s) => CHECKLIST_TEMPLATE[s].length > 0);

const NO_TECH = "__none__";

function HomologacaoAssignment({ project, invalidateKey }: { project: InternalProject; invalidateKey: unknown[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: techs } = useQuery<Technician[]>({
    queryKey: ["internal-technicians"],
    queryFn: () => api.get<Technician[]>("/internal/technicians"),
  });

  const [valor, setValor] = useState(project.homologacaoValor != null ? String(project.homologacaoValor) : "");
  const [forma, setForma] = useState(project.homologacaoFormaPagamento ?? "");
  const [pix, setPix] = useState(project.homologacaoPix ?? "");

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/internal/projects/${project.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast({ title: "Homologação atualizada" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6 mb-6">
      <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
        <FileCheck2 className="w-4 h-4 text-primary" /> Homologação
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Técnico responsável</Label>
          <Select
            value={project.homologacaoTechnicianId ? String(project.homologacaoTechnicianId) : NO_TECH}
            onValueChange={(v) => patch.mutate({ homologacaoTechnicianId: v === NO_TECH ? null : Number(v) })}
          >
            <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="Não atribuído" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TECH}>Não atribuído</SelectItem>
              {(techs ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            A atribuição define o acesso deste projeto no portal do técnico.
          </p>
        </div>
        <div className="flex items-center justify-between bg-background/50 rounded-xl px-4 py-3 self-end">
          <Label className="mb-0 text-sm">Serviço pago</Label>
          <Switch
            checked={project.homologacaoPago}
            onCheckedChange={(v) => patch.mutate({ homologacaoPago: v })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Valor do serviço (R$)</Label>
          <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
            onBlur={() => patch.mutate({ homologacaoValor: valor ? Number(valor) : null })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
          <Input value={forma} onChange={(e) => setForma(e.target.value)}
            onBlur={() => patch.mutate({ homologacaoFormaPagamento: forma || null })} className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">Conta / chave PIX</Label>
          <Input value={pix} onChange={(e) => setPix(e.target.value)}
            onBlur={() => patch.mutate({ homologacaoPix: pix || null })} className="mt-1" />
        </div>
      </div>
    </div>
  );
}

function ClientIntakePanel({
  project,
  documents,
  clientIntake,
  invalidateKey,
}: {
  project: InternalProject;
  documents: ProjectDocument[];
  clientIntake: ProjectDetail["clientIntake"];
  invalidateKey: unknown[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invite = useMutation({
    mutationFn: (channel: "email" | "whatsapp" | "both") =>
      api.post<{ sent: string[]; failed?: string[] }>("/internal/projects/" + project.id + "/client-intake/invite", { channel }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast({
        title: "Convite enviado",
        description: [...result.sent, ...(result.failed ?? [])].join(" · ") || "Confira os canais configurados.",
      });
    },
    onError: (err: Error) => toast({ title: "Erro ao enviar convite", description: err.message, variant: "destructive" }),
  });

  const received = documents.filter((document) => Boolean(document.fileUrl));
  const statusLabel = clientIntake?.status === "submitted" ? "Ficha enviada pelo cliente" : clientIntake ? "Rascunho salvo pelo cliente" : "Ainda não iniciada";
  const statusClass = clientIntake?.status === "submitted"
    ? "bg-emerald-500/15 text-emerald-400"
    : clientIntake ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-muted-foreground";
  const intakeData = clientIntake?.data ?? {};
  const dataRows = [
    ["CPF/CNPJ", intakeData.cpf],
    ["RG/CNH", intakeData.rgCnh],
    ["Titularidade", intakeData.titularidadeUnidadeConsumidora],
    ["Endereço da instalação", intakeData.enderecoInstalacao],
    ["Telefone", intakeData.telefone || project.clientPhone],
    ["E-mail", intakeData.email || project.clientEmail],
    ["UC titular", intakeData.numeroUnidadeConsumidora],
    ["UC de rateio", intakeData.numeroUnidadeRateio],
    ["Senha da UC", intakeData.senhaUnidadeConsumidora ? "Cadastrada (oculta)" : undefined],
    ["Senha da UC de rateio", intakeData.senhaUnidadeRateio ? "Cadastrada (oculta)" : undefined],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Dados para projeto elétrico
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Formulário e documentos recebidos no portal do cliente.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${statusClass}`}>
          {clientIntake?.status === "submitted" && <CheckCircle2 className="w-3.5 h-3.5" />}
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <div className="rounded-xl bg-background/50 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">Documentos</p>
          <p className="text-sm text-foreground font-medium mt-1">{received.length}/{documents.length || 0} recebidos</p>
        </div>
        <div className="rounded-xl bg-background/50 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">Titular</p>
          <p className="text-sm text-foreground font-medium mt-1 truncate">{clientIntake?.data?.nomeCompleto || "—"}</p>
        </div>
        <div className="rounded-xl bg-background/50 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">Unidade consumidora</p>
          <p className="text-sm text-foreground font-medium mt-1 truncate">{clientIntake?.data?.numeroUnidadeConsumidora || "—"}</p>
        </div>
        <div className="rounded-xl bg-background/50 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">Contato</p>
          <p className="text-sm text-foreground font-medium mt-1 truncate">{clientIntake?.data?.telefone || project.clientPhone || "—"}</p>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="space-y-2 mt-5">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{document.name}</p>
                <p className="text-[11px] text-muted-foreground">{document.required ? "Obrigatório" : "Opcional"} · {document.fileUrl ? "Recebido" : "Pendente"}</p>
              </div>
              {document.fileUrl ? (
                <a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline shrink-0">Abrir</a>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {dataRows.length > 0 && (
        <div className="mt-5 pt-5 border-t border-white/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Dados preenchidos</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {dataRows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-sm text-foreground truncate mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/5">
        <span className="text-xs text-muted-foreground mr-1">Enviar formulário:</span>
        <Button variant="outline" size="sm" disabled={invite.isPending} onClick={() => invite.mutate("email")}>
          {invite.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1.5" />} E-mail
        </Button>
        <Button variant="outline" size="sm" disabled={invite.isPending} onClick={() => invite.mutate("whatsapp")}>
          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" disabled={invite.isPending} onClick={() => invite.mutate("both")}>
          <Send className="w-3.5 h-3.5 mr-1.5" /> Ambos
        </Button>
      </div>
    </div>
  );
}

export default function ProjetoDetalhePage() {
  const [, params] = useRoute("/interno/projetos/:id");
  const projectId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const queryKey = ["internal-project", projectId];

  const { data, isLoading } = useQuery<ProjectDetail>({
    queryKey,
    queryFn: () => api.get<ProjectDetail>(`/internal/projects/${projectId}`),
    enabled: Number.isFinite(projectId),
  });

  const [checklistStage, setChecklistStage] = useState<StageId | null>(null);

  const stageMutation = useMutation({
    mutationFn: (stage: StageId) => api.patch(`/internal/projects/${projectId}`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["internal-projects"] });
      toast({ title: "Etapa atualizada", description: "O cliente foi notificado no portal." });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao mudar etapa", description: err.message, variant: "destructive" }),
  });

  const subStageMutation = useMutation({
    mutationFn: (subStage: string) =>
      api.patch(`/internal/projects/${projectId}`, { subStage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["internal-projects"] });
      toast({ title: "Sub-etapa atualizada" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao mudar sub-etapa", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return (
      <InternalLayout>
        <div className="space-y-4">
          <div className="h-32 bg-card rounded-2xl border border-white/5 animate-pulse" />
          <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
        </div>
      </InternalLayout>
    );
  }

  const { project, checklist, services, supply, documents = [], clientIntake } = data;
  const activeStage = checklistStage ?? project.stage;
  const subStages = subStagesFor(project.stage);
  const badge = supplyBadge(supply);

  return (
    <InternalLayout>
      <Link href="/interno/pipeline">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao pipeline
        </span>
      </Link>

      <div className="bg-card border border-white/5 rounded-3xl p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display text-foreground mb-1">{project.clientName}</h1>
            <p className="text-sm text-muted-foreground">{project.clientEmail}</p>
            <span
              className={
                "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs " +
                (badge.tone === "done"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : badge.tone === "progress"
                    ? "bg-primary/15 text-primary"
                    : badge.tone === "pending"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-white/5 text-muted-foreground")
              }
            >
              <Package className="w-3.5 h-3.5" /> Suprimentos: {badge.label}
            </span>
          </div>
          <div className="w-full md:w-64 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Macro-etapa</label>
              <Select
                value={project.stage}
                onValueChange={(v) => stageMutation.mutate(v as StageId)}
              >
                <SelectTrigger className="h-10">
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
            </div>
            {subStages.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sub-etapa</label>
                <Select
                  value={
                    subStages.some((g) => g.slug === project.subStage)
                      ? (project.subStage as string)
                      : undefined
                  }
                  onValueChange={(v) => subStageMutation.mutate(v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subStages.map((g) => (
                      <SelectItem key={g.slug} value={g.slug}>
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-background/50 rounded-2xl p-4">
            <Zap className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Potência</p>
            <p className="text-foreground font-medium">{project.systemPower} kWp</p>
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <MapPin className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Local</p>
            <p className="text-foreground font-medium">
              {project.city}/{project.state}
            </p>
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <Wallet className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Capex</p>
            <p className="text-foreground font-medium">{formatBRL(project.capex)}</p>
            {project.custoMateriais != null && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Materiais: {formatBRL(project.custoMateriais)}
              </p>
            )}
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <TrendingUp className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Receita bruta</p>
            <p className="text-foreground font-medium">{formatBRL(project.receitaBruta)}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
          {STAGES_WITH_CHECKLIST.map((s) => (
            <button
              key={s}
              onClick={() => setChecklistStage(s)}
              className={
                s === activeStage
                  ? "px-3 py-1.5 rounded-full text-xs whitespace-nowrap bg-primary/15 text-primary"
                  : "px-3 py-1.5 rounded-full text-xs whitespace-nowrap text-muted-foreground hover:text-foreground"
              }
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        <ChecklistGroups
          projectId={project.id}
          stage={activeStage}
          items={checklist.filter((i) => i.stage === activeStage)}
          invalidateKeys={[queryKey]}
          acoesCumpridas={data.acoesCumpridas}
          onAtalho={(a) => {
            if (a.tipo === "rota") navigate(a.destino);
            else document.getElementById(`bloco-${a.destino}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      </div>

      <NotificarWhatsApp projectId={project.id} invalidateKeys={[queryKey]} />

      <ClientIntakePanel
        project={project}
        documents={documents}
        clientIntake={clientIntake}
        invalidateKey={queryKey}
      />

      <FinanceiroSection project={project} invalidateKey={queryKey} />

      <ComprasSection projectId={project.id} invalidateKeys={[queryKey, ["internal-projects"]]} />

      <HomologacaoAssignment project={project} invalidateKey={queryKey} />

      <div className="mb-6">
        <ProcessoFicha
          projectId={project.id}
          basePath={`/internal/projects/${project.id}/processo`}
        />
      </div>

      <div className="mb-6">

        <PlantCard projectId={project.id} />

      </div>

      <div className="bg-card border border-white/5 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" /> Serviços vinculados
          </h2>
          <Link href="/interno/servicos">
            <Button variant="outline" size="sm">
              Ver todos
            </Button>
          </Link>
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço vinculado a este projeto.</p>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 bg-background/50 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.tipoServico ?? "—"} · {formatBRL(s.valorServico)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-foreground">{s.status}</p>
                  <p className="text-xs text-muted-foreground">{s.statusPagamento}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </InternalLayout>
  );
}
