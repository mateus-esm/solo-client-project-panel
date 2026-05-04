import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Upload, Eye, CheckCircle2,
  FileText, Bell, Calendar, CreditCard, Settings, Download, RotateCcw, X,
} from "lucide-react";
import { useAdminLogout } from "@/hooks/use-admin-auth";
import logoLight from "@assets/001_1775433962945.png";

const STEPS = ["", "Onboarding", "Projeto Técnico", "Homologação", "Logística", "Execução", "Ativação", "Treinamento"];
const DOC_CATEGORIES = [
  { value: "entrada", label: "Entrada (cliente envia)" },
  { value: "intra_projeto", label: "Projeto (Solo envia)" },
];
const DISPLAY_CATEGORIES = [
  { value: "cliente", label: "Documentos do Cliente" },
  { value: "engenharia", label: "Projeto de Engenharia" },
  { value: "fiscal", label: "Notas Fiscais" },
  { value: "legal", label: "Documentos Legais (ART/FSA)" },
  { value: "equipamentos", label: "Equipamentos / Datasheets" },
];
const PAYMENT_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasado" },
];
const SCHED_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "client_confirmed", label: "Cliente Confirmou" },
  { value: "cancelled", label: "Cancelado" },
];

type Project = Record<string, unknown> & {
  id: number;
  clientName: string;
  clientEmail: string;
  sectionVisibility: { payments: boolean; scheduling: boolean; tracking: boolean; chat: boolean };
  schedulingLink: string | null;
};
type Doc = { id: number; name: string; type: string; category: string; displayCategory: string; required: boolean; description: string | null; fileUrl: string | null; uploadedAt: string | null; createdAt: string };
type Payment = { id: number; installmentNumber: number; amount: number; dueDate: string; paidDate: string | null; status: string; description: string | null };
type Notification = { id: number; title: string; message: string; read: boolean; createdAt: string };
type SchedRequest = { id: number; requestedDate: string; notes: string | null; status: string; createdAt: string };

function apiFetch(url: string, opts?: RequestInit) {
  return fetch(url, { credentials: "include", ...opts });
}

export default function AdminProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id!, 10);
  const logoutMutation = useAdminLogout();

  const [activeTab, setActiveTab] = useState<"geral" | "documentos" | "pagamentos" | "notificacoes" | "agendamento">("geral");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Sub-resources
  const [docs, setDocs] = useState<Doc[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [schedRequests, setSchedRequests] = useState<SchedRequest[]>([]);

  // Form state for Geral tab
  const [form, setForm] = useState<Record<string, string>>({});
  const [sectionViz, setSectionViz] = useState({ payments: true, scheduling: true, tracking: true, chat: true });
  const [schedulingLink, setSchedulingLink] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pRes] = await Promise.all([apiFetch(`/api/admin/projects/${projectId}`)]);
        const p = await pRes.json();
        setProject(p);
        setForm({
          clientName: p.clientName ?? "",
          clientEmail: p.clientEmail ?? "",
          clientPhone: p.clientPhone ?? "",
          systemPower: p.systemPower?.toString() ?? "",
          statusStep: p.statusStep?.toString() ?? "1",
          city: p.city ?? "",
          state: p.state ?? "",
          valorProjeto: p.valorProjeto?.toString() ?? "",
          formaDePagamento: p.formaDePagamento ?? "",
          observacoesGerais: p.observacoesGerais ?? "",
          notes: p.notes ?? "",
          estimatedActivation: p.estimatedActivation ?? "",
          trackingCode: p.trackingCode ?? "",
          trackingCarrier: p.trackingCarrier ?? "",
          dataInicioPrevista: p.dataInicioPrevista ?? "",
          dataConclusaoPrevista: p.dataConclusaoPrevista ?? "",
          dataDeFechamento: p.dataDeFechamento ?? "",
          dataDePagamento: p.dataDePagamento ?? "",
          dataDeCompras: p.dataDeCompras ?? "",
          dataDeEntregaDoEquipamento: p.dataDeEntregaDoEquipamento ?? "",
        });
        setSectionViz(p.sectionVisibility ?? { payments: true, scheduling: true, tracking: true, chat: true });
        setSchedulingLink(p.schedulingLink ?? "");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const loadDocs = useCallback(async () => {
    const r = await apiFetch(`/api/admin/projects/${projectId}/documents`);
    setDocs(await r.json());
  }, [projectId]);

  const loadPayments = useCallback(async () => {
    const r = await apiFetch(`/api/admin/projects/${projectId}/payments`);
    setPayments(await r.json());
  }, [projectId]);

  const loadNotifications = useCallback(async () => {
    const r = await apiFetch(`/api/admin/projects/${projectId}/notifications`);
    setNotifications(await r.json());
  }, [projectId]);

  const loadScheduling = useCallback(async () => {
    const r = await apiFetch(`/api/admin/projects/${projectId}/scheduling`);
    setSchedRequests(await r.json());
  }, [projectId]);

  useEffect(() => {
    if (activeTab === "documentos") loadDocs();
    if (activeTab === "pagamentos") loadPayments();
    if (activeTab === "notificacoes") loadNotifications();
    if (activeTab === "agendamento") loadScheduling();
  }, [activeTab, loadDocs, loadPayments, loadNotifications, loadScheduling]);

  async function saveGeral() {
    setSaving(true);
    setSaveMsg("");
    try {
      const body = {
        ...form,
        systemPower: form.systemPower ? parseFloat(form.systemPower) : undefined,
        valorProjeto: form.valorProjeto ? parseFloat(form.valorProjeto) : undefined,
        statusStep: parseInt(form.statusStep, 10),
        schedulingLink: schedulingLink || null,
        sectionVisibility: sectionViz,
      };
      const res = await apiFetch(`/api/admin/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveMsg("Salvo com sucesso!");
        setTimeout(() => setSaveMsg(""), 2500);
      } else {
        const d = await res.json();
        setSaveMsg(d.message ?? "Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { id: "geral", label: "Geral", icon: Settings },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
    { id: "notificacoes", label: "Notificações", icon: Bell },
    { id: "agendamento", label: "Agendamento", icon: Calendar },
  ] as const;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Projeto não encontrado
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/admin" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={logoLight} alt="Solo Energia" className="h-5 opacity-80" />
          <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-0.5 rounded-md">ADMIN</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">{project.clientName as string}</h1>
            <p className="text-xs text-muted-foreground truncate">{project.clientEmail as string}</p>
          </div>
          <button onClick={() => logoutMutation.mutate()} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Sair</button>
        </div>
        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto pb-0 border-t border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === "geral" && (
          <GeralTab
            form={form}
            setForm={setForm}
            sectionViz={sectionViz}
            setSectionViz={setSectionViz}
            schedulingLink={schedulingLink}
            setSchedulingLink={setSchedulingLink}
            saving={saving}
            saveMsg={saveMsg}
            onSave={saveGeral}
          />
        )}
        {activeTab === "documentos" && (
          <DocumentosTab projectId={projectId} docs={docs} onRefresh={loadDocs} />
        )}
        {activeTab === "pagamentos" && (
          <PagamentosTab projectId={projectId} payments={payments} onRefresh={loadPayments} />
        )}
        {activeTab === "notificacoes" && (
          <NotificacoesTab projectId={projectId} notifications={notifications} onRefresh={loadNotifications} />
        )}
        {activeTab === "agendamento" && (
          <AgendamentoTab schedRequests={schedRequests} onRefresh={loadScheduling} />
        )}
      </main>
    </div>
  );
}

// ─── Geral Tab ────────────────────────────────────────────────────────────────

function GeralTab({
  form, setForm, sectionViz, setSectionViz, schedulingLink, setSchedulingLink, saving, saveMsg, onSave,
}: {
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sectionViz: { payments: boolean; scheduling: boolean; tracking: boolean; chat: boolean };
  setSectionViz: React.Dispatch<React.SetStateAction<{ payments: boolean; scheduling: boolean; tracking: boolean; chat: boolean }>>;
  schedulingLink: string;
  setSchedulingLink: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  saveMsg: string;
  onSave: () => void;
}) {
  function f(key: string, v: string) { setForm((p) => ({ ...p, [key]: v })); }

  return (
    <div className="space-y-6">
      <Section title="Dados do Cliente">
        <Field label="Nome Completo"><Input value={form.clientName} onChange={(v) => f("clientName", v)} /></Field>
        <Field label="Email"><Input type="email" value={form.clientEmail} onChange={(v) => f("clientEmail", v)} /></Field>
        <Field label="Telefone / WhatsApp"><Input value={form.clientPhone} onChange={(v) => f("clientPhone", v)} /></Field>
      </Section>

      <Section title="Localização">
        <Field label="Cidade"><Input value={form.city} onChange={(v) => f("city", v)} /></Field>
        <Field label="Estado"><Input value={form.state} onChange={(v) => f("state", v)} /></Field>
      </Section>

      <Section title="Projeto Solar">
        <Field label="Potência (kWp)"><Input type="number" step="0.01" value={form.systemPower} onChange={(v) => f("systemPower", v)} /></Field>
        <Field label="Fase Atual">
          <select value={form.statusStep} onChange={(e) => f("statusStep", e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
            {STEPS.slice(1).map((s, i) => <option key={i + 1} value={i + 1}>{i + 1} — {s}</option>)}
          </select>
        </Field>
        <Field label="Ativação Prevista"><Input value={form.estimatedActivation} onChange={(v) => f("estimatedActivation", v)} placeholder="2024-12-01" /></Field>
        <Field label="Início Previsto"><Input value={form.dataInicioPrevista} onChange={(v) => f("dataInicioPrevista", v)} /></Field>
        <Field label="Conclusão Prevista"><Input value={form.dataConclusaoPrevista} onChange={(v) => f("dataConclusaoPrevista", v)} /></Field>
        <Field label="Data de Fechamento"><Input value={form.dataDeFechamento} onChange={(v) => f("dataDeFechamento", v)} /></Field>
        <Field label="Data de Pagamento"><Input value={form.dataDePagamento} onChange={(v) => f("dataDePagamento", v)} /></Field>
        <Field label="Data de Compras"><Input value={form.dataDeCompras} onChange={(v) => f("dataDeCompras", v)} /></Field>
        <Field label="Entrega do Equipamento"><Input value={form.dataDeEntregaDoEquipamento} onChange={(v) => f("dataDeEntregaDoEquipamento", v)} /></Field>
      </Section>

      <Section title="Logística">
        <Field label="Código de Rastreio"><Input value={form.trackingCode} onChange={(v) => f("trackingCode", v)} /></Field>
        <Field label="Transportadora"><Input value={form.trackingCarrier} onChange={(v) => f("trackingCarrier", v)} /></Field>
      </Section>

      <Section title="Financeiro">
        <Field label="Valor do Projeto (R$)"><Input type="number" step="0.01" value={form.valorProjeto} onChange={(v) => f("valorProjeto", v)} /></Field>
        <Field label="Forma de Pagamento"><Input value={form.formaDePagamento} onChange={(v) => f("formaDePagamento", v)} /></Field>
      </Section>

      <Section title="Agendamento">
        <Field label="Link de Agendamento (Calendly, Cal.com…)" className="md:col-span-2">
          <Input value={schedulingLink} onChange={setSchedulingLink} placeholder="https://calendly.com/solo-energia/visita" />
        </Field>
      </Section>

      <Section title="Observações">
        <Field label="Observações para o Cliente" className="md:col-span-2">
          <textarea value={form.observacoesGerais} onChange={(e) => f("observacoesGerais", e.target.value)} rows={3}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        </Field>
        <Field label="Notas Internas (não visível ao cliente)" className="md:col-span-2">
          <textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} rows={3}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        </Field>
      </Section>

      {/* Visibilidade de Seções */}
      <div className="glass-card rounded-3xl p-6">
        <h2 className="text-base font-bold text-foreground mb-1 pb-3 border-b border-border">Visibilidade de Seções</h2>
        <p className="text-xs text-muted-foreground mb-4">Desative seções que não fazem sentido para este cliente</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(sectionViz) as (keyof typeof sectionViz)[]).map((key) => {
            const labels: Record<string, string> = { payments: "Pagamentos", scheduling: "Agendamento", tracking: "Rastreamento", chat: "Chat IA" };
            return (
              <button
                key={key}
                onClick={() => setSectionViz((p) => ({ ...p, [key]: !p[key] }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  sectionViz[key]
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sectionViz[key] ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                  {sectionViz[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                {labels[key]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end">
        {saveMsg && (
          <span className={`text-sm font-medium ${saveMsg.includes("sucesso") ? "text-green-400" : "text-red-400"}`}>
            {saveMsg}
          </span>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}

// ─── Documentos Tab ───────────────────────────────────────────────────────────

function DocumentosTab({ projectId, docs, onRefresh }: { projectId: number; docs: Doc[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: "", category: "entrada", displayCategory: "cliente", required: false, description: "" });
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function addDoc() {
    setAdding(true);
    await apiFetch(`/api/admin/projects/${projectId}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDoc),
    });
    setAdding(false);
    setShowAdd(false);
    setNewDoc({ name: "", category: "entrada", displayCategory: "cliente", required: false, description: "" });
    onRefresh();
  }

  async function deleteDoc(id: number) {
    if (!confirm("Remover documento?")) return;
    setDeleting(id);
    await apiFetch(`/api/admin/documents/${id}`, { method: "DELETE" });
    setDeleting(null);
    onRefresh();
  }

  async function toggleRequired(doc: Doc) {
    await apiFetch(`/api/admin/documents/${doc.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ required: !doc.required }),
    });
    onRefresh();
  }

  async function uploadFile(docId: number, file: File) {
    setUploading(docId);
    const fd = new FormData();
    fd.append("file", file);
    await apiFetch(`/api/admin/documents/${docId}/upload`, { method: "POST", body: fd });
    setUploading(null);
    onRefresh();
  }

  const DISP_LABEL: Record<string, string> = {
    cliente: "Documentos do Cliente", engenharia: "Projeto de Engenharia",
    fiscal: "Notas Fiscais", legal: "Documentos Legais", equipamentos: "Equipamentos",
  };

  const grouped: Record<string, Doc[]> = {};
  for (const doc of docs) {
    const key = doc.displayCategory || (doc.category === "entrada" ? "cliente" : "engenharia");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(doc);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{docs.length} documento{docs.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl transition-all hover:opacity-90 text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> Adicionar Slot
        </button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold">Novo Documento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Nome</label>
              <input value={newDoc.name} onChange={(e) => setNewDoc((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: ART — Anotação de Responsabilidade"
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Permissão de Upload</label>
              <select value={newDoc.category} onChange={(e) => setNewDoc((p) => ({ ...p, category: e.target.value }))}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Seção Visual</label>
              <select value={newDoc.displayCategory} onChange={(e) => setNewDoc((p) => ({ ...p, displayCategory: e.target.value }))}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                {DISPLAY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Descrição</label>
              <input value={newDoc.description} onChange={(e) => setNewDoc((p) => ({ ...p, description: e.target.value }))}
                placeholder="Texto de ajuda para o cliente"
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newDoc.required} onChange={(e) => setNewDoc((p) => ({ ...p, required: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-foreground">Obrigatório</span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-bold bg-secondary rounded-xl hover:bg-white/10 transition-colors">Cancelar</button>
            <button onClick={addDoc} disabled={!newDoc.name || adding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl text-white disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Adicionar
            </button>
          </div>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum documento cadastrado</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catDocs]) => (
          <div key={cat}>
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              {DISP_LABEL[cat] ?? cat}
              <span className="h-px flex-1 bg-border" />
            </h3>
            <div className="space-y-2">
              {catDocs.map((doc) => (
                <div key={doc.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <FileText className={`w-4 h-4 ${doc.type === "available_download" ? "text-green-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${
                        doc.category === "entrada" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}>
                        {doc.category === "entrada" ? "cliente envia" : "solo envia"}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${
                        doc.type === "available_download" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-secondary text-muted-foreground border-border"
                      }`}>
                        {doc.type === "available_download" ? "enviado ✓" : "pendente"}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-mono cursor-pointer hover:opacity-70 transition-opacity ${
                        doc.required ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-secondary text-muted-foreground border-border"
                      }`} onClick={() => toggleRequired(doc)}>
                        {doc.required ? "obrigatório" : "opcional"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </a>
                    )}
                    <input ref={(el) => { fileRefs.current[doc.id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(doc.id, f); }} />
                    <button onClick={() => fileRefs.current[doc.id]?.click()} disabled={uploading === doc.id}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                      {uploading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteDoc(doc.id)} disabled={deleting === doc.id}
                      className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      {deleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Pagamentos Tab ───────────────────────────────────────────────────────────

function PagamentosTab({ projectId, payments, onRefresh }: { projectId: number; payments: Payment[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newP, setNewP] = useState({ installmentNumber: "", amount: "", dueDate: "", status: "pending", description: "" });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Record<number, Partial<Payment>>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  async function addPayment() {
    setAdding(true);
    await apiFetch(`/api/admin/projects/${projectId}/payments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newP, installmentNumber: Number(newP.installmentNumber), amount: Number(newP.amount) }),
    });
    setAdding(false);
    setShowAdd(false);
    setNewP({ installmentNumber: "", amount: "", dueDate: "", status: "pending", description: "" });
    onRefresh();
  }

  async function savePayment(id: number) {
    setSaving(id);
    await apiFetch(`/api/admin/payments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing[id]),
    });
    setSaving(null);
    setEditing((p) => { const n = { ...p }; delete n[id]; return n; });
    onRefresh();
  }

  async function deletePayment(id: number) {
    if (!confirm("Remover parcela?")) return;
    setDeleting(id);
    await apiFetch(`/api/admin/payments/${id}`, { method: "DELETE" });
    setDeleting(null);
    onRefresh();
  }

  function patchEdit(id: number, field: string, value: unknown) {
    setEditing((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  }

  const STATUS_COLORS: Record<string, string> = {
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    overdue: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const STATUS_LABELS: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Atrasado" };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">Total</p>
          <p className="text-xl font-display">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">Pago</p>
          <p className="text-xl font-display text-green-400">R$ {paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">Restante</p>
          <p className="text-xl font-display text-yellow-400">R$ {(total - paid).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl text-white hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}>
          <Plus className="w-4 h-4" /> Nova Parcela
        </button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold">Nova Parcela</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase">Nº Parcela</label>
              <input type="number" value={newP.installmentNumber} onChange={(e) => setNewP((p) => ({ ...p, installmentNumber: e.target.value }))}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase">Valor (R$)</label>
              <input type="number" step="0.01" value={newP.amount} onChange={(e) => setNewP((p) => ({ ...p, amount: e.target.value }))}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase">Vencimento</label>
              <input type="date" value={newP.dueDate} onChange={(e) => setNewP((p) => ({ ...p, dueDate: e.target.value }))}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase">Status</label>
              <select value={newP.status} onChange={(e) => setNewP((p) => ({ ...p, status: e.target.value }))}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-bold bg-secondary rounded-xl hover:bg-white/10">Cancelar</button>
            <button onClick={addPayment} disabled={!newP.installmentNumber || !newP.amount || !newP.dueDate || adding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl text-white disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Adicionar
            </button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma parcela cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const ed = editing[p.id];
            const isEditing = !!ed;
            return (
              <div key={p.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 font-bold text-sm font-mono">
                  {ed?.installmentNumber ?? p.installmentNumber}
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {isEditing ? (
                    <>
                      <input type="number" step="0.01" defaultValue={p.amount} onChange={(e) => patchEdit(p.id, "amount", Number(e.target.value))}
                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                      <input type="date" defaultValue={p.dueDate} onChange={(e) => patchEdit(p.id, "dueDate", e.target.value)}
                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                      <select defaultValue={p.status} onChange={(e) => patchEdit(p.id, "status", e.target.value)}
                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                        {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <input type="date" placeholder="Data de pagamento" defaultValue={p.paidDate ?? ""} onChange={(e) => patchEdit(p.id, "paidDate", e.target.value)}
                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-bold">R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span className="text-sm text-muted-foreground">{p.dueDate}</span>
                      <span className={`text-xs self-center px-2 py-0.5 rounded border font-mono w-fit ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      <span className="text-xs text-muted-foreground self-center">{p.paidDate ? `Pago: ${p.paidDate}` : "—"}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => savePayment(p.id)} disabled={saving === p.id}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors">
                        {saving === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[p.id]; return n; })}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => patchEdit(p.id, "_init", true)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors text-xs font-bold px-3">
                      Editar
                    </button>
                  )}
                  <button onClick={() => deletePayment(p.id)} disabled={deleting === p.id}
                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Notificações Tab ─────────────────────────────────────────────────────────

function NotificacoesTab({ projectId, notifications, onRefresh }: { projectId: number; notifications: Notification[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newN, setNewN] = useState({ title: "", message: "" });
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function addNotification() {
    setAdding(true);
    await apiFetch(`/api/admin/projects/${projectId}/notifications`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newN),
    });
    setAdding(false);
    setShowAdd(false);
    setNewN({ title: "", message: "" });
    onRefresh();
  }

  async function deleteNotif(id: number) {
    if (!confirm("Remover notificação?")) return;
    setDeleting(id);
    await apiFetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    setDeleting(null);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl text-white hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}>
          <Plus className="w-4 h-4" /> Nova Notificação
        </button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold">Nova Notificação</h3>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase">Título</label>
            <input value={newN.title} onChange={(e) => setNewN((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Projeto aprovado!"
              className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase">Mensagem</label>
            <textarea value={newN.message} onChange={(e) => setNewN((p) => ({ ...p, message: e.target.value }))} rows={3}
              placeholder="Detalhes da notificação…"
              className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-bold bg-secondary rounded-xl hover:bg-white/10">Cancelar</button>
            <button onClick={addNotification} disabled={!newN.title || !newN.message || adding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl text-white disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Enviar
            </button>
          </div>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma notificação enviada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.read ? "bg-muted-foreground" : "bg-primary"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <button onClick={() => deleteNotif(n.id)} disabled={deleting === n.id}
                className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                {deleting === n.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agendamento Tab ──────────────────────────────────────────────────────────

function AgendamentoTab({ schedRequests, onRefresh }: { schedRequests: SchedRequest[]; onRefresh: () => void }) {
  const [updating, setUpdating] = useState<number | null>(null);

  async function updateStatus(id: number, status: string) {
    setUpdating(id);
    await apiFetch(`/api/admin/scheduling/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    onRefresh();
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    client_confirmed: "bg-green-500/10 text-green-400 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendente", confirmed: "Equipe Confirmou",
    client_confirmed: "Cliente Confirmou", cancelled: "Cancelado",
  };

  return (
    <div className="space-y-4">
      {schedRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma solicitação de agendamento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedRequests.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-bold">{r.requestedDate}</p>
                  {r.notes && <p className="text-sm text-muted-foreground mt-1">{r.notes}</p>}
                  <p className="text-xs text-muted-foreground font-mono mt-1">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded border whitespace-nowrap ${STATUS_COLORS[r.status] ?? STATUS_COLORS.pending}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {SCHED_STATUSES.filter((s) => s.value !== r.status).map((s) => (
                  <button key={s.value} onClick={() => updateStatus(r.id, s.value)} disabled={updating === r.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-white/10 text-foreground font-medium transition-colors disabled:opacity-50">
                    {updating === r.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : `→ ${s.label}`}
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

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-3xl p-6">
      <h2 className="text-base font-bold text-foreground mb-4 pb-3 border-b border-border">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", step }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; step?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} step={step}
      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
  );
}
