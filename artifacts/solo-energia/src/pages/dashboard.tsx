import { useListProjects, useListSchedulingRequests, useCreateSchedulingRequest, useConfirmClientAvailability, SchedulingRequestStatus, getListSchedulingRequestsQueryKey } from "@workspace/api-client-react";
import type { Project } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MapPin, Zap, Calendar, Truck, ArrowRight, MessageCircle, FileText, Activity, ShieldCheck, HardHat, Info, CalendarPlus, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { staggerContainer, itemUp, momentumEase, redBullSpring } from "@/lib/animations";

const STEPS = [
  { id: 1, title: "Onboarding", desc: "Boas-vindas e configuração" },
  { id: 2, title: "Projeto Técnico", desc: "Engenharia e plantas" },
  { id: 3, title: "Homologação", desc: "Trâmites com concessionária" },
  { id: 4, title: "Logística", desc: "Rastreio de equipamentos" },
  { id: 5, title: "Execução", desc: "Instalação física" },
  { id: 6, title: "Ativação", desc: "Ligação oficial da usina" },
  { id: 7, title: "Treinamento", desc: "Monitoramento e uso do sistema" },
];

const GAUGE_R = 80;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

function safeFormatDate(dateStr: string | null | undefined, fmt = "dd MMM, yyyy"): string | null {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), fmt, { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function getActivationDate(project: Project): string | null | undefined {
  return project.estimatedActivation ?? project.dataConclusaoPrevista;
}

function getPhaseDate(project: Project): string | null | undefined {
  return project.dataConclusaoPrevista ?? project.estimatedDate ?? project.estimatedActivation;
}

function getDeliveryDate(project: Project): string | null | undefined {
  return project.dataDeEntregaDoEquipamento ?? project.dataConclusaoPrevista ?? project.estimatedDate ?? project.estimatedActivation;
}

function getStepDate(stepId: number, project: Project): string | null {
  switch (stepId) {
    case 1: return project.dataInicioPrevista ?? null;
    case 2: return project.dataDeCompras ?? null;
    case 4: return project.dataDeEntregaDoEquipamento ?? null;
    case 5: return project.dataConclusaoPrevista ?? project.estimatedDate ?? null;
    case 6: return project.estimatedActivation ?? null;
    case 7: return project.estimatedActivation ?? null;
    default: return null;
  }
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.025] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-base">{title}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={redBullSpring}>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-border/30 px-6 pb-6 pt-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  const { data: projects, isLoading } = useListProjects();
  const project = projects?.[0];

  const [gaugePercent, setGaugePercent] = useState(0);
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => setGaugePercent(project.completionPercent ?? 0), 180);
    return () => clearTimeout(t);
  }, [project?.completionPercent]);

  const isStep5 = (project?.statusStep ?? 0) === 5;
  const { data: schedList, isLoading: schedListLoading } = useListSchedulingRequests();
  const activeRequest = (isStep5 && schedList)
    ? schedList.find((r) =>
        (["pending", "confirmed", "client_confirmed"] as string[]).includes(r.status)
      ) ?? null
    : undefined;

  const queryClient = useQueryClient();
  const schedQueryKey = getListSchedulingRequestsQueryKey();

  const [schedDate, setSchedDate] = useState("");
  const [schedNotes, setSchedNotes] = useState("");

  const createScheduling = useCreateSchedulingRequest({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: schedQueryKey });
        setSchedDate("");
        setSchedNotes("");
      },
    },
  });

  const confirmAvailability = useConfirmClientAvailability({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: schedQueryKey });
      },
    },
  });

  function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!schedDate || createScheduling.isPending) return;
    createScheduling.mutate({ data: { requestedDate: schedDate, notes: schedNotes || undefined } });
  }

  function handleConfirmAvailability() {
    if (!activeRequest || confirmAvailability.isPending) return;
    confirmAvailability.mutate({ id: activeRequest.id });
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="w-full space-y-6 animate-pulse">
          <div className="h-48 bg-card rounded-3xl border border-border" />
          <div className="h-10 bg-card rounded-2xl border border-border w-2/3" />
          <div className="h-64 bg-card rounded-3xl border border-border" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
            <Activity className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-display text-foreground mb-2">Nenhum projeto encontrado</h2>
          <p className="text-muted-foreground max-w-md">
            Ainda não há informações de projeto vinculadas à sua conta. Entre em contato com seu consultor.
          </p>
        </div>
      </Layout>
    );
  }

  const currentStep = project.statusStep ?? 1;
  const activeStep = STEPS[currentStep - 1];
  const phaseDate = getPhaseDate(project);
  const deliveryDate = getDeliveryDate(project);
  const activationDate = getActivationDate(project);
  const observationText = project.notes ?? project.observacoesGerais;
  const firstName = project.clientName.split(" ")[0];
  const completionPct = project.completionPercent ?? 0;
  const gaugeOffset = GAUGE_C * (1 - gaugePercent / 100);
  const progressWidth = `calc(${(Math.max(1, currentStep) - 1) / (STEPS.length - 1) * 100}% - 3rem)`;

  const hasPhaseDetails = Boolean(observationText || phaseDate || currentStep >= 2);

  return (
    <Layout>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-6 pb-12"
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <motion.div variants={itemUp} className="glass-card grain-overlay rounded-3xl overflow-hidden">
          <div className="relative p-8 md:p-10">
            <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-primary/12 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-[#F5A623]/8 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.22em] font-mono mb-4">
                  Portal do Cliente{project.city ? ` · ${project.city}, ${project.state}` : ""}
                </p>
                <h1 className="text-4xl lg:text-5xl font-display leading-tight mb-5">
                  Olá, {firstName}!
                </h1>

                <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 mb-5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="text-sm font-bold text-primary font-mono uppercase tracking-wide">
                    Fase {currentStep} — {activeStep?.title}
                  </span>
                </div>

                <div className="h-1 bg-secondary rounded-full overflow-hidden max-w-xs mb-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--brand-gradient)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 1.6, ease: momentumEase, delay: 0.4 }}
                  />
                </div>
                {activationDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Ativação prevista:
                    <span className="text-foreground font-medium ml-0.5">
                      {safeFormatDate(activationDate, "MMM 'de' yyyy")}
                    </span>
                  </p>
                )}
              </div>

              {/* SVG circular gauge */}
              <div className="shrink-0">
                <div className="relative w-44 h-44 md:w-52 md:h-52">
                  <svg viewBox="0 0 200 200" className="w-full h-full gauge-glow" aria-hidden="true">
                    <defs>
                      <linearGradient id="gaugeGradFill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F5A623" />
                        <stop offset="100%" stopColor="#FF481E" />
                      </linearGradient>
                    </defs>
                    <circle cx="100" cy="100" r={GAUGE_R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                    <circle
                      cx="100" cy="100" r={GAUGE_R}
                      fill="none" stroke="url(#gaugeGradFill)" strokeWidth="6"
                      strokeLinecap="round" strokeDasharray={GAUGE_C} strokeDashoffset={gaugeOffset}
                      transform="rotate(-90 100 100)"
                      style={{ transition: "stroke-dashoffset 1.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
                    />
                    <circle cx="100" cy="100" r="68" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-7xl md:text-8xl font-display tabular-nums leading-none brand-gradient-text">
                      {completionPct}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] mt-1">
                      % pronto
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── KPI Strip ─────────────────────────────────────────────────── */}
        <motion.div variants={itemUp} className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2.5 glass-card rounded-2xl px-4 py-2.5 border border-border/50">
            <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Potência</span>
            <span className="text-sm font-bold tabular-nums">{(project.systemPower ?? 0).toFixed(1)} kWp</span>
          </div>
          {project.city && (
            <div className="flex items-center gap-2.5 glass-card rounded-2xl px-4 py-2.5 border border-border/50">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Local</span>
              <span className="text-sm font-bold">{project.city}{project.state ? `, ${project.state}` : ""}</span>
            </div>
          )}
          {activationDate && (
            <div className="flex items-center gap-2.5 glass-card rounded-2xl px-4 py-2.5 border border-border/50">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: "#4ADE80" }} />
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Ativação</span>
              <span className="text-sm font-bold">{safeFormatDate(activationDate, "MMM 'de' yyyy")}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 glass-card rounded-2xl px-4 py-2.5 border border-border/50">
            <Activity className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Conclusão</span>
            <span className="text-sm font-bold tabular-nums brand-gradient-text">{completionPct}%</span>
          </div>
        </motion.div>

        {/* ── Timeline ──────────────────────────────────────────────────── */}
        <motion.div variants={itemUp} className="glass-card grain-overlay rounded-3xl p-6 md:p-10 overflow-hidden">
          <div className="relative flex items-center gap-3 mb-10">
            <span className="ghost-number" style={{ top: "-1.5rem", right: "0" }}>0{currentStep}</span>
            <Activity className="w-5 h-5 text-primary relative z-10" />
            <h2 className="text-xl font-display relative z-10">Jornada do Projeto</h2>
          </div>

          <div className="relative">
            <div className="absolute top-6 left-6 right-6 h-[2px] bg-secondary hidden md:block" />
            <motion.div
              className="absolute top-6 left-6 h-[2px] hidden md:block rounded-full"
              style={{ background: "var(--brand-gradient)" }}
              initial={{ width: 0 }}
              animate={{ width: progressWidth }}
              transition={{ duration: 1.6, ease: momentumEase, delay: 0.5 }}
            />

            <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-0 relative z-10">
              {STEPS.map((step, idx) => {
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;
                const stepDate = getStepDate(step.id, project);

                return (
                  <div key={step.id} className="flex md:flex-col items-center gap-4 flex-1">
                    <div className="relative">
                      {isActive && (
                        <>
                          <div className="absolute -inset-3 rounded-xl bg-primary/15 animate-ping" />
                          <div className="absolute -inset-1.5 rounded-xl border border-primary/30" />
                        </>
                      )}
                      <div
                        className={`relative z-10 flex items-center justify-center transition-all duration-500
                          ${isActive ? "w-14 h-14 rounded-xl shadow-[0_0_28px_rgba(255,72,30,0.45)]" :
                            isCompleted ? "w-11 h-11 rounded-xl shadow-[0_0_16px_rgba(74,222,128,0.25)]" :
                            "w-11 h-11 rounded-xl bg-background border-2 border-border"}`}
                        style={
                          isActive ? { background: "var(--brand-gradient-135)" } :
                          isCompleted ? { background: "rgba(74,222,128,0.12)", border: "2px solid rgba(74,222,128,0.55)" } :
                          undefined
                        }
                      >
                        {isCompleted ? (
                          <Check className="w-5 h-5" style={{ color: "#4ADE80" }} strokeWidth={3} />
                        ) : (
                          <span className={`font-display font-black italic ${isActive ? "text-white text-2xl" : "text-muted-foreground text-lg"}`}>
                            {step.id}
                          </span>
                        )}
                      </div>
                      {idx !== STEPS.length - 1 && (
                        <div
                          className="absolute top-full bottom-[-2rem] left-1/2 -translate-x-1/2 w-[2px] md:hidden mt-1"
                          style={isCompleted ? { background: "var(--brand-gradient-135)" } : { background: "hsl(var(--secondary))" }}
                        />
                      )}
                    </div>

                    <div className="md:text-center">
                      <h3 className={`font-bold text-base md:text-sm lg:text-base transition-colors ${isActive ? "text-foreground" : isCompleted ? "text-foreground/80" : "text-muted-foreground"}`}>
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 hidden lg:block max-w-[110px] mx-auto leading-snug">
                        {step.desc}
                      </p>
                      {stepDate && (
                        <p className={`text-[10px] font-mono mt-1 hidden md:block max-w-[110px] mx-auto truncate ${isActive ? "text-primary" : isCompleted ? "text-foreground/40" : "text-muted-foreground/40"}`}>
                          {safeFormatDate(stepDate, "dd/MM/yy")}
                          {!isCompleted && !isActive && <span className="opacity-60"> (est.)</span>}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {activationDate && (
            <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-[0.18em]">
                Previsão de ativação
              </span>
              <span className="font-display text-xl brand-gradient-text">
                {safeFormatDate(activationDate, "MMMM 'de' yyyy")}
              </span>
            </div>
          )}
        </motion.div>

        {/* ── Collapsible Sections ───────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Phase Details */}
          {hasPhaseDetails && (
            <motion.div variants={itemUp}>
              <CollapsibleSection title="Detalhes da Fase" icon={Info}>
                <div className="space-y-4">
                  {currentStep === 4 && (
                    <div className="ferrari-stripe rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-border/30">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                          <Truck className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-display text-foreground mb-0.5">Equipamentos em trânsito</h3>
                          <p className="text-sm text-muted-foreground">
                            Transportadora: <span className="text-foreground font-medium">{project.trackingCarrier || "A definir"}</span>
                          </p>
                          {deliveryDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Previsão de entrega: <span className="text-foreground font-medium">{safeFormatDate(deliveryDate)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      {project.trackingCode && (
                        <div className="bg-background/50 border border-white/5 rounded-xl p-3 shrink-0 w-full sm:w-auto">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-mono">Rastreio</p>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-bold text-primary tabular-nums">{project.trackingCode}</span>
                            <button type="button" className="text-xs font-semibold bg-secondary px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors">
                              Rastrear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="rounded-2xl p-5 flex items-center gap-4 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.06)" }}>
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-display text-foreground">Aprovação na Enel / Concessionária</h3>
                        <p className="text-sm text-muted-foreground">Cuidando de toda a burocracia técnica para você.</p>
                      </div>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="rounded-2xl p-5 flex items-center gap-4 border border-emerald-500/20" style={{ background: "rgba(74,222,128,0.06)" }}>
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                        <HardHat className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-display text-foreground">Execução em Andamento</h3>
                        <p className="text-sm text-muted-foreground">A equipe técnica está trabalhando fisicamente no seu projeto.</p>
                      </div>
                    </div>
                  )}

                  {currentStep === 6 && (
                    <div className="rounded-2xl p-5 flex items-center gap-4 border border-yellow-500/20" style={{ background: "rgba(234,179,8,0.06)" }}>
                      <div className="w-11 h-11 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-display text-foreground">Usina Ativada! ☀️</h3>
                        <p className="text-sm text-muted-foreground">Sua usina está gerando energia limpa e renovável.</p>
                      </div>
                    </div>
                  )}

                  {currentStep === 7 && (
                    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)" }}>
                        <Activity className="w-6 h-6" style={{ color: "#4ADE80" }} />
                      </div>
                      <div>
                        <h3 className="font-display text-foreground">Treinamento Concluído!</h3>
                        <p className="text-sm text-muted-foreground">Bem-vindo à independência energética!</p>
                      </div>
                    </div>
                  )}

                  {(observationText || phaseDate) && (
                    <div className="pt-1">
                      {observationText && (
                        <p className="text-sm text-muted-foreground mb-3">{observationText}</p>
                      )}
                      {phaseDate && (
                        <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-primary font-mono">
                            Previsão da fase: {safeFormatDate(phaseDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </motion.div>
          )}

          {/* Scheduling — only visible when step === 5 (Execução) */}
          {currentStep === 5 && !schedListLoading && (
            <motion.div variants={itemUp}>
              <CollapsibleSection title="Agendamento de Execução" icon={CalendarPlus}>
                <AnimatePresence mode="wait">
                  {activeRequest?.status === SchedulingRequestStatus.client_confirmed && (
                    <motion.div
                      key="client-confirmed"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={redBullSpring}
                      className="flex flex-col items-center gap-3 py-6 text-center"
                    >
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-1" style={{ background: "rgba(74,222,128,0.12)" }}>
                        <CheckCircle2 className="w-8 h-8" style={{ color: "#4ADE80" }} />
                      </div>
                      <p className="text-lg font-bold text-foreground">Visita confirmada!</p>
                      <p className="text-muted-foreground text-sm">
                        Data: <span className="font-semibold text-foreground">{safeFormatDate(activeRequest.requestedDate) ?? activeRequest.requestedDate}</span>
                      </p>
                      <p className="text-muted-foreground text-xs max-w-xs">
                        Nossa equipe chegará no horário combinado. Qualquer dúvida, fale via WhatsApp.
                      </p>
                    </motion.div>
                  )}

                  {activeRequest?.status === SchedulingRequestStatus.confirmed && (
                    <motion.div key="team-confirmed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={redBullSpring} className="space-y-4 pt-1">
                      <div className="flex items-start gap-4 p-4 rounded-2xl border" style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.3)" }}>
                        <Calendar className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#F5A623" }} />
                        <div>
                          <p className="font-bold text-foreground text-sm">A equipe confirmou a data!</p>
                          <p className="text-muted-foreground text-sm mt-0.5">
                            Visita: <span className="font-semibold text-foreground">{safeFormatDate(activeRequest.requestedDate) ?? activeRequest.requestedDate}</span>
                          </p>
                          {activeRequest.notes && <p className="text-muted-foreground text-xs mt-1">{activeRequest.notes}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleConfirmAvailability}
                        disabled={confirmAvailability.isPending}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{ background: "var(--brand-gradient)" }}
                      >
                        {confirmAvailability.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Confirmar minha disponibilidade
                      </button>
                    </motion.div>
                  )}

                  {activeRequest?.status === SchedulingRequestStatus.pending && (
                    <motion.div key="pending" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={redBullSpring}
                      className="flex items-center gap-4 p-4 rounded-2xl border mt-1"
                      style={{ background: "rgba(255,72,30,0.06)", borderColor: "rgba(255,72,30,0.2)" }}>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">Solicitação enviada!</p>
                        <p className="text-muted-foreground text-sm">
                          Data preferida: <span className="font-semibold text-foreground">{safeFormatDate(activeRequest.requestedDate) ?? activeRequest.requestedDate}</span>
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">Aguardando confirmação da equipe.</p>
                      </div>
                    </motion.div>
                  )}

                  {activeRequest === null && (
                    <motion.form key="form" onSubmit={handleSchedule}
                      className="flex flex-col sm:flex-row gap-4 items-end pt-1"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Data preferida</label>
                        <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} required
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full bg-secondary text-foreground rounded-xl px-4 py-3 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Observações (opcional)</label>
                        <input type="text" value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} placeholder="Ex: só posso à tarde"
                          className="w-full bg-secondary text-foreground rounded-xl px-4 py-3 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder:text-muted-foreground"
                        />
                      </div>
                      <button type="submit" disabled={!schedDate || createScheduling.isPending}
                        className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
                        style={{ background: "var(--brand-gradient)" }}>
                        {createScheduling.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                        Solicitar Agendamento
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CollapsibleSection>
            </motion.div>
          )}

          {/* Quick Access */}
          <motion.div variants={itemUp}>
            <CollapsibleSection title="Acesso Rápido" icon={ArrowRight}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href="#"
                  className="flex items-center justify-between p-4 rounded-2xl border border-border/50 hover:bg-white/[0.03] hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Falar com Consultor</p>
                      <p className="text-xs text-muted-foreground">Suporte via WhatsApp</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </a>

                <Link
                  href="/documents"
                  className="flex items-center justify-between p-4 rounded-2xl border border-border/50 hover:bg-white/[0.03] hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Ver Documentos</p>
                      <p className="text-xs text-muted-foreground">Projetos e faturas</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </CollapsibleSection>
          </motion.div>
        </div>

        {/* ── Activation CTA (step 7+) ───────────────────────────────── */}
        {currentStep >= 7 && (
          <motion.div variants={itemUp} className="pt-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl pulse-ring-animation border-2 border-primary/25" />
              <div className="absolute inset-0 rounded-3xl pulse-ring-animation-delay border-2 border-primary/15" />
              <button type="button" className="relative w-full overflow-hidden rounded-3xl p-[2px] group hover:-translate-y-1 active:translate-y-0 transition-transform duration-300">
                <div className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" style={{ background: "var(--brand-gradient)" }} />
                <div className="relative bg-background/88 backdrop-blur-md rounded-[calc(1.5rem-2px)] py-8 px-6 flex items-center justify-center gap-4 group-hover:bg-background/80 transition-colors">
                  <Zap className="w-8 h-8 text-primary" fill="currentColor" />
                  <span className="text-2xl font-display font-bold brand-gradient-text">Ativar Monitoramento Solo</span>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
}
