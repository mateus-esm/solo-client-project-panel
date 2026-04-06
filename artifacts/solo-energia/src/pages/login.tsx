import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { requestOtp, verifyOtp } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_QUERY_KEY } from "@/hooks/use-auth";
import { Mail, ArrowRight, Loader2, ChevronLeft, AlertCircle } from "lucide-react";
import logoLight from "@assets/001_1775433962945.png";

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

type LoginStep = "email" | "otp" | "no_project";

export default function Login() {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await requestOtp({ email: email.trim().toLowerCase() });
      setStep("otp");
      setResendCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        setError("Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo código.");
      } else {
        setError("Não foi possível enviar o código. Verifique o e-mail e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError(null);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "") && digit) {
      await submitOtp(next.join(""));
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function submitOtp(code: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await verifyOtp({ email, code });

      if ((result as { status?: string }).status === "no_project") {
        setStep("no_project");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      window.location.href = "/";
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        setError("Muitas tentativas. Solicite um novo código para continuar.");
        setOtp(["", "", "", "", "", ""]);
      } else {
        setError("Código inválido ou expirado. Verifique e tente novamente.");
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      await requestOtp({ email });
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        setError("Muitas tentativas. Aguarde alguns minutos.");
      } else {
        setError("Falha ao reenviar código.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow — brand gradient radial */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-15"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none opacity-8"
        style={{ background: "var(--brand-gradient-135)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <img
            src={logoLight}
            alt="Solo Energia — Você no controle da sua energia"
            className="h-14 w-auto object-contain mb-3"
          />
          <p className="text-xs text-muted-foreground tracking-wide uppercase font-medium">
            Portal do Cliente
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.div
              key="email-step"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="bg-card border border-white/5 rounded-3xl p-8 shadow-2xl shadow-black/50">
                <h2 className="text-xl font-display mb-2">Bem-vindo</h2>
                <p className="text-muted-foreground text-sm mb-8">
                  Digite o e-mail cadastrado no seu projeto para receber o código de acesso.
                </p>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoFocus
                      className="w-full bg-secondary border border-border rounded-xl pl-11 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-400"
                    >
                      {error}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all duration-200"
                    style={{
                      background: loading || !email.trim()
                        ? "hsl(var(--primary))"
                        : "var(--brand-gradient)",
                      boxShadow: "0 8px 24px rgba(255,72,30,0.25)",
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Receber código de acesso
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp-step"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="bg-card border border-white/5 rounded-3xl p-8 shadow-2xl shadow-black/50">
                <button
                  onClick={() => { setStep("email"); setError(null); setOtp(["", "", "", "", "", ""]); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </button>

                <h2 className="text-xl font-display mb-2">Verifique seu e-mail</h2>
                <p className="text-muted-foreground text-sm mb-8">
                  Enviamos um código de 6 dígitos para{" "}
                  <span className="text-foreground font-medium">{email}</span>
                </p>

                <div className="flex gap-2 justify-center mb-6">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={loading}
                      style={digit ? {
                        borderColor: "#FF481E",
                        color: "#FF481E",
                        boxShadow: "0 0 16px rgba(255,72,30,0.25)",
                      } : undefined}
                      className={`w-12 h-14 text-center text-2xl font-bold bg-secondary border rounded-xl focus:outline-none transition-all duration-200 disabled:opacity-50
                        ${!digit && "border-border text-foreground focus:border-primary focus:shadow-[0_0_12px_rgba(255,72,30,0.25)]"}
                      `}
                    />
                  ))}
                </div>

                {loading && (
                  <div className="flex justify-center mb-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 text-center mb-4"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors py-2"
                >
                  {resendCooldown > 0
                    ? `Reenviar código em ${resendCooldown}s`
                    : "Reenviar código"}
                </button>
              </div>
            </motion.div>
          )}

          {step === "no_project" && (
            <motion.div
              key="no-project-step"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="bg-card border border-white/5 rounded-3xl p-8 shadow-2xl shadow-black/50 text-center">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-7 h-7 text-orange-400" />
                </div>
                <h2 className="text-xl font-display mb-3">Conta não vinculada</h2>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Seu e-mail foi verificado com sucesso, mas ainda não há um projeto vinculado a{" "}
                  <span className="text-foreground font-medium">{email}</span>.
                </p>
                <p className="text-muted-foreground text-sm mb-8">
                  Entre em contato com o seu consultor Solar para que seu acesso seja configurado.
                </p>
                <button
                  onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(null); }}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Tentar com outro e-mail
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
