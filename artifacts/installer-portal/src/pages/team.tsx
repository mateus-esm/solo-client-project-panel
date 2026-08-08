import { useRef, useState } from 'react';
import { InstallerLayout } from '@/components/installer-layout';
import {
  useInstallerCompany,
  useTeamMembers,
  useCreateTeamMember,
  useUpdateTeamMember,
  useDeleteTeamMember,
  useUploadMemberFile,
} from '@/hooks/use-installer-team';
import type { TeamMember } from '@/hooks/use-installer-services';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Camera,
  FileText,
} from 'lucide-react';

function CompanyCard() {
  const { data: company, isLoading } = useInstallerCompany();
  if (isLoading || !company) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="h-32 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }
  const rows: [string, string | null][] = [
    ['Razão social', company.razaoSocial],
    ['CNPJ', company.cnpj],
    ['Responsável', company.responsavelNome],
    ['Telefone', company.responsavelTelefone],
    ['Chave PIX', company.pixKey],
    ['Forma de pagamento', company.formaPagamento],
  ];
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-primary" />
          Dados da Empresa
        </CardTitle>
        <CardDescription>
          Equipe {company.teamName}. Para alterar estes dados, fale com a Solo Energia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {label}
              </dt>
              <dd className="text-sm text-foreground font-medium mt-0.5">
                {value || <span className="text-muted-foreground">Não informado</span>}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function MemberUploadButton({
  member,
  kind,
}: {
  member: TeamMember;
  kind: 'photo' | 'doc';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMemberFile();
  const { toast } = useToast();
  const label = kind === 'photo' ? 'Foto' : 'Documento';
  const has = kind === 'photo' ? member.photoUrl : member.docUrl;
  const Icon = kind === 'photo' ? Camera : FileText;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'photo' ? 'image/*' : 'image/*,application/pdf'}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          upload.mutate(
            { id: member.id, kind, file },
            {
              onSuccess: () => toast({ title: `${label} enviada com sucesso` }),
              onError: (err: Error) =>
                toast({ title: `Erro ao enviar ${label.toLowerCase()}`, description: err.message, variant: 'destructive' }),
            }
          );
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-xs h-8"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Icon className="w-3.5 h-3.5 mr-1.5" />
        )}
        {has ? `Trocar ${label.toLowerCase()}` : `Enviar ${label.toLowerCase()}`}
      </Button>
    </>
  );
}

export default function TeamPage() {
  const { data: members, isLoading } = useTeamMembers();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [name, setName] = useState('');
  const [documento, setDocumento] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDocumento('');
    setDialogOpen(true);
  };
  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setName(m.name);
    setDocumento(m.documento ?? '');
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const opts = {
      onSuccess: () => {
        toast({ title: editing ? 'Membro atualizado' : 'Membro cadastrado' });
        setDialogOpen(false);
      },
      onError: (err: Error) =>
        toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
    };
    if (editing) {
      updateMember.mutate({ id: editing.id, name: name.trim(), documento: documento.trim() || null }, opts);
    } else {
      createMember.mutate({ name: name.trim(), documento: documento.trim() || null }, opts);
    }
  };

  const pending = createMember.isPending || updateMember.isPending;

  return (
    <InstallerLayout title="Minha Equipe">
      <div className="space-y-6">
        <CompanyCard />

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-primary" />
                  Membros da Equipe
                </CardTitle>
                <CardDescription className="mt-1">
                  Cadastre os profissionais com foto e documento de identidade.
                </CardDescription>
              </div>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Novo membro
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !members || members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum membro cadastrado ainda. Clique em "Novo membro" para começar.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="border border-border/60 rounded-xl p-4 flex flex-col gap-3 bg-muted/10"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12 border border-border/60">
                        {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.name} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {m.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.documento || 'Documento não informado'}
                        </p>
                        <div className="flex gap-2 mt-1.5">
                          {m.docUrl ? (
                            <a href={m.docUrl} target="_blank" rel="noreferrer">
                              <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-secondary/80">
                                <FileText className="w-3 h-3 mr-1" />
                                Identidade anexada
                              </Badge>
                            </a>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Sem identidade
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deleteMember.isPending}
                          onClick={() => {
                            if (!window.confirm(`Remover ${m.name} da equipe?`)) return;
                            deleteMember.mutate(m.id, {
                              onSuccess: () => toast({ title: 'Membro removido' }),
                              onError: (err: Error) =>
                                toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' }),
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <MemberUploadButton member={m} kind="photo" />
                      <MemberUploadButton member={m} kind="doc" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar membro' : 'Novo membro'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados do membro da equipe.'
                : 'Cadastre um novo profissional da sua equipe.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="memberName">Nome completo *</Label>
              <Input
                id="memberName"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberDoc">Documento (RG/CPF)</Label>
              <Input
                id="memberDoc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ex: 123.456.789-00"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!name.trim() || pending}>
                {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </InstallerLayout>
  );
}
