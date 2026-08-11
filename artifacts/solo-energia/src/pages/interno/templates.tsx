/**
 * Biblioteca de templates de notificação — criar, editar e arquivar sem deploy.
 *
 * As variáveis não são cadastradas à mão: saem do próprio corpo. Escreveu
 * {{valor}} no texto, virou campo. Assim é impossível o formulário de envio
 * pedir algo que a mensagem não usa, ou a mensagem sair com um buraco que não
 * tinha onde preencher.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquareText,
  Plus,
  Search,
  Trash2,
  Archive,
  ArchiveRestore,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
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
  extrairChavesDoCorpo,
  renderTemplate,
  type AutoFillOption,
  type TemplateAdminPayload,
  type TemplateRow,
  type TemplateVar,
} from "@/lib/internal-api";

const SEM_AUTO = "__nenhum__";

/** Só para o preview: valores de exemplo no lugar das variáveis. */
const EXEMPLO: Record<string, string> = {
  primeiroNome: "Mateus",
  nomeCliente: "Mateus Maia",
  potencia: "8,4 kWp",
  cidadeUf: "Fortaleza/CE",
  valorProjeto: "R$ 32.500,00",
  equipe: "Equipe SL01",
  concessionaria: "Enel",
  transportadora: "Braspress",
  codigoRastreio: "BR123456789",
  linkPortal: "https://portal.soloenergia.com.br",
  linkMonitoramento: "https://monitoramento.exemplo.com",
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["whatsapp-templates-admin"];

  const { data, isLoading } = useQuery<TemplateAdminPayload>({
    queryKey,
    queryFn: () => api.get<TemplateAdminPayload>("/internal/whatsapp/templates/admin"),
  });

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<TemplateRow | "novo" | null>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey });
    // O bloco de envio nos projetos consome a mesma biblioteca.
    queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
  }

  const arquivar = useMutation({
    mutationFn: (t: TemplateRow) =>
      api.patch(`/internal/whatsapp/templates/${t.id}`, { ativo: !t.ativo }),
    onSuccess: () => {
      invalidar();
      toast({ title: "Template atualizado" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: (id: number) => api.del(`/internal/whatsapp/templates/${id}`),
    onSuccess: () => {
      invalidar();
      toast({ title: "Template excluído" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const restaurar = useMutation({
    mutationFn: () => api.post<{ restaurados: number }>("/internal/whatsapp/templates/restaurar-padrao", {}),
    onSuccess: (r) => {
      invalidar();
      toast({
        title: r.restaurados > 0 ? `${r.restaurados} template(s) restaurado(s)` : "Nada a restaurar",
        description:
          r.restaurados > 0
            ? "Os templates de fábrica que faltavam voltaram."
            : "Todos os templates de fábrica já estão na biblioteca.",
      });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const porCategoria = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = (data?.templates ?? []).filter(
      (t) =>
        !termo ||
        t.nome.toLowerCase().includes(termo) ||
        t.code.toLowerCase().includes(termo) ||
        t.categoria.toLowerCase().includes(termo) ||
        t.body.toLowerCase().includes(termo),
    );
    const mapa = new Map<string, TemplateRow[]>();
    for (const t of filtrados) {
      const lista = mapa.get(t.categoria) ?? [];
      lista.push(t);
      mapa.set(t.categoria, lista);
    }
    return [...mapa.entries()];
  }, [data, busca]);

  const total = data?.templates.length ?? 0;
  const ativos = (data?.templates ?? []).filter((t) => t.ativo).length;

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-primary" /> Templates de notificação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ativos} ativos de {total}. Editar aqui vale na hora, em todos os projetos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => restaurar.mutate()} disabled={restaurar.isPending}>
            <RotateCcw className="w-4 h-4 mr-1.5" /> Restaurar padrão
          </Button>
          <Button onClick={() => setEditando("novo")}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo template
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, código, categoria ou texto…"
          className="h-11 pl-9"
        />
      </div>

      {isLoading && <div className="h-64 bg-card rounded-3xl border border-white/5 animate-pulse" />}

      <div className="space-y-6">
        {porCategoria.map(([categoria, lista]) => (
          <div key={categoria}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
              {categoria}
            </p>
            <div className="space-y-2">
              {lista.map((t) => (
                <div
                  key={t.id}
                  className={
                    "bg-card border border-white/5 rounded-2xl px-4 py-3 flex items-start gap-3 " +
                    (t.ativo ? "" : "opacity-50")
                  }
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setEditando(t)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-primary">{t.code}</span>
                      <span className="text-sm text-foreground">{t.nome}</span>
                      {t.publico === "equipe" && (
                        <span className="text-[10px] rounded-full bg-white/5 text-muted-foreground px-2 py-0.5">
                          equipe
                        </span>
                      )}
                      {!t.ativo && (
                        <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-400 px-2 py-0.5">
                          arquivado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.quandoUsar}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2 whitespace-pre-wrap">
                      {t.body}
                    </p>
                    {t.vars.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Variáveis: {t.vars.map((v) => `{{${v.key}}}`).join(" ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title={t.ativo ? "Arquivar" : "Reativar"}
                      onClick={() => arquivar.mutate(t)}
                    >
                      {t.ativo ? (
                        <Archive className="w-3.5 h-3.5" />
                      ) : (
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Excluir"
                      onClick={() => {
                        // Sem confirm(): diálogo do navegador trava a aba e o
                        // "Restaurar padrão" já cobre exclusão por engano.
                        excluir.mutate(t.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400/70" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!isLoading && porCategoria.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum template encontrado.
          </p>
        )}
      </div>

      <EditorTemplate
        alvo={editando}
        categorias={data?.categorias ?? []}
        autoFills={data?.autoFills ?? []}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          invalidar();
          setEditando(null);
        }}
      />
    </InternalLayout>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function EditorTemplate({
  alvo,
  categorias,
  autoFills,
  onFechar,
  onSalvo,
}: {
  alvo: TemplateRow | "novo" | null;
  categorias: string[];
  autoFills: AutoFillOption[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { toast } = useToast();
  const novo = alvo === "novo";
  const atual = alvo && alvo !== "novo" ? alvo : null;

  const [code, setCode] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [quandoUsar, setQuandoUsar] = useState("");
  const [publico, setPublico] = useState<"cliente" | "equipe">("cliente");
  const [body, setBody] = useState("");
  const [vars, setVars] = useState<TemplateVar[]>([]);

  useEffect(() => {
    if (!alvo) return;
    setCode(atual?.code ?? "");
    setNome(atual?.nome ?? "");
    setCategoria(atual?.categoria ?? categorias[0] ?? "");
    setQuandoUsar(atual?.quandoUsar ?? "");
    setPublico((atual?.publico as "cliente" | "equipe") ?? "cliente");
    setBody(atual?.body ?? "");
    setVars(atual?.vars ?? []);
  }, [alvo, atual, categorias]);

  // As chaves vêm do corpo; rótulo e auto-preenchimento sobrevivem à edição.
  const chaves = useMemo(() => extrairChavesDoCorpo(body), [body]);
  const varsEfetivas: TemplateVar[] = useMemo(() => {
    const porChave = new Map(vars.map((v) => [v.key, v]));
    return chaves.map((k) => porChave.get(k) ?? { key: k, label: rotuloPadrao(k) });
  }, [chaves, vars]);

  function ajustarVar(key: string, patch: Partial<TemplateVar>) {
    setVars(varsEfetivas.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  const preview = useMemo(() => {
    const valores: Record<string, string> = { ...EXEMPLO };
    for (const v of varsEfetivas) {
      valores[v.key] = v.auto ? (EXEMPLO[v.auto] ?? `[${v.key}]`) : `«${v.label}»`;
    }
    return renderTemplate(body, valores);
  }, [body, varsEfetivas]);

  const salvar = useMutation({
    mutationFn: () => {
      const payload = {
        code,
        nome,
        categoria,
        quandoUsar,
        publico,
        body,
        vars: varsEfetivas,
      };
      return atual
        ? api.patch(`/internal/whatsapp/templates/${atual.id}`, payload)
        : api.post("/internal/whatsapp/templates", payload);
    },
    onSuccess: () => {
      toast({ title: atual ? "Template salvo" : "Template criado" });
      onSalvo();
    },
    onError: (e: Error) =>
      toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  const podeSalvar = code.trim() && nome.trim() && categoria && body.trim();

  return (
    <Dialog open={alvo !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{novo ? "Novo template" : `Editar ${atual?.code}`}</DialogTitle>
          <DialogDescription>
            Escreva <code>{"{{chave}}"}</code> no texto para criar um campo. O que estiver entre
            chaves vira variável sozinho.
          </DialogDescription>
        </DialogHeader>

        <div className="grid lg:grid-cols-2 gap-5 max-h-[65vh] overflow-y-auto -mx-1 px-1">
          {/* Coluna esquerda: identificação + corpo */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Código</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="HML-05"
                  className="h-9 mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Homologação aprovada"
                  className="h-9 mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Escolher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Público</Label>
                <Select value={publico} onValueChange={(v) => setPublico(v as "cliente" | "equipe")}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="equipe">Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Quando usar</Label>
              <Input
                value={quandoUsar}
                onChange={(e) => setQuandoUsar(e.target.value)}
                placeholder="Homologação aprovada pela concessionária"
                className="h-9 mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Mensagem — *negrito*, _itálico_, {"{{chave}}"} vira campo
              </Label>
              <Textarea
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"💬 *Título da mensagem*\n\nOlá, {{nome}}! ☀️\n\n…"}
                className="mt-1 text-sm font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Coluna direita: variáveis detectadas + prévia */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                Variáveis detectadas ({varsEfetivas.length})
              </Label>
              {varsEfetivas.length === 0 ? (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Nenhuma ainda. Escreva {"{{nome}}"} no texto para criar a primeira.
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  {varsEfetivas.map((v) => (
                    <div key={v.key} className="bg-background/50 rounded-xl p-3">
                      <p className="text-[11px] text-primary font-mono mb-1.5">{`{{${v.key}}}`}</p>
                      <Input
                        value={v.label}
                        onChange={(e) => ajustarVar(v.key, { label: e.target.value })}
                        placeholder="Rótulo do campo"
                        className="h-8 text-xs"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <Select
                          value={v.auto ?? SEM_AUTO}
                          onValueChange={(val) =>
                            ajustarVar(v.key, { auto: val === SEM_AUTO ? undefined : val })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Preencher com…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_AUTO}>Digitar na hora</SelectItem>
                            {autoFills.map((a) => (
                              <SelectItem key={a.value} value={a.value}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.multiline ?? false}
                            onChange={(e) => ajustarVar(v.key, { multiline: e.target.checked })}
                            className="accent-primary"
                          />
                          Texto longo
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Prévia</Label>
              <div className="mt-1 bg-[#0b141a] rounded-xl p-3">
                <div className="bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-2 ml-6">
                  <p className="text-[13px] text-white/95 whitespace-pre-wrap leading-relaxed">
                    {preview || "…"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                «assim» é o que o operador digita na hora; o resto o ERP preenche.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <Button variant="ghost" onClick={onFechar}>
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={!podeSalvar || salvar.isPending}>
            <Save className="w-4 h-4 mr-1.5" /> Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function rotuloPadrao(key: string): string {
  const comEspaco = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return comEspaco.charAt(0).toUpperCase() + comEspaco.slice(1).toLowerCase();
}
