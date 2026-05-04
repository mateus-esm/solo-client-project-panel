import { useListProjects, useListPayments } from "@workspace/api-client-react";
import type { Payment } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote, CheckCircle2, AlertCircle, Upload, Download, ChevronDown, Loader2, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { staggerContainer, itemUp, redBullSpring } from "@/lib/animations";

function safeFormatDate(dateStr: string | null | undefined, fmt = "dd/MM/yyyy"): string | null {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), fmt, { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Finance() {
  const { data: projects, isLoading: projectLoading } = useListProjects();
  const { data: payments, isLoading: paymentsLoading } = useListPayments();

  const project = projects?.[0];

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [comprovanteMap, setComprovanteMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!payments) return;
    const initial: Record<number, string> = {};
    payments.forEach((p) => {
      const filename = (p as Payment & { comprovanteFilename?: string }).comprovanteFilename;
      if (filename) initial[p.id] = filename;
    });
    setComprovanteMap(initial);
  }, [payments]);

  const totalPaid = payments?.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalProject = project?.valorProjeto ?? null;
  const remaining = totalProject !== null ? Math.max(0, totalProject - totalPaid) : null;
  const paidPercent = totalProject ? Math.min(100, Math.round((totalPaid / totalProject) * 100)) : 0;

  async function handleUpload(paymentId: number, file: File) {
    setUploading(paymentId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/client/payments/${paymentId}/comprovante`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json() as { filename: string };
        setComprovanteMap((prev) => ({ ...prev, [paymentId]: data.filename }));
        setExpandedId(null);
      }
    } catch (_) {
      // silent fail — in-memory storage
    } finally {
      setUploading(null);
    }
  }

  const isLoading = projectLoading || paymentsLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="w-full space-y-6 animate-pulse">
          <div className="h-12 bg-card rounded-2xl border border-border w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-28 bg-card rounded-3xl border border-border" />
            <div className="h-28 bg-card rounded-3xl border border-border" />
            <div className="h-28 bg-card rounded-3xl border border-border" />
          </div>
          <div className="h-64 bg-card rounded-3xl border border-border" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-8 pb-12"
      >
        {/* Page Header */}
        <motion.div variants={itemUp}>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.22em] font-mono mb-2">
            Portal do Cliente
          </p>
          <h1 className="text-3xl md:text-4xl font-display">Financeiro</h1>
        </motion.div>

        {/* Summary Cards */}
        <motion.div variants={itemUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total do Projeto */}
          <div className="glass-card rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Banknote className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Total</span>
            </div>
            <div>
              <p className="text-2xl font-display tabular-nums leading-none">
                {totalProject !== null ? formatBRL(totalProject) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Valor do projeto</p>
            </div>
          </div>

          {/* Total Pago */}
          <div
            className="glass-card rounded-3xl p-6 flex flex-col gap-4"
            style={{ background: "rgba(74,222,128,0.04)", borderColor: "rgba(74,222,128,0.15)" }}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(74,222,128,0.12)" }}>
                <CheckCircle2 className="w-5 h-5" style={{ color: "#4ADE80" }} />
              </div>
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Pago</span>
            </div>
            <div>
              <p className="text-2xl font-display tabular-nums leading-none" style={{ color: "#4ADE80" }}>
                {formatBRL(totalPaid)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {totalProject ? `${paidPercent}% do total` : "Total pago"}
              </p>
            </div>
          </div>

          {/* Saldo Devedor */}
          <div
            className="glass-card rounded-3xl p-6 flex flex-col gap-4"
            style={
              remaining && remaining > 0
                ? { background: "rgba(255,72,30,0.04)", borderColor: "rgba(255,72,30,0.15)" }
                : { background: "rgba(74,222,128,0.04)", borderColor: "rgba(74,222,128,0.15)" }
            }
          >
            <div className="flex items-center justify-between">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={remaining && remaining > 0 ? { background: "rgba(255,72,30,0.12)" } : { background: "rgba(74,222,128,0.12)" }}
              >
                {remaining && remaining > 0
                  ? <AlertCircle className="w-5 h-5 text-primary" />
                  : <CheckCircle2 className="w-5 h-5" style={{ color: "#4ADE80" }} />
                }
              </div>
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Devedor</span>
            </div>
            <div>
              <p
                className="text-2xl font-display tabular-nums leading-none"
                style={{ color: remaining && remaining > 0 ? "#FF481E" : "#4ADE80" }}
              >
                {remaining !== null ? formatBRL(remaining) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {remaining === 0 ? "Quitado ✓" : remaining !== null ? "Saldo em aberto" : "Sem info de total"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Payment progress bar */}
        {totalProject !== null && (
          <motion.div variants={itemUp} className="glass-card rounded-2xl px-6 py-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Progresso do pagamento
              </span>
              <span className="text-sm font-bold tabular-nums font-mono">{paidPercent}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: paidPercent === 100 ? "#4ADE80" : "var(--brand-gradient)" }}
                initial={{ width: 0 }}
                animate={{ width: `${paidPercent}%` }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Installments */}
        {payments && payments.length > 0 ? (
          <motion.div variants={itemUp} className="glass-card grain-overlay rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="px-6 md:px-8 py-6 border-b border-border/30">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-display">Parcelas</h2>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/20">
              {payments.map((p: Payment) => {
                const isPaid = p.status === "paid";
                const isOverdue = p.status === "overdue";
                const isExpanded = expandedId === p.id;
                const comprovanteFilename = comprovanteMap[p.id];

                return (
                  <div key={p.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="w-full flex items-center gap-4 px-6 md:px-8 py-4 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <span className="text-sm font-mono text-muted-foreground shrink-0 tabular-nums w-6">
                        {String(p.installmentNumber).padStart(2, "0")}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          {p.description ?? `Parcela ${p.installmentNumber}`}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          Venc: {safeFormatDate(p.dueDate) ?? p.dueDate}
                          {p.paidDate && ` · Pago: ${safeFormatDate(p.paidDate) ?? p.paidDate}`}
                          {comprovanteFilename && (
                            <span className="ml-2 text-primary">· 📎</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold tabular-nums font-mono text-base">
                          {formatBRL(p.amount)}
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg font-mono hidden sm:block"
                          style={
                            isPaid
                              ? { background: "rgba(74,222,128,0.15)", color: "#4ADE80" }
                              : isOverdue
                              ? { background: "rgba(239,68,68,0.15)", color: "#F87171" }
                              : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }
                          }
                        >
                          {isPaid ? "Pago" : isOverdue ? "Vencido" : "Pendente"}
                        </span>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={redBullSpring}>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Comprovante zone */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="comp"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                          style={{ overflow: "hidden" }}
                        >
                          <div
                            className="px-6 md:px-8 pb-5 pt-3 border-t border-border/20"
                            style={{ background: "rgba(255,255,255,0.015)" }}
                          >
                            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
                              Comprovante de pagamento
                            </p>

                            {comprovanteFilename ? (
                              <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border/50 bg-background/50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-primary shrink-0" />
                                  <span className="text-sm font-medium truncate">{comprovanteFilename}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <a
                                    href={`/api/client/payments/${p.id}/comprovante`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-opacity"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Baixar
                                  </a>
                                  <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                                    <Upload className="w-3.5 h-3.5" />
                                    Trocar
                                    <input
                                      type="file"
                                      accept=".pdf,image/jpeg,image/png"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleUpload(p.id, file);
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center gap-2 w-full py-5 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/[0.03] cursor-pointer transition-all group">
                                {uploading === p.id ? (
                                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                      Anexar comprovante — PDF, JPG, PNG (máx. 10 MB)
                                    </span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept=".pdf,image/jpeg,image/png"
                                  className="hidden"
                                  disabled={uploading === p.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleUpload(p.id, file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 md:px-8 py-5 border-t border-border/30 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-mono">Parcelas pagas:</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#4ADE80" }}>
                  {payments.filter((p: Payment) => p.status === "paid").length} / {payments.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-mono">Total pago:</span>
                <span className="font-bold tabular-nums font-mono" style={{ color: "#4ADE80" }}>
                  {formatBRL(totalPaid)}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={itemUp} className="glass-card rounded-3xl p-14 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Banknote className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-display">Sem parcelas cadastradas</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              O fluxo financeiro do seu projeto ainda não foi configurado. Entre em contato com seu consultor.
            </p>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
}
