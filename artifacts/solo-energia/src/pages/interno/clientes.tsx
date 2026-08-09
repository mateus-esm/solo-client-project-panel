import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, PhoneOff, Users } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, formatPhone, type Client } from "@/lib/internal-api";

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [semTelefone, setSemTelefone] = useState(false);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["internal-clients"],
    queryFn: () => api.get<Client[]>("/internal/clients"),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (clients ?? []).filter((c) => {
      if (semTelefone && c.phoneNormalized) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.phoneNormalized ?? "").includes(term.replace(/\D/g, "")) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [clients, q, semTelefone]);

  const semTel = (clients ?? []).filter((c) => !c.phoneNormalized).length;

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {clients?.length ?? 0} clientes
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, telefone ou e-mail"
              className="pl-9 w-64 h-9"
            />
          </div>
          <button
            onClick={() => setSemTelefone((v) => !v)}
            className={
              semTelefone
                ? "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-primary/15 text-primary border border-primary/30"
                : "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-muted-foreground border border-white/10 hover:text-foreground"
            }
          >
            <PhoneOff className="w-3.5 h-3.5" /> Sem telefone ({semTel})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Endereço</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium text-center">Projetos</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/interno/clientes/${c.id}`}>
                        <span className="text-foreground hover:text-primary cursor-pointer">{c.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {c.phoneNormalized ? (
                        <span className="text-foreground">{formatPhone(c.phoneNormalized)}</span>
                      ) : (
                        <span className="text-xs text-primary/80 inline-flex items-center gap-1">
                          <PhoneOff className="w-3 h-3" /> sem telefone
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.address ? c.address.slice(0, 34) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {c.origem}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-foreground">{c.projectCount ?? 0}</td>
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
