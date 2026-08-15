import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Handshake, ChevronDown, ChevronRight } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  api,
  formatBRL,
  formatPhone,
  STAGE_LABELS,
  type Indicacao,
} from "@/lib/internal-api";

/**
 * Gestão de indicações.
 *
 * Quem indicou vem do pipeline de vendas (`lead.quem_esta_indicando`) e chega
 * junto com o negócio ganho. A tela agrupa por pessoa para responder a pergunta
 * que a operação faz: quanto essa indicação já trouxe.
 */
export default function IndicacoesPage() {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: indicacoes, isLoading } = useQuery<Indicacao[]>({
    queryKey: ["internal-indicacoes"],
    queryFn: () => api.get<Indicacao[]>("/internal/indicacoes"),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return indicacoes ?? [];
    return (indicacoes ?? []).filter(
      (i) =>
        i.nome.toLowerCase().includes(term) ||
        (i.telefone ?? "").includes(term.replace(/\D/g, "")) ||
        i.projetos.some((p) => p.clientName.toLowerCase().includes(term)),
    );
  }, [indicacoes, q]);

  const totais = useMemo(() => {
    const lista = indicacoes ?? [];
    return {
      pessoas: lista.length,
      projetos: lista.reduce((s, i) => s + i.total, 0),
      valor: lista.reduce((s, i) => s + i.valorTotal, 0),
    };
  }, [indicacoes]);

  const chave = (i: Indicacao) => i.telefone ?? `nome:${i.nome.toLowerCase()}`;

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
            <Handshake className="w-5 h-5 text-primary" /> Indicações
          </h1>
          <p className="text-sm text-muted-foreground">
            {totais.pessoas} {totais.pessoas === 1 ? "indicador" : "indicadores"} ·{" "}
            {totais.projetos} {totais.projetos === 1 ? "negócio" : "negócios"} ·{" "}
            {formatBRL(totais.valor)} indicados
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Quem indicou ou cliente"
            className="pl-9 w-64 h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">
            {q ? "Nenhuma indicação encontrada." : "Nenhum negócio indicado ainda."}
          </p>
          {!q && (
            <p className="text-xs text-muted-foreground/70 mt-2">
              A indicação chega junto com o negócio ganho, do campo “quem está indicando” do lead.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Quem indicou</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium text-center">Negócios</th>
                  <th className="px-4 py-3 font-medium text-right">Valor indicado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const k = chave(i);
                  const expandido = aberto === k;
                  return [
                    <tr
                      key={k}
                      onClick={() => setAberto(expandido ? null : k)}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-foreground">
                        <span className="inline-flex items-center gap-2">
                          {expandido ? (
                            <ChevronDown className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          {i.nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {i.telefone ? formatPhone(i.telefone) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">{i.total}</td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatBRL(i.valorTotal)}
                      </td>
                    </tr>,
                    expandido && (
                      <tr key={`${k}-detalhe`} className="border-b border-white/5 bg-background/40">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="space-y-2">
                            {i.projetos.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-4 flex-wrap"
                              >
                                <Link href={`/interno/projetos/${p.id}`}>
                                  <span className="text-foreground hover:text-primary cursor-pointer">
                                    #{p.id} · {p.clientName}
                                  </span>
                                </Link>
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {STAGE_LABELS[p.stage] ?? p.stage}
                                  </Badge>
                                  <span className="text-muted-foreground tabular-nums">
                                    {formatBRL(p.valorProjeto)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </InternalLayout>
  );
}
