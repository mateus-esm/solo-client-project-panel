import { InstallerLayout } from '@/components/installer-layout';
import { useInstallerFinanceiro } from '@/hooks/use-installer-team';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock, Wallet, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtBRL = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function FinanceiroPage() {
  const { data, isLoading } = useInstallerFinanceiro();

  if (isLoading || !data) {
    return (
      <InstallerLayout title="Financeiro">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </InstallerLayout>
    );
  }

  const isPago = (s: { pagamentoRealizado: boolean; statusPagamento: string }) =>
    s.pagamentoRealizado || s.statusPagamento === 'Pago';

  return (
    <InstallerLayout title="Financeiro">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-energy-green" />
                Recebido
              </CardDescription>
              <CardTitle className="text-3xl font-display text-energy-green">
                {fmtBRL(data.totals.recebido)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-chart-3" />
                A receber
              </CardDescription>
              <CardTitle className="text-3xl font-display text-foreground">
                {fmtBRL(data.totals.aReceber)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="w-5 h-5 text-primary" />
              Serviços da equipe
            </CardTitle>
            <CardDescription>
              Valor acordado e status de pagamento de cada serviço.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.services.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum serviço atribuído à sua equipe ainda.
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {data.services.map((s) => (
                  <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        <span className="text-muted-foreground font-mono text-xs mr-2">#{s.id}</span>
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.tipoServico || 'Serviço'}
                        {s.dataExecucao
                          ? ` · ${format(parseISO(s.dataExecucao), 'dd/MM/yyyy', { locale: ptBR })}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        className={cn(
                          'border shadow-none flex items-center gap-1.5',
                          isPago(s)
                            ? 'bg-energy-green/10 text-energy-green border-energy-green/30'
                            : 'bg-chart-3/10 text-chart-3 border-chart-3/30'
                        )}
                      >
                        {isPago(s) ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {isPago(s) ? 'Pago' : s.statusPagamento}
                      </Badge>
                      <span className="font-semibold text-foreground tabular-nums">
                        {fmtBRL(s.valorFechado)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </InstallerLayout>
  );
}
