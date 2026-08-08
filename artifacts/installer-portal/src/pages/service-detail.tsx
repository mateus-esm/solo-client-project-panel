import { useParams } from 'wouter';
import { useInstallerService, useUpdateServiceStatus, useUploadServicePhoto, useAcceptContract } from '@/hooks/use-installer-services';
import { InstallerLayout } from '@/components/installer-layout';
import { useState, useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MapPin, Wrench, CalendarClock, User, CheckCircle2, 
  Activity, Clock, Camera, FileText, Send, Loader2, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";

export default function ServiceDetail() {
  const params = useParams();
  const id = params.id as string;
  const { data: service, isLoading } = useInstallerService(id);
  const updateStatus = useUpdateServiceStatus();
  const uploadPhoto = useUploadServicePhoto();
  const acceptContract = useAcceptContract();
  const { toast } = useToast();

  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);

  const initRef = useRef<number | null>(null);

  useEffect(() => {
    if (service && initRef.current !== service.id) {
      initRef.current = service.id;
      setNotes(service.observacoes || '');
    }
  }, [service]);

  if (isLoading || !service) {
    return (
      <InstallerLayout showBack>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </InstallerLayout>
    );
  }

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'Agendado': return { color: 'bg-chart-3/10 text-chart-3 border-chart-3/30', icon: CalendarClock, label: 'Agendado', next: 'Em Execução', nextLabel: 'Iniciar Serviço' };
      case 'Em Execução': return { color: 'bg-primary/15 text-primary border-primary/30', icon: Activity, label: 'Em Execução', next: 'Concluído', nextLabel: 'Finalizar Serviço' };
      case 'Concluído': return { color: 'bg-energy-green/10 text-energy-green border-energy-green/30', icon: CheckCircle2, label: 'Concluído', next: null, nextLabel: null };
      default: return { color: 'bg-muted text-muted-foreground border-white/10', icon: Clock, label: status, next: null, nextLabel: null };
    }
  };

  const statusConfig = getStatusConfig(service.status);
  const StatusIcon = statusConfig.icon;

  const handleUpdateStatus = () => {
    if (!statusConfig.next) return;
    updateStatus.mutate(
      { id: service.id, status: statusConfig.next, observacoes: notes },
      {
        onSuccess: () => {
          toast({ title: 'Status atualizado com sucesso' });
        },
        onError: (err) => {
          toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' });
        }
      }
    );
  };

  const handleSaveNotes = () => {
    updateStatus.mutate(
      { id: service.id, observacoes: notes },
      {
        onSuccess: () => toast({ title: 'Observações salvas' }),
        onError: (err) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
      }
    );
  };

  const handleUploadPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl) return;
    
    uploadPhoto.mutate(
      { id: service.id, url: photoUrl, name: photoName || 'Foto' },
      {
        onSuccess: () => {
          toast({ title: 'Foto adicionada com sucesso' });
          setPhotoUrl('');
          setPhotoName('');
          setIsPhotoDialogOpen(false);
        },
        onError: (err) => {
          toast({ title: 'Erro ao adicionar foto', description: err.message, variant: 'destructive' });
        }
      }
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não definida';
    try {
      return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <InstallerLayout showBack title={`Serviço #${service.id}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
        
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <div className="bg-secondary p-6 text-secondary-foreground flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="text-secondary-foreground/70 border-secondary-foreground/20 font-mono">
                    #{service.id}
                  </Badge>
                  <Badge className={cn("font-medium border shadow-none flex items-center gap-1.5", statusConfig.color)}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusConfig.label}
                  </Badge>
                </div>
                <h2 className="text-2xl font-display font-bold leading-tight">
                  {service.name}
                </h2>
              </div>
              
              {statusConfig.next && (
                <Button 
                  size="lg"
                  className={cn(
                    "whitespace-nowrap shadow-md",
                    statusConfig.next === 'Concluído' ? 'bg-green-600 hover:bg-green-700 text-white' : ''
                  )}
                  onClick={handleUpdateStatus}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : statusConfig.next === 'Concluído' ? (
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                  ) : (
                    <ArrowRight className="w-5 h-5 mr-2" />
                  )}
                  {statusConfig.nextLabel}
                </Button>
              )}
            </div>
            
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40">
                <div className="p-6 space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Tipo de Serviço</p>
                      <p className="font-semibold text-foreground">{service.tipoServico || 'Padrão'}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarClock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Agendamento</p>
                      <p className="font-semibold text-foreground">{formatDate(service.dataExecucao)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Localização</p>
                      <p className="font-semibold text-foreground text-sm leading-relaxed">
                        {service.endereco || 'Endereço não informado'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Contato</p>
                      <p className="font-semibold text-foreground">{service.responsavelEmail || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contract + Financial Section */}
          {(service.contratoUrl || service.valorFechado != null) && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-primary" />
                  Contrato e Pagamento
                </CardTitle>
                <CardDescription>
                  Valor acordado e contrato de prestação de serviço.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {service.valorFechado != null && (
                  <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                    <span className="text-sm text-muted-foreground">Valor acordado</span>
                    <span className="font-semibold text-foreground">
                      {service.valorFechado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                )}
                {service.formaPagamento && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm text-muted-foreground">Forma de pagamento</span>
                    <span className="text-sm text-foreground">{service.formaPagamento}</span>
                  </div>
                )}
                {service.contratoUrl && (
                  <div className="space-y-3">
                    <a href={service.contratoUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline text-sm">
                      <FileText className="w-4 h-4" /> Ver contrato
                    </a>
                    {service.contratoStatus === 'aceito' ? (
                      <div className="flex items-center gap-2 text-energy-green text-sm bg-energy-green/10 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4" />
                        Contrato aceito
                        {service.contratoAceitoEm ? ` em ${format(parseISO(service.contratoAceitoEm), "dd/MM/yyyy", { locale: ptBR })}` : ''}
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={acceptContract.isPending}
                        onClick={() => acceptContract.mutate(service.id, {
                          onSuccess: () => toast({ title: 'Contrato aceito', description: 'Obrigado! O aceite foi registrado.' }),
                          onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
                        })}
                      >
                        {acceptContract.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Aceitar contrato
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes Section */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                Anotações de Campo
              </CardTitle>
              <CardDescription>
                Registre detalhes importantes, intercorrências ou observações sobre a execução.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="Ex: Cliente solicitou mudança de local do inversor..."
                  className="min-h-[150px] resize-y bg-muted/30"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={service.status === 'Concluído'}
                />
                {service.status !== 'Concluído' && (
                  <Button 
                    variant="secondary" 
                    onClick={handleSaveNotes}
                    disabled={updateStatus.isPending || notes === service.observacoes}
                  >
                    {updateStatus.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Salvar Observações
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm flex flex-col h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Camera className="w-5 h-5 text-primary" />
                  Relatório Fotográfico
                </CardTitle>
                <Badge variant="secondary" className="font-mono">
                  {service.files.length} fotos
                </Badge>
              </div>
              <CardDescription>
                Anexe fotos do local e comprovações do serviço.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-3 mb-6">
                {service.files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border/50 rounded-lg h-32 bg-muted/20">
                    <Camera className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">Nenhuma foto anexada</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {service.files.map(file => (
                      <a 
                        key={file.id} 
                        href={file.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group relative block aspect-square rounded-lg border border-border/60 overflow-hidden bg-muted hover:border-primary transition-colors"
                      >
                        <img 
                          src={file.url} 
                          alt={file.name || 'Foto'} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                            (e.target as HTMLImageElement).className = "w-full h-full p-6 object-contain opacity-50";
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate font-medium">{file.name || 'Foto'}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {service.status !== 'Concluído' && (
                <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full mt-auto" variant="outline">
                      <Camera className="w-4 h-4 mr-2" />
                      Adicionar Foto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Adicionar Foto</DialogTitle>
                      <DialogDescription>
                        Forneça a URL da imagem para anexar ao relatório.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUploadPhoto} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="photoUrl">URL da Imagem *</Label>
                        <Input 
                          id="photoUrl" 
                          placeholder="https://..." 
                          type="url" 
                          required 
                          value={photoUrl}
                          onChange={(e) => setPhotoUrl(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="photoName">Descrição Curta</Label>
                        <Input 
                          id="photoName" 
                          placeholder="Ex: Inversor instalado" 
                          value={photoName}
                          onChange={(e) => setPhotoName(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsPhotoDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={!photoUrl || uploadPhoto.isPending}>
                          {uploadPhoto.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Adicionar
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        </div>
        
      </div>
    </InstallerLayout>
  );
}
