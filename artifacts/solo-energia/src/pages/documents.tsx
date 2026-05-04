import { useRef, useCallback } from "react";
import { useListDocuments, useUploadDocument } from "@workspace/api-client-react";
import type { Document } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  RotateCcw,
  Eye,
  Loader2,
  User,
  Wrench,
  Receipt,
  Scale,
  Package,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { staggerContainer, itemUp, redBullSpring } from "@/lib/animations";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ALLOWED_EXT = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE = 10 * 1024 * 1024;

// Extended document type includes extra fields returned by the API
type ExtendedDocument = Document & { displayCategory?: string };

// Display category config: icon, label, subtitle, section number
const DISPLAY_CATEGORIES: {
  key: string;
  label: string;
  subtitle: string;
  number: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}[] = [
  { key: "cliente", label: "Documentos do Cliente", subtitle: "Você precisa nos enviar estes documentos", number: "01", icon: User, iconBg: "bg-orange-500/10", iconColor: "text-orange-400" },
  { key: "engenharia", label: "Projeto de Engenharia", subtitle: "Documentos técnicos do seu projeto solar", number: "02", icon: Wrench, iconBg: "bg-blue-500/10", iconColor: "text-blue-400" },
  { key: "fiscal", label: "Notas Fiscais", subtitle: "Documentação fiscal dos equipamentos e serviços", number: "03", icon: Receipt, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
  { key: "legal", label: "Documentos Legais", subtitle: "ART, FSA e aprovações regulatórias", number: "04", icon: Scale, iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
  { key: "equipamentos", label: "Equipamentos & Datasheets", subtitle: "Fichas técnicas dos painéis e inversores", number: "05", icon: Package, iconBg: "bg-sky-500/10", iconColor: "text-sky-400" },
];

// Fallback placeholders shown when no live docs exist
const STATIC_PLACEHOLDERS: Record<string, { name: string; description: string }[]> = {
  cliente: [
    { name: "RG / CNH", description: "Documento de identidade do titular" },
    { name: "Conta de Energia", description: "Conta de luz recente (últimos 3 meses)" },
    { name: "IPTU", description: "Comprovante de propriedade do imóvel" },
    { name: "Comprovante de Residência", description: "Conta de água, gás ou correspondência bancária" },
  ],
  engenharia: [
    { name: "Projeto de Engenharia", description: "Planta técnica completa da instalação" },
    { name: "Formulário de Rateio", description: "Distribuição de créditos entre unidades consumidoras" },
  ],
  legal: [
    { name: "FSA — Ficha de Solicitação de Acesso", description: "Formulário enviado à concessionária para homologação" },
    { name: "ART — Anotação de Responsabilidade Técnica", description: "Documento de responsabilidade do engenheiro" },
  ],
};

function getDisplayCategory(doc: ExtendedDocument): string {
  if (doc.displayCategory) return doc.displayCategory;
  return doc.category === "entrada" ? "cliente" : "engenharia";
}

interface DocCardProps {
  doc: ExtendedDocument;
  onUploaded: () => void;
}

function DocCard({ doc, onUploaded }: DocCardProps) {
  const isPending = doc.type === "pending_upload";
  const isUploaded = doc.type === "available_download";
  const isEntrada = doc.category === "entrada";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: uploadDoc, isPending: uploading } = useUploadDocument({
    mutation: {
      onSuccess: () => {
        toast.success(`${doc.name} enviado com sucesso!`);
        onUploaded();
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (err: Error) => {
        toast.error(err?.message || "Erro ao enviar arquivo");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    },
  });

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error("Tipo de arquivo não permitido. Use PDF, JPG ou PNG."); return;
      }
      if (file.size > MAX_SIZE) {
        toast.error("Arquivo muito grande. O limite é 10 MB."); return;
      }
      uploadDoc({ id: doc.id, data: { file } });
    },
    [doc.id, uploadDoc]
  );

  return (
    <motion.div
      variants={itemUp}
      className="glass-card hover:bg-secondary/30 transition-colors rounded-2xl p-6 flex flex-col justify-between group"
    >
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 group-hover:border-white/10 transition-colors">
          <FileText className={`w-6 h-6 ${uploading ? "text-primary animate-pulse" : isUploaded && isEntrada ? "text-[#4ADE80]" : isPending ? "text-muted-foreground" : "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg leading-tight mb-1">{doc.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
        </div>
      </div>

      <div className="mb-4">
        {uploading ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <Loader2 className="w-3 h-3 animate-spin" /> Enviando…
          </span>
        ) : isUploaded && isEntrada ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <CheckCircle2 className="w-3 h-3" /> Enviado ✓
          </span>
        ) : isPending ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <Upload className="w-3 h-3" /> {doc.required ? "Envio Obrigatório" : "Upload Pendente"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider font-mono">
            <Download className="w-3 h-3" /> Solo Envia
          </span>
        )}
      </div>

      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: "var(--brand-gradient)" }}
                initial={{ x: "-100%" }} animate={{ x: "200%" }}
                transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 font-mono">Enviando…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-4 border-t border-border/50 mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {doc.uploadedAt
            ? `Enviado ${format(parseISO(doc.uploadedAt), "dd MMM, yyyy", { locale: ptBR })}`
            : format(parseISO(doc.createdAt), "dd MMM, yyyy", { locale: ptBR })}
        </span>
        <div className="flex items-center gap-2">
          {isEntrada && (
            <input ref={fileInputRef} type="file" accept={ALLOWED_EXT} className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
          )}
          {isUploaded && doc.fileUrl && (
            <a href={doc.fileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-white/10 text-foreground text-sm font-bold rounded-xl transition-colors">
              <Eye className="w-3.5 h-3.5" /> Visualizar
            </a>
          )}
          {isEntrada && (
            <button disabled={uploading} onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isUploaded ? "bg-secondary hover:bg-white/10 text-muted-foreground hover:text-foreground shadow-none" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
              }`}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : isUploaded ? <><RotateCcw className="w-3.5 h-3.5" /> Substituir</> : <><Upload className="w-4 h-4" /> Enviar</>}
            </button>
          )}
          {!isEntrada && doc.fileUrl && (
            <a href={doc.fileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-white/10 text-foreground text-sm font-bold rounded-xl transition-colors">
              <Download className="w-4 h-4" /> Baixar
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
    <motion.div variants={itemUp} className="glass-card rounded-2xl p-6 flex flex-col justify-between">
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight mb-1">{name}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-muted-foreground border border-border text-xs font-semibold uppercase tracking-wider font-mono">
        Aguardando solicitação
      </span>
    </motion.div>
  );
}

function CategorySection({
  catKey, label, subtitle, sectionNumber, IconComponent, iconBg, iconColor, docs, onUploaded,
}: {
  catKey: string;
  label: string;
  subtitle: string;
  sectionNumber: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  docs: ExtendedDocument[];
  onUploaded: () => void;
}) {
  const staticDocs = STATIC_PLACEHOLDERS[catKey];
  const hasLiveDocs = docs.length > 0;

  return (
    <section>
      <div className="relative flex items-center gap-3 mb-6 overflow-hidden">
        <span className="ghost-number" style={{ top: "-1.8rem", right: "0", fontSize: "8rem" }}>{sectionNumber}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative z-10 ${iconBg}`}>
          <IconComponent className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-display">{label}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {hasLiveDocs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => <DocCard key={doc.id} doc={doc} onUploaded={onUploaded} />)}
        </div>
      ) : staticDocs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staticDocs.map((d, i) => <StaticDocPlaceholder key={i} name={d.name} description={d.description} />)}
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
  const { data: rawDocuments, isLoading } = useListDocuments();
  const documents = (rawDocuments ?? []) as ExtendedDocument[];

  const handleUploaded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
  }, [queryClient]);

  // Group by displayCategory
  const grouped: Record<string, ExtendedDocument[]> = {};
  for (const doc of documents) {
    const key = getDisplayCategory(doc);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(doc);
  }

  // Show only categories that either have live docs or have static placeholders (or always show cliente + engenharia)
  const alwaysShow = new Set(["cliente", "engenharia"]);
  const visibleCategories = DISPLAY_CATEGORIES.filter(
    (cat) => alwaysShow.has(cat.key) || (grouped[cat.key] && grouped[cat.key].length > 0)
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={redBullSpring}
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
            <div className="h-40 bg-card rounded-3xl border border-border" />
            <div className="h-40 bg-card rounded-3xl border border-border" />
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-16">
            {visibleCategories.map((cat) => (
              <CategorySection
                key={cat.key}
                catKey={cat.key}
                label={cat.label}
                subtitle={cat.subtitle}
                sectionNumber={cat.number}
                IconComponent={cat.icon}
                iconBg={cat.iconBg}
                iconColor={cat.iconColor}
                docs={grouped[cat.key] ?? []}
                onUploaded={handleUploaded}
              />
            ))}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
