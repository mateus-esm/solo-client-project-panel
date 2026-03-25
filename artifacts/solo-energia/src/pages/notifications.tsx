import { useListNotifications } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, AlertCircle, Info, Activity } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };

  const getIconForTitle = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('concluíd') || lowerTitle.includes('aprovad')) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (lowerTitle.includes('pendent') || lowerTitle.includes('atenção')) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    if (lowerTitle.includes('etapa') || lowerTitle.includes('jornada')) return <Activity className="w-5 h-5 text-primary" />;
    return <Info className="w-5 h-5 text-blue-400" />;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-display mb-3">Linha do Tempo</h1>
            <p className="text-muted-foreground text-lg">
              Histórico de atualizações e notificações do seu projeto.
            </p>
          </div>
          <div className="hidden sm:flex w-16 h-16 rounded-full bg-primary/10 items-center justify-center">
            <Bell className="w-8 h-8 text-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6 pl-6 border-l-2 border-border animate-pulse">
            {[1,2,3].map(i => (
              <div key={i} className="relative pl-8 pb-8">
                <div className="absolute left-[-21px] top-0 w-10 h-10 rounded-full bg-card border border-border"></div>
                <div className="h-24 bg-card rounded-2xl border border-border"></div>
              </div>
            ))}
          </div>
        ) : !notifications?.length ? (
          <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
            <Bell className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-foreground font-medium text-lg">Nenhuma notificação</p>
            <p className="text-muted-foreground">Sua linha do tempo está vazia por enquanto.</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-6 bottom-0 w-[2px] bg-gradient-to-b from-primary via-border to-transparent" />

            <div className="space-y-8">
              {notifications.map((notif) => (
                <motion.div key={notif.id} variants={itemVariants} className="relative pl-16">
                  {/* Timeline Node */}
                  <div className={`absolute left-[13px] top-4 w-[22px] h-[22px] rounded-full border-4 border-background z-10 
                    ${notif.read ? 'bg-secondary' : 'bg-primary shadow-[0_0_10px_rgba(255,72,30,0.5)]'}
                  `} />

                  {/* Content Card */}
                  <div className={`bg-card rounded-2xl p-6 border transition-all hover:border-white/10 ${
                    notif.read ? 'border-border/50 opacity-80' : 'border-primary/30 shadow-lg shadow-primary/5'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {getIconForTitle(notif.title)}
                        </div>
                        <div>
                          <h3 className={`font-bold text-lg ${notif.read ? 'text-foreground/90' : 'text-foreground'}`}>
                            {notif.title}
                          </h3>
                          {!notif.read && (
                            <span className="inline-block px-2 py-0.5 mt-1 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md">
                              Novo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground shrink-0 text-right">
                        <span className="block">{formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true, locale: ptBR })}</span>
                        <span className="text-xs opacity-70">{format(parseISO(notif.createdAt), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    </div>
                    <p className={`text-muted-foreground pl-8 sm:pl-8 ${notif.read ? '' : 'text-foreground/80'}`}>
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
