import { useInstallerServices } from '@/hooks/use-installer-services';
import { InstallerLayout } from '@/components/installer-layout';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'wouter';
import { CalendarClock, MapPin, Wrench, ChevronRight, Activity, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ServicesDashboard() {
  const { data: services, isLoading } = useInstallerServices();

  if (isLoading) {
    return (
      <InstallerLayout title="Meus Serviços">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse shadow-sm">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg" />
              <CardContent className="space-y-4 p-6">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </InstallerLayout>
    );
  }

  if (!services || services.length === 0) {
    return (
      <InstallerLayout title="Meus Serviços">
        <div className="flex flex-col items-center justify-center text-center p-12 bg-card rounded-2xl border border-white/5 min-h-[400px]">
          <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Nenhum serviço agendado
          </h2>
          <p className="text-muted-foreground max-w-md text-lg">
            Você não possui nenhum serviço atribuído à sua equipe no momento. Você será notificado quando novos serviços chegarem.
          </p>
        </div>
      </InstallerLayout>
    );
  }

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'Agendado': return { color: 'bg-chart-3/10 text-chart-3 border-chart-3/30', icon: CalendarClock, label: 'Agendado' };
      case 'Em Execução': return { color: 'bg-primary/15 text-primary border-primary/30', icon: Activity, label: 'Em Execução', pulse: true };
      case 'Concluído': return { color: 'bg-energy-green/10 text-energy-green border-energy-green/30', icon: CheckCircle2, label: 'Concluído' };
      default: return { color: 'bg-muted text-muted-foreground border-white/10', icon: Clock, label: status };
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não definida';
    try {
      return format(parseISO(dateString), "dd 'de' MMMM, yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <InstallerLayout title="Serviços Atribuídos">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const statusConfig = getStatusConfig(service.status);
          const StatusIcon = statusConfig.icon;

          return (
            <Link key={service.id} href={`/services/${service.id}`}>
              <Card className="h-full flex flex-col hover:border-primary/50 hover:shadow-md transition-all duration-200 group cursor-pointer overflow-hidden border-border/60">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="font-mono text-xs bg-card text-muted-foreground">
                      #{service.id}
                    </Badge>
                    <Badge className={cn("font-medium border shadow-none flex items-center gap-1.5", statusConfig.color)}>
                      {statusConfig.pulse && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                      )}
                      {!statusConfig.pulse && <StatusIcon className="w-3 h-3" />}
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <h3 className="font-display font-bold text-lg line-clamp-2 leading-tight">
                    {service.name}
                  </h3>
                </CardHeader>
                
                <CardContent className="flex-1 p-5 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-foreground/80 line-clamp-2">
                      {service.endereco || 'Endereço não informado'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <Wrench className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-foreground/80 font-medium">
                      {service.tipoServico || 'Serviço Padrão'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <CalendarClock className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-foreground/80">
                      {formatDate(service.dataExecucao)}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="p-5 pt-0 mt-auto flex items-center justify-between border-t border-border/40 pt-4 bg-muted/10">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(service.valorServico)}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </CardFooter>
              </Card>
            </Link>
          );
        })}
      </div>
    </InstallerLayout>
  );
}
