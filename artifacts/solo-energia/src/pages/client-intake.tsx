import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUploadDocument } from "@workspace/api-client-react";
import type { Document } from "@workspace/api-client-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FileText,
  Info,
  Loader2,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { itemUp, redBullSpring, staggerContainer } from "@/lib/animations";

type IntakeForm = {
  nomeCompleto: string;
  tipoDocumento: "cpf" | "cnpj";
  cpf: string;
  cnpj: string;
  rgCnh: string;
  titularidadeUnidadeConsumidora: string;
  enderecoInstalacao: string;
  telefone: string;
  email: string;
  numeroUnidadeConsumidora: string;
  senhaUnidadeConsumidora: string;
  numeroUnidadeConsumidoraRateio: string;
  senhaUnidadeConsumidoraRateio: string;
};

type IntakeResponse = {
  project?: Record<string, unknown> | null;
  submission?: Record<string, unknown> | null;
  documents?: Document[];
};

type FieldName = keyof IntakeForm;

const INITIAL_FORM: IntakeForm = {
  nomeCompleto: "",
  tipoDocumento: "cpf",
  cpf: "",
  cnpj: "",
  rgCnh: "",
  titularidadeUnidadeConsumidora: "",
  enderecoInstalacao: "",
  telefone: "",
  email: "",
  numeroUnidadeConsumidora: "",
  senhaUnidadeConsumidora: "",
  numeroUnidadeConsumidoraRateio: "",
  senhaUnidadeConsumidoraRateio: "",
};

const FIELD_ALIASES: Record<FieldName, string[]> = {
  nomeCompleto: ["nomeCompleto", "nome_completo", "fullName", "name", "clientName"],
  tipoDocumento: ["tipoDocumento", "tipo_documento", "documentType"],
  cpf: ["cpf"],
  cnpj: ["cnpj"],
  rgCnh: ["rgCnh", "rg_cnh", "rgOuCnh", "rg"],
  titularidadeUnidadeConsumidora: [
    "titularidadeUnidadeConsumidora",
    "titularidade_unidade_consumidora",
    "titularidade",
  ],
  enderecoInstalacao: [
    "enderecoInstalacao",
    "endereco_instalacao",
    "enderecoCompleto",
    "address",
  ],
  telefone: ["telefone", "phone", "clientPhone"],
  email: ["email", "clientEmail"],
  numeroUnidadeConsumidora: [
    "numeroUnidadeConsumidora",
    "numero_unidade_consumidora",
    "unidadeConsumidora",
    "consumerUnitNumber",
  ],
  senhaUnidadeConsumidora: [
    "senhaUnidadeConsumidora",
    "senha_unidade_consumidora",
    "consumerUnitPassword",
  ],
  numeroUnidadeConsumidoraRateio: [
    "numeroUnidadeConsumidoraRateio",
    "numero_unidade_consumidora_rateio",
    "rateioUnidadeConsumidora",
    "rateioUnitNumber",
  ],
  senhaUnidadeConsumidoraRateio: [
    "senhaUnidadeConsumidoraRateio",
    "senha_unidade_consumidora_rateio",
    "rateioSenha",
    "rateioAccessPassword",
  ],
};

const requiredFields: FieldName[] = [
  "nomeCompleto",
  "rgCnh",
  "titularidadeUnidadeConsumidora",
  "enderecoInstalacao",
  "telefone",
  "email",
  "numeroUnidadeConsumidora",
  "senhaUnidadeConsumidora",
];

function readField(source: Record<string, unknown>, field: FieldName): string {
  const key = FIELD_ALIASES[field].find((candidate) => source[candidate] !== undefined);
  const value = key ? source[key] : "";
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function formFromResponse(response: IntakeResponse): IntakeForm {
  const submissionData = response.submission?.data;
  const data = {
    ...(response.project ?? {}),
    ...(submissionData && typeof submissionData === "object" ? submissionData : {}),
    ...(response.submission ?? {}),
  };
  const next = { ...INITIAL_FORM };
  (Object.keys(next) as FieldName[]).forEach((field) => {
    const value = readField(data, field);
    if (value) next[field] = value as never;
  });
  const documentType = readField(data, "tipoDocumento").toLowerCase();
  next.tipoDocumento = documentType === "cnpj" ? "cnpj" : "cpf";
  return next;
}

function getSubmissionStatus(submission: Record<string, unknown> | null | undefined): "draft" | "submitted" {
  const value = String(submission?.status ?? submission?.state ?? "").toLowerCase();
  return value === "submitted" || value === "enviado" || value === "submitted_at" ? "submitted" : "draft";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function formatDocumentSize(bytes?: number): string {
  if (!bytes) return "PDF, JPG ou PNG · até 10 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required = false,
  type = "text",
  placeholder,
  autoComplete,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-sm font-semibold text-foreground/90">
        {label} {required && <span className="text-primary" aria-hidden="true">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`h-12 rounded-xl border-white/[0.09] bg-background/55 px-4 text-[15px] placeholder:text-muted-foreground/45 focus-visible:border-primary/70 focus-visible:ring-primary/20 ${
          error ? "border-red-400/70 focus-visible:border-red-400" : ""
        }`}
      />
      {hint && !error && <p id={`${name}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && <p id={`${name}-error`} className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof UserRound;
}) {
  return (
    <div className="mb-7 flex gap-4">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/80">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DocumentUploadCard({ document, onUploaded }: { document: Document; onUploaded: (document: Document) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { mutate: uploadDocument, isPending } = useUploadDocument({
    mutation: {
      onSuccess: (uploaded) => {
        setLocalError(null);
        onUploaded(uploaded);
        toast.success(`${document.name} foi enviado.`);
        if (inputRef.current) inputRef.current.value = "";
      },
      onError: (error) => {
        const message = getErrorMessage(error, "Não foi possível enviar este arquivo.");
        setLocalError(message);
        toast.error(message);
        if (inputRef.current) inputRef.current.value = "";
      },
    },
  });

  const chooseFile = (file?: File) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setLocalError("Escolha um PDF, JPG ou PNG.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    setLocalError(null);
    uploadDocument({ id: document.id, data: { file } });
  };

  const uploaded = Boolean(document.fileUrl);
  return (
    <motion.div variants={itemUp} className="group rounded-2xl border border-white/[0.08] bg-background/35 p-4 transition-colors hover:border-primary/30 hover:bg-background/50">
      <div className="flex items-start gap-3.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${uploaded ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/[0.08] bg-card text-muted-foreground"}`}>
          {uploaded ? <FileCheck2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold leading-tight">{document.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{document.description || "Documento solicitado para o seu projeto."}</p>
            </div>
            {document.required && <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">Obrigatório</span>}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className={`text-[11px] ${uploaded ? "text-emerald-300" : "text-muted-foreground"}`}>
              {isPending ? "Enviando arquivo…" : uploaded ? "Arquivo recebido" : formatDocumentSize()}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploaded ? "Substituir" : "Anexar arquivo"}
            </button>
          </div>
          {localError && <p className="mt-2 text-xs text-red-300">{localError}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export default function ClientIntake() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<IntakeForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<"draft" | "submitted">("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [intakeDocuments, setIntakeDocuments] = useState<Document[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const documents = intakeDocuments;
  const uploadedCount = documents.filter((document) => Boolean(document.fileUrl)).length;
  const requiredDocuments = documents.filter((document) => document.required);
  const requiredUploadedCount = requiredDocuments.filter((document) => Boolean(document.fileUrl)).length;
  const formProgress = useMemo(() => {
    const total = requiredFields.length;
    const complete = requiredFields.filter((field) => Boolean(form[field].trim())).length;
    return Math.round((complete / total) * 100);
  }, [form]);

  const loadIntake = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const response = await fetch("/api/client-intake", { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível carregar os dados do projeto.");
      const payload = (await response.json()) as IntakeResponse;
      setForm(formFromResponse(payload));
      setIntakeDocuments(Array.isArray(payload.documents) ? payload.documents : []);
      setSubmissionStatus(getSubmissionStatus(payload.submission));
      setLoadState("ready");
    } catch (error) {
      setLoadError(getErrorMessage(error, "Não foi possível carregar a sua ficha."));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadIntake();
  }, [loadIntake]);

  const updateField = (field: FieldName, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const validate = () => {
    const next: Partial<Record<FieldName, string>> = {};
    requiredFields.forEach((field) => {
      if (!form[field].trim()) next[field] = "Preencha este campo para continuar.";
    });
    if (form.tipoDocumento === "cpf" && !form.cpf.trim()) next.cpf = "Informe o CPF do titular.";
    if (form.tipoDocumento === "cnpj" && !form.cnpj.trim()) next.cnpj = "Informe o CNPJ do titular.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Confira o formato do e-mail.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveDraft = async (announce = true) => {
    setSaving(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/client-intake", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: form }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Não foi possível salvar o rascunho.");
      }
      setSubmissionStatus("draft");
      setLastSavedAt(new Date());
      if (announce) toast.success("Rascunho salvo.");
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível salvar o rascunho.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) {
      setSubmitError("Revise os campos destacados antes de enviar.");
      document.getElementById("dados-pessoais")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/client-intake/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: form }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string> };
        if (data.errors) setErrors(data.errors as Partial<Record<FieldName, string>>);
        throw new Error(data.message || "Não foi possível enviar os dados.");
      }
      setSubmissionStatus("submitted");
      setLastSavedAt(new Date());
      toast.success("Dados enviados para a equipe Solo Energia.");
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível enviar os dados.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploaded = (uploaded: Document) => {
    setIntakeDocuments((current) => {
      const exists = current.some((document) => document.id === uploaded.id);
      return exists ? current.map((document) => document.id === uploaded.id ? uploaded : document) : [...current, uploaded];
    });
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
  };

  if (loadState === "loading") {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-52 rounded-3xl border border-white/[0.07] bg-card" />
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="h-[620px] rounded-3xl border border-white/[0.07] bg-card" />
            <div className="h-72 rounded-3xl border border-white/[0.07] bg-card" />
          </div>
        </div>
      </Layout>
    );
  }

  if (loadState === "error") {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300"><AlertCircle className="h-7 w-7" /></div>
          <h1 className="text-2xl font-semibold">Não conseguimos abrir sua ficha</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => void loadIntake()} className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl">
        <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={redBullSpring} className="relative mb-7 overflow-hidden rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-60" style={{ background: "radial-gradient(circle at 80% 15%, rgba(245,166,35,.18), transparent 52%)" }} />
          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Próximo passo do seu projeto
              </div>
              <h1 className="max-w-xl text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">Vamos preparar tudo para a sua instalação.</h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Esta ficha reúne as informações que a nossa equipe precisa para cuidar da parte elétrica com segurança. Você pode salvar e voltar quando quiser.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-background/40 px-4 py-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${submissionStatus === "submitted" ? "bg-emerald-400/15 text-emerald-300" : "bg-primary/15 text-primary"}`}>
                {submissionStatus === "submitted" ? <CheckCircle2 className="h-5 w-5" /> : <Save className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold">{submissionStatus === "submitted" ? "Informações enviadas" : "Rascunho em andamento"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{lastSavedAt ? `Atualizado às ${lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Ainda não enviado"}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_294px]">
          <form onSubmit={submitForm} className="space-y-6">
            <motion.section id="dados-pessoais" variants={itemUp} initial="hidden" animate="show" className="rounded-3xl border border-white/[0.08] bg-card p-5 sm:p-8">
              <SectionHeading eyebrow="01 · Quem está solicitando" title="Dados do titular" description="Usaremos estes dados para identificar o responsável pelo projeto e manter você informado." icon={UserRound} />
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Nome completo" name="nomeCompleto" value={form.nomeCompleto} onChange={(value) => updateField("nomeCompleto", value)} error={errors.nomeCompleto} required placeholder="Como aparece no seu documento" autoComplete="name" disabled={submissionStatus === "submitted"} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground/90">Tipo de documento <span className="text-primary">*</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["cpf", "cnpj"] as const).map((type) => (
                      <button key={type} type="button" disabled={submissionStatus === "submitted"} onClick={() => updateField("tipoDocumento", type)} className={`h-12 rounded-xl border text-sm font-semibold transition ${form.tipoDocumento === type ? "border-primary/60 bg-primary/10 text-primary" : "border-white/[0.09] bg-background/55 text-muted-foreground hover:border-white/20"}`}>
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="CPF" name="cpf" value={form.cpf} onChange={(value) => updateField("cpf", value)} error={errors.cpf} required={form.tipoDocumento === "cpf"} placeholder="000.000.000-00" disabled={submissionStatus === "submitted" || form.tipoDocumento !== "cpf"} />
                <Field label="CNPJ" name="cnpj" value={form.cnpj} onChange={(value) => updateField("cnpj", value)} error={errors.cnpj} required={form.tipoDocumento === "cnpj"} placeholder="00.000.000/0000-00" disabled={submissionStatus === "submitted" || form.tipoDocumento !== "cnpj"} />
                <Field label="RG ou CNH" name="rgCnh" value={form.rgCnh} onChange={(value) => updateField("rgCnh", value)} error={errors.rgCnh} required placeholder="Número do documento" disabled={submissionStatus === "submitted"} />
              </div>
            </motion.section>

            <motion.section variants={itemUp} initial="hidden" animate="show" className="rounded-3xl border border-white/[0.08] bg-card p-5 sm:p-8">
              <SectionHeading eyebrow="02 · Onde a energia acontece" title="Unidade consumidora" description="Esses dados nos ajudam a encontrar a instalação certa e preparar a documentação junto à concessionária." icon={MapPin} />
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Titularidade da unidade consumidora" name="titularidadeUnidadeConsumidora" value={form.titularidadeUnidadeConsumidora} onChange={(value) => updateField("titularidadeUnidadeConsumidora", value)} error={errors.titularidadeUnidadeConsumidora} required hint="Nome que aparece na conta de energia." disabled={submissionStatus === "submitted"} />
                <Field label="Número da unidade consumidora" name="numeroUnidadeConsumidora" value={form.numeroUnidadeConsumidora} onChange={(value) => updateField("numeroUnidadeConsumidora", value)} error={errors.numeroUnidadeConsumidora} required placeholder="Número da sua conta de luz" disabled={submissionStatus === "submitted"} />
                <div className="md:col-span-2">
                  <Label htmlFor="enderecoInstalacao" className="text-sm font-semibold text-foreground/90">Endereço completo da instalação <span className="text-primary">*</span></Label>
                  <Textarea id="enderecoInstalacao" name="enderecoInstalacao" value={form.enderecoInstalacao} onChange={(event) => updateField("enderecoInstalacao", event.target.value)} disabled={submissionStatus === "submitted"} placeholder="Rua, número, complemento, bairro, cidade e estado" aria-invalid={Boolean(errors.enderecoInstalacao)} className={`mt-2 min-h-[104px] resize-y rounded-xl border-white/[0.09] bg-background/55 px-4 py-3 text-[15px] placeholder:text-muted-foreground/45 focus-visible:border-primary/70 focus-visible:ring-primary/20 ${errors.enderecoInstalacao ? "border-red-400/70" : ""}`} />
                  {errors.enderecoInstalacao && <p className="mt-1.5 text-xs text-red-300">{errors.enderecoInstalacao}</p>}
                </div>
                <Field label="Senha de acesso da unidade consumidora" name="senhaUnidadeConsumidora" value={form.senhaUnidadeConsumidora} onChange={(value) => updateField("senhaUnidadeConsumidora", value)} error={errors.senhaUnidadeConsumidora} required type="password" hint="A senha é usada somente para consultar dados do projeto." disabled={submissionStatus === "submitted"} />
                <div className="flex items-end">
                  <div className="flex w-full items-start gap-2 rounded-xl border border-sky-300/15 bg-sky-300/[0.06] p-3 text-xs leading-relaxed text-sky-100/70">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    Seus dados de acesso ficam protegidos e são compartilhados apenas com a equipe responsável.
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={itemUp} initial="hidden" animate="show" className="rounded-3xl border border-white/[0.08] bg-card p-5 sm:p-8">
              <SectionHeading eyebrow="03 · Como falar com você" title="Contato principal" description="Vamos usar este contato para confirmar detalhes e avisar você sobre cada avanço." icon={CircleHelp} />
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Telefone" name="telefone" value={form.telefone} onChange={(value) => updateField("telefone", value)} error={errors.telefone} required type="tel" placeholder="(00) 00000-0000" autoComplete="tel" disabled={submissionStatus === "submitted"} />
                <Field label="E-mail" name="email" value={form.email} onChange={(value) => updateField("email", value)} error={errors.email} required type="email" placeholder="voce@email.com" autoComplete="email" disabled={submissionStatus === "submitted"} />
              </div>
            </motion.section>

            <motion.section variants={itemUp} initial="hidden" animate="show" className="rounded-3xl border border-white/[0.08] bg-card p-5 sm:p-8">
              <button type="button" onClick={() => setShowOptional((value) => !value)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">04 · Opcional</p>
                  <h2 className="text-xl font-semibold tracking-tight">Unidade para rateio</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">Preencha apenas se o seu projeto distribuir créditos para outra unidade.</p>
                </div>
                <motion.div animate={{ rotate: showOptional ? 180 : 0 }} transition={redBullSpring} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-background/40 text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {showOptional && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="grid gap-5 border-t border-white/[0.07] pt-6 mt-6 md:grid-cols-2">
                      <Field label="Número da unidade de rateio" name="numeroUnidadeConsumidoraRateio" value={form.numeroUnidadeConsumidoraRateio} onChange={(value) => updateField("numeroUnidadeConsumidoraRateio", value)} placeholder="Número da unidade adicional" disabled={submissionStatus === "submitted"} />
                      <Field label="Senha de acesso da unidade de rateio" name="senhaUnidadeConsumidoraRateio" value={form.senhaUnidadeConsumidoraRateio} onChange={(value) => updateField("senhaUnidadeConsumidoraRateio", value)} type="password" placeholder="Senha da unidade adicional" disabled={submissionStatus === "submitted"} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {submitError && (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{submitError}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => void saveDraft()} disabled={saving || submitting || submissionStatus === "submitted"} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-card px-5 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-primary/[0.07] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar rascunho
              </button>
              <button type="submit" disabled={saving || submitting || submissionStatus === "submitted"} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submissionStatus === "submitted" ? "Dados enviados" : "Enviar informações"}
              </button>
            </div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="rounded-3xl border border-white/[0.08] bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Seu progresso</p>
                <span className="font-mono text-sm font-bold text-primary">{formProgress}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
                <motion.div initial={{ width: 0 }} animate={{ width: `${formProgress}%` }} className="h-full rounded-full" style={{ background: "var(--brand-gradient)" }} />
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { label: "Dados do titular", done: requiredFields.slice(0, 3).every((field) => Boolean(form[field].trim())) },
                  { label: "Unidade consumidora", done: requiredFields.slice(3, 6).every((field) => Boolean(form[field].trim())) },
                  { label: "Contato principal", done: requiredFields.slice(6).every((field) => Boolean(form[field].trim())) },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-2.5 text-xs">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.done ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" : "border-white/10 text-muted-foreground/50"}`}>{step.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
                    <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-primary/15 bg-primary/[0.06] p-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">Um espaço seguro</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">As informações desta ficha são usadas exclusivamente para o andamento do seu projeto de energia.</p>
                </div>
              </div>
            </div>

            <div id="documentos" className="rounded-3xl border border-white/[0.08] bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">05 · Apoio</p>
                  <h2 className="text-lg font-semibold">Documentos</h2>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Envie os arquivos solicitados para a equipe conseguir seguir sem pausas.</p>
              {documents.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-white/[0.1] p-4 text-center">
                  <Info className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">Nenhum documento foi solicitado ainda.</p>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{uploadedCount}/{documents.length} recebidos</span>
                    {requiredDocuments.length > 0 && <span>{requiredUploadedCount}/{requiredDocuments.length} obrigatórios</span>}
                  </div>
                  <motion.div variants={staggerContainer} initial="hidden" animate="show" className="mt-3 space-y-3">
                    {documents.map((document) => <DocumentUploadCard key={document.id} document={document} onUploaded={handleUploaded} />)}
                  </motion.div>
                </>
              )}
            </div>

            <div className="flex items-start gap-2 px-2 text-[11px] leading-relaxed text-muted-foreground">
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Você não precisa preencher tudo de uma vez. Salve o rascunho e continue quando for melhor.</span>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}