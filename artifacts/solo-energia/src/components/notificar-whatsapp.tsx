/**
 * Notificar por WhatsApp sem sair do ERP.
 *
 * Fluxo: escolher destino (grupo ou privado) → escolher template → ajustar as
 * variáveis → revisar o texto final → enviar. O texto do preview é editável: o
 * que sai é exatamente o que está na caixa, nunca o template cru.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  Search,
  Send,
  Users,
  User,
  Plus,
  Check,
  AlertTriangle,
  Loader2,
  History,
  Link2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  api,
  renderTemplate,
  type GrupoDisponivel,
  type GruposDisponiveis,
  type NotificationTemplate,
  type TemplateCatalog,
  type WhatsappContexto,
  type WhatsappDestino,
  type WhatsappGroupKind,
  type WhatsappSend,
} from "@/lib/internal-api";

interface Props {
  projectId: number;
  /** Chaves a invalidar depois de criar grupo (o item-ação do checklist muda). */
  invalidateKeys?: unknown[][];
}

export function NotificarWhatsApp({ projectId, invalidateKeys = [] }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contextoKey = ["whatsapp-contexto", projectId];
  const historicoKey = ["whatsapp-historico", projectId];

  const { data: catalogo } = useQuery<TemplateCatalog>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => api.get<TemplateCatalog>("/internal/whatsapp/templates"),
    staleTime: Infinity, // catálogo é estático — não faz sentido refazer a cada foco
  });

  const { data: ctx, isLoading } = useQuery<WhatsappContexto>({
    queryKey: contextoKey,
    queryFn: () => api.get<WhatsappContexto>(`/internal/whatsapp/${projectId}/contexto`),
  });

  const { data: historico } = useQuery<WhatsappSend[]>({
    queryKey: historicoKey,
    queryFn: () => api.get<WhatsappSend[]>(`/internal/whatsapp/${projectId}/historico`),
  });

  const [destinoId, setDestinoId] = useState<string>("privado:cliente");
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [texto, setTexto] = useState("");
  const [pickerAberto, setPickerAberto] = useState(false);
  /** true depois que o operador mexe no texto — aí paramos de sobrescrever. */
  const [textoTocado, setTextoTocado] = useState(false);

  const destinos = ctx?.destinos ?? [];
  const destino = destinos.find((d) => d.id === destinoId) ?? destinos[0] ?? null;

  // Preenche as variáveis com o contexto do projeto ao escolher um template.
  function escolherTemplate(t: NotificationTemplate) {
    const iniciais: Record<string, string> = {};
    for (const v of t.vars) iniciais[v.key] = (v.auto ? ctx?.contexto[v.auto] : "") ?? "";
    setTemplate(t);
    setValores(iniciais);
    setTextoTocado(false);
    setPickerAberto(false);
  }

  // Enquanto o operador não editar o texto à mão, ele acompanha as variáveis.
  useEffect(() => {
    if (!template || textoTocado) return;
    setTexto(renderTemplate(template.body, { ...ctx?.contexto, ...valores }));
  }, [template, valores, textoTocado, ctx?.contexto]);

  const buracos = useMemo(() => {
    const m = texto.match(/\[(\w+)\]/g);
    return m ? [...new Set(m)] : [];
  }, [texto]);

  /** Público cujo grupo está sendo escolhido na lista dos que já existem. */
  const [vinculando, setVinculando] = useState<WhatsappGroupKind | null>(null);

  function invalidarGrupos() {
    queryClient.invalidateQueries({ queryKey: contextoKey });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-grupos-disponiveis", projectId] });
    for (const k of invalidateKeys) queryClient.invalidateQueries({ queryKey: k });
  }

  const criarGrupo = useMutation({
    mutationFn: (kind: string) =>
      api.post<{ criado: boolean; avisos: string[] }>(`/internal/whatsapp/${projectId}/grupos`, {
        kind,
      }),
    onSuccess: (r) => {
      invalidarGrupos();
      toast({
        title: r.criado ? "Grupo criado no WhatsApp" : "O grupo já existia",
        description: r.avisos.length ? r.avisos.join(" ") : undefined,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Não deu para criar o grupo", description: err.message, variant: "destructive" }),
  });

  const vincularGrupo = useMutation({
    mutationFn: (v: { kind: WhatsappGroupKind; jid: string }) =>
      api.post(`/internal/whatsapp/${projectId}/grupos/vincular`, v),
    onSuccess: () => {
      invalidarGrupos();
      setVinculando(null);
      toast({ title: "Grupo vinculado ao projeto" });
    },
    onError: (err: Error) =>
      toast({ title: "Não deu para vincular", description: err.message, variant: "destructive" }),
  });

  const desvincularGrupo = useMutation({
    mutationFn: (kind: WhatsappGroupKind) =>
      api.del(`/internal/whatsapp/${projectId}/grupos/${kind}`),
    onSuccess: () => {
      invalidarGrupos();
      toast({ title: "Vínculo removido", description: "O grupo continua no WhatsApp, intacto." });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const enviar = useMutation({
    mutationFn: () =>
      api.post<{ avisos?: string[] }>(`/internal/whatsapp/${projectId}/enviar`, {
        destinoId,
        texto,
        templateCode: template?.code,
        criarGrupoSeNecessario: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historicoKey });
      toast({ title: "Mensagem enviada", description: destino?.label });
      setTexto("");
      setTemplate(null);
      setValores({});
      setTextoTocado(false);
    },
    onError: (err: Error) =>
      toast({ title: "Não foi enviada", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="h-64 bg-card rounded-3xl border border-white/5 animate-pulse mb-6" />;
  }

  return (
    <div id="bloco-whatsapp" className="bg-card border border-white/5 rounded-3xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" /> Notificar por WhatsApp
        </h2>
        {ctx && !ctx.configurado && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> WhatsApp não configurado no servidor
          </span>
        )}
      </div>

      {/* ── Destino ─────────────────────────────────────────────────────────── */}
      <Label className="text-xs text-muted-foreground">Enviar para</Label>
      <div className="grid sm:grid-cols-2 gap-2 mt-2 mb-5">
        {destinos.map((d) => (
          <DestinoCard
            key={d.id}
            destino={d}
            selecionado={d.id === destinoId}
            criando={criarGrupo.isPending && criarGrupo.variables === d.kind}
            onSelecionar={() => setDestinoId(d.id)}
            onCriar={() => criarGrupo.mutate(d.kind)}
            onVincular={() => setVinculando(d.kind)}
            onDesvincular={() => desvincularGrupo.mutate(d.kind)}
          />
        ))}
      </div>

      {/* ── Template ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs text-muted-foreground">Mensagem</Label>
        <Button variant="outline" size="sm" onClick={() => setPickerAberto(true)}>
          <Search className="w-3.5 h-3.5 mr-1.5" />
          {template ? "Trocar template" : "Escolher template"}
        </Button>
      </div>

      {template && (
        <div className="bg-background/50 rounded-2xl p-4 mb-3">
          <p className="text-xs text-primary mb-0.5">
            {template.code} · {template.categoria}
          </p>
          <p className="text-sm text-foreground">{template.nome}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Quando usar: {template.quandoUsar}
          </p>

          {template.vars.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3 mt-4">
              {template.vars.map((v) => (
                <div key={v.key} className={v.multiline ? "md:col-span-2" : undefined}>
                  <Label className="text-[11px] text-muted-foreground">{v.label}</Label>
                  {v.multiline ? (
                    <Textarea
                      rows={2}
                      value={valores[v.key] ?? ""}
                      onChange={(e) => {
                        setValores((s) => ({ ...s, [v.key]: e.target.value }));
                        setTextoTocado(false);
                      }}
                      className="mt-1 text-sm"
                    />
                  ) : (
                    <Input
                      value={valores[v.key] ?? ""}
                      onChange={(e) => {
                        setValores((s) => ({ ...s, [v.key]: e.target.value }));
                        setTextoTocado(false);
                      }}
                      className="h-9 mt-1 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Textarea
        rows={12}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setTextoTocado(true);
        }}
        placeholder="Escolha um template acima ou escreva a mensagem aqui. *negrito* funciona no WhatsApp."
        className="text-sm font-mono leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="text-[11px] text-muted-foreground">
          {buracos.length > 0 ? (
            <span className="text-amber-400 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Falta preencher: {buracos.join(", ")}
            </span>
          ) : (
            `${texto.length} caracteres`
          )}
        </div>
        <Button
          onClick={() => enviar.mutate()}
          disabled={
            enviar.isPending ||
            !texto.trim() ||
            !destino?.jid ||
            buracos.length > 0 ||
            !ctx?.configurado
          }
        >
          {enviar.isPending ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-1.5" />
          )}
          Enviar {destino ? `— ${destino.label}` : ""}
        </Button>
      </div>

      {destino && !destino.jid && (
        <p className="text-[11px] text-amber-400 mt-2">
          {destino.podeCriar
            ? "Crie o grupo antes de enviar."
            : `Destino indisponível: ${destino.detalhe}`}
        </p>
      )}

      <TemplatePicker
        aberto={pickerAberto}
        onFechar={() => setPickerAberto(false)}
        catalogo={catalogo}
        onEscolher={escolherTemplate}
      />

      <VincularGrupoDialog
        projectId={projectId}
        kind={vinculando}
        onFechar={() => setVinculando(null)}
        onEscolher={(jid) => vinculando && vincularGrupo.mutate({ kind: vinculando, jid })}
        salvando={vincularGrupo.isPending}
      />

      <Historico envios={historico ?? []} />
    </div>
  );
}

// ─── Destino ──────────────────────────────────────────────────────────────────

function DestinoCard({
  destino,
  selecionado,
  criando,
  onSelecionar,
  onCriar,
  onVincular,
  onDesvincular,
}: {
  destino: WhatsappDestino;
  selecionado: boolean;
  criando: boolean;
  onSelecionar: () => void;
  onCriar: () => void;
  onVincular: () => void;
  onDesvincular: () => void;
}) {
  const Icone = destino.tipo === "grupo" ? Users : User;
  const grupoVinculado = destino.tipo === "grupo" && !destino.podeCriar;

  return (
    <div
      onClick={onSelecionar}
      className={
        "flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer border transition-colors " +
        (selecionado
          ? "border-primary/40 bg-primary/10"
          : "border-white/5 bg-background/50 hover:border-white/10")
      }
    >
      <Icone className={"w-4 h-4 shrink-0 " + (selecionado ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{destino.label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{destino.detalhe}</p>
      </div>

      {destino.podeCriar && (
        // Vincular vem primeiro: a Solo já tem grupo para quase todo cliente
        // antigo, e criar um segundo dividiria a conversa em dois lugares.
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onVincular();
            }}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="ml-1">Vincular</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={criando}
            onClick={(e) => {
              e.stopPropagation();
              onCriar();
            }}
          >
            {criando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span className="ml-1">Criar</span>
          </Button>
        </div>
      )}

      {grupoVinculado && (
        <div className="flex items-center gap-1 shrink-0">
          {selecionado && <Check className="w-4 h-4 text-primary" />}
          <Button
            variant="ghost"
            size="sm"
            title="Desvincular (o grupo continua no WhatsApp)"
            onClick={(e) => {
              e.stopPropagation();
              onDesvincular();
            }}
          >
            <Unlink className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {destino.tipo === "privado" && selecionado && (
        <Check className="w-4 h-4 text-primary shrink-0" />
      )}
    </div>
  );
}

// ─── Vincular grupo que já existe ─────────────────────────────────────────────

function VincularGrupoDialog({
  projectId,
  kind,
  onFechar,
  onEscolher,
  salvando,
}: {
  projectId: number;
  kind: WhatsappGroupKind | null;
  onFechar: () => void;
  onEscolher: (jid: string) => void;
  salvando: boolean;
}) {
  const [busca, setBusca] = useState("");

  const { data, isLoading, error } = useQuery<GruposDisponiveis>({
    queryKey: ["whatsapp-grupos-disponiveis", projectId],
    queryFn: () =>
      api.get<GruposDisponiveis>(`/internal/whatsapp/grupos-disponiveis?projectId=${projectId}`),
    enabled: kind !== null,
    staleTime: 60_000, // a lista vem do WhatsApp; não vale refazer a cada abertura
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = data?.grupos ?? [];
    if (!termo) return todos;
    return todos.filter((g) => g.subject.toLowerCase().includes(termo));
  }, [data, busca]);

  // Score alto = o nome do grupo bate com o do cliente. Vale destacar.
  const sugeridos = filtrados.filter((g) => (g.score ?? 0) >= 0.6);
  const resto = filtrados.filter((g) => (g.score ?? 0) < 0.6);

  return (
    <Dialog open={kind !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular grupo que já existe</DialogTitle>
          <DialogDescription>
            Grupos do WhatsApp da Solo. Escolher um só aponta o grupo para este projeto — nada é
            renomeado e ninguém é adicionado.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome do grupo…"
          className="h-10"
        />

        {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>}
        {error && (
          <p className="text-sm text-red-400 py-8 text-center">{(error as Error).message}</p>
        )}

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-4">
          {sugeridos.length > 0 && (
            <ListaGrupos
              titulo={`Parecem ser deste cliente${data?.clientName ? ` (${data.clientName})` : ""}`}
              grupos={sugeridos}
              destaque
              salvando={salvando}
              onEscolher={onEscolher}
            />
          )}
          {resto.length > 0 && (
            <ListaGrupos
              titulo={sugeridos.length > 0 ? "Outros grupos" : "Grupos"}
              grupos={resto}
              salvando={salvando}
              onEscolher={onEscolher}
            />
          )}
          {!isLoading && filtrados.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum grupo encontrado.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListaGrupos({
  titulo,
  grupos,
  destaque,
  salvando,
  onEscolher,
}: {
  titulo: string;
  grupos: GrupoDisponivel[];
  destaque?: boolean;
  salvando: boolean;
  onEscolher: (jid: string) => void;
}) {
  return (
    <div>
      <p
        className={
          "text-[11px] uppercase tracking-wide mb-1.5 " +
          (destaque ? "text-primary" : "text-muted-foreground")
        }
      >
        {titulo}
      </p>
      <div className="space-y-1">
        {grupos.map((g) => (
          <button
            key={g.jid}
            disabled={salvando}
            onClick={() => onEscolher(g.jid)}
            className={
              "w-full text-left rounded-xl px-3 py-2.5 transition-colors disabled:opacity-50 " +
              (destaque ? "bg-primary/10 hover:bg-primary/20" : "bg-background/50 hover:bg-primary/10")
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground truncate flex-1">{g.subject}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {g.size} participantes
              </span>
            </div>
            {g.vinculadoA && (
              <p className="text-[11px] text-amber-400 mt-0.5">
                Já vinculado ao projeto #{g.vinculadoA.projectId} ({g.vinculadoA.kind})
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Picker de template ───────────────────────────────────────────────────────

function TemplatePicker({
  aberto,
  onFechar,
  catalogo,
  onEscolher,
}: {
  aberto: boolean;
  onFechar: () => void;
  catalogo: TemplateCatalog | undefined;
  onEscolher: (t: NotificationTemplate) => void;
}) {
  const [busca, setBusca] = useState("");

  const porCategoria = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = (catalogo?.templates ?? []).filter(
      (t) =>
        !termo ||
        t.nome.toLowerCase().includes(termo) ||
        t.code.toLowerCase().includes(termo) ||
        t.quandoUsar.toLowerCase().includes(termo) ||
        t.categoria.toLowerCase().includes(termo),
    );
    const mapa = new Map<string, NotificationTemplate[]>();
    for (const t of filtrados) {
      const lista = mapa.get(t.categoria) ?? [];
      lista.push(t);
      mapa.set(t.categoria, lista);
    }
    return [...mapa.entries()];
  }, [catalogo, busca]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Biblioteca de templates</DialogTitle>
          <DialogDescription>
            {catalogo?.templates.length ?? 0} mensagens padronizadas da jornada do cliente.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, código ou situação…"
          className="h-10"
        />

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-4">
          {porCategoria.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum template encontrado.
            </p>
          )}
          {porCategoria.map(([categoria, lista]) => (
            <div key={categoria}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                {categoria}
              </p>
              <div className="space-y-1">
                {lista.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => onEscolher(t)}
                    className="w-full text-left rounded-xl px-3 py-2.5 bg-background/50 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-primary shrink-0">{t.code}</span>
                      <span className="text-sm text-foreground truncate">{t.nome}</span>
                      {t.publico === "equipe" && (
                        <span className="text-[10px] rounded-full bg-white/5 text-muted-foreground px-2 py-0.5 shrink-0">
                          equipe
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.quandoUsar}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Histórico ────────────────────────────────────────────────────────────────

function Historico({ envios }: { envios: WhatsappSend[] }) {
  const [expandido, setExpandido] = useState(false);
  if (envios.length === 0) return null;
  const visiveis = expandido ? envios : envios.slice(0, 3);

  return (
    <div className="mt-6 pt-5 border-t border-white/5">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
        <History className="w-3.5 h-3.5" /> Enviados ({envios.length})
      </p>
      <div className="space-y-2">
        {visiveis.map((e) => (
          <div key={e.id} className="bg-background/50 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground truncate">
                {e.templateCode ? `${e.templateCode} · ` : ""}
                {e.targetLabel ?? e.targetJid}
              </span>
              <span
                className={
                  "text-[10px] rounded-full px-2 py-0.5 shrink-0 " +
                  (e.status === "enviado"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400")
                }
              >
                {e.status}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">
              {e.body}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {new Date(e.createdAt).toLocaleString("pt-BR")}
              {e.error ? ` — ${e.error}` : ""}
            </p>
          </div>
        ))}
      </div>
      {envios.length > 3 && (
        <button
          onClick={() => setExpandido((v) => !v)}
          className="text-[11px] text-primary mt-2 hover:underline"
        >
          {expandido ? "Mostrar menos" : `Ver todos os ${envios.length}`}
        </button>
      )}
    </div>
  );
}
