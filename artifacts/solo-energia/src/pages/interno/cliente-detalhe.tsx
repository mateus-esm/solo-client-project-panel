import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Sun, FolderOpen } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  api,
  formatBRL,
  formatPhone,
  STAGE_LABELS,
  type ClientDetail,
  type StageId,
} from "@/lib/internal-api";

const FIELDS = [
  ["name", "Nome"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["cpfCnpj", "CPF / CNPJ"],
  ["address", "Endereço"],
  ["city", "Cidade"],
  ["state", "UF"],
] as const;

export default function ClienteDetalhePage() {
  const [, params] = useRoute("/interno/clientes/:id");
  const clientId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["internal-client", clientId];

  const { data, isLoading } = useQuery<ClientDetail>({
    queryKey,
    queryFn: () => api.get<ClientDetail>(`/internal/clients/${clientId}`),
    enabled: Number.isFinite(clientId),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    const c = data.client as unknown as Record<string, unknown>;
    setForm(Object.fromEntries(FIELDS.map(([k]) => [k, String(c[k] ?? "")])));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/internal/clients/${clientId}`, {
        ...Object.fromEntries(FIELDS.map(([k]) => [k, form[k]?.trim() || null])),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["internal-clients"] });
      toast({ title: "Cliente atualizado" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return (
      <InternalLayout>
        <div className="h-64 bg-card rounded-2xl border border-white/5 animate-pulse" />
      </InternalLayout>
    );
  }

  const { client, projects, plants } = data;

  return (
    <InternalLayout>
      <Link href="/interno/clientes">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar aos clientes
        </span>
      </Link>

      <div className="bg-card border border-white/5 rounded-3xl p-6 md:p-8 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatPhone(client.phoneNormalized)} · origem {client.origem}
            </p>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={key === "cpfCnpj" ? "ainda não informado" : ""}
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={form.observacoes ?? client.observacoes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-white/5 rounded-3xl p-6">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4 text-primary" /> Projetos ({projects.length})
          </h2>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum projeto vinculado.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <Link key={p.id} href={`/interno/projetos/${p.id}`}>
                  <div className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{p.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.systemPower} kWp · {formatBRL(p.valorProjeto)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {STAGE_LABELS[p.stage as StageId] ?? p.stage}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-white/5 rounded-3xl p-6">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
            <Sun className="w-4 h-4 text-primary" /> Usinas ({plants.length})
          </h2>
          {plants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma usina cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {plants.map((pl) => (
                <div key={pl.id} className="bg-background/50 rounded-xl px-4 py-3">
                  <p className="text-sm text-foreground">{pl.name ?? "Usina"}</p>
                  <p className="text-xs text-muted-foreground">
                    {pl.potenciaInstaladaKwp ?? "—"} kWp
                    {pl.concessionaria ? ` · ${pl.concessionaria}` : ""}
                    {pl.moduloQuantidade ? ` · ${pl.moduloQuantidade} módulos` : ""}
                  </p>
                  {pl.enderecoInstalacao && (
                    <p className="text-xs text-muted-foreground mt-1">{pl.enderecoInstalacao}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InternalLayout>
  );
}
