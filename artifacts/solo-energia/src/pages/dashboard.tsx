import { useListProjects, useListPayments } from "@workspace/api-client-react";
import type { Project, Payment } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Check, MapPin, Zap, Calendar, Truck, ArrowRight, MessageCircle, FileText, Activity, ShieldCheck, HardHat, Info, ClipboardList, Banknote } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { staggerContainer, itemUp, momentumEase } from "@/lib/animations";

const STEPS = [
  { id: 1, title: "Onboarding", desc: "Boas-vindas e configuração" },
  { id: 2, title: "Engenharia", desc: "Projeto técnico e plantas" },
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

export default function Dashboard() {
  const { data: projects, isLoading } = useListProjects();
  const project = projects?.[0];
  const { data: payments } = useListPayments();

  const [gaugePercent, setGaugePercent] = useState(0);
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => setGaugePercent(project.completionPercent ?? 0), 180);
    return () => clearTimeout(t);
  }, [project?.completionPercent]);

  if (isLoading) {
    return (
      <Layout>
        <div className="w-full space-y-8 animate-pulse">
          <div className="h-48 bg-card rounded-3xl border border-border"></div>
          <div className="h-64 bg-card rounded-3xl border border-border"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
          </div>
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

  return (
    <Layout>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-8 pb-12"
      >
        {/* Hero card with SVG gauge */}
        <motion.div
          variants={itemUp}
          className="glass-card grain-overlay rounded-3xl overflow-hidden"
        >
          <div className="relative p-8 md:p-10">
            <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-primary/12 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-[#F5A623]/8 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.22em] font-mono mb-4">
                  Portal do Cliente · {project.city && `${project.city}, ${project.state}`}
                </p>
                <h1 className="text-4xl lg:text-5xl font-display leading-tight mb-4">
                  Olá, {firstName}!
                </h1>
                <p className="text-muted-foreground text-base md:text-lg mb-6 max-w-sm">
                  Sua independência solar está sendo construída. Cada etapa abaixo é uma conquista.
                </p>

                <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 mb-6">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="text-sm font-bold text-primary font-mono uppercase tracking-wide">
                    Fase {currentStep} — {activeStep?.title}
                  </span>
                </div>

                <div className="h-1 bg-secondary rounded-full overflow-hidden max-w-xs">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--brand-gradient)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 1.6, ease: momentumEase, delay: 0.4 }}
                  />
                </div>
                {activationDate && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Ativação prevista: <span className="text-foreground font-medium ml-0.5">{safeFormatDate(activationDate, "MMM 'de' yyyy")}</span>
                  </p>
                )}
              </div>

              {/* SVG circular gauge */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="relative w-44 h-44 md:w-52 md:h-52">
                  <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full gauge-glow"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="gaugeGradFill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F5A623" />
                        <stop offset="100%" stopColor="#FF481E" />
                      </linearGradient>
                    </defs>
                    <circle cx="100" cy="100" r={GAUGE_R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                    <circle
                      cx="100" cy="100" r={GAUGE_R}
                      fill="none"
                      stroke="url(#gaugeGradFill)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={GAUGE_C}
                      strokeDashoffset={gaugeOffset}
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

        {/* Pipeline stepper */}
        <motion.div
          variants={itemUp}
          className="glass-card grain-overlay rounded-3xl p-6 md:p-10 overflow-hidden"
        >
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
                        className={`
                          relative z-10 flex items-center justify-center transition-all duration-500
                          ${isActive ? "w-14 h-14 rounded-xl shadow-[0_0_28px_rgba(255,72,30,0.45)]" :
                            isCompleted ? "w-11 h-11 rounded-xl shadow-[0_0_16px_rgba(74,222,128,0.25)]" :
                            "w-11 h-11 rounded-xl bg-background border-2 border-border"}
                        `}
                        style={
                          isActive
                            ? { background: "var(--brand-gradient-135)" }
                            : isCompleted
                            ? { background: "rgba(74,222,128,0.12)", border: "2px solid rgba(74,222,128,0.55)" }
                            : undefined
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
                          style={isCompleted
                            ? { background: "var(--brand-gradient-135)" }
                            : { background: "hsl(var(--secondary))" }
                          }
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Phase contextual cards */}
        <div className="space-y-4">
          {currentStep === 4 && (
            <motion.div
              variants={itemUp}
              className="ferrari-stripe glass-card rounded-r-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                  <Truck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-display text-foreground mb-1">Seus equipamentos estão em trânsito!</h3>
                  <p className="text-muted-foreground">
                    Transportadora: <span className="text-foreground font-medium">{project.trackingCarrier || "A definir"}</span>
                  </p>
                  {deliveryDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Previsão de entrega: <span className="text-foreground font-medium">{safeFormatDate(deliveryDate)}</span>
                    </p>
                  )}
                </div>
              </div>
              {project.trackingCode && (
                <div className="bg-background/50 backdrop-blur-sm border border-white/5 rounded-xl p-4 shrink-0 w-full md:w-auto">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-mono">Código de Rastreio</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-lg font-bold text-primary tabular-nums">{project.trackingCode}</span>
                    <button className="text-xs font-semibold bg-secondary px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                      Rastrear
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              variants={itemUp}
              className="glass-card rounded-3xl p-8 border-l-4 border-l-blue-500/70 border border-blue-500/15 flex items-center gap-6"
              style={{ borderRadius: "0 1.5rem 1.5rem 0" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 border border-blue-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-display text-foreground mb-1">Aprovação na Enel / Concessionária</h3>
                <p className="text-muted-foreground">Estamos cuidando de toda a burocracia técnica para você.</p>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              variants={itemUp}
              className="glass-card rounded-r-3xl p-8 border-l-4 flex items-center gap-6"
              style={{ borderLeftColor: "#4ADE80", borderRadius: "0 1.5rem 1.5rem 0" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/20">
                <HardHat className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-display text-foreground mb-1">Execução em Andamento</h3>
                <p className="text-muted-foreground">A equipe técnica está trabalhando fisicamente no seu projeto.</p>
              </div>
            </motion.div>
          )}

          {currentStep === 6 && (
            <motion.div
              variants={itemUp}
              className="glass-card rounded-r-3xl p-8 border-l-4 border-l-yellow-500/80 flex items-center gap-6"
              style={{ borderRadius: "0 1.5rem 1.5rem 0" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 border border-yellow-500/20">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-display text-foreground mb-1">Usina Ativada! ☀️</h3>
                <p className="text-muted-foreground">Parabéns! Sua usina está gerando energia limpa e renovável. Em breve iniciaremos o treinamento.</p>
              </div>
            </motion.div>
          )}

          {currentStep === 7 && (
            <motion.div
              variants={itemUp}
              className="glass-card rounded-r-3xl p-8 border-l-4 flex items-center gap-6"
              style={{ borderLeftColor: "#4ADE80", borderRadius: "0 1.5rem 1.5rem 0" }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.25)" }}>
                <Activity className="w-8 h-8" style={{ color: "#4ADE80" }} />
              </div>
              <div>
                <h3 className="text-xl font-display text-foreground mb-1">Treinamento Concluído!</h3>
                <p className="text-muted-foreground">Você já sabe monitorar e aproveitar ao máximo sua usina solar. Bem-vindo à independência energética!</p>
              </div>
            </motion.div>
          )}

          {(observationText || phaseDate) && (
            <motion.div variants={itemUp} className="glass-card rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-secondary shrink-0 flex items-center justify-center">
                <Info className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold mb-2">Observações da Fase Atual</h4>
                {observationText && (
                  <p className="text-muted-foreground mb-3">{observationText}</p>
                )}
                {phaseDate && (
                  <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">
                      Previsão da fase: {safeFormatDate(phaseDate)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick info grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <motion.div variants={itemUp} className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-yellow-500/10 transition-colors">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2">Potência do Sistema</p>
                <p className="text-3xl font-display tabular-nums leading-none">
                  {(project.systemPower ?? 0).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">kWp instalados</p>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-blue-500/10 transition-colors">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2">Local de Instalação</p>
                <p className="text-xl font-bold leading-tight">{project.city || "—"}</p>
                <p className="text-sm text-muted-foreground">{project.state || ""}</p>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-emerald-500/10 transition-colors">
                <Calendar className="w-5 h-5" style={{ color: "#4ADE80" }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2">Previsão de Ativação</p>
                <p className="text-xl font-bold leading-tight">
                  {safeFormatDate(activationDate, "MMM 'de' yyyy") ?? "Em análise"}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemUp} className="md:col-span-4 flex flex-col gap-4">
            <a
              href="#"
              className="flex-1 glass-card hover:bg-secondary/50 rounded-2xl p-6 flex items-center justify-between group transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground">Falar com Consultor</p>
                  <p className="text-sm text-muted-foreground">Suporte via WhatsApp</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
            </a>

            <Link
              href="/documents"
              className="flex-1 glass-card hover:bg-secondary/50 rounded-2xl p-6 flex items-center justify-between group transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground">Ver Documentos</p>
                  <p className="text-sm text-muted-foreground">Projetos e faturas</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>
        </div>

        {/* Financial info cards */}
        {(project.valorProjeto || project.formaDePagamento || project.dataInicioPrevista) && (
          <motion.div variants={itemUp} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {project.valorProjeto && (
              <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5" style={{ color: "#4ADE80" }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Valor do Projeto</p>
                  <p className="text-xl font-bold tabular-nums">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(project.valorProjeto)}
                  </p>
                </div>
              </div>
            )}
            {project.formaDePagamento && (
              <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Forma de Pagamento</p>
                  <p className="text-lg font-bold">{project.formaDePagamento}</p>
                </div>
              </div>
            )}
            {project.dataInicioPrevista && (
              <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Início Previsto</p>
                  <p className="text-lg font-bold">{safeFormatDate(project.dataInicioPrevista)}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Financial Installments section */}
        {payments && payments.length > 0 ? (
          <motion.div variants={itemUp} className="glass-card grain-overlay rounded-3xl p-8 overflow-hidden relative">
            <span className="ghost-number" style={{ top: "-1rem", right: "0" }}>R$</span>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Banknote className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-display">Fluxo Financeiro</h2>
              </div>
              <div className="space-y-3">
                {payments.map((p: Payment) => {
                  const isPaid = p.status === "paid";
                  const isOverdue = p.status === "overdue";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 border"
                      style={{
                        background: isPaid
                          ? "rgba(74,222,128,0.06)"
                          : isOverdue
                          ? "rgba(239,68,68,0.06)"
                          : "rgba(255,255,255,0.03)",
                        borderColor: isPaid
                          ? "rgba(74,222,128,0.2)"
                          : isOverdue
                          ? "rgba(239,68,68,0.2)"
                          : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-sm font-mono text-muted-foreground shrink-0 tabular-nums">
                          {String(p.installmentNumber).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {p.description ?? `Parcela ${p.installmentNumber}`}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            Venc: {safeFormatDate(p.dueDate) ?? p.dueDate}
                            {p.paidDate && ` · Pago: ${safeFormatDate(p.paidDate) ?? p.paidDate}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold tabular-nums text-lg font-mono">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.amount)}
                        </span>
                        <span
                          className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg font-mono"
                          style={
                            isPaid
                              ? { background: "rgba(74,222,128,0.15)", color: "#4ADE80" }
                              : isOverdue
                              ? { background: "rgba(239,68,68,0.15)", color: "#F87171" }
                              : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }
                          }
                        >
                          {isPaid ? "Pago ✓" : isOverdue ? "Vencido" : "Pendente"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {payments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-sm">
                  <span className="text-muted-foreground font-mono">Total pago</span>
                  <span className="font-bold tabular-nums text-[#4ADE80] font-mono">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      payments.filter((p: Payment) => p.status === "paid").reduce((acc: number, p: Payment) => acc + p.amount, 0)
                    )}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        {/* Activation CTA with Tesla charging rings */}
        {currentStep >= 7 && (
          <motion.div variants={itemUp} className="pt-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl pulse-ring-animation border-2 border-primary/25" />
              <div className="absolute inset-0 rounded-3xl pulse-ring-animation-delay border-2 border-primary/15" />

              <button className="relative w-full overflow-hidden rounded-3xl p-[2px] group hover:-translate-y-1 active:translate-y-0 transition-transform duration-300">
                <div
                  className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{ background: "var(--brand-gradient)" }}
                />
                <div className="relative bg-background/88 backdrop-blur-md rounded-[calc(1.5rem-2px)] py-8 px-6 flex items-center justify-center gap-4 group-hover:bg-background/80 transition-colors">
                  <Zap className="w-8 h-8 text-primary" fill="currentColor" />
                  <span className="text-2xl font-display font-bold brand-gradient-text">
                    Ativar Monitoramento Solo
                  </span>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
}
