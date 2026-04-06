import { useListDocuments } from "@workspace/api-client-react";
import type { Document, DocumentCategory } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { FileText, Download, Upload, CheckCircle2, FolderOpen, FolderInput } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { staggerContainer, itemUp, redBullSpring } from "@/lib/animations";

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

function DocCard({ doc }: { doc: Document }) {
  const isPending = doc.type === "pending_upload";
  return (
    <motion.div
      variants={itemUp}
      className="glass-card hover:bg-secondary/30 transition-colors rounded-2xl p-6 flex flex-col justify-between group"
    >
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 group-hover:border-white/10 transition-colors">
          <FileText className={`w-6 h-6 ${isPending ? "text-muted-foreground" : "text-primary"}`} />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight mb-1">{doc.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
        </div>
      </div>
      <div className="mb-4">
        {isPending ? (
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
      <div className="pt-4 border-t border-border/50 mt-auto flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {format(parseISO(doc.createdAt), "dd MMM, yyyy", { locale: ptBR })}
        </span>
        {isPending ? (
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Upload className="w-4 h-4" />
            Enviar
          </button>
        ) : (
          <a
            href={doc.fileUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-white/10 text-foreground text-sm font-bold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar
          </a>
        )}
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
  emptyMessage,
  staticDocs,
  sectionNumber,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  docs: Document[];
  emptyMessage?: string;
  staticDocs?: { name: string; description: string }[];
  sectionNumber: string;
}) {
  const hasLiveDocs = docs.length > 0;

  return (
    <section>
      {/* Red Bull editorial heading with ghost number */}
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
          {docs.map(doc => <DocCard key={doc.id} doc={doc} />)}
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
          <p className="text-muted-foreground">{emptyMessage ?? "Nenhum documento nesta categoria."}</p>
        </div>
      )}
    </section>
  );
}

export default function Documents() {
  const { data: documents, isLoading } = useListDocuments();

  const byCategory = (cat: DocumentCategory) =>
    (documents ?? []).filter(d => d.category === cat);

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
            />
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
