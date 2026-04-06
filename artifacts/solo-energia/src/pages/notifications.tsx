import { useListNotifications } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, AlertCircle, Info, Activity } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { staggerContainerFast, itemLeft, redBullSpring } from "@/lib/animations";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications();

  const getIconForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("concluíd") || t.includes("aprovad"))
      return <CheckCircle2 className="w-5 h-5" style={{ color: "#4ADE80" }} />;
    if (t.includes("pendent") || t.includes("atenção"))
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    if (t.includes("etapa") || t.includes("jornada"))
      return <Activity className="w-5 h-5 text-primary" />;
    return <Info className="w-5 h-5 text-blue-400" />;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={redBullSpring}
          className="glass-card grain-overlay rounded-3xl p-8 mb-10 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/8 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.22em] font-mono mb-3">Histórico</p>
              <h1 className="text-3xl md:text-4xl font-display mb-2">Linha do Tempo</h1>
              <p className="text-muted-foreground">
                Atualizações e notificações do seu projeto.
              </p>
            </div>
            <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center border border-primary/20 shrink-0">
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="space-y-6 pl-6 border-l-2 border-border animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="relative pl-8 pb-8">
                <div className="absolute left-[-21px] top-0 w-10 h-10 rounded-full bg-card border border-border" />
                <div className="h-24 bg-card rounded-2xl border border-border" />
              </div>
            ))}
          </div>
        ) : !notifications?.length ? (
          <div className="glass-card border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
            <Bell className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
            <p className="text-foreground font-medium text-lg">Nenhuma notificação</p>
            <p className="text-muted-foreground">Sua linha do tempo está vazia por enquanto.</p>
          </div>
        ) : (
          <motion.div variants={staggerContainerFast} initial="hidden" animate="show" className="relative">
            {/* Timeline gradient line */}
            <div
              className="absolute left-6 top-6 bottom-0 w-[2px]"
              style={{ background: "linear-gradient(to bottom, #FF481E 0%, rgba(255,72,30,0.3) 60%, transparent 100%)" }}
            />

            <div className="space-y-8">
              {notifications.map((notif) => (
                <motion.div key={notif.id} variants={itemLeft} className="relative pl-16">
                  {/* Timeline Node */}
                  <div className={`
                    absolute left-[13px] top-4 w-[22px] h-[22px] rounded-full border-[3px] border-background z-10
                    ${notif.read
                      ? "bg-secondary"
                      : "bg-primary"
                    }
                  `}
                  style={!notif.read ? { boxShadow: "0 0 12px rgba(255, 72, 30, 0.55)" } : undefined}
                  />

                  {/* Content Card */}
                  <div className={`glass-card rounded-2xl p-6 transition-all ${
                    notif.read
                      ? "opacity-75"
                      : "border-primary/20 shadow-[0_4px_24px_rgba(255,72,30,0.07)]"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {getIconForTitle(notif.title)}
                        </div>
                        <div>
                          <h3 className={`font-bold text-lg ${notif.read ? "text-foreground/80" : "text-foreground"}`}>
                            {notif.title}
                          </h3>
                          {!notif.read && (
                            <span className="inline-block px-2 py-0.5 mt-1 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md font-mono">
                              Novo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground shrink-0 text-right font-mono">
                        <span className="block">{formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true, locale: ptBR })}</span>
                        <span className="text-xs opacity-60 tabular-nums">{format(parseISO(notif.createdAt), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    </div>
                    <p className={`pl-8 ${notif.read ? "text-muted-foreground" : "text-foreground/80"}`}>
                      {notif.message}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
