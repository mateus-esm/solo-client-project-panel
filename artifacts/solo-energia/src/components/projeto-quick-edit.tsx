/**
 * Edição rápida do projeto sem sair da tela onde você está.
 *
 * O caminho antigo para trocar um telefone era: pipeline → ficha do projeto →
 * editar → voltar. Aqui abre uma gaveta por cima, salva e fecha.
 *
 * Dados do cliente e do projeto convivem na mesma gaveta porque na cabeça de
 * quem opera é tudo "o projeto do Fulano" — e o servidor mantém os dois
 * cadastros em sincronia ao salvar.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Save, Loader2, User, Zap, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { NotificarWhatsApp } from "@/components/notificar-whatsapp";
import {
  api,
  STAGES,
  STAGE_LABELS,
  subStagesFor,
  type InternalProject,
  type StageId,
} from "@/lib/internal-api";

type Aba = "dados" | "notificar";

/** Campos editáveis, como texto — o formulário converte na hora de salvar. */
interface Form {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  city: string;
  state: string;
  systemPower: string;
  capex: string;
  valorProjeto: string;
  notes: string;
  stage: StageId;
  subStage: string | null;
}

function paraForm(p: InternalProject): Form {
  return {
    clientName: p.clientName,
    clientPhone: p.clientPhone ?? "",
    clientEmail: p.clientEmail,
    city: p.city,
    state: p.state,
    systemPower: p.systemPower != null ? String(p.systemPower) : "",
    capex: p.capex != null ? String(p.capex) : "",
    valorProjeto: p.valorProjeto != null ? String(p.valorProjeto) : "",
    notes: p.notes ?? "",
    stage: p.stage,
    subStage: p.subStage,
  };
}

function numeroOuNulo(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

export function ProjetoQuickEdit({
  projectId,
  onClose,
}: {
  projectId: number | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("dados");
  const [form, setForm] = useState<Form | null>(null);

  const { data: projeto } = useQuery<InternalProject>({
    queryKey: ["internal-project-quick", projectId],
    queryFn: () => api.get<InternalProject>(`/internal/projects/${projectId}/resumo`),
    enabled: projectId !== null,
  });

  useEffect(() => {
    if (projeto) setForm(paraForm(projeto));
  }, [projeto]);

  // Cada abertura começa nos dados — é para isso que a gaveta existe.
  useEffect(() => {
    if (projectId !== null) setAba("dados");
  }, [projectId]);

  const salvar = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Formulário não carregado");
      return api.patch(`/internal/projects/${projectId}`, {
        clientName: form.clientName,
        clientPhone: form.clientPhone || null,
        clientEmail: form.clientEmail,
        city: form.city,
        state: form.state,
        systemPower: numeroOuNulo(form.systemPower) ?? 0,
        capex: numeroOuNulo(form.capex),
        valorProjeto: numeroOuNulo(form.valorProjeto),
        notes: form.notes || null,
        stage: form.stage,
        ...(form.subStage ? { subStage: form.subStage } : {}),
      });
    },
    onSuccess: () => {
      // A gaveta vive por cima do pipeline e da lista de clientes; as duas
      // precisam refletir a edição sem recarregar a página.
      for (const key of [
        ["internal-projects"],
        ["internal-project-quick", projectId],
        ["internal-project", projectId],
        ["internal-clients"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast({ title: "Projeto atualizado", description: "Cadastro do cliente também." });
    },
    onError: (err: Error) =>
      toast({ title: "Não deu para salvar", description: err.message, variant: "destructive" }),
  });

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const subStages = form ? subStagesFor(form.stage) : [];

  return (
    <Sheet open={projectId !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{projeto?.clientName ?? "Carregando…"}</span>
            {projectId !== null && (
              <Link href={`/interno/projetos/${projectId}`}>
                <span
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  onClick={onClose}
                >
                  Ficha completa <ExternalLink className="w-3 h-3" />
                </span>
              </Link>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-1 mt-4 mb-5 bg-background/50 rounded-xl p-1">
          {(
            [
              ["dados", "Dados", User],
              ["notificar", "Notificar", MessageCircle],
            ] as const
          ).map(([id, label, Icone]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-colors " +
                (aba === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icone className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {aba === "dados" && form && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Cliente
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={form.clientName} onChange={set("clientName")} className="h-9 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                    <Input
                      value={form.clientPhone}
                      onChange={set("clientPhone")}
                      placeholder="(85) 9 9999-9999"
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">E-mail</Label>
                    <Input
                      type="email"
                      value={form.clientEmail}
                      onChange={set("clientEmail")}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary" /> Projeto
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Cidade</Label>
                    <Input value={form.city} onChange={set("city")} className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">UF</Label>
                    <Input
                      value={form.state}
                      onChange={set("state")}
                      maxLength={2}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Potência (kWp)</Label>
                    <Input
                      value={form.systemPower}
                      onChange={set("systemPower")}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Capex (R$)</Label>
                    <Input value={form.capex} onChange={set("capex")} className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                    <Input
                      value={form.valorProjeto}
                      onChange={set("valorProjeto")}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Macro-etapa</Label>
                    <Select
                      value={form.stage}
                      onValueChange={(v) =>
                        setForm((f) => (f ? { ...f, stage: v as StageId, subStage: null } : f))
                      }
                    >
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {subStages.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Sub-etapa</Label>
                      <Select
                        value={
                          subStages.some((g) => g.slug === form.subStage)
                            ? (form.subStage as string)
                            : undefined
                        }
                        onValueChange={(v) => setForm((f) => (f ? { ...f, subStage: v } : f))}
                      >
                        <SelectTrigger className="h-9 mt-1">
                          <SelectValue placeholder="Selecionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          {subStages.map((g) => (
                            <SelectItem key={g.slug} value={g.slug}>
                              {g.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <Textarea rows={3} value={form.notes} onChange={set("notes")} className="mt-1 text-sm" />
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Salvar
            </Button>
          </div>
        )}

        {aba === "notificar" && projectId !== null && (
          // O mesmo bloco da ficha do projeto: template, ajuste, envio, grupos.
          <NotificarWhatsApp
            projectId={projectId}
            invalidateKeys={[["internal-projects"], ["internal-project-quick", projectId]]}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
