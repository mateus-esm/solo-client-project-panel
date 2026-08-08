import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  api,
  formatBRL,
  PAYMENT_PLAN_TYPES,
  PAYMENT_PLAN_LABELS,
  type InternalProject,
  type ProjectPayment,
  type PaymentPlanType,
} from "@/lib/internal-api";

const fmtDate = (v: string | null) =>
  v ? new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR") : "—";

// ─── Resumo financeiro da Solo ────────────────────────────────────────────────

function CostInput({
  label,
  value,
  onSave,
  hint,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  hint?: string;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text ? Number(text) : null)}
        className="mt-1 h-9"
      />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ResumoFinanceiro({
  project,
  invalidateKey,
}: {
  project: InternalProject;
  invalidateKey: unknown[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/internal/projects/${project.id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const custos =
    (project.capex ?? 0) +
    (project.custoMateriais ?? 0) +
    (project.custoServico ?? 0) +
    (project.homologacaoValor ?? 0);
  const receitaLiquida = project.receitaBruta != null ? project.receitaBruta - custos : null;

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <CostInput
          label="Receita bruta (R$)"
          value={project.receitaBruta}
          onSave={(v) => patch.mutate({ receitaBruta: v })}
        />
        <CostInput
          label="Capex — equipamentos (R$)"
          value={project.capex}
          onSave={(v) => patch.mutate({ capex: v })}
          hint="Alimentado pelas compras de equipamentos; editável manualmente."
        />
        <CostInput
          label="Outros materiais (R$)"
          value={project.custoMateriais}
          onSave={(v) => patch.mutate({ custoMateriais: v })}
          hint="Alimentado pelas compras de materiais avulsos; editável manualmente."
        />
        <CostInput
          label="Custo do serviço de instalação (R$)"
          value={project.custoServico}
          onSave={(v) => patch.mutate({ custoServico: v })}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-background/50 rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground">Homologação</p>
          <p className="text-sm text-foreground font-medium">{formatBRL(project.homologacaoValor)}</p>
          <p className="text-[10px] text-muted-foreground">editar na seção Homologação</p>
        </div>
        <div className="bg-background/50 rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground">Custos totais</p>
          <p className="text-sm text-foreground font-medium">{formatBRL(custos || null)}</p>
        </div>
        <div className="bg-background/50 rounded-xl px-4 py-3 col-span-2">
          <p className="text-xs text-muted-foreground">Receita líquida do projeto</p>
          <p
            className="text-lg font-medium"
            style={{ color: receitaLiquida == null ? undefined : receitaLiquida >= 0 ? "#4ADE80" : "#F87171" }}
          >
            {receitaLiquida != null ? formatBRL(receitaLiquida) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">receita bruta − capex − materiais − serviço − homologação</p>
        </div>
      </div>
    </div>
  );
}

// ─── Plano de pagamento do cliente ────────────────────────────────────────────

function PlanoForm({
  project,
  invalidateKeys,
  onDone,
}: {
  project: InternalProject;
  invalidateKeys: unknown[][];
  onDone: () => void;
}) {
  const [tipo, setTipo] = useState<PaymentPlanType>("avista");
  const [total, setTotal] = useState(project.valorProjeto != null ? String(project.valorProjeto) : "");
  const [primeiraData, setPrimeiraData] = useState("");
  const [numParcelas, setNumParcelas] = useState("12");
  const [valorEntrada, setValorEntrada] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () =>
      api.post(`/internal/projects/${project.id}/payment-plan`, {
        tipo,
        total: Number(total),
        primeiraData,
        numParcelas: tipo === "cartao" || tipo === "parcelado_solo" ? Number(numParcelas) : undefined,
        valorEntrada: tipo === "entrada_entrega" ? Number(valorEntrada) : undefined,
        dataEntrega: tipo === "entrada_entrega" ? dataEntrega : undefined,
      }),
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: "Plano de pagamento gerado", description: "As parcelas já aparecem no portal do cliente." });
      onDone();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao gerar plano", description: err.message, variant: "destructive" }),
  });

  const needsParcelas = tipo === "cartao" || tipo === "parcelado_solo";
  const needsEntrada = tipo === "entrada_entrega";
  const valid =
    Number(total) > 0 &&
    primeiraData &&
    (!needsParcelas || Number(numParcelas) >= 2) &&
    (!needsEntrada || (Number(valorEntrada) > 0 && Number(valorEntrada) < Number(total) && dataEntrega));

  return (
    <div className="bg-background/50 rounded-2xl p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Formato</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as PaymentPlanType)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_PLAN_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{PAYMENT_PLAN_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Valor total (R$) *</Label>
          <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{needsEntrada ? "Data da entrada *" : "Primeiro vencimento *"}</Label>
          <Input type="date" value={primeiraData} onChange={(e) => setPrimeiraData(e.target.value)} className="h-9" />
        </div>
        {needsParcelas && (
          <div>
            <Label className="text-xs">Número de parcelas *</Label>
            <Input type="number" min={2} max={60} value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} className="h-9" />
          </div>
        )}
        {needsEntrada && (
          <>
            <div>
              <Label className="text-xs">Valor da entrada (R$) *</Label>
              <Input type="number" value={valorEntrada} onChange={(e) => setValorEntrada(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Data prevista da entrega *</Label>
              <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className="h-9" />
            </div>
          </>
        )}
      </div>
      <Button className="w-full" disabled={!valid || generate.isPending} onClick={() => generate.mutate()}>
        {generate.isPending ? "Gerando..." : "Gerar parcelas"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Gerar um novo plano substitui as parcelas atuais (bloqueado se houver parcela paga).
      </p>
    </div>
  );
}

export function FinanceiroSection({
  project,
  invalidateKey,
}: {
  project: InternalProject;
  invalidateKey: unknown[];
}) {
  const paymentsKey = ["internal-payments", project.id];
  const { data: payments } = useQuery<ProjectPayment[]>({
    queryKey: paymentsKey,
    queryFn: () => api.get<ProjectPayment[]>(`/internal/projects/${project.id}/payments`),
  });
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: paymentsKey });
    queryClient.invalidateQueries({ queryKey: invalidateKey });
  };

  const togglePaid = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) =>
      api.patch(`/internal/payments/${id}`, { status: paid ? "paid" : "pending" }),
    onSuccess: invalidateAll,
    onError: (err: Error) =>
      toast({ title: "Erro ao atualizar parcela", description: err.message, variant: "destructive" }),
  });

  const removePlan = useMutation({
    mutationFn: () => api.del(`/internal/projects/${project.id}/payment-plan`),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Plano removido" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao remover plano", description: err.message, variant: "destructive" }),
  });

  const list = payments ?? [];
  const totalPago = list.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const totalPlano = list.reduce((a, p) => a + p.amount, 0);
  const restante = Math.max(0, totalPlano - totalPago);

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6 mb-6">
      <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
        <Banknote className="w-4 h-4 text-primary" /> Financeiro do Projeto
      </h2>

      <ResumoFinanceiro project={project} invalidateKey={invalidateKey} />

      <div className="border-t border-white/5 mt-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Plano de pagamento do cliente
            {project.paymentPlanType && (
              <span className="text-[10px] bg-primary/15 text-primary rounded-full px-2 py-0.5">
                {PAYMENT_PLAN_LABELS[project.paymentPlanType]}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {list.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => removePlan.mutate()}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover plano
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Fechar" : list.length > 0 ? "Refazer plano" : "Configurar plano"}
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4">
            <PlanoForm
              project={project}
              invalidateKeys={[paymentsKey, invalidateKey]}
              onDone={() => setShowForm(false)}
            />
          </div>
        )}

        {list.length === 0 ? (
          !showForm && (
            <p className="text-sm text-muted-foreground border border-dashed border-white/10 rounded-2xl p-4 text-center">
              Nenhum plano configurado. O cliente verá as parcelas no portal assim que o plano for gerado.
            </p>
          )
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-background/50 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Total do plano</p>
                <p className="text-sm text-foreground font-medium">{formatBRL(totalPlano)}</p>
              </div>
              <div className="bg-background/50 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-sm font-medium" style={{ color: "#4ADE80" }}>{formatBRL(totalPago)}</p>
              </div>
              <div className="bg-background/50 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Falta pagar</p>
                <p className="text-sm text-foreground font-medium">{formatBRL(restante)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {list.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-background/50 rounded-xl px-4 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
                      {String(p.installmentNumber).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {p.description ?? `Parcela ${p.installmentNumber}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Venc: {fmtDate(p.dueDate)}
                        {p.paidDate && (
                          <span style={{ color: "#4ADE80" }}> · pago em {fmtDate(p.paidDate)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium tabular-nums">{formatBRL(p.amount)}</span>
                    <div className="flex items-center gap-1.5">
                      {p.status === "paid" && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#4ADE80" }} />}
                      <Switch
                        checked={p.status === "paid"}
                        onCheckedChange={(v) => togglePaid.mutate({ id: p.id, paid: v })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
