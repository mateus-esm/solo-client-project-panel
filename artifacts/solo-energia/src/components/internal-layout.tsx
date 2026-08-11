import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users2, Package, Sun, KanbanSquare, Wrench, FileCheck2, LogOut, LayoutDashboard, Users, Truck, Wallet, MessageSquareText } from "lucide-react";
import { useAdminLogout } from "@/hooks/use-admin-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/interno/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/interno/clientes", label: "Clientes", icon: Users2 },
  { href: "/interno/servicos", label: "Serviços", icon: Wrench },
  { href: "/interno/usinas", label: "Usinas", icon: Sun },
  { href: "/interno/homologacao", label: "Homologação", icon: FileCheck2 },
  { href: "/interno/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/interno/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/interno/equipes", label: "Equipes", icon: Users },
  { href: "/interno/estoque", label: "Estoque", icon: Package },
  { href: "/interno/templates", label: "Templates", icon: MessageSquareText },
  { href: "/admin", label: "Painel Admin", icon: LayoutDashboard },
];

// Access is enforced by AdminGuard in App.tsx (shared admin session cookie).
export function InternalLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const logout = useAdminLogout();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 shrink-0 border-r border-white/5 bg-card/50 flex flex-col fixed inset-y-0 z-30 max-md:hidden">
        <div className="p-6">
          <Link href="/interno/pipeline">
            <span className="text-lg font-display text-foreground cursor-pointer">
              Solo <span className="text-primary">ERP</span>
            </span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">Operações</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const active = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5">
          <button
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground w-full"
            onClick={() => logout.mutate()}
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-card/90 backdrop-blur border-b border-white/5 flex items-center gap-2 px-4 py-3 overflow-x-auto">
        {NAV.map((item) => {
          const active = location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs whitespace-nowrap cursor-pointer",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      <main className="flex-1 md:ml-60 px-4 md:px-8 py-8 max-md:pt-20 min-w-0">{children}</main>
    </div>
  );
}
