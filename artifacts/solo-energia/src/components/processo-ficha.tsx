import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Loader2, Upload, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  KANBAN_STAGES,
  KANBAN_LABELS,
  homologacaoGet,
  homologacaoPatch,
  type Processo,
  type KanbanStage,
} from "@/lib/homologacao-api";

/**
 * Ficha do processo Enel — shared by the technician portal and the admin
 * internal project page. `basePath` selects the API surface:
 *   technician: /homologacao/projects/:id/processo (+ /art-nf upload)
 *   admin:      /internal/projects/:id/processo (no upload endpoint — admin
 *               may still toggle ART paga and edit all fields)
 */
export function ProcessoFicha({
  projectId,
  basePath,
  uploadPath,
}: {
  projectId: number;
  basePath: string;
  uploadPath?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["processo", basePath, projectId];
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: processo, isLoading } = useQuery<Processo>({
    queryKey,
    queryFn: () => homologacaoGet<Processo>(basePath),
  });

  const [draft, setDraft] = useState<Partial<Processo> | null>(null);
  const merged = { ...(processo ?? {}), ...(draft ?? {}) } as Processo;

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => homologacaoPatch<Processo>(basePath, body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      setDraft(null);
      toast({ title: "Ficha atualizada" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function saveField(field: keyof Processo) {
    const value = (merged as any)[field];
    patch.mutate({ [field]: value === "" ? null : value });
  }

  async function uploadNf(file: File) {
    if (!uploadPath) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api${uploadPath}`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Falha no upload");
      }
      const data = await res.json();
      queryClient.setQueryData(queryKey, data);
      toast({ title: "Nota fiscal da ART anexada" });
    } catch (err) {
      toast({
        title: "Erro no upload",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (isLoading || !processo) {
    return (
      <div className="bg-card border border-white/5 rounded-3xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50";
  const labelCls = "block text-xs text-muted-foreground mb-1";

  const links = (merged.linksEnel ?? "")
    .split(/\s+/)
    .filter((l) => l.startsWith("http"));

  return (
    <div className="bg-card border border-white/5 rounded-3xl p-6">
      <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
        <FileCheck2 className="w-4 h-4 text-primary" /> Ficha do Processo — Enel
      </h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Etapa interna (kanban)</label>
          <select
            value={merged.kanbanStage}
            onChange={(e) => patch.mutate({ kanbanStage: e.target.value as KanbanStage })}
            disabled={patch.isPending}
            className={inputCls}
          >
            {KANBAN_STAGES.map((s) => (
              <option key={s} value={s}>
                {KANBAN_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Nº do cliente (UC)</label>
          <input
            className={inputCls}
            value={merged.ucNumero ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, ucNumero: e.target.value }))}
            onBlur={() => draft?.ucNumero !== undefined && saveField("ucNumero")}
            placeholder="Unidade consumidora"
          />
        </div>
        <div>
          <label className={labelCls}>Nº de solicitação</label>
          <input
            className={inputCls}
            value={merged.numeroSolicitacao ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, numeroSolicitacao: e.target.value }))}
            onBlur={() => draft?.numeroSolicitacao !== undefined && saveField("numeroSolicitacao")}
            placeholder="Protocolo na Enel"
          />
        </div>
        <div>
          <label className={labelCls}>E-mail de acompanhamento</label>
          <input
            className={inputCls}
            type="email"
            value={merged.emailAcompanhamento ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, emailAcompanhamento: e.target.value }))}
            onBlur={() => draft?.emailAcompanhamento !== undefined && saveField("emailAcompanhamento")}
            placeholder="E-mail cadastrado na Enel"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Links de acompanhamento (Enel) — um por linha</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={merged.linksEnel ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, linksEnel: e.target.value }))}
            onBlur={() => draft?.linksEnel !== undefined && saveField("linksEnel")}
            placeholder="https://..."
          />
          {links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {links.map((l, i) => (
                <a
                  key={i}
                  href={l}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Link {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Datas previstas por fase */}
      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Datas previstas por fase
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {KANBAN_STAGES.map((s) => (
            <div key={s}>
              <label className={labelCls}>{KANBAN_LABELS[s]}</label>
              <input
                type="date"
                className={inputCls}
                value={merged.datasPrevistas?.[s] ?? ""}
                onChange={(e) => {
                  const datas = { ...(merged.datasPrevistas ?? {}) };
                  if (e.target.value) datas[s] = e.target.value;
                  else delete datas[s];
                  setDraft((d) => ({ ...d, datasPrevistas: datas }));
                }}
                onBlur={() => draft?.datasPrevistas !== undefined && saveField("datasPrevistas")}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ART */}
      <div className="mt-5 flex flex-col md:flex-row md:items-center gap-3 bg-background/50 rounded-2xl px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={merged.artPaga}
            onChange={(e) => patch.mutate({ artPaga: e.target.checked })}
            className="accent-[hsl(var(--primary))] w-4 h-4"
          />
          ART paga
        </label>
        <div className="flex items-center gap-3 md:ml-auto">
          {merged.artNfUrl && (
            <a
              href={merged.artNfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Ver NF da ART
            </a>
          )}
          {uploadPath && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadNf(e.target.files[0])}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="text-xs bg-primary/10 text-primary rounded-lg px-3 py-1.5 flex items-center gap-1 hover:bg-primary/20 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                {merged.artNfUrl ? "Substituir NF" : "Anexar NF da ART"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
