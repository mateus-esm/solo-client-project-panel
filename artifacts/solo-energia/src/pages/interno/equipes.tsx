import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Upload, IdCard, Building2, UserPlus } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { api, type InstallerAccount, type TeamMember } from "@/lib/internal-api";

const QK = ["internal-installers"];

function NewTeamDialog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    teamName: "",
    password: "",
    razaoSocial: "",
    cnpj: "",
    responsavelNome: "",
    responsavelTelefone: "",
    pixKey: "",
    formaPagamento: "",
  });

  const create = useMutation({
    mutationFn: () => api.post<InstallerAccount>("/internal/installers", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      setOpen(false);
      setForm({ name: "", email: "", teamName: "", password: "", razaoSocial: "", cnpj: "", responsavelNome: "", responsavelTelefone: "", pixKey: "", formaPagamento: "" });
      toast({ title: "Equipe cadastrada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nova equipe</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar equipe (empresa)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome de exibição *</Label><Input value={form.name} onChange={set("name")} /></div>
            <div><Label>Nome da equipe *</Label><Input value={form.teamName} onChange={set("teamName")} placeholder="ex: Equipe SP" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>E-mail de acesso *</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
            <div><Label>Senha *</Label><Input type="password" value={form.password} onChange={set("password")} placeholder="mín. 8 caracteres" /></div>
          </div>
          <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
            <div><Label>Razão social</Label><Input value={form.razaoSocial} onChange={set("razaoSocial")} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={set("cnpj")} /></div>
            <div><Label>Responsável</Label><Input value={form.responsavelNome} onChange={set("responsavelNome")} /></div>
            <div><Label>Telefone do responsável</Label><Input value={form.responsavelTelefone} onChange={set("responsavelTelefone")} /></div>
            <div><Label>Chave PIX</Label><Input value={form.pixKey} onChange={set("pixKey")} /></div>
            <div><Label>Forma de pagamento</Label><Input value={form.formaPagamento} onChange={set("formaPagamento")} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.name || !form.email || !form.teamName || form.password.length < 8}
          >
            {create.isPending ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member }: { member: TeamMember }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "photo" | "doc" }) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/internal/installers/members/${member.id}/upload?kind=${kind}`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Falha no upload");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast({ title: "Arquivo enviado" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: () => api.del(`/internal/installers/members/${member.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar className="w-10 h-10">
        {member.photoUrl ? <AvatarImage src={member.photoUrl} /> : null}
        <AvatarFallback className="bg-muted text-xs">{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{member.name}</p>
        <p className="text-xs text-muted-foreground">{member.documento || "sem documento"}</p>
      </div>
      <input ref={photoRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && upload.mutate({ file: e.target.files[0], kind: "photo" })} />
      <input ref={docRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => e.target.files?.[0] && upload.mutate({ file: e.target.files[0], kind: "doc" })} />
      <Button size="sm" variant="ghost" onClick={() => photoRef.current?.click()} title="Foto">
        <Upload className="w-4 h-4" />
      </Button>
      <Button size="sm" variant={member.docUrl ? "secondary" : "ghost"} onClick={() => docRef.current?.click()} title="Documento de identidade">
        <IdCard className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => del.mutate()} className="text-destructive">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function TeamCard({ account }: { account: InstallerAccount }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newMember, setNewMember] = useState("");
  const [newDoc, setNewDoc] = useState("");

  const addMember = useMutation({
    mutationFn: () => api.post(`/internal/installers/${account.id}/members`, { name: newMember, documento: newDoc || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); setNewMember(""); setNewDoc(""); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const delTeam = useMutation({
    mutationFn: () => api.del(`/internal/installers/${account.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast({ title: "Equipe removida" }); },
  });

  return (
    <div className="bg-card border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-foreground font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> {account.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {account.teamName} · {account.email}
          </p>
          {account.razaoSocial && (
            <p className="text-xs text-muted-foreground">{account.razaoSocial}{account.cnpj ? ` · ${account.cnpj}` : ""}</p>
          )}
          {account.responsavelNome && (
            <p className="text-xs text-muted-foreground">Resp.: {account.responsavelNome}{account.responsavelTelefone ? ` · ${account.responsavelTelefone}` : ""}</p>
          )}
          {account.pixKey && <p className="text-xs text-muted-foreground">PIX: {account.pixKey}</p>}
        </div>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delTeam.mutate()}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="border-t border-white/5 pt-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Membros</p>
        {account.members.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum membro cadastrado.</p>}
        {account.members.map((m) => <MemberRow key={m.id} member={m} />)}
        <div className="flex items-center gap-2 mt-2">
          <Input placeholder="Nome do membro" value={newMember} onChange={(e) => setNewMember(e.target.value)} className="h-9" />
          <Input placeholder="RG/CPF" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} className="h-9 w-32" />
          <Button size="sm" disabled={!newMember || addMember.isPending} onClick={() => addMember.mutate()}>
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EquipesPage() {
  const { data: accounts, isLoading } = useQuery<InstallerAccount[]>({
    queryKey: QK,
    queryFn: () => api.get<InstallerAccount[]>("/internal/installers"),
  });

  return (
    <InternalLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Equipes de Execução
          </h1>
          <p className="text-sm text-muted-foreground">Empresas parceiras, membros e dados de pagamento</p>
        </div>
        <NewTeamDialog />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-40 bg-card rounded-2xl border border-white/5 animate-pulse" />)}</div>
      ) : (accounts ?? []).length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Nenhuma equipe cadastrada.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {accounts!.map((a) => <TeamCard key={a.id} account={a} />)}
        </div>
      )}
    </InternalLayout>
  );
}
