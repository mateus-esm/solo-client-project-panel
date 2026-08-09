import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sun, Pencil, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, type Plant } from "@/lib/internal-api";

// Campos da ficha: texto livre e números. Série/datalogger/credenciais do inversor
// ficam para a Sprint 2, junto com a criptografia.
const FIELDS: [keyof Plant, string, "text" | "number"][] = [
  ["potenciaInstaladaKwp", "Potência instalada (kWp)", "number"],
  ["concessionaria", "Concessionária", "text"],
  ["enderecoInstalacao", "Endereço de instalação", "text"],
  ["consumoMedioMensal", "Consumo médio mensal (kWh)", "number"],
  ["moduloFabricante", "Módulo — fabricante", "text"],
  ["moduloPotenciaW", "Módulo — potência (W)", "number"],
  ["moduloQuantidade", "Módulo — quantidade", "number"],
  ["inversorFabricante", "Inversor — fabricante", "text"],
  ["inversorPotenciaKw", "Inversor — potência (kW)", "number"],
  ["inversorQuantidade", "Inversor — quantidade", "number"],
  ["tipoEstrutura", "Tipo de estrutura", "text"],
  ["tipoMonitoramento", "Tipo de monitoramento", "text"],
  ["monitoramentoUrl", "Link do monitoramento", "text"],
  ["driveUrl", "Drive", "text"],
  ["geracaoEstimadaKwh", "Geração estimada (kWh)", "number"],
  ["dataAtivacao", "Data de ativação", "text"],
];

export function PlantCard({ projectId }: { projectId: number }) {
  const queryKey = ["internal-plant", projectId];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: plant, isLoading } = useQuery<Plant | null>({
    queryKey,
    queryFn: () => api.get<Plant | null>(`/internal/plants/by-project/${projectId}`),
  });

  useEffect(() => {
    if (!plant) return;
    const p = plant as unknown as Record<string, unknown>;
    setForm(Object.fromEntries(FIELDS.map(([k]) => [k as string, String(p[k as string] ?? "")])));
  }, [plant]);

  const body = () =>
    Object.fromEntries(
      FIELDS.map(([k, , type]) => {
        const raw = form[k as string]?.trim();
        if (!raw) return [k, null];
        return [k, type === "number" ? Number(raw) : raw];
      }),
    );

  const save = useMutation({
    mutationFn: () =>
      plant
        ? api.patch<Plant>(`/internal/plants/${plant.id}`, body())
        : api.post<Plant>("/internal/plants", { ...body(), projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditing(false);
      toast({ title: "Usina salva" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar usina", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="h-40 bg-card rounded-3xl border border-white/5 animate-pulse" />;
  }

  const info = (label: string, value: unknown, suffix = "") =>
    value === null || value === undefined || value === "" ? null : (
      <div key={label}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">
          {String(value)}
          {suffix}
        </p>
      </div>
    );

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Sun className="w-4 h-4 text-primary" /> Ficha da usina
        </h2>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {plant ? (
              <>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 mr-2" /> Cadastrar
              </>
            )}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="grid md:grid-cols-3 gap-3">
          {FIELDS.map(([key, label, type]) => (
            <div key={key as string}>
              <Label className="text-xs">{label}</Label>
              <Input
                type={type}
                value={form[key as string] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key as string]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      ) : !plant ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma usina cadastrada para este projeto.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {info("Potência", plant.potenciaInstaladaKwp, " kWp")}
            {info("Concessionária", plant.concessionaria)}
            {info(
              "Módulos",
              plant.moduloQuantidade
                ? `${plant.moduloQuantidade}× ${plant.moduloPotenciaW ?? "?"}W ${plant.moduloFabricante ?? ""}`.trim()
                : null,
            )}
            {info(
              "Inversor",
              plant.inversorFabricante
                ? `${plant.inversorQuantidade ?? 1}× ${plant.inversorFabricante} ${plant.inversorPotenciaKw ? `${plant.inversorPotenciaKw}kW` : ""}`.trim()
                : null,
            )}
            {info("Estrutura", plant.tipoEstrutura)}
            {info("Monitoramento", plant.tipoMonitoramento)}
            {info("Consumo médio", plant.consumoMedioMensal, " kWh")}
            {info("Ativação", plant.dataAtivacao)}
          </div>
          {plant.enderecoInstalacao && (
            <p className="text-xs text-muted-foreground mt-4">{plant.enderecoInstalacao}</p>
          )}
          <div className="flex gap-3 mt-4">
            {plant.monitoramentoUrl && (
              <a
                href={plant.monitoramentoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Monitoramento <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {plant.driveUrl && (
              <a
                href={plant.driveUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Drive <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
