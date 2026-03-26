import { useListDocuments } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { FileText, Download, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Documents() {
  const { data: documents, isLoading } = useListDocuments();

  const pendingDocs = documents?.filter(d => d.type === "pending_upload") || [];
  const availableDocs = documents?.filter(d => d.type === "available_download") || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-display mb-3">Central de Documentos</h1>
          <p className="text-muted-foreground text-lg">
            Gerencie as documentações necessárias para o andamento do seu projeto solar.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
            <div className="h-40 bg-card rounded-3xl border border-border"></div>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-12">
            
            {/* PENDENCIAS SECTION */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                </div>
                <h2 className="text-2xl font-display">Pendências ({pendingDocs.length})</h2>
              </div>
              
              {pendingDocs.length === 0 ? (
                <div className="bg-card border border-border border-dashed rounded-3xl p-8 text-center flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="text-foreground font-medium text-lg">Tudo certo por aqui!</p>
                  <p className="text-muted-foreground">Você não possui documentos pendentes para envio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingDocs.map(doc => (
                    <motion.div key={doc.id} variants={itemVariants} className="bg-card hover:bg-secondary/80 transition-colors border border-border rounded-2xl p-6 flex flex-col justify-between group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-tight mb-1">{doc.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-xs font-semibold uppercase tracking-wider">
                          <Upload className="w-3 h-3" />
                          Upload Obrigatório
                        </span>
                      </div>
                      
                      <div className="pt-4 border-t border-border mt-auto flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Solicitado em {format(parseISO(doc.createdAt), "dd MMM, yyyy", { locale: ptBR })}
                        </span>
                        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                          <Upload className="w-4 h-4" />
                          Enviar
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* DISPONIVEIS SECTION */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-display">Disponíveis ({availableDocs.length})</h2>
              </div>
              
              {availableDocs.length === 0 ? (
                <div className="bg-card border border-border border-dashed rounded-3xl p-8 text-center flex flex-col items-center">
                  <FileText className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">Nenhum documento disponível para download ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableDocs.map(doc => (
                    <motion.div key={doc.id} variants={itemVariants} className="bg-card hover:bg-secondary/80 transition-colors border border-border rounded-2xl p-6 flex flex-col justify-between group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-tight mb-1">{doc.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider">
                          <Download className="w-3 h-3" />
                          Solo Envia
                        </span>
                      </div>
                      
                      <div className="pt-4 border-t border-border mt-auto flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Adicionado em {format(parseISO(doc.createdAt), "dd MMM, yyyy", { locale: ptBR })}
                        </span>
                        <a 
                          href={doc.fileUrl || "#"} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-white/10 text-foreground text-sm font-bold rounded-xl transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Baixar
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

          </motion.div>
        )}
      </div>
    </Layout>
  );
}
