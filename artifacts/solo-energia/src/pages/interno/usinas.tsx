import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sun, Search, ExternalLink, MonitorOff } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Input } from "@/components/ui/input";
import { api, type Plant } from "@/lib/internal-api";

export default function UsinasPage() {
  const [q, setQ] = useState("");
  const [semMonitoramento, setSemMonitoramento] = useState(false);

  const { data: plants, isLoading } = useQuery<Plant[]>({
    queryKey: ["internal-plants"],
    queryFn: () => api.get<Plant[]>("/internal/plants"),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (plants ?? []).filter((p) => {
      if (semMonitoramento && p.monitoramentoUrl) return false;
      if (!term) return true;
      return [p.name, p.concessionaria, p.enderecoInstalacao, p.inversorFabricante]
        .some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [plants, q, semMonitoramento]);

  const totalKwp = (plants ?? []).reduce((n, p) => n + (p.potenciaInstaladaKwp ?? 0), 0);
  const semMon = (plants ?? []).filter((p) => !p.monitoramentoUrl).length;

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
            <Sun className="w-5 h-5 text-primary" /> Usinas
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {plants?.length ?? 0} usinas · {totalKwp.toFixed(1)} kWp instalados
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Usina, concessionária, inversor"
              className="pl-9 w-64 h-9"
            />
          </div>
          <button
            onClick={() => setSemMonitoramento((v) => !v)}
            className={
              semMonitoramento
                ? "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-primary/15 text-primary border border-primary/30"
                : "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-muted-foreground border border-white/10 hover:text-foreground"
            }
          >
            <MonitorOff className="w-3.5 h-3.5" /> Sem monitoramento ({semMon})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Nenhuma usina encontrada.</p>
        </div>
      ) : (
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Usina</th>
                  <th className="px-4 py-3 font-medium text-right">kWp</th>
                  <th className="px-4 py-3 font-medium">Concessionária</th>
                  <th className="px-4 py-3 font-medium">Módulos</th>
                  <th className="px-4 py-3 font-medium">Inversor</th>
                  <th className="px-4 py-3 font-medium">Monitoramento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3">
                      {p.projectId ? (
                        <Link href={`/interno/projetos/${p.projectId}`}>
                          <span className="text-foreground hover:text-primary cursor-pointer">
                            {p.name ?? `Usina #${p.id}`}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-foreground">{p.name ?? `Usina #${p.id}`}</span>
                      )}
                      {p.enderecoInstalacao && (
                        <p className="text-xs text-muted-foreground">
                          {p.enderecoInstalacao.slice(0, 40)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {p.potenciaInstaladaKwp ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.concessionaria ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.moduloQuantidade
                        ? `${p.moduloQuantidade}× ${p.moduloPotenciaW ?? "?"}W`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.inversorFabricante ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.monitoramentoUrl ? (
                        <a
                          href={p.monitoramentoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          abrir <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </InternalLayout>
  );
}
