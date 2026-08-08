import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileCheck2, Zap, MapPin, ExternalLink } from "lucide-react";
import { InternalLayout } from "@/components/internal-layout";
import { ChecklistGroups } from "@/components/checklist-groups";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api, type ChecklistItem, type InternalProject } from "@/lib/internal-api";

function ProjectChecklist({ projectId }: { projectId: number }) {
  const queryKey = ["internal-checklist", projectId];
  const { data: items, isLoading } = useQuery<ChecklistItem[]>({
    queryKey,
    queryFn: () => api.get<ChecklistItem[]>(`/internal/projects/${projectId}/checklist`),
  });

  if (isLoading) {
    return <div className="h-32 bg-background/50 rounded-2xl animate-pulse" />;
  }

  return (
    <ChecklistGroups
      projectId={projectId}
      stage="projeto_tecnico_homologacao"
      items={(items ?? []).filter((i) => i.stage === "projeto_tecnico_homologacao")}
      invalidateKeys={[queryKey]}
    />
  );
}

export default function HomologacaoPage() {
  const { data: projects, isLoading } = useQuery<InternalProject[]>({
    queryKey: ["internal-projects", "homologacao"],
    queryFn: () => api.get<InternalProject[]>("/internal/projects?stage=projeto_tecnico_homologacao"),
  });

  return (
    <InternalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-foreground flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-primary" /> Homologação
        </h1>
        <p className="text-sm text-muted-foreground">
          Projetos elétricos em trâmite com a concessionária
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-card rounded-2xl border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (projects ?? []).length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Nenhum projeto em homologação.</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {(projects ?? []).map((p) => (
            <AccordionItem
              key={p.id}
              value={String(p.id)}
              className="bg-card border border-white/5 rounded-2xl px-5 border-b"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-left">
                  <span className="text-foreground font-medium">{p.clientName}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-primary" /> {p.systemPower} kWp
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {p.city}/{p.state}
                    </span>
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <ProjectChecklist projectId={p.id} />
                <Link href={`/interno/projetos/${p.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4 cursor-pointer">
                    Abrir projeto completo <ExternalLink className="w-3 h-3" />
                  </span>
                </Link>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </InternalLayout>
  );
}
