import { useListProjects } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Check, MapPin, Zap, Calendar, Truck, ArrowRight, MessageCircle, FileText, Activity, ShieldCheck, HardHat, Info, ClipboardList, Banknote } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STEPS = [
  { id: 1, title: "Onboarding", desc: "Boas-vindas e configuração" },
  { id: 2, title: "Engenharia", desc: "Projeto técnico e plantas" },
  { id: 3, title: "Homologação", desc: "Trâmites com concessionária" },
  { id: 4, title: "Logística", desc: "Rastreio de equipamentos" },
  { id: 5, title: "Execução", desc: "Instalação física" },
  { id: 6, title: "Ativação", desc: "Ligação oficial da usina" },
];

function safeFormatDate(dateStr: string | null | undefined, fmt = "dd MMM, yyyy"): string | null {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), fmt, { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export default function Dashboard() {
  const { data: projects, isLoading } = useListProjects();
  const project = projects?.[0];
  const p = project as any;

  if (isLoading) {
    return (
      <Layout>
        <div className="w-full space-y-8 animate-pulse">
          <div className="h-32 bg-card rounded-3xl border border-border"></div>
          <div className="h-48 bg-card rounded-3xl border border-border"></div>
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const currentStep = project.statusStep ?? 1;
  const deliveryDate = p.dataDeEntregaDoEquipamento ?? p.dataConclusaoPrevista ?? p.estimatedDate ?? project.estimatedActivation;
  const phaseDate = p.dataConclusaoPrevista ?? p.estimatedDate ?? project.estimatedActivation;

  return (
    <Layout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-8 pb-12"
      >
        {/* Header Greeting */}
        <motion.div variants={itemVariants} className="relative overflow-hidden bg-card rounded-3xl p-8 border border-white/5 shadow-2xl shadow-black/50">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display text-foreground mb-4">
              Olá, {project.clientName.split(" ")[0]}! <br className="hidden md:block" />
              Sua independência solar está{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#FFD700]">
                {project.completionPercent}% pronta.
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Acompanhe aqui cada passo da sua jornada rumo à geração da própria energia.
            </p>
          </div>
        </motion.div>

        {/* Pipeline Stepper */}
        <motion.div variants={itemVariants} className="bg-card rounded-3xl p-6 md:p-10 border border-white/5 shadow-xl relative overflow-hidden">
          <h2 className="text-xl font-display mb-10 flex items-center gap-3">
            <Activity className="w-5 h-5 text-primary" />
            Jornada do Projeto
          </h2>

          <div className="relative">
            <div className="absolute top-6 left-6 right-6 h-[2px] bg-secondary hidden md:block" />
            <div
              className="absolute top-6 left-6 h-[2px] bg-primary hidden md:block transition-all duration-1000 ease-out"
              style={{ width: `calc(${(Math.max(1, currentStep) - 1) / (STEPS.length - 1) * 100}% - 3rem)` }}
            />

            <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-0 relative z-10">
              {STEPS.map((step, idx) => {
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;

                return (
                  <div key={step.id} className="flex md:flex-col items-center gap-4 md:gap-4 flex-1">
                    <div className="relative">
                      {isActive && (
                        <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping" />
                      )}
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg relative z-10 transition-all duration-500
                        ${isCompleted ? "bg-green-500/10 text-green-500 border-2 border-green-500" :
                          isActive ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,72,30,0.5)] border-2 border-primary" :
                          "bg-secondary text-muted-foreground border-2 border-border"}
                      `}>
                        {isCompleted ? <Check className="w-6 h-6" strokeWidth={3} /> : step.id}
                      </div>
                      {idx !== STEPS.length - 1 && (
                        <div className={`absolute top-12 bottom-[-2rem] left-1/2 -translate-x-1/2 w-[2px] md:hidden
                          ${isCompleted ? "bg-primary" : "bg-secondary"}
                        `} />
                      )}
                    </div>

                    <div className="md:text-center">
                      <h3 className={`font-bold text-base md:text-sm lg:text-base ${isActive || isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 hidden lg:block max-w-[120px] mx-auto">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Contextual Phase Cards */}
        <div className="space-y-4">
          {currentStep === 4 && (
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-secondary to-background rounded-3xl p-8 border border-primary/20 shadow-[0_8px_30px_rgba(255,72,30,0.1)] flex flex-col md:flex-row items-center justify-between gap-6">
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Código de Rastreio</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-lg font-bold text-primary">{project.trackingCode}</span>
                    <button className="text-xs font-semibold bg-secondary px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                      Rastrear
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-secondary to-background rounded-3xl p-8 border border-blue-500/20 shadow-[0_8px_30px_rgba(59,130,246,0.1)] flex items-center gap-6">
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
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-secondary to-background rounded-3xl p-8 border border-emerald-500/20 shadow-[0_8px_30px_rgba(16,185,129,0.1)] flex items-center gap-6">
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
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-secondary to-background rounded-3xl p-8 border border-yellow-500/20 shadow-[0_8px_30px_rgba(255,200,0,0.1)] flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 border border-yellow-500/20">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-display text-foreground mb-1">Usina Ativada! ☀️</h3>
                <p className="text-muted-foreground">Parabéns! Sua usina está gerando energia limpa e renovável.</p>
              </div>
            </motion.div>
          )}

          {/* Notes / Observations Card */}
          {(p.notes || p.observacoesGerais || phaseDate) && (
            <motion.div variants={itemVariants} className="bg-card rounded-3xl p-6 border border-white/5 flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-secondary shrink-0 flex items-center justify-center">
                <Info className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold mb-2">Observações da Fase Atual</h4>
                {(p.notes || p.observacoesGerais) && (
                  <p className="text-muted-foreground mb-3">{p.notes || p.observacoesGerais}</p>
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

        {/* Quick Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <motion.div variants={itemVariants} className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Potência do Sistema</p>
                <p className="text-2xl font-display">
                  {(project.systemPower ?? 0).toFixed(2)}{" "}
                  <span className="text-lg text-muted-foreground font-sans">kWp</span>
                </p>
              </div>
            </div>

            <div className="bg-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-4">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Local de Instalação</p>
                <p className="text-lg font-bold leading-tight">{project.city || "—"}</p>
                <p className="text-sm text-muted-foreground">{project.state || ""}</p>
              </div>
            </div>

            <div className="bg-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Previsão de Ativação</p>
                <p className="text-lg font-bold leading-tight">
                  {safeFormatDate(project.estimatedActivation ?? p.dataConclusaoPrevista, "MMM 'de' yyyy") ?? "Em análise"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div variants={itemVariants} className="md:col-span-4 flex flex-col gap-4">
            <a
              href="#"
              className="flex-1 bg-card hover:bg-secondary rounded-2xl p-6 border border-white/5 flex items-center justify-between group transition-all duration-300"
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
              className="flex-1 bg-card hover:bg-secondary rounded-2xl p-6 border border-white/5 flex items-center justify-between group transition-all duration-300"
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

        {/* Financial Info (if available) */}
        {(p.valorProjeto || p.formaDePagamento || p.dataInicioPrevista) && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {p.valorProjeto && (
              <div className="bg-card rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor do Projeto</p>
                  <p className="text-lg font-bold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.valorProjeto)}
                  </p>
                </div>
              </div>
            )}
            {p.formaDePagamento && (
              <div className="bg-card rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Forma de Pagamento</p>
                  <p className="text-lg font-bold">{p.formaDePagamento}</p>
                </div>
              </div>
            )}
            {p.dataInicioPrevista && (
              <div className="bg-card rounded-2xl p-6 border border-white/5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Início Previsto</p>
                  <p className="text-lg font-bold">{safeFormatDate(p.dataInicioPrevista)}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Activation CTA */}
        {currentStep >= 6 && (
          <motion.div variants={itemVariants} className="pt-8">
            <button className="w-full relative overflow-hidden rounded-3xl p-1 group hover:-translate-y-1 active:translate-y-0 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#FFD700] to-primary opacity-80 group-hover:opacity-100 transition-opacity bg-[length:200%_auto] animate-[gradient_3s_linear_infinite]" />
              <div className="relative bg-background/90 backdrop-blur-md rounded-[1.35rem] py-8 px-6 flex items-center justify-center gap-4 group-hover:bg-background/80 transition-colors">
                <Zap className="w-8 h-8 text-primary" fill="currentColor" />
                <span className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#FFD700]">
                  Ativar Monitoramento Solo
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
}
