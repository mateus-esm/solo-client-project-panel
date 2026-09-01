import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, FlaskConical } from "lucide-react";
import logoUrl from "@assets/001_1775433962945.png";
import { useQueryClient } from "@tanstack/react-query";
import { HOMOLOGACAO_AUTH_KEY } from "@/hooks/use-homologacao-auth";

const IS_DEV = import.meta.env.DEV;

export default function HomologacaoLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/homologacao/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao entrar");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: HOMOLOGACAO_AUTH_KEY });
      navigate("/homologacao");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/homologacao/auth/dev-login", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Falha no login de desenvolvimento");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: HOMOLOGACAO_AUTH_KEY });
      navigate("/homologacao");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-white/5 rounded-3xl p-8">
          {/* Logo */}
          <div className="mb-8">
            <img src={logoUrl} alt="Solo Energia" className="h-8 w-auto object-contain mb-2" />
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">Equipe de Homologação</p>
          </div>

          <h1 className="text-xl font-display text-foreground mb-1">Acesso</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Entre com suas credenciais de técnico
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tecnico@empresa.com"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {IS_DEV && (
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-muted-foreground border border-dashed border-white/10 hover:border-white/20 hover:text-foreground disabled:opacity-40 transition-all"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
              Entrar sem senha (somente desenvolvimento)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
