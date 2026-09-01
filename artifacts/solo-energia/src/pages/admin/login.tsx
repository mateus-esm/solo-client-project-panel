import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Lock, Eye, EyeOff, Loader2, FlaskConical } from "lucide-react";
import logoLight from "@assets/001_1775433962945.png";
import { ADMIN_AUTH_KEY } from "@/hooks/use-admin-auth";

const IS_DEV = import.meta.env.DEV;

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        navigate("/admin");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Senha incorreta");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/dev-login", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Falha no login de desenvolvimento");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ADMIN_AUTH_KEY });
      navigate("/admin");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoLight} alt="Solo Energia" className="h-8 mx-auto mb-6 opacity-90" />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--brand-gradient)" }}>
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-display text-foreground mb-1">Painel Admin</h1>
          <p className="text-sm text-muted-foreground">Solo Energia — Área restrita</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
              Senha de Acesso
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-gradient)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Entrar no Painel
          </button>
        </form>

        {IS_DEV && (
          <button
            type="button"
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold text-muted-foreground border border-dashed border-white/10 hover:border-white/20 hover:text-foreground disabled:opacity-40 transition-all"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            Entrar sem senha (somente desenvolvimento)
          </button>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso exclusivo para a equipe Solo Energia
        </p>
      </div>
    </div>
  );
}
