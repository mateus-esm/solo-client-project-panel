import { Link, useLocation } from "wouter";
import { LogOut, LayoutList } from "lucide-react";
import logoUrl from "@assets/001_1775433962945.png";
import { useHomologacaoAuth, useHomologacaoLogout } from "@/hooks/use-homologacao-auth";

const NAV = [
  { href: "/homologacao", label: "Projetos", icon: LayoutList },
];

export function HomologacaoLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { technician } = useHomologacaoAuth();
  const logout = useHomologacaoLogout();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-card border-r border-white/5 z-20">
        <div className="px-5 py-6 border-b border-white/5">
          <img src={logoUrl} alt="Solo Energia" className="h-7 w-auto object-contain mb-2" />
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold block mb-1">Homologação</span>
          <p className="text-xs text-muted-foreground truncate">{technician?.name ?? "Técnico"}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Solo Energia" className="h-6 w-auto object-contain" />
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">Homologação</span>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-60 px-4 md:px-8 py-6 max-w-5xl w-full mx-auto md:mx-0">
        {children}
      </main>
    </div>
  );
}
