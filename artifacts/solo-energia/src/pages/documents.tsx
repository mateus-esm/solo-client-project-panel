import { useRef, useState, useCallback } from "react";
import { useListDocuments } from "@workspace/api-client-react";
import type { Document, DocumentCategory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  FolderOpen,
  FolderInput,
  RotateCcw,
  Eye,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { staggerContainer, itemUp, redBullSpring } from "@/lib/animations";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ALLOWED_EXT = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE = 10 * 1024 * 1024;

const STATIC_ENTRADA_DOCS = [
  { name: "RG / CNH", description: "Documento de identidade do titular" },
  { name: "Conta de Energia", description: "Conta de luz recente (últimos 3 meses)" },
  { name: "IPTU", description: "Comprovante de propriedade do imóvel" },
  { name: "Comprovante de Residência", description: "Conta de água, gás ou correspondência bancária" },
];

const STATIC_INTRA_DOCS = [
  { name: "FSA — Ficha de Solicitação de Acesso", description: "Formulário enviado à concessionária para homologação" },
  { name: "Formulário de Rateio", description: "Distribuição de créditos entre unidades consumidoras" },
  { name: "ART — Anotação de Responsabilidade Técnica", description: "Documento de responsabilidade do engenheiro" },
  { name: "Projeto de Engenharia", description: "Planta técnica completa da instalação" },
  { name: "Nota Fiscal dos Equipamentos", description: "NF do inversor e dos painéis fotovoltaicos" },
];

interface DocCardProps {
  doc: Document;
  onUploaded: () => void;
}

function DocCard({ doc, onUploaded }: DocCardProps) {
  const isPending = doc.type === "pending_upload";
  const isUploaded = doc.type === "available_download";
  const isEntrada = doc.category === "entrada";

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error("Tipo de arquivo não permitido. Use PDF, JPG ou PNG.");
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error("Arquivo muito grande. O limite é 10 MB.");
        return;
      }

      setUploading(true);
      setProgress(10);

      try {
        const urlRes = await fetch(`/api/documents/${doc.id}/request-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
          }),
        });

        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}));
          throw new Error(err.message || "Erro ao preparar upload");
        }

        const { uploadURL, objectPath } = await urlRes.json();
        setProgress(35);

        const gcsRes = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!gcsRes.ok) throw new Error("Falha ao enviar para o armazenamento");
        setProgress(75);

        const completeRes = await fetch(`/api/documents/${doc.id}/complete-upload`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ objectPath, fileName: file.name }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.message || "Erro ao finalizar upload");
        }

        setProgress(100);
        toast.success(`${doc.name} enviado com sucesso!`);
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          onUploaded();
        }, 600);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar arquivo";
        toast.error(msg);
        setUploading(false);
        setProgress(0);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [doc.id, doc.name, onUploaded]
  );

  return (
    <motion.div
      variants={itemUp}
      className="glass-card hover:bg-secondary/30 transition-colors rounded-2xl p-6 flex flex-col justify-between group"
    >
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 group-hover:border-white/10 transition-colors">
          <FileText
            className={`w-6 h-6 ${
              uploading
                ? "text-primary animate-pulse"
                : isUploaded && isEntrada
                ? "text-[#4ADE80]"
                : isPending
                ? "text-muted-foreground"
                : "text-primary"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg leading-tight mb-1">{doc.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        {uploading ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <Loader2 className="w-3 h-3 animate-spin" />
            Enviando…
          </span>
        ) : isUploaded && isEntrada ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Enviado ✓
          </span>
        ) : isPending ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <Upload className="w-3 h-3" />
            {doc.required ? "Envio Obrigatório" : "Upload Pendente"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <Download className="w-3 h-3" />
            Solo Envia
          </span>
        )}
      </div>

      {/* Progress bar */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--brand-gradient)" }}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 font-mono">{progress}%</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="pt-4 border-t border-border/50 mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {format(parseISO(doc.createdAt), "dd MMM, yyyy", { locale: ptBR })}
        </span>

        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          {isEntrada && (
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          )}

          {isUploaded && doc.fileUrl && (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-white/10 text-foreground text-sm font-bold rounded-xl transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Visualizar
            </a>
          )}

          {isEntrada && (
            <button
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isUploaded
                  ? "bg-secondary hover:bg-white/10 text-muted-foreground hover:text-foreground shadow-none"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
              }`}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isUploaded ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Substituir
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Enviar
                </>
              )}
            </button>
          )}

          {!isEntrada && doc.fileUrl && (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-white/10 text-foreground text-sm font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar
            </a>
          )}

          {!isEntrada && !doc.fileUrl && (
            <span className="text-xs text-muted-foreground font-mono">Em breve</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StaticDocPlaceholder({ name, description }: { name: string; description: string }) {
  return (
    <motion.div
      variants={itemUp}
      className="glass-card rounded-2xl p-6 flex flex-col justify-between"
    >
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight mb-1">{name}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-muted-foreground border border-border text-xs font-semibold uppercase tracking-wider font-mono">
          Aguardando solicitação
        </span>
      </div>
    </motion.div>
  );
}

function CategorySection({
  title,
  subtitle,
  icon,
  docs,
  staticDocs,
  sectionNumber,
  onUploaded,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  docs: Document[];
  staticDocs?: { name: string; description: string }[];
  sectionNumber: string;
  onUploaded: () => void;
}) {
  const hasLiveDocs = docs.length > 0;

  return (
    <section>
      <div className="relative flex items-center gap-3 mb-6 overflow-hidden">
        <span className="ghost-number" style={{ top: "-1.8rem", right: "0", fontSize: "8rem" }}>{sectionNumber}</span>
        {icon}
        <div className="relative z-10">
          <h2 className="text-2xl font-display">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {hasLiveDocs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => (
            <DocCard key={doc.id} doc={doc} onUploaded={onUploaded} />
          ))}
        </div>
      ) : staticDocs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staticDocs.map((d, i) => (
            <StaticDocPlaceholder key={i} name={d.name} description={d.description} />
          ))}
        </div>
      ) : (
        <div className="glass-card border-dashed rounded-3xl p-8 text-center flex flex-col items-center">
          <CheckCircle2 className="w-12 h-12 mb-3" style={{ color: "#4ADE80" }} />
          <p className="text-muted-foreground">Nenhum documento nesta categoria.</p>
        </div>
      )}
    </section>
  );
}

export default function Documents() {
  const queryClient = useQueryClient();
  const { data: documents, isLoading } = useListDocuments();

  const handleUploaded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
  }, [queryClient]);

  const byCategory = (cat: DocumentCategory) =>
    (documents ?? []).filter((d) => d.category === cat);

  const entradaDocs = byCategory("entrada");
  const intraProjetoDocs = byCategory("intra_projeto");

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Page header with grain hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={redBullSpring}
          className="glass-card grain-overlay rounded-3xl p-8 mb-10 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/8 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-[0.22em] font-mono mb-3">Central de Documentos</p>
            <h1 className="text-3xl md:text-4xl font-display mb-3">Seus Documentos</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Gerencie as documentações necessárias para o andamento do seu projeto solar.
            </p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-16">
            <CategorySection
              title="Documentos de Entrada"
              subtitle="Você precisa nos enviar estes documentos"
              sectionNumber="01"
              icon={
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center relative z-10">
                  <FolderInput className="w-5 h-5 text-orange-400" />
                </div>
              }
              docs={entradaDocs}
              staticDocs={entradaDocs.length === 0 ? STATIC_ENTRADA_DOCS : undefined}
              onUploaded={handleUploaded}
            />

            <CategorySection
              title="Documentos do Projeto"
              subtitle="Gerados e disponibilizados pela Solo Energia"
              sectionNumber="02"
              icon={
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center relative z-10">
                  <FolderOpen className="w-5 h-5 text-blue-400" />
                </div>
              }
              docs={intraProjetoDocs}
              staticDocs={intraProjetoDocs.length === 0 ? STATIC_INTRA_DOCS : undefined}
              onUploaded={handleUploaded}
            />
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
