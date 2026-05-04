import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Users, Plus, Search, ChevronRight, Zap, MapPin, Activity, LogOut, Loader2, Trash2 } from "lucide-react";
import { useAdminLogout } from "@/hooks/use-admin-auth";
import logoLight from "@assets/001_1775433962945.png";

const STEPS = ["", "Onboarding", "Projeto Técnico", "Homologação", "Logística", "Execução", "Ativação", "Treinamento"];

const STEP_COLORS: Record<number, string> = {
  1: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  2: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  3: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  4: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  5: "bg-green-500/10 text-green-400 border-green-500/20",
  6: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  7: "bg-primary/10 text-primary border-primary/20",
};

type Project = {
  id: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  city: string;
  state: string;
  statusStep: number;
  completionPercent: number;
  systemPower: number;
  valorProjeto: number | null;
  createdAt: string;
};

export default function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStep, setFilterStep] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const logoutMutation = useAdminLogout();

  async function fetchProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/projects", { credentials: "include" });
      const data = await res.json();
      setProjects(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProjects(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("Remover este projeto? Esta ação não pode ser desfeita.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/projects/${id}`, { method: "DELETE", credentials: "include" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.clientName.toLowerCase().includes(q) || p.clientEmail.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
    const matchStep = filterStep === null || p.statusStep === filterStep;
    return matchSearch && matchStep;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoLight} alt="Solo Energia" className="h-6 opacity-90" />
            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-0.5 rounded-md">ADMIN</span>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display text-foreground">Projetos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Carregando…" : `${projects.length} cliente${projects.length !== 1 ? "s" : ""} cadastrado${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href="/admin/projects/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou cidade…"
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
          <select
            value={filterStep ?? ""}
            onChange={(e) => setFilterStep(e.target.value === "" ? null : Number(e.target.value))}
            className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <option value="">Todas as fases</option>
            {STEPS.slice(1).map((s, i) => (
              <option key={i + 1} value={i + 1}>{s}</option>
            ))}
          </select>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[1, 3, 5, 7].map((step) => {
            const count = projects.filter((p) => p.statusStep === step).length;
            return (
              <button
                key={step}
                onClick={() => setFilterStep(filterStep === step ? null : step)}
                className={`glass-card rounded-2xl p-4 text-left transition-all hover:border-white/10 ${filterStep === step ? "border-primary/40 bg-primary/5" : ""}`}
              >
                <p className="text-2xl font-display">{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{STEPS[step]}</p>
              </button>
            );
          })}
        </div>

        {/* Project list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum projeto encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="glass-card rounded-2xl p-5 flex items-center gap-4 group hover:border-white/10 transition-all"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: "var(--brand-gradient-135)" }}
                >
                  {project.clientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground truncate">{project.clientName}</p>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-md border ${STEP_COLORS[project.statusStep] ?? STEP_COLORS[1]}`}>
                      {STEPS[project.statusStep] ?? `Fase ${project.statusStep}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{project.clientEmail}</span>
                    {project.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {project.city}, {project.state}
                      </span>
                    )}
                    {project.systemPower > 0 && (
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {project.systemPower.toFixed(2)} kWp
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold font-mono text-foreground">{project.completionPercent}%</span>
                  <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${project.completionPercent}%`, background: "var(--brand-gradient)" }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDelete(project.id)}
                    disabled={deleting === project.id}
                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    {deleting === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-secondary hover:bg-white/10 rounded-xl transition-colors"
                  >
                    Editar
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
