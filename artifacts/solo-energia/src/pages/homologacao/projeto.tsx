import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Zap,
  MapPin,
  Calendar,
  FileText,
  Wallet,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Loader2,
  NotebookPen,
} from "lucide-react";
import { HomologacaoLayout } from "@/components/homologacao-layout";
import { ProcessoFicha } from "@/components/processo-ficha";
import { useToast } from "@/hooks/use-toast";
import { STAGES, STAGE_LABELS, CHECKLIST_TEMPLATE, formatBRL, type ChecklistItem, type InternalProject } from "@/lib/internal-api";

// Map checklistSlug → human title for homologação groups
const HOMO_GROUP_TITLE: Record<string, string> = Object.fromEntries(
  CHECKLIST_TEMPLATE.projeto_tecnico_homologacao
    .filter((g) => g.slug.startsWith("homologacao"))
    .map((g) => [g.slug, g.title])
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: number;
  name: string;
  type: string;
  category: string;
  displayCategory: string | null;
  required: boolean;
  description: string | null;
  fileUrl: string | null;
  uploadedAt: string | null;
}

interface Service {
  id: number;
  name: string;
  tipoServico: string | null;
  status: string;
  statusPagamento: string;
  pagamentoRealizado: boolean;
}

interface ProjectDetail {
  project: InternalProject;
  checklist: ChecklistItem[];
  documents: Document[];
  services: Service[];
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchProjectDetail(id: number): Promise<ProjectDetail> {
  const res = await fetch(`/api/homologacao/projects/${id}`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Erro ao carregar projeto");
  }
  return res.json();
}

async function patchProject(id: number, body: Record<string, unknown>) {
  const res = await fetch(`/api/homologacao/projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Erro ao atualizar projeto");
  }
  return res.json();
}

async function patchChecklistItem(itemId: number, done: boolean, doneBy?: string) {
  const res = await fetch(`/api/homologacao/checklist/${itemId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done, doneBy }),
  });
  if (!res.ok) throw new Error("Erro ao atualizar item");
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Stages a technician may move a project to — mirrors server-side ALLOWED_TECHNICIAN_STAGES */
const HOMOLOGACAO_STAGES = STAGES.filter((s) =>
  ["projeto_tecnico_homologacao", "pendencias", "pausado"].includes(s)
);

function StageSelect({
  projectId,
  currentStage,
  onUpdated,
}: {
  projectId: number;
  currentStage: string;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: (stage: string) => patchProject(projectId, { stage }),
    onSuccess: () => {
      onUpdated();
      toast({ title: "Etapa atualizada", description: "O cliente foi notificado." });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="w-full md:w-64">
      <label className="block text-xs text-muted-foreground mb-1">Etapa do pipeline</label>
      <select
        value={currentStage}
        onChange={(e) => mutation.mutate(e.target.value)}
        disabled={mutation.isPending}
        className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
      >
        {HOMOLOGACAO_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function NotesEditor({
  projectId,
  initialNotes,
  onUpdated,
}: {
  projectId: number;
  initialNotes: string | null;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => patchProject(projectId, { notes }),
    onSuccess: () => {
      setEditing(false);
      onUpdated();
      toast({ title: "Observações salvas" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  if (!editing) {
    return (
      <div className="bg-background/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <NotebookPen className="w-3 h-3" /> Observações
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            {notes ? "Editar" : "Adicionar"}
          </button>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {notes || <span className="text-muted-foreground italic">Nenhuma observação</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background/50 rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <NotebookPen className="w-3 h-3" /> Observações
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
        placeholder="Adicione observações sobre este projeto…"
      />
      <div className="flex gap-2 mt-2 justify-end">
        <button
          onClick={() => {
            setNotes(initialNotes ?? "");
            setEditing(false);
          }}
          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5"
        >
          Cancelar
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 disabled:opacity-50 flex items-center gap-1"
        >
          {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

function ChecklistPanel({
  items,
  onItemToggle,
}: {
  items: ChecklistItem[];
  onItemToggle: (id: number, done: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Group by checklistSlug
  const groups: Record<string, { title: string; items: ChecklistItem[] }> = {};
  for (const item of items) {
    const key = item.checklistSlug ?? "outros";
    if (!groups[key]) groups[key] = { title: HOMO_GROUP_TITLE[key] ?? key, items: [] };
    groups[key].items.push(item);
  }

  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6">
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setExpanded((v) => !v)}
      >
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          Checklist de Homologação
          <span className="text-xs font-normal text-muted-foreground">
            {done}/{total}
          </span>
        </h2>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-5">
          {Object.entries(groups).map(([key, group]) => (
            <div key={key}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onItemToggle(item.id, !item.done)}
                    className="flex items-start gap-3 w-full text-left px-3 py-2 rounded-xl hover:bg-background/50 transition-colors group"
                  >
                    {item.done ? (
                      <CheckSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm ${
                          item.done
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </p>
                      {item.done && item.doneBy && (
                        <p className="text-xs text-muted-foreground">por {item.doneBy}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsPanel({ documents }: { documents: Document[] }) {
  const required = documents.filter((d) => d.required);
  const optional = documents.filter((d) => !d.required);

  function DocRow({ doc }: { doc: Document }) {
    return (
      <div className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">{doc.name}</p>
          <p className="text-xs text-muted-foreground">{doc.type}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {doc.fileUrl ? (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Ver
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Pendente</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6">
      <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" /> Documentos
      </h2>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {required.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Obrigatórios
              </p>
              {required.map((d) => (
                <DocRow key={d.id} doc={d} />
              ))}
            </>
          )}
          {optional.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 mt-3">
                Opcionais
              </p>
              {optional.map((d) => (
                <DocRow key={d.id} doc={d} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentPanel({ services }: { services: Service[] }) {
  const relevant = services.filter(
    (s) => !s.tipoServico || s.tipoServico === "Homologação" || s.tipoServico === "Projeto"
  );
  const total = relevant.length;
  const paid = relevant.filter((s) => s.pagamentoRealizado).length;
  const pending = total - paid;

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6">
      <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-primary" /> Honorários / Pagamentos
      </h2>

      {relevant.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum serviço vinculado.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-background/50 rounded-2xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Serviços</p>
              <p className="text-sm font-medium text-foreground">{total}</p>
            </div>
            <div className="bg-background/50 rounded-2xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pagos</p>
              <p className="text-sm font-medium text-green-400">{paid}</p>
            </div>
            <div className="bg-background/50 rounded-2xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
              <p className={`text-sm font-medium ${pending > 0 ? "text-yellow-400" : "text-foreground"}`}>
                {pending}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {relevant.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.tipoServico ?? "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-xs ${
                      s.pagamentoRealizado ? "text-green-400" : "text-yellow-400"
                    }`}
                  >
                    {s.pagamentoRealizado ? "Pago" : s.statusPagamento}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomologacaoProjetoPage() {
  const [, params] = useRoute("/homologacao/projetos/:id");
  const projectId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["homologacao-project", projectId];

  const { data, isLoading } = useQuery<ProjectDetail>({
    queryKey,
    queryFn: () => fetchProjectDetail(projectId),
    enabled: Number.isFinite(projectId),
  });

  const checklistMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      patchChecklistItem(id, done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["homologacao-projects"] });
  }

  if (isLoading || !data) {
    return (
      <HomologacaoLayout>
        <div className="space-y-4">
          <div className="h-32 bg-card rounded-2xl border border-white/5 animate-pulse" />
          <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
        </div>
      </HomologacaoLayout>
    );
  }

  const { project, checklist, documents, services } = data;
  // Da macro-etapa fundida, o técnico só vê os grupos de homologação.
  const homoChecklist = checklist.filter(
    (i) => i.stage === "projeto_tecnico_homologacao" && i.checklistSlug.startsWith("homologacao"),
  );
  const deadline =
    project.estimatedActivation ??
    (project as any).dataConclusaoPrevista ??
    (project as any).estimatedDate;

  return (
    <HomologacaoLayout>
      <Link href="/homologacao/projetos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar à lista
              </Link>

      {/* Header card */}
      <div className="bg-card border border-white/5 rounded-3xl p-6 md:p-8 mb-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display text-foreground mb-1">
              {project.clientName}
            </h1>
            <p className="text-sm text-muted-foreground">{project.clientEmail}</p>
          </div>
          <StageSelect
            projectId={project.id}
            currentStage={project.stage}
            onUpdated={invalidate}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <Calendar className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Prazo</p>
            <p className="text-foreground font-medium">{deadline ?? "—"}</p>
          </div>
          <div className="bg-background/50 rounded-2xl p-4">
            <CheckSquare className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Progresso</p>
            <p className="text-foreground font-medium">{project.completionPercent}%</p>
          </div>
        </div>
      </div>

      {/* Pagamento do serviço de homologação */}
      {(project.homologacaoValor != null || project.homologacaoFormaPagamento || project.homologacaoPix) && (
        <div className="bg-card border border-white/5 rounded-3xl p-6 mb-5">
          <h2 className="text-sm font-medium text-foreground mb-3">Pagamento do serviço</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background/50 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-foreground font-medium">{formatBRL(project.homologacaoValor)}</p>
            </div>
            <div className="bg-background/50 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={project.homologacaoPago ? "text-energy-green font-medium" : "text-chart-3 font-medium"}>
                {project.homologacaoPago ? "Pago" : "Pendente"}
              </p>
            </div>
            <div className="bg-background/50 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">Forma</p>
              <p className="text-foreground font-medium">{project.homologacaoFormaPagamento ?? "—"}</p>
            </div>
            <div className="bg-background/50 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">Conta / PIX</p>
              <p className="text-foreground font-medium truncate">{project.homologacaoPix ?? "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ficha do processo Enel */}
      <div className="mb-5">
        <ProcessoFicha
          projectId={project.id}
          basePath={`/homologacao/projects/${project.id}/processo`}
          uploadPath={`/homologacao/projects/${project.id}/processo/art-nf`}
        />
      </div>

      {/* Notes */}
      <div className="mb-5">
        <NotesEditor
          projectId={project.id}
          initialNotes={project.notes}
          onUpdated={invalidate}
        />
      </div>

      {/* Checklist */}
      <div className="mb-5">
        <ChecklistPanel
          items={homoChecklist}
          onItemToggle={(id, done) => checklistMutation.mutate({ id, done })}
        />
      </div>

      {/* Documents */}
      <div className="mb-5">
        <DocumentsPanel documents={documents} />
      </div>

      {/* Payments */}
      <PaymentPanel services={services} />
    </HomologacaoLayout>
  );
}
