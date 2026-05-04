import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const STEPS = ["Onboarding", "Projeto Técnico", "Homologação", "Logística", "Execução", "Ativação", "Treinamento"];

export default function AdminNewProject() {
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    systemPower: "",
    statusStep: "1",
    city: "",
    state: "",
    valorProjeto: "",
    formaDePagamento: "",
    observacoesGerais: "",
    notes: "",
    estimatedActivation: "",
    trackingCode: "",
    trackingCarrier: "",
    dataInicioPrevista: "",
    dataConclusaoPrevista: "",
    schedulingLink: "",
  });

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const body: Record<string, unknown> = { ...form };
      if (form.systemPower) body.systemPower = parseFloat(form.systemPower);
      if (form.valorProjeto) body.valorProjeto = parseFloat(form.valorProjeto);
      body.statusStep = parseInt(form.statusStep, 10);

      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const project = await res.json();
        navigate(`/admin/projects/${project.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Erro ao criar projeto");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/admin" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-display">Novo Projeto</h1>
            <p className="text-xs text-muted-foreground">Cadastrar novo cliente</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Section title="Dados do Cliente">
            <Field label="Nome Completo *">
              <Input value={form.clientName} onChange={(v) => handleChange("clientName", v)} placeholder="João da Silva" required />
            </Field>
            <Field label="Email *">
              <Input type="email" value={form.clientEmail} onChange={(v) => handleChange("clientEmail", v)} placeholder="joao@email.com" required />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input value={form.clientPhone} onChange={(v) => handleChange("clientPhone", v)} placeholder="(11) 99999-9999" />
            </Field>
          </Section>

          <Section title="Localização">
            <Field label="Cidade">
              <Input value={form.city} onChange={(v) => handleChange("city", v)} placeholder="São Paulo" />
            </Field>
            <Field label="Estado">
              <Input value={form.state} onChange={(v) => handleChange("state", v)} placeholder="SP" />
            </Field>
          </Section>

          <Section title="Projeto Solar">
            <Field label="Potência do Sistema (kWp)">
              <Input type="number" step="0.01" value={form.systemPower} onChange={(v) => handleChange("systemPower", v)} placeholder="10.00" />
            </Field>
            <Field label="Fase Atual">
              <select
                value={form.statusStep}
                onChange={(e) => handleChange("statusStep", e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              >
                {STEPS.map((s, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1} — {s}</option>
                ))}
              </select>
            </Field>
            <Field label="Ativação Prevista">
              <Input value={form.estimatedActivation} onChange={(v) => handleChange("estimatedActivation", v)} placeholder="2024-12-01" />
            </Field>
            <Field label="Início Previsto">
              <Input value={form.dataInicioPrevista} onChange={(v) => handleChange("dataInicioPrevista", v)} placeholder="2024-09-01" />
            </Field>
            <Field label="Conclusão Prevista">
              <Input value={form.dataConclusaoPrevista} onChange={(v) => handleChange("dataConclusaoPrevista", v)} placeholder="2024-12-01" />
            </Field>
          </Section>

          <Section title="Financeiro">
            <Field label="Valor do Projeto (R$)">
              <Input type="number" step="0.01" value={form.valorProjeto} onChange={(v) => handleChange("valorProjeto", v)} placeholder="45000.00" />
            </Field>
            <Field label="Forma de Pagamento">
              <Input value={form.formaDePagamento} onChange={(v) => handleChange("formaDePagamento", v)} placeholder="Financiamento / À vista" />
            </Field>
          </Section>

          <Section title="Logística">
            <Field label="Código de Rastreio">
              <Input value={form.trackingCode} onChange={(v) => handleChange("trackingCode", v)} placeholder="BR123456789" />
            </Field>
            <Field label="Transportadora">
              <Input value={form.trackingCarrier} onChange={(v) => handleChange("trackingCarrier", v)} placeholder="Jadlog" />
            </Field>
            <Field label="Link de Agendamento (Calendly, etc.)">
              <Input value={form.schedulingLink} onChange={(v) => handleChange("schedulingLink", v)} placeholder="https://calendly.com/solo-energia/visita" />
            </Field>
          </Section>

          <Section title="Observações">
            <Field label="Notas Internas" className="md:col-span-2">
              <textarea
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Notas para a equipe…"
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
              />
            </Field>
            <Field label="Observações para o Cliente" className="md:col-span-2">
              <textarea
                value={form.observacoesGerais}
                onChange={(e) => handleChange("observacoesGerais", e.target.value)}
                placeholder="Mensagem visível ao cliente…"
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
              />
            </Field>
          </Section>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin" className="px-5 py-2.5 rounded-xl text-sm font-bold bg-secondary hover:bg-white/10 text-foreground transition-colors">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Criar Projeto
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

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

function Input({
  value, onChange, placeholder, type = "text", required = false, step,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      step={step}
      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
    />
  );
}
